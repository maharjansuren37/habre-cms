import { type AiAdapter, AiError, type GenerateResult } from "./run-generation.ts";
import { validProposal } from "./test-proposal.ts";

export type FakeOptions = {
  /** What the "model" answers; defaults to a valid proposal. */
  output?: unknown;
  costUsd?: number;
  /** Reject with this instead of answering. */
  error?: AiError;
  /** Wait this long before answering, stopping early if aborted. Default 0. */
  delayMs?: number;
};

/** Resolves after `ms`, or rejects as soon as the signal aborts. */
function wait(ms: number, signal: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * A provider with no network, for tests, `ai:try --fake` and the browser
 * tests (`AI_PROVIDERS=fake`). The description can ask for an outcome:
 * `[fake:refused]`, `[fake:unavailable]` or `[fake:invalid]` (answers `{}`).
 */
export function createFakeAdapter(options: FakeOptions = {}): AiAdapter {
  return {
    async generate(input, signal): Promise<GenerateResult> {
      await wait(options.delayMs ?? 0, signal);
      if (options.error) throw options.error;
      if (input.description.includes("[fake:refused]")) {
        throw new AiError("refused", "fake refusal");
      }
      if (input.description.includes("[fake:unavailable]")) {
        throw new AiError("unavailable", "fake outage");
      }
      const invalid = input.description.includes("[fake:invalid]");
      return {
        output: invalid ? {} : "output" in options ? options.output : validProposal(),
        usage: { input: 1200, cacheRead: 0, cacheWrite: 0, output: 900 },
        costUsd: options.costUsd ?? 0.0421,
        provider: "fake",
        model: "fake-model",
      };
    },
  };
}
