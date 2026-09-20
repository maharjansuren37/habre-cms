import { BLOCKS_FORMAT } from "#app/features/blocks/blocks.ts";

/**
 * Refuses an entry stored in a block format this build does not read (F-37).
 * Loading one anyway would hand the editor a shape it misreads, and saving it
 * back would overwrite the writer's content with that misreading - so this fails
 * loudly, naming the entry, instead.
 */
export function assertKnownFormat(entryId: string, format: string): void {
  if (format === BLOCKS_FORMAT) return;
  throw new Error(
    `Entry ${entryId} is stored in block format "${format}", but this build reads only "${BLOCKS_FORMAT}".`,
  );
}
