import assert from "node:assert/strict";
import { test } from "node:test";
import { exitCodeFor, summaryLine } from "./optimise-media-summary.ts";

test("the summary names the three counts", () => {
  assert.equal(
    summaryLine({ optimised: 2, keptAsUploaded: 1, failed: 3 }),
    "optimised=2 kept_as_uploaded=1 failed=3",
  );
});

test("the exit code is 1 only when a row failed", () => {
  assert.equal(exitCodeFor({ optimised: 5, keptAsUploaded: 1, failed: 0 }), 0);
  assert.equal(exitCodeFor({ optimised: 5, keptAsUploaded: 1, failed: 1 }), 1);
});
