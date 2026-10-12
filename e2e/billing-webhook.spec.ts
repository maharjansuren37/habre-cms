import { expect, test } from "@playwright/test";
import { HOST_SPLIT_PORT, PORT } from "./helpers/ports.ts";
import { createSiteWithAddress, deleteSite, siteUrl } from "./helpers/sites.ts";
import {
  billingRow,
  deleteStoredEvents,
  type FakeEvent,
  STRIPE_E2E_WEBHOOK_SECRET,
  storedEventCount,
  stripeEvent,
  stripeSignature,
  stripeSubscription,
} from "./helpers/stripe.ts";
import { withDatabase } from "./helpers/users.ts";

// Item 21b, Steps 4-5: /webhooks/stripe applies a signed event once and
// nothing else sets a plan from a payment. Each test makes a site of its own
// (F-103). Events are signed with the secret playwright.config.ts gives the
// primary server; no test reaches Stripe.

const WEBHOOK = `http://127.0.0.1:${PORT}/webhooks/stripe`;

let siteId: string;
let address: string;
let sent: string[] = [];
let subscriptionId: string;
let customerId: string;

test.beforeEach(async () => {
  const site = await createSiteWithAddress("billing-hook");
  siteId = site.id;
  address = site.address;
  sent = [];
  const unique = Math.random().toString(36).slice(2, 10);
  subscriptionId = `sub_e2e_${unique}`;
  customerId = `cus_e2e_${unique}`;
});

test.afterEach(async () => {
  await deleteStoredEvents(sent);
  await deleteSite(siteId);
});

async function deliver(
  request: import("@playwright/test").APIRequestContext,
  event: FakeEvent,
  headers: Record<string, string> = { "Stripe-Signature": stripeSignature(event.payload) },
  url = WEBHOOK,
) {
  sent.push(event.id);
  return request.post(url, {
    data: Buffer.from(event.payload),
    headers: { "Content-Type": "application/json", ...headers },
  });
}

const subscription = (overrides: Record<string, unknown> = {}) =>
  stripeSubscription(siteId, { id: subscriptionId, customer: customerId, ...overrides });

const NOW = Math.floor(Date.now() / 1000);

test("a signed checkout makes the site Launch and stores the customer and subscription", async ({
  request,
}) => {
  const event = stripeEvent("checkout.session.completed", {
    id: "cs_e2e_1",
    mode: "subscription",
    payment_status: "paid",
    client_reference_id: siteId,
    customer: customerId,
    subscription: subscriptionId,
  });

  const response = await deliver(request, event);

  expect(response.status()).toBe(200);
  const row = await billingRow(siteId);
  expect(row.plan).toBe("paid");
  expect(row.billing_status).toBe("active");
  expect(row.billing_customer_id).toBe(customerId);
  expect(row.billing_subscription_id).toBe(subscriptionId);
});

test("the same event twice changes the site once and answers 200 both times", async ({
  request,
}) => {
  const event = stripeEvent("checkout.session.completed", {
    mode: "subscription",
    payment_status: "paid",
    client_reference_id: siteId,
    customer: customerId,
    subscription: subscriptionId,
  });
  expect((await deliver(request, event)).status()).toBe(200);
  await withDatabase((sql) => sql`update sites set plan = 'free' where id = ${siteId}`);

  const again = await deliver(request, event);

  expect(again.status()).toBe(200);
  expect((await again.json()).result).toBe("duplicate");
  expect((await billingRow(siteId)).plan).toBe("free");
  expect(await storedEventCount([event.id])).toBe(1);
});

test("an older event arriving after a newer one changes nothing", async ({ request }) => {
  const newer = stripeEvent(
    "customer.subscription.updated",
    subscription({ status: "active" }),
    NOW + 100,
  );
  const older = stripeEvent(
    "customer.subscription.updated",
    subscription({ status: "canceled" }),
    NOW,
  );
  await deliver(request, newer);

  const late = await deliver(request, older);

  expect(late.status()).toBe(200);
  expect((await late.json()).result).toBe("stale");
  const row = await billingRow(siteId);
  expect(row.plan).toBe("paid");
  expect(row.billing_status).toBe("active");
});

test("a deleted subscription drops the site to Free and leaves its content", async ({
  request,
}) => {
  await withDatabase(async (sql) => {
    await sql`
      insert into entries (site_id, type, title, slug, blocks, blocks_format, status)
      values (${siteId}, 'page', 'Kept', 'kept', '{"type":"doc","content":[]}'::jsonb, 'v4', 'draft')`;
  });
  await deliver(request, stripeEvent("customer.subscription.created", subscription(), NOW));

  const response = await deliver(
    request,
    stripeEvent("customer.subscription.deleted", subscription({ status: "canceled" }), NOW + 10),
  );

  expect(response.status()).toBe(200);
  const row = await billingRow(siteId);
  expect(row.plan).toBe("free");
  expect(row.billing_status).toBe("canceled");
  const entries = await withDatabase(
    (sql) => sql`select count(*)::int as n from entries where site_id = ${siteId}`,
  );
  expect(entries[0]?.n).toBe(1);
});

