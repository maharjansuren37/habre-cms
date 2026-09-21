import { randomUUID } from "node:crypto";

/**
 * The R2 object key - generated, never derived from the client's filename, so
 * it needs no sanitizing and cannot collide with an existing upload. The
 * extension comes from the *detected* image type (media-input.ts), never the
 * client's own filename.
 */
export function generateStorageKey(extension: string): string {
  return `${randomUUID()}.${extension}`;
}
