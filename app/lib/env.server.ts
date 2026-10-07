import { z } from "zod";
import { aiEnvFields, toAiSettings } from "#app/lib/ai-env.server.ts";
import { databaseEnvSchema, parseEnv } from "#app/lib/database-env.server.ts";
import {
  emailEnvFields,
  requireEmailForSignup,
  requireEmailPair,
} from "#app/lib/email-env.server.ts";
import { hostsEnvFields } from "#app/lib/hosts-env.server.ts";
import { limitsEnvFields } from "#app/lib/limits-env.server.ts";

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
  })
  .superRefine(requireEmailForSignup)
  .superRefine(requireEmailPair)
  // The app reads env.STORAGE_LIMIT_BYTES: bytes, or null for no limit. And
  // env.AI: null when AI is off, else the parsed settings.
  .transform(
    ({
      STORAGE_LIMIT_MB,
      AI_PROVIDERS,
      OPENROUTER_API_KEY,
      OPENROUTER_MODEL,
      AI_CREDITS_PER_MONTH,
      ...rest
    }) => ({
      ...rest,
      STORAGE_LIMIT_BYTES: STORAGE_LIMIT_MB,
      AI: toAiSettings({
        AI_PROVIDERS,
        OPENROUTER_API_KEY,
        OPENROUTER_MODEL,
        AI_CREDITS_PER_MONTH,
      }),
    }),
  );

export const env = parseEnv(envSchema, process.env);
