import assert from "node:assert/strict";
import { test } from "node:test";
import { CHECK_WINDOW_MS, isDue } from "./own-domain-schedule.ts";

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const created = new Date("2026-10-12T00:00:00Z");

/** A domain `age` old, last checked `since` ago, asked about at that moment. */
function due(age: number, since: number | null): boolean {
  const now = new Date(created.getTime() + age);
  return isDue({
    createdAt: created,
    lastCheckedAt: since === null ? null : new Date(now.getTime() - since),
    now,
  });
}

test("the window is 24 hours", () => {
  assert.equal(CHECK_WINDOW_MS, 24 * HOUR);
});

test("under 10 minutes old, due after 1 minute and not after 30 seconds", () => {
  assert.equal(due(5 * MINUTE, MINUTE), true);
  assert.equal(due(5 * MINUTE, 30 * SECOND), false);
});

test("between 10 minutes and 2 hours old, due after 5 minutes and not after 4", () => {
  assert.equal(due(30 * MINUTE, 5 * MINUTE), true);
  assert.equal(due(30 * MINUTE, 4 * MINUTE), false);
});

test("after 2 hours old, due after 30 minutes and not after 29", () => {
  assert.equal(due(5 * HOUR, 30 * MINUTE), true);
  assert.equal(due(5 * HOUR, 29 * MINUTE), false);
});

test("never due once 24 hours old, even with no last check", () => {
  assert.equal(due(24 * HOUR, null), false);
  assert.equal(due(25 * HOUR, 10 * HOUR), false);
  assert.equal(due(24 * HOUR - SECOND, null), true);
});

test("a domain never checked is due at once", () => {
  assert.equal(due(0, null), true);
  assert.equal(due(3 * HOUR, null), true);
});

test("the interval changes exactly at 10 minutes and at 2 hours", () => {
  // 3 minutes since the last check: due under 10 minutes old (60 s), not at 10.
  assert.equal(due(10 * MINUTE - SECOND, 3 * MINUTE), true);
  assert.equal(due(10 * MINUTE, 3 * MINUTE), false);
  // 10 minutes since the last check: due under 2 hours old (5 min), at 2 h it is 30 min.
  assert.equal(due(2 * HOUR - SECOND, 10 * MINUTE), true);
  assert.equal(due(2 * HOUR, 10 * MINUTE), false);
});
