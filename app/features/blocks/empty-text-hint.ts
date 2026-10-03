import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { kindName } from "./block-moves.ts";

const PLACEHOLDERS = { page: "Write your page…", post: "Write your post…" } as const;

/**
 * The editor's hint for an empty text block (item 14c1; editor only, never
 * saved). `parent` is the node holding `node`. A heading always names its
 * style; a paragraph sharing its column with other blocks says "Text" until
 * the cursor is in it; every other empty paragraph says the entry's
 * placeholder with the cursor in it and nothing without. "" means no hint.
 */
export function emptyTextHint(
  node: ProseMirrorNode,
  parent: ProseMirrorNode,
  hasAnchor: boolean,
  entryType: "post" | "page",
): string {
  if (node.type.name === "heading") return kindName(node);
  if (node.type.name !== "paragraph") return "";
  if (hasAnchor) return PLACEHOLDERS[entryType];
  return parent.type.name === "column" && parent.childCount > 1 ? "Text" : "";
}
