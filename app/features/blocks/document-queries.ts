import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

/** How many blocks the document holds: the children of every column (a list or quote is one). */
export function countBlocks(doc: ProseMirrorNode): number {
  let count = 0;
  doc.descendants((node) => {
    if (node.type.name === "column") {
      count += node.childCount;
      return false;
    }
    return true;
  });
  return count;
}

/** The page's main heading (level 1), or null. */
export function mainHeading(doc: ProseMirrorNode): ProseMirrorNode | null {
  let found: ProseMirrorNode | null = null;
  doc.descendants((node) => {
    if (found) return false;
    if (node.type.name === "heading" && node.attrs.level === 1) found = node;
    return node.type.name !== "paragraph" && node.type.name !== "heading";
  });
  return found;
}
