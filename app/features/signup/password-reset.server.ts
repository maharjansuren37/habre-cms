import { sql } from "#app/lib/db.server.ts";
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
