import { createContext } from "react-router";

export type PublicSite = { id: string; subdomain: string };

/**
 * The site a public request is for, set by root middleware on every site-host
 * request and never on the platform host (item 16a, D153). No default: a
 * public loader that finds it unset is a routing bug, not a visitor error, so
 * it throws. Items 17 and 19 read it. Never put it in loader data - public
 * pages carry no site id (public-site.1).
 */
export const siteContext = createContext<PublicSite>();
