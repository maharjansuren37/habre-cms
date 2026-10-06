import assert from "node:assert/strict";
import { test } from "node:test";
import { seoDescriptionSchema, seoTitleSchema, titleSchema } from "./entry-input.ts";

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

test("a search title is trimmed, and empty means use the title", () => {
  assert.equal(seoTitleSchema.parse("  Hello  "), "Hello");
  assert.equal(seoTitleSchema.parse("   "), "");
});

test("a search title of 200 characters is kept and 201 is refused naming the field", () => {
  assert.equal(seoTitleSchema.safeParse("a".repeat(200)).success, true);
  const refused = seoTitleSchema.safeParse("a".repeat(201));
  assert.equal(refused.success, false);
  assert.match(refused.error?.issues[0]?.message ?? "", /Title in search results/);
});

test("a search title with a character the database cannot store is refused", () => {
  assert.equal(seoTitleSchema.safeParse("a\u0000b").success, false);
});

test("a description is trimmed, and empty means none", () => {
  assert.equal(seoDescriptionSchema.parse("  About us  "), "About us");
  assert.equal(seoDescriptionSchema.parse(""), "");
});

test("a description of 300 characters is kept and 301 is refused naming the field", () => {
  assert.equal(seoDescriptionSchema.safeParse("a".repeat(300)).success, true);
  const refused = seoDescriptionSchema.safeParse("a".repeat(301));
  assert.equal(refused.success, false);
  assert.match(refused.error?.issues[0]?.message ?? "", /Description/);
});

test("a description with a character the database cannot store is refused", () => {
  assert.equal(seoDescriptionSchema.safeParse("a\u0000b").success, false);
});
