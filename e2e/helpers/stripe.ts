import { createHmac, randomUUID } from "node:crypto";
import { withDatabase } from "./users.ts";

// The values playwright.config.ts gives the primary test server, so a test can
// sign what that server verifies (item 21b). Not real: no test reaches Stripe.
export const STRIPE_E2E_WEBHOOK_SECRET = "whsec_e2e_0123456789abcdef0123456789abcdef";
export const STRIPE_E2E_KEY = "sk_test_e2e_not_a_real_key";
export const STRIPE_E2E_PRICE_MONTHLY = "price_e2e_monthly";
export const STRIPE_E2E_PRICE_YEARLY = "price_e2e_yearly";

/** Stripe's signature header for `payload`: `t=<seconds>,v1=<hmac of "t.payload">`. */
export function stripeSignature(
  payload: string,
  secret = STRIPE_E2E_WEBHOOK_SECRET,
  timestamp = Math.floor(Date.now() / 1000),
): string {
  const digest = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  return `t=${timestamp},v1=${digest}`;
}

export type FakeEvent = { id: string; type: string; created: number; payload: string };

export function stripeEvent(
  type: string,
  object: Record<string, unknown>,
  created = Math.floor(Date.now() / 1000),
  id = `evt_e2e_${randomUUID()}`,
): FakeEvent {
  const payload = JSON.stringify({
    id,
    object: "event",
    api_version: "2025-01-01",
    created,
    type,
    data: { object },
  });
  return { id, type, created, payload };
}

/** A subscription object as Stripe sends one, carrying the site id as Checkout sets it. */
export function stripeSubscription(
  siteId: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: "sub_e2e_1",
    object: "subscription",
    customer: "cus_e2e_1",
    status: "active",
    cancel_at_period_end: false,
    trial_end: null,
    metadata: { site_id: siteId },
    items: {
      data: [
        {
          current_period_end: Math.floor(Date.now() / 1000) + 30 * 86_400,
          price: { recurring: { interval: "month" } },
        },
      ],
    },
    ...overrides,
  };
}

export type BillingRow = {
  plan: string;
  billing_status: string | null;
  billing_customer_id: string | null;
  billing_subscription_id: string | null;
  billing_interval: string | null;
  paid_until: Date | null;
  trial_ends_at: Date | null;
  billing_event_at: Date | null;
};

export function billingRow(siteId: string): Promise<BillingRow> {
  return withDatabase(async (sql) => {
    const [row] = await sql<BillingRow[]>`
      select plan, billing_status, billing_customer_id, billing_subscription_id,
             billing_interval, paid_until, trial_ends_at, billing_event_at
      from sites where id = ${siteId}`;
    if (!row) throw new Error(`no site ${siteId}`);
    return row;
  });
}

export function storedEventCount(eventIds: string[]): Promise<number> {
  return withDatabase(async (sql) => {
    const [row] = await sql<{ n: string }[]>`
      select count(*) as n from stripe_events where id in ${sql(eventIds)}`;
    return Number(row?.n ?? 0);
  });
}

export function deleteStoredEvents(eventIds: string[]): Promise<void> {
  if (eventIds.length === 0) return Promise.resolve();
  return withDatabase(async (sql) => {
    await sql`delete from stripe_events where id in ${sql(eventIds)}`;
  });
}
