import { isUserFormBodyAllowed, nameSchema } from "#app/features/users/user-input.ts";

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

/** The same 8 KB cap as the Users forms. */
export const isAccountFormBodyAllowed = isUserFormBodyAllowed;
