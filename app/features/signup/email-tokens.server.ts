import { randomBytes } from "node:crypto";
import type { TransactionSql } from "postgres";
import { hashEmailToken } from "./email-token-hash.ts";

export type EmailTokenPurpose = "verify" | "reset" | "email_change";

/**
 * Makes a one-use token for a user and stores only its SHA-256 (the token
 * itself travels in the email). An `email_change` token carries the address it
 * is for as `newEmail`; the table's check refuses any other pairing. Takes the
 * caller's transaction, so a signup either has its token or does not exist.
 * Returns the token to put in the email.
 */
export async function issueEmailToken(
  tx: TransactionSql,
  userId: string,
  purpose: EmailTokenPurpose,
  lifetimeMs: number,
  newEmail?: string,
): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await tx`
    insert into email_tokens (user_id, purpose, token_hash, expires_at, new_email)
    values (
      ${userId}, ${purpose}, ${hashEmailToken(token)}, ${new Date(Date.now() + lifetimeMs)},
      ${newEmail ?? null}
    )
  `;
  return token;
}
