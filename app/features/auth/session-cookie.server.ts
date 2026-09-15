import { createCookie } from "react-router";
import { env } from "#app/lib/env.server.ts";
import { SESSION_LIFETIME_SECONDS } from "./session-token.server.ts";

// Holds the session token (already signed, so the cookie itself is not).
const sessionCookie = createCookie("habre_session", {
  httpOnly: true,
  sameSite: "lax",
  // "/", not "/admin": React Router fetches the admin home page's data from
  // /admin.data, which a /admin cookie path does not cover (found in item 1
  // step 10 - the guard and login redirected each other in a loop). The public
  // site receives it but never reads it.
  path: "/",
  maxAge: SESSION_LIFETIME_SECONDS,
  // https in production. Browser tests run the production build over http on
  // 127.0.0.1, which is why this follows APP_URL rather than NODE_ENV.
  secure: new URL(env.APP_URL).protocol === "https:",
});

/** Whether the request sent a session cookie at all, readable or not. */
export function hasSessionCookie(request: Request): boolean {
  const header = request.headers.get("Cookie") ?? "";
  return header.split(";").some((pair) => pair.trim().startsWith(`${sessionCookie.name}=`));
}

export async function readSessionToken(request: Request): Promise<string | null> {
  const value: unknown = await sessionCookie.parse(request.headers.get("Cookie"));
  return typeof value === "string" && value !== "" ? value : null;
}

export function serializeSessionCookie(token: string): Promise<string> {
  return sessionCookie.serialize(token);
}

export function serializeClearedSessionCookie(): Promise<string> {
  return sessionCookie.serialize("", { maxAge: 0 });
}
