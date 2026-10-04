import {
  isUserFormBodyAllowed,
  nameSchema,
  newPasswordSchema,
} from "#app/features/users/user-input.ts";

/** The three forms on Your account; the hidden `intent` field says which was sent. */
export type AccountIntent = "name" | "email" | "password";

const INTENTS: readonly string[] = ["name", "email", "password"];

/** The form that was sent, or null for anything else. */
export function parseAccountIntent(value: unknown): AccountIntent | null {
  return typeof value === "string" && INTENTS.includes(value) ? (value as AccountIntent) : null;
}

export type NameResult = { ok: true; name: string } | { ok: false; message: string };

export function parseAccountName(value: unknown): NameResult {
  const result = nameSchema.safeParse(typeof value === "string" ? value : "");
  if (result.success) return { ok: true, name: result.data };
  return { ok: false, message: result.error.issues[0]?.message ?? "Enter a name." };
}

export type PasswordResult =
  | { ok: true; currentPassword: string; newPassword: string }
  | { ok: false; errors: { currentPassword?: string; newPassword?: string } };

/** Passwords are kept exactly as typed; only the new one is held to the length rules. */
export function parseAccountPassword(current: unknown, next: unknown): PasswordResult {
  const errors: { currentPassword?: string; newPassword?: string } = {};
  if (typeof current !== "string" || current === "") {
    errors.currentPassword = "Enter your current password.";
  }
  const parsed = newPasswordSchema.safeParse(typeof next === "string" ? next : "");
  if (!parsed.success) errors.newPassword = parsed.error.issues[0]?.message;
  if (
    errors.currentPassword ||
    errors.newPassword ||
    typeof current !== "string" ||
    !parsed.success
  ) {
    return { ok: false, errors };
  }
  return { ok: true, currentPassword: current, newPassword: parsed.data };
}

/** The same 8 KB cap as the Users forms. */
export const isAccountFormBodyAllowed = isUserFormBodyAllowed;
