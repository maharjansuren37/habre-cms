import { redirect } from "react-router";

/**
 * What a redirect to the media library is announcing. Its own module, not a
 * reuse of content's `banner.ts` (F-65's lesson does not apply backwards) -
 * a different route and a different verb set ("uploaded"/"deleted", never
 * "published").
 */
export type MediaBannerVerb = "uploaded" | "deleted";

// Matches filenameSchema's own cap (media-input.ts) - a crafted link can
// supply any value here, so it is bounded to what a real filename could ever
// be, matching content's F-57 fix.
const MAX_BANNER_FILENAME_LENGTH = 255;

export type MediaBanner = { verb: MediaBannerVerb; filename: string } | null;

export function readMediaBanner(params: URLSearchParams): MediaBanner {
  for (const verb of ["uploaded", "deleted"] as const) {
    const filename = params.get(verb);
    if (filename !== null) return { verb, filename: filename.slice(0, MAX_BANNER_FILENAME_LENGTH) };
  }
  return null;
}

export function mediaBannerRedirect(verb: MediaBannerVerb, filename: string): Response {
  return redirect(`/admin/media?${verb}=${encodeURIComponent(filename)}`);
}
