import { limitsFor, type Plan, type PlanLimitsConfig } from "#app/features/plans/plan-limits.ts";

/** The monthly AI credits a site's plan allows (item 21a); `null` is no limit. */
export const allowanceForSites =
  (planOf: (siteId: string) => Promise<Plan>, config: PlanLimitsConfig) =>
  async (siteId: string): Promise<number | null> => {
    return limitsFor(await planOf(siteId), config).aiCredits;
  };
