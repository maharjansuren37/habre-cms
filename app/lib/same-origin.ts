// Requests that read and never change anything. Everything else must come from
// this app's own pages.
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Cross-site request forgery check, on top of the SameSite=Lax cookie: a
 * state-changing request is allowed only when the browser says it came from
 * `appOrigin` (e.g. `https://cms.example.org`, no trailing slash). Browsers
 * send `Origin` on every POST; `Sec-Fetch-Site` covers any that do not. With
 * neither header, the request is refused - default closed.
 */
export function isAllowedRequest(method: string, headers: Headers, appOrigin: string): boolean {
  if (SAFE_METHODS.has(method.toUpperCase())) return true;

  const origin = headers.get("Origin");
  if (origin !== null) return origin === appOrigin;

  return headers.get("Sec-Fetch-Site") === "same-origin";
}
