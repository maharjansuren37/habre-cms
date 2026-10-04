import { createRateLimiter } from "../auth/rate-limiter.ts";

const ONE_HOUR = 60 * 60 * 1000;

// Per IP: 10 signup attempts an hour. Every attempt that reaches validation is
// counted, valid or not, so a script cannot probe addresses and codes for free.
export const ipSignupLimiter = createRateLimiter({
  limit: 10,
  windowMs: ONE_HOUR,
  maxKeys: 10_000,
});
