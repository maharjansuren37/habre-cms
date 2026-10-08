const PREVIEW_HOME = "/admin/preview";

/** Where a link in the site's content should go when the page is shown in the
 *  admin's preview (item 18b4b). The site's own pages stay inside the preview,
 *  so a click never leaves it for a platform 404; any other path on the site
 *  goes to the live site; everything else (external, `mailto:`, `#top`, `//host`)
 *  is left alone. Pure, so it is unit-tested without a browser. */
export function previewHref(
  href: string,
  {
    pageSlugs,
    homeSlug,
    siteOrigin,
  }: { pageSlugs: ReadonlySet<string>; homeSlug: string | null; siteOrigin: string },
): string {
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  const end = href.search(/[?#]/);
  const path = end === -1 ? href : href.slice(0, end);
  const rest = end === -1 ? "" : href.slice(end);
  if (path === "/") return PREVIEW_HOME + rest;
  const slug = path.slice(1);
  if (slug === homeSlug) return PREVIEW_HOME + rest;
  if (pageSlugs.has(slug)) return `${PREVIEW_HOME}/${slug}${rest}`;
  return siteOrigin + href;
}
