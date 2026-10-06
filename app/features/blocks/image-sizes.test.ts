import assert from "node:assert/strict";
import { test } from "node:test";
import { imageSizes } from "./image-sizes.ts";

test("a one-column image is as wide as the reading column, or the screen less its gutters", () => {
  assert.equal(imageSizes(1), "(max-width: 54rem) calc(100vw - 3rem), 51rem");
});

test("a two-column image shares the reading column, and stacks below 43rem", () => {
  assert.equal(
    imageSizes(2),
    "(max-width: 43rem) calc(100vw - 3rem), (max-width: 54rem) calc((100vw - 5rem) / 2), 24.5rem",
  );
});

test("a three-column image shares the reading column, and stacks below 43rem", () => {
  assert.equal(
    imageSizes(3),
    "(max-width: 43rem) calc(100vw - 3rem), (max-width: 54rem) calc((100vw - 7rem) / 3), 15.67rem",
  );
});
