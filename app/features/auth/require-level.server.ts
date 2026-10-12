import { data, type MiddlewareFunction } from "react-router";
import { clientIp } from "#app/features/auth/client-ip.ts";
import { getSiteLevel } from "#app/features/settings/settings.server.ts";
import { logSecurityEvent } from "#app/lib/security-log.server.ts";
import { userContext } from "./user-context.ts";

/**
 * Guards a route to Pro sites (item 20, D166), after `requireUser` has set
 * `userContext`. A Simple site gets the same "Not Found" a role refusal gives
 * (`requireRole`), so a screen the site has not switched on is not signalled,
 * and the level is read from the database on every request, never from a token.
 */
export function requireProLevel(): MiddlewareFunction<Response> {
  return async ({ request, url, context }, next) => {
    const user = context.get(userContext);
    if ((await getSiteLevel(user.siteId)) !== "pro") {
      logSecurityEvent({
        event: "request_refused",
        reason: "level",
        path: url.pathname,
        role: user.role,
        ip: clientIp(request.headers),
      });
      throw data("Not Found", { status: 404 });
    }
    return next();
  };
}
