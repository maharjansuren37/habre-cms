import assert from "node:assert/strict";
import { test } from "node:test";
import { history, undo } from "@tiptap/pm/history";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Schema } from "@tiptap/pm/model";
import { EditorState, NodeSelection, TextSelection } from "@tiptap/pm/state";
import {
  CAP_SENTENCE,
  DRAG_CANCELLED,
  type DropResult,
  type DropSlot,
  type DropSource,
  dragName,
  drop,
  dropAnnouncement,
  dropZoneLabel,
  duplicateAnnouncement,
  duplicateBlock,
  GRIP_HINT,
  hoverAnnouncement,
  type MeasuredColumn,
  type Rect,
  slotAt,
} from "./block-drops.ts";
import { keepOneMainHeading, selectedBlock } from "./block-moves.ts";

const schema = new Schema({
  nodes: {
    doc: { content: "section+" },
    section: { content: "column{1,3}" },
    column: { content: "block+" },
    paragraph: { group: "block", content: "text*" },
    heading: { group: "block", content: "text*", attrs: { level: { default: 2 } } },
    bulletList: { group: "block", content: "listItem+" },
    orderedList: { group: "block", content: "listItem+" },
    listItem: { content: "paragraph" },
    blockquote: { group: "block", content: "paragraph+" },
    image: { group: "block", atom: true, attrs: { mediaId: { default: "" } } },
    button: {
      group: "block",
      atom: true,
      attrs: { label: { default: "" }, href: { default: "" }, style: { default: "filled" } },
    },
    horizontalRule: { group: "block", atom: true },
    space: { group: "block", atom: true },
    text: {},
  },
});
const n = schema.nodes;

const p = (text = "") => n.paragraph.create(null, text ? schema.text(text) : undefined);
const h = (level: number, text: string) => n.heading.create({ level }, schema.text(text));
const col = (...blocks: ProseMirrorNode[]) => n.column.create(null, blocks);
const sec = (...cols: ProseMirrorNode[]) => n.section.create(null, cols);
const docOf = (...sections: ProseMirrorNode[]) => n.doc.create(null, sections);

/** Each section as an array of columns, each column an array of block labels (text or type name). */
function shape(doc: ProseMirrorNode): string[][][] {
  const out: string[][][] = [];
  doc.forEach((s) => {
    const cols: string[][] = [];
    s.forEach((c) => {
      const blocks: string[] = [];
      c.forEach((b) => {
        blocks.push(b.textContent || `<${b.type.name}>`);
      });
      cols.push(blocks);
    });
    out.push(cols);
  });
  return out;
}

/** The cursor `offset` characters into the first text node equal to `text`. */
function cursorIn(doc: ProseMirrorNode, text: string, offset = 1, plugins = false) {
  let found = -1;
  doc.descendants((node, pos) => {
    if (found < 0 && node.isText && node.text === text) found = pos;
  });
  assert.ok(found >= 0, `no text ${text}`);
  return EditorState.create({
    doc,
    selection: TextSelection.create(doc, found + offset),
    plugins: plugins ? [history()] : [],
  });
}

function nodeSelect(doc: ProseMirrorNode, type: string, plugins = false) {
  let found = -1;
  doc.descendants((node, pos) => {
    if (found < 0 && node.type.name === type) found = pos;
  });
  return EditorState.create({
    doc,
    selection: NodeSelection.create(doc, found),
    plugins: plugins ? [history()] : [],
  });
}

// [[A, B] | [C]] + [[D]]
const base = () => docOf(sec(col(p("A"), p("B")), col(p("C"))), sec(col(p("D"))));

/** Where the block with this text (or of this type) starts. */
function posOf(doc: ProseMirrorNode, label: string): number {
  let found = -1;
  doc.descendants((node, pos) => {
    if (found >= 0) return false;
    if (node.type.name === "column") {
      node.forEach((child, offset) => {
        if (found < 0 && (child.textContent === label || child.type.name === label)) {
          found = pos + 1 + offset;
        }
      });
      return false;
    }
    return true;
  });
  assert.ok(found >= 0, `no block ${label}`);
  return found;
}

