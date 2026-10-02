import { blocksOf, type Document } from "#app/features/blocks/document-nodes.ts";

/** Each media id a document's image blocks point at, once, in document order -
 *  the only ids a public page may look up (F-108). */
export function documentMediaIds(document: Document): string[] {
  const ids = blocksOf(document).flatMap((block) =>
    block.type === "image" ? [block.attrs.mediaId] : [],
  );
  return [...new Set(ids)];
}
