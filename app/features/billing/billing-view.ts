// Small rules the plan page and the Checkout call share (item 21b). Pure.

export type PriceInfo = { amount: number; currency: string; interval: "month" | "year" };

/**
 * How much cheaper the yearly price is than twelve monthly ones, in whole
 * percent; null when it is not cheaper or the currencies differ. Computed from
 * the two Stripe prices, so there is no second number to drift.
 */
export function savingPercent(monthly: PriceInfo, yearly: PriceInfo): number | null {
  if (monthly.currency !== yearly.currency) return null;
  const twelve = monthly.amount * 12;
  if (twelve <= 0 || yearly.amount >= twelve) return null;
  return Math.round((1 - yearly.amount / twelve) * 100);
}

/** A free trial is for a site that has never had a subscription or a customer. */
export function trialEligible(
  site: { billingSubscriptionId: string | null; billingCustomerId: string | null },
  trialDays: number,
): boolean {
  return trialDays > 0 && site.billingSubscriptionId === null && site.billingCustomerId === null;
}

/**
 * Whether a site may start Checkout. A Free site with a subscription Stripe
 * still holds (unpaid, paused, odd) would get a second one beside it, and only
 * the newer id is kept (F-407); it manages the first in the Portal instead.
 * Only a cancelled one, or none, lets a site start again.
 */
export function canStartCheckout(site: {
  plan: "free" | "paid";
  subscriptionId: string | null;
  billingStatus: "active" | "past_due" | "canceled" | null;
}): boolean {
  if (site.plan === "paid") return false;
  return site.subscriptionId === null || site.billingStatus === "canceled";
}
