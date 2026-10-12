// What a Stripe event means for a site's plan (item 21b, D160, D150). Pure: the
// verified event comes in, a plan change (or nothing) goes out, and
// apply-event.server.ts does the writing. The event is read structurally, not
// through the SDK's types, so this runs under node --test with fixture objects
// and a field Stripe moves between API versions fails soft rather than throws.

export type StripeEventLike = {
  id: string;
  type: string;
  created: number;
  data: { object: unknown };
};

export type PlanChange = {
  // How to find the site, tried subscription, customer, then id: a checkout
  // names the site by its id, and a subscription carries it in its metadata
  // (set at Checkout), so an event that arrives before the checkout's own still
  // finds its site.
  match: { siteId?: string; subscriptionId?: string; customerId?: string };
  // A subscription event carries the whole state, so null fields clear; a
  // checkout carries only the ids, so they leave the rest as it was.
  source: "checkout" | "subscription";
  plan: "free" | "paid";
  billingStatus: "active" | "past_due" | "canceled";
  // Null leaves what the site already holds untouched.
  customerId: string | null;
  subscriptionId: string | null;
  paidUntil: Date | null;
  billingInterval: "month" | "year" | null;
  trialEndsAt: Date | null;
  eventAt: Date;
};

type Fields = Record<string, unknown>;

const isObject = (value: unknown): value is Fields =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const text = (value: unknown): string | null =>
  typeof value === "string" && value !== "" ? value : null;

// A reference is an id, or an object that was expanded and carries one.
const idOf = (value: unknown): string | null => (isObject(value) ? text(value.id) : text(value));

const seconds = (value: unknown): Date | null =>
  typeof value === "number" && Number.isFinite(value) ? new Date(value * 1000) : null;

const CHECKOUT_PAID = new Set(["paid", "no_payment_required"]);

// Subscription status -> plan and recorded status. past_due keeps Launch:
// Stripe's retries are the grace period and it moves to unpaid or canceled
// when they give up. `incomplete` (the first payment not yet made) is not a
// plan change at all.
const STATUS: Record<
  string,
  { plan: "free" | "paid"; billingStatus: PlanChange["billingStatus"] }
> = {
  active: { plan: "paid", billingStatus: "active" },
  trialing: { plan: "paid", billingStatus: "active" },
  past_due: { plan: "paid", billingStatus: "past_due" },
  unpaid: { plan: "free", billingStatus: "past_due" },
  canceled: { plan: "free", billingStatus: "canceled" },
  incomplete_expired: { plan: "free", billingStatus: "canceled" },
  // Paused is not cancelled: Stripe still holds it, so it is not a fresh start.
  paused: { plan: "free", billingStatus: "past_due" },
};

const SUBSCRIPTION_EVENTS = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

function fromCheckout(session: Fields, eventAt: Date): PlanChange | null {
  const siteId = text(session.client_reference_id);
  if (siteId === null || session.mode !== "subscription") return null;
  if (typeof session.payment_status !== "string" || !CHECKOUT_PAID.has(session.payment_status)) {
    return null;
  }
  return {
    match: { siteId },
    source: "checkout",
    plan: "paid",
    billingStatus: "active",
    customerId: idOf(session.customer),
    subscriptionId: idOf(session.subscription),
    paidUntil: null,
    billingInterval: null,
    trialEndsAt: null,
    eventAt,
  };
}

function fromSubscription(
  subscription: Fields,
  deleted: boolean,
  eventAt: Date,
): PlanChange | null {
  const subscriptionId = text(subscription.id);
  const status = typeof subscription.status === "string" ? STATUS[subscription.status] : undefined;
  if (subscriptionId === null || status === undefined) return null;
  const customerId = idOf(subscription.customer);
  const siteId = isObject(subscription.metadata) ? text(subscription.metadata.site_id) : null;
  const items = isObject(subscription.items) ? subscription.items.data : undefined;
  const first = Array.isArray(items) && isObject(items[0]) ? items[0] : undefined;
  const periodEnds = (Array.isArray(items) ? items : [])
    .map((item) => (isObject(item) ? seconds(item.current_period_end) : null))
    .concat(seconds(subscription.current_period_end))
    .filter((date): date is Date => date !== null);
  const interval =
    first !== undefined && isObject(first.price) && isObject(first.price.recurring)
      ? first.price.recurring.interval
      : undefined;
  const trialing = subscription.status === "trialing";
  return {
    match: {
      subscriptionId,
      ...(customerId === null ? {} : { customerId }),
      ...(siteId === null ? {} : { siteId }),
    },
    source: "subscription",
    plan: deleted ? "free" : status.plan,
    // A subscription set to cancel at period end is Launch until then; it is
    // recorded as `canceled` so the plan page can say when it ends.
    billingStatus:
      deleted || (subscription.cancel_at_period_end === true && status.plan === "paid")
        ? "canceled"
        : status.billingStatus,
    customerId,
    subscriptionId,
    paidUntil: periodEnds.length === 0 ? null : new Date(Math.max(...periodEnds.map(Number))),
    billingInterval: interval === "month" || interval === "year" ? interval : null,
    trialEndsAt: trialing && !deleted ? seconds(subscription.trial_end) : null,
    eventAt,
  };
}

/**
 * The plan change a verified event asks for, or null when it asks for none
 * (an unhandled type, an unpaid or non-subscription checkout, a malformed
 * object, a subscription still `incomplete`).
 */
export function planChangeFor(event: StripeEventLike): PlanChange | null {
  const object = event.data.object;
  if (!isObject(object)) return null;
  const eventAt = new Date(event.created * 1000);
  if (event.type === "checkout.session.completed") return fromCheckout(object, eventAt);
  if (SUBSCRIPTION_EVENTS.has(event.type)) {
    return fromSubscription(object, event.type === "customer.subscription.deleted", eventAt);
  }
  return null;
}
