import assert from "node:assert/strict";
import { test } from "node:test";
import { isReadableDocumentContent } from "./editor-content.ts";

test("a document is readable only as a doc holding a list", () => {
  assert.equal(isReadableDocumentContent({ type: "doc", content: [] }), true);
  assert.equal(isReadableDocumentContent({ type: "doc" }), false);
  assert.equal(isReadableDocumentContent({ type: "section", content: [] }), false);
  assert.equal(isReadableDocumentContent({ blocks: [] }), false);
});

test("nothing at all is not readable", () => {
  // The ref is null before the editor mounts, so reading it gives nothing (F-42).
  assert.equal(isReadableDocumentContent(undefined), false);
  assert.equal(isReadableDocumentContent(null), false);
});
