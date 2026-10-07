import assert from "node:assert/strict";
import { test } from "node:test";
import {
  type AttemptRecord,
  classifyAttemptFailure,
  formatAttemptLine,
  formatSummary,
  median,
  summarise,
} from "./measure-summary.ts";
import { AiError } from "./run-generation.ts";

function record(over: Partial<AttemptRecord> = {}): AttemptRecord {
  return {
    provider: "openrouter",
    configuredModel: "m1",
    servedModel: "m1",
    kind: "website",
    attempt: 1,
    status: "succeeded",
    error: null,
    durationMs: 1000,
    usage: { input: 1, cacheRead: 0, cacheWrite: 0, output: 1 },
    costUsd: 0.01,
    credits: 10,
    pages: 3,
    sections: 9,
    expandsCleanly: true,
    ...over,
  };
}

test("the median of an odd count is the middle value", () => {
  assert.equal(median([9, 1, 5]), 5);
});

test("the median of an even count is the mean of the middle two", () => {
  assert.equal(median([4, 1, 3, 10]), 3.5);
});

test("a group reports runs, median and slowest duration", () => {
  const [group] = summarise([
    record({ durationMs: 3000 }),
    record({ durationMs: 1000 }),
    record({ durationMs: 2000 }),
    record({ durationMs: 10000 }),
  ]);
  assert.equal(group?.runs, 4);
  assert.equal(group?.medianDurationMs, 2500);
  assert.equal(group?.slowestDurationMs, 10000);
});

test("cost is averaged over records that have one, credits over all", () => {
  const [group] = summarise([
    record({ costUsd: 0.02, credits: 20 }),
    record({ costUsd: 0.04, credits: 40 }),
    record({ costUsd: null, credits: 0, status: "failed", error: "unavailable" }),
  ]);
  assert.ok(group?.meanCostUsd !== null && Math.abs((group?.meanCostUsd ?? 0) - 0.03) < 1e-12);
  assert.equal(group?.highestCostUsd, 0.04);
  assert.equal(group?.meanCredits, 20);
});

test("failures are counted by code", () => {
  const [group] = summarise([
    record(),
    record({ status: "failed", error: "invalid" }),
    record({ status: "failed", error: "invalid" }),
    record({ status: "failed", error: "timeout" }),
  ]);
  assert.deepEqual(group?.failures, { invalid: 2, timeout: 1 });
});

test("runs per 1,000 credits is 1000 over the mean credits", () => {
  const [group] = summarise([record({ credits: 30 }), record({ credits: 50 })]);
  assert.equal(group?.runsPer1000Credits, 25);
});

test("a provider whose every attempt failed with no cost has no NaN", () => {
  const [group] = summarise([
    record({ status: "failed", error: "unavailable", costUsd: null, credits: 0, usage: null }),
    record({ status: "failed", error: "unavailable", costUsd: null, credits: 0, usage: null }),
  ]);
  assert.equal(group?.meanCostUsd, null);
  assert.equal(group?.highestCostUsd, null);
  assert.equal(group?.meanCredits, 0);
  assert.equal(group?.runsPer1000Credits, null);
  assert.deepEqual(group?.failures, { unavailable: 2 });
  assert.doesNotMatch(
    formatSummary(summarise([record({ status: "failed", costUsd: null, credits: 0 })])),
    /NaN/,
  );
});

test("providers and models are summarised separately", () => {
  const groups = summarise([
    record({ provider: "openrouter", credits: 10 }),
    record({ provider: "anthropic", configuredModel: "c1", credits: 40 }),
    record({ provider: "openrouter", credits: 30 }),
  ]);
  assert.deepEqual(
    groups.map((g) => [g.provider, g.configuredModel, g.runs, g.meanCredits]),
    [
      ["openrouter", "m1", 2, 20],
      ["anthropic", "c1", 1, 40],
    ],
  );
});

test("an attempt whose own limit aborted it is a timeout even though the adapter said unavailable", () => {
  const unavailable = new AiError("unavailable", "The request was aborted.", { model: "m1" });
  assert.equal(classifyAttemptFailure(unavailable, true).error, "timeout");
  assert.equal(classifyAttemptFailure(unavailable, true).servedModel, "m1");
});

test("an unavailable provider that was not aborted stays unavailable", () => {
  const down = new AiError("unavailable", "OpenRouter answered 503.");
  assert.equal(classifyAttemptFailure(down, false).error, "unavailable");
  assert.equal(classifyAttemptFailure(new Error("x"), false).error, "broken");
  assert.equal(classifyAttemptFailure(new Error("x"), true).error, "timeout");
});

test("a succeeded attempt whose proposal does not expand is counted out of the succeeded ones", () => {
  const [group] = summarise([
    record(),
    record({ expandsCleanly: false }),
    record({ expandsCleanly: true }),
    record({ status: "failed", error: "invalid", expandsCleanly: false }),
  ]);
  assert.equal(group?.succeeded, 3);
  assert.equal(group?.expandsCleanly, 2);
  assert.match(
    formatSummary(summarise([record(), record({ expandsCleanly: false })])),
    /expands cleanly:\s+1 of 2/,
  );
});

test("the per-attempt line shows whether the proposal expanded and its tokens", () => {
  const usage = { input: 1200, cacheRead: 300, cacheWrite: 0, output: 4500 };
  assert.match(formatAttemptLine(record({ usage, expandsCleanly: false })), /does not expand/);
  assert.match(formatAttemptLine(record({ usage })), /expands cleanly/);
  assert.match(formatAttemptLine(record({ usage })), /tokens 1200\/300\/4500 \(in\/cached\/out\)/);
  assert.match(
    formatAttemptLine(record({ status: "failed", error: "timeout", usage: null })),
    /tokens -/,
  );
});