const slot = (section: number, column: number, index: number): DropSlot => ({
  section,
  column,
  index,
});

function landed(result: DropResult) {
  assert.ok(typeof result === "object", `expected a drop, got ${String(result)}`);
  return result;
}

/** Applies a drop and returns the new state and where the block landed. */
function dropAndApply(state: EditorState, source: DropSource, at: DropSlot, max?: number) {
  const result = landed(drop(state, source, at, max));
  return { next: state.apply(result.tr), pos: result.pos, result };
}

function undoOnce(state: EditorState): EditorState {
  let undone = state;
  undo(state, (tr) => {
    undone = state.apply(tr);
  });
  return undone;
}

const rect = (left: number, top: number, right: number, bottom: number): Rect => ({
  left,
  top,
  right,
  bottom,
});

// ---- drop: tiles

test("a tile dropped between two blocks lands there", () => {
  const state = cursorIn(base(), "A");
  const { next } = dropAndApply(state, { kind: "line" }, slot(0, 0, 1));
  assert.deepEqual(shape(next.doc), [[["A", "<horizontalRule>", "B"], ["C"]], [["D"]]]);
});

test("a tile dropped at a column's top lands first", () => {
  const state = cursorIn(base(), "A");
  const { next } = dropAndApply(state, { kind: "line" }, slot(0, 0, 0));
  assert.deepEqual(shape(next.doc), [[["<horizontalRule>", "A", "B"], ["C"]], [["D"]]]);
});

test("a tile dropped at a column's bottom lands last", () => {
  const state = cursorIn(base(), "A");
  const { next } = dropAndApply(state, { kind: "line" }, slot(0, 1, 1));
  assert.deepEqual(shape(next.doc), [
    [
      ["A", "B"],
      ["C", "<horizontalRule>"],
    ],
    [["D"]],
  ]);
});

test("a tile dropped into an untouched column replaces its paragraph at any index", () => {
  for (const index of [0, 1]) {
    const doc = docOf(sec(col(p("A")), col(p())));
    const { next } = dropAndApply(cursorIn(doc, "A"), { kind: "image" }, slot(0, 1, index));
    assert.deepEqual(shape(next.doc), [[["A"], ["<image>"]]], `index ${index}`);
  }
});

test("a dropped list arrives whole", () => {
  const doc = docOf(
    sec(
      col(p("A")),
      col(
        n.bulletList.create(null, [
          n.listItem.create(null, p("x")),
          n.listItem.create(null, p("y")),
        ]),
      ),
    ),
  );
  const state = cursorIn(doc, "x");
  const { next } = dropAndApply(state, { pos: selectedBlock(state)?.pos as number }, slot(0, 0, 1));
  assert.deepEqual(shape(next.doc), [[["A", "xy"], ["<paragraph>"]]]);
  assert.equal(next.doc.child(0).child(0).child(1).type.name, "bulletList");
  assert.equal(next.doc.child(0).child(0).child(1).childCount, 2);
});

// ---- drop: moves

test("a block dropped into another column leaves its old column intact", () => {
  const state = cursorIn(base(), "A");
  const { next } = dropAndApply(state, { pos: posOf(state.doc, "A") }, slot(0, 1, 1));
  assert.deepEqual(shape(next.doc), [[["B"], ["C", "A"]], [["D"]]]);
});

test("a block dropped into another section lands there", () => {
  const state = cursorIn(base(), "B");
  const { next } = dropAndApply(state, { pos: posOf(state.doc, "B") }, slot(1, 0, 0));
  assert.deepEqual(shape(next.doc), [[["A"], ["C"]], [["B", "D"]]]);
});

