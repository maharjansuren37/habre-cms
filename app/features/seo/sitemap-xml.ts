/** The protocol's limit on one sitemap file (sitemaps.org). */
export const MAX_SITEMAP_URLS = 50000;

export type SitemapUrl = { path: string; lastmod: Date };

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * The sitemap document for one site (item 17): every url at `mainOrigin`, in the
 * order given, cut to the first 50,000. `lastmod` is the date in UTC. Pure, so it
 * is unit-tested without a database.
 */
export function buildSitemapXml(mainOrigin: string, urls: SitemapUrl[]): string {
  const items = urls
    .slice(0, MAX_SITEMAP_URLS)
    .map(
      (u) =>
        `<url><loc>${escapeXml(`${mainOrigin}${u.path}`)}</loc><lastmod>${u.lastmod.toISOString().slice(0, 10)}</lastmod></url>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items ? `\n${items}\n` : ""}</urlset>\n`;
}
