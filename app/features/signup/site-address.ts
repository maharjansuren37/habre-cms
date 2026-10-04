import { z } from "zod";

const MIN_LENGTH = 3;
const MAX_LENGTH = 63;

// Names an operator or the platform may need as a hostname (plan, Data and
// contracts: Reserved site addresses).
const RESERVED_ADDRESSES: ReadonlySet<string> = new Set([
  "www",
  "app",
  "admin",
  "api",
  "media",
  "mail",
  "smtp",
  "imap",
  "pop",
  "ftp",
  "cdn",
  "static",
  "assets",
  "help",
  "support",
  "status",
  "blog",
  "docs",
  "habre",
  "dev",
  "test",
  "staging",
  "beta",
  "root",
  "email",
  "webmail",
  "account",
  "accounts",
  "login",
  "signup",
  "billing",
  "security",
]);

export function normalizeAddress(value: string): string {
  return value.trim().toLowerCase();
}

// The first rule an already-normalised address breaks, or null when it is fine.
function addressProblem(address: string): string | null {
  if (address.length < MIN_LENGTH) {
    return `Use at least ${MIN_LENGTH} characters for the address.`;
  }
  if (address.length > MAX_LENGTH) {
    return `Use at most ${MAX_LENGTH} characters for the address.`;
  }
  if (!/^[a-z0-9-]+$/.test(address)) {
    return "Use only letters, numbers and dashes in the address.";
  }
  if (address.startsWith("-") || address.endsWith("-")) {
    return "The address can't start or end with a dash.";
  }
  if (address.startsWith("xn--")) {
    return "The address can't start with xn--.";
  }
  if (RESERVED_ADDRESSES.has(address)) {
    return `"${address}" is reserved. Choose another address.`;
  }
  return null;
}

export const siteAddressSchema = z
  .string({ error: "Enter an address for your website." })
  .transform(normalizeAddress)
  .superRefine((address, ctx) => {
    const problem = addressProblem(address);
    if (problem !== null) ctx.addIssue({ code: "custom", message: problem });
  });

// A person's name as address letters: accents folded, everything else dropped.
function joinName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

// Candidates to offer when an address is taken, best first. The caller keeps
// the first two that are free.
export function addressSuggestions(address: string, name: string): string[] {
  const taken = normalizeAddress(address);
  const candidates = [
    joinName(name),
    `${taken}-site`,
    `${taken}-web`,
    ...[2, 3, 4, 5, 6, 7, 8, 9].map((n) => `${taken}-${n}`),
  ];
  const seen = new Set<string>([taken]);
  const result: string[] = [];
  for (const candidate of candidates) {
    if (seen.has(candidate) || addressProblem(candidate) !== null) continue;
    seen.add(candidate);
    result.push(candidate);
  }
  return result;
}
