import assert from "node:assert/strict";
import { test } from "node:test";
import { assertKnownFormat } from "./blocks-format.ts";

test("an entry in the format this build reads is accepted", () => {
  assert.doesNotThrow(() => assertKnownFormat("entry-1", "v2"));
});

test("an older or newer format is refused, naming the entry and the format", () => {
  assert.throws(() => assertKnownFormat("entry-1", "v1"), /Entry entry-1 .*"v1".*"v2"/);
  assert.throws(() => assertKnownFormat("entry-2", "v3"), /Entry entry-2 .*"v3"/);
});
