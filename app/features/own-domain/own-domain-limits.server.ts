import { createRateLimiter } from "../auth/rate-limiter.ts";

const ONE_HOUR = 60 * 60 * 1000;

/**
 * "Check now": 10 an hour per site. Held in memory, like the other limits. A
 * refused check is not counted again, so it cannot extend its own block.
 */
export function createCheckLimit({ now }: { now?: () => number } = {}) {
  const limiter = createRateLimiter({ limit: 10, windowMs: ONE_HOUR, maxKeys: 10_000, now });
  return {
    /** Counts one check and says whether it may run. */
    attempt(siteId: string): boolean {
      if (limiter.isBlocked(siteId)) return false;
      limiter.recordFailure(siteId);
      return true;
    },
  };
}

export const checkLimit = createCheckLimit();
