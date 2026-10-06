import { listSitemapEntries } from "#app/features/content/entries.server.ts";
import { siteContext } from "#app/features/sites/site-context.ts";
import type { Route } from "./+types/sitemap";
import { buildSitemapXml, type SitemapUrl } from "./sitemap-xml.ts";

/**
 * A site's published pages and posts at its main address (item 17). Order: `/`
 * (only for a published home page, never also at its own slug), `/posts` (only
 * once a post is published; dated by the newest post), pages by slug, posts
 * newest first.
 */
export async function loader({ context }: Route.LoaderArgs) {
  const site = context.get(siteContext);
  const rows = await listSitemapEntries(site.id);
  const urls: SitemapUrl[] = [];
  const home = rows.find((r) => r.type === "page" && r.isHomePage);
  if (home) urls.push({ path: "/", lastmod: home.updatedAt });
  const posts = rows.filter((r) => r.type === "post");
  const newestPost = posts.reduce<Date | null>(
    (newest, r) => (newest && newest > r.updatedAt ? newest : r.updatedAt),
    null,
  );
  if (newestPost) urls.push({ path: "/posts", lastmod: newestPost });
  for (const r of rows.filter((r) => r.type === "page" && !r.isHomePage).sort(bySlug)) {
    urls.push({ path: `/${r.slug}`, lastmod: r.updatedAt });
  }
  for (const r of posts) urls.push({ path: `/posts/${r.slug}`, lastmod: r.updatedAt });
  return new Response(buildSitemapXml(site.mainOrigin, urls), {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}

function bySlug(a: { slug: string }, b: { slug: string }): number {
  return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
}
