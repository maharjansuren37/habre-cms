import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { createFakeAdapter } from "./fake-provider.ts";
import { createProviderAdapter } from "./providers.server.ts";
import { createRunner, type RunOutcome, type RunStore, type StartInput } from "./run-generation.ts";

function memoryStore() {
  const outcomes: RunOutcome[] = [];
  const store: RunStore = {
    async creditsUsedSince() {
      return 0;
    },
    async hasRunningRun() {
      return false;
    },
    async insertRunning() {
      return "run-1";
    },
    async finish(_siteId, _id, outcome) {
      outcomes.push(outcome);
    },
  };
  return { store, outcomes };
}

async function runWith(description: string) {
  mock.method(console, "info", () => {});
  mock.method(console, "error", () => {});
  const { store, outcomes } = memoryStore();
  const runner = createRunner({ store, adapter: createFakeAdapter(), allowance: null });
  const input: StartInput = { kind: "business", description };
  const r = await runner.start("s1", "u1", input);
  assert.ok(r.ok);
  await r.done;
  mock.restoreAll();
  return outcomes[0];
}

test("a description without a marker succeeds", async () => {
  assert.equal((await runWith("A bakery in Leeds."))?.status, "succeeded");
});

test("[fake:refused] fails the run as refused", async () => {
  const outcome = await runWith("A bakery [fake:refused]");
  assert.equal(outcome?.status, "failed");
  assert.equal(outcome?.error, "refused");
});

test("[fake:unavailable] fails the run as unavailable", async () => {
  const outcome = await runWith("A bakery [fake:unavailable]");
  assert.equal(outcome?.status, "failed");
  assert.equal(outcome?.error, "unavailable");
});

test("[fake:invalid] answers {} and fails the run as invalid", async () => {
  const outcome = await runWith("A bakery [fake:invalid]");
  assert.equal(outcome?.status, "failed");
  assert.equal(outcome?.error, "invalid");
});

test("delayMs waits before answering and stops when aborted", async () => {
  const adapter = createFakeAdapter({ delayMs: 10_000 });
  const controller = new AbortController();
  const answer = adapter.generate(
    { runId: "r", kind: "blog", description: "x" },
    controller.signal,
  );
  controller.abort();
  await assert.rejects(answer);
});

test("createProviderAdapter maps fake to the fake adapter, which waits a second", async () => {
  const adapter = createProviderAdapter({ name: "fake" });
  const started = Date.now();
  const result = await adapter.generate(
    { runId: "r", kind: "blog", description: "A blog about bread." },
    new AbortController().signal,
  );
  assert.equal(result.provider, "fake");
  assert.ok(Date.now() - started >= 900);
});
