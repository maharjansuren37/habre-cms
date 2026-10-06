import { publicLayoutData, publicTitle } from "#app/features/public-site/public-title.ts";

type Matches = Parameters<typeof publicTitle>[0];

type PageHead = {
  /** The page's own title; the site title alone when absent (`/`). */
  title?: string;
  /** The page's own path, from its route, never from `location`. */
  path: string;
  /** The entry's search title; replaces the browser title and og:title. */
  seoTitle?: string;
  /** The entry's own description; `""` or absent means none. */
  description?: string;
  /** The share image's absolute URL; no fallback - the logo is the wrong shape. */
  imageUrl?: string | null;
  type?: "article" | "website";
  /** Only `/` and `/posts` fall back to the site description (item 17). */
  siteDescriptionFallback?: boolean;
};

/**
 * The `meta` of every public leaf route (item 17): the browser title, a
 * canonical link to the page's own path on the site's main address (D173), a
 * description, Open Graph and Twitter tags. `path` is built from the route's
 * slug param, never from `location`, so a request on another host or with a
 * query still names one address. With no layout data there is no main origin,
 * so only the title. Empty values are never emitted as content.
 */
export function publicMeta(matches: Matches, page: PageHead) {
  const layout = publicLayoutData(matches);
  const tags: Array<Record<string, string>> = [
    { title: page.seoTitle || publicTitle(matches, page.title) },
  ];
  if (!layout) return tags;
  const url = `${layout.mainOrigin}${page.path}`;
  const description =
    page.description || (page.siteDescriptionFallback ? layout.siteDescription : "");
  tags.push({ tagName: "link", rel: "canonical", href: url });
  if (description) tags.push({ name: "description", content: description });
  tags.push({
    property: "og:title",
    content: page.seoTitle || page.title || layout.settings.siteTitle,
  });
  if (description) tags.push({ property: "og:description", content: description });
  tags.push(
    { property: "og:url", content: url },
    { property: "og:site_name", content: layout.settings.siteTitle },
    { property: "og:type", content: page.type ?? "website" },
  );
  if (page.imageUrl) tags.push({ property: "og:image", content: page.imageUrl });
  tags.push({ name: "twitter:card", content: page.imageUrl ? "summary_large_image" : "summary" });
  return tags;
}
