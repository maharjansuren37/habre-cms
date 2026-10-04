import { z } from "zod";
import { databaseEnvSchema, parseEnv } from "#app/lib/database-env.server.ts";
import { emailEnvFields, requireEmailForSignup } from "#app/lib/email-env.server.ts";

// Everything the web app reads. server/app.ts imports this, so the production
// server refuses to start with a missing or invalid variable. Later items add
// theirs here and to .env.example.
const envSchema = databaseEnvSchema
  .extend({
    // The public site's origin (D22). Equal to ADMIN_URL in development and any
    // single-host test server, which is what makes the app redirect nothing.
    PUBLIC_URL: z.url({ protocol: /^https?$/ }),
    // The admin's origin: checked against the Origin of state-changing requests,
    // and https here is what makes the session cookie Secure.
    ADMIN_URL: z.url({ protocol: /^https?$/ }),
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
  })
  .superRefine(requireEmailForSignup);

export const env = parseEnv(envSchema, process.env);
