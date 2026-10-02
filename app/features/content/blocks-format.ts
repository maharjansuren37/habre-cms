import { BLOCKS_FORMAT, PAGE_BLOCKS_FORMAT } from "#app/features/blocks/blocks.ts";
import { BLOCKS_FORMAT_V4 } from "#app/features/blocks/document.ts";
import type { EntryType } from "./slug.ts";

/** The formats this build can read, and so may overwrite, for an entry type. */
export function readableFormats(type: EntryType): string[] {
  return type === "page"
    ? [BLOCKS_FORMAT, PAGE_BLOCKS_FORMAT, BLOCKS_FORMAT_V4]
    : [BLOCKS_FORMAT, BLOCKS_FORMAT_V4];
}

/**
 * Refuses an entry stored in a block format this build does not read (F-37).
 * Loading one anyway would hand the editor a shape it misreads, and saving it
 * back would overwrite the writer's content with that misreading - so this fails
 * loudly, naming the entry, instead.
 *
 * A page reads `v2` (not yet re-saved), `v3` (sections) or `v4` (one document,
 * item 14a1); a post `v2` or `v4` - a post never held v3's sections, so a `v3`
 * post is a corrupt row, not a new format.
 */
export function assertKnownFormat(entryId: string, type: EntryType, format: string): void {
  const known = readableFormats(type);
  if (known.includes(format)) return;
  throw new Error(
    `Entry ${entryId} is stored in block format "${format}", but this build reads only ${known
      .map((each) => `"${each}"`)
      .join(" or ")} for a ${type}.`,
  );
}
