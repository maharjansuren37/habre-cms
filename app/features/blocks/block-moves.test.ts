import assert from "node:assert/strict";
import { test } from "node:test";
import { GapCursor } from "@tiptap/pm/gapcursor";
import { history, undo } from "@tiptap/pm/history";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Schema } from "@tiptap/pm/model";
import { EditorState, NodeSelection, TextSelection } from "@tiptap/pm/state";
import {
  deleteAnnouncement,
  deleteBlock,
  describePosition,
  keepOneMainHeading,
  kindName,
  mainHeading,
  mainHeadingAnnouncement,
  moveAnnouncement,
  moveBlock,
  moveSection,
  sectionMoveAnnouncement,
  selectedBlock,
  setMainHeading,
  shortQuote,
} from "./block-moves.ts";

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

test("moving down swaps a block with the one below it in its column", () => {
  const state = cursorIn(base(), "A");
  const next = state.apply(moveBlock(state, "down") as never);
  assert.deepEqual(shape(next.doc), [[["B", "A"], ["C"]], [["D"]]]);
});

test("moving up swaps a block with the one above it in its column", () => {
  const state = cursorIn(base(), "B");
  const next = state.apply(moveBlock(state, "up") as never);
  assert.deepEqual(shape(next.doc), [[["B", "A"], ["C"]], [["D"]]]);
});

test("down from a column's last block lands first in the next column", () => {
  const state = cursorIn(base(), "B");
  const next = state.apply(moveBlock(state, "down") as never);
  assert.deepEqual(shape(next.doc), [[["A"], ["B", "C"]], [["D"]]]);
});

test("down from a section's last column lands first in the next section", () => {
  const state = cursorIn(base(), "C");
  const next = state.apply(moveBlock(state, "down") as never);
  assert.deepEqual(shape(next.doc), [[["A", "B"], ["<paragraph>"]], [["C", "D"]]]);
});

test("up from a column's first block lands last in the previous column", () => {
  const doc = docOf(sec(col(p("A"), p("B")), col(p("C"), p("X"))));
  const state = cursorIn(doc, "C");
  const next = state.apply(moveBlock(state, "up") as never);
  assert.deepEqual(shape(next.doc), [[["A", "B", "C"], ["X"]]]);
});

test("up from a section's first column lands last in the previous section's last column", () => {
  const state = cursorIn(base(), "D");
  const next = state.apply(moveBlock(state, "up") as never);
  assert.deepEqual(shape(next.doc), [
    [
      ["A", "B"],
      ["C", "D"],
    ],
    [["<paragraph>"]],
  ]);
});

test("there is no move up from the document's first position or down from its last", () => {
  assert.equal(moveBlock(cursorIn(base(), "A"), "up"), null);
  assert.equal(moveBlock(cursorIn(base(), "D"), "down"), null);
});

test("a block moving into an untouched column replaces its empty paragraph", () => {
  const doc = docOf(sec(col(p("A"), p("B")), col(p())));
  const state = cursorIn(doc, "B");
  const next = state.apply(moveBlock(state, "down") as never);
  assert.deepEqual(shape(next.doc), [[["A"], ["B"]]]);
});

test("moving a column's only block out leaves an empty paragraph", () => {
  const doc = docOf(sec(col(p("A")), col(p("B"))));
  const state = cursorIn(doc, "A");
  const next = state.apply(moveBlock(state, "down") as never);
  assert.deepEqual(shape(next.doc), [[["<paragraph>"], ["A", "B"]]]);
});

test("a move that would leave the document over the block cap returns null", () => {
  const doc = docOf(sec(col(p("A")), col(p("B"))));
  assert.equal(moveBlock(cursorIn(doc, "A"), "down", 2), null);
  assert.notEqual(moveBlock(cursorIn(doc, "A"), "down", 3), null);
});

test("a move that changes no block count is allowed at the cap", () => {
  const doc = docOf(sec(col(p("A"), p("B"))));
  assert.notEqual(moveBlock(cursorIn(doc, "A"), "down", 2), null);
});

