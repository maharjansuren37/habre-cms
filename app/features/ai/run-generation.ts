/**
 * The run's lifecycle (18b1 Step 5, D154): checks the allowance, claims a slot,
 * records the run as running, and finishes it once in the background. Takes a
 * store and an adapter, so it imports no database and calls no provider; Step 6
 * supplies the database store, Step 7 the OpenRouter adapter.
 *
 * Slots live in the runner, so one runner per process holds the process-wide
 * limit of two and the one-run-per-site rule. Both are claimed synchronously,
 * before the first await, so two starts in the same tick cannot both pass. The
 * store's `hasRunningRun` is a second check against rows left by anything else.
 */
import { creditsFromCostUsd, mayStartRun, startOfUtcMonth } from "./credits.ts";
import { type Proposal, proposalSchema } from "./proposal.ts";

export type RunKind = "website" | "blog" | "business" | "portfolio";
export type AiErrorCode = "unavailable" | "broken" | "refused" | "invalid";
export type RunErrorCode = AiErrorCode | "timeout";
export type Usage = { input: number; cacheRead: number; cacheWrite: number; output: number };
export type GenerateInput = { runId: string; kind: RunKind; description: string };
/** What a caller hands the runner; the runner adds the run's id. */
export type StartInput = Omit<GenerateInput, "runId">;
export type GenerateResult = {
  output: unknown;
  usage: Usage;
  costUsd: number;
  provider: string;
  model: string;
};

/** One provider. Resolves a result or rejects with an `AiError`. */
export interface AiAdapter {
  generate(input: GenerateInput, signal: AbortSignal): Promise<GenerateResult>;
}

/** What a finished run records. A failed run is charged only the cost its provider reported. */
export type RunOutcome = {
  status: "succeeded" | "failed";
  error: RunErrorCode | null;
  result: Proposal | null;
  credits: number;
  usage: Usage | null;
  costUsd: number | null;
  provider: string | null;
  model: string | null;
};

/** Every method is scoped by `siteId` (D151); Step 6 runs each inside `inSite`. */
export interface RunStore {
  creditsUsedSince(siteId: string, since: Date): Promise<number>;
  hasRunningRun(siteId: string): Promise<boolean>;
  insertRunning(run: {
    siteId: string;
    userId: string;
    kind: RunKind;
    description: string;
  }): Promise<string>;
  finish(siteId: string, runId: string, outcome: RunOutcome): Promise<void>;
}

export type StartResult =
  | { ok: true; runId: string; done: Promise<void> }
  | { ok: false; reason: "busy" | "allowance" };

type AiErrorDetails = {
  usage: Usage;
  costUsd: number;
  provider: string;
  model: string;
};

/** A provider failure, sorted. Carries whatever usage and cost it reported. */
export class AiError extends Error {
  code: AiErrorCode;
  usage: Usage | null;
  costUsd: number | null;
  provider: string | null;
  model: string | null;
  constructor(code: AiErrorCode, message: string, details: Partial<AiErrorDetails> = {}) {
    super(message);
    this.name = "AiError";
    this.code = code;
    this.usage = details.usage ?? null;
    this.costUsd = details.costUsd ?? null;
    this.provider = details.provider ?? null;
    this.model = details.model ?? null;
  }
}

export const MAX_CONCURRENT_RUNS = 2;
export const RUN_TIMEOUT_MS = 5 * 60 * 1000;

export type RunnerOptions = {
  store: RunStore;
  adapter: AiAdapter;
  /** Credits a site may use per UTC month; `null` is no limit. */
  allowance: number | null;
  now?: () => Date;
  timeoutMs?: number;
};

type Reported = Pick<RunOutcome, "usage" | "costUsd" | "provider" | "model">;
const NOTHING_REPORTED: Reported = { usage: null, costUsd: null, provider: null, model: null };

/** Credits for a reported cost; 0 when none was reported or it cannot be priced. */
function creditsReported(costUsd: number | null): number {
  if (costUsd === null) return 0;
  try {
    return creditsFromCostUsd(costUsd);
  } catch {
    return 0;
  }
}

