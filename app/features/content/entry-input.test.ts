import assert from "node:assert/strict";
import { test } from "node:test";
import { titleSchema } from "./entry-input.ts";

test("a title is trimmed before it is stored", () => {
  assert.equal(titleSchema.parse("  Hello  "), "Hello");
});

test("an entry with no title is refused, and the message says what to do", () => {
  const result = titleSchema.safeParse("   ");
  assert.equal(result.success, false);
  assert.equal(result.error?.issues[0].message, "Give it a title before saving.");
});

test("a title longer than the column allows is refused", () => {
  const result = titleSchema.safeParse("a".repeat(201));
  assert.equal(result.success, false);
  assert.match(result.error?.issues[0].message ?? "", /200 characters/);
});

test("a title carrying a character the database cannot store is refused, not left to the insert", () => {
  // PostgreSQL rejects U+0000 in a text column, so this used to answer 500 (F-47).
  const result = titleSchema.safeParse("Hello\u0000there");
  assert.equal(result.success, false);
  assert.equal(
    result.error?.issues[0].message,
    "The title has a character that cannot be stored. Remove it and save again.",
  );
});
