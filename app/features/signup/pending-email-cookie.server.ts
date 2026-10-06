import { createCookie } from "react-router";
import { env } from "#app/lib/env.server.ts";

// Remembers which address "Check your email" is about, so /signup/sent can say
// it without the address in the URL. Signed, not encrypted: it holds only what
// the person typed. Read by /signup/sent (step 8).
const pendingEmailCookie = createCookie("pending_email", {
  secrets: [env.JWT_SECRET],
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  maxAge: 24 * 60 * 60,
  // Follows PLATFORM_URL like the session cookie, so browser tests over http work.
  secure: new URL(env.PLATFORM_URL).protocol === "https:",
});

export function serializePendingEmailCookie(email: string): Promise<string> {
  return pendingEmailCookie.serialize(email);
}

export async function readPendingEmail(request: Request): Promise<string | null> {
  const value: unknown = await pendingEmailCookie.parse(request.headers.get("Cookie"));
  return typeof value === "string" && value !== "" ? value : null;
}
