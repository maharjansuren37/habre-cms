import { AiError, type RunErrorCode, type RunKind, type Usage } from "./run-generation.ts";

/** One attempt of `npm run ai:measure`: what is written beside its proposal. */
export type AttemptRecord = {
  provider: string;
  configuredModel: string;
  servedModel: string | null;
  kind: RunKind;
  attempt: number;
  status: "succeeded" | "failed";
  error: RunErrorCode | null;
  durationMs: number;
  usage: Usage | null;
  costUsd: number | null;
  credits: number;
  pages: number;
  sections: number;
  expandsCleanly: boolean;
};

export type GroupSummary = {
  provider: string;
  configuredModel: string;
  runs: number;
  /** Attempts that returned a proposal. */
  succeeded: number;
  /** Of those succeeded attempts, how many expand to valid documents. */
  expandsCleanly: number;
  failures: Record<string, number>;
  medianDurationMs: number;
  slowestDurationMs: number;
  meanCostUsd: number | null;
  highestCostUsd: number | null;
  meanCredits: number;
  runsPer1000Credits: number | null;
};

export function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length === 0) return 0;
  if (sorted.length % 2 === 1) return sorted[middle] ?? 0;
  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

const mean = (values: readonly number[]): number =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

/** One summary per provider and configured model, in first-seen order. */
export function summarise(records: readonly AttemptRecord[]): GroupSummary[] {
  const groups = new Map<string, AttemptRecord[]>();
  for (const record of records) {
    const key = `${record.provider}\u0000${record.configuredModel}`;
    groups.set(key, [...(groups.get(key) ?? []), record]);
  }
  return [...groups.values()].map((group) => {
    const first = group[0] as AttemptRecord;
    const failures: Record<string, number> = {};
    for (const record of group) {
      if (record.status === "failed") {
        const code = record.error ?? "unknown";
        failures[code] = (failures[code] ?? 0) + 1;
      }
    }
    const durations = group.map((record) => record.durationMs);
    const costs = group.flatMap((record) => (record.costUsd === null ? [] : [record.costUsd]));
    const meanCredits = mean(group.map((record) => record.credits));
    return {
      provider: first.provider,
      configuredModel: first.configuredModel,
      runs: group.length,
      succeeded: group.filter((record) => record.status === "succeeded").length,
      expandsCleanly: group.filter(
        (record) => record.status === "succeeded" && record.expandsCleanly,
      ).length,
      failures,
      medianDurationMs: median(durations),
      slowestDurationMs: Math.max(...durations),
      meanCostUsd: costs.length === 0 ? null : mean(costs),
      highestCostUsd: costs.length === 0 ? null : Math.max(...costs),
      meanCredits,
      runsPer1000Credits: meanCredits === 0 ? null : 1000 / meanCredits,
    };
  });
}

const dash = (value: number | null, format: (n: number) => string) =>
  value === null ? "-" : format(value);

/** One block of lines per provider and model. */
export function formatSummary(summary: readonly GroupSummary[]): string {
  return summary
    .map((group) => {
      const failed = Object.entries(group.failures)
        .map(([code, count]) => `${code} ${count}`)
        .join(", ");
      return [
        `${group.provider} / ${group.configuredModel}`,
        `  runs:                 ${group.runs}`,
        `  failures:             ${failed === "" ? "none" : failed}`,
        `  expands cleanly:      ${group.expandsCleanly} of ${group.succeeded}`,
        `  duration (median):    ${Math.round(group.medianDurationMs)} ms`,
        `  duration (slowest):   ${Math.round(group.slowestDurationMs)} ms`,
        `  cost (mean):          ${dash(group.meanCostUsd, (n) => `US$${n.toFixed(6)}`)}`,
        `  cost (highest):       ${dash(group.highestCostUsd, (n) => `US$${n.toFixed(6)}`)}`,
        `  credits (mean):       ${group.meanCredits.toFixed(1)}`,
        `  runs per 1,000 credits: ${dash(group.runsPer1000Credits, (n) => n.toFixed(1))}`,
      ].join("\n");
    })
    .join("\n\n");
}

export type AttemptFailure = {
  error: RunErrorCode;
  servedModel: string | null;
  usage: Usage | null;
  costUsd: number | null;
};

/** What a thrown attempt is recorded as. */
export function classifyAttemptFailure(caught: unknown, aborted: boolean): AttemptFailure {
  if (caught instanceof AiError) {
    return {
      // The limit's own abort comes first: the SDK's abort error is sorted as unavailable.
      error: aborted ? "timeout" : caught.code,
      servedModel: caught.model,
      usage: caught.usage,
      costUsd: caught.costUsd,
    };
  }
  return {
    error: aborted ? "timeout" : "broken",
    servedModel: null,
    usage: null,
    costUsd: null,
  };
}

/** The line printed as each attempt finishes. */
export function formatAttemptLine(record: AttemptRecord): string {
  const expands =
    record.status === "failed"
      ? "no proposal"
      : record.expandsCleanly
        ? "expands cleanly"
        : "does not expand";
  const { usage } = record;
  const tokens = usage
    ? `tokens ${usage.input}/${usage.cacheRead}/${usage.output} (in/cached/out)`
    : "tokens -";
  return (
    `${record.provider} ${record.kind} #${record.attempt}: ${record.status}${record.error ? ` (${record.error})` : ""}, ` +
    `${record.durationMs} ms, ${record.credits} credits, ${expands}, ${tokens}`
  );
}
