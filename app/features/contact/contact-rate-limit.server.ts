import { rateLimitKeyForIp } from "../auth/client-ip.ts";
import { createRateLimiter } from "../auth/rate-limiter.ts";

const ONE_HOUR = 60 * 60 * 1000;

/**
 * The two limits on /_contact: 5 attempts an hour per IP per site, and 100 an
 * hour per site, so a botnet cannot fill one site's Messages. Every attempt is
 * counted, valid or not. A refused attempt is not counted again. Held in
 * memory, like the other limiters.
 */
export function createContactLimits({ now }: { now?: () => number } = {}) {
  const ip = createRateLimiter({ limit: 5, windowMs: ONE_HOUR, maxKeys: 10_000, now });
  const site = createRateLimiter({ limit: 100, windowMs: ONE_HOUR, maxKeys: 10_000, now });

  return {
    /** Counts one attempt and says which limit, if any, refuses it. */
    attempt(siteId: string, clientIp: string): "ip" | "site" | null {
      const ipKey = `${siteId}:${rateLimitKeyForIp(clientIp)}`;
      if (ip.isBlocked(ipKey)) return "ip";
      if (site.isBlocked(siteId)) return "site";
      ip.recordFailure(ipKey);
      site.recordFailure(siteId);
      return null;
    },
  };
}

export const contactLimits = createContactLimits();
