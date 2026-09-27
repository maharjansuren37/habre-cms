import { type MiddlewareFunction, redirect } from "react-router";
import { findUserById } from "#app/features/users/users.server.ts";
import { env } from "#app/lib/env.server.ts";
import { safeRedirect } from "./safe-redirect.ts";
import { checkSessionUser, type SessionUser } from "./session-check.ts";
import {
  hasSessionCookie,
  readSessionToken,
  serializeClearedSessionCookie,
} from "./session-cookie.server.ts";
import { verifySessionToken } from "./session-token.server.ts";
import { userContext } from "./user-context.ts";

// Admin pages show people's names and unpublished content.
const NO_STORE = "private, no-store";

/** The logged-in user for this request, or null - checked against the database (D6). */
export async function findSessionUser(request: Request): Promise<SessionUser | null> {
  const token = await readSessionToken(request);
  const claims = token ? await verifySessionToken(token, env.JWT_SECRET) : null;
  if (!claims) return null;
  const check = checkSessionUser(claims, await findUserById(claims.userId));
  return check.ok ? check.user : null;
}

/**
 * Guards the admin area: every request loads the user from the database and is
 * refused if the token is invalid, the user is gone or deactivated, or their
 * sessions were revoked (D6). Refused requests go to the login page, which
 * sends them back here afterwards.
 */
export const requireUser: MiddlewareFunction<Response> = async (
  { request, url, context },
  next,
) => {
  const user = await findSessionUser(request);

  if (!user) {
    // `url`, not `request.url`, which ends in `.data` on a client-side navigation.
    const { pathname, search } = url;
    const loginUrl = `/admin/login?redirectTo=${encodeURIComponent(safeRedirect(pathname + search))}`;
    const headers = new Headers({ "Cache-Control": NO_STORE });
    // A cookie that no longer works - unreadable, expired, revoked - is removed.
    if (hasSessionCookie(request)) headers.set("Set-Cookie", await serializeClearedSessionCookie());
    throw redirect(loginUrl, { headers });
  }

  context.set(userContext, user);
  const response = await next();
  response.headers.set("Cache-Control", NO_STORE);
  return response;
};
