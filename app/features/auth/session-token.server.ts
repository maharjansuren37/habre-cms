import { errors, jwtVerify, SignJWT } from "jose";
import { z } from "zod";
import type { SessionClaims } from "./session-check.ts";

// A fixed week from login; the session is not extended while in use.
export const SESSION_LIFETIME_SECONDS = 7 * 24 * 60 * 60;

const ALGORITHM = "HS256";
const ISSUER = "habre-cms";

// Checked after the signature: `sub` goes into a uuid query, so anything
// else must never reach the database.
const payloadSchema = z.object({
  sub: z.uuid(),
  tv: z.int().nonnegative(),
});

/** Signs a session token. The role is deliberately not in it (D6). */
export async function signSessionToken(
  { userId, tokenVersion }: SessionClaims,
  secret: string,
  now = new Date(),
): Promise<string> {
  const issuedAt = Math.floor(now.getTime() / 1000);
  return new SignJWT({ tv: tokenVersion })
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + SESSION_LIFETIME_SECONDS)
    .sign(encodeSecret(secret));
}

/** Returns the claims of a valid, unexpired token, or null for any invalid one. */
export async function verifySessionToken(
  token: string,
  secret: string,
  now = new Date(),
): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, encodeSecret(secret), {
      algorithms: [ALGORITHM],
      issuer: ISSUER,
      requiredClaims: ["sub", "iat", "exp"],
      currentDate: now,
    });
    const claims = payloadSchema.safeParse(payload);
    return claims.success ? { userId: claims.data.sub, tokenVersion: claims.data.tv } : null;
  } catch (error) {
    // A bad, expired or forged token is an expected outcome, not a failure.
    if (error instanceof errors.JOSEError) return null;
    throw error;
  }
}

function encodeSecret(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}
