import assert from "node:assert/strict";
import { test } from "node:test";
import { type BillingFacts, formatPlanDate, formatPrice, planNotice } from "./plan-view.ts";

const facts = (overrides: Partial<BillingFacts> = {}): BillingFacts => ({
  plan: "free",
  billingStatus: null,
  customerId: null,
  subscriptionId: null,
  paidUntil: null,
  interval: null,
  trialEndsAt: null,
  ...overrides,
});

const DATE = new Date("2026-11-03T10:00:00Z");

test("a Free site that never subscribed has no notice", () => {
  assert.equal(planNotice(facts(), { checkoutDone: false }), null);
});

test("after checkout, a site still on Free is told the payment is being processed", () => {
  assert.deepEqual(planNotice(facts(), { checkoutDone: true }), {
    tone: "success",
    title: "Payment received.",
    body: "Your plan updates in a moment. Reload this page to see it.",
  });
});

test("after checkout, a site already on Launch has no processing notice", () => {
  const notice = planNotice(facts({ plan: "paid", billingStatus: "active", interval: "year" }), {
    checkoutDone: true,
  });
  assert.equal(notice, null);
});

test("a trialing site sees when the trial ends and how it will be billed", () => {
  const notice = planNotice(
    facts({ plan: "paid", billingStatus: "active", trialEndsAt: DATE, interval: "year" }),
    { checkoutDone: false },
  );
  assert.deepEqual(notice, {
    tone: "notice",
    title: "Free trial until 3 November 2026.",
    body: "Then billed yearly. Cancel any time before then in Manage billing.",
  });
});

test("a past_due site is told to update its card and keeps Launch", () => {
  const notice = planNotice(facts({ plan: "paid", billingStatus: "past_due" }), {
    checkoutDone: false,
  });
  assert.equal(notice?.tone, "error");
  assert.equal(notice?.title, "Your last payment didn't go through.");
  assert.match(notice?.body ?? "", /Update your card in Manage billing to keep Launch\./);
});

test("a cancelling Launch site sees when it ends", () => {
  const notice = planNotice(facts({ plan: "paid", billingStatus: "canceled", paidUntil: DATE }), {
    checkoutDone: false,
  });
  assert.deepEqual(notice, {
    tone: "notice",
    title: "Launch until 3 November 2026.",
    body: "Your subscription is cancelled and will not renew. Your pages stay as they are.",
  });
});

test("a Free site whose subscription ended says so, and says why after a failed payment", () => {
  assert.equal(
    planNotice(facts({ billingStatus: "canceled", customerId: "cus_1" }), { checkoutDone: false })
      ?.title,
    "Your Launch subscription has ended.",
  );
  assert.equal(
    planNotice(facts({ billingStatus: "past_due", customerId: "cus_1" }), { checkoutDone: false })
      ?.title,
    "Your subscription ended after a failed payment.",
  );
});

test("dates are written out in full, in UTC", () => {
  assert.equal(formatPlanDate(new Date("2026-12-31T23:30:00Z")), "31 December 2026");
});

test("prices use the currency's own decimals", () => {
  assert.equal(formatPrice(1900, "usd"), "$19.00");
  assert.equal(formatPrice(1900, "aud"), "A$19.00");
  assert.equal(formatPrice(2000, "jpy"), "¥2,000");
});
