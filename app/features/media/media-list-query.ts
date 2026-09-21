/**
 * The page a request for `/admin/media` asked for - read from the URL, the
 * same reasoning `post-list-query.ts` gives for posts (linkable, bookmarkable,
 * works with JavaScript off). No filter or search in this item - just a page.
 */
const MIN_PAGE = 1;
// Far past any page a few thousand media files at MEDIA_PAGE_SIZE could reach.
const MAX_PAGE = 1000;

export function parseMediaListPage(url: URL): number {
  const raw = Number(url.searchParams.get("page"));
  return Number.isInteger(raw) ? Math.min(Math.max(raw, MIN_PAGE), MAX_PAGE) : MIN_PAGE;
}
