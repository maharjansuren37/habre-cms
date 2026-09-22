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

/**
 * Clamps a requested page to the last real one - the same bug F-56 and F-75
 * already found twice in the list screens, closed here before the picker
 * (`media-picker.ts`) becomes a third instance. A page past the end returns
 * the last real page's data, never an empty result.
 */
export function clampToLastPage(page: number, totalPages: number): number {
  return Math.min(page, totalPages);
}
