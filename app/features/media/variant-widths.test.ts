import assert from "node:assert/strict";
import { test } from "node:test";
import { variantWidths } from "./variant-widths.ts";

test("a 3000 px original gets the four sizes", () => {
  assert.deepEqual(variantWidths(3000), [480, 960, 1600, 2400]);
});

test("a 2400 px original gets the four sizes and no extra", () => {
  assert.deepEqual(variantWidths(2400), [480, 960, 1600, 2400]);
});

test("a 2000 px original gets the sizes below it plus its own width", () => {
  assert.deepEqual(variantWidths(2000), [480, 960, 1600, 2000]);
});

test("a 1200 px original gets 480, 960 and 1200", () => {
  assert.deepEqual(variantWidths(1200), [480, 960, 1200]);
});

test("a 700 px original gets 480 and 700", () => {
  assert.deepEqual(variantWidths(700), [480, 700]);
});

test("a 480 px original gets only 480, never a duplicate", () => {
  assert.deepEqual(variantWidths(480), [480]);
});

test("a 300 px original gets only its own width", () => {
  assert.deepEqual(variantWidths(300), [300]);
});

test("a 961 px original gets 480, 960 and 961", () => {
  assert.deepEqual(variantWidths(961), [480, 960, 961]);
});
