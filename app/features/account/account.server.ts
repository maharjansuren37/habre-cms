import {
  emailLoginLimiter,
  LOGIN_BLOCK_MINUTES,
  passwordCheckSlots,
} from "#app/features/auth/login-rate-limit.server.ts";
import { hashPassword, verifyPassword } from "#app/features/auth/password.server.ts";
import { sql } from "#app/lib/db.server.ts";
import { logSecurityEvent } from "#app/lib/security-log.server.ts";

/** Sets the signed-in person's own name. `userId` is the session's, never the form's. */
export async function changeName(userId: string, name: string): Promise<void> {
  await sql`update users set name = ${name}, updated_at = now() where id = ${userId}`;
}

/**
 * Changes the signed-in person's password after checking the current one, in
 * one transaction with the user's row locked. A wrong current password writes
 * nothing. `tokenVersion` is the new one, so the caller can sign this browser
 * in again while every other session stops matching.
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<{ ok: true; tokenVersion: number } | { ok: false }> {
  return sql.begin(async (tx) => {
    const [row] = await tx<{ passwordHash: string }[]>`
      select password_hash as "passwordHash" from users where id = ${userId} for update`;
    if (!row || !(await verifyPassword(currentPassword, row.passwordHash))) {
      return { ok: false } as const;
    }
    const newHash = await hashPassword(newPassword);
    const [updated] = await tx<{ tokenVersion: number }[]>`
      update users
      set password_hash = ${newHash}, token_version = token_version + 1, updated_at = now()
      where id = ${userId}
      returning token_version as "tokenVersion"`;
    return { ok: true, tokenVersion: updated.tokenVersion } as const;
  });
}

export const TOO_MANY_ATTEMPTS = `Too many attempts. Try again in ${LOGIN_BLOCK_MINUTES} minutes.`;
export const BUSY = "Busy, try again in a minute.";

export type PasswordGate<T> =
  | { status: "blocked" }
  | { status: "busy" }
  | { status: "wrong" }
  | { status: "ok"; value: T };

/**
 * Runs work that needs the current password, checked like a login and keyed by
 * the account's current email: the limiter, a slot, then the work, with the
 * attempt counted before it (F-08). `work` answers `{ ok: false }` for a wrong
 * password. A right one takes the attempt back but does not reset the counter;
 * an error checked no password, so it is not a failed attempt either.
 */
export async function withCurrentPassword<T>(
  user: { id: string; email: string },
  ip: string,
  work: () => Promise<{ ok: false } | { ok: true; value: T }>,
): Promise<PasswordGate<T>> {
  if (emailLoginLimiter.isBlocked(user.email)) return { status: "blocked" };
  if (!passwordCheckSlots.tryAcquire()) return { status: "busy" };
  emailLoginLimiter.recordFailure(user.email);
  let result: Awaited<ReturnType<typeof work>>;
  try {
    result = await work();
  } catch (error) {
    emailLoginLimiter.forgive(user.email);
    throw error;
  } finally {
    passwordCheckSlots.release();
  }
  if (!result.ok) {
    logSecurityEvent({ event: "account_password_refused", userId: user.id, ip });
    return { status: "wrong" };
  }
  emailLoginLimiter.forgive(user.email);
  return { status: "ok", value: result.value };
}

/** True when `password` is the person's current one. `userId` is the session's. */
export async function checkCurrentPassword(userId: string, password: string): Promise<boolean> {
  const [row] = await sql<{ passwordHash: string }[]>`
    select password_hash as "passwordHash" from users where id = ${userId}`;
  return row !== undefined && (await verifyPassword(password, row.passwordHash));
}

/**
 * Sets the signed-in person's email at once (email off). `email_verified_at`
 * stays as it was. An address another account uses is `taken`.
 */
export async function changeEmailNow(
  userId: string,
  newEmail: string,
): Promise<{ ok: true } | { ok: false; reason: "taken" }> {
  try {
    await sql`update users set email = ${newEmail}, updated_at = now() where id = ${userId}`;
    return { ok: true };
  } catch (error) {
    if (isUniqueViolation(error, "users_email_key")) return { ok: false, reason: "taken" };
    throw error;
  }
}

const UNIQUE_VIOLATION = "23505";

// The third copy (signup.server.ts, users.server.ts). Extracting it is its own
// change, not a passenger on this item (ai-interaction.md).
function isUniqueViolation(error: unknown, constraint: string): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    error.code === UNIQUE_VIOLATION &&
    "constraint_name" in error &&
    error.constraint_name === constraint
  );
}
