import { closeHistory } from "@tiptap/pm/history";
import type { Node as ProseMirrorNode, Schema } from "@tiptap/pm/model";
import {
  type EditorState,
  NodeSelection,
  Selection,
  TextSelection,
  type Transaction,
} from "@tiptap/pm/state";

/** The palette's tiles, in the order it shows them. */
export const PALETTE_KINDS = [
  "text",
  "heading",
  "list",
  "image",
  "button",
  "quote",
  "line",
  "space",
] as const;
export type PaletteKind = (typeof PALETTE_KINDS)[number];

/** A new block of this kind, as the palette adds it, and whether the cursor goes in it. */
function newBlock(schema: Schema, kind: PaletteKind): { node: ProseMirrorNode; isText: boolean } {
  const { nodes } = schema;
  switch (kind) {
    case "text":
      return { node: nodes.paragraph.create(), isText: true };
    case "heading":
      return { node: nodes.heading.create({ level: 2 }), isText: true };
    case "list":
      return {
        node: nodes.bulletList.create(null, nodes.listItem.create(null, nodes.paragraph.create())),
        isText: true,
      };
    case "quote":
      return {
        node: nodes.blockquote.create(null, nodes.paragraph.create()),
        isText: true,
      };
    case "image":
      return { node: nodes.image.create({ mediaId: "" }), isText: false };
    case "button":
      return { node: nodes.button.create({ label: "", href: "", style: "filled" }), isText: false };
    case "line":
      return { node: nodes.horizontalRule.create(), isText: false };
    case "space":
      return { node: nodes.space.create(), isText: false };
  }
}

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

/**
 * Where a new block goes: just after the column's direct child holding the
 * selection (the whole list or quote, never inside it), or after the selected
 * block itself. With no column around the selection, after the first block.
 */
export function insertionPoint(doc: ProseMirrorNode, selection: Selection): number {
  if (selection instanceof NodeSelection && selection.$from.parent.type.name === "column") {
    return selection.to;
  }
  const $head = selection.$head;
  for (let depth = $head.depth; depth > 0; depth--) {
    if ($head.node(depth - 1).type.name === "column") return $head.after(depth);
  }
  // Doc > section > column > first block.
  return 2 + doc.child(0).child(0).child(0).nodeSize;
}

/**
 * The transaction that adds one block of `kind`, as its own undo step: a text
 * block gets the cursor, anything else becomes the selected block. Null when
 * the document is already at the cap.
 */
export function insertBlock(
  state: EditorState,
  kind: PaletteKind,
  maxBlocks: number,
): Transaction | null {
  if (countBlocks(state.doc) >= maxBlocks) return null;
  const tr = closeHistory(state.tr);
  const at = insertionPoint(state.doc, state.selection);
  const { node, isText } = newBlock(state.schema, kind);
  tr.insert(at, node);
  if (isText) {
    const inside = Selection.findFrom(tr.doc.resolve(at + 1), 1, true);
    tr.setSelection(
      inside instanceof TextSelection ? inside : TextSelection.near(tr.doc.resolve(at + 1)),
    );
  } else {
    tr.setSelection(NodeSelection.create(tr.doc, at));
  }
  return tr.scrollIntoView();
}