test("a move keeps the cursor inside the moved block at the same offset", () => {
  const state = cursorIn(base(), "B", 1);
  const next = state.apply(moveBlock(state, "down") as never);
  const sel = selectedBlock(next);
  assert.equal(sel?.node.textContent, "B");
  assert.equal(next.selection.empty, true);
  assert.equal(
    next.selection.from - (sel?.pos ?? 0),
    state.selection.from - (selectedBlock(state)?.pos ?? 0),
  );
  assert.equal(next.selection instanceof TextSelection, true);
});

test("a list moves whole, from a cursor inside one of its items", () => {
  const list = n.bulletList.create(null, [
    n.listItem.create(null, p("One")),
    n.listItem.create(null, p("Two")),
  ]);
  const doc = docOf(sec(col(p("A"), list, p("Z"))));
  const state = cursorIn(doc, "Two", 2);
  assert.equal(selectedBlock(state)?.kind, "list");
  const next = state.apply(moveBlock(state, "down") as never);
  assert.deepEqual(
    [0, 1, 2].map((i) => next.doc.child(0).child(0).child(i).type.name),
    ["paragraph", "paragraph", "bulletList"],
  );
  assert.equal(next.selection.$head.parent.textContent, "Two");
  assert.equal(next.selection.$head.parentOffset, 2);
});

test("a selected atom moves and stays the selected node", () => {
  const doc = docOf(sec(col(p("A"), n.horizontalRule.create(), p("B"))));
  const state = nodeSelect(doc, "horizontalRule");
  const next = state.apply(moveBlock(state, "down") as never);
  assert.deepEqual(shape(next.doc), [[["A", "B", "<horizontalRule>"]]]);
  assert.equal(next.selection instanceof NodeSelection, true);
  assert.equal((next.selection as NodeSelection).node.type.name, "horizontalRule");
});

test("one undo reverses a whole move, including a cross-column one", () => {
  const state = cursorIn(base(), "C", 1, true);
  const moved = state.apply(moveBlock(state, "down") as never);
  assert.notDeepEqual(shape(moved.doc), shape(state.doc));
  let undone = moved;
  undo(moved, (tr) => {
    undone = moved.apply(tr);
  });
  assert.deepEqual(shape(undone.doc), shape(state.doc));
});

test("selectedBlock names the block, its kind and its place, from 0", () => {
  const sel = selectedBlock(cursorIn(base(), "C"));
  assert.equal(sel?.kind, "text");
  assert.deepEqual([sel?.section, sel?.column, sel?.index], [0, 1, 0]);
  const heading = docOf(sec(col(h(2, "H"))));
  assert.equal(selectedBlock(cursorIn(heading, "H"))?.kind, "heading");
  const quote = docOf(sec(col(n.blockquote.create(null, p("Q")))));
  assert.equal(selectedBlock(cursorIn(quote, "Q"))?.kind, "quote");
});

test("selectedBlock is null for a gap cursor and uses the head of a range across blocks", () => {
  const doc = docOf(sec(col(p("A"), n.image.create())));
  const gap = EditorState.create({
    doc,
    selection: new GapCursor(doc.resolve(doc.content.size - 2)),
  });
  assert.equal(gap.selection.$head.parent.type.name, "column");
  assert.equal(selectedBlock(gap), null);
  const two = docOf(sec(col(p("AA"), p("BB"))));
  const range = EditorState.create({ doc: two, selection: TextSelection.create(two, 3, 8) });
  assert.equal(selectedBlock(range)?.index, 1);
});

test("deleting a column's only block leaves an empty paragraph with the cursor in it", () => {
  const doc = docOf(sec(col(p("A")), col(p("B"))));
  const state = cursorIn(doc, "A");
  const next = state.apply(deleteBlock(state) as never);
  assert.deepEqual(shape(next.doc), [[["<paragraph>"], ["B"]]]);
  assert.equal(next.selection.$head.parent.type.name, "paragraph");
  assert.equal(next.selection.$head.node(-1).childCount, 1);
});

test("deleting a block puts the selection in the block that took its place", () => {
  const state = cursorIn(base(), "A");
  const next = state.apply(deleteBlock(state) as never);
  assert.deepEqual(shape(next.doc), [[["B"], ["C"]], [["D"]]]);
  assert.equal(next.selection.$head.parent.textContent, "B");
});

