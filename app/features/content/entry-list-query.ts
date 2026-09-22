/**
 * The filter, search and page a request for an entry list (`/admin/posts` or
 * `/admin/pages`) asked for - read from the URL, so the list stays linkable
 * and bookmarkable and works with JavaScript off (D10). Untrusted input,
 * bounded by name rather than hoped about (D27's rule, applied here too): a
 * value outside what the list can show falls back to something it can, rather
 * than reaching the database as-is.
 */

const STATUSES = ["all", "draft", "published"] as const;
export type EntryStatus = (typeof STATUSES)[number];

// Matches the title's own cap (entry-input.ts) - a search term cannot mean
// more than a title could ever hold.
const MAX_QUERY_LENGTH = 200;
const MIN_PAGE = 1;
// Far past any page a few thousand entries at 20 a page could reach; a bound
// so a crafted `?page=` cannot ask the database to skip an absurd offset.
const MAX_PAGE = 1000;

export type EntryListQuery = { status: EntryStatus; q: string; page: number };

function isEntryStatus(value: string): value is EntryStatus {
  return (STATUSES as readonly string[]).includes(value);
}

export function parseEntryListQuery(url: URL): EntryListQuery {
  const rawStatus = url.searchParams.get("status") ?? "all";
  const status = isEntryStatus(rawStatus) ? rawStatus : "all";

  const q = (url.searchParams.get("q") ?? "").trim().slice(0, MAX_QUERY_LENGTH);

  const rawPage = Number(url.searchParams.get("page"));
  const page = Number.isInteger(rawPage)
    ? Math.min(Math.max(rawPage, MIN_PAGE), MAX_PAGE)
    : MIN_PAGE;

  return { status, q, page };
}
