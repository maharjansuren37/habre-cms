/** The sites domain with its port, e.g. `habre.page` or `localhost:3100`. */
export function sitesHost(sitesUrl: string): string {
  return new URL(sitesUrl).host;
}

/** A site's origin: the scheme and port come from `SITES_URL` (D153). */
export function siteOrigin(address: string, sitesUrl: string): string {
  const sites = new URL(sitesUrl);
  return `${sites.protocol}//${address}.${sites.host}`;
}
