import assert from "node:assert/strict";
import { test } from "node:test";
import { generateStorageKey, generateUploadDirectory } from "./storage-key.ts";

const SITE_ID = "6f1c2f0e-7a52-4a43-9d51-0d6c3f1b8a10";

test("the key sits under the site's prefix and carries the given extension", () => {
  assert.match(
    generateStorageKey(SITE_ID, "jpg"),
    new RegExp(`^sites/${SITE_ID}/[0-9a-f-]{36}\\.jpg$`),
  );
});

test("two keys never collide", () => {
  assert.notEqual(generateStorageKey(SITE_ID, "png"), generateStorageKey(SITE_ID, "png"));
});

test("two sites never share a prefix", () => {
  const other = "0b9d4f4c-1c43-4c0e-8f0a-7f5a2d9e6b21";
  assert.ok(generateStorageKey(other, "png").startsWith(`sites/${other}/`));
  assert.ok(!generateStorageKey(other, "png").startsWith(`sites/${SITE_ID}/`));
});

test("an upload's directory sits under the site's prefix, ends in a slash and is never reused", () => {
  const directory = generateUploadDirectory(SITE_ID);
  assert.match(directory, new RegExp(`^sites/${SITE_ID}/[0-9a-f-]{36}/$`));
  assert.notEqual(directory, generateUploadDirectory(SITE_ID));
});
