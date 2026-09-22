import assert from "node:assert/strict";
import { test } from "node:test";
import { clampToLastPage, parseMediaListPage } from "./media-list-query.ts";

test("the page defaults to 1 when the query string has none", () => {
  assert.equal(parseMediaListPage(new URL("https://example.org/admin/media")), 1);
});

test("a non-integer or out-of-range page falls back within bounds", () => {
  assert.equal(parseMediaListPage(new URL("https://example.org/admin/media?page=abc")), 1);
  assert.equal(parseMediaListPage(new URL("https://example.org/admin/media?page=0")), 1);
  assert.equal(parseMediaListPage(new URL("https://example.org/admin/media?page=5000")), 1000);
});

test("a page within range is returned as it is", () => {
  assert.equal(clampToLastPage(2, 5), 2);
});

test("a page past the end is clamped to the last real page", () => {
  assert.equal(clampToLastPage(9, 3), 3);
});

test("the first page of an empty library is clamped to itself, not zero", () => {
  assert.equal(clampToLastPage(1, 1), 1);
});
