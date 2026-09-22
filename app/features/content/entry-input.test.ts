import assert from "node:assert/strict";
import { test } from "node:test";
import { parseEntryForm } from "./entry-form-input.ts";
import { entryInputSchema } from "./entry-input.ts";

const blocks = [{ id: "a", type: "text" as const, data: { text: [{ text: "Hello" }] } }];

test("a title is trimmed before it is stored", () => {
  const result = entryInputSchema.parse({ title: "  Hello  ", blocks });
  assert.equal(result.title, "Hello");
});

test("a post with no title is refused, and the message says what to do", () => {
  const result = entryInputSchema.safeParse({ title: "   ", blocks });
  assert.equal(result.success, false);
  assert.equal(result.error?.issues[0].message, "Give it a title before saving.");
});

test("a title longer than the column allows is refused", () => {
  const result = entryInputSchema.safeParse({ title: "a".repeat(201), blocks });
  assert.equal(result.success, false);
  assert.match(result.error?.issues[0].message ?? "", /200 characters/);
});

test("more blocks than one post should hold are refused", () => {
  const many = Array.from({ length: 201 }, (_, index) => ({
    id: `b${index}`,
    type: "text" as const,
    data: { text: [{ text: "x" }] },
  }));
  assert.equal(entryInputSchema.safeParse({ title: "Fine", blocks: many }).success, false);
  assert.equal(entryInputSchema.safeParse({ title: "Fine", blocks }).success, true);
});

test("a post with no blocks at all is allowed - an empty draft is a real thing", () => {
  assert.equal(entryInputSchema.safeParse({ title: "Just a title", blocks: [] }).success, true);
});

test("a submission with no blocks field is refused, not read as an empty post", () => {
  // A native submit carries no blocks part, which used to wipe a saved body (F-34).
  const withoutBlocks = new FormData();
  withoutBlocks.set("title", "Still has a body");
  const missing = parseEntryForm(withoutBlocks);
  assert.equal(missing.ok, false);
  assert.match(missing.ok === false ? missing.message : "", /had not finished loading/);

  // An empty post is still legal when the editor actually sent one.
  const withEmptyBlocks = new FormData();
  withEmptyBlocks.set("title", "Just a title");
  withEmptyBlocks.set("blocks", JSON.stringify({ blocks: [] }));
  assert.equal(parseEntryForm(withEmptyBlocks).ok, true);
});

test("a title carrying a character the database cannot store is refused, not left to the insert", () => {
  // PostgreSQL rejects U+0000 in a text column, so this used to answer 500 (F-47).
  const result = entryInputSchema.safeParse({ title: "Hello\u0000there", blocks });
  assert.equal(result.success, false);
  assert.equal(
    result.error?.issues[0].message,
    "The title has a character that cannot be stored. Remove it and save again.",
  );
});
