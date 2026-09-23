import assert from "node:assert/strict";
import { test } from "node:test";
import { NAV_MAX_ITEMS, navigationSchema } from "./navigation-input.ts";

const PAGE_ID = "3fa85f64-5717-4562-b3fc-2c963f66afa6";

test("accepts a valid page item", () => {
  const result = navigationSchema.safeParse([{ label: "About", pageId: PAGE_ID }]);
  assert.equal(result.success, true);
});

test("accepts a valid URL item", () => {
  const result = navigationSchema.safeParse([{ label: "Docs", url: "https://example.com" }]);
  assert.equal(result.success, true);
});

test("rejects an empty label", () => {
  const result = navigationSchema.safeParse([{ label: "", pageId: PAGE_ID }]);
  assert.equal(result.success, false);
});

test("rejects an item with neither a page nor a URL", () => {
  const result = navigationSchema.safeParse([{ label: "Nowhere" }]);
  assert.equal(result.success, false);
});

test("rejects an item with both a page and a URL", () => {
  const result = navigationSchema.safeParse([
    { label: "Both", pageId: PAGE_ID, url: "https://example.com" },
  ]);
  assert.equal(result.success, false);
});

test("rejects a javascript: URL", () => {
  const result = navigationSchema.safeParse([{ label: "Bad", url: "javascript:alert(1)" }]);
  assert.equal(result.success, false);
});

test("rejects more than 20 items", () => {
  const items = Array.from({ length: NAV_MAX_ITEMS + 1 }, (_, index) => ({
    label: `Item ${index}`,
    pageId: PAGE_ID,
  }));
  const result = navigationSchema.safeParse(items);
  assert.equal(result.success, false);
});

test("accepts exactly 20 items", () => {
  const items = Array.from({ length: NAV_MAX_ITEMS }, (_, index) => ({
    label: `Item ${index}`,
    pageId: PAGE_ID,
  }));
  const result = navigationSchema.safeParse(items);
  assert.equal(result.success, true);
});
