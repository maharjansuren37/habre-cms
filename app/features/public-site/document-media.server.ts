import type { Document, DocumentMedia } from "#app/features/blocks/document-nodes.ts";
import { findMediaByIds } from "#app/features/media/media.server.ts";
import { buildMediaUrl } from "#app/features/media/media-url.ts";
import { env } from "#app/lib/env.server.ts";
import { documentMediaIds } from "./document-media-ids.ts";

/**
 * What the renderer needs for the images a document holds: one query for all
 * of them, and only the document's own ids (F-108). An id whose row was
 * deleted is simply absent - the renderer then draws nothing for it.
 */
export async function resolveDocumentMedia(
  siteId: string,
  document: Document,
): Promise<Record<string, DocumentMedia>> {
  const rows = await findMediaByIds(siteId, documentMediaIds(document));
  return Object.fromEntries(
    rows.map((row) => [
      row.id,
      {
        url: buildMediaUrl(env.R2_PUBLIC_URL, row.storageKey),
        altText: row.altText,
        width: row.width,
        height: row.height,
      },
    ]),
  );
}
