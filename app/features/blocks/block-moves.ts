import { closeHistory } from "@tiptap/pm/history";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import {
  type EditorState,
  NodeSelection,
  Selection,
  TextSelection,
  type Transaction,
} from "@tiptap/pm/state";
import { MAX_DOCUMENT_BLOCKS } from "./document-nodes.ts";
import { countBlocks } from "./document-queries.ts";

/**
 * Moving, deleting and announcing blocks (item 14a3). Pure ProseMirror, no
 * React, so `node --test` runs it. Reading order is sections top to bottom,
 * columns left to right, blocks top to bottom; a move goes to the next slot in
 * that order, and 14b's drops use `describePosition` for the same wording.
 */

/** The toolbar's names for a block's kind. */
export type BlockKind =
  | "text"
  | "heading"
  | "list"
  | "quote"
  | "image"
  | "button"
  | "line"
  | "space";
export type Direction = "up" | "down";

/** `section`, `column` and `index` count from 0; announcements add 1. */
export type SelectedBlock = {
  pos: number;
  node: ProseMirrorNode;
  kind: BlockKind;
  section: number;
  column: number;
  index: number;
};

const KINDS: Readonly<Record<string, BlockKind>> = {
  paragraph: "text",
  heading: "heading",
  bulletList: "list",
  orderedList: "list",
  blockquote: "quote",
  image: "image",
  button: "button",
  horizontalRule: "line",
  space: "space",
};

/** The toolbar's name for a block's kind: "list" for either list, and so on. */
export function blockKind(node: ProseMirrorNode): BlockKind {
  return KINDS[node.type.name] ?? "text";
}

/**
 * The column's direct child holding the selection - the whole list or quote,
 * never a part of it. A selected block is itself; a range across blocks uses
 * the block holding its head. A gap cursor (its parent is the column) has none.
 */
export function selectedBlock(state: EditorState): SelectedBlock | null {
  const { doc, selection } = state;
  let pos: number;
  if (selection instanceof NodeSelection && selection.$from.parent.type.name === "column") {
    pos = selection.from;
  } else {
    const $head = selection.$head;
    if ($head.parent.type.name === "column") return null;
    let found = -1;
    for (let depth = $head.depth; depth > 0; depth--) {
      if ($head.node(depth - 1).type.name === "column") {
        found = $head.before(depth);
        break;
      }
    }
    if (found < 0) return null;
    pos = found;
  }
  const $pos = doc.resolve(pos);
  const node = $pos.nodeAfter;
  if (!node || $pos.parent.type.name !== "column") return null;
  return {
    pos,
    node,
    kind: KINDS[node.type.name] ?? "text",
    section: $pos.index(0),
    column: $pos.index(1),
    index: $pos.index(2),
  };
}

type ColumnSlot = { pos: number; node: ProseMirrorNode; section: number; column: number };

/** Every column in reading order, `pos` being the position before the column. */
export function columnsOf(doc: ProseMirrorNode): ColumnSlot[] {
  const columns: ColumnSlot[] = [];
  doc.forEach((section, sectionOffset, sectionIndex) => {
    section.forEach((column, columnOffset, columnIndex) => {
      columns.push({
        pos: sectionOffset + 1 + columnOffset,
        node: column,
        section: sectionIndex,
        column: columnIndex,
      });
    });
  });
  return columns;
}

/** An untouched column: exactly one empty paragraph, the placeholder rule's blank. */
export function isUntouched(column: ProseMirrorNode): boolean {
  return (
    column.childCount === 1 &&
    column.child(0).type.name === "paragraph" &&
    column.child(0).content.size === 0
  );
}

/** Selection inside the block at `newPos`, at the offsets it had inside the block at `oldPos`. */
function selectionInBlock(
  tr: Transaction,
  old: Selection,
  oldPos: number,
  oldSize: number,
  newPos: number,
): Selection {
  if (old instanceof NodeSelection) return NodeSelection.create(tr.doc, newPos);
  const head = old.head - oldPos;
  const rawAnchor = old.anchor - oldPos;
  const anchor = rawAnchor >= 0 && rawAnchor <= oldSize ? rawAnchor : head;
  return TextSelection.create(tr.doc, newPos + anchor, newPos + head);
}

/**
 * The transaction moving the selected block one slot up or down in reading
 * order, as one undo step, or null at the document's ends, with no block
 * selected, or when it would take the document over `maxBlocks`. A column never
 * empties: its only block leaving is replaced by an empty paragraph, and a block
 * arriving in an untouched column replaces that paragraph.
 */
