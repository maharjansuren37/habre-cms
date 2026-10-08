import assert from "node:assert/strict";
import { test } from "node:test";
import { allowanceSummary } from "./allowance-summary.ts";

const OCT = new Date("2026-10-08T10:00:00Z");

test("nothing used reads 0%", () => {
  assert.deepEqual(allowanceSummary(0, 1000, OCT), {
    text: "0% of this month's AI allowance used. Renews on 1 November.",
    value: 0,
    max: 1000,
  });
});

test("a quarter used reads 25% with its value", () => {
  const summary = allowanceSummary(250, 1000, OCT);
  assert.equal(summary.text, "25% of this month's AI allowance used. Renews on 1 November.");
  assert.equal(summary.value, 250);
});

test("999 of 1,000 rounds down to 99%", () => {
  assert.match(allowanceSummary(999, 1000, OCT).text, /^99% /);
});

test("over the allowance reads 100% and the value stops at the maximum", () => {
  const summary = allowanceSummary(1040, 1000, OCT);
  assert.match(summary.text, /^100% /);
  assert.equal(summary.value, 1000);
  assert.equal(summary.max, 1000);
});

test("no limit has no meter", () => {
  assert.deepEqual(allowanceSummary(500, null, OCT), {
    text: "No monthly AI limit.",
    value: 0,
    max: null,
  });
});

test("in December the allowance renews on 1 January", () => {
  const summary = allowanceSummary(10, 1000, new Date("2026-12-31T23:00:00Z"));
  assert.match(summary.text, /Renews on 1 January\.$/);
});