test("a column left empty by a drop keeps an empty paragraph", () => {
  const state = cursorIn(base(), "C");
  const { next } = dropAndApply(state, { pos: posOf(state.doc, "C") }, slot(1, 0, 1));
  assert.deepEqual(shape(next.doc), [[["A", "B"], ["<paragraph>"]], [["D", "C"]]]);
});

test("a block dropped later in its own column lands there", () => {
  const doc = docOf(sec(col(p("A"), p("B"), p("C"))));
  const state = cursorIn(doc, "A");
  const { next } = dropAndApply(state, { pos: posOf(doc, "A") }, slot(0, 0, 3));
  assert.deepEqual(shape(next.doc), [[["B", "C", "A"]]]);
  const mid = dropAndApply(state, { pos: posOf(doc, "A") }, slot(0, 0, 2));
  assert.deepEqual(shape(mid.next.doc), [[["B", "A", "C"]]]);
});

test("a block dropped earlier in its own column lands there", () => {
  const doc = docOf(sec(col(p("A"), p("B"), p("C"))));
  const state = cursorIn(doc, "C");
  const { next } = dropAndApply(state, { pos: posOf(doc, "C") }, slot(0, 0, 0));
  assert.deepEqual(shape(next.doc), [[["C", "A", "B"]]]);
});

test("the two slots beside the block itself change nothing", () => {
  const doc = docOf(sec(col(p("A"), p("B"), p("C"))));
  const state = cursorIn(doc, "B");
  assert.ok(
    drop(state, { pos: posOf(doc, "B") }, slot(0, 0, 1)) === "in-place",
    "expected in-place",
  );
  assert.ok(
    drop(state, { pos: posOf(doc, "B") }, slot(0, 0, 2)) === "in-place",
    "expected in-place",
  );
});

test("a block's only place in its column is in-place", () => {
  const doc = docOf(sec(col(p("A"))));
  const state = cursorIn(doc, "A");
  assert.ok(
    drop(state, { pos: posOf(doc, "A") }, slot(0, 0, 0)) === "in-place",
    "expected in-place",
  );
  assert.ok(
    drop(state, { pos: posOf(doc, "A") }, slot(0, 0, 1)) === "in-place",
    "expected in-place",
  );
});

// ---- drop: the cap

test("a tile is refused at the cap", () => {
  const state = cursorIn(base(), "A");
  assert.ok(drop(state, { kind: "line" }, slot(0, 0, 0), 4) === "full", "expected full");
});

test("a move that would leave a placeholder is refused at the cap", () => {
  const state = cursorIn(base(), "C");
  assert.ok(
    drop(state, { pos: posOf(state.doc, "C") }, slot(1, 0, 1), 4) === "full",
    "expected full",
  );
});

test("a pure reorder still drops at the cap", () => {
  const state = cursorIn(base(), "A");
  const { next } = dropAndApply(state, { pos: posOf(state.doc, "A") }, slot(0, 1, 1), 4);
  assert.deepEqual(shape(next.doc), [[["B"], ["C", "A"]], [["D"]]]);
});

test("a tile into an untouched column is allowed at the cap, as it adds no block", () => {
  const doc = docOf(sec(col(p("A")), col(p())));
  const { next } = dropAndApply(cursorIn(doc, "A"), { kind: "line" }, slot(0, 1, 0), 2);
  assert.deepEqual(shape(next.doc), [[["A"], ["<horizontalRule>"]]]);
});

// ---- drop: headings, selection, undo

test("a dropped main heading stays level 1 through keepOneMainHeading", () => {
  const doc = docOf(sec(col(h(1, "Title"), p("A")), col(p("C"))));
  const state = cursorIn(doc, "Title");
  const { next } = dropAndApply(state, { pos: posOf(doc, "Title") }, slot(0, 1, 1));
  assert.equal(keepOneMainHeading(state, next, "page"), null);
  const landedNode = next.doc.child(0).child(1).child(1);
  assert.equal(landedNode.attrs.level, 1);
});

