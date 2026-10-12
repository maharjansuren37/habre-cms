import { z } from "zod";
import {
  aiEnvFields,
  launchCredits,
  reportMissing,
  requireLaunchCreditsAtLeastFree,
  requireLocalPlatformForFake,
  toAiSettings,
} from "#app/lib/ai-env.server.ts";
import {
  billingEnvFields,
  requireBillingComplete,
  toBillingSettings,
} from "#app/lib/billing-env.server.ts";
import { databaseEnvSchema, parseEnv } from "#app/lib/database-env.server.ts";
import {
  emailEnvFields,
  requireEmailForSignup,
  requireEmailPair,
} from "#app/lib/email-env.server.ts";
import { hostsEnvFields } from "#app/lib/hosts-env.server.ts";
import {
  launchStorageBytes,
  limitsEnvFields,
  requireLaunchStorageAtLeastFree,
} from "#app/lib/limits-env.server.ts";

// Everything the web app reads. server/app.ts imports this, so the production
// server refuses to start with a missing or invalid variable. Later items add
// theirs here and to .env.example.
const envSchema = databaseEnvSchema
  .extend({
    // The platform and sites origins (item 16a), rules in hosts-env.server.ts.
    ...hostsEnvFields,
    JWT_SECRET: z.string().min(32, { message: "JWT_SECRET must be at least 32 characters" }),
    // R2 (item 5a): the account and bucket the app writes uploads to, and the
    // public URL images are served from - never derived from the others, since
    // a bucket can be public through a custom domain or the r2.dev address.
    R2_ACCOUNT_ID: z.string().min(1),
    R2_ACCESS_KEY_ID: z.string().min(1),
    R2_SECRET_ACCESS_KEY: z.string().min(1),
    R2_BUCKET: z.string().min(1),
    R2_PUBLIC_URL: z.url({ protocol: /^https?$/ }),
    // Signup and email (item 15b): the switch and the SMTP settings. The rule
    // that signup needs email is in email-env.server.ts.
    ...emailEnvFields,
    // The storage limit (item 15d), parsed to bytes or null. Renamed below.
    ...limitsEnvFields,
    // AI (item 18b1): validated here, replaced by env.AI below.
    ...aiEnvFields,
    // Billing (item 21b): validated here, replaced by env.BILLING below.
    ...billingEnvFields,
  })
  .superRefine(requireLaunchStorageAtLeastFree)
  .superRefine(requireLaunchCreditsAtLeastFree)
  .superRefine(requireEmailForSignup)
  .superRefine(requireEmailPair)
  .superRefine(requireBillingComplete)
  .superRefine((fields, context) =>
    requireLocalPlatformForFake(fields, fields.PLATFORM_URL, context),
  )
  // The app reads env.PLAN_LIMITS (bytes or null per plan) and
  // env.AI: null when AI is off, else the parsed settings, and
  // env.BILLING: null when billing is off, else the Stripe settings.
  .transform(
    (
      {
        STORAGE_LIMIT_MB,
        LAUNCH_STORAGE_LIMIT_MB,
        LAUNCH_AI_CREDITS_PER_MONTH,
        AI_PROVIDERS,
        OPENROUTER_API_KEY,
        OPENROUTER_MODEL,
        ANTHROPIC_API_KEY,
        ANTHROPIC_MODEL,
        ANTHROPIC_PRICE,
        OPENAI_API_KEY,
        OPENAI_MODEL,
        OPENAI_PRICE,
        AI_CREDITS_PER_MONTH,
        STRIPE_SECRET_KEY,
        STRIPE_WEBHOOK_SECRET,
        STRIPE_PRICE_MONTHLY,
        STRIPE_PRICE_YEARLY,
        BILLING_TRIAL_DAYS,
        ...rest
      },
      context,
    ) => ({
      ...rest,
      // Each plan's numbers, for limitsFor (item 21a); null is no limit.
      PLAN_LIMITS: {
        free: { storageBytes: STORAGE_LIMIT_MB, aiCredits: AI_CREDITS_PER_MONTH },
        launch: {
          storageBytes: launchStorageBytes({ STORAGE_LIMIT_MB, LAUNCH_STORAGE_LIMIT_MB }),
          aiCredits: launchCredits({ AI_CREDITS_PER_MONTH, LAUNCH_AI_CREDITS_PER_MONTH }),
        },
      },
      BILLING: toBillingSettings({
        STRIPE_SECRET_KEY,
        STRIPE_WEBHOOK_SECRET,
        STRIPE_PRICE_MONTHLY,
        STRIPE_PRICE_YEARLY,
        BILLING_TRIAL_DAYS,
      }),
      AI: toAiSettings(
        {
          AI_PROVIDERS,
          OPENROUTER_API_KEY,
          OPENROUTER_MODEL,
          ANTHROPIC_API_KEY,
          ANTHROPIC_MODEL,
          ANTHROPIC_PRICE,
          OPENAI_API_KEY,
          OPENAI_MODEL,
          OPENAI_PRICE,
          AI_CREDITS_PER_MONTH,
        },
        reportMissing(context),
      ),
    }),
  );

export const env = parseEnv(envSchema, process.env);
