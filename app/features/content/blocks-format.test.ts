import assert from "node:assert/strict";
import { test } from "node:test";
import { assertKnownFormat, readableFormats } from "./blocks-format.ts";

test("only the document format is readable, for a post and a page alike", () => {
  assert.deepEqual(readableFormats("post"), ["v4"]);
  assert.deepEqual(readableFormats("page"), ["v4"]);
});

test("a page or a post in the document format is accepted", () => {
  assert.doesNotThrow(() => assertKnownFormat("entry-1", "page", "v4"));
  assert.doesNotThrow(() => assertKnownFormat("entry-1", "post", "v4"));
});

test("an Editor.js format is refused for either type, naming the entry and the format", () => {
  assert.throws(() => assertKnownFormat("entry-2", "post", "v2"), /Entry entry-2 .*"v2".*"v4"/);
  assert.throws(() => assertKnownFormat("entry-2", "page", "v3"), /Entry entry-2 .*"v3".*"v4"/);
});

test("an older or unknown format is refused for either type", () => {
  assert.throws(() => assertKnownFormat("entry-1", "post", "v1"), /Entry entry-1 .*"v1"/);
  assert.throws(() => assertKnownFormat("entry-1", "page", "v5"), /reads only "v4" for a page/);
});
