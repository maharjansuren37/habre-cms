import { z } from "zod";
import {
  emailSchema,
  isUserFormBodyAllowed,
  nameSchema,
  newPasswordSchema,
} from "../users/user-input.ts";
import { siteAddressSchema } from "./site-address.ts";

export type SignupMode = "invite" | "open";

const baseShape = {
  name: nameSchema,
  email: emailSchema,
  password: newPasswordSchema,
  address: siteAddressSchema,
};

const inviteSchema = z
  .string({ error: "Enter your invite code." })
  .trim()
  .min(1, { message: "Enter your invite code." })
  .max(100, { message: "That invite code is too long." });

// Form fields: name, email, password, address, invite. In `open` mode the
// invite field is not part of the schema, so Zod drops it from the result.
const inviteShape = { ...baseShape, invite: inviteSchema };

export function signupSchema(mode: "invite"): z.ZodObject<typeof inviteShape>;
export function signupSchema(mode: "open"): z.ZodObject<typeof baseShape>;
export function signupSchema(
  mode: SignupMode,
): z.ZodObject<typeof inviteShape> | z.ZodObject<typeof baseShape>;
export function signupSchema(mode: SignupMode) {
  return mode === "invite" ? z.object(inviteShape) : z.object(baseShape);
}

// The same 8 KB bound and Content-Length rule as the user form (F-01).
export function isSignupBodyAllowed(headers: Headers): boolean {
  return isUserFormBodyAllowed(headers);
}
