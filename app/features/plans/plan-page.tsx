import { data, Form, redirect, useNavigation } from "react-router";
import { allowanceSummary } from "#app/features/ai/allowance-summary.ts";
import { startOfUtcMonth } from "#app/features/ai/credits.ts";
import { runner } from "#app/features/ai/runner.server.ts";
import { runStore } from "#app/features/ai/runs.server.ts";
import { requireRole } from "#app/features/auth/require-role.server.ts";
import { userContext } from "#app/features/auth/user-context.ts";
import { findBillingFacts } from "#app/features/billing/billing-store.server.ts";
import {
  canStartCheckout,
  savingPercent,
  trialEligible,
} from "#app/features/billing/billing-view.ts";
import { billing } from "#app/features/billing/stripe.server.ts";
import { storageUsed } from "#app/features/media/media.server.ts";
import { storageSummary } from "#app/features/media/storage-limit.ts";
import { isUserFormBodyAllowed } from "#app/features/users/user-input.ts";
import { env } from "#app/lib/env.server.ts";
import { Button } from "#app/lib/ui/button.tsx";
import { Message } from "#app/lib/ui/message.tsx";
import { Meter } from "#app/lib/ui/meter.tsx";
import type { Route } from "./+types/plan-page";
import { limitsFor } from "./plan-limits.ts";
import styles from "./plan-page.module.css";
import { formatPrice, launchAdds, planName, planNotice } from "./plan-view.ts";

// Admin only; a non-admin gets the same 404 as every other refusal.
export const middleware: Route.MiddlewareFunction[] = [requireRole(["admin"])];

export function meta(_: Route.MetaArgs) {
  return [{ title: "Plan - Habre CMS" }];
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const user = context.get(userContext);
  const now = new Date();
  const checkoutDone = new URL(request.url).searchParams.get("checkout") === "done";
  const [facts, storedBytes, creditsUsed, prices] = await Promise.all([
    findBillingFacts(user.siteId),
    storageUsed(user.siteId),
    // Only while AI is on: with it off the page has no AI meter.
    runner === null ? 0 : runStore.creditsUsedSince(user.siteId, startOfUtcMonth(now)),
    // Only a Free site is offered a choice, and only with billing on (21b).
    billing !== null && env.BILLING !== null ? billing.prices() : null,
  ]);
  const { plan } = facts;
  const limits = limitsFor(plan, env.PLAN_LIMITS);
  const trialDays = env.BILLING?.trialDays ?? 0;
  const offer =
    billing === null ||
    !canStartCheckout({
      plan,
      subscriptionId: facts.subscriptionId,
      billingStatus: facts.billingStatus,
    })
      ? null
      : {
          // Unreadable prices leave the amounts out; Checkout shows the real one.
          monthly: prices && formatPrice(prices.monthly.amount, prices.monthly.currency),
          yearly: prices && formatPrice(prices.yearly.amount, prices.yearly.currency),
          saving: prices && savingPercent(prices.monthly, prices.yearly),
          trialDays: trialEligible(
            { billingSubscriptionId: facts.subscriptionId, billingCustomerId: facts.customerId },
            trialDays,
          )
            ? trialDays
            : 0,
        };
  return {
    billingOn: billing !== null,
    offer,
    canManage: billing !== null && facts.customerId !== null,
    notice: planNotice(facts, { checkoutDone }),
    isLaunch: plan === "paid",
    name: planName(plan),
    storage: storageSummary(storedBytes, limits.storageBytes),
    allowance:
      runner === null || env.AI === null
        ? null
        : allowanceSummary(creditsUsed, limits.aiCredits, now),
    adds: launchAdds(env.PLAN_LIMITS.free, env.PLAN_LIMITS.launch),
  };
}

const REFUSALS = {
  unavailable: "Payment is unavailable right now. Try again in a minute.",
  already_paid: "Your site is already on Launch.",
  has_subscription: "Your site still has a subscription. Open Manage billing to fix or end it.",
  invalid: "Choose monthly or yearly.",
  no_customer: "There is no subscription to manage yet.",
} as const;

/**
 * Upgrade (Stripe Checkout) and Manage billing (Customer Portal), item 21b.
 * Both only send the admin to Stripe's own page: the plan changes when the
 * webhook arrives, never here (D160). Billing off is a 404, like the webhook.
 */
