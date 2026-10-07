/** The window after which a `running` row is taken as lost: `hasRunningRun`'s six minutes. */
export const STALE_RUN_MS = 6 * 60 * 1000;

export type RunView = {
  state: "running" | "failed" | "succeeded" | "applied";
  error: string | null;
  seconds: number;
  canRetry: boolean;
};

/**
 * What the wait shows for a run, and whether it may be retried - one rule for the
 * loader and the retry action. A `running` row past the window had its finish
 * write lost, so it reads as a failed `timeout`. A refused run is not retried: the
 * same description would be refused again.
 */
export function runView(
  run: { status: string; error: string | null; createdAt: Date },
  now: Date,
): RunView {
  const age = now.getTime() - run.createdAt.getTime();
  const seconds = Math.max(0, Math.floor(age / 1000));
  if (run.status === "running") {
    if (age > STALE_RUN_MS) return { state: "failed", error: "timeout", seconds, canRetry: true };
    return { state: "running", error: null, seconds, canRetry: false };
  }
  if (run.status === "succeeded" || run.status === "applied") {
    return { state: run.status, error: null, seconds, canRetry: false };
  }
  return { state: "failed", error: run.error, seconds, canRetry: run.error !== "refused" };
}
