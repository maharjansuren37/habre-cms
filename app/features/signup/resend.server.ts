import { sql } from "#app/lib/db.server.ts";
import { issueEmailToken } from "./email-tokens.server.ts";
import { VERIFY_LIFETIME_HOURS } from "./verification-email.ts";

/**
 * Issues a fresh verify link for an existing, unconfirmed user and uses up
 * their earlier unused ones, so only the newest link works. Returns null for
 * an address with no account or a confirmed one; the caller answers the same
 * either way. The email is sent by the caller after this commits.
 */
export async function reissueVerifyToken(
  email: string,
): Promise<{ userId: string; name: string; token: string } | null> {
  return sql.begin(async (tx) => {
    // `for update` so two resends at once cannot both leave a live token.
    const [user] = await tx<{ id: string; name: string }[]>`
      select id, name from users
      where email = ${email} and email_verified_at is null
      for update
    `;
    if (!user) return null;
    await tx`
      update email_tokens set used_at = now()
      where user_id = ${user.id} and purpose = 'verify' and used_at is null
    `;
    const token = await issueEmailToken(
      tx,
      user.id,
      "verify",
      VERIFY_LIFETIME_HOURS * 60 * 60 * 1000,
    );
    return { userId: user.id, name: user.name, token };
  });
}
