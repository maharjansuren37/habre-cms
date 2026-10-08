// How big a post to Build my site may be. The description is at most 2,000
// characters; at four bytes each, percent-encoded, that is 24 KB, so 32 KB leaves
// room for the other field. It bounds what one authenticated request can make the
// server buffer (F-382, the F-01 rule).
export const MAX_ABOUT_BODY_BYTES = 32 * 1024;

/** Whether a post's declared size is small enough to read. A missing Content-Length is refused. */
export function isAboutBodyAllowed(headers: Headers): boolean {
  const declared = Number(headers.get("Content-Length"));
  return Number.isFinite(declared) && declared > 0 && declared <= MAX_ABOUT_BODY_BYTES;
}
