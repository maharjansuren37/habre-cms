import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { kindName } from "./block-moves.ts";

const PLACEHOLDERS = { page: "Write your page…", post: "Write your post…" } as const;

/**
 * The editor's hint for an empty text block (item 14c1; editor only, never
 * saved). `parent` is the node holding `node`. A heading always names its
 * style; a paragraph sharing its column with other blocks says "Text" until
 * the cursor is in it; a paragraph alone in its column says the entry's
 * placeholder with the cursor in it and nothing without. A paragraph in a list
 * item or a quote has no hint. "" means no hint.
 */
export function emptyTextHint(
  node: ProseMirrorNode,
  parent: ProseMirrorNode,
  hasAnchor: boolean,
  entryType: "post" | "page",
): string {
  if (node.type.name === "heading") return kindName(node);
  if (node.type.name !== "paragraph") return "";
  if (parent.type.name !== "column") return "";
  if (hasAnchor) return PLACEHOLDERS[entryType];
  return parent.childCount > 1 ? "Text" : "";
}
