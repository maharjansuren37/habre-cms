import { closeHistory } from "@tiptap/pm/history";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { type EditorState, NodeSelection, Selection, type Transaction } from "@tiptap/pm/state";
import {
  columnsOf,
  describePosition,
  isUntouched,
  kindName,
  selectedBlock,
} from "./block-moves.ts";
import { MAX_DOCUMENT_BLOCKS } from "./document-nodes.ts";
import { countBlocks } from "./document-queries.ts";
import { newBlock, type PaletteKind, SECTION_TEMPLATE_NAMES } from "./palette-insert.ts";
import type { SectionTemplate } from "./section-templates.ts";

/**
 * Drops, duplicates and drop-target geometry for drag and drop (item 14b).
 * Pure ProseMirror and plain numbers, no React, so `node --test` runs it.
 */

/** An insertion point: before the column's child `index` (0 to its child count). All from 0. */
export type DropSlot = { section: number; column: number; index: number };
/**
 * An insertion point between top-level sections: before section `index`, from
 * 0 to the section count (the end). Used when a section tile is dragged.
 */
export type SectionSlot = { index: number };
/** What is dragged as a block: a new block from the palette, or the existing block starting at `pos`. */
export type BlockSource = { kind: PaletteKind } | { pos: number };
/** What is dragged: a block source, or a ready-made section template. */
export type DropSource = BlockSource | { template: SectionTemplate };
export type DropResult = { tr: Transaction; pos: number } | "in-place" | "full" | "invalid";

export type Rect = { left: number; top: number; right: number; bottom: number };
/** A column as measured on screen; `blocks` are its children's rects in order, gap excluded. */
export type MeasuredColumn = {
  section: number;
  column: number;
  rect: Rect;
  sectionRect: Rect;
  blocks: Rect[];
};

export const DRAG_CANCELLED = "Drag cancelled.";
export const GRIP_HINT = "Drag to move, or use Move up and Move down.";
export const CAP_SENTENCE = `You can have at most ${MAX_DOCUMENT_BLOCKS} blocks.`;

/** Select the landed block: a block selection for an atom, else the cursor at its start. */
function selectLanded(tr: Transaction, pos: number): void {
  const node = tr.doc.nodeAt(pos) as ProseMirrorNode;
  if (node.isAtom) {
    tr.setSelection(NodeSelection.create(tr.doc, pos));
    return;
  }
  tr.setSelection(
    Selection.findFrom(tr.doc.resolve(pos + 1), 1, true) ?? Selection.near(tr.doc.resolve(pos)),
  );
}

/**
 * The transaction dropping `source` at `slot`, as one undo step, with the
 * landed block selected and its position. "in-place" when the slot is beside
 * the moved block itself; "invalid" when the slot names no column or an index
 * outside 0 to the column's child count; "full" when it would take the
 * document over `maxBlocks` (a pure reorder never does). A column never
 * empties: a moved block's only column gets an empty paragraph, and a block
 * arriving in an untouched column replaces its paragraph.
 */
export function drop(
  state: EditorState,
  source: BlockSource,
  slot: DropSlot,
  maxBlocks: number = MAX_DOCUMENT_BLOCKS,
): DropResult {
  const { doc } = state;
  const columns = columnsOf(doc);
  const target = columns.find((c) => c.section === slot.section && c.column === slot.column);
  if (!target || slot.index < 0 || slot.index > target.node.childCount) return "invalid";

  let node: ProseMirrorNode;
  let from = -1;
  let leavesPlaceholder = false;
  if ("pos" in source) {
    from = source.pos;
    node = doc.nodeAt(from) as ProseMirrorNode;
    const $from = doc.resolve(from);
    const inOwnColumn = $from.index(0) === slot.section && $from.index(1) === slot.column;
    if (inOwnColumn && (slot.index === $from.index(2) || slot.index === $from.index(2) + 1)) {
      return "in-place";
    }
    leavesPlaceholder = $from.parent.childCount === 1;
  } else {
    node = newBlock(state.schema, source.kind).node;
  }

  const start = target.pos + 1;
  let insertAt = start;
  for (let i = 0; i < slot.index; i++) insertAt += target.node.child(i).nodeSize;
  const replaces = isUntouched(target.node);

  const before = countBlocks(doc);
  const after =
    before + ("pos" in source ? 0 : 1) + (leavesPlaceholder ? 1 : 0) - (replaces ? 1 : 0);
  if (after > before && after > maxBlocks) return "full";

  const tr = closeHistory(state.tr);
  if (replaces) tr.replaceWith(start, start + target.node.content.size, node);
  else tr.insert(insertAt, node);
  const newPos = replaces ? start : insertAt;
  if (from >= 0) {
    const steps = tr.steps.length;
    const mappedFrom = tr.mapping.map(from);
    if (leavesPlaceholder) {
      tr.replaceWith(mappedFrom, mappedFrom + node.nodeSize, state.schema.nodes.paragraph.create());
    } else {
      tr.delete(mappedFrom, mappedFrom + node.nodeSize);
    }
    const landedPos = tr.mapping.slice(steps).map(newPos, -1);
    selectLanded(tr, landedPos);
    return { tr: tr.scrollIntoView(), pos: landedPos };
  }
  selectLanded(tr, newPos);
  return { tr: tr.scrollIntoView(), pos: newPos };
}

