import { formatStorageLimit } from "#app/features/media/storage-limit.ts";
import type { Limits, Plan } from "./plan-limits.ts";

// What the plan page says about a plan (item 21a, Step 8). Pure: the limits
// come in, the words go out.

export const planName = (plan: Plan): string => (plan === "paid" ? "Launch" : "Free");

/** The lines under "What Launch adds", derived from the two plans' limits. */
export function launchAdds(free: Limits, launch: Limits): string[] {
  const lines: string[] = [];
  if (free.storageBytes !== null) {
    if (launch.storageBytes === null) lines.push("No storage limit");
    else if (launch.storageBytes > free.storageBytes) {
      lines.push(
        `${formatStorageLimit(launch.storageBytes)} of storage instead of ${formatStorageLimit(free.storageBytes)}`,
      );
    }
  }
  if (free.aiCredits !== null) {
    if (launch.aiCredits === null) lines.push("No monthly AI limit");
    else if (launch.aiCredits > free.aiCredits) lines.push("A larger monthly AI allowance");
  }
  lines.push('No "Made with Habre" link in your site\'s footer');
  return lines;
}

export type BillingFacts = {
  plan: Plan;
  billingStatus: "active" | "past_due" | "canceled" | null;
  customerId: string | null;
  subscriptionId: string | null;
  paidUntil: Date | null;
  interval: "month" | "year" | null;
  trialEndsAt: Date | null;
};

export type BillingNotice = { tone: "success" | "error" | "notice"; title: string; body?: string };

const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** "3 November 2026", in UTC so the server and the browser say the same. */
export const formatPlanDate = (date: Date): string => DATE_FORMAT.format(date);

/** An amount in a currency's smallest unit ("1900", "usd") as "$19.00". */
export function formatPrice(amount: number, currency: string): string {
  const format = new Intl.NumberFormat("en", {
    style: "currency",
    currency: currency.toUpperCase(),
  });
  const digits = format.resolvedOptions().maximumFractionDigits ?? 2;
  return format.format(amount / 10 ** digits);
}

/**
 * The one standing or just-happened billing message the plan page shows, or
 * null. Pure: the site's billing facts come in, the words go out (item 21b).
 */
export function planNotice(
  facts: BillingFacts,
  options: { checkoutDone: boolean },
): BillingNotice | null {
  const { plan, billingStatus } = facts;
  if (plan === "paid") {
    if (billingStatus === "past_due") {
      return {
        tone: "error",
        title: "Your last payment didn't go through.",
        body: "Update your card in Manage billing to keep Launch.",
      };
    }
    if (facts.trialEndsAt !== null) {
      const then = facts.interval === "year" ? "yearly" : "monthly";
      return {
        tone: "notice",
        title: `Free trial until ${formatPlanDate(facts.trialEndsAt)}.`,
        body: `Then billed ${then}. Cancel any time before then in Manage billing.`,
      };
    }
    // A subscription set to cancel at period end is recorded as `canceled`
    // while the plan is still Launch (billing-events.ts).
    if (billingStatus === "canceled" && facts.paidUntil !== null) {
      return {
        tone: "notice",
        title: `Launch until ${formatPlanDate(facts.paidUntil)}.`,
        body: "Your subscription is cancelled and will not renew. Your pages stay as they are.",
      };
    }
    return null;
  }
  if (options.checkoutDone) {
    return {
      tone: "success",
      title: "Payment received.",
      body: "Your plan updates in a moment. Reload this page to see it.",
    };
  }
  if (billingStatus === "past_due") {
    return {
      tone: "error",
      title: "Your subscription ended after a failed payment.",
      body: "You're on Free limits and your pages stay as they are. Open Manage billing to pay or end it.",
    };
  }
  if (billingStatus === "canceled") {
    return {
      tone: "notice",
      title: "Your Launch subscription has ended.",
      body: "You're on Free limits and your pages stay as they are. You can start again below.",
    };
  }
  return null;
}
