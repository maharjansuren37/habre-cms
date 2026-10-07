// 1 credit = US$0.001 of provider cost (D164).
const MICRO_USD_PER_CREDIT = 1000;

/**
 * Credits for a run's cost in US dollars, rounded up. Costs have at most six
 * decimals (`ai_runs.cost_usd`), so the sum is done in whole micro-dollars to
 * keep floating point from turning 0.003 into 4 credits.
 */
export function creditsFromCostUsd(costUsd: number): number {
  if (!Number.isFinite(costUsd) || costUsd < 0) {
    throw new RangeError("A run's cost must be a finite number of US dollars, 0 or more.");
  }
  if (costUsd === 0) return 0;
  // Any non-zero cost is at least one micro-dollar, so at least one credit.
  const micro = Math.max(1, Math.round(costUsd * 1e6));
  return Math.ceil(micro / MICRO_USD_PER_CREDIT);
}

/** Midnight UTC on the 1st of `now`'s month. */
export function startOfUtcMonth(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** A run may start while at least 1 credit is left. `null` means no limit. */
export function mayStartRun(usedCredits: number, allowance: number | null): boolean {
  return allowance === null || usedCredits < allowance;
}
