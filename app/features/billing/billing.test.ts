import assert from "node:assert/strict";
import { test } from "node:test";
import { createBilling } from "./billing.server.ts";
import { canStartCheckout, savingPercent, trialEligible } from "./billing-view.ts";

const settings = {
  secretKey: "sk_test_x",
  webhookSecret: "whsec_x",
  priceMonthly: "price_month",
  priceYearly: "price_year",
  trialDays: 14,
};
const options = { platformUrl: "https://app.habre.test" };

type Call = { name: string; params: Record<string, unknown> };

function fakeClient(overrides: { fail?: boolean } = {}) {
  const calls: Call[] = [];
  const fail = () => {
    if (overrides.fail) {
      throw Object.assign(new Error("secret detail that must not be logged"), {
        type: "StripeConnectionError",
      });
    }
  };
  const client = {
    checkout: {
      sessions: {
        async create(params: Record<string, unknown>) {
          calls.push({ name: "checkout", params });
          fail();
          return { url: "https://checkout.stripe.test/c/1" };
        },
      },
    },
    billingPortal: {
      sessions: {
        async create(params: Record<string, unknown>) {
          calls.push({ name: "portal", params });
          fail();
          return { url: "https://billing.stripe.test/p/1" };
        },
      },
    },
    prices: {
      async retrieve(
        id: string,
        _params?: { expand?: string[] },
        _options?: { timeout: number; maxNetworkRetries: number },
      ) {
        calls.push({ name: "price", params: { id } });
        fail();
        return id === "price_month"
          ? { unit_amount: 1900, currency: "usd", recurring: { interval: "month" } }
          : { unit_amount: 19000, currency: "usd", recurring: { interval: "year" } };
      },
    },
  };
  return { client, calls };
}

const input = {
  siteId: "site-1",
  email: "admin@example.test",
  customerId: null,
  plan: "free" as const,
  hasLiveSubscription: false,
  interval: "monthly" as const,
  trialEligible: true,
};

test("a checkout carries the site id, the chosen price, the trial and both return URLs", async () => {
  const { client, calls } = fakeClient();
  const result = await createBilling(client, settings, options).startCheckout(input);

  assert.deepEqual(result, { ok: true, url: "https://checkout.stripe.test/c/1" });
  const params = calls[0]?.params as Record<string, unknown>;
  assert.equal(params.mode, "subscription");
  assert.deepEqual(params.line_items, [{ price: "price_month", quantity: 1 }]);
  assert.equal(params.client_reference_id, "site-1");
  assert.equal(params.customer_email, "admin@example.test");
  assert.equal(params.customer, undefined);
  assert.deepEqual(params.subscription_data, {
    metadata: { site_id: "site-1" },
    trial_period_days: 14,
  });
  assert.equal(params.success_url, "https://app.habre.test/admin/plan?checkout=done");
  assert.equal(params.cancel_url, "https://app.habre.test/admin/plan");
});

test("yearly uses the yearly price", async () => {
  const { client, calls } = fakeClient();
  await createBilling(client, settings, options).startCheckout({ ...input, interval: "yearly" });
  assert.deepEqual(calls[0]?.params.line_items, [{ price: "price_year", quantity: 1 }]);
});

test("an existing customer is reused and no email is sent", async () => {
  const { client, calls } = fakeClient();
  await createBilling(client, settings, options).startCheckout({ ...input, customerId: "cus_1" });
  const params = calls[0]?.params as Record<string, unknown>;
  assert.equal(params.customer, "cus_1");
  assert.equal(params.customer_email, undefined);
});

test("the trial is sent only when the site is eligible and the setting is above 0", async () => {
  const { client, calls } = fakeClient();
  const billing = createBilling(client, settings, options);
  await billing.startCheckout({ ...input, trialEligible: false });
  await createBilling(client, { ...settings, trialDays: 0 }, options).startCheckout(input);
  for (const call of calls) {
    assert.deepEqual((call.params as Record<string, unknown>).subscription_data, {
      metadata: { site_id: "site-1" },
    });
  }
});

test("a site that is already Launch is refused and Stripe is not called", async () => {
  const { client, calls } = fakeClient();
  const result = await createBilling(client, settings, options).startCheckout({
    ...input,
    plan: "paid",
  });
  assert.deepEqual(result, { ok: false, reason: "already_paid" });
  assert.equal(calls.length, 0);
});

test("an unknown interval is refused", async () => {
  const { client, calls } = fakeClient();
  const result = await createBilling(client, settings, options).startCheckout({
    ...input,
    interval: "weekly" as never,
  });
  assert.deepEqual(result, { ok: false, reason: "invalid" });
  assert.equal(calls.length, 0);
});