test("a dropped atom is selected as a block", () => {
  const state = cursorIn(base(), "A");
  const { next, pos } = dropAndApply(state, { kind: "image" }, slot(0, 1, 0));
  assert.ok(next.selection instanceof NodeSelection);
  assert.equal(next.selection.from, pos);
  assert.equal(next.doc.nodeAt(pos)?.type.name, "image");
});

test("a dropped text block gets the cursor at its start", () => {
  const state = cursorIn(base(), "A");
  const { next, pos } = dropAndApply(state, { pos: posOf(state.doc, "B") }, slot(0, 1, 0));
  assert.ok(next.selection instanceof TextSelection);
  assert.equal(next.selection.from, pos + 1);
  assert.equal(next.doc.nodeAt(pos)?.textContent, "B");
});

test("one undo reverses a whole drop", () => {
  const state = cursorIn(base(), "A", 1, true);
  const { next } = dropAndApply(state, { pos: posOf(state.doc, "A") }, slot(1, 0, 1));
  assert.notDeepEqual(shape(next.doc), shape(state.doc));
  assert.deepEqual(shape(undoOnce(next).doc), shape(state.doc));
});

test("one undo reverses a dropped tile", () => {
  const state = cursorIn(base(), "A", 1, true);
  const { next } = dropAndApply(state, { kind: "image" }, slot(0, 1, 0));
  assert.deepEqual(shape(undoOnce(next).doc), shape(state.doc));
});

// ---- duplicate

test("Duplicate puts a copy just after the block and selects it", () => {
  const state = cursorIn(base(), "A");
  const result = duplicateBlock(state);
  assert.ok(result);
  const next = state.apply(result.tr);
  assert.deepEqual(shape(next.doc), [[["A", "A", "B"], ["C"]], [["D"]]]);
  assert.equal(
    result.pos,
    posOf(state.doc, "A") + state.doc.nodeAt(posOf(state.doc, "A"))!.nodeSize,
  );
  assert.ok(next.selection instanceof TextSelection);
  assert.equal(next.selection.from, result.pos + 1);
});

test("Duplicate of an atom selects the copy", () => {
  const doc = docOf(sec(col(p("A"), n.horizontalRule.create(), p("B"))));
  const state = nodeSelect(doc, "horizontalRule");
  const result = duplicateBlock(state);
  assert.ok(result);
  const next = state.apply(result.tr);
  assert.deepEqual(shape(next.doc), [[["A", "<horizontalRule>", "<horizontalRule>", "B"]]]);
  assert.ok(next.selection instanceof NodeSelection);
  assert.equal(next.selection.from, result.pos);
});

test("a main heading's copy becomes a Heading and the original stays the main heading", () => {
  const doc = docOf(sec(col(h(1, "Title"), p("A"))));
  const state = cursorIn(doc, "Title");
  const result = duplicateBlock(state);
  assert.ok(result);
  const mid = state.apply(result.tr);
  const fix = keepOneMainHeading(state, mid, "page");
  assert.ok(fix);
  const next = mid.apply(fix);
  const column = next.doc.child(0).child(0);
  assert.equal(column.child(0).attrs.level, 1);
  assert.equal(column.child(1).attrs.level, 2);
  assert.equal(column.child(1).textContent, "Title");
});

test("Duplicate at the cap does nothing", () => {
  assert.equal(duplicateBlock(cursorIn(base(), "A"), 4), null);
});

test("Duplicate with no block selected does nothing", () => {
  const doc = base();
  const state = EditorState.create({ doc, selection: NodeSelection.create(doc, 0) });
  assert.equal(duplicateBlock(state), null);
});

test("one undo reverses a Duplicate", () => {
  const state = cursorIn(base(), "A", 1, true);
  const result = duplicateBlock(state);
  assert.ok(result);
  assert.deepEqual(shape(undoOnce(state.apply(result.tr)).doc), shape(state.doc));
});

// ---- slotAt

