import type { Role } from "#app/features/users/roles.ts";
import type { UserWithMembership } from "#app/features/users/users.server.ts";

/** What a valid session token says: who, and at which `token_version`. */
export type SessionClaims = { userId: string; tokenVersion: number };

/** The logged-in user every admin loader and action reads from `userContext`. */
export type SessionUser = { id: string; email: string; name: string; role: Role; siteId: string };

export type SessionCheck =
  | { ok: true; user: SessionUser }
  | { ok: false; reason: "no_user" | "no_membership" | "deactivated" | "token_revoked" };

/**
 * Decides whether a verified token still grants access, against the user as
 * the database has them now (D6): a user without a membership, a deactivated
 * one, or a bumped `token_version` loses access at once. The role and site
 * come from the membership, never the token.
 */
export function checkSessionUser(
  claims: SessionClaims,
  user: UserWithMembership | null,
): SessionCheck {
  if (!user) return { ok: false, reason: "no_user" };
  const { membership } = user;
  if (!membership) return { ok: false, reason: "no_membership" };
  if (membership.deactivatedAt) return { ok: false, reason: "deactivated" };
  if (user.tokenVersion !== claims.tokenVersion) return { ok: false, reason: "token_revoked" };
  return {
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: membership.role,
      siteId: membership.siteId,
    },
  };
}
