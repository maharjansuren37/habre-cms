import assert from "node:assert/strict";
import { test } from "node:test";
import { Schema } from "@tiptap/pm/model";
import { EditorState, NodeSelection, TextSelection } from "@tiptap/pm/state";
import { countBlocks, insertBlock, insertionPoint } from "./palette-insert.ts";

const schema = new Schema({
  nodes: {
    doc: { content: "section+" },
    section: { content: "column{1,3}" },
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
