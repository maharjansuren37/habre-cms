import { sql } from "#app/lib/db.server.ts";
import { hashEmailToken } from "./email-token-hash.ts";
import { issueEmailToken } from "./email-tokens.server.ts";
import { RESET_LIFETIME_HOURS } from "./reset-email.ts";

/**
 * Issues a reset link for a confirmed user who can still log in (an active
 * membership) and uses up their earlier unused ones, so only the newest link
 * works. Returns null for anyone else; the caller answers the same either way.
 * The email is sent by the caller after this commits.
 */
export async function issueResetToken(
  email: string,
): Promise<{ userId: string; name: string; token: string } | null> {
  return sql.begin(async (tx) => {
    // `for update` so two requests at once cannot both leave a live token.
    const [user] = await tx<{ id: string; name: string }[]>`
      select id, name from users
      where email = ${email}
        and email_verified_at is not null
        and exists (
          select 1 from site_members m
          where m.user_id = users.id and m.deactivated_at is null
        )
      for update
    `;
    if (!user) return null;
    await tx`
      update email_tokens set used_at = now()
      where user_id = ${user.id} and purpose = 'reset' and used_at is null
    `;
    const token = await issueEmailToken(
      tx,
      user.id,
      "reset",
      RESET_LIFETIME_HOURS * 60 * 60 * 1000,
    );
    return { userId: user.id, name: user.name, token };
  });
}

/** Read only: is there an unused, unexpired reset token with this hash? */
export async function isResetTokenLive(token: string): Promise<boolean> {
  const [row] = await sql<{ live: boolean }[]>`
    select true as live from email_tokens
    where token_hash = ${hashEmailToken(token)} and purpose = 'reset'
      and used_at is null and expires_at > now()
  `;
  return Boolean(row);
}

// Thrown inside the transaction to roll the token's use back.
class ResetRefused extends Error {}

/**
 * Uses the token, sets the new password and ends every other session, in one
 * transaction. The token update is the only place a token is used: its `where`
 * makes "once" and "within an hour" atomic. Returns null (and uses nothing up)
 * when the token is dead or the user can no longer log in. The email comes
 * back so the caller can lift the login lock on it.
 */
export async function completeReset(
  token: string,
  passwordHash: string,
): Promise<{ userId: string; email: string; tokenVersion: number } | null> {
  const tokenHash = hashEmailToken(token);
  try {
    return await sql.begin(async (tx) => {
      // The user's row is locked before any of their tokens, the same order
      // as issueResetToken, so a reset and a new request cannot deadlock (F-243).
      const [owner] = await tx<{ userId: string }[]>`
        select user_id as "userId" from email_tokens
        where token_hash = ${tokenHash} and purpose = 'reset'
      `;
      if (!owner) throw new ResetRefused();
      const [user] = await tx<{ email: string }[]>`
        select email from users
        where id = ${owner.userId}
          and email_verified_at is not null
          and exists (
            select 1 from site_members m
            where m.user_id = users.id and m.deactivated_at is null
          )
        for update
      `;
      if (!user) throw new ResetRefused();
      const [used] = await tx`
        update email_tokens set used_at = now()
        where token_hash = ${tokenHash} and purpose = 'reset'
          and used_at is null and expires_at > now()
        returning id
      `;
      if (!used) throw new ResetRefused();
      const [updated] = await tx<{ tokenVersion: number }[]>`
        update users
        set password_hash = ${passwordHash}, token_version = token_version + 1, updated_at = now()
        where id = ${owner.userId}
        returning token_version as "tokenVersion"
      `;
      await tx`
        update email_tokens set used_at = now()
        where user_id = ${owner.userId} and purpose = 'reset' and used_at is null
      `;
      return { userId: owner.userId, email: user.email, tokenVersion: updated.tokenVersion };
    });
  } catch (error) {
    if (error instanceof ResetRefused) return null;
    throw error;
  }
}
