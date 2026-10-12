import type { BillingSettings } from "#app/lib/billing-env.server.ts";
import type { PriceInfo } from "./billing-view.ts";

// Stripe behind one module (D149, D160, item 21b): the app asks for a
// Checkout or a Portal address and for the two prices, and never sees a card.
// The client is passed in, so a test hands it a fake and the SDK is imported
// only by stripe.server.ts. Calls happen on an admin's click or page view.

export type Interval = "monthly" | "yearly";

// The slice of the SDK this module uses; the real client satisfies it.
export type StripeClient = {
  checkout: {
    sessions: { create(params: Record<string, unknown>): Promise<{ url: string | null }> };
  };
  billingPortal: {
    sessions: { create(params: Record<string, unknown>): Promise<{ url: string }> };
  };
  prices: {
    retrieve(
      id: string,
      params: { expand?: string[] },
      options: { timeout: number; maxNetworkRetries: number },
    ): Promise<{
      unit_amount: number | null;
      currency: string;
      recurring: { interval: string } | null;
    }>;
  };
};

export type UrlResult =
  | { ok: true; url: string }
  | {
      ok: false;
      reason: "unavailable" | "already_paid" | "has_subscription" | "invalid" | "no_customer";
    };

export type CheckoutInput = {
  siteId: string;
  email: string;
  customerId: string | null;
  plan: "free" | "paid";
  /** A Free site Stripe still holds a subscription for (canStartCheckout). */
  hasLiveSubscription: boolean;
  interval: Interval;
  trialEligible: boolean;
};

export type Prices = { monthly: PriceInfo; yearly: PriceInfo };

const PRICE_CACHE_MS = 10 * 60 * 1000;
// A failed read is remembered briefly, so an outage costs one short wait a
// minute and not one per page view. The read is bounded: the plan page waits.
const PRICE_FAILURE_MS = 60 * 1000;
const PRICE_READ = { timeout: 3000, maxNetworkRetries: 0 };

// The error's class, never its message: Stripe's text can echo request data.
function logStripeFailure(action: string, error: unknown): void {
  const type =
    typeof error === "object" && error !== null && "type" in error
      ? String((error as { type: unknown }).type)
      : error instanceof Error
        ? error.name
        : "unknown";
  console.error(JSON.stringify({ event: "stripe_call_failed", action, type }));
}

export function createBilling(
  client: StripeClient,
  settings: BillingSettings,
  options: { platformUrl: string; now?: () => number },
) {
  const planUrl = new URL("/admin/plan", options.platformUrl).toString();
  const now = options.now ?? Date.now;
  let cached: { prices: Prices | null; at: number } | null = null;

  return {
    async startCheckout(input: CheckoutInput): Promise<UrlResult> {
      if (input.plan === "paid") return { ok: false, reason: "already_paid" };
      if (input.hasLiveSubscription) return { ok: false, reason: "has_subscription" };
      if (input.interval !== "monthly" && input.interval !== "yearly") {
        return { ok: false, reason: "invalid" };
      }
      const price = input.interval === "yearly" ? settings.priceYearly : settings.priceMonthly;
      try {
        const session = await client.checkout.sessions.create({
          mode: "subscription",
          line_items: [{ price, quantity: 1 }],
          client_reference_id: input.siteId,
          // The subscription carries the site id too, so its own events find
          // the site before the checkout's event has stored the ids.
          subscription_data: {
            metadata: { site_id: input.siteId },
            ...(input.trialEligible && settings.trialDays > 0
              ? { trial_period_days: settings.trialDays }
              : {}),
          },
          ...(input.customerId === null
            ? { customer_email: input.email }
            : { customer: input.customerId }),
          success_url: `${planUrl}?checkout=done`,
          cancel_url: planUrl,
        });
        return session.url === null
          ? { ok: false, reason: "unavailable" }
          : { ok: true, url: session.url };
      } catch (error) {
        logStripeFailure("checkout", error);
        return { ok: false, reason: "unavailable" };
      }
    },

    async openPortal(input: { customerId: string | null }): Promise<UrlResult> {
      if (input.customerId === null) return { ok: false, reason: "no_customer" };
      try {
        const session = await client.billingPortal.sessions.create({
          customer: input.customerId,
          return_url: planUrl,
        });
        return { ok: true, url: session.url };
      } catch (error) {
        logStripeFailure("portal", error);
        return { ok: false, reason: "unavailable" };
      }
    },

    /** Both prices' amounts from Stripe, cached ten minutes; null (for a minute) when unreadable. */
    async prices(): Promise<Prices | null> {
      if (cached !== null) {
        const ttl = cached.prices === null ? PRICE_FAILURE_MS : PRICE_CACHE_MS;
        if (now() - cached.at < ttl) return cached.prices;
      }
      try {
        const [monthly, yearly] = await Promise.all([
          client.prices.retrieve(settings.priceMonthly, {}, PRICE_READ),
          client.prices.retrieve(settings.priceYearly, {}, PRICE_READ),
        ]);
        const read = (price: typeof monthly, interval: "month" | "year"): PriceInfo => {
          if (price.unit_amount === null || price.recurring?.interval !== interval) {
            throw new Error(`price is not a ${interval} price`);
          }
          return { amount: price.unit_amount, currency: price.currency, interval };
        };
        const prices = { monthly: read(monthly, "month"), yearly: read(yearly, "year") };
        cached = { prices, at: now() };
        return prices;
      } catch (error) {
        logStripeFailure("prices", error);
        cached = { prices: null, at: now() };
        return null;
      }
    },
  };
}

export type Billing = ReturnType<typeof createBilling>;
