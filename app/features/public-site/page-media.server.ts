import type { Block } from "#app/features/blocks/blocks.ts";
import { collectImageMediaIds, type ImageMediaSummary } from "#app/features/blocks/blocks.ts";
import { findMediaByIds } from "#app/features/media/media.server.ts";
import { buildMediaUrl } from "#app/features/media/media-url.ts";
import { env } from "#app/lib/env.server.ts";

/**
 * One query for every image block a page has - an id with no row (the file
 * was deleted after being placed) simply renders nothing, not an error.
 * Shared by `/:slug` and `/` when it shows a page (item 9), so the two cannot
 * resolve a page's images differently.
 */
export async function resolvePageMedia(
  blocks: Block[],
): Promise<Record<string, ImageMediaSummary>> {
  const rows = await findMediaByIds(collectImageMediaIds(blocks));
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
