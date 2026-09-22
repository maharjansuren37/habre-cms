import assert from "node:assert/strict";
import { test } from "node:test";
import { nextFreeSlug, slugFromTitle } from "./slug.ts";

test("a title becomes lowercase words joined by hyphens", () => {
  assert.equal(slugFromTitle("Hello, World!", "post"), "hello-world");
});

test("accents are folded rather than dropped", () => {
  assert.equal(slugFromTitle("Café life in Zürich", "post"), "cafe-life-in-zurich");
});

test("a long title is cut to 80 characters with no trailing hyphen", () => {
  const slug = slugFromTitle("word ".repeat(60), "post");
  assert.ok(slug.length <= 80, `expected at most 80 characters, got ${slug.length}`);
  assert.doesNotMatch(slug, /-$/);
});

test("a title with nothing usable in it falls back to the entry type's own name", () => {
  assert.equal(slugFromTitle("!!! ??? ...", "post"), "post");
  assert.equal(slugFromTitle("", "post"), "post");
  assert.equal(slugFromTitle("", "page"), "page");
});

test("an unused address is returned unchanged", () => {
  assert.equal(nextFreeSlug("hello-world", ["something-else"]), "hello-world");
});

test("a taken address gets the next free number, starting at 2", () => {
  assert.equal(nextFreeSlug("hello-world", ["hello-world"]), "hello-world-2");
  assert.equal(nextFreeSlug("hello-world", ["hello-world", "hello-world-2"]), "hello-world-3");
});

test("numbering a taken address keeps it within the length limit", () => {
  const base = "a".repeat(80);
  const slug = nextFreeSlug(base, [base]);
  assert.ok(slug.length <= 80, `expected at most 80 characters, got ${slug.length}`);
  assert.match(slug, /-2$/);
});
