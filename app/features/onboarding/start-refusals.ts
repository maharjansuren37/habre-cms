export type RefusalReason = "allowance" | "busy" | "daily";

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

export function refusalMessage(reason: RefusalReason, now: Date): string {
  switch (reason) {
    case "allowance":
      return `Your site has used this month's AI allowance. It renews on ${renewalDate(now)}. You can start blank instead.`;
    case "busy":
      return "Habre is busy building other sites. Try again in a minute.";
    case "daily":
      return "You've started 10 drafts today. Try again tomorrow, or start blank.";
  }
}
