import assert from "node:assert/strict";
import { test } from "node:test";
import { isReadableEditorContent, isReadableSectionsContent } from "./editor-content.ts";

test("an empty list of blocks is readable - an empty post is a real thing", () => {
  assert.equal(isReadableEditorContent({ blocks: [] }), true);
  assert.equal(
    isReadableEditorContent({ blocks: [{ id: "a", type: "paragraph", data: {} }] }),
    true,
  );
});

test("nothing at all is not readable", () => {
  // Editor.js's save() resolves undefined when a tool throws inside it, and the
  // ref is undefined before the editor mounts (F-42).
  assert.equal(isReadableEditorContent(undefined), false);
  assert.equal(isReadableEditorContent(null), false);
});

test("an object without a list of blocks is not readable", () => {
  assert.equal(isReadableEditorContent({}), false);
  assert.equal(isReadableEditorContent({ blocks: "not a list" }), false);
  assert.equal(isReadableEditorContent([]), false);
});

test("sections content needs at least one section, each column readable", () => {
  const column = { blocks: [] };
  assert.equal(isReadableSectionsContent({ sections: [{ id: "a", columns: [column] }] }), true);
  assert.equal(isReadableSectionsContent({ sections: [] }), false);
  assert.equal(isReadableSectionsContent({ sections: [{ id: "a", columns: [undefined] }] }), false);
  assert.equal(isReadableSectionsContent({ blocks: [] }), false);
  assert.equal(isReadableSectionsContent(undefined), false);
});
