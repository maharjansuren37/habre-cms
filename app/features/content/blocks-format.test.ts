import assert from "node:assert/strict";
import { test } from "node:test";
import { assertKnownFormat } from "./blocks-format.ts";

test("an entry in the format this build reads is accepted", () => {
  assert.doesNotThrow(() => assertKnownFormat("entry-1", "post", "v2"));
  assert.doesNotThrow(() => assertKnownFormat("entry-1", "page", "v2"));
});

test("a page in the sections format is accepted", () => {
  assert.doesNotThrow(() => assertKnownFormat("entry-1", "page", "v3"));
});

test("a post in the sections format is refused, naming the entry and the format", () => {
  assert.throws(() => assertKnownFormat("entry-2", "post", "v3"), /Entry entry-2 .*"v3".*"v2"/);
});

test("an older or unknown format is refused for either type", () => {
  assert.throws(() => assertKnownFormat("entry-1", "post", "v1"), /Entry entry-1 .*"v1".*"v2"/);
  assert.throws(() => assertKnownFormat("entry-1", "page", "v1"), /Entry entry-1 .*"v1"/);
  assert.throws(() => assertKnownFormat("entry-1", "page", "v4"), /"v2" or "v3"/);
});
