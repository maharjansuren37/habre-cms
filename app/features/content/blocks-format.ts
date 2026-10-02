import { BLOCKS_FORMAT_V4 } from "#app/features/blocks/document.ts";
import type { EntryType } from "./slug.ts";

/**
 * The formats this build can read, and so may overwrite, for an entry type:
 * only the document (`v4`, item 14a1) - migration 0009 removed every v2 and v3
 * row and the check refuses them. Kept per type so a later format can widen one.
 */
export function readableFormats(_type: EntryType): string[] {
  return [BLOCKS_FORMAT_V4];
}

/**
 * Refuses an entry stored in a block format this build does not read (F-37).
 * Loading one anyway would hand the editor a shape it misreads, and saving it
 * back would overwrite the writer's content with that misreading - so this fails
 * loudly, naming the entry, instead.
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
