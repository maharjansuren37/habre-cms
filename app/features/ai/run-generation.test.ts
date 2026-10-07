import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { createFakeAdapter } from "./fake-provider.ts";
import {
  type AiAdapter,
  AiError,
  createRunner,
  type GenerateResult,
  type RunOutcome,
  type RunStore,
  type StartInput,
} from "./run-generation.ts";
import { validProposal } from "./test-proposal.ts";

const input: StartInput = { kind: "business", description: "A bakery in Leeds." };
const NOW = new Date("2026-10-15T12:00:00Z");

function memoryStore(used = 0) {
  const rows: { id: string; siteId: string; status: string; outcome?: RunOutcome }[] = [];
  const sinces: Date[] = [];
  const store: RunStore = {
    async creditsUsedSince(_siteId, since) {
      sinces.push(since);
      return used;
    },
    async hasRunningRun(siteId) {
      return rows.some((r) => r.siteId === siteId && r.status === "running");
    },
    async insertRunning({ siteId }) {
      const id = `run-${rows.length + 1}`;
      rows.push({ id, siteId, status: "running" });
      return id;
    },
    async finish(_siteId, id, outcome) {
      const row = rows.find((r) => r.id === id);
      assert.ok(row);
      assert.equal(row.status, "running", "a run finishes once");
      row.status = outcome.status;
      row.outcome = outcome;
    },
  };
  return { store, rows, sinces };
}

function gate() {
  let release!: () => void;
  const opened = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { opened, release };
}

/** An adapter that answers like the fake, but only once its gate opens. */
function gatedAdapter(g: { opened: Promise<void> }): AiAdapter {
  const fake = createFakeAdapter();
  return {
    async generate(i, signal) {
      await g.opened;
      return fake.generate(i, signal);
    },
  };
}

function quiet() {
  mock.method(console, "info", () => {});
  mock.method(console, "error", () => {});
}

async function started(result: ReturnType<ReturnType<typeof createRunner>["start"]>) {
  const r = await result;
  assert.ok(r.ok, "expected the run to start");
  return r;
}

test("a success stores the proposal, usage, model, provider and credits", async (t) => {
  quiet();
  t.after(() => mock.restoreAll());
  const { store, rows, sinces } = memoryStore();
  const runner = createRunner({
    store,
    adapter: createFakeAdapter(),
    allowance: 1000,
    now: () => NOW,
  });
  const r = await started(runner.start("s1", "u1", input));
  assert.equal(rows[0]?.status, "running");
  await r.done;
  const outcome = rows[0]?.outcome;
  assert.equal(outcome?.status, "succeeded");
  assert.equal(outcome?.error, null);
  assert.equal(outcome?.credits, 43);
  assert.equal(outcome?.costUsd, 0.0421);
  assert.deepEqual(outcome?.result, validProposal());
  assert.equal(outcome?.provider, "fake");
  assert.equal(outcome?.model, "fake-model");
  assert.ok(outcome?.usage && outcome.usage.output > 0);
  assert.deepEqual(sinces[0], new Date("2026-10-01T00:00:00Z"));
});

test("a site at its allowance is refused before any row is written", async (t) => {
  quiet();
  t.after(() => mock.restoreAll());
  const { store, rows } = memoryStore(1000);
  const runner = createRunner({
    store,
    adapter: createFakeAdapter(),
    allowance: 1000,
    now: () => NOW,
  });
  assert.deepEqual(await runner.start("s1", "u1", input), { ok: false, reason: "allowance" });
  assert.equal(rows.length, 0);
});

test("a site with one credit left may start, and none means no limit", async (t) => {
  quiet();
  t.after(() => mock.restoreAll());
  const a = memoryStore(999);
  const one = await createRunner({
    store: a.store,
    adapter: createFakeAdapter(),
    allowance: 1000,
  }).start("s1", "u1", input);
  assert.ok(one.ok);
  await one.done;
  const b = memoryStore(10_000_000);
  const free = await createRunner({
    store: b.store,
    adapter: createFakeAdapter(),
    allowance: null,
  }).start("s1", "u1", input);
  assert.ok(free.ok);
  await free.done;
});

