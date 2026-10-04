import type { TransactionSql } from "postgres";
import { sql } from "#app/lib/db.server.ts";
import type { Role } from "./roles.ts";

/** Who the person is, on every site. Role and deactivation are the membership's. */
export type User = {
  id: string;
  email: string;
  name: string;
  tokenVersion: number;
};

/** A user's place on one site (v1: one site per user, D159). */
export type Membership = { siteId: string; role: Role; deactivatedAt: Date | null };

/** A user and their membership, or `null` when they belong to no site. */
export type UserWithMembership = User & { membership: Membership | null };

export type UserWithPasswordHash = UserWithMembership & {
  passwordHash: string;
  /** Null until the person has confirmed their email (item 15b). */
  emailVerifiedAt: Date | null;
};

/** A user who has a membership: what the Users screens list and edit. */
export type Member = User & Membership;

type NewUser = {
  email: string;
  name: string;
  passwordHash: string;
  role: Role;
  /** The creating admin's site: the new user becomes a member of it. */
  siteId: string;
};

export type CreateUserResult = { ok: true; user: Member } | { ok: false; reason: "email_taken" };

// Every query returns the same shape. The password hash is left out unless a
// query adds it deliberately.
const userColumns = sql`
  u.id, u.email, u.name,
  u.token_version as "tokenVersion"
`;

const memberColumns = sql`
  ${userColumns},
  m.site_id as "siteId", m.role, m.deactivated_at as "deactivatedAt"
`;

type UserRow = User & {
  siteId: string | null;
  role: Role | null;
  deactivatedAt: Date | null;
};

type MembershipColumns = Pick<UserRow, "siteId" | "role" | "deactivatedAt">;

// A left join gives all-null membership columns for a user with no membership;
// this turns them into `null`, so no half-filled membership is representable.
function withMembership<T extends User & MembershipColumns>({
  siteId,
  role,
  deactivatedAt,
  ...rest
}: T): Omit<T, keyof MembershipColumns> & { membership: Membership | null } {
  const membership = siteId && role ? { siteId, role, deactivatedAt } : null;
  return { ...rest, membership };
}

const UNIQUE_VIOLATION = "23505";

/** Inserts a user and their membership in one transaction. Expects a normalised email (see `emailSchema`). */
export async function createUser({
  email,
  name,
  passwordHash,
  role,
  siteId,
}: NewUser): Promise<CreateUserResult> {
  try {
    const user = await sql.begin(async (tx) => {
      const [created] = await tx<User[]>`
        insert into users (email, name, password_hash, email_verified_at)
        values (${email}, ${name}, ${passwordHash}, now())
        returning id, email, name, token_version as "tokenVersion"
      `;
      await tx`
        insert into site_members (site_id, user_id, role)
        values (${siteId}, ${created.id}, ${role})
      `;
      return created;
    });
    return { ok: true, user: { ...user, siteId, role, deactivatedAt: null } };
  } catch (error) {
    // Caught here rather than checked beforehand, so two simultaneous inserts
    // cannot both pass a check and one of them crash.
    if (isUniqueViolation(error, "users_email_key")) return { ok: false, reason: "email_taken" };
    throw error;
  }
}

/** For login only: the one query that returns the password hash. */
export async function findUserByEmail(email: string): Promise<UserWithPasswordHash | null> {
  const [row] = await sql<(UserRow & { passwordHash: string; emailVerifiedAt: Date | null })[]>`
    select ${memberColumns}, u.password_hash as "passwordHash",
      u.email_verified_at as "emailVerifiedAt"
    from users u
    left join site_members m on m.user_id = u.id
    where u.email = ${email}
  `;
  return row ? withMembership(row) : null;
}

/** `id` must already be validated as a UUID - PostgreSQL rejects anything else. */
export async function findUserById(id: string): Promise<UserWithMembership | null> {
  const [row] = await sql<UserRow[]>`
    select ${memberColumns}
    from users u
    left join site_members m on m.user_id = u.id
    where u.id = ${id}
  `;
  return row ? withMembership(row) : null;
}

