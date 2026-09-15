import { redirect } from "react-router";
import { revokeSessions } from "#app/features/users/users.server.ts";
import { logSecurityEvent } from "#app/lib/security-log.server.ts";
import type { Route } from "./+types/logout";
import { findSessionUser } from "./require-user.server.ts";
import { serializeClearedSessionCookie } from "./session-cookie.server.ts";

// An action and no loader: logging out changes state, so a link or an image tag
// pointing here must not be able to do it (React Router sessions docs).
export async function action({ request }: Route.ActionArgs) {
  const user = await findSessionUser(request);
  if (user) {
    // A signed token cannot be recalled, so logging out revokes every session
    // for the user - a copied cookie stops working too.
    await revokeSessions(user.id);
    logSecurityEvent({ event: "logout", userId: user.id });
  }
  return redirect("/admin/login", {
    headers: { "Set-Cookie": await serializeClearedSessionCookie() },
  });
}
