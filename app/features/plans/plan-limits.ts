// A site's limits follow its plan (item 21a). Pure: the numbers come in as
// config, parsed from the environment in app/lib.

export type Plan = "free" | "paid";

// null is no limit.
export type Limits = { storageBytes: number | null; aiCredits: number | null };

export type PlanLimitsConfig = { free: Limits; launch: Limits };

export const limitsFor = (plan: Plan, config: PlanLimitsConfig): Limits =>
  plan === "paid" ? config.launch : config.free;

/** Free sites carry a "Made with Habre" link in the footer; Launch sites do not. */
export const showsCredit = (plan: Plan): boolean => plan === "free";
