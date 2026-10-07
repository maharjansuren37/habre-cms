import assert from "node:assert/strict";
import { test } from "node:test";
import type { Price } from "#app/lib/ai-env.server.ts";
import { creditsFromCostUsd } from "./credits.ts";
import { costFromUsage } from "./pricing.ts";

const opus: Price = { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 };

test("2,000 input tokens (1,800 cache reads) and 1,500 output cost US$0.03116, 32 credits", () => {
  const cost = costFromUsage({ input: 2000, cacheRead: 1800, cacheWrite: 0, output: 1500 }, opus);
  assert.equal(Math.round(cost * 1e6), 31160);
  assert.equal(creditsFromCostUsd(cost), 32);
});

test("cache writes are priced at the cache write rate, not the input rate", () => {
  const cost = costFromUsage({ input: 1000, cacheRead: 0, cacheWrite: 400, output: 0 }, opus);
  assert.equal(Math.round(cost * 1e6), 600 * 4 + 400 * 5);
});

test("a zero usage costs 0", () => {
  assert.equal(costFromUsage({ input: 0, cacheRead: 0, cacheWrite: 0, output: 0 }, opus), 0);
});

test("cache counts that exceed the input are refused", () => {
  assert.throws(
    () => costFromUsage({ input: 100, cacheRead: 80, cacheWrite: 30, output: 0 }, opus),
    /cache/i,
  );
});

test("a negative or non-finite count is refused", () => {
  const ok = { input: 10, cacheRead: 0, cacheWrite: 0, output: 10 };
  assert.throws(() => costFromUsage({ ...ok, output: -1 }, opus), /usage/i);
  assert.throws(() => costFromUsage({ ...ok, input: Number.NaN }, opus), /usage/i);
  assert.throws(
    () => costFromUsage({ ...ok, cacheRead: Number.POSITIVE_INFINITY }, opus),
    /usage/i,
  );
  assert.throws(() => costFromUsage({ ...ok, cacheWrite: -5 }, opus), /usage/i);
});