test("a Stripe failure is unavailable, with no url", async () => {
  const { client } = fakeClient({ fail: true });
  const billing = createBilling(client, settings, options);
  assert.deepEqual(await billing.startCheckout(input), { ok: false, reason: "unavailable" });
  assert.deepEqual(await billing.openPortal({ customerId: "cus_1" }), {
    ok: false,
    reason: "unavailable",
  });
});

test("the portal returns to the plan page, and needs a customer", async () => {
  const { client, calls } = fakeClient();
  const billing = createBilling(client, settings, options);
  assert.deepEqual(await billing.openPortal({ customerId: null }), {
    ok: false,
    reason: "no_customer",
  });
  assert.equal(calls.length, 0);
  assert.deepEqual(await billing.openPortal({ customerId: "cus_1" }), {
    ok: true,
    url: "https://billing.stripe.test/p/1",
  });
  assert.deepEqual(calls[0]?.params, {
    customer: "cus_1",
    return_url: "https://app.habre.test/admin/plan",
  });
});

test("prices are read once inside ten minutes, and again after", async () => {
  const { client, calls } = fakeClient();
  let now = 1_000_000;
  const billing = createBilling(client, settings, { ...options, now: () => now });

  const first = await billing.prices();
  await billing.prices();
  assert.equal(calls.filter((call) => call.name === "price").length, 2);
  assert.deepEqual(first, {
    monthly: { amount: 1900, currency: "usd", interval: "month" },
    yearly: { amount: 19000, currency: "usd", interval: "year" },
  });

  now += 10 * 60 * 1000 + 1;
  await billing.prices();
  assert.equal(calls.filter((call) => call.name === "price").length, 4);
});

test("prices that cannot be read are null, and tried again after a minute", async () => {
  const { client, calls } = fakeClient({ fail: true });
  let now = 1_000_000;
  const billing = createBilling(client, settings, { ...options, now: () => now });

  assert.equal(await billing.prices(), null);
  const first = calls.length;
  assert.equal(await billing.prices(), null);
  assert.equal(calls.length, first);

  now += 60 * 1000 + 1;
  await billing.prices();
  assert.ok(calls.length > first);
});

test("a price read is bounded in time and never retried", async () => {
  const seen: unknown[] = [];
  const { client } = fakeClient();
  const original = client.prices.retrieve;
  client.prices.retrieve = async (id: string, _params, readOptions) => {
    seen.push(readOptions);
    return original(id);
  };
  await createBilling(client, settings, options).prices();
  assert.deepEqual(seen, [
    { timeout: 3000, maxNetworkRetries: 0 },
    { timeout: 3000, maxNetworkRetries: 0 },
  ]);
});

test("the saving is the yearly price against twelve months, in whole percent", () => {
  const monthly = { amount: 1900, currency: "usd", interval: "month" as const };
  const yearly = { amount: 19000, currency: "usd", interval: "year" as const };
  assert.equal(savingPercent(monthly, yearly), 17);
  assert.equal(savingPercent(monthly, { ...yearly, amount: 22800 }), null);
  assert.equal(savingPercent(monthly, { ...yearly, amount: 30000 }), null);
  assert.equal(savingPercent(monthly, { ...yearly, currency: "aud" }), null);
});

test("a trial is for a site that has never had a subscription", () => {
  const never = { billingSubscriptionId: null, billingCustomerId: null };
  assert.equal(trialEligible(never, 14), true);
  assert.equal(trialEligible(never, 0), false);
  assert.equal(trialEligible({ ...never, billingSubscriptionId: "sub_1" }, 14), false);
  assert.equal(trialEligible({ ...never, billingCustomerId: "cus_1" }, 14), false);
});

test("only a Free site with no live subscription may start Checkout", () => {
  const free = { plan: "free" as const, subscriptionId: null, billingStatus: null };
  assert.equal(canStartCheckout(free), true);
  assert.equal(
    canStartCheckout({ ...free, subscriptionId: "sub_1", billingStatus: "canceled" }),
    true,
  );
  for (const billingStatus of ["past_due", "active", null] as const) {
    assert.equal(canStartCheckout({ ...free, subscriptionId: "sub_1", billingStatus }), false);
  }
  assert.equal(canStartCheckout({ ...free, plan: "paid" }), false);
});

test("a checkout for a site with a live subscription is refused and Stripe is not called", async () => {
  const { client, calls } = fakeClient();
  const result = await createBilling(client, settings, options).startCheckout({
    ...input,
    hasLiveSubscription: true,
  });
  assert.deepEqual(result, { ok: false, reason: "has_subscription" });
  assert.equal(calls.length, 0);
});
