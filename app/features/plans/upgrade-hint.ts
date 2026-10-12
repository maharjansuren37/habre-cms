// What a limit message says about getting more (F-408). Pure: the plan and
// whether billing is on come in, the words go out.
//
// Billing off keeps "coming soon" (a self-hosted copy, or the beta, D150).
// Billing on points a Free site at the Plan page, where an admin can pay, and
// says nothing to a Launch site, which has nothing higher to upgrade to.

export type UpgradeHint = "coming-soon" | "plan-page" | "none";

export function upgradeHint(plan: "free" | "paid", billingOn: boolean): UpgradeHint {
  if (!billingOn) return "coming-soon";
  return plan === "free" ? "plan-page" : "none";
}

export function storageUpgradeSentence(hint: UpgradeHint): string {
  if (hint === "coming-soon") return " Paid plans with more storage are coming soon.";
  if (hint === "plan-page") return " An admin can upgrade on the Plan page for more storage.";
  return "";
}

export function allowanceUpgradeSentence(hint: UpgradeHint): string {
  if (hint === "coming-soon") return " Paid plans are coming soon.";
  if (hint === "plan-page") return " An admin can upgrade on the Plan page for a larger allowance.";
  return "";
}
