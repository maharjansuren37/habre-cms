import { createHash, randomInt } from "node:crypto";

// Crockford's base32 leaves out I, L, O and U; 0 and 1 are dropped too, so a code
// read aloud or off a screen cannot be mistyped. 30 characters:
// 2-9 and A-Z without I, L, O, U.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
const GROUPS = 3;
const GROUP_LENGTH = 4;

/** A code like `7K2Q-M9XD-HC4V`: 12 characters, about 59 bits. */
export function generateInviteCode(): string {
  const groups: string[] = [];
  for (let group = 0; group < GROUPS; group++) {
    let text = "";
    // randomInt draws uniformly, with no modulo bias.
    for (let i = 0; i < GROUP_LENGTH; i++) text += ALPHABET[randomInt(ALPHABET.length)];
    groups.push(text);
  }
  return groups.join("-");
}

/** What a person typed, reduced to the characters that count. */
export function normaliseInviteCode(typed: string): string {
  return typed.trim().toUpperCase().replace(/[\s-]/g, "");
}

/** SHA-256 hex of the normalised code: the only form that is stored. */
export function hashInviteCode(typed: string): string {
  return createHash("sha256").update(normaliseInviteCode(typed)).digest("hex");
}