test("deleting a selected line removes it and one undo restores it", () => {
  const doc = docOf(sec(col(p("A"), n.horizontalRule.create(), p("B"))));
  const state = nodeSelect(doc, "horizontalRule", true);
  const next = state.apply(deleteBlock(state) as never);
  assert.deepEqual(shape(next.doc), [[["A", "B"]]]);
  let undone = next;
  undo(next, (tr) => {
    undone = next.apply(tr);
  });
  assert.deepEqual(shape(undone.doc), [[["A", "<horizontalRule>", "B"]]]);
});

test("a section moves down with its content, and the selection follows it", () => {
  const state = cursorIn(base(), "A", 1);
  const next = state.apply(moveSection(state, 0, "down") as never);
  assert.deepEqual(shape(next.doc), [[["D"]], [["A", "B"], ["C"]]]);
  assert.equal(next.selection.$head.parent.textContent, "A");
  assert.equal(next.selection.$head.parentOffset, 1);
});

test("a section moves up, and the section swapped with keeps its selection", () => {
  const state = cursorIn(base(), "D", 1);
  const next = state.apply(moveSection(state, 0, "down") as never);
  assert.equal(next.selection.$head.parent.textContent, "D");
  const up = state.apply(moveSection(state, 1, "up") as never);
  assert.deepEqual(shape(up.doc), [[["D"]], [["A", "B"], ["C"]]]);
  assert.equal(up.selection.$head.parent.textContent, "D");
});

test("moving the first section up or the last down returns null", () => {
  const state = cursorIn(base(), "A");
  assert.equal(moveSection(state, 0, "up"), null);
  assert.equal(moveSection(state, 1, "down"), null);
});

test("describePosition counts the column only when the section has several", () => {
  const doc = base();
  const three = docOf(sec(col(p("A")), col(p("B"), p("C")), col(p("D"))));
  const at = (d: ProseMirrorNode, text: string) => {
    let pos = -1;
    d.descendants((node, nodePos) => {
      if (pos < 0 && node.isText && node.text === text) pos = nodePos - 1;
    });
    return pos;
  };
  assert.equal(describePosition(doc, at(doc, "D")), "block 1 of 1 in section 2");
  assert.equal(describePosition(three, at(three, "C")), "block 2 of 2 in column 2 of section 1");
});

test("the announcements read as the spec's sentences", () => {
  const doc = docOf(sec(col(p("x")), col(h(2, "Hi"), p("y"))));
  const heading = doc.child(0).child(1).child(0);
  assert.equal(
    moveAnnouncement(heading, "down", doc, doc.child(0).child(0).nodeSize + 2),
    "Heading moved down: block 1 of 2 in column 2 of section 1.",
  );
  assert.equal(sectionMoveAnnouncement("down", 1, 3), "Section moved down: now section 2 of 3.");
  assert.equal(deleteAnnouncement(heading), "Heading deleted.");
  assert.deepEqual(
    [
      h(1, "a"),
      h(2, "a"),
      h(3, "a"),
      h(4, "a"),
      p("a"),
      n.image.create(),
      n.horizontalRule.create(),
    ].map(kindName),
    ["Main heading", "Heading", "Subheading", "Small heading", "Text", "Image", "Line"],
  );
});

// --- the one-main-heading guard ---

const pageWith = (...blocks: ProseMirrorNode[]) => docOf(sec(col(...blocks)));
const levels = (doc: ProseMirrorNode) => {
  const out: number[] = [];
  doc.descendants((node) => {
    if (node.type.name === "heading") out.push(node.attrs.level);
  });
  return out;
};
/** The position of the nth heading in a one-section, one-column document. */
const headingPos = (doc: ProseMirrorNode, nth: number) => {
  const found: number[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name === "heading") found.push(pos);
  });
  return found[nth];
};
const stateOf = (doc: ProseMirrorNode) => EditorState.create({ doc });

test("the guard keeps the earlier main heading when a second arrives", () => {
  const before = stateOf(pageWith(h(1, "Welcome"), h(2, "Work")));
  // a paste: "Work" becomes level 1 while "Welcome" is untouched
  const tr = before.tr.setNodeMarkup(headingPos(before.doc, 1), undefined, { level: 1 });
  const after = before.apply(tr);
  assert.deepEqual(levels(after.doc), [1, 1]);
  const fix = keepOneMainHeading(before, after, "page");
  assert.notEqual(fix, null);
  assert.deepEqual(levels(after.apply(fix as never).doc), [1, 2]);
});

