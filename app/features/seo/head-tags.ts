import { publicLayoutData, publicTitle } from "#app/features/public-site/public-title.ts";

type Matches = Parameters<typeof publicTitle>[0];

/**
 * The `meta` of every public leaf route (item 17): the browser title and a
 * canonical link to the page's own path on the site's main address (D173).
 * `path` is built from the route's slug param, never from `location`, so a request
 * on another host or with a query still names one address. With no layout data
 * there is no main origin, so no canonical link.
 */
export function publicMeta(matches: Matches, page: { title?: string; path: string }) {
  const tags: Array<Record<string, string>> = [{ title: publicTitle(matches, page.title) }];
  const mainOrigin = publicLayoutData(matches)?.mainOrigin;
  if (mainOrigin)
    tags.push({ tagName: "link", rel: "canonical", href: `${mainOrigin}${page.path}` });
  return tags;
}
