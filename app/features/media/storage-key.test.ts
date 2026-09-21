import assert from "node:assert/strict";
import { test } from "node:test";
import { generateStorageKey } from "./storage-key.ts";

test("the key carries the given extension", () => {
  assert.match(generateStorageKey("jpg"), /^[0-9a-f-]{36}\.jpg$/);
});

test("two keys never collide", () => {
  assert.notEqual(generateStorageKey("png"), generateStorageKey("png"));
});
