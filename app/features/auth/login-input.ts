import { z } from "zod";
import { emailSchema } from "#app/features/users/user-input.ts";

// A real login form is well under 1 KB. Anything larger is refused before it is
// read, so an anonymous request cannot make the server buffer a huge body
// (finding F-01: three 100 MB bodies took the process past 1.5 GB).
const MAX_LOGIN_BODY_BYTES = 8 * 1024;

// Only that both are present, and that the email is shaped like one. The
// new-password rules are not applied: an existing password is never rejected
// here, and none of these messages says whether an account exists.
export const loginSchema = z.object({
  email: z.string().trim().min(1, { message: "Enter your email." }).pipe(emailSchema),
  password: z
    .string()
    .min(1, { message: "Enter your password." })
    .max(200, { message: "Use at most 200 characters for the password." }),
});

/**
 * Whether a login request's declared size is small enough to read. A missing
 * Content-Length means a body of unknown size, which a browser's form
 * submission never sends.
 */
export function isLoginBodySizeAllowed(headers: Headers): boolean {
  const declared = headers.get("Content-Length");
  if (declared === null || !/^[0-9]+$/.test(declared)) return false;
  return Number(declared) <= MAX_LOGIN_BODY_BYTES;
}

export type LoginFieldErrors = { email?: string; password?: string };

/** Reads the login form; returns the credentials or a message per field. */
export function parseLoginForm(
  formData: FormData,
): { ok: true; email: string; password: string } | { ok: false; fieldErrors: LoginFieldErrors } {
  const result = loginSchema.safeParse({
    email: stringField(formData, "email"),
    password: stringField(formData, "password"),
  });
  if (result.success) return { ok: true, ...result.data };

  const { fieldErrors } = z.flattenError(result.error);
  return {
    ok: false,
    fieldErrors: { email: fieldErrors.email?.[0], password: fieldErrors.password?.[0] },
  };
}

function stringField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}
