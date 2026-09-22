import { redirect } from "react-router";

/**
 * What a redirect to an entry list is announcing. The `?deleted=` shape
 * delete introduced, reused by publish and unpublish rather than each
 * inventing its own (design.md).
 */
export type BannerVerb = "deleted" | "published" | "unpublished";

// Matches the title's own cap (entry-input.ts, the entries.title check
// constraint) - a crafted link can supply any value here, so it is capped to
// what a real title could ever be, not left open-ended (F-57).
const MAX_BANNER_TITLE_LENGTH = 200;

export type Banner = { verb: BannerVerb; title: string } | null;

/** The entry list a redirect lands on - grows by one member each time a
 *  later item adds another list (F-81). */
export type EntryListPath = "/admin/posts" | "/admin/pages";

/**
 * Reads the announcement off a redirect to the posts list, if there is one.
 * Untrusted: this is a URL query param a link can set to anything, so the
 * title is truncated rather than trusted at whatever length it arrives.
 */
export function readBanner(params: URLSearchParams): Banner {
  for (const verb of ["deleted", "published", "unpublished"] as const) {
    const title = params.get(verb);
    if (title !== null) return { verb, title: title.slice(0, MAX_BANNER_TITLE_LENGTH) };
  }
  return null;
}

/**
 * The one place this redirect is built (F-65: it was written out three times
 * across two files - delete, publish, unpublish - all for the same reason and
 * needing to change together, which is exactly the case fundamentals.md's
 * "extract on the third" is for). `target` is the list this entry belongs to
 * (`/admin/posts` or `/admin/pages`), so the same builder serves both (item 6a).
 */
export function bannerRedirect(verb: BannerVerb, title: string, target: EntryListPath): Response {
  return redirect(`${target}?${verb}=${encodeURIComponent(title)}`);
}