const section0 = rect(0, 0, 400, 300);
const wide: MeasuredColumn = {
  section: 0,
  column: 0,
  rect: rect(10, 10, 390, 290),
  sectionRect: section0,
  blocks: [rect(10, 10, 390, 50), rect(10, 60, 390, 100)],
};

test("slotAt: above a block's midpoint is before it, below is after", () => {
  assert.deepEqual(slotAt([wide], 100, 20), slot(0, 0, 0));
  assert.deepEqual(slotAt([wide], 100, 40), slot(0, 0, 1));
  assert.deepEqual(slotAt([wide], 100, 80), slot(0, 0, 1));
  assert.deepEqual(slotAt([wide], 100, 85), slot(0, 0, 2));
});

test("slotAt: between two side-by-side columns picks the nearer", () => {
  const left: MeasuredColumn = {
    section: 0,
    column: 0,
    rect: rect(10, 10, 190, 290),
    sectionRect: section0,
    blocks: [rect(10, 10, 190, 50)],
  };
  const right: MeasuredColumn = {
    section: 0,
    column: 1,
    rect: rect(210, 10, 390, 290),
    sectionRect: section0,
    blocks: [rect(210, 10, 390, 50)],
  };
  assert.deepEqual(slotAt([left, right], 195, 100), slot(0, 0, 1));
  assert.deepEqual(slotAt([left, right], 205, 100), slot(0, 1, 1));
});

test("slotAt: stacked columns pick the one the point is in", () => {
  const top: MeasuredColumn = {
    section: 0,
    column: 0,
    rect: rect(10, 10, 390, 140),
    sectionRect: section0,
    blocks: [rect(10, 10, 390, 50)],
  };
  const bottom: MeasuredColumn = {
    section: 0,
    column: 1,
    rect: rect(10, 150, 390, 290),
    sectionRect: section0,
    blocks: [rect(10, 150, 390, 190)],
  };
  assert.deepEqual(slotAt([top, bottom], 100, 160), slot(0, 1, 0));
  assert.deepEqual(slotAt([top, bottom], 100, 120), slot(0, 0, 1));
});

test("slotAt: a section's padding drops at its column's top or bottom", () => {
  assert.deepEqual(slotAt([wide], 100, 3), slot(0, 0, 0));
  assert.deepEqual(slotAt([wide], 100, 297), slot(0, 0, 2));
  assert.deepEqual(slotAt([wide], 2, 297), slot(0, 0, 2));
});

test("slotAt: outside every section is no slot", () => {
  assert.equal(slotAt([wide], 100, 400), null);
  assert.equal(slotAt([wide], 500, 100), null);
  assert.equal(slotAt([], 1, 1), null);
});

test("slotAt: only the section the point is in is considered", () => {
  const next: MeasuredColumn = {
    section: 1,
    column: 0,
    rect: rect(10, 310, 390, 400),
    sectionRect: rect(0, 300, 400, 410),
    blocks: [rect(10, 310, 390, 350)],
  };
  assert.deepEqual(slotAt([wide, next], 100, 305), slot(1, 0, 0));
  assert.deepEqual(slotAt([wide, next], 100, 295), slot(0, 0, 2));
});

// ---- announcements

const three = () => docOf(sec(col(p("A"), p("B")), col(p("C")), col(p("D"))));

test("dragName and dropZoneLabel name the dragged kind", () => {
  const state = cursorIn(docOf(sec(col(h(1, "Title"), p("A")))), "A");
  assert.equal(dragName(state, { kind: "image" }), "Image");
  assert.equal(dragName(state, { kind: "heading" }), "Heading");
  assert.equal(dragName(state, { pos: posOf(state.doc, "Title") }), "Main heading");
  assert.equal(dropZoneLabel(state, { kind: "image" }), "Drop image here");
  assert.equal(dropZoneLabel(state, { pos: posOf(state.doc, "Title") }), "Drop main heading here");
  assert.equal(dropZoneLabel(state, { kind: "text" }), "Drop text here");
});

