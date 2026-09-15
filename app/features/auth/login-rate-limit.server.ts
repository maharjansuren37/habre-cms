import { createInFlightLimit } from "./in-flight-limit.ts";
import { createRateLimiter } from "./rate-limiter.ts";

export const LOGIN_BLOCK_MINUTES = 15;
const FIFTEEN_MINUTES = LOGIN_BLOCK_MINUTES * 60 * 1000;

// Per email: slows guessing one account's password. 5 failures can lock that
// account out for 15 minutes - accepted at ~10 users.
export const emailLoginLimiter = createRateLimiter({
  limit: 5,
  windowMs: FIFTEEN_MINUTES,
  maxKeys: 10_000,
});

// Per IP: slows one address trying many accounts.
export const ipLoginLimiter = createRateLimiter({
  limit: 20,
  windowMs: FIFTEEN_MINUTES,
  maxKeys: 10_000,
});

// scrypt runs on libuv's thread pool (4 threads by default), which also serves
// the static-file lookup on every public request. Two concurrent password checks
// leave threads free, so a burst of logins cannot stall the public site.
export const passwordCheckSlots = createInFlightLimit(2);
