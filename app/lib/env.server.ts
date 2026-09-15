import { z } from "zod";
import { databaseEnvSchema, parseEnv } from "#app/lib/database-env.server.ts";

// Everything the web app reads. server/app.ts imports this, so the production
// server refuses to start with a missing or invalid variable. Later items add
// theirs here and to .env.example.
const envSchema = databaseEnvSchema.extend({
  // The public origin: checked against the Origin of state-changing requests,
  // and https here is what makes the session cookie Secure.
  APP_URL: z.url({ protocol: /^https?$/ }),
  JWT_SECRET: z.string().min(32, { message: "JWT_SECRET must be at least 32 characters" }),
});

export const env = parseEnv(envSchema, process.env);
