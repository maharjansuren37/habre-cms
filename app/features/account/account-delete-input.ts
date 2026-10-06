import { isUserFormBodyAllowed } from "#app/features/users/user-input.ts";

/** What the confirm screen was loaded as: the form carries it back (`expect`). */
export type DeletionExpect = "leave" | "site";

/** Which of the two situations a person is in. */
export type DeletionCase = DeletionExpect;

/**
 * Which case a member is in: not the site's last active admin leaves; the last
 * active admin takes the site with them. Every site is the same.
 */
export function deletionCase(facts: { isLastActiveAdmin: boolean }): DeletionCase {
  return facts.isLastActiveAdmin ? "site" : "leave";
}

const EXPECTS: readonly string[] = ["leave", "site"];

/** The case the form was loaded as, or null for anything else. */
export function parseDeleteExpect(value: unknown): DeletionExpect | null {
  return typeof value === "string" && EXPECTS.includes(value) ? (value as DeletionExpect) : null;
}

export const ADDRESS_MISMATCH = "That isn't your site's address.";

export type DeleteFormErrors = { address?: string; currentPassword?: string };

export type DeleteFormResult =
  | { ok: true; expect: DeletionExpect; address: string; currentPassword: string }
  | { ok: false; errors: DeleteFormErrors; typedAddress: string };

/**
 * The delete form. The password is kept exactly as typed; the address is
 * required only when taking the site, and is kept as typed to show again.
 */
export function parseDeleteForm(
  expect: DeletionExpect,
  address: unknown,
  currentPassword: unknown,
): DeleteFormResult {
  const typedAddress = typeof address === "string" ? address : "";
  const errors: DeleteFormErrors = {};
  if (expect === "site" && typedAddress.trim() === "") {
    errors.address = "Type the site's address to confirm.";
  }
  if (typeof currentPassword !== "string" || currentPassword === "") {
    errors.currentPassword = "Enter your current password.";
  }
  if (errors.address || errors.currentPassword || typeof currentPassword !== "string") {
    return { ok: false, errors, typedAddress };
  }
  return {
    ok: true,
    expect,
    address: expect === "site" ? typedAddress : "",
    currentPassword,
  };
}

/** True when the typed address is the site's, ignoring case and surrounding space. */
export function addressMatches(typed: string, actual: string): boolean {
  const trimmed = typed.trim().toLowerCase();
  return trimmed !== "" && trimmed === actual.toLowerCase();
}

/** The same 8 KB cap as the Users forms. */
export const isDeleteFormBodyAllowed = isUserFormBodyAllowed;
