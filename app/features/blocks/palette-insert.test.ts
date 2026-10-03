import assert from "node:assert/strict";
import { test } from "node:test";
import { GapCursor } from "@tiptap/pm/gapcursor";
import { history, undo } from "@tiptap/pm/history";
import { Schema } from "@tiptap/pm/model";
import { EditorState, NodeSelection, TextSelection } from "@tiptap/pm/state";
import { countBlocks } from "./document-queries.ts";
import {
  insertBlock,
  insertionPoint,
  insertSection,
  sectionAddedAnnouncement,
  sectionFits,
  sectionInsertionPoint,
  templateBlockCount,
  topLevelPosition,
} from "./palette-insert.ts";
import { SECTION_TEMPLATES } from "./section-templates.ts";

const schema = new Schema({
  nodes: {
    doc: { content: "section+" },
    section: {
      content: "column{1,3}",
      attrs: { align: { default: "top" }, background: { default: "none" } },
    },
    column: { content: "block+" },
    paragraph: { group: "block", content: "text*" },
    heading: { group: "block", content: "text*", attrs: { level: { default: 2 } } },
    bulletList: { group: "block", content: "listItem+" },
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

const p = (text: string) => schema.nodes.paragraph.create(null, schema.text(text));
const column = (...blocks: ReturnType<typeof p>[]) => schema.nodes.column.create(null, blocks);
const list = schema.nodes.bulletList.create(null, [
  schema.nodes.listItem.create(null, p("One")),
  schema.nodes.listItem.create(null, p("Two")),
]);
const doc = schema.nodes.doc.create(null, [
  schema.nodes.section.create(null, [
    column(p("Alpha")),
    schema.nodes.column.create(null, [p("Beta"), list, p("Gamma")]),
  ]),
]);

/** The cursor inside the first occurrence of `text`. */
function cursorIn(text: string) {
  let found = 0;
  doc.descendants((node, pos) => {
    if (node.isText && node.text === text) found = pos + 1;
  });
  return EditorState.create({ doc, selection: TextSelection.create(doc, found) });
}

function types(state: EditorState, columnIndex: number) {
  const names: string[] = [];
  state.doc
    .child(0)
    .child(columnIndex)
    .forEach((block) => {
      names.push(block.type.name);
    });
  return names;
}

test("a block lands after the paragraph holding the cursor, in its own column", () => {
  const state = cursorIn("Beta");
  const next = state.apply(insertBlock(state, "line", 200) as never);
  assert.deepEqual(types(next, 1), ["paragraph", "horizontalRule", "bulletList", "paragraph"]);
  assert.deepEqual(types(next, 0), ["paragraph"]);
});

test("a cursor inside a list item puts the block after the whole list", () => {
  const state = cursorIn("One");
  const next = state.apply(insertBlock(state, "space", 200) as never);
  assert.deepEqual(types(next, 1), ["paragraph", "bulletList", "space", "paragraph"]);
});

test("a selected atom gets the block after it", () => {
  const withLine = doc.type.create(null, [
    schema.nodes.section.create(null, [
      schema.nodes.column.create(null, [p("A"), schema.nodes.horizontalRule.create(), p("B")]),
    ]),
  ]);
  const state = EditorState.create({ doc: withLine, selection: NodeSelection.create(withLine, 5) });
  assert.equal(state.selection instanceof NodeSelection, true);
  const next = state.apply(insertBlock(state, "text", 200) as never);
  assert.deepEqual(
    [0, 1, 2, 3].map((i) => next.doc.child(0).child(0).child(i).type.name),
    ["paragraph", "horizontalRule", "paragraph", "paragraph"],
  );
});

test("a text block gets the cursor and an atom becomes the selected node", () => {
  const state = cursorIn("Alpha");
  const text = state.apply(insertBlock(state, "list", 200) as never);
  assert.equal(text.selection instanceof TextSelection, true);
  assert.equal(text.selection.$head.parent.type.name, "paragraph");
  assert.equal(text.selection.$head.node(-1).type.name, "listItem");
  const atom = state.apply(insertBlock(state, "button", 200) as never);
  assert.equal(atom.selection instanceof NodeSelection, true);
  assert.equal((atom.selection as NodeSelection).node.type.name, "button");
});

test("the position helper answers the end of the cursor's block", () => {
  const state = cursorIn("Alpha");
  assert.equal(insertionPoint(doc, state.selection), state.selection.$head.after(3));
});

test("blocks are counted as column children, a list as one", () => {
  assert.equal(countBlocks(doc), 4);
});

test("nothing is inserted at the cap", () => {
  assert.equal(insertBlock(cursorIn("Alpha"), "text", 4), null);
});

test("a gap cursor at the end of a column inserts in that column, not in section 1 (F-168)", () => {
  const twoSections = schema.nodes.doc.create(null, [
    schema.nodes.section.create(null, [column(p("First"))]),
    schema.nodes.section.create(null, [
      column(p("Second"), schema.nodes.image.create({ mediaId: "m1" })),
    ]),
  ]);
  // Doc > section 2 > column: the gap after the image is the column's end.
  let columnEnd = 0;
  twoSections.child(1).forEach((node, offset) => {
    columnEnd = twoSections.child(0).nodeSize + 1 + offset + node.nodeSize - 1;
  });
  const gap = new GapCursor(twoSections.resolve(columnEnd));
  assert.equal(gap.$head.parent.type.name, "column");
  const state = EditorState.create({ doc: twoSections, selection: gap });
  const next = state.apply(insertBlock(state, "line", 200) as never);
  const names = (section: number) => {
    const out: string[] = [];
    next.doc
      .child(section)
      .child(0)
      .forEach((b) => {
        out.push(b.type.name);
      });
    return out;
  };
  assert.deepEqual(names(0), ["paragraph"]);
  assert.deepEqual(names(1), ["paragraph", "image", "horizontalRule"]);
});

// Section templates (14c1)

const OPTIONS = { allowMainHeading: true, maxSections: 30, maxBlocks: 200 };
const sec = (text: string) => schema.nodes.section.create(null, column(p(text)));
const three = schema.nodes.doc.create(null, [sec("One"), sec("Two"), sec("Three")]);

function textPos(d: typeof three, text: string) {
  let found = 0;
  d.descendants((node, pos) => {
    if (node.isText && node.text === text) found = pos + 1;
  });
  return found;
}

function sectionTexts(state: EditorState) {
  const out: string[] = [];
  state.doc.forEach((s) => {
    out.push(s.type.name === "section" && s.textContent ? s.textContent : "(new)");
  });
  return out;
}

function inserted(d: typeof three, selection: (d: typeof three) => number | NodeSelection) {
  const sel = selection(d);
  const state = EditorState.create({
    doc: d,
    selection: typeof sel === "number" ? TextSelection.create(d, sel) : sel,
  });
  const tr = insertSection(state, "blank", OPTIONS);
  assert.ok(tr);
  return state.apply(tr);
}

test("a section lands directly after the first section when the cursor is in it", () => {
  const next = inserted(three, (d) => textPos(d, "One"));
  assert.deepEqual(sectionTexts(next), ["One", "(new)", "Two", "Three"]);
});

test("a section lands directly after a middle section when the cursor is in it", () => {
  const next = inserted(three, (d) => textPos(d, "Two"));
  assert.deepEqual(sectionTexts(next), ["One", "Two", "(new)", "Three"]);
});

test("a section lands at the end when the cursor is in the last section", () => {
  const next = inserted(three, (d) => textPos(d, "Three"));
  assert.deepEqual(sectionTexts(next), ["One", "Two", "Three", "(new)"]);
});

test("a selected image block puts the section after its section", () => {
  const withImage = schema.nodes.doc.create(null, [
    schema.nodes.section.create(null, column(p("A"), schema.nodes.image.create())),
    sec("B"),
  ]);
  const next = inserted(withImage, () => NodeSelection.create(withImage, 5));
  assert.deepEqual(sectionTexts(next), ["A", "(new)", "B"]);
});

test("a gap cursor between sections puts the section there", () => {
  const state = EditorState.create({
    doc: three,
    selection: new GapCursor(three.resolve(three.child(0).nodeSize)),
  });
  const next = state.apply(insertSection(state, "blank", OPTIONS) as never);
  assert.deepEqual(sectionTexts(next), ["One", "(new)", "Two", "Three"]);
});

function cursorParent(kind: (typeof SECTION_TEMPLATES)[number]) {
  const state = EditorState.create({
    doc: three,
    selection: TextSelection.create(three, textPos(three, "One")),
  });
  const next = state.apply(insertSection(state, kind, OPTIONS) as never);
  assert.equal(next.selection instanceof TextSelection, true);
  const { $head } = next.selection;
  return { next, $head, columnIndex: $head.index(1), sectionIndex: $head.index(0) };
}

test("a hero puts the cursor in its heading", () => {
  const { $head, sectionIndex, columnIndex } = cursorParent("hero");
  assert.equal(sectionIndex, 1);
  assert.equal(columnIndex, 0);
  assert.equal($head.parent.type.name, "heading");
});

test("image and text puts the cursor in the heading of column 2", () => {
  const { $head, sectionIndex, columnIndex } = cursorParent("image-text");
  assert.equal(sectionIndex, 1);
  assert.equal(columnIndex, 1);
  assert.equal($head.parent.type.name, "heading");
});

test("a call to action puts the cursor in its heading", () => {
  const { $head, sectionIndex } = cursorParent("cta");
  assert.equal(sectionIndex, 1);
  assert.equal($head.parent.type.name, "heading");
});

test("a blank section puts the cursor in its paragraph", () => {
  const { $head, sectionIndex } = cursorParent("blank");
  assert.equal(sectionIndex, 1);
  assert.equal($head.parent.type.name, "paragraph");
});

function heroLevel(d: typeof three, allowMainHeading: boolean) {
  const state = EditorState.create({
    doc: d,
    selection: TextSelection.create(d, textPos(d, "One")),
  });
  const next = state.apply(insertSection(state, "hero", { ...OPTIONS, allowMainHeading }) as never);
  return next.selection.$head.parent.attrs.level;
}

test("the hero heading is level 1 when allowed and the page has no main heading", () => {
  assert.equal(heroLevel(three, true), 1);
});

test("the hero heading is level 2 when the page already has a main heading", () => {
  const withH1 = schema.nodes.doc.create(null, [
    schema.nodes.section.create(
      null,
      column(schema.nodes.heading.create({ level: 1 }, schema.text("Title")), p("One")),
    ),
  ]);
  assert.equal(heroLevel(withH1 as typeof three, true), 2);
});

test("the hero heading is level 2 when a main heading is not allowed", () => {
  assert.equal(heroLevel(three, false), 2);
});

test("the insert is one undo step, separate from the edit right before it", () => {
  let state = EditorState.create({
    doc: three,
    selection: TextSelection.create(three, textPos(three, "One")),
    plugins: [history()],
  });
  // An edit at the very spot the section will go, so only closeHistory keeps them apart.
  const at = sectionInsertionPoint(state.doc, state.selection);
  state = state.apply(state.tr.insert(at, sec("Typed")));
  const before = state.doc;
  state = state.apply(insertSection(state, "hero", OPTIONS) as never);
  assert.equal(state.doc.childCount, 5);
  let after = state;
  undo(state, (tr) => {
    after = state.apply(tr);
  });
  assert.equal(after.doc.eq(before), true);
});

test("no section is added at the section cap", () => {
  const state = EditorState.create({ doc: three, selection: TextSelection.create(three, 2) });
  assert.equal(insertSection(state, "blank", { ...OPTIONS, maxSections: 3 }), null);
});

test("a template that would pass the block cap is refused while a smaller one fits", () => {
  const state = EditorState.create({ doc: three, selection: TextSelection.create(three, 2) });
  const options = { ...OPTIONS, maxBlocks: countBlocks(three) + 2 };
  assert.equal(insertSection(state, "hero", options), null);
  assert.notEqual(insertSection(state, "blank", options), null);
});

test("sectionFits: only Blank fits when two blocks are left, none at the section cap, all with room", () => {
  const kinds = SECTION_TEMPLATES.filter((kind) => kind !== "blank");
  const tight = countBlocks(three) + 2;
  assert.equal(sectionFits(three, "blank", 30, tight), true);
  for (const kind of kinds) assert.equal(sectionFits(three, kind, 30, tight), false, kind);
  for (const kind of SECTION_TEMPLATES) assert.equal(sectionFits(three, kind, 3, 200), false, kind);
  for (const kind of SECTION_TEMPLATES) assert.equal(sectionFits(three, kind, 30, 200), true, kind);
});

test("each template reports how many blocks it adds", () => {
  assert.deepEqual(
    SECTION_TEMPLATES.map((kind) => templateBlockCount(kind)),
    [1, 5, 3, 3],
  );
});

test("the announcement names the template and the place", () => {
  assert.equal(sectionAddedAnnouncement("hero", 2, 5), "Hero added: now section 3 of 5.");
});

function insertedAt(index: number, d: typeof three = three, options = OPTIONS) {
  const state = EditorState.create({
    doc: d,
    selection: TextSelection.create(d, textPos(d, "One")),
    plugins: [history()],
  });
  const tr = insertSection(state, "hero", { ...options, index });
  assert.ok(tr);
  return { state, next: state.apply(tr) };
}

for (const [index, label] of [
  [0, "the start"],
  [1, "a middle index"],
  [3, "the end"],
] as const) {
  test(`a section with index ${index} lands at ${label}, with the cursor in its heading`, () => {
    const { next } = insertedAt(index);
    assert.equal(next.doc.childCount, 4);
    assert.equal(next.doc.child(index).childCount, 2);
    assert.deepEqual(
      [0, 1, 2, 3].filter((i) => i !== index).map((i) => next.doc.child(i).textContent),
      ["One", "Two", "Three"],
    );
    const { $head } = next.selection;
    assert.equal($head.index(0), index);
    assert.equal($head.parent.type.name, "heading");
  });

  test(`a section with index ${index} is one undo step that restores the document`, () => {
    const { state, next } = insertedAt(index);
    let after = next;
    undo(next, (tr) => {
      after = next.apply(tr);
    });
    assert.equal(after.doc.eq(state.doc), true);
  });
}

test("a section with an index keeps the main heading rule", () => {
  assert.equal(insertedAt(1).next.selection.$head.parent.attrs.level, 1);
  const noMain = insertedAt(1, three, { ...OPTIONS, allowMainHeading: false });
  assert.equal(noMain.next.selection.$head.parent.attrs.level, 2);
  const withH1 = schema.nodes.doc.create(null, [
    schema.nodes.section.create(
      null,
      column(schema.nodes.heading.create({ level: 1 }, schema.text("One"))),
    ),
  ]);
  assert.equal(insertedAt(0, withH1 as typeof three).next.selection.$head.parent.attrs.level, 2);
});

test("a section with an index is refused at the section cap and past the block cap", () => {
  const state = EditorState.create({ doc: three, selection: TextSelection.create(three, 2) });
  assert.equal(insertSection(state, "blank", { ...OPTIONS, maxSections: 3, index: 1 }), null);
  const tight = { ...OPTIONS, maxBlocks: countBlocks(three) + 2, index: 1 };
  assert.equal(insertSection(state, "hero", tight), null);
  assert.notEqual(insertSection(state, "blank", tight), null);
});

test("insertSection refuses an index past the section count", () => {
  const state = EditorState.create({ doc: three });
  // `=== null`, not `equal(tr, null)`: a failing diff of a Transaction exhausts memory.
  assert.ok(insertSection(state, "blank", { ...OPTIONS, index: three.childCount + 1 }) === null);
});

test("insertSection refuses a negative index", () => {
  const state = EditorState.create({ doc: three });
  assert.ok(insertSection(state, "blank", { ...OPTIONS, index: -1 }) === null);
});

test("topLevelPosition is the start of the document at 0 and its end at the child count", () => {
  assert.equal(topLevelPosition(three, 0), 0);
  assert.equal(topLevelPosition(three, three.childCount), three.content.size);
});

test("topLevelPosition is null outside 0 to the child count", () => {
  assert.equal(topLevelPosition(three, -1), null);
  assert.equal(topLevelPosition(three, three.childCount + 1), null);
});
