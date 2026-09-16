import assert from "node:assert/strict";
import { test } from "node:test";
import { type Block, fromEditorJs, toEditorJs, toPlainText } from "./blocks.ts";

const editorBlock = (type: string, data: unknown, id = "abc123") => ({
  blocks: [{ id, type, data }],
});

test("a paragraph becomes a text block", () => {
  const result = fromEditorJs(editorBlock("paragraph", { text: "Hello there" }));
  assert.deepEqual(result, {
    ok: true,
    blocks: [{ id: "abc123", type: "text", data: { text: "Hello there" } }],
  });
});

test("markup the editor sends is stored as plain text", () => {
  const result = fromEditorJs(
    editorBlock("paragraph", { text: "<b>bold</b> &amp; <i>italic</i>" }),
  );
  assert.deepEqual(result, {
    ok: true,
    blocks: [{ id: "abc123", type: "text", data: { text: "bold & italic" } }],
  });
});

test("a header becomes a heading block, keeping its level", () => {
  const result = fromEditorJs(editorBlock("header", { text: "Section", level: 3 }));
  assert.deepEqual(result, {
    ok: true,
    blocks: [{ id: "abc123", type: "heading", data: { text: "Section", level: 3 } }],
  });
});

test("a heading level the theme cannot render is refused", () => {
  const result = fromEditorJs(editorBlock("header", { text: "Too big", level: 1 }));
  assert.equal(result.ok, false);
  assert.match(result.ok === false ? result.message : "", /^Block 1 could not be saved/);
});

test("an ordered list becomes a number list, an unordered one a bullet list", () => {
  const ordered = fromEditorJs(editorBlock("list", { style: "ordered", items: ["one", "two"] }));
  const unordered = fromEditorJs(editorBlock("list", { style: "unordered", items: ["one"] }));
  assert.deepEqual(ordered, {
    ok: true,
    blocks: [{ id: "abc123", type: "list", data: { style: "number", items: ["one", "two"] } }],
  });
  assert.deepEqual(unordered, {
    ok: true,
    blocks: [{ id: "abc123", type: "list", data: { style: "bullet", items: ["one"] } }],
  });
});

test("a list with nothing in it is refused rather than stored empty", () => {
  const result = fromEditorJs(editorBlock("list", { style: "unordered", items: [] }));
  assert.equal(result.ok, false);
});

test("a block type this version cannot store is refused, and the message names it", () => {
  const result = fromEditorJs(editorBlock("image", { file: { url: "https://example.org/a.png" } }));
  assert.equal(result.ok, false);
  assert.match(result.ok === false ? result.message : "", /"image"/);
});

test("the message names which block failed, not just that one did", () => {
  const result = fromEditorJs({
    blocks: [
      { id: "a", type: "paragraph", data: { text: "fine" } },
      { id: "b", type: "paragraph", data: { text: "also fine" } },
      { id: "c", type: "checklist", data: {} },
    ],
  });
  assert.match(result.ok === false ? result.message : "", /^Block 3 /);
});

test("content that is not the editor's shape at all is refused", () => {
  assert.equal(fromEditorJs({ nonsense: true }).ok, false);
  assert.equal(fromEditorJs(null).ok, false);
});

test("saved blocks load back into the shape the editor expects", () => {
  const blocks: Block[] = [
    { id: "a", type: "text", data: { text: "Hello" } },
    { id: "b", type: "heading", data: { text: "Section", level: 2 } },
    { id: "c", type: "list", data: { style: "number", items: ["one"] } },
  ];
  assert.deepEqual(toEditorJs(blocks), {
    blocks: [
      { id: "a", type: "paragraph", data: { text: "Hello" } },
      { id: "b", type: "header", data: { text: "Section", level: 2 } },
      { id: "c", type: "list", data: { style: "ordered", items: ["one"] } },
    ],
  });
});

test("a block survives a round trip through the editor's shape and back", () => {
  const blocks: Block[] = [
    { id: "a", type: "text", data: { text: "Hello" } },
    { id: "b", type: "heading", data: { text: "Section", level: 3 } },
    { id: "c", type: "list", data: { style: "bullet", items: ["one", "two"] } },
  ];
  const back = fromEditorJs(toEditorJs(blocks));
  assert.deepEqual(back, { ok: true, blocks });
});

test("line breaks and runs of whitespace collapse to single spaces", () => {
  assert.equal(toPlainText("one<br>two   three\n\nfour"), "one two three four");
});
