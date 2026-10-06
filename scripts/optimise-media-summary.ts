export type OptimiseCounts = { optimised: number; keptAsUploaded: number; failed: number };

/** The command's last line, the same shape every run. */
export function summaryLine(counts: OptimiseCounts): string {
  return `optimised=${counts.optimised} kept_as_uploaded=${counts.keptAsUploaded} failed=${counts.failed}`;
}

/** Any failed row makes the command exit 1, so a script around it notices. */
export function exitCodeFor(counts: OptimiseCounts): number {
  return counts.failed > 0 ? 1 : 0;
}
