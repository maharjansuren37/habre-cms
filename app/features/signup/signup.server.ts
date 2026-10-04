import { randomUUID } from "node:crypto";
import { passwordCheckSlots } from "#app/features/auth/login-rate-limit.server.ts";
import { hashPassword } from "#app/features/auth/password.server.ts";
import { inSite, sql } from "#app/lib/db.server.ts";
import { issueEmailToken } from "./email-tokens.server.ts";
import { hashInviteCode } from "./invite-code.ts";
import type { SignupMode } from "./signup-input.ts";
import { addressSuggestions } from "./site-address.ts";
import { VERIFY_LIFETIME_HOURS } from "./verification-email.ts";

export type SignupInput = {
  name: string;
  /** Normalised (see `emailSchema`). */
  email: string;
  password: string;
  /** Normalised and valid (see `siteAddressSchema`). */
  address: string;
  /** What was typed; read only in `invite` mode. */
  invite?: string;
};

export type SignupFieldErrors = Partial<Record<"email" | "address" | "invite", string>>;

export type SignupResult =
  | { ok: true; userId: string; siteId: string; token: string }
  | { ok: false; reason: "busy" }
  | { ok: false; reason: "invalid"; errors: SignupFieldErrors };

const UNIQUE_VIOLATION = "23505";
const INVITE_REFUSED = "That invite code isn’t valid or has been used.";

// Thrown inside the transaction so the whole signup rolls back.
class InviteRefused extends Error {}

function isUniqueViolation(error: unknown, constraint: string): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    error.code === UNIQUE_VIOLATION &&
    "constraint_name" in error &&
    error.constraint_name === constraint
  );
}

// Two free addresses to offer, found with one query over every candidate.
async function freeSuggestions(address: string, name: string): Promise<string[]> {
  const candidates = addressSuggestions(address, name);
  if (candidates.length === 0) return [];
  const taken = await sql<{ subdomain: string }[]>`
    select subdomain from sites where subdomain in ${sql(candidates)}
  `;
  const takenSet = new Set(taken.map((row) => row.subdomain));
  return candidates.filter((candidate) => !takenSet.has(candidate)).slice(0, 2);
}

/**
 * Creates the unconfirmed user, their site, the admin membership, the site's
 * settings and a verify token in one transaction, and uses up the invite. The
 * email is sent by the caller after this returns, never inside the transaction.
 */
export async function createSignup(input: SignupInput, mode: SignupMode): Promise<SignupResult> {
  // scrypt runs outside the transaction, so no connection is held while it
  // works, and in one of the slots login shares so signups cannot starve it.
  if (!passwordCheckSlots.tryAcquire()) return { ok: false, reason: "busy" };
  let passwordHash: string;
  try {
    passwordHash = await hashPassword(input.password);
  } finally {
    passwordCheckSlots.release();
  }

  // Generated here so `inSite` can be entered before the site row exists.
  const siteId = randomUUID();
  try {
    return await inSite(siteId, async (tx) => {
      await tx`insert into sites (id, subdomain) values (${siteId}, ${input.address})`;
      if (mode === "invite") {
        // Before the user, so only a valid code learns whether an email already
        // has an account (spec, Decisions). `used_at is null` is what makes a
        // code work once, even for two signups at the same moment: the second
        // update finds no row.
        const used = await tx`
          update invites set used_at = now(), used_by_site_id = ${siteId}
          where code_hash = ${hashInviteCode(input.invite ?? "")} and used_at is null
          returning id
        `;
        if (used.length === 0) throw new InviteRefused();
      }
      const [user] = await tx<{ id: string }[]>`
        insert into users (email, name, password_hash, email_verified_at)
        values (${input.email}, ${input.name}, ${passwordHash}, null)
        returning id
      `;
      await tx`
        insert into site_members (site_id, user_id, role)
        values (${siteId}, ${user.id}, 'admin')
      `;
      await tx`
        insert into site_settings (site_id, site_title)
        values (${siteId}, ${input.address})
      `;
      const token = await issueEmailToken(
        tx,
        user.id,
        "verify",
        VERIFY_LIFETIME_HOURS * 60 * 60 * 1000,
      );
      return { ok: true as const, userId: user.id, siteId, token };
    });
  } catch (error) {
    // Mapped after the rollback, so a refused signup leaves no site or user.
    // The constraint, not a check beforehand, decides: two simultaneous
    // signups cannot both pass a check.
    if (error instanceof InviteRefused) {
      return { ok: false, reason: "invalid", errors: { invite: INVITE_REFUSED } };
    }
    if (isUniqueViolation(error, "sites_subdomain_key")) {
      const [first, second] = await freeSuggestions(input.address, input.name);
      const offer = first && second ? ` Try ${first} or ${second}.` : first ? ` Try ${first}.` : "";
      return {
        ok: false,
        reason: "invalid",
        errors: { address: `${input.address} is taken.${offer}` },
      };
    }
    if (isUniqueViolation(error, "users_email_key")) {
      return {
        ok: false,
        reason: "invalid",
        errors: { email: "An account with this email already exists." },
      };
    }
    throw error;
  }
}
