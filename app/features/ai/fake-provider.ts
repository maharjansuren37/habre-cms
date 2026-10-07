import type { AiAdapter, AiError, GenerateResult } from "./run-generation.ts";
import { validProposal } from "./test-proposal.ts";

export type FakeOptions = {
  /** What the "model" answers; defaults to a valid proposal. */
  output?: unknown;
  costUsd?: number;
  /** Reject with this instead of answering. */
  error?: AiError;
};

/** A provider with no network, for tests and `ai:try --fake`. */
export function createFakeAdapter(options: FakeOptions = {}): AiAdapter {
  return {
    async generate(): Promise<GenerateResult> {
      if (options.error) throw options.error;
      return {
        output: "output" in options ? options.output : validProposal(),
        usage: { input: 1200, cacheRead: 0, cacheWrite: 0, output: 900 },
        costUsd: options.costUsd ?? 0.0421,
        provider: "fake",
        model: "fake-model",
      };
    },
  };
}
