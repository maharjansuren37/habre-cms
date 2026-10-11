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

// The one state-changing path a site host accepts: a visitor's contact form
// (item 19a, D157). Matched exactly, so `/_contact/x` is refused.
const SITE_POST_PATH = "/_contact";

/**
 * The same check for a request that resolved to a site. `siteOrigin` is the
 * request's own origin - the site was found from this host - so a page on
 * another site, or the platform, cannot post into this one. Only
 * `POST /_contact` may change anything; every other state-changing request on
 * a site host is refused, because the site has no other form.
 */
export function isAllowedSiteRequest(
  method: string,
  pathname: string,
  headers: Headers,
  siteOrigin: string,
): boolean {
  if (SAFE_METHODS.has(method.toUpperCase())) return true;
  if (method.toUpperCase() !== "POST" || pathname !== SITE_POST_PATH) return false;
  return isAllowedRequest(method, headers, siteOrigin);
}
