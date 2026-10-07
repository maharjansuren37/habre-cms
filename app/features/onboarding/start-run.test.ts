import assert from "node:assert/strict";
import { test } from "node:test";
import type { StartInput, StartResult } from "../ai/run-generation.ts";
import { createStartRun } from "./start-run.ts";

const input: StartInput = { kind: "blog", description: "A blog about secret recipes" };

function setup(refuse?: () => "busy" | "allowance" | null) {
  let calls = 0;
  let clock = 0;
  const logs: string[] = [];
  const runner = {
    async start(): Promise<StartResult> {
      calls += 1;
      const reason = refuse?.();
      return reason
        ? { ok: false, reason }
        : { ok: true, runId: `run-${calls}`, done: Promise.resolve() };
    },
  };
  const startRun = createStartRun({ runner, now: () => clock, log: (line) => logs.push(line) });
  return { startRun, logs, calls: () => calls, advance: (ms: number) => (clock += ms) };
}

test("the 11th start in the window is refused as daily and never reaches the runner", async () => {
  const { startRun, calls } = setup();
  for (let i = 0; i < 10; i += 1) assert.equal((await startRun("s1", "u1", input)).ok, true);
  assert.deepEqual(await startRun("s1", "u1", input), { ok: false, reason: "daily" });
  assert.equal(calls(), 10);
});

test("a refused start does not count towards the cap", async () => {
  let refusing = true;
  const { startRun } = setup(() => (refusing ? "busy" : null));
  for (let i = 0; i < 15; i += 1) {
    assert.deepEqual(await startRun("s1", "u1", input), { ok: false, reason: "busy" });
  }
  refusing = false;
  for (let i = 0; i < 10; i += 1) assert.equal((await startRun("s1", "u1", input)).ok, true);
});

test("the cap is per site", async () => {
  const { startRun } = setup();
  for (let i = 0; i < 10; i += 1) await startRun("s1", "u1", input);
  assert.equal((await startRun("s2", "u1", input)).ok, true);
});

test("a site can start again once the 24-hour window has ended", async () => {
  const { startRun, advance } = setup();
  for (let i = 0; i < 10; i += 1) await startRun("s1", "u1", input);
  assert.equal((await startRun("s1", "u1", input)).ok, false);
  advance(24 * 60 * 60 * 1000);
  assert.equal((await startRun("s1", "u1", input)).ok, true);
});

test("each refusal is logged with its reason and site, never the description", async () => {
  const { startRun, logs } = setup(() => "allowance");
  await startRun("s1", "u1", input);
  assert.equal(logs.length, 1);
  assert.deepEqual(JSON.parse(logs[0]), {
    event: "ai_run_refused",
    reason: "allowance",
    siteId: "s1",
  });
  assert.ok(!logs[0].includes("recipes"));
});
