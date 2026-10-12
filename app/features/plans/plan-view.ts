import { formatStorageLimit } from "#app/features/media/storage-limit.ts";
import type { Limits, Plan } from "./plan-limits.ts";

// What the plan page says about a plan (item 21a, Step 8). Pure: the limits
// come in, the words go out.

export const planName = (plan: Plan): string => (plan === "paid" ? "Launch" : "Free");

/** The lines under "What Launch adds", derived from the two plans' limits. */
export function launchAdds(free: Limits, launch: Limits): string[] {
  const lines: string[] = [];
  if (free.storageBytes !== null) {
    if (launch.storageBytes === null) lines.push("No storage limit");
    else if (launch.storageBytes > free.storageBytes) {
      lines.push(
        `${formatStorageLimit(launch.storageBytes)} of storage instead of ${formatStorageLimit(free.storageBytes)}`,
      );
    }
  }
  if (free.aiCredits !== null) {
    if (launch.aiCredits === null) lines.push("No monthly AI limit");
    else if (launch.aiCredits > free.aiCredits) lines.push("A larger monthly AI allowance");
  }
  lines.push('No "Made with Habre" link in your site\'s footer');
  return lines;
}
