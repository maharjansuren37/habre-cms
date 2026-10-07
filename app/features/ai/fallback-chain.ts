/**
 * The provider fallback chain (18b2 Step 5): tries each provider in order and
 * moves on only when one is `unavailable`. Every other outcome is final - a
 * refusal or a bad request would be the same at the next provider, and moving
 * on would pay twice. Every provider but the last runs under its own limit so
 * one that hangs cannot use up the whole run; the last gets what is left of it.
 * An `unavailable` attempt reports no cost, so nothing is carried forward.
 * The log line names the run and the providers, never the description.
 */
import { type AiAdapter, AiError, type GenerateInput } from "./run-generation.ts";

export const ATTEMPT_TIMEOUT_MS = 150_000;

export type ChainEntry = { name: string; adapter: AiAdapter };
export type ChainOptions = {
  attemptTimeoutMs?: number;
  /** Where a move is logged; defaults to `console.info`. */
  log?: (line: string) => void;
};

/** One attempt under its own limit, combined with the run's signal. */
async function attemptWithLimit(
  name: string,
  adapter: AiAdapter,
  input: GenerateInput,
  runSignal: AbortSignal,
  limitMs: number,
) {
  const controller = new AbortController();
  const onRunAbort = () => controller.abort();
  runSignal.addEventListener("abort", onRunAbort, { once: true });
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onRunAbortReject: (() => void) | undefined;
  const stopped = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new AiError("unavailable", `${name} did not answer within the attempt limit.`));
    }, limitMs);
    onRunAbortReject = () => reject(new AiError("unavailable", "The run was aborted."));
    runSignal.addEventListener("abort", onRunAbortReject, { once: true });
  });
  stopped.catch(() => {}); // the loser of the race is not an unhandled rejection
  try {
    const call = adapter.generate(input, controller.signal);
    call.catch(() => {}); // an abandoned attempt may reject long after
    return await Promise.race([call, stopped]);
  } finally {
    clearTimeout(timer);
    runSignal.removeEventListener("abort", onRunAbort);
    if (onRunAbortReject) runSignal.removeEventListener("abort", onRunAbortReject);
  }
}

export function createFallbackChain(entries: ChainEntry[], options: ChainOptions = {}): AiAdapter {
  const limitMs = options.attemptTimeoutMs ?? ATTEMPT_TIMEOUT_MS;
  const log = options.log ?? ((line: string) => console.info(line));

  return {
    async generate(input: GenerateInput, signal: AbortSignal) {
      let lastError: AiError | null = null;
      for (const [index, entry] of entries.entries()) {
        if (signal.aborted) {
          throw lastError ?? new AiError("unavailable", "The run was aborted.");
        }
        const next = entries[index + 1];
        try {
          return next
            ? await attemptWithLimit(entry.name, entry.adapter, input, signal, limitMs)
            : await entry.adapter.generate(input, signal);
        } catch (error) {
          if (!(error instanceof AiError) || error.code !== "unavailable") throw error;
          log(
            JSON.stringify({
              event: "ai_provider_unavailable",
              runId: input.runId,
              from: entry.name,
              to: signal.aborted ? null : (next?.name ?? null),
              reason: error.message,
            }),
          );
          if (!next || signal.aborted) throw error;
          lastError = error;
        }
      }
      throw lastError ?? new AiError("broken", "No AI provider is configured.");
    },
  };
}
