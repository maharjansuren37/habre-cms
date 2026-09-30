import type { Section } from "./blocks.ts";

/**
 * Kept apart from `blocks.ts` on purpose: that module builds Zod schemas when it
 * is imported, and Zod's code generation is blocked by the site's content
 * security policy. The public renderer is bundled for the browser and needs only
 * this, so it imports nothing that runs Zod (`import type` is erased).
 */
/** The sections with something to show - an empty one renders nothing publicly. */
export function nonEmptySections(sections: Section[]): Section[] {
  return sections.filter((section) => section.data.children.some((column) => column.length > 0));
}

/**
 * A section's columns at a new count. Growing adds empty columns on the right;
 * shrinking appends every removed column's items to the end of the last kept
 * one, in column order, so changing the count never discards content. Generic
 * so it serves stored blocks and whatever the editor reads back.
 */
export function resizeColumns<T>(columns: T[][], count: number): T[][] {
  if (count < 1) throw new RangeError("a section needs at least one column");
  const kept = columns.slice(0, count).map((column) => [...column]);
  const lastKept = kept[kept.length - 1];
  if (lastKept) for (const extra of columns.slice(count)) lastKept.push(...extra);
  while (kept.length < count) kept.push([]);
  return kept;
}