/** The user as a member of this site, or null when they do not exist or belong to another site. */
export async function findMemberById(siteId: string, id: string): Promise<Member | null> {
  const [member] = await sql<Member[]>`
    select ${memberColumns}
    from users u
    join site_members m on m.user_id = u.id
    where m.site_id = ${siteId} and u.id = ${id}
  `;
  return member ?? null;
}

/** Ends every session the user has, on every device (D6): their tokens stop matching. */
export async function revokeSessions(id: string): Promise<void> {
  await sql`
    update users
    set token_version = token_version + 1, updated_at = now()
    where id = ${id}
  `;
}

/** This site's members, all roles and both active and deactivated, for the admin-only list. */
export async function listUsers(siteId: string): Promise<Member[]> {
  return sql<Member[]>`
    select ${memberColumns}
    from users u
    join site_members m on m.user_id = u.id
    where m.site_id = ${siteId}
    order by u.name
  `;
}

// Changes this site's membership and, only when that membership exists, bumps the
// user's token_version in the same transaction, so a change to access is seen on
// the person's very next request (D6). A member of another site matches nothing.
async function updateMembership(
  siteId: string,
  id: string,
  revoke: boolean,
  change: (tx: TransactionSql) => Promise<{ count: number }>,
): Promise<Member | null> {
  return sql.begin(async (tx) => {
    const { count } = await change(tx);
    if (count === 0) return null;
    await tx`
      update users
      set token_version = token_version + ${revoke ? 1 : 0}, updated_at = now()
      where id = ${id}
    `;
    const [member] = await tx<Member[]>`
      select ${memberColumns}
      from users u
      join site_members m on m.user_id = u.id
      where m.site_id = ${siteId} and u.id = ${id}
    `;
    return member;
  });
}

/**
 * Changes a member's role and revokes their sessions in the same transaction, so
 * a demoted or promoted user's next request reads the new role rather than one
 * still valid on an old token (D6 - role changes take effect immediately).
 */
export async function updateUserRole(
  siteId: string,
  id: string,
  role: Role,
): Promise<Member | null> {
  return updateMembership(
    siteId,
    id,
    true,
    (tx) =>
      tx`update site_members set role = ${role} where site_id = ${siteId} and user_id = ${id}`,
  );
}

/** Sets a member's new password hash and revokes sessions in one transaction - the
 *  same "takes effect immediately" rule `updateUserRole` follows. Changes nothing
 *  unless the user is a member of this site. */
export async function setUserPassword(
  siteId: string,
  id: string,
  passwordHash: string,
): Promise<User | null> {
  return sql.begin(async (tx) => {
    const [member] = await tx`
      select 1 from site_members where site_id = ${siteId} and user_id = ${id}
    `;
    if (!member) return null;
    const [user] = await tx<User[]>`
      update users u
      set password_hash = ${passwordHash}, token_version = token_version + 1, updated_at = now()
      where u.id = ${id}
      returning ${userColumns}
    `;
    return user ?? null;
  });
}

/** Deactivates a member and revokes their sessions in one transaction - login and
 *  every existing session are refused from their very next request. */
export async function deactivateUser(siteId: string, id: string): Promise<Member | null> {
  return updateMembership(
    siteId,
    id,
    true,
    (tx) =>
      tx`update site_members set deactivated_at = now() where site_id = ${siteId} and user_id = ${id}`,
  );
}

/** Restores login. Does not touch sessions - there are none left to revoke. */
export async function reactivateUser(siteId: string, id: string): Promise<Member | null> {
  return updateMembership(
    siteId,
    id,
    false,
    (tx) =>
      tx`update site_members set deactivated_at = null where site_id = ${siteId} and user_id = ${id}`,
  );
}

function isUniqueViolation(error: unknown, constraint: string): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    error.code === UNIQUE_VIOLATION &&
    "constraint_name" in error &&
    error.constraint_name === constraint
  );
}
