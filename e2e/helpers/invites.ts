import { createHash, randomInt } from "node:crypto";
import { withDatabase } from "./users.ts";

// The e2e project cannot import app/, so the code's shape and hash are restated:
// SHA-256 hex of the code with spaces and dashes dropped, in upper case
// (app/features/signup/invite-code.ts).
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";

export function hashInvite(code: string): string {
  return createHash("sha256").update(code.trim().toUpperCase().replace(/[\s-]/g, "")).digest("hex");
}

function newCode(): string {
  const group = () =>
    Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  return `${group()}-${group()}-${group()}`;
}

/** Inserts an unused invite as the owner and returns the code a person would type. */
export async function createInvite(note = "e2e"): Promise<string> {
  const code = newCode();
  await withDatabase(async (sql) => {
    await sql`insert into invites (code_hash, note) values (${hashInvite(code)}, ${note})`;
  });
  return code;
}

/** Test cleanup: the invites a test made, used or not. */
export function deleteInvites(codes: string[]): Promise<void> {
  if (codes.length === 0) return Promise.resolve();
  const hashes = codes.map(hashInvite);
  return withDatabase(async (sql) => {
    await sql`delete from invites where code_hash in ${sql(hashes)}`;
  });
}

/** An address that is valid, free and unique to this test. */
export function randomAddress(): string {
  return `e2e-${randomInt(10 ** 9).toString(36)}-${Date.now().toString(36)}`;
}
