import Stripe from "stripe";
import { env } from "#app/lib/env.server.ts";
import { type Billing, createBilling } from "./billing.server.ts";

// The one Stripe client and the billing module over it, or null when billing is
// off (item 21b). The SDK pins its own API version, so a release never changes
// what Stripe sends back under it. Calls happen on an admin's click or page
// view and on a signed webhook only.
export const stripe: Stripe | null =
  env.BILLING === null
    ? null
    : new Stripe(env.BILLING.secretKey, { maxNetworkRetries: 2, timeout: 10_000 });

export const billing: Billing | null =
  stripe === null || env.BILLING === null
    ? null
    : createBilling(stripe, env.BILLING, { platformUrl: env.PLATFORM_URL });