export async function action({ request, context }: Route.ActionArgs) {
  if (billing === null) throw data("Not Found", { status: 404 });
  if (!isUserFormBodyAllowed(request.headers)) {
    throw data("Request too large", { status: 413 });
  }
  const user = context.get(userContext);
  const form = await request.formData();
  const intent = form.get("intent");
  const facts = await findBillingFacts(user.siteId);

  const result =
    intent === "upgrade"
      ? await billing.startCheckout({
          siteId: user.siteId,
          email: user.email,
          customerId: facts.customerId,
          plan: facts.plan,
          hasLiveSubscription: !canStartCheckout({
            plan: facts.plan,
            subscriptionId: facts.subscriptionId,
            billingStatus: facts.billingStatus,
          }),
          interval: form.get("interval") === "yearly" ? "yearly" : "monthly",
          trialEligible: trialEligible(
            { billingSubscriptionId: facts.subscriptionId, billingCustomerId: facts.customerId },
            env.BILLING?.trialDays ?? 0,
          ),
        })
      : intent === "manage"
        ? await billing.openPortal({ customerId: facts.customerId })
        : null;
  if (result === null) throw data("Bad Request", { status: 400 });
  if (result.ok) return redirect(result.url, 303);
  return data(
    { error: REFUSALS[result.reason] },
    { status: result.reason === "unavailable" ? 503 : 400 },
  );
}

export default function PlanPage({ loaderData, actionData }: Route.ComponentProps) {
  const { isLaunch, name, storage, allowance, adds, billingOn, offer, canManage, notice } =
    loaderData;
  const navigation = useNavigation();
  const sending = navigation.state !== "idle" && navigation.formMethod === "POST";
  const sendingIntent = sending ? String(navigation.formData?.get("intent")) : null;

  return (
    <>
      <div className={styles.header}>
        <h1 className={styles.title}>Plan</h1>
      </div>
      <p>Your site is on the {name} plan.</p>
      {actionData?.error && <Message tone="error" title={actionData.error} />}
      {notice && (
        <Message tone={notice.tone} title={notice.title}>
          {notice.body}
        </Message>
      )}
      <div className={styles.grid}>
        <section className={styles.card} aria-labelledby="use-title">
          <h2 id="use-title" className={styles.cardTitle}>
            This month
          </h2>
          {allowance && (
            <Meter
              label="AI allowance"
              text={allowance.text}
              value={allowance.value}
              max={allowance.max}
            />
          )}
          <Meter
            label="Storage"
            text={
              storage.limitText
                ? `${storage.usedText} of ${storage.limitText} used`
                : `${storage.usedText} used`
            }
            value={storage.value}
            max={storage.max}
          />
        </section>
        <section className={styles.card} aria-labelledby="adds-title">
          <h2 id="adds-title" className={styles.cardTitle}>
            {isLaunch ? "What Launch includes" : "What Launch adds"}
          </h2>
          <ul className={styles.list}>
            {adds.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      </div>
      {!billingOn && <p className={styles.muted}>Paid plans are coming soon.</p>}
      {offer !== null && (
        <Form method="post" className={styles.offer}>
          <input type="hidden" name="intent" value="upgrade" />
          <fieldset className={styles.choices}>
            <legend className={styles.cardTitle}>Choose how to pay</legend>
            <label className={styles.choice}>
              <input type="radio" name="interval" value="monthly" defaultChecked />
              <span>Monthly{offer.monthly !== null && <>, {offer.monthly}</>}</span>
            </label>
            <label className={styles.choice}>
              <input type="radio" name="interval" value="yearly" />
              <span>
                Yearly{offer.yearly !== null && <>, {offer.yearly}</>}
                {offer.saving !== null && <> - save {offer.saving}% a year</>}
              </span>
            </label>
          </fieldset>
          <Button type="submit" variant="primary" isPending={sendingIntent === "upgrade"}>
            {sendingIntent === "upgrade"
              ? "Taking you to Stripe…"
              : offer.trialDays > 0
                ? `Start your ${offer.trialDays}-day free trial`
                : "Upgrade"}
          </Button>
        </Form>
      )}
      {canManage && (
        <Form method="post" className={styles.offer}>
          <input type="hidden" name="intent" value="manage" />
          <Button type="submit" isPending={sendingIntent === "manage"}>
            {sendingIntent === "manage" ? "Taking you to Stripe…" : "Manage billing"}
          </Button>
        </Form>
      )}
    </>
  );
}
