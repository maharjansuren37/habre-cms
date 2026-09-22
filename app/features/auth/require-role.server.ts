import { data, type MiddlewareFunction } from "react-router";
import { clientIp } from "#app/features/auth/client-ip.ts";
import type { Role } from "#app/features/users/roles.ts";
import { logSecurityEvent } from "#app/lib/security-log.server.ts";
import { userContext } from "./user-context.ts";

/**
 * Guards a route to a set of roles, on top of `requireUser`'s login check -
 * `requireUser` must already have run, so `userContext` is set. Refuses with
 * the same "Not Found" the project already gives for an ownership refusal
 * (`findEntryForUser`), rather than a 403: consistent with every other access
 * refusal here, and it does not signal that a restricted feature exists to a
 * role that cannot reach it. First use: `/admin/pages*`, editor and admin only
 * (item 6a); reusable as-is for item 8's admin-only routes.
 */
export function requireRole(allowed: readonly Role[]): MiddlewareFunction<Response> {
  return async ({ request, context }, next) => {
    const user = context.get(userContext);
    if (!allowed.includes(user.role)) {
      // Logged the same way refuseCrossSiteRequests is (F-82): the refusal is
      // correct either way, but an access-denied event with no log line is a
      // detection gap fundamentals.md's Logging section calls out by name.
      logSecurityEvent({
        event: "request_refused",
        reason: "role",
        path: new URL(request.url).pathname,
        role: user.role,
        ip: clientIp(request.headers),
      });
      throw data("Not Found", { status: 404 });
    }
    return next();
  };
}
