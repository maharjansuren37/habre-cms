// When an unverified domain is looked at again (item 21c, Step 6). Pure: the
// checker passes the clock in.

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

/** After this long from adding it, a domain is no longer checked by itself. */
export const CHECK_WINDOW_MS = 24 * HOUR;

/** The gap since the last check, by the domain's age: eager at first, then patient. */
function intervalForAge(ageMs: number): number {
  if (ageMs < 10 * MINUTE) return MINUTE;
  if (ageMs < 2 * HOUR) return 5 * MINUTE;
  return 30 * MINUTE;
}

export function isDue(input: { createdAt: Date; lastCheckedAt: Date | null; now: Date }): boolean {
  const age = input.now.getTime() - input.createdAt.getTime();
  if (age >= CHECK_WINDOW_MS) return false;
  if (input.lastCheckedAt === null) return true;
  return input.now.getTime() - input.lastCheckedAt.getTime() >= intervalForAge(age);
}
