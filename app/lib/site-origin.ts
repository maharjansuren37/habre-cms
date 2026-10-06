/** The sites domain with its port, e.g. `habre.page` or `localhost:3100`. */
export function sitesHost(sitesUrl: string): string {
  return new URL(sitesUrl).host;
}

/** A site's origin: the scheme and port come from `SITES_URL` (D153). */
export function siteOrigin(address: string, sitesUrl: string): string {
  const sites = new URL(sitesUrl);
  return `${sites.protocol}//${address}.${sites.host}`;
}

type MainAddressSite = { subdomain: string; ownDomain: string | null };

/**
 * A site's one main address (D173): its earliest-verified own domain where the
 * deployment serves sites over https - own domains are served only over HTTPS -
 * else its subdomain. Host only, port included, like `sitesHost`.
 */
export function mainHost(site: MainAddressSite, sitesUrl: string): string {
  const sites = new URL(sitesUrl);
  if (sites.protocol === "https:" && site.ownDomain) return site.ownDomain;
  return `${site.subdomain}.${sites.host}`;
}

/** The main address with a scheme: the sites URL's, for the canonical link and the sitemap. */
export function mainOrigin(site: MainAddressSite, sitesUrl: string): string {
  return `${new URL(sitesUrl).protocol}//${mainHost(site, sitesUrl)}`;
}