/**
 * The transaction putting a fresh copy of the selected block just after it,
 * selected, as one undo step; null with no block selected or at `maxBlocks`.
 * A main heading's copy is demoted afterwards by `keepOneMainHeading`.
 */
export function duplicateBlock(
  state: EditorState,
  maxBlocks: number = MAX_DOCUMENT_BLOCKS,
): { tr: Transaction; pos: number } | null {
  const selected = selectedBlock(state);
  if (!selected || countBlocks(state.doc) >= maxBlocks) return null;
  const { node } = selected;
  const pos = selected.pos + node.nodeSize;
  const tr = closeHistory(state.tr);
  tr.insert(pos, node.type.create(node.attrs, node.content, node.marks));
  selectLanded(tr, pos);
  return { tr: tr.scrollIntoView(), pos };
}

function distanceTo(rect: Rect, x: number, y: number): number {
  const dx = Math.max(rect.left - x, 0, x - rect.right);
  const dy = Math.max(rect.top - y, 0, y - rect.bottom);
  return Math.hypot(dx, dy);
}

/**
 * The slot under the point, from measured rects: only columns of the section
 * the point is in; the nearest of them; then the midpoint rule - above a
 * block's vertical middle is before it, below is after. Null outside every
 * section.
 */
export function slotAt(columns: readonly MeasuredColumn[], x: number, y: number): DropSlot | null {
  let nearest: MeasuredColumn | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const column of columns) {
    const s = column.sectionRect;
    if (x < s.left || x > s.right || y < s.top || y > s.bottom) continue;
    const distance = distanceTo(column.rect, x, y);
    if (distance < nearestDistance) {
      nearest = column;
      nearestDistance = distance;
    }
  }
  if (!nearest) return null;
  const index = nearest.blocks.filter((b) => (b.top + b.bottom) / 2 < y).length;
  return { section: nearest.section, column: nearest.column, index };
}

/** The dragged block's announced name: "Image", "Main heading". */
export function dragName(state: EditorState, source: BlockSource): string {
  const node =
    "pos" in source
      ? (state.doc.nodeAt(source.pos) as ProseMirrorNode)
      : newBlock(state.schema, source.kind).node;
  return kindName(node);
}

/** The gap's label: "Drop image here". */
export function dropZoneLabel(state: EditorState, source: BlockSource): string {
  return `Drop ${dragName(state, source).toLowerCase()} here`;
}

/** What the status says while the pointer is over `slot` (null: over no column). */
export function hoverAnnouncement(
  state: EditorState,
  source: BlockSource,
  slot: DropSlot | null,
  maxBlocks: number = MAX_DOCUMENT_BLOCKS,
): string {
  const name = dragName(state, source);
  if (!slot) return `${name}: release to cancel.`;
  const result = drop(state, source, slot, maxBlocks);
  if (result === "invalid") return `${name}: release to cancel.`;
  if (result === "in-place") return `${name}: drop here to leave it in place.`;
  if (result === "full") return CAP_SENTENCE;
  return `${name}: drop at ${describePosition(result.tr.doc, result.pos)}.`;
}

/** "Image added: block 1 of 2 in column 2 of section 1." - `doc` is after the drop. */
export function dropAnnouncement(
  state: EditorState,
  source: BlockSource,
  doc: ProseMirrorNode,
  pos: number,
): string {
  const verb = "pos" in source ? "moved" : "added";
  return `${dragName(state, source)} ${verb}: ${describePosition(doc, pos)}.`;
}

/** "Heading duplicated: block 2 of 3 in section 1." - `pos` is where the copy starts in `doc`. */
export function duplicateAnnouncement(
  node: ProseMirrorNode,
  doc: ProseMirrorNode,
  pos: number,
): string {
  return `${kindName(node)} duplicated: ${describePosition(doc, pos)}.`;
}

/**
 * The section slot under the point, from the top-level sections' measured
 * rects in document order: null outside `area`, else the number of sections
 * whose vertical middle is above the point.
 */
export function sectionSlotAt(
  sections: readonly Rect[],
  area: Rect,
  x: number,
  y: number,
): SectionSlot | null {
  if (x < area.left || x > area.right || y < area.top || y > area.bottom) return null;
  return { index: sections.filter((s) => (s.top + s.bottom) / 2 < y).length };
}

/** The gap's label while a section tile is dragged: "Drop hero here". */
export function sectionDropZoneLabel(kind: SectionTemplate): string {
  return `Drop ${SECTION_TEMPLATE_NAMES[kind].toLowerCase()} here`;
}

/** What the status says while a section tile is over `slot`; `total` counts sections before the drop. */
export function sectionHoverAnnouncement(
  kind: SectionTemplate,
  slot: SectionSlot | null,
  total: number,
): string {
  const name = SECTION_TEMPLATE_NAMES[kind];
  if (!slot) return `${name}: release to cancel.`;
  return `${name}: drop as section ${slot.index + 1} of ${total + 1}.`;
}
