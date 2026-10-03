import { randomUUID } from "node:crypto";

/**
 * The R2 object key - generated, never derived from the client's filename, so
 * it needs no sanitizing and cannot collide with an existing upload. The
 * extension comes from the *detected* image type (media-input.ts), never the
 * client's own filename. The site's id is the first path segment, so one site's
 * objects never share a prefix with another's.
 */
export function generateStorageKey(siteId: string, extension: string): string {
  return `sites/${siteId}/${randomUUID()}.${extension}`;
}
