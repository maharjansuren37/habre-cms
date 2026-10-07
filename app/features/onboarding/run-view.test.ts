import assert from "node:assert/strict";
import { test } from "node:test";
import { runView } from "./run-view.ts";

const now = new Date("2026-10-07T12:00:00Z");
const ago = (seconds: number) => new Date(now.getTime() - seconds * 1000);

test("a running run shows the seconds since it started", () => {
  assert.deepEqual(runView({ status: "running", error: null, createdAt: ago(42) }, now), {
    state: "running",
    error: null,
    seconds: 42,
    canRetry: false,
  });
});

test("a running run older than six minutes is shown as failed with a timeout", () => {
  const view = runView({ status: "running", error: null, createdAt: ago(6 * 60 + 1) }, now);
  assert.equal(view.state, "failed");
  assert.equal(view.error, "timeout");
  assert.equal(view.canRetry, true);
});

test("a running run at exactly six minutes is still running", () => {
  assert.equal(
    runView({ status: "running", error: null, createdAt: ago(360) }, now).state,
    "running",
  );
});

test("a failed run may be retried, except a refused one", () => {
  for (const error of ["unavailable", "broken", "invalid", "timeout"]) {
    const view = runView({ status: "failed", error, createdAt: ago(100) }, now);
    assert.equal(view.state, "failed");
    assert.equal(view.canRetry, true, error);
  }
  const refused = runView({ status: "failed", error: "refused", createdAt: ago(100) }, now);
  assert.equal(refused.canRetry, false);
});

test("succeeded and applied runs cannot be retried", () => {
  for (const status of ["succeeded", "applied"] as const) {
    const view = runView({ status, error: null, createdAt: ago(100) }, now);
    assert.equal(view.state, status);
    assert.equal(view.canRetry, false);
  }
});
