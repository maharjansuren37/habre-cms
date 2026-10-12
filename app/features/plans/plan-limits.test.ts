import assert from "node:assert/strict";
import { test } from "node:test";
import { limitsFor, type PlanLimitsConfig, showsCredit } from "./plan-limits.ts";

const config: PlanLimitsConfig = {
  free: { storageBytes: 500, aiCredits: 1000 },
  launch: { storageBytes: 10_000, aiCredits: 6000 },
};

test("a free site gets the Free numbers", () => {
  assert.deepEqual(limitsFor("free", config), { storageBytes: 500, aiCredits: 1000 });
});

test("a paid site gets the Launch numbers", () => {
  assert.deepEqual(limitsFor("paid", config), { storageBytes: 10_000, aiCredits: 6000 });
});

test("none is null, per plan and per limit", () => {
  const none: PlanLimitsConfig = {
    free: { storageBytes: null, aiCredits: 1000 },
    launch: { storageBytes: 10_000, aiCredits: null },
  };
  assert.deepEqual(limitsFor("free", none), { storageBytes: null, aiCredits: 1000 });
  assert.deepEqual(limitsFor("paid", none), { storageBytes: 10_000, aiCredits: null });
});

test("only a free site shows the Made with Habre credit", () => {
  assert.equal(showsCredit("free"), true);
  assert.equal(showsCredit("paid"), false);
});
