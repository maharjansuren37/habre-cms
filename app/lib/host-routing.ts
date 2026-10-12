import { isPlatformPath } from "./content-security-policy.ts";

const GET_OR_HEAD = new Set(["GET", "HEAD"]);

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

// A subdomain is one DNS label, as sites.subdomain's check requires (0010).
const LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

export type HostClassification =
  | { readonly kind: "allow" }
  | { readonly kind: "redirect"; readonly to: string }
  // foreignHost: outside both the platform host and the sites domain. Only
  // those are logged; a guessed name under the sites domain is a normal 404.
  // platformHost: the 404 is the platform's, so it is not in a site's look.
  | { readonly kind: "not-found"; readonly foreignHost: boolean; readonly platformHost?: true }
  | { readonly kind: "subdomain"; readonly label: string }
  | { readonly kind: "domain"; readonly host: string };

/**
 * Decides what a request is before any route runs (item 16a, D153). The
 * platform host serves the platform paths and redirects `/` to `/admin`;
 * `<label>.<sites host>` is a site looked up by subdomain; any other host is
 * a site looked up by own domain. A platform path on a site host redirects to
 * the platform for GET/HEAD and is not found otherwise, and `/healthz`
 * answers everywhere. Pure, so `app/root.tsx` supplies React Router's
 * normalized `url` (never `request.url`, which ends in `.data` on client-side
 * navigations) and the two origins from the environment.
 */
export function classifyHost(request: {
  method: string;
  pathname: string;
  search: string;
  requestHost: string;
  platformOrigin: string;
  sitesOrigin: string;
}): HostClassification {
  const { method, pathname, search, platformOrigin } = request;
  // URL.host is already lowercase, port included. A fully qualified name's
  // trailing dot is the same host, so it is dropped before the port.
  const rawHost = request.requestHost.toLowerCase();
  const host = rawHost.replace(/\.(?=:\d+$|$)/, "");
  const platformHost = new URL(platformOrigin).host;
  const sitesHost = new URL(request.sitesOrigin).host;
  const canRedirect = GET_OR_HEAD.has(method.toUpperCase());

  if (pathname === "/healthz") return { kind: "allow" };

  // Caddy's on-demand TLS check (item 21c): answered only to a local request,
  // and before any host is read as a site - in development the sites host is
  // `localhost` itself.
  if (pathname === "/_caddy/ask") {
    return canRedirect && LOOPBACK_HOSTS.has(host.replace(/:\d+$/, ""))
      ? { kind: "allow" }
      : { kind: "not-found", foreignHost: false };
  }

  if (host === platformHost) {
    // The platform is served only at its own host: a form posted from the
    // dotted one carries an Origin the cross-site check refuses (F-278).
    if (host !== rawHost) {
      return canRedirect
        ? { kind: "redirect", to: `${platformOrigin}${pathname}${search}` }
        : { kind: "not-found", foreignHost: false, platformHost: true };
    }
    // The one new public path here: the platform says it is not to be indexed.
    if (isPlatformPath(pathname) || pathname === "/robots.txt") return { kind: "allow" };
    if (pathname === "/" && canRedirect) return { kind: "redirect", to: "/admin" };
    return { kind: "not-found", foreignHost: false, platformHost: true };
  }

  const underSites = host.endsWith(`.${sitesHost}`);
  if (isPlatformPath(pathname)) {
    // Keeps D22: someone who types <address>.habre.page/admin lands on the platform.
    return canRedirect
      ? { kind: "redirect", to: `${platformOrigin}${pathname}${search}` }
      : { kind: "not-found", foreignHost: !underSites && host !== sitesHost };
  }

  if (host === sitesHost) return { kind: "not-found", foreignHost: false };
  if (underSites) {
    const label = host.slice(0, -sitesHost.length - 1);
    return LABEL.test(label)
      ? { kind: "subdomain", label }
      : { kind: "not-found", foreignHost: false };
  }
  // Matched on the full host, port included: production has no ports.
  return { kind: "domain", host };
}
