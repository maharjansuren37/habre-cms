import type { TransactionSql } from "postgres";
import {
  emailLoginLimiter,
  LOGIN_BLOCK_MINUTES,
  passwordCheckSlots,
} from "#app/features/auth/login-rate-limit.server.ts";
import { hashPassword, verifyPassword } from "#app/features/auth/password.server.ts";
import { hashEmailToken } from "#app/features/signup/email-token-hash.ts";
import { issueEmailToken } from "#app/features/signup/email-tokens.server.ts";
import { inSite, sql } from "#app/lib/db.server.ts";
import { logSecurityEvent } from "#app/lib/security-log.server.ts";
import { type DeletionCase, type DeletionExpect, deletionCase } from "./account-delete-input.ts";
import { EMAIL_CHANGE_LIFETIME_HOURS } from "./email-change-email.ts";

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

/** True when another account (not this one) already uses `email`. */
export async function isEmailTakenByAnother(userId: string, email: string): Promise<boolean> {
  const rows = await sql`select 1 from users where email = ${email} and id <> ${userId}`;
  return rows.length > 0;
}

/**
 * Starts an email change (email on): uses up the person's earlier link and
 * issues one for `newEmail`, in one transaction with the user's row locked
 * first (F-243's order). Returns the token for the caller to email after the
 * commit. Nothing about the account changes.
 */
export async function requestEmailChange(
  userId: string,
  newEmail: string,
): Promise<{ token: string; name: string }> {
  return sql.begin(async (tx) => {
    const [user] = await tx<{ id: string; name: string }[]>`
      select id, name from users where id = ${userId} for update`;
    await tx`
      update email_tokens set used_at = now()
      where user_id = ${userId} and purpose = 'email_change' and used_at is null`;
    const token = await issueEmailToken(
      tx,
      userId,
      "email_change",
      EMAIL_CHANGE_LIFETIME_HOURS * 60 * 60 * 1000,
      newEmail,
    );
    return { token, name: user.name };
  });
}

/** The address of the person's live email-change link, or null. */
export async function findPendingEmailChange(userId: string): Promise<string | null> {
  const [row] = await sql<{ newEmail: string }[]>`
    select new_email as "newEmail" from email_tokens
    where user_id = ${userId} and purpose = 'email_change'
      and used_at is null and expires_at > now()
    order by created_at desc
    limit 1`;
  return row?.newEmail ?? null;
}

/** Uses up the person's unused email-change links, after a send that failed. */
export async function cancelEmailChange(userId: string): Promise<void> {
  await sql`
    update email_tokens set used_at = now()
    where user_id = ${userId} and purpose = 'email_change' and used_at is null`;
}

class ConfirmRefused extends Error {
  state: "expired" | "taken";
  constructor(state: "expired" | "taken") {
    super(state);
    this.state = state;
  }
}

/**
 * Makes the token's new address the account's email, in one transaction. The
 * user's row is locked before any of their tokens (F-243's order), and the
 * token update is the only place the token is used. Every refusal throws, so
 * the transaction rolls back and nothing is used up; the catch is outside
 * `sql.begin` because a unique violation aborts the transaction and must
 * propagate out. A deactivated member is `expired`, like a dead link.
 */
export async function confirmEmailChange(
  token: string,
): Promise<
  | { ok: true; userId: string; oldEmail: string; newEmail: string; name: string }
  | { ok: false; state: "expired" | "taken" }
> {
  const tokenHash = hashEmailToken(token);
  try {
    return await sql.begin(async (tx) => {
      const [owner] = await tx<{ userId: string }[]>`
        select user_id as "userId" from email_tokens
        where token_hash = ${tokenHash} and purpose = 'email_change'`;
      if (!owner) throw new ConfirmRefused("expired");
      const [user] = await tx<{ email: string; name: string }[]>`
        select email, name from users
        where id = ${owner.userId}
          and exists (
            select 1 from site_members m
            where m.user_id = users.id and m.deactivated_at is null
          )
        for update`;
      if (!user) throw new ConfirmRefused("expired");
      const [used] = await tx<{ newEmail: string }[]>`
        update email_tokens set used_at = now()
        where token_hash = ${tokenHash} and purpose = 'email_change'
          and used_at is null and expires_at > now()
        returning new_email as "newEmail"`;
      if (!used) throw new ConfirmRefused("expired");
      await tx`
        update users
        set email = ${used.newEmail}, email_verified_at = now(), updated_at = now()
        where id = ${owner.userId}`;
      await tx`
        update email_tokens set used_at = now()
        where user_id = ${owner.userId} and purpose in ('email_change', 'reset')
          and used_at is null`;
      return {
        ok: true,
        userId: owner.userId,
        oldEmail: user.email,
        newEmail: used.newEmail,
        name: user.name,
      } as const;
    });
  } catch (error) {
    if (error instanceof ConfirmRefused) return { ok: false, state: error.state };
    if (isUniqueViolation(error, "users_email_key")) return { ok: false, state: "taken" };
    throw error;
  }
}

export type DeletionFacts = {
  address: string;
  case: DeletionCase;
  /** Site case only: what goes with the site. Null for the other cases. */
  site: { posts: number; pages: number; images: number; otherMemberNames: string[] } | null;
};

