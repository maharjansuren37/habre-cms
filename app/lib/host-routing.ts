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
