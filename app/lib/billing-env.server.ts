import { z } from "zod";

// The billing switch and our own billing settings (item 21b, D150, D160). Kept
// apart from env.server.ts, which parses process.env when imported, so node
// --test can exercise these rules. env.server.ts spreads the fields, applies
// the refinements and renames them to env.BILLING.

// A blank variable (`STRIPE_SECRET_KEY=` copied from .env.example) counts as unset.
const optional = <Schema extends z.ZodType>(schema: Schema) =>
  z.preprocess((value) => (value === "" ? undefined : value), schema);

// The message names the variable and the rule, never the value.
const prefixed = (variable: string, prefixes: string[]) =>
  z.string().refine((value) => prefixes.some((prefix) => value.startsWith(prefix)), {
    message: `${variable} must start with ${prefixes.join(" or ")}`,
  });

const TRIAL_DAYS_DEFAULT = 14;
const TRIAL_DAYS_MAX = 90;

export const billingEnvFields = {
  // Stripe's secret key; a restricted key (rk_) is what production should hold.
  STRIPE_SECRET_KEY: optional(prefixed("STRIPE_SECRET_KEY", ["sk_", "rk_"]).optional()),
  // The signing secret of the webhook endpoint in Stripe's dashboard.
  STRIPE_WEBHOOK_SECRET: optional(prefixed("STRIPE_WEBHOOK_SECRET", ["whsec_"]).optional()),
  // Launch's two recurring prices. Their amounts are read from Stripe, never
  // copied here.
  STRIPE_PRICE_MONTHLY: optional(prefixed("STRIPE_PRICE_MONTHLY", ["price_"]).optional()),
  STRIPE_PRICE_YEARLY: optional(prefixed("STRIPE_PRICE_YEARLY", ["price_"]).optional()),
  // Free-trial days for a site that has never had a subscription; 0 is none.
  BILLING_TRIAL_DAYS: optional(
    z
      .string()
      .regex(/^(?:0|[1-9][0-9]*)$/, {
        message: "BILLING_TRIAL_DAYS must be a whole number of days from 0 to 90",
      })
      .transform(Number)
      .refine((days) => days <= TRIAL_DAYS_MAX, {
        message: "BILLING_TRIAL_DAYS must be a whole number of days from 0 to 90",
      })
      .default(TRIAL_DAYS_DEFAULT),
  ),
};

type BillingFields = {
  STRIPE_SECRET_KEY?: string | undefined;
  STRIPE_WEBHOOK_SECRET?: string | undefined;
  STRIPE_PRICE_MONTHLY?: string | undefined;
  STRIPE_PRICE_YEARLY?: string | undefined;
  BILLING_TRIAL_DAYS: number;
};

const REQUIRED_TOGETHER = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_MONTHLY",
  "STRIPE_PRICE_YEARLY",
] as const;

// Billing is on with all four set and off with none. Some of them would let a
// site start Checkout the app could never finish, or take payments whose
// webhooks it would reject, so a partial set stops startup instead.
export function requireBillingComplete(fields: BillingFields, context: z.RefinementCtx): void {
  const set = REQUIRED_TOGETHER.filter((name) => fields[name] !== undefined);
  if (set.length === 0) return;
  for (const name of REQUIRED_TOGETHER) {
    if (fields[name] === undefined) {
      context.addIssue({
        code: "custom",
        path: [name],
        message: `${name} is required when ${set[0]} is set (billing needs all four)`,
      });
    }
  }
  if (
    fields.STRIPE_PRICE_MONTHLY !== undefined &&
    fields.STRIPE_PRICE_MONTHLY === fields.STRIPE_PRICE_YEARLY
  ) {
    context.addIssue({
      code: "custom",
      path: ["STRIPE_PRICE_YEARLY"],
      message: "STRIPE_PRICE_YEARLY must differ from STRIPE_PRICE_MONTHLY",
    });
  }
}

export type BillingSettings = {
  secretKey: string;
  webhookSecret: string;
  priceMonthly: string;
  priceYearly: string;
  trialDays: number;
};

// null is billing off. Only called on fields requireBillingComplete accepted.
export function toBillingSettings(fields: BillingFields): BillingSettings | null {
  const { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_MONTHLY, STRIPE_PRICE_YEARLY } =
    fields;
  if (
    STRIPE_SECRET_KEY === undefined ||
    STRIPE_WEBHOOK_SECRET === undefined ||
    STRIPE_PRICE_MONTHLY === undefined ||
    STRIPE_PRICE_YEARLY === undefined
  ) {
    return null;
  }
  return {
    secretKey: STRIPE_SECRET_KEY,
    webhookSecret: STRIPE_WEBHOOK_SECRET,
    priceMonthly: STRIPE_PRICE_MONTHLY,
    priceYearly: STRIPE_PRICE_YEARLY,
    trialDays: fields.BILLING_TRIAL_DAYS,
  };
}

export const billingEnvSchema = z.object(billingEnvFields).superRefine(requireBillingComplete);
