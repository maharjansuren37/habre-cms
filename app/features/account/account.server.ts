import { hashPassword, verifyPassword } from "#app/features/auth/password.server.ts";
import { sql } from "#app/lib/db.server.ts";

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
