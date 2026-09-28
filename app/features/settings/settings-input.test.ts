import assert from "node:assert/strict";
import { test } from "node:test";
import { homePageIdSchema, logoMediaIdSchema, siteTitleSchema } from "./settings-input.ts";

test("site title rejects an empty string", () => {
  const result = siteTitleSchema.safeParse("");
  assert.equal(result.success, false);
});

test("site title rejects more than 200 characters", () => {
  const result = siteTitleSchema.safeParse("a".repeat(201));
  assert.equal(result.success, false);
});

test("site title trims surrounding whitespace", () => {
  const result = siteTitleSchema.safeParse("  My Site  ");
  assert.equal(result.success, true);
  assert.equal(result.data, "My Site");
});

test("logo media id accepts a real UUID", () => {
  const result = logoMediaIdSchema.safeParse("3fa85f64-5717-4562-b3fc-2c963f66afa6");
  assert.equal(result.success, true);
});

test("logo media id accepts null", () => {
  const result = logoMediaIdSchema.safeParse(null);
  assert.equal(result.success, true);
});

test("logo media id rejects a non-UUID string", () => {
  const result = logoMediaIdSchema.safeParse("not-a-uuid");
  assert.equal(result.success, false);
});

test("home page id parses an empty string (Latest posts) to null", () => {
  const result = homePageIdSchema.safeParse("");
  assert.deepEqual(result, { success: true, data: null });
});

test("home page id passes a real UUID through unchanged", () => {
  const result = homePageIdSchema.safeParse("3fa85f64-5717-4562-b3fc-2c963f66afa6");
  assert.deepEqual(result, { success: true, data: "3fa85f64-5717-4562-b3fc-2c963f66afa6" });
});

test("home page id rejects a malformed id", () => {
  const result = homePageIdSchema.safeParse("not-a-uuid");
  assert.equal(result.success, false);
});
