import { z } from "zod";

export const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_LENGTH = 200;

// Stored lowercased: the database's unique constraint relies on it.
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(
    z
      .email({ message: "Enter an email address like name@example.org." })
      .max(254, { message: "Email addresses can be up to 254 characters." }),
  );

export const nameSchema = z
  .string()
  .trim()
  .min(1, { message: "Enter a name." })
  .max(100, { message: "Names can be up to 100 characters." });

// For setting a password. Logging in only checks a password is present, so an
// existing password is never rejected by a rule added later.
export const newPasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, {
    message: `Use at least ${PASSWORD_MIN_LENGTH} characters for the password.`,
  })
  .max(PASSWORD_MAX_LENGTH, {
    message: `Use at most ${PASSWORD_MAX_LENGTH} characters for the password.`,
  });

export const newUserSchema = z.object({
  email: emailSchema,
  name: nameSchema,
  password: newPasswordSchema,
});
