import assert from "node:assert/strict";
import { test } from "node:test";
import { planChangeFor, type StripeEventLike } from "./billing-events.ts";

const CREATED = 1_790_000_000;
const PERIOD_END = 1_792_600_000;
const TRIAL_END = 1_791_000_000;

const event = (type: string, object: unknown, created = CREATED): StripeEventLike => ({
  id: "evt_1",
  type,
  created,
  data: { object },
});

const subscription = (overrides: Record<string, unknown> = {}) => ({
  id: "sub_1",
  customer: "cus_1",
  status: "active",
  cancel_at_period_end: false,
  trial_end: null,
  items: {
    data: [{ current_period_end: PERIOD_END, price: { recurring: { interval: "year" } } }],
  },
  ...overrides,
});

const checkout = (overrides: Record<string, unknown> = {}) => ({
  id: "cs_1",
  mode: "subscription",
  payment_status: "paid",
  client_reference_id: "site-1",
  customer: "cus_1",
  subscription: "sub_1",
  ...overrides,
});

test("a paid subscription checkout makes the site Launch and names it by its site id", () => {
  const change = planChangeFor(event("checkout.session.completed", checkout()));
  assert.deepEqual(change, {
    match: { siteId: "site-1" },
    source: "checkout",
    plan: "paid",
    billingStatus: "active",
    customerId: "cus_1",
    subscriptionId: "sub_1",
    paidUntil: null,
    billingInterval: null,
    trialEndsAt: null,
    eventAt: new Date(CREATED * 1000),
  });
});

test("a trial checkout, which has nothing to pay yet, is Launch too", () => {
  const change = planChangeFor(
    event("checkout.session.completed", checkout({ payment_status: "no_payment_required" })),
  );
  assert.equal(change?.plan, "paid");
});

test("an unpaid checkout, a payment-mode checkout and one without a site id are ignored", () => {
  assert.equal(
    planChangeFor(event("checkout.session.completed", checkout({ payment_status: "unpaid" }))),
    null,
  );
  assert.equal(
    planChangeFor(event("checkout.session.completed", checkout({ mode: "payment" }))),
    null,
  );
  assert.equal(
    planChangeFor(event("checkout.session.completed", checkout({ client_reference_id: null }))),
    null,
  );
});

test("an active subscription is Launch until its period ends, billed by its price interval", () => {
  const change = planChangeFor(event("customer.subscription.updated", subscription()));
  assert.equal(change?.plan, "paid");
  assert.equal(change?.billingStatus, "active");
  assert.equal(change?.billingInterval, "year");
  assert.deepEqual(change?.paidUntil, new Date(PERIOD_END * 1000));
  assert.deepEqual(change?.match, { subscriptionId: "sub_1", customerId: "cus_1" });
  assert.equal(change?.trialEndsAt, null);
});

test("a trialing subscription is Launch and carries its trial end", () => {
  const change = planChangeFor(
    event(
      "customer.subscription.created",
      subscription({ status: "trialing", trial_end: TRIAL_END }),
    ),
  );
  assert.equal(change?.plan, "paid");
  assert.equal(change?.billingStatus, "active");
  assert.deepEqual(change?.trialEndsAt, new Date(TRIAL_END * 1000));
});

test("a trial end left on an active subscription is not a trial", () => {
  const change = planChangeFor(
    event(
      "customer.subscription.updated",
      subscription({ status: "active", trial_end: TRIAL_END }),
    ),
  );
  assert.equal(change?.trialEndsAt, null);
});

test("past_due keeps Launch while Stripe retries, and unpaid drops to Free", () => {
  const pastDue = planChangeFor(
    event("customer.subscription.updated", subscription({ status: "past_due" })),
  );
  assert.equal(pastDue?.plan, "paid");
  assert.equal(pastDue?.billingStatus, "past_due");
  const unpaid = planChangeFor(
    event("customer.subscription.updated", subscription({ status: "unpaid" })),
  );
  assert.equal(unpaid?.plan, "free");
  assert.equal(unpaid?.billingStatus, "past_due");
});

test("canceled and incomplete_expired are Free and canceled", () => {
  for (const status of ["canceled", "incomplete_expired"]) {
    const change = planChangeFor(event("customer.subscription.updated", subscription({ status })));
    assert.equal(change?.plan, "free", status);
    assert.equal(change?.billingStatus, "canceled", status);
  }
});

test("a deleted event is Free and canceled whatever status it carries", () => {
  const change = planChangeFor(
    event("customer.subscription.deleted", subscription({ status: "active" })),
  );
  assert.equal(change?.plan, "free");
  assert.equal(change?.billingStatus, "canceled");
  assert.equal(change?.trialEndsAt, null);
});

test("a subscription set to cancel at period end stays Launch", () => {
  const change = planChangeFor(
    event("customer.subscription.updated", subscription({ cancel_at_period_end: true })),
  );
  assert.equal(change?.plan, "paid");
  assert.equal(change?.billingStatus, "canceled");
  assert.deepEqual(change?.paidUntil, new Date(PERIOD_END * 1000));
});

test("an incomplete subscription, an unhandled type and a malformed object are ignored", () => {
  assert.equal(
    planChangeFor(event("customer.subscription.created", subscription({ status: "incomplete" }))),
    null,
  );
  assert.equal(planChangeFor(event("invoice.paid", {})), null);
  assert.equal(planChangeFor(event("customer.subscription.updated", null)), null);
  assert.equal(planChangeFor(event("customer.subscription.updated", { id: "sub_1" })), null);
});

test("an expanded customer object gives its id", () => {
  const change = planChangeFor(
    event("customer.subscription.updated", subscription({ customer: { id: "cus_9" } })),
  );
  assert.equal(change?.customerId, "cus_9");
});

test("a subscription's metadata gives the site id, so it can match before its checkout", () => {
  const change = planChangeFor(
    event("customer.subscription.created", subscription({ metadata: { site_id: "site-1" } })),
  );
  assert.deepEqual(change?.match, {
    subscriptionId: "sub_1",
    customerId: "cus_1",
    siteId: "site-1",
  });
  assert.equal(change?.source, "subscription");
});

test("a paused subscription is Free but not cancelled, so it still counts as live", () => {
  const change = planChangeFor(
    event("customer.subscription.updated", subscription({ status: "paused" })),
  );
  assert.equal(change?.plan, "free");
  assert.equal(change?.billingStatus, "past_due");
});
