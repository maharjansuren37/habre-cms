import assert from "node:assert/strict";
import { test } from "node:test";
import { createInFlightLimit } from "./in-flight-limit.ts";

test("slots are handed out up to the maximum, then refused", () => {
  const limit = createInFlightLimit(2);
  assert.equal(limit.tryAcquire(), true);
  assert.equal(limit.tryAcquire(), true);
  assert.equal(limit.tryAcquire(), false);
});

test("a released slot can be taken again", () => {
  const limit = createInFlightLimit(1);
  assert.equal(limit.tryAcquire(), true);
  limit.release();
  assert.equal(limit.tryAcquire(), true);
  assert.equal(limit.tryAcquire(), false);
});

test("an extra release does not create a slot beyond the maximum", () => {
  const limit = createInFlightLimit(1);
  limit.release();
  assert.equal(limit.tryAcquire(), true);
  assert.equal(limit.tryAcquire(), false);
});
