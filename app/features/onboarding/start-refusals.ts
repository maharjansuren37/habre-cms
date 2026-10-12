import { allowanceUpgradeSentence, type UpgradeHint } from "#app/features/plans/upgrade-hint.ts";

export type RefusalReason = "allowance" | "busy" | "site_busy" | "daily";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** The 1st of next month in UTC, as "1 November" - when the monthly allowance renews. */
export function renewalDate(now: Date): string {
  return `1 ${MONTHS[(now.getUTCMonth() + 1) % 12]}`;
}

export function refusalMessage(
  reason: RefusalReason,
  now: Date,
  hint: UpgradeHint = "coming-soon",
): string {
  switch (reason) {
    case "allowance":
      return `Your site has used this month's AI allowance. It renews on ${renewalDate(now)}. You can start blank instead.${allowanceUpgradeSentence(hint)}`;
    case "busy":
      return "Habre is busy building other sites. Try again in a minute.";
    case "site_busy":
      return "A draft for your site is already being built. Wait for it to finish, then try again.";
    case "daily":
      return "You've started 10 drafts today. Try again tomorrow, or start blank.";
  }
}