test("hover over a place says where the block would be, with three columns", () => {
  const state = cursorIn(three(), "A");
  assert.equal(
    hoverAnnouncement(state, { kind: "image" }, slot(0, 1, 0)),
    "Image: drop at block 1 of 2 in column 2 of section 1.",
  );
});

test("hover over a place says where the block would be, with one column", () => {
  const doc = docOf(sec(col(p("A"), p("B"))));
  const state = cursorIn(doc, "A");
  assert.equal(
    hoverAnnouncement(state, { kind: "image" }, slot(0, 0, 2)),
    "Image: drop at block 3 of 3 in section 1.",
  );
});

test("hover describes a move as the block will be once dropped", () => {
  const doc = docOf(sec(col(p("A"), p("B"), p("C"))));
  const state = cursorIn(doc, "A");
  assert.equal(
    hoverAnnouncement(state, { pos: posOf(doc, "A") }, slot(0, 0, 3)),
    "Text: drop at block 3 of 3 in section 1.",
  );
});

test("hover over the block's own place says it stays", () => {
  const doc = docOf(sec(col(h(2, "H"), p("B"))));
  const state = cursorIn(doc, "H");
  assert.equal(
    hoverAnnouncement(state, { pos: posOf(doc, "H") }, slot(0, 0, 1)),
    "Heading: drop here to leave it in place.",
  );
});

test("hover over no column says release cancels", () => {
  const state = cursorIn(base(), "A");
  assert.equal(hoverAnnouncement(state, { kind: "image" }, null), "Image: release to cancel.");
});

test("hover at the cap says the cap's sentence", () => {
  const state = cursorIn(base(), "A");
  assert.equal(hoverAnnouncement(state, { kind: "image" }, slot(0, 0, 0), 4), CAP_SENTENCE);
  assert.equal(CAP_SENTENCE, "You can have at most 200 blocks.");
});

test("a dropped tile says it was added, with three columns", () => {
  const state = cursorIn(three(), "A");
  const { next, pos } = dropAndApply(state, { kind: "image" }, slot(0, 1, 0));
  assert.equal(
    dropAnnouncement(state, { kind: "image" }, next.doc, pos),
    "Image added: block 1 of 2 in column 2 of section 1.",
  );
});

test("a dropped block says it was moved, with one column", () => {
  const doc = docOf(sec(col(h(2, "H"), p("B"))));
  const state = cursorIn(doc, "H");
  const source = { pos: posOf(doc, "H") };
  const { next, pos } = dropAndApply(state, source, slot(0, 0, 2));
  assert.equal(
    dropAnnouncement(state, source, next.doc, pos),
    "Heading moved: block 2 of 2 in section 1.",
  );
});

test("Duplicate says the copy's place, with one and three columns", () => {
  const oneColumn = docOf(sec(col(h(2, "H"), p("B"), p("C"))));
  const state = cursorIn(oneColumn, "H");
  const result = duplicateBlock(state);
  assert.ok(result);
  const node = state.doc.nodeAt(posOf(oneColumn, "H")) as ProseMirrorNode;
  assert.equal(
    duplicateAnnouncement(node, state.apply(result.tr).doc, result.pos),
    "Heading duplicated: block 2 of 4 in section 1.",
  );
  const threeState = cursorIn(three(), "C");
  const copy = duplicateBlock(threeState);
  assert.ok(copy);
  assert.equal(
    duplicateAnnouncement(
      threeState.doc.nodeAt(posOf(threeState.doc, "C")) as ProseMirrorNode,
      threeState.apply(copy.tr).doc,
      copy.pos,
    ),
    "Text duplicated: block 2 of 2 in column 2 of section 1.",
  );
});

test("the fixed sentences read as specified", () => {
  assert.equal(DRAG_CANCELLED, "Drag cancelled.");
  assert.equal(GRIP_HINT, "Drag to move, or use Move up and Move down.");
});