export function moveBlock(
  state: EditorState,
  direction: Direction,
  maxBlocks: number = MAX_DOCUMENT_BLOCKS,
): Transaction | null {
  const selected = selectedBlock(state);
  if (!selected) return null;
  const { doc } = state;
  const { pos, node, index } = selected;
  const columns = columnsOf(doc);
  const at = columns.findIndex(
    (c) => c.section === selected.section && c.column === selected.column,
  );
  const own = columns[at];

  let insertAt: number;
  let replace: [number, number] | null = null;
  if (direction === "down" && index < own.node.childCount - 1) {
    insertAt = pos + node.nodeSize + own.node.child(index + 1).nodeSize;
  } else if (direction === "up" && index > 0) {
    insertAt = pos - own.node.child(index - 1).nodeSize;
  } else {
    const target = columns[at + (direction === "down" ? 1 : -1)];
    if (!target) return null;
    const start = target.pos + 1;
    if (isUntouched(target.node)) replace = [start, start + target.node.content.size];
    insertAt = direction === "down" ? start : start + target.node.content.size;
  }

  const leavesPlaceholder = own.node.childCount === 1;
  const before = countBlocks(doc);
  const after = before + (leavesPlaceholder ? 1 : 0) - (replace ? 1 : 0);
  if (after > before && after > maxBlocks) return null;

  const tr = closeHistory(state.tr);
  if (replace) tr.replaceWith(replace[0], replace[1], node);
  else tr.insert(insertAt, node);
  const newPos = replace ? replace[0] : insertAt;
  const steps = tr.steps.length;
  const from = tr.mapping.map(pos);
  if (leavesPlaceholder)
    tr.replaceWith(from, from + node.nodeSize, state.schema.nodes.paragraph.create());
  else tr.delete(from, from + node.nodeSize);
  const landed = tr.mapping.slice(steps).map(newPos, -1);
  tr.setSelection(selectionInBlock(tr, state.selection, pos, node.nodeSize, landed));
  return tr.scrollIntoView();
}

/** Carry a position through the swap of two adjacent sections starting at `lowStart`. */
function swapMap(lowStart: number, lowSize: number, highSize: number) {
  return (pos: number) => {
    if (pos < lowStart || pos > lowStart + lowSize + highSize) return pos;
    return pos < lowStart + lowSize ? pos + highSize : pos - lowSize;
  };
}

/** The transaction moving section `index` one place up or down, or null at the ends. */
export function moveSection(
  state: EditorState,
  index: number,
  direction: Direction,
): Transaction | null {
  const { doc } = state;
  const other = direction === "down" ? index + 1 : index - 1;
  if (index < 0 || index >= doc.childCount || other < 0 || other >= doc.childCount) return null;
  const low = Math.min(index, other);
  let lowStart = 0;
  for (let i = 0; i < low; i++) lowStart += doc.child(i).nodeSize;
  const lowNode = doc.child(low);
  const highNode = doc.child(low + 1);
  const tr = closeHistory(state.tr);
  tr.replaceWith(lowStart, lowStart + lowNode.nodeSize + highNode.nodeSize, [highNode, lowNode]);
  const map = swapMap(lowStart, lowNode.nodeSize, highNode.nodeSize);
  const { selection } = state;
  if (selection instanceof NodeSelection) {
    tr.setSelection(NodeSelection.create(tr.doc, map(selection.from)));
  } else if (selection instanceof TextSelection) {
    tr.setSelection(TextSelection.create(tr.doc, map(selection.anchor), map(selection.head)));
  } else {
    tr.setSelection(Selection.near(tr.doc.resolve(map(selection.head))));
  }
  return tr.scrollIntoView();
}

/**
 * The transaction removing the selected block, as one undo step. A column's
 * only block leaves an empty paragraph; the selection lands in the block that
 * took its place (the one before it when the last went).
 */
export function deleteBlock(state: EditorState): Transaction | null {
  const selected = selectedBlock(state);
  if (!selected) return null;
  const { pos, node, section, column, index } = selected;
  const tr = closeHistory(state.tr);
  const columnNode = columnsOf(state.doc).find((c) => c.section === section && c.column === column)
    ?.node as ProseMirrorNode;
  if (columnNode.childCount === 1) {
    tr.replaceWith(pos, pos + node.nodeSize, state.schema.nodes.paragraph.create());
    tr.setSelection(TextSelection.create(tr.doc, pos + 1));
    return tr.scrollIntoView();
  }
  tr.delete(pos, pos + node.nodeSize);
  const $column = tr.doc.resolve(pos);
  const targetIndex = Math.min(index, $column.parent.childCount - 1);
  let targetPos = $column.start();
  for (let i = 0; i < targetIndex; i++) targetPos += $column.parent.child(i).nodeSize;
  const target = tr.doc.nodeAt(targetPos) as ProseMirrorNode;
  if (target.isAtom) tr.setSelection(NodeSelection.create(tr.doc, targetPos));
  else {
    tr.setSelection(
      Selection.findFrom(tr.doc.resolve(targetPos + 1), 1, true) ??
        Selection.near(tr.doc.resolve(targetPos)),
    );
  }
  return tr.scrollIntoView();
}

