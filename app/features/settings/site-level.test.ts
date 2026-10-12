import assert from "node:assert/strict";
import { test } from "node:test";
import { readSiteLevel } from "./site-level.ts";

test("a stored pro reads as pro", () => {
  assert.equal(readSiteLevel("pro"), "pro");
});

test("a stored simple reads as simple", () => {
  assert.equal(readSiteLevel("simple"), "simple");
});

test("an unknown, empty or missing value reads as simple", () => {
  for (const value of ["admin", "PRO", "", null, undefined, 1]) {
    assert.equal(readSiteLevel(value), "simple");
  }
});
