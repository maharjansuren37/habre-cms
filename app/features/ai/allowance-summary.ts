import { renewalDate } from "#app/features/onboarding/start-refusals.ts";

/**
 * Home's AI meter (18b4a): a percentage used, never credits or tokens (D164).
 * Whole percent rounded down, so it never reads 100% before the allowance is
 * gone; the value stops at the maximum so the meter stays valid. No limit
 * (`allowance` null) has no meter.
 */
export function allowanceSummary(
  used: number,
  allowance: number | null,
  now: Date,
): { text: string; value: number; max: number | null } {
  if (allowance === null) return { text: "No monthly AI limit.", value: 0, max: null };
  const percent = Math.min(100, Math.floor((used / allowance) * 100));
  return {
    text: `${percent}% of this month's AI allowance used. Renews on ${renewalDate(now)}.`,
    value: Math.min(used, allowance),
    max: allowance,
  };
}