test("a trialing subscription is Launch with its trial end, and the active one clears it", async ({
  request,
}) => {
  const trialEnd = NOW + 14 * 86_400;
  await deliver(
    request,
    stripeEvent(
      "customer.subscription.created",
      subscription({ status: "trialing", trial_end: trialEnd }),
      NOW,
    ),
  );
  const trialing = await billingRow(siteId);
  expect(trialing.plan).toBe("paid");
  expect(trialing.trial_ends_at?.getTime()).toBe(trialEnd * 1000);

  await deliver(
    request,
    stripeEvent("customer.subscription.updated", subscription({ status: "active" }), NOW + 20),
  );

  const active = await billingRow(siteId);
  expect(active.plan).toBe("paid");
  expect(active.trial_ends_at).toBeNull();
});

test("past_due keeps Launch, and unpaid drops to Free", async ({ request }) => {
  await deliver(request, stripeEvent("customer.subscription.created", subscription(), NOW));

  await deliver(
    request,
    stripeEvent("customer.subscription.updated", subscription({ status: "past_due" }), NOW + 5),
  );
  const pastDue = await billingRow(siteId);
  expect(pastDue.plan).toBe("paid");
  expect(pastDue.billing_status).toBe("past_due");

  await deliver(
    request,
    stripeEvent("customer.subscription.updated", subscription({ status: "unpaid" }), NOW + 10),
  );
  expect((await billingRow(siteId)).plan).toBe("free");
});

test("an event that names no site is recorded and ignored", async ({ request }) => {
  const event = stripeEvent(
    "customer.subscription.updated",
    stripeSubscription("00000000-0000-4000-8000-000000000000", {
      id: "sub_nobody",
      customer: "cus_nobody",
    }),
  );
  const response = await deliver(request, event);
  expect(response.status()).toBe(200);
  expect((await response.json()).result).toBe("unknown_site");
});

test("a wrong secret, a missing header and a tampered body are 400 and change nothing", async ({
  request,
}) => {
  const event = stripeEvent("customer.subscription.created", subscription(), NOW);

  const wrongSecret = await deliver(request, event, {
    "Stripe-Signature": stripeSignature(event.payload, "whsec_not_the_secret"),
  });
  const missing = await deliver(request, event, {});
  const tampered = await deliver(
    request,
    { ...event, payload: event.payload.replace('"active"', '"trialing"') },
    { "Stripe-Signature": stripeSignature(event.payload) },
  );
  const stale = await deliver(request, event, {
    "Stripe-Signature": stripeSignature(
      event.payload,
      STRIPE_E2E_WEBHOOK_SECRET,
      Math.floor(Date.now() / 1000) - 3600,
    ),
  });

  expect([wrongSecret.status(), missing.status(), tampered.status(), stale.status()]).toEqual([
    400, 400, 400, 400,
  ]);
  expect((await billingRow(siteId)).plan).toBe("free");
  expect(await storedEventCount([event.id])).toBe(0);
});

test("a body past 512 KB is 413", async ({ request }) => {
  const big = stripeEvent("customer.subscription.created", {
    ...subscription(),
    padding: "x".repeat(513 * 1024),
  });
  const response = await deliver(request, big);
  expect(response.status()).toBe(413);
  expect(await storedEventCount([big.id])).toBe(0);
});

test("a GET is 405", async ({ request }) => {
  expect((await request.get(WEBHOOK)).status()).toBe(405);
});

test("a site's own host does not serve the webhook", async ({ request }) => {
  const event = stripeEvent("customer.subscription.created", subscription(), NOW);
  const response = await deliver(
    request,
    event,
    { "Stripe-Signature": stripeSignature(event.payload) },
    siteUrl("/webhooks/stripe", address),
  );
  expect(response.status()).toBe(404);
  expect((await billingRow(siteId)).plan).toBe("free");
});

test("with billing off the webhook is Not Found", async ({ request }) => {
  const event = stripeEvent("customer.subscription.created", subscription(), NOW);
  const response = await deliver(
    request,
    event,
    { "Stripe-Signature": stripeSignature(event.payload) },
    `http://127.0.0.1:${HOST_SPLIT_PORT}/webhooks/stripe`,
  );
  expect(response.status()).toBe(404);
});
