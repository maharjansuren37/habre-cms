import { z } from "zod";

// The signup switch and the email settings (item 15b). Kept apart from
// env.server.ts, which parses process.env when imported, so node --test can
// exercise these rules. env.server.ts spreads the fields and applies the rule.

// A blank variable (`SMTP_URL=` copied from .env.example) counts as unset.
const optional = <Schema extends z.ZodType>(schema: Schema) =>
  z.preprocess((value) => (value === "" ? undefined : value), schema);

// A plain smtp:// connection would carry sign-in links in clear, so it is
// accepted only to this machine (Mailpit in development and CI).
function isLoopbackHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "[::1]" || /^127(\.\d{1,3}){3}$/.test(hostname);
}

const smtpUrl = z.string().refine(
  (value) => {
    try {
      const url = new URL(value);
      if (url.protocol === "smtps:") return true;
      return url.protocol === "smtp:" && isLoopbackHost(url.hostname);
    } catch {
      return false;
    }
  },
  { message: "SMTP_URL must be smtps://, or smtp:// to a loopback host only" },
);

export const emailEnvFields = {
  // off: /signup is Not Found. invite: needs a code from `npm run create-invite`.
  SIGNUP_MODE: optional(z.enum(["off", "invite", "open"]).default("off")),
  SMTP_URL: optional(smtpUrl.optional()),
  // `Name <address>` or a bare address.
  EMAIL_FROM: optional(
    z
      .string()
      .regex(/^(?:[^<>]*<[^\s<>@]+@[^\s<>@]+>|[^\s<>@]+@[^\s<>@]+)$/, {
        message: "EMAIL_FROM must be an address or Name <address>",
      })
      .optional(),
  ),
};

// Turning signup on without email would let people sign up and never get the
// link, so it stops startup instead. The message names the variable only.
export function requireEmailForSignup(
  env: { SIGNUP_MODE: string; SMTP_URL?: string | undefined; EMAIL_FROM?: string | undefined },
  ctx: z.RefinementCtx,
): void {
  if (env.SIGNUP_MODE === "off") return;
  for (const name of ["SMTP_URL", "EMAIL_FROM"] as const) {
    if (env[name] === undefined) {
      ctx.addIssue({
        code: "custom",
        path: [name],
        message: `${name} is required when SIGNUP_MODE is ${env.SIGNUP_MODE}`,
      });
    }
  }
}

// One of the two alone is a half-configured setup (mail that cannot be sent, or
// a sender with nowhere to send), so it stops startup. Names the missing one.
export function requireEmailPair(
  env: { SMTP_URL?: string | undefined; EMAIL_FROM?: string | undefined },
  ctx: z.RefinementCtx,
): void {
  const hasUrl = env.SMTP_URL !== undefined;
  const hasFrom = env.EMAIL_FROM !== undefined;
  if (hasUrl === hasFrom) return;
  const missing = hasUrl ? "EMAIL_FROM" : "SMTP_URL";
  const present = hasUrl ? "SMTP_URL" : "EMAIL_FROM";
  ctx.addIssue({
    code: "custom",
    path: [missing],
    message: `${missing} is required when ${present} is set`,
  });
}

export const emailEnvSchema = z
  .object(emailEnvFields)
  .superRefine(requireEmailForSignup)
  .superRefine(requireEmailPair);

// Email is on only when both settings are present; password reset by email
// (item 15c) turns on and off with it.
export function isEmailOn(env: {
  SMTP_URL?: string | undefined;
  EMAIL_FROM?: string | undefined;
}): boolean {
  return Boolean(env.SMTP_URL) && Boolean(env.EMAIL_FROM);
}