test("a third run while two are running is refused as busy and records nothing", async (t) => {
  quiet();
  t.after(() => mock.restoreAll());
  const { store, rows } = memoryStore();
  const g = gate();
  const runner = createRunner({ store, adapter: gatedAdapter(g), allowance: null });
  const first = await started(runner.start("s1", "u1", input));
  const second = await started(runner.start("s2", "u2", input));
  assert.deepEqual(await runner.start("s3", "u3", input), { ok: false, reason: "busy" });
  assert.equal(rows.length, 2);
  g.release();
  await Promise.all([first.done, second.done]);
});

test("the slot is released after a success, so a later run starts", async (t) => {
  quiet();
  t.after(() => mock.restoreAll());
  const { store } = memoryStore();
  const runner = createRunner({ store, adapter: createFakeAdapter(), allowance: null });
  for (const site of ["s1", "s2", "s3", "s4"]) {
    const r = await started(runner.start(site, "u", input));
    await r.done;
  }
});

test("a second run for a site whose first is still running is refused as busy", async (t) => {
  quiet();
  t.after(() => mock.restoreAll());
  const { store, rows } = memoryStore();
  const g = gate();
  const runner = createRunner({ store, adapter: gatedAdapter(g), allowance: null });
  const first = await started(runner.start("s1", "u1", input));
  assert.deepEqual(await runner.start("s1", "u2", input), { ok: false, reason: "busy" });
  assert.equal(rows.length, 1);
  g.release();
  await first.done;
  const again = await started(runner.start("s1", "u1", input));
  await again.done;
});

test("two starts for one site at the same moment: one runs, one is busy", async (t) => {
  quiet();
  t.after(() => mock.restoreAll());
  const { store, rows } = memoryStore();
  const runner = createRunner({ store, adapter: createFakeAdapter(), allowance: null });
  const [a, b] = await Promise.all([
    runner.start("s1", "u1", input),
    runner.start("s1", "u1", input),
  ]);
  assert.deepEqual([a.ok, b.ok].sort(), [false, true]);
  assert.equal(rows.length, 1);
  for (const r of [a, b]) if (r.ok) await r.done;
});

test("output failing the schema fails as invalid, charged the cost it reported, keeping usage", async (t) => {
  quiet();
  t.after(() => mock.restoreAll());
  const { store, rows } = memoryStore();
  const adapter = createFakeAdapter({ output: { pages: [] }, costUsd: 0.0421 });
  const runner = createRunner({ store, adapter, allowance: null });
  const r = await started(runner.start("s1", "u1", input));
  await r.done;
  const outcome = rows[0]?.outcome;
  assert.equal(outcome?.status, "failed");
  assert.equal(outcome?.error, "invalid");
  assert.equal(outcome?.credits, 43);
  assert.equal(outcome?.result, null);
  assert.equal(outcome?.costUsd, 0.0421);
  assert.ok(outcome?.usage);
});

for (const code of ["unavailable", "broken", "refused", "invalid"] as const) {
  test(`an adapter error of kind ${code} fails the run as ${code}, charged the cost it reported`, async (t) => {
    quiet();
    t.after(() => mock.restoreAll());
    const { store, rows } = memoryStore();
    const usage = { input: 10, cacheRead: 2, cacheWrite: 1, output: 3 };
    const error = new AiError(code, "nope", { usage, costUsd: 0.01, provider: "fake", model: "m" });
    const runner = createRunner({ store, adapter: createFakeAdapter({ error }), allowance: null });
    const r = await started(runner.start("s1", "u1", input));
    await r.done;
    const outcome = rows[0]?.outcome;
    assert.equal(outcome?.status, "failed");
    assert.equal(outcome?.error, code);
    assert.equal(outcome?.credits, 10); // US$0.01 is 10 credits
    assert.deepEqual(outcome?.usage, usage);
    assert.equal(outcome?.costUsd, 0.01);
    assert.equal(outcome?.model, "m");
  });
}

test("an adapter error that reported no cost is charged 0", async (t) => {
  quiet();
  t.after(() => mock.restoreAll());
  const { store, rows } = memoryStore();
  const error = new AiError("unavailable", "down");
  const runner = createRunner({ store, adapter: createFakeAdapter({ error }), allowance: null });
  const r = await started(runner.start("s1", "u1", input));
  await r.done;
  assert.equal(rows[0]?.outcome?.error, "unavailable");
  assert.equal(rows[0]?.outcome?.credits, 0);
  assert.equal(rows[0]?.outcome?.costUsd, null);
});

