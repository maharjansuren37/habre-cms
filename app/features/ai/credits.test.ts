import assert from "node:assert/strict";
import { test } from "node:test";
import { creditsFromCostUsd, mayStartRun, startOfUtcMonth } from "./credits.ts";

test("US$0.0421 is 43 credits, rounded up", () => {
  assert.equal(creditsFromCostUsd(0.0421), 43);
});

test("exact multiples of US$0.001 are not rounded up by floating point", () => {
  assert.equal(creditsFromCostUsd(0.003), 3);
  assert.equal(creditsFromCostUsd(0.001), 1);
  assert.equal(creditsFromCostUsd(0.007), 7);
  assert.equal(creditsFromCostUsd(0.029), 29);
  assert.equal(creditsFromCostUsd(1), 1000);
});

test("any non-zero cost is at least 1 credit", () => {
  assert.equal(creditsFromCostUsd(0.000001), 1);
  assert.equal(creditsFromCostUsd(0.0000004), 1);
  assert.equal(creditsFromCostUsd(0.001001), 2);
});

test("a zero cost is 0 credits", () => {
  assert.equal(creditsFromCostUsd(0), 0);
});

test("a negative or non-finite cost is refused", () => {
  assert.throws(() => creditsFromCostUsd(-0.001), /cost/i);
  assert.throws(() => creditsFromCostUsd(Number.NaN), /cost/i);
  assert.throws(() => creditsFromCostUsd(Number.POSITIVE_INFINITY), /cost/i);
});

test("the month starts at midnight UTC on the 1st", () => {
  assert.equal(
    startOfUtcMonth(new Date("2026-10-31T23:59:59.999Z")).toISOString(),
    "2026-10-01T00:00:00.000Z",
  );
  assert.equal(
    startOfUtcMonth(new Date("2026-01-01T00:00:00.000Z")).toISOString(),
    "2026-01-01T00:00:00.000Z",
  );
  assert.equal(
    startOfUtcMonth(new Date("2026-12-15T12:00:00.000Z")).toISOString(),
    "2026-12-01T00:00:00.000Z",
  );
});

test("a run may start with 1 credit left and not with 0 left", () => {
  assert.equal(mayStartRun(999, 1000), true);
  assert.equal(mayStartRun(1000, 1000), false);
  assert.equal(mayStartRun(1500, 1000), false);
  assert.equal(mayStartRun(0, 1000), true);
});

test("no allowance (null) never refuses", () => {
  assert.equal(mayStartRun(1_000_000, null), true);
});
