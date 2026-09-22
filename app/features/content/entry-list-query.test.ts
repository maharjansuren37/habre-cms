import assert from "node:assert/strict";
import { test } from "node:test";
import { parseEntryListQuery } from "./entry-list-query.ts";

test("with no params, the query is everything, unsearched, page one", () => {
  assert.deepEqual(parseEntryListQuery(new URL("http://x/admin/posts")), {
    status: "all",
    q: "",
    page: 1,
  });
});

test("a known status is kept", () => {
  assert.equal(parseEntryListQuery(new URL("http://x/admin/posts?status=draft")).status, "draft");
  assert.equal(
    parseEntryListQuery(new URL("http://x/admin/posts?status=published")).status,
    "published",
  );
});

test("an unknown status falls back to all, rather than reaching the query as-is", () => {
  assert.equal(parseEntryListQuery(new URL("http://x/admin/posts?status=archived")).status, "all");
});

test("a search term is trimmed", () => {
  assert.equal(parseEntryListQuery(new URL("http://x/admin/posts?q=%20hello%20")).q, "hello");
});

test("a search term longer than the title's own cap is truncated, not refused", () => {
  const q = parseEntryListQuery(new URL(`http://x/admin/posts?q=${"a".repeat(250)}`)).q;
  assert.equal(q.length, 200);
});

test("page zero, negative or non-numeric falls back to page one", () => {
  assert.equal(parseEntryListQuery(new URL("http://x/admin/posts?page=0")).page, 1);
  assert.equal(parseEntryListQuery(new URL("http://x/admin/posts?page=-5")).page, 1);
  assert.equal(parseEntryListQuery(new URL("http://x/admin/posts?page=abc")).page, 1);
});

test("a page far beyond the list's reach is clamped rather than reaching the database as-is", () => {
  assert.equal(parseEntryListQuery(new URL("http://x/admin/posts?page=100000")).page, 1000);
});

test("an ordinary page number is kept", () => {
  assert.equal(parseEntryListQuery(new URL("http://x/admin/posts?page=3")).page, 3);
});
