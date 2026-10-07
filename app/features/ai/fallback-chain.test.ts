import assert from "node:assert/strict";
import { getEventListeners } from "node:events";
import { test } from "node:test";
import { ATTEMPT_TIMEOUT_MS, createFallbackChain } from "./fallback-chain.ts";
import {
  type AiAdapter,
  AiError,
  type GenerateInput,
  type GenerateResult,
} from "./run-generation.ts";

const SECRET = "my very private bakery";
const input: GenerateInput = { runId: "run-7", kind: "business", description: SECRET };

const result = (provider: string): GenerateResult => ({
  output: { ok: true },
  usage: { input: 1, cacheRead: 0, cacheWrite: 0, output: 1 },
  costUsd: 0.01,
  provider,
  model: `${provider}-model`,
});

type Probe = AiAdapter & { calls: number; signals: AbortSignal[] };
function probe(behave: (signal: AbortSignal) => Promise<GenerateResult>): Probe {
  const p: Probe = {
    calls: 0,
    signals: [],
    generate(_input, signal) {
      p.calls += 1;
      p.signals.push(signal);
      return behave(signal);
    },
  };
  return p;
}
const answers = (provider: string) => probe(async () => result(provider));
const fails = (error: AiError) =>
  probe(async () => {
    throw error;
  });
const hangs = () => probe(() => new Promise<GenerateResult>(() => {}));

function chain(entries: [string, AiAdapter][], attemptTimeoutMs = 20) {
  const lines: string[] = [];
  const adapter = createFallbackChain(
    entries.map(([name, a]) => ({ name, adapter: a })),
    { attemptTimeoutMs, log: (line) => lines.push(line) },
  );
  return { adapter, lines };
}

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new assert.AssertionError({ message: "expected a rejection" });
}

const noAbort = () => new AbortController().signal;

test("the attempt limit is 150 seconds", () => {
  assert.equal(ATTEMPT_TIMEOUT_MS, 150_000);
});

test("an unavailable first provider moves to the second, whose result is returned", async () => {
  const second = answers("openai");
  const { adapter, lines } = chain([
    ["openrouter", fails(new AiError("unavailable", "OpenRouter answered 503."))],
    ["openai", second],
  ]);
  const got = await adapter.generate(input, noAbort());
  assert.equal(got.provider, "openai");
  assert.equal(second.calls, 1);
  assert.equal(lines.length, 1);
  assert.deepEqual(JSON.parse(lines[0] ?? ""), {
    event: "ai_provider_unavailable",
    runId: "run-7",
    from: "openrouter",
    to: "openai",
    reason: "OpenRouter answered 503.",
  });
});

test("a refused, broken or invalid first answer never calls the second", async () => {
  for (const code of ["refused", "broken", "invalid"] as const) {
    const second = answers("openai");
    const error = new AiError(code, "nope", { costUsd: 0.5 });
    const { adapter, lines } = chain([
      ["openrouter", fails(error)],
      ["openai", second],
    ]);
    assert.equal(await rejection(adapter.generate(input, noAbort())), error, code);
    assert.equal(second.calls, 0, code);
    assert.equal(lines.length, 0, code);
  }
});

test("a throw that is not an AiError is final", async () => {
  const second = answers("openai");
  const boom = new TypeError("boom");
  const { adapter } = chain([
    ["openrouter", probe(async () => Promise.reject(boom))],
    ["openai", second],
  ]);
  assert.equal(await rejection(adapter.generate(input, noAbort())), boom);
  assert.equal(second.calls, 0);
});

test("all unavailable rethrows the last error and logs a move for each", async () => {
  const last = new AiError("unavailable", "OpenAI answered 500.");
  const { adapter, lines } = chain([
    ["openrouter", fails(new AiError("unavailable", "OpenRouter answered 503."))],
    ["anthropic", fails(new AiError("unavailable", "Anthropic answered 529."))],
    ["openai", fails(last)],
  ]);
  assert.equal(await rejection(adapter.generate(input, noAbort())), last);
  const logged = lines.map((l) => JSON.parse(l));
  assert.deepEqual(
    logged.map((l) => [l.from, l.to]),
    [
      ["openrouter", "anthropic"],
      ["anthropic", "openai"],
      ["openai", null],
    ],
  );
});

test("a first adapter that never settles is abandoned at its limit and the second runs", async () => {
  const first = hangs();
  const second = answers("anthropic");
  const { adapter, lines } = chain([
    ["openrouter", first],
    ["anthropic", second],
  ]);
  const got = await adapter.generate(input, noAbort());
  assert.equal(got.provider, "anthropic");
  assert.equal(first.signals[0]?.aborted, true, "the abandoned attempt is told to stop");
  assert.equal(second.signals[0]?.aborted, false);
  const line = JSON.parse(lines[0] ?? "");
  assert.equal(line.from, "openrouter");
  assert.equal(line.to, "anthropic");
  assert.equal(line.reason, "openrouter did not answer within the attempt limit.");
});

