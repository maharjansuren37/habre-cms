type RateLimiterOptions = {
  /** Failures allowed in a window; the next attempt is blocked. */
  limit: number;
  windowMs: number;
  /** Most keys remembered at once, so a flood of new keys cannot exhaust memory. */
  maxKeys: number;
  now?: () => number;
};

export type RateLimiter = {
  isBlocked(key: string): boolean;
  recordFailure(key: string): void;
  /** Takes back one recorded failure, for an attempt counted up front that succeeded. */
  forgive(key: string): void;
  reset(key: string): void;
};

type Failures = { count: number; windowStart: number };

/**
 * Counts failures per key in a fixed window that starts at the first failure.
 * Held in memory: one process, and a restart forgetting the counts is accepted.
 */
export function createRateLimiter({
  limit,
  windowMs,
  maxKeys,
  now = Date.now,
}: RateLimiterOptions): RateLimiter {
  const failuresByKey = new Map<string, Failures>();
  const isExpired = (failures: Failures) => now() - failures.windowStart >= windowMs;

  function pruneExpired() {
    for (const [key, failures] of failuresByKey) {
      if (isExpired(failures)) failuresByKey.delete(key);
    }
  }

  return {
    isBlocked(key) {
      const failures = failuresByKey.get(key);
      return failures !== undefined && !isExpired(failures) && failures.count >= limit;
    },

    recordFailure(key) {
      pruneExpired();
      const failures = failuresByKey.get(key);
      if (failures) {
        failuresByKey.set(key, { ...failures, count: failures.count + 1 });
        return;
      }
      if (failuresByKey.size >= maxKeys) {
        // Maps keep insertion order: the first key is the oldest window.
        const oldestKey = failuresByKey.keys().next().value;
        if (oldestKey !== undefined) failuresByKey.delete(oldestKey);
      }
      failuresByKey.set(key, { count: 1, windowStart: now() });
    },

    forgive(key) {
      const failures = failuresByKey.get(key);
      if (!failures) return;
      if (failures.count <= 1) {
        failuresByKey.delete(key);
        return;
      }
      failuresByKey.set(key, { ...failures, count: failures.count - 1 });
    },

    reset(key) {
      failuresByKey.delete(key);
    },
  };
}