/** The announcement's name for a block: "Main heading" for a level-1 heading, and so on. */
export function kindName(node: ProseMirrorNode): string {
  switch (KINDS[node.type.name]) {
    case "heading":
      return (
        { 1: "Main heading", 3: "Subheading", 4: "Small heading" }[node.attrs.level as 1 | 3 | 4] ??
        "Heading"
      );
    case "list":
      return "List";
    case "quote":
      return "Quote";
    case "image":
      return "Image";
    case "button":
      return "Button";
    case "line":
      return "Line";
    case "space":
      return "Space";
    default:
      return "Text";
  }
}

/**
 * Where the block starting at `pos` sits, in words: "block 1 of 2 in column 2
 * of section 1" - "column N of" left out when its section has one column.
 */
export function describePosition(doc: ProseMirrorNode, pos: number): string {
  const $pos = doc.resolve(pos);
  const columns = $pos.node(1).childCount;
  const where = columns > 1 ? `column ${$pos.index(1) + 1} of section` : "section";
  return `block ${$pos.index(2) + 1} of ${$pos.parent.childCount} in ${where} ${$pos.index(0) + 1}`;
}

/** "Heading moved down: block 1 of 2 in column 2 of section 1." - `pos` is where the block now starts. */
export function moveAnnouncement(
  node: ProseMirrorNode,
  direction: Direction,
  doc: ProseMirrorNode,
  pos: number,
): string {
  return `${kindName(node)} moved ${direction}: ${describePosition(doc, pos)}.`;
}

/** "Section moved down: now section 2 of 3." - `newIndex` counts from 0. */
export function sectionMoveAnnouncement(
  direction: Direction,
  newIndex: number,
  total: number,
): string {
  return `Section moved ${direction}: now section ${newIndex + 1} of ${total}.`;
}

/** "Heading deleted." */
export function deleteAnnouncement(node: ProseMirrorNode): string {
  return `${kindName(node)} deleted.`;
}

/**
 * The one-main-heading guard, for `appendTransaction`. A post allows no level-1
 * heading: every one becomes level 2. A page allows one: when the new document
 * holds several, the one that was already the main heading keeps it and the
 * rest become level 2, so a paste or a typed `# ` never displaces it. "Already
 * the main heading" is node identity: ProseMirror shares unchanged nodes
 * between states, so a level-1 heading that is the same object in the old
 * document is the old one. With none such (no earlier main heading), the first
 * in reading order stays. When the menu demoted the old one in the same
 * transaction only one level-1 heading remains and nothing is returned.
 */
export function keepOneMainHeading(
  oldState: EditorState,
  newState: EditorState,
  entryType: "page" | "post",
): Transaction | null {
  const mains = (doc: ProseMirrorNode) => {
    const found: { pos: number; node: ProseMirrorNode }[] = [];
    doc.descendants((node, pos) => {
      if (node.type.name === "heading" && node.attrs.level === 1) found.push({ pos, node });
      return node.type.name !== "paragraph";
    });
    return found;
  };
  const current = mains(newState.doc);
  let demote = current;
  if (entryType === "page") {
    if (current.length <= 1) return null;
    const earlier = new Set(mains(oldState.doc).map((h) => h.node));
    const keep = current.find((h) => earlier.has(h.node)) ?? current[0];
    demote = current.filter((h) => h !== keep);
  } else if (current.length === 0) {
    return null;
  }
  const tr = newState.tr;
  for (const { pos, node } of demote) tr.setNodeMarkup(pos, undefined, { ...node.attrs, level: 2 });
  return tr;
}

/** A heading's text as the menu's hint and the announcement quote it: cut to 40 characters with "…". */
export function shortQuote(text: string): string {
  return text.length > 40 ? `${text.slice(0, 40)}…` : text;
}

/** "\"Welcome\" is now a Heading." */
export function mainHeadingAnnouncement(demoted: ProseMirrorNode): string {
  return `"${shortQuote(demoted.textContent)}" is now a Heading.`;
}

/**
 * Makes the selected text or heading the page's main heading, in one
 * transaction and one undo step: the previous main heading becomes a Heading.
 * Returns that previous heading for the announcement, or null with none.
 */
export function setMainHeading(
  state: EditorState,
): { tr: Transaction; demoted: ProseMirrorNode | null } | null {
  const selected = selectedBlock(state);
  if (!selected || (selected.kind !== "text" && selected.kind !== "heading")) return null;
  const tr = closeHistory(state.tr);
  let demoted: ProseMirrorNode | null = null;
  state.doc.descendants((node, pos) => {
    if (node.type.name === "heading" && node.attrs.level === 1 && pos !== selected.pos) {
      tr.setNodeMarkup(pos, undefined, { ...node.attrs, level: 2 });
      demoted = node;
    }
    return node.type.name !== "paragraph" && node.type.name !== "heading";
  });
  tr.setNodeMarkup(selected.pos, state.schema.nodes.heading, { level: 1 });
  return { tr, demoted };
}
