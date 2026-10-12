import { useEffect } from "react";
import { data, Form, redirect, useNavigation, useRevalidator } from "react-router";
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
import {
  addDomain,
  checkDomain,
  findSiteDomain,
  removeDomain,
} from "#app/features/own-domain/own-domain.server.ts";
import { verificationRecords } from "#app/features/own-domain/own-domain.ts";
import { domainLookups } from "#app/features/own-domain/own-domain-dns.server.ts";
import { checkLimit } from "#app/features/own-domain/own-domain-limits.server.ts";
import { prewarmDomain } from "#app/features/own-domain/own-domain-prewarm.server.ts";
import {
  outcomeMessage,
  ownDomainState,
  refusalMessage,
} from "#app/features/own-domain/own-domain-view.ts";
import { findMemberSite } from "#app/features/sites/find-site.server.ts";
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
  const [facts, storedBytes, creditsUsed, prices, domainRow, memberSite] = await Promise.all([
    findBillingFacts(user.siteId),
    storageUsed(user.siteId),
    // Only while AI is on: with it off the page has no AI meter.
    runner === null ? 0 : runStore.creditsUsedSince(user.siteId, startOfUtcMonth(now)),
    // Only a Free site is offered a choice, and only with billing on (21b).
    billing !== null && env.BILLING !== null ? billing.prices() : null,
    findSiteDomain(user.siteId),
    findMemberSite(user.siteId),
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
  // Own domain (item 21c). A DNS name carries no port, so the records name
  // the subdomain by hostname.
  const siteHost = `${memberSite.subdomain}.${new URL(env.SITES_URL).hostname}`;
  const state = ownDomainState({ plan, billingOn: billing !== null, row: domainRow });
  const waitingRow = state === "waiting" && domainRow?.token ? domainRow : null;
  // Best effort, only to tell a bare-domain owner which A record to use.
  const siteAddresses = waitingRow === null ? "error" : await domainLookups.addresses(siteHost);
  const ownDomain = {
    state,
    domain: domainRow?.domain ?? null,
    siteHost,
    records:
      waitingRow === null
        ? null
        : verificationRecords(waitingRow.domain, waitingRow.token as string, siteHost),
    addresses: siteAddresses === "error" ? [] : [...siteAddresses],
  };
  return {
    ownDomain,
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
 * Upgrade (Stripe Checkout) and Manage billing (Customer Portal), item 21b:
 * both only send the admin to Stripe's own page; the plan changes when the
 * webhook arrives, never here (D160). Billing off is a 404 for those two.
 *
 * Own domain, item 21c: add-domain, check-domain and remove-domain work with
 * billing off too. None of them reads a site or a domain from the body, so
 * only the caller's own site is ever touched. Each answers 200 with data (the
 * loader then reloads the section) or a 4xx with the reason to show.
 */
export async function action({ request, context }: Route.ActionArgs) {
  if (!isUserFormBodyAllowed(request.headers)) {
    throw data("Request too large", { status: 413 });
  }
  const user = context.get(userContext);
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "add-domain") {
    const typed = String(form.get("domain") ?? "");
    const result = await addDomain({
      siteId: user.siteId,
      typed,
      hosts: {
        platformHost: new URL(env.PLATFORM_URL).host,
        sitesHost: new URL(env.SITES_URL).host,
      },
    });
    if (!result.ok) {
      return data(
        { domainError: refusalMessage(result.reason), domainValue: typed },
        { status: 400 },
      );
    }
    return data({ domainAdded: true });
  }

  if (intent === "check-domain") {
    const current = await findSiteDomain(user.siteId);
    if (current === null) throw data("Bad Request", { status: 400 });
    // An answer that needs no lookup is free; only a real check spends one.
    if (current.verifiedAt === null && !checkLimit.attempt(user.siteId)) {
      return data(
        { domainNotice: { tone: "error", title: refusalMessage("rate_limited") } as const },
        { status: 429 },
      );
    }
    const siteHost = `${(await findMemberSite(user.siteId)).subdomain}.${new URL(env.SITES_URL).hostname}`;
    const result = await checkDomain({ siteId: user.siteId, siteHost });
    if (result === null) throw data("Bad Request", { status: 400 });
    // Fire and forget: the answer never waits for the certificate request.
    if (result.newlyVerified) void prewarmDomain(current.domain);
    return data({
      domainNotice: {
        tone: result.outcome === "verified" ? ("success" as const) : ("error" as const),
        title: outcomeMessage(result.outcome),
      },
    });
  }

  if (intent === "remove-domain") {
    if (!(await removeDomain(user.siteId))) throw data("Bad Request", { status: 400 });
    return data({ domainRemoved: true });
  }

  if ((intent === "upgrade" || intent === "manage") && billing === null) {
    throw data("Not Found", { status: 404 });
  }
  if (billing === null) throw data("Bad Request", { status: 400 });
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
  const {
    isLaunch,
    name,
    storage,
    allowance,
    adds,
    billingOn,
    offer,
    canManage,
    notice,
    ownDomain,
  } = loaderData;
  const navigation = useNavigation();
  const revalidator = useRevalidator();
  const waiting = ownDomain.state === "waiting";

  // While the domain waits for its records, look again every 15 s (the server's
  // own checker verifies it) so the page turns to "verified" without a click.
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => {
      if (document.hidden) return;
      if (navigation.state !== "idle" || revalidator.state !== "idle") return;
      void revalidator.revalidate();
    }, 15_000);
    return () => clearInterval(timer);
  }, [waiting, navigation.state, revalidator]);

  const sending = navigation.state !== "idle" && navigation.formMethod === "POST";
  const sendingIntent = sending ? String(navigation.formData?.get("intent")) : null;
  const domainError = actionData && "domainError" in actionData ? actionData.domainError : null;
  const domainValue = actionData && "domainValue" in actionData ? actionData.domainValue : "";
  const domainNotice = actionData && "domainNotice" in actionData ? actionData.domainNotice : null;
  const domainRemoved = actionData && "domainRemoved" in actionData;

  return (
    <>
      <div className={styles.header}>
        <h1 className={styles.title}>Plan</h1>
      </div>
      <p>Your site is on the {name} plan.</p>
      {actionData && "error" in actionData && <Message tone="error" title={actionData.error} />}
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
      <section className={styles.domain} aria-labelledby="domain-title">
        <h2 id="domain-title" className={styles.cardTitle}>
          Own domain
        </h2>
        {domainError && <Message tone="error" title={domainError} />}
        {domainNotice && <Message tone={domainNotice.tone} title={domainNotice.title} />}
        {domainRemoved && (
          <Message tone="success" title="Domain removed.">
            Your free address serves your site again.
          </Message>
        )}
        {ownDomain.state === "free-billing" && (
          <>
            <p>
              Use your own domain. It becomes your site's address, and your free address redirects
              to it.
            </p>
            <p>Your own domain is part of Launch. Choose how to pay above to add one.</p>
          </>
        )}
        {ownDomain.state === "free-no-billing" && <p>Your own domain is part of Launch.</p>}
        {ownDomain.state === "none" && (
          <Form method="post" className={styles.offer}>
            <input type="hidden" name="intent" value="add-domain" />
            <div className={styles.field}>
              <label htmlFor="domain-input">Domain</label>
              <input
                id="domain-input"
                name="domain"
                type="text"
                autoComplete="off"
                inputMode="url"
                defaultValue={domainValue}
                aria-invalid={domainError ? true : undefined}
              />
              <p className={styles.muted}>Type your domain, like example.org.</p>
            </div>
            <Button type="submit" variant="primary" isPending={sendingIntent === "add-domain"}>
              {sendingIntent === "add-domain" ? "Adding…" : "Add domain"}
            </Button>
          </Form>
        )}
        {ownDomain.state === "waiting" && ownDomain.records && (
          <>
            <p>Add these two records at your domain's DNS provider, then press Check now.</p>
            <div className={styles.records}>
              <table>
                <caption>Records to add at your domain's DNS provider</caption>
                <thead>
                  <tr>
                    <th scope="col">Type</th>
                    <th scope="col">Name</th>
                    <th scope="col">Value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>TXT</td>
                    <td>
                      <code>{ownDomain.records.txt.name}</code>
                    </td>
                    <td>
                      <code>{ownDomain.records.txt.value}</code>
                    </td>
                  </tr>
                  <tr>
                    <td>CNAME</td>
                    <td>
                      <code>{ownDomain.records.reach.name}</code>
                    </td>
                    <td>
                      <code>{ownDomain.records.reach.target}</code>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            {ownDomain.addresses.length > 0 && (
              <p>
                A bare domain cannot use a CNAME at some providers; use an A record with:{" "}
                {ownDomain.addresses.map((address, index) => (
                  <span key={address}>
                    {index > 0 && ", "}
                    <code>{address}</code>
                  </span>
                ))}
                .
              </p>
            )}
            <p>Cloudflare: use DNS only (grey cloud), not Proxied.</p>
            <p>We check by ourselves for 24 hours; press Check now to look straight away.</p>
            <div className={styles.actions}>
              <Form method="post">
                <input type="hidden" name="intent" value="check-domain" />
                <Button
                  type="submit"
                  variant="primary"
                  isPending={sendingIntent === "check-domain"}
                >
                  {sendingIntent === "check-domain" ? "Checking…" : "Check now"}
                </Button>
              </Form>
              <Form method="post">
                <input type="hidden" name="intent" value="remove-domain" />
                <Button type="submit" isPending={sendingIntent === "remove-domain"}>
                  Remove
                </Button>
              </Form>
            </div>
          </>
        )}
        {ownDomain.state === "verified" && ownDomain.domain && (
          <>
            <p>
              <strong>{ownDomain.domain}</strong> is your site's address. {ownDomain.siteHost}{" "}
              redirects to it.
            </p>
            <Form method="post" className={styles.offer}>
              <input type="hidden" name="intent" value="remove-domain" />
              <Button type="submit" isPending={sendingIntent === "remove-domain"}>
                Remove
              </Button>
            </Form>
            <p className={styles.muted}>
              Removing it makes {ownDomain.siteHost} serve your site again.
            </p>
          </>
        )}
      </section>
    </>
  );
}
