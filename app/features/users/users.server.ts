import { sql } from "#app/lib/db.server.ts";
import type { Role } from "./roles.ts";

export type User = {
  id: string;
  email: string;
  name: string;
  role: Role;
  tokenVersion: number;
  deactivatedAt: Date | null;
};

export type UserWithPasswordHash = User & { passwordHash: string };

type NewUser = { email: string; name: string; passwordHash: string; role: Role };

export type CreateUserResult = { ok: true; user: User } | { ok: false; reason: "email_taken" };

// Every query returns the same shape. The password hash is left out unless a
// query adds it deliberately.
const userColumns = sql`
  id, email, name, role,
  token_version as "tokenVersion",
  deactivated_at as "deactivatedAt"
`;

const UNIQUE_VIOLATION = "23505";

/** Inserts a user. Expects a normalised email (see `emailSchema`). */
export async function createUser({
  email,
  name,
  passwordHash,
  role,
}: NewUser): Promise<CreateUserResult> {
  try {
    const [user] = await sql<User[]>`
      insert into users (email, name, password_hash, role)
      values (${email}, ${name}, ${passwordHash}, ${role})
      returning ${userColumns}
    `;
    return { ok: true, user };
  } catch (error) {
    // Caught here rather than checked beforehand, so two simultaneous inserts
    // cannot both pass a check and one of them crash.
    if (isUniqueViolation(error, "users_email_key")) return { ok: false, reason: "email_taken" };
    throw error;
  }
}

/** For login only: the one query that returns the password hash. */
export async function findUserByEmail(email: string): Promise<UserWithPasswordHash | null> {
  const [user] = await sql<UserWithPasswordHash[]>`
    select ${userColumns}, password_hash as "passwordHash"
    from users
    where email = ${email}
  `;
  return user ?? null;
}

/** `id` must already be validated as a UUID - PostgreSQL rejects anything else. */
export async function findUserById(id: string): Promise<User | null> {
  const [user] = await sql<User[]>`
    select ${userColumns}
    from users
    where id = ${id}
  `;
  return user ?? null;
}

/** Ends every session the user has, on every device (D6): their tokens stop matching. */
export async function revokeSessions(id: string): Promise<void> {
  await sql`
    update users
    set token_version = token_version + 1, updated_at = now()
    where id = ${id}
  `;
}

/** Every user, all roles and both active and deactivated, for the admin-only list. */
export async function listUsers(): Promise<User[]> {
  return sql<User[]>`
    select ${userColumns} from users order by name
  `;
}

/**
 * Changes a user's role and revokes their sessions in the same statement, so a
 * demoted or promoted user's next request reads the new role rather than one
 * still valid on an old token (D6 - role changes take effect immediately).
 */
export async function updateUserRole(id: string, role: Role): Promise<User | null> {
  const [user] = await sql<User[]>`
    update users
    set role = ${role}, token_version = token_version + 1, updated_at = now()
    where id = ${id}
    returning ${userColumns}
  `;
  return user ?? null;
}

/** Sets a new password hash and revokes sessions in the same statement - the
 *  same "takes effect immediately" rule `updateUserRole` follows. */
export async function setUserPassword(id: string, passwordHash: string): Promise<User | null> {
  const [user] = await sql<User[]>`
    update users
    set password_hash = ${passwordHash}, token_version = token_version + 1, updated_at = now()
    where id = ${id}
    returning ${userColumns}
  `;
  return user ?? null;
}

/** Deactivates a user and revokes their sessions in one statement - login and
 *  every existing session are refused from their very next request. */
export async function deactivateUser(id: string): Promise<User | null> {
  const [user] = await sql<User[]>`
    update users
    set deactivated_at = now(), token_version = token_version + 1, updated_at = now()
    where id = ${id}
    returning ${userColumns}
  `;
  return user ?? null;
}

/** Restores login. Does not touch sessions - there are none left to revoke. */
export async function reactivateUser(id: string): Promise<User | null> {
  const [user] = await sql<User[]>`
    update users
    set deactivated_at = null, updated_at = now()
    where id = ${id}
    returning ${userColumns}
  `;
  return user ?? null;
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
