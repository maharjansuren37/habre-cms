import type { StartInput, StartResult } from "../ai/run-generation.ts";
import { createRateLimiter } from "../auth/rate-limiter.ts";
import type { RefusalReason } from "./start-refusals.ts";

export const DAILY_RUN_CAP = 10;
const ONE_DAY = 24 * 60 * 60 * 1000;

export type StartRunResult =
  | Extract<StartResult, { ok: true }>
  | { ok: false; reason: RefusalReason };

type Options = {
  runner: { start(siteId: string, userId: string, input: StartInput): Promise<StartResult> };
  now?: () => number;
  log?: (line: string) => void;
};

/**
 * Wraps the runner's start with the daily cap: 10 runs per site in a 24-hour
 * window from the first, in memory. Only a run that starts is counted; a refusal
 * from the runner, or from the cap itself, is not. Each refusal is logged with
 * its reason and site, never the description.
 */
export function createStartRun({ runner, now = Date.now, log = console.info }: Options) {
  const limiter = createRateLimiter({
    limit: DAILY_RUN_CAP,
    windowMs: ONE_DAY,
    maxKeys: 10_000,
    now,
  });

  function refuse(reason: RefusalReason, siteId: string): StartRunResult {
    log(JSON.stringify({ event: "ai_run_refused", reason, siteId }));
    return { ok: false, reason };
  }

  return async function startRun(
    siteId: string,
    userId: string,
    input: StartInput,
  ): Promise<StartRunResult> {
    if (limiter.isBlocked(siteId)) return refuse("daily", siteId);
    const result = await runner.start(siteId, userId, input);
    if (!result.ok) return refuse(result.reason, siteId);
    limiter.recordFailure(siteId);
    return result;
  };
}
