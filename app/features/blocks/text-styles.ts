import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { SiteLevel } from "#app/features/settings/site-level.ts";

/** Transaction meta for an edit that copies a style the block already has (Duplicate). */
export const KEEPS_STYLE = "keepsStyle";

/** Heading levels 5 and 6 are the Pro level's text styles (D166). */
const PRO_ONLY_FROM = 5;

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

/** The heading levels the Text style menu offers below Main heading. */
export function menuHeadingLevels(siteLevel: SiteLevel): number[] {
  return siteLevel === "pro" ? [2, 3, 4, 5, 6] : [2, 3, 4];
}

/**
 * Whether a block's current style is Pro-only on a Simple site: it shows
 * read-only, "Switch to Pro to change" (D172), while its text stays editable.
 */
export function isStyleLocked(siteLevel: SiteLevel, headingLevel: number): boolean {
  return siteLevel !== "pro" && headingLevel >= PRO_ONLY_FROM;
}

/**
 * The levels the editor's schema accepts. Always up to 6, whatever the site's
 * level, so a document made in Pro loads unchanged after switching down.
 */
export function schemaHeadingLevels(entryType: "post" | "page"): HeadingLevel[] {
  return entryType === "page" ? [1, 2, 3, 4, 5, 6] : [2, 3, 4, 5, 6];
}

/** Whether the text before a typed space is `#####` or `######`, Pro's heading shortcuts. */
export function isProHeadingShortcut(textBefore: string): boolean {
  return /^#{5,6}$/.test(textBefore);
}

/** How many Heading 5 and 6 blocks a document holds, each level counted on its own. */
function proHeadingCounts(doc: ProseMirrorNode): [number, number] {
  const counts: [number, number] = [0, 0];
  doc.descendants((node) => {
    if (node.type.name !== "heading") return;
    const level = node.attrs.level as number;
    if (level >= PRO_ONLY_FROM) counts[level - PRO_ONLY_FROM] += 1;
  });
  return counts;
}

/** How many Heading 5 and 6 blocks a document holds. */
export function countProHeadings(doc: ProseMirrorNode): number {
  const [five, six] = proHeadingCounts(doc);
  return five + six;
}

function countTextblocks(doc: ProseMirrorNode): number {
  let count = 0;
  doc.descendants((node) => {
    if (node.isTextblock) count += 1;
  });
  return count;
}

/**
 * Whether going from `before` to `after` makes or unmakes a Heading 5 or 6
 * without a block's worth of change to match: a shortcut that makes one, or
 * Ctrl+Alt+N turning one into another style. Typing in one, moving it, deleting
 * the block and splitting it with Enter (a block more, a heading more) all pass
 * (F-398, F-403).
 */
export function changesProHeadings(before: ProseMirrorNode, after: ProseMirrorNode): boolean {
  const was = proHeadingCounts(before);
  const now = proHeadingCounts(after);
  if (now[0] === was[0] && now[1] === was[1]) return false;
  const blocksAdded = countTextblocks(after) - countTextblocks(before);
  // A Pro style made, even as the other goes down (H5 to H6): only a new block pays for it.
  const made = Math.max(0, now[0] - was[0]) + Math.max(0, now[1] - was[1]);
  if (made > 0) return blocksAdded < made;
  return blocksAdded >= 0;
}
