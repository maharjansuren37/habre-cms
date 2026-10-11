import { createHmac, timingSafeEqual } from "node:crypto";

export type ContactTokenCheck = "ok" | "too_fast" | "stale" | "invalid";

const MIN_AGE_MS = 3000;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * The signed minimum-fill-time token: `<issued-ms>.<HMAC-SHA-256 of the
 * issued-ms string, base64url>`. Takes the secret so unit tests need no
 * environment; contact-token.server.ts binds it to JWT_SECRET.
 */
export function createContactTokens(secret: string) {
  const sign = (issued: string) => createHmac("sha256", secret).update(issued).digest("base64url");

  return {
    issueContactToken(now: number): string {
      const issued = String(Math.trunc(now));
      return `${issued}.${sign(issued)}`;
    },

    checkContactToken(token: string | null | undefined, now: number): ContactTokenCheck {
      if (typeof token !== "string") return "invalid";
      const parts = token.split(".");
      if (parts.length !== 2) return "invalid";
      const [issued, mac] = parts as [string, string];
      if (!/^\d{1,16}$/.test(issued)) return "invalid";

      const expected = Buffer.from(sign(issued));
      const given = Buffer.from(mac);
      if (given.length !== expected.length || !timingSafeEqual(given, expected)) return "invalid";

      const age = now - Number(issued);
      if (age < 0) return "invalid";
      if (age < MIN_AGE_MS) return "too_fast";
      if (age > MAX_AGE_MS) return "stale";
      return "ok";
    },
  };
}
