import { isRouteErrorResponse } from "react-router";

const ROUTINE_REFUSAL_STATUSES = new Set([404, 405]);

/**
 * True for the 404s and 405s React Router generates itself - a URL no route
 * matches, a POST to a route with no action. Bots probing for WordPress and
 * `.git` send thousands of these, and logging each one with a stack trace
 * buried the real errors in the journal (F-114). Caddy's access log still
 * records them. The router wraps its own message in an `Error` on the
 * response's `error` field; a 404 thrown by app code with `data()` has none.
 */
export function isRoutineRefusal(error: unknown): boolean {
  if (!isRouteErrorResponse(error)) return false;
  if (!ROUTINE_REFUSAL_STATUSES.has(error.status)) return false;
  return "error" in error && error.error instanceof Error;
}
