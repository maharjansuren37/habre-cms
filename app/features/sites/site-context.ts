import { createContext } from "react-router";

/** `ownDomain` is the site's earliest-verified own domain (ties by name), or null. */
export type PublicSite = { id: string; subdomain: string; ownDomain: string | null };

/** What root middleware sets: the site and its main origin (item 17, D173). */
export type PublicSiteContext = PublicSite & { mainOrigin: string };

/**
 * The site a public request is for, set by root middleware on every site-host
 * request and never on the platform host (item 16a, D153). No default: a
 * public loader that finds it unset is a routing bug, not a visitor error, so
 * it throws. Items 17 and 19 read it. Never put it in loader data - public
 * pages carry no site id (public-site.1).
 */
export const siteContext = createContext<PublicSiteContext>();

/**
 * The request's own origin, set by root middleware only when the request
 * resolved to a site (item 19a). Null on the platform host, so the cross-site
 * check knows which rule applies without `siteContext`'s throw.
 */
export const siteOriginContext = createContext<string | null>(null);
