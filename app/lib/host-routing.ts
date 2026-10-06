import { isPlatformPath } from "./content-security-policy.ts";

const GET_OR_HEAD = new Set(["GET", "HEAD"]);

export type HostRoutingDecision =
  | { readonly kind: "allow" }
  | { readonly kind: "redirect"; readonly to: string }
  | { readonly kind: "not-found" };

/**
 * Decides what to do with a request before any route runs (D22): an admin
 * path reached on the public host redirects to the admin host and vice
 * versa, `/` on the admin host redirects to `/admin`, only GET/HEAD redirect
 * (anything else on the wrong host is refused), `/healthz` answers on both,
 * and a host matching neither gets refused. Pure and host-value-only so it is
 * testable without a `Request` or the environment - `app/root.tsx` supplies
 * both from React Router's normalized `url` (never the raw `request.url`,
 * which ends in `.data` on client-side navigations) and
 * `env.SITES_URL`/`env.PLATFORM_URL`.
 */
export function resolveHostRouting(request: {
  method: string;
  pathname: string;
  search: string;
  requestHost: string;
  publicHost: string;
  adminHost: string;
  publicOrigin: string;
  adminOrigin: string;
}): HostRoutingDecision {
  const {
    method,
    pathname,
    search,
    requestHost,
    publicHost,
    adminHost,
    publicOrigin,
    adminOrigin,
  } = request;

  // Development and any single-host test server: one origin, nothing to route.
  if (publicHost === adminHost) return { kind: "allow" };
  if (pathname === "/healthz") return { kind: "allow" };

  const canRedirect = GET_OR_HEAD.has(method.toUpperCase());

  if (requestHost === adminHost) {
    if (pathname === "/") {
      return canRedirect ? { kind: "redirect", to: "/admin" } : { kind: "not-found" };
    }
    if (isPlatformPath(pathname)) return { kind: "allow" };
    return canRedirect
      ? { kind: "redirect", to: `${publicOrigin}${pathname}${search}` }
      : { kind: "not-found" };
  }

  if (requestHost === publicHost) {
    if (isPlatformPath(pathname)) {
      return canRedirect
        ? { kind: "redirect", to: `${adminOrigin}${pathname}${search}` }
        : { kind: "not-found" };
    }
    return { kind: "allow" };
  }

  // Neither hostname: only Caddy reaches this app, and it forwards only these two.
  return { kind: "not-found" };
}

// A subdomain is one DNS label, as sites.subdomain's check requires (0010).
const LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

export type HostClassification =
  | { readonly kind: "allow" }
  | { readonly kind: "redirect"; readonly to: string }
  // foreignHost: outside both the platform host and the sites domain. Only
  // those are logged; a guessed name under the sites domain is a normal 404.
  | { readonly kind: "not-found"; readonly foreignHost: boolean }
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
  // URL.host is already lowercase, port included.
  const host = request.requestHost.toLowerCase();
  const platformHost = new URL(platformOrigin).host;
  const sitesHost = new URL(request.sitesOrigin).host;
  const canRedirect = GET_OR_HEAD.has(method.toUpperCase());

  if (pathname === "/healthz") return { kind: "allow" };

  if (host === platformHost) {
    if (isPlatformPath(pathname)) return { kind: "allow" };
    if (pathname === "/" && canRedirect) return { kind: "redirect", to: "/admin" };
    return { kind: "not-found", foreignHost: false };
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
