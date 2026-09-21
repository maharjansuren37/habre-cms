/**
 * The one place a media id's storage key becomes a URL a browser can load -
 * never stored, always resolved at read time (plan: "the URL is resolved at
 * render time, so a bucket or domain change never touches content"). Both the
 * editor's image block (5b) and the public renderer (5c) call this, not a
 * copy of it.
 */
export function buildMediaUrl(publicUrl: string, storageKey: string): string {
  return `${publicUrl}/${storageKey}`;
}