/** A failed run costs what the provider billed for it: a timeout or no reported cost is 0. */
const failed = (error: RunErrorCode, reported: Reported = NOTHING_REPORTED): RunOutcome => ({
  status: "failed",
  error,
  result: null,
  credits: creditsReported(reported.costUsd),
  ...reported,
});

export function createRunner(options: RunnerOptions) {
  const { store, adapter, allowance } = options;
  const now = options.now ?? (() => new Date());
  const timeoutMs = options.timeoutMs ?? RUN_TIMEOUT_MS;
  const sitesInFlight = new Set<string>();

  /** Races the adapter against the 5-minute abort; the adapter need not honour the signal. */
  async function callAdapter(input: GenerateInput): Promise<RunOutcome> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new AiTimeout());
      }, timeoutMs);
    });
    const call = adapter.generate(input, controller.signal);
    call.catch(() => {}); // a rejection after the timeout won the race is not unhandled
    try {
      const result = await Promise.race([call, timedOut]);
      const reported: Reported = {
        usage: result.usage,
        costUsd: result.costUsd,
        provider: result.provider,
        model: result.model,
      };
      const proposal = proposalSchema.safeParse(result.output);
      if (!proposal.success) return failed("invalid", reported);
      let credits: number;
      try {
        credits = creditsFromCostUsd(result.costUsd);
      } catch {
        // An unpriced run would be free: refuse it (never record the bad cost).
        return failed("invalid", { ...reported, costUsd: null });
      }
      return { status: "succeeded", error: null, result: proposal.data, credits, ...reported };
    } catch (error) {
      if (error instanceof AiTimeout || controller.signal.aborted) return failed("timeout");
      if (error instanceof AiError) {
        return failed(error.code, {
          usage: error.usage,
          costUsd: error.costUsd,
          provider: error.provider,
          model: error.model,
        });
      }
      return failed("broken");
    } finally {
      clearTimeout(timer);
    }
  }

  async function execute(
    runId: string,
    siteId: string,
    input: StartInput,
    startedAt: number,
  ): Promise<void> {
    let outcome = failed("broken");
    try {
      outcome = await callAdapter({ ...input, runId });
      await store.finish(siteId, runId, outcome);
    } catch (error) {
      // Never the description: log the run, not the request.
      console.error(
        JSON.stringify({
          event: "ai_run_finish_failed",
          runId,
          siteId,
          error: error instanceof Error ? error.message : "unknown",
        }),
      );
    } finally {
      sitesInFlight.delete(siteId);
      slotsInUse -= 1;
    }
    console.info(
      JSON.stringify({
        event: "ai_run_finished",
        runId,
        siteId,
        outcome: outcome.status,
        error: outcome.error,
        durationMs: Date.now() - startedAt,
        provider: outcome.provider,
        model: outcome.model,
        tokens: outcome.usage,
        credits: outcome.credits,
      }),
    );
  }

  let slotsInUse = 0;

  /** Returns once the run is recorded as running; `done` settles when it finishes and never rejects. */
  async function start(siteId: string, userId: string, input: StartInput): Promise<StartResult> {
    // Claimed before the first await: two starts in the same tick cannot both pass.
    if (slotsInUse >= MAX_CONCURRENT_RUNS || sitesInFlight.has(siteId)) {
      return { ok: false, reason: "busy" };
    }
    slotsInUse += 1;
    sitesInFlight.add(siteId);
    const release = () => {
      sitesInFlight.delete(siteId);
      slotsInUse -= 1;
    };
    let runId: string;
    try {
      const used = await store.creditsUsedSince(siteId, startOfUtcMonth(now()));
      if (!mayStartRun(used, allowance)) {
        release();
        return { ok: false, reason: "allowance" };
      }
      if (await store.hasRunningRun(siteId)) {
        release();
        return { ok: false, reason: "busy" };
      }
      runId = await store.insertRunning({ siteId, userId, ...input });
    } catch (error) {
      release();
      throw error;
    }
    // execute() releases the slot on every path, and cannot reject.
    const done = execute(runId, siteId, input, Date.now());
    return { ok: true, runId, done };
  }

  return { start };
}

class AiTimeout extends Error {}
