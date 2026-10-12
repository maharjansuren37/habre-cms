import assert from "node:assert/strict";
import { test } from "node:test";
import { parseSetPlanArgs } from "./set-plan-args.ts";

test("a valid address and plan are returned, the address trimmed and lowercased", () => {
  assert.deepEqual(parseSetPlanArgs({ address: " Lena ", plan: "paid" }), {
    address: "lena",
    plan: "paid",
  });
  assert.deepEqual(parseSetPlanArgs({ address: "lena", plan: "free" }), {
    address: "lena",
    plan: "free",
  });
});

test("a missing or blank address is refused naming --address", () => {
  assert.match(
    String((parseSetPlanArgs({ plan: "paid" }) as { error: string }).error),
    /--address/,
  );
  assert.match(
    String((parseSetPlanArgs({ address: "  ", plan: "paid" }) as { error: string }).error),
    /--address/,
  );
});

test("a missing plan is refused naming --plan", () => {
  assert.match(
    String((parseSetPlanArgs({ address: "lena" }) as { error: string }).error),
    /--plan/,
  );
});

test("any plan other than free or paid is refused naming both", () => {
  const result = parseSetPlanArgs({ address: "lena", plan: "launch" }) as { error: string };
  assert.match(result.error, /free/);
  assert.match(result.error, /paid/);
  assert.match(result.error, /launch/);
});