test("a run that fails releases its slot", async (t) => {
  quiet();
  t.after(() => mock.restoreAll());
  const { store } = memoryStore();
  const adapter = createFakeAdapter({ error: new AiError("unavailable", "down") });
  const runner = createRunner({ store, adapter, allowance: null });
  for (const site of ["s1", "s2", "s3", "s4"]) {
    const r = await started(runner.start(site, "u", input));
    await r.done;
  }
});

test("an unexpected throw from the adapter fails the run as broken", async (t) => {
  quiet();
  t.after(() => mock.restoreAll());
  const { store, rows } = memoryStore();
  const adapter: AiAdapter = {
    async generate(): Promise<GenerateResult> {
      throw new TypeError("bug");
    },
  };
  const r = await started(
    createRunner({ store, adapter, allowance: null }).start("s1", "u1", input),
  );
  await r.done;
  assert.equal(rows[0]?.outcome?.error, "broken");
});

test("a failing store.finish is logged and still releases the slot", async (t) => {
  quiet();
  t.after(() => mock.restoreAll());
  const { store } = memoryStore();
  store.finish = async () => {
    throw new Error("db down");
  };
  const runner = createRunner({ store, adapter: createFakeAdapter(), allowance: null });
  for (const site of ["s1", "s2", "s3"]) {
    const r = await started(runner.start(site, "u", input));
    await r.done;
  }
});

test("a run past 5 minutes fails as timeout, even if the adapter never settles", async (t) => {
  quiet();
  t.after(() => mock.restoreAll());
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { store, rows } = memoryStore();
  let signalSeen: AbortSignal | undefined;
  const adapter: AiAdapter = {
    generate(_i, signal) {
      signalSeen = signal;
      return new Promise<GenerateResult>(() => {});
    },
  };
  const runner = createRunner({ store, adapter, allowance: null });
  const r = await started(runner.start("s1", "u1", input));
  await Promise.resolve();
  t.mock.timers.tick(5 * 60 * 1000 - 1);
  assert.equal(rows[0]?.status, "running");
  t.mock.timers.tick(1);
  await r.done;
  assert.equal(signalSeen?.aborted, true);
  assert.equal(rows[0]?.outcome?.error, "timeout");
  assert.equal(rows[0]?.outcome?.credits, 0);
});

test("a timed-out run releases its slot", async (t) => {
  quiet();
  t.after(() => mock.restoreAll());
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { store } = memoryStore();
  const hang: AiAdapter = { generate: () => new Promise<GenerateResult>(() => {}) };
  const runner = createRunner({ store, adapter: hang, allowance: null, timeoutMs: 1000 });
  const sites = ["s1", "s2"];
  const runs = [];
  for (const site of sites) runs.push(await started(runner.start(site, "u", input)));
  assert.deepEqual(await runner.start("s3", "u", input), { ok: false, reason: "busy" });
  t.mock.timers.tick(1000);
  await Promise.all(runs.map((r) => r.done));
  const next = await runner.start("s3", "u", input);
  assert.ok(next.ok);
  t.mock.timers.tick(1000);
  await next.done;
});

test("the log line names the run, site, outcome and model but never the description", async (t) => {
  const lines: string[] = [];
  mock.method(console, "info", (line: string) => lines.push(line));
  t.after(() => mock.restoreAll());
  const { store } = memoryStore();
  const r = await started(
    createRunner({ store, adapter: createFakeAdapter(), allowance: null }).start("s1", "u1", input),
  );
  await r.done;
  assert.equal(lines.length, 1);
  const entry = JSON.parse(lines[0] ?? "");
  assert.equal(entry.event, "ai_run_finished");
  assert.equal(entry.runId, "run-1");
  assert.equal(entry.siteId, "s1");
  assert.equal(entry.outcome, "succeeded");
  assert.ok(!lines[0]?.includes("bakery"));
});

test("the adapter is handed the run's own id", async () => {
  const { store, rows } = memoryStore();
  const fake = createFakeAdapter();
  const seen: string[] = [];
  const adapter: AiAdapter = {
    generate(i, signal) {
      seen.push(i.runId);
      return fake.generate(i, signal);
    },
  };
  const r = await started(
    createRunner({ store, adapter, allowance: null }).start("s1", "u1", input),
  );
  await r.done;
  assert.deepEqual(seen, [rows[0]?.id]);
});