test("the last entry has no attempt limit of its own", async () => {
  const slow = probe(
    () => new Promise<GenerateResult>((resolve) => setTimeout(() => resolve(result("openai")), 60)),
  );
  const { adapter } = chain([["openai", slow]], 20);
  assert.equal((await adapter.generate(input, noAbort())).provider, "openai");
});

test("an aborted run signal calls no later adapter", async () => {
  const controller = new AbortController();
  const first = probe((signal) => {
    controller.abort();
    return new Promise<GenerateResult>((_, reject) =>
      signal.addEventListener("abort", () =>
        reject(new AiError("unavailable", "The request was aborted.")),
      ),
    );
  });
  const second = answers("openai");
  const { adapter } = chain(
    [
      ["openrouter", first],
      ["openai", second],
    ],
    10_000,
  );
  const error = await rejection(adapter.generate(input, controller.signal));
  assert.ok(error instanceof AiError);
  assert.equal(second.calls, 0);
});

test("a run already aborted calls nothing", async () => {
  const controller = new AbortController();
  controller.abort();
  const only = answers("openai");
  const { adapter } = chain([["openai", only]]);
  const error = await rejection(adapter.generate(input, controller.signal));
  assert.ok(error instanceof AiError);
  assert.equal(error.code, "unavailable");
  assert.equal(only.calls, 0);
});

test("a chain of one behaves as its adapter", async () => {
  const ok = chain([["openai", answers("openai")]]);
  assert.equal((await ok.adapter.generate(input, noAbort())).provider, "openai");
  assert.equal(ok.lines.length, 0);

  const error = new AiError("refused", "no", { costUsd: 0.2, provider: "openai" });
  const refused = chain([["openai", fails(error)]]);
  assert.equal(await rejection(refused.adapter.generate(input, noAbort())), error);

  const down = new AiError("unavailable", "OpenAI answered 500.");
  const unavailable = chain([["openai", fails(down)]]);
  assert.equal(await rejection(unavailable.adapter.generate(input, noAbort())), down);
});

test("every log line has the run id, from and to, and never the description", async () => {
  const { adapter, lines } = chain([
    ["openrouter", fails(new AiError("unavailable", "OpenRouter answered 503."))],
    ["anthropic", hangs()],
    ["openai", fails(new AiError("unavailable", "OpenAI answered 500."))],
  ]);
  await rejection(adapter.generate(input, noAbort()));
  assert.equal(lines.length, 3);
  for (const line of lines) {
    const parsed = JSON.parse(line);
    assert.equal(parsed.runId, "run-7");
    assert.ok("from" in parsed && "to" in parsed);
    assert.ok(!line.includes(SECRET));
  }
});

test("a run aborted during a non-last attempt logs no move and calls no later provider", async () => {
  const run = new AbortController();
  const first = hangs();
  const second = hangs();
  const third = hangs();
  const { adapter, lines } = chain(
    [
      ["anthropic", first],
      ["openai", second],
      ["google", third],
    ],
    10_000,
  );
  const pending = rejection(adapter.generate(input, run.signal));
  setTimeout(() => run.abort(), 20);
  await pending;
  assert.equal(lines.length, 1);
  assert.equal(JSON.parse(lines[0] as string).from, "anthropic");
  assert.equal(JSON.parse(lines[0] as string).to, null);
  assert.equal(second.calls, 0);
  assert.equal(third.calls, 0);
});

test("the chain leaves no abort listener on the run signal after an attempt", async () => {
  const run = new AbortController();
  const { adapter } = chain([
    ["anthropic", answers("anthropic")],
    ["openai", answers("openai")],
  ]);
  assert.equal(getEventListeners(run.signal, "abort").length, 0);
  await adapter.generate(input, run.signal);
  assert.equal(getEventListeners(run.signal, "abort").length, 0);
});

test("a provider that throws synchronously leaves no abort listener and is rethrown", async () => {
  const run = new AbortController();
  const boom = new Error("sync boom");
  const throwing: AiAdapter = {
    generate() {
      throw boom;
    },
  };
  const { adapter } = chain([
    ["anthropic", throwing],
    ["openai", answers("openai")],
  ]);
  assert.equal(await rejection(adapter.generate(input, run.signal)), boom);
  assert.equal(getEventListeners(run.signal, "abort").length, 0);
});
