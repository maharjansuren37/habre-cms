import { createHash } from "node:crypto";
import { createRateLimiter } from "../auth/rate-limiter.ts";

const ONE_HOUR = 60 * 60 * 1000;

type Options = { now?: () => number };

/**
 * The two limits on "Send it again": 5 an hour per IP, and 3 an hour per email,
 * which protects one person's inbox (and the mail provider's daily cap) from
 * being targeted from many IPs. Held in memory; the email is hashed so even a
 * heap dump holds no address.
 */
export function createResendLimits({ now }: Options = {}) {
  const ip = createRateLimiter({ limit: 5, windowMs: ONE_HOUR, maxKeys: 10_000, now });
  const email = createRateLimiter({ limit: 3, windowMs: ONE_HOUR, maxKeys: 10_000, now });
  const emailKey = (address: string) => createHash("sha256").update(address).digest("hex");

  return {
    /**
     * Counts one resend request and says which limit, if any, refuses it. A
     * refused request is not counted again, so it cannot extend its own block.
     * `address` is the normalised email.
     */
    attempt(ipKey: string, address: string): "ip" | "email" | null {
      if (ip.isBlocked(ipKey)) return "ip";
      if (email.isBlocked(emailKey(address))) return "email";
      ip.recordFailure(ipKey);
      email.recordFailure(emailKey(address));
      return null;
    },
  };
}

export const resendLimits = createResendLimits();

// Reset requests count apart from "Send it again", with the same limits.
export const resetRequestLimits = createResendLimits();

// Email-change requests count apart from the others, with the same limits.
export const emailChangeLimits = createResendLimits();