/**
 * Which case this member is in, read with `db` (a transaction from `inSite`;
 * entries and media are under row-level security). Not the site's last active
 * admin: leave. The last active admin takes the site. Null when the person has
 * no membership on the site any more.
 */
async function readDeletionFacts(
  db: TransactionSql,
  siteId: string,
  userId: string,
): Promise<DeletionFacts | null> {
  const [row] = await db<{ address: string; role: string; deactivatedAt: Date | null }[]>`
    select s.subdomain as address, m.role, m.deactivated_at as "deactivatedAt"
    from site_members m
    join sites s on s.id = m.site_id
    where m.site_id = ${siteId} and m.user_id = ${userId}`;
  if (!row) return null;
  const [others] = await db<{ count: number }[]>`
    select count(*)::int as count from site_members
    where site_id = ${siteId} and role = 'admin' and deactivated_at is null
      and user_id <> ${userId}`;
  const isLastActiveAdmin = row.role === "admin" && !row.deactivatedAt && others.count === 0;
  const kind = deletionCase({ isLastActiveAdmin });
  if (kind !== "site") return { address: row.address, case: kind, site: null };
  const [counts] = await db<{ posts: number; pages: number; images: number }[]>`
    select
      (select count(*)::int from entries where site_id = ${siteId} and type = 'post') as posts,
      (select count(*)::int from entries where site_id = ${siteId} and type = 'page') as pages,
      (select count(*)::int from media where site_id = ${siteId}) as images`;
  const names = await db<{ name: string }[]>`
    select u.name from site_members m join users u on u.id = m.user_id
    where m.site_id = ${siteId} and m.user_id <> ${userId}
    order by u.name, u.id`;
  return {
    address: row.address,
    case: "site",
    site: { ...counts, otherMemberNames: names.map((member) => member.name) },
  };
}

/** What the confirm screen shows: the site's address, which case applies, and for the site case what goes. */
export async function findDeletion(siteId: string, userId: string): Promise<DeletionFacts | null> {
  return inSite(siteId, (tx) => readDeletionFacts(tx, siteId, userId));
}

export type DeleteAccountResult =
  | {
      ok: true;
      siteDeleted: boolean;
      address: string;
      /** R2 keys of the deleted media, for removal after the commit (empty when leaving). */
      storageKeys: string[];
      /** The other members of a deleted site, to be told after the commit (empty when leaving). */
      otherMembers: { name: string; email: string }[];
    }
  | { ok: false; reason: "changed" };

/**
 * Deletes the signed-in person's own account, and the site with it when they
 * are its last active admin. **This is the one place a site is deleted.** Every
 * later site-owned table or service adds its own cleanup here: image variants' R2 keys (17b), `ai_runs` (18),
 * `contact_submissions` (19) and cancelling the Stripe subscription (21).
 *
 * One transaction: the site's row is locked first, then the user's (15e1's
 * confirm locks the user and never the site, so no cycle), and the case is
 * worked out again. A case other than the one the form was loaded as deletes
 * nothing. Leaving: the membership goes before the user
 * (`site_members.user_id` restricts); its foreign keys null the author and
 * uploader of their entries and media, and `email_tokens` cascade from the
 * user. Taking the site: settings, entries, media, memberships, every member's
 * user and the site row, in that order (settings' keys point at entries and
 * media; the site's domains go before the site, which they restrict). After the commit the caller removes the returned R2 keys and tells
 * the other members. `userId` and `siteId` are the session's.
 */
export async function deleteAccount(
  siteId: string,
  userId: string,
  expect: DeletionExpect,
): Promise<DeleteAccountResult> {
  return inSite(siteId, async (tx): Promise<DeleteAccountResult> => {
    await tx`select id from sites where id = ${siteId} for update`;
    await tx`select id from users where id = ${userId} for update`;
    const facts = await readDeletionFacts(tx, siteId, userId);
    if (!facts) return { ok: false, reason: "changed" };
    if (facts.case !== expect) return { ok: false, reason: "changed" };
    if (facts.case === "leave") {
      await tx`delete from site_members where site_id = ${siteId} and user_id = ${userId}`;
      await tx`delete from users where id = ${userId}`;
      return {
        ok: true,
        siteDeleted: false,
        address: facts.address,
        storageKeys: [],
        otherMembers: [],
      };
    }
    const members = await tx<{ id: string; name: string; email: string }[]>`
      select u.id, u.name, u.email from site_members m join users u on u.id = m.user_id
      where m.site_id = ${siteId}`;
    await tx`delete from site_settings where site_id = ${siteId}`;
    await tx`delete from entries where site_id = ${siteId}`;
    const media = await tx<{ storageKey: string }[]>`
      delete from media where site_id = ${siteId} returning storage_key as "storageKey"`;
    await tx`delete from site_members where site_id = ${siteId}`;
    await tx`delete from site_domains where site_id = ${siteId}`;
    await tx`delete from users where id in ${tx(members.map((member) => member.id))}`;
    await tx`delete from sites where id = ${siteId}`;
    return {
      ok: true,
      siteDeleted: true,
      address: facts.address,
      storageKeys: media.map((row) => row.storageKey),
      otherMembers: members
        .filter((member) => member.id !== userId)
        .map(({ name, email }) => ({ name, email })),
    };
  });
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
