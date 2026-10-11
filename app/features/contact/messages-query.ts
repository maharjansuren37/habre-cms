/**
 * The page a request for `/admin/messages` asked for - read from the URL, the
 * same way `media-list-query.ts` does (linkable, works with JavaScript off).
 */
const MIN_PAGE = 1;
// Far past any page a site's contact messages at MESSAGES_PAGE_SIZE could reach.
const MAX_PAGE = 1000;

export function parseMessagesPage(url: URL): number {
  const raw = Number(url.searchParams.get("page"));
  return Number.isInteger(raw) ? Math.min(Math.max(raw, MIN_PAGE), MAX_PAGE) : MIN_PAGE;
}