test("the guard keeps the earlier main heading even when the new one comes first", () => {
  const before = stateOf(pageWith(h(2, "Intro"), h(1, "Welcome")));
  const after = before.apply(
    before.tr.setNodeMarkup(headingPos(before.doc, 0), undefined, { level: 1 }),
  );
  assert.deepEqual(levels(after.doc), [1, 1]);
  const fixed = after.apply(keepOneMainHeading(before, after, "page") as never);
  assert.deepEqual(levels(fixed.doc), [2, 1]);
});

test("the guard does nothing when the menu demoted the old main heading in the same step", () => {
  const before = stateOf(pageWith(h(1, "Welcome"), h(2, "Work")));
  const tr = before.tr
    .setNodeMarkup(headingPos(before.doc, 0), undefined, { level: 2 })
    .setNodeMarkup(headingPos(before.doc, 1), undefined, { level: 1 });
  const after = before.apply(tr);
  assert.deepEqual(levels(after.doc), [2, 1]);
  assert.equal(keepOneMainHeading(before, after, "page"), null);
});

test("the guard leaves a page with one main heading alone", () => {
  const s = stateOf(pageWith(h(1, "Welcome"), h(2, "Work")));
  assert.equal(keepOneMainHeading(s, s, "page"), null);
});

test("the guard demotes every level-1 heading in a post", () => {
  const before = stateOf(pageWith(h(2, "A"), h(2, "B"), p("c")));
  const after = before.apply(
    before.tr
      .setNodeMarkup(headingPos(before.doc, 0), undefined, { level: 1 })
      .setNodeMarkup(headingPos(before.doc, 1), undefined, { level: 1 }),
  );
  assert.deepEqual(levels(after.doc), [1, 1]);
  const fixed = after.apply(keepOneMainHeading(before, after, "post") as never);
  assert.deepEqual(levels(fixed.doc), [2, 2]);
});

test("the guard on a post does nothing when there is no level-1 heading", () => {
  const s = stateOf(pageWith(h(2, "A")));
  assert.equal(keepOneMainHeading(s, s, "post"), null);
});

test("a short heading is quoted whole, a long one cut to 40 characters with an ellipsis", () => {
  assert.equal(shortQuote("Welcome"), "Welcome");
  const long = "Portraits and weddings in the Adelaide Hills since 2009";
  assert.equal(shortQuote(long), `${long.slice(0, 40)}…`);
  assert.equal(shortQuote("x".repeat(40)), "x".repeat(40));
});

test("the main heading is the page's level-1 heading, or none", () => {
  assert.equal(mainHeading(pageWith(h(2, "Work"), h(1, "Welcome")))?.textContent, "Welcome");
  assert.equal(mainHeading(pageWith(h(2, "Work"))), null);
});

test("Main heading makes the selected heading level 1 and the old one a Heading, in one undo step", () => {
  const state = cursorIn(
    pageWith(h(1, "Welcome"), p("Body"), h(2, "Our work")),
    "Our work",
    1,
    true,
  );
  const result = setMainHeading(state);
  assert.notEqual(result, null);
  const { tr, demoted } = result as NonNullable<typeof result>;
  assert.equal(demoted?.textContent, "Welcome");
  const next = state.apply(tr);
  assert.deepEqual(levels(next.doc), [2, 1]);
  assert.equal(mainHeadingAnnouncement(demoted as ProseMirrorNode), '"Welcome" is now a Heading.');
  assert.equal(selectedBlock(next)?.node.textContent, "Our work");
  const undone = state.apply(tr);
  let restored = undone;
  undo(undone, (t) => {
    restored = undone.apply(t);
  });
  assert.deepEqual(levels(restored.doc), [1, 2]);
});

test("Main heading turns text into the main heading, with none to demote", () => {
  const state = cursorIn(pageWith(p("Hello"), h(2, "Work")), "Hello");
  const result = setMainHeading(state);
  assert.equal(result?.demoted, null);
  const next = state.apply(result?.tr as never);
  assert.deepEqual(levels(next.doc), [1, 2]);
});

test("Main heading does nothing for a list, quote or atom", () => {
  assert.equal(
    setMainHeading(nodeSelect(pageWith(p("a"), n.horizontalRule.create()), "horizontalRule")),
    null,
  );
});
