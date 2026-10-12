import assert from "node:assert/strict";
import { test } from "node:test";
import { billingEnvSchema, toBillingSettings } from "./billing-env.server.ts";

// Not parseEnv: database-env.server.ts parses process.env when imported.
const parse = (source: NodeJS.ProcessEnv) => billingEnvSchema.parse(source);

const all = {
  STRIPE_SECRET_KEY: "sk_test_abc123",
  STRIPE_WEBHOOK_SECRET: "whsec_abc123",
  STRIPE_PRICE_MONTHLY: "price_month",
  STRIPE_PRICE_YEARLY: "price_year",
};

test("no billing variables is billing off, with the trial defaulting to 14 days", () => {
  const fields = parse({});
  assert.equal(toBillingSettings(fields), null);
  assert.equal(fields.BILLING_TRIAL_DAYS, 14);
});

test("blank billing variables count as unset", () => {
  const blank = Object.fromEntries(Object.keys(all).map((name) => [name, ""]));
  assert.equal(toBillingSettings(parse({ ...blank, BILLING_TRIAL_DAYS: "" })), null);
});

test("all four set is billing on, with the settings the app reads", () => {
  assert.deepEqual(toBillingSettings(parse({ ...all, BILLING_TRIAL_DAYS: "30" })), {
    secretKey: "sk_test_abc123",
    webhookSecret: "whsec_abc123",
    priceMonthly: "price_month",
    priceYearly: "price_year",
    trialDays: 30,
  });
});

test("a restricted key (rk_) is accepted", () => {
  assert.doesNotThrow(() => parse({ ...all, STRIPE_SECRET_KEY: "rk_live_abc" }));
});

for (const name of Object.keys(all)) {
  test(`${name} missing from a set of four throws naming it`, () => {
    const { [name]: _left, ...rest } = all as Record<string, string>;
    assert.throws(() => parse(rest), new RegExp(name));
  });
}

test("a malformed prefix names its variable and never prints the value", () => {
  assert.throws(
    () => parse({ ...all, STRIPE_WEBHOOK_SECRET: "secretvalue99" }),
    (error: Error) =>
      /STRIPE_WEBHOOK_SECRET/.test(error.message) && !error.message.includes("secretvalue99"),
  );
  assert.throws(() => parse({ ...all, STRIPE_SECRET_KEY: "pk_test_x" }), /STRIPE_SECRET_KEY/);
  assert.throws(() => parse({ ...all, STRIPE_PRICE_YEARLY: "prod_x" }), /STRIPE_PRICE_YEARLY/);
});

test("equal monthly and yearly prices are refused", () => {
  assert.throws(
    () => parse({ ...all, STRIPE_PRICE_YEARLY: all.STRIPE_PRICE_MONTHLY }),
    /STRIPE_PRICE_YEARLY/,
  );
});

test("the trial is a whole number of days from 0 to 90", () => {
  assert.equal(parse({ BILLING_TRIAL_DAYS: "0" }).BILLING_TRIAL_DAYS, 0);
  assert.equal(parse({ BILLING_TRIAL_DAYS: "90" }).BILLING_TRIAL_DAYS, 90);
  for (const value of ["-1", "1.5", "91", "abc"]) {
    assert.throws(() => parse({ BILLING_TRIAL_DAYS: value }), /BILLING_TRIAL_DAYS/, value);
  }
});
