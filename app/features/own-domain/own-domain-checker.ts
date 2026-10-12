import { isDue } from "./own-domain-schedule.ts";

// The automatic re-check loop (item 21c, Step 6), with its store, lookup and
// pre-warm injected so it runs under `node --test` with no database.

/** At most this many domains are looked at in one tick. */
export const MAX_PER_TICK = 20;

export type DueDomain = {
  siteId: string;
  domain: string;
  siteHost: string;
  createdAt: Date;
  lastCheckedAt: Date | null;
};

export type OwnDomainChecker = { tick(): Promise<void> };

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "unknown";
}

export function createOwnDomainChecker(deps: {
  /** Unverified rows with a token, younger than the window, suspended sites left out. */
  dueCandidates: (now: Date) => Promise<DueDomain[]>;
  check: (row: DueDomain, now: Date) => Promise<{ outcome: string; newlyVerified: boolean } | null>;
  prewarm: (domain: string) => Promise<void>;
  now: () => Date;
  log: (line: Record<string, unknown>) => void;
}): OwnDomainChecker {
  let running = false;

  async function tick(): Promise<void> {
    // A slow tick (many lookups) must not stack another behind it.
    if (running) return;
    running = true;
    try {
      const now = deps.now();
      let candidates: DueDomain[];
      try {
        candidates = await deps.dueCandidates(now);
      } catch (error) {
        deps.log({ event: "own_domain_tick_failed", error: messageOf(error) });
        return;
      }
      const batch = candidates
        .filter((row) => isDue({ createdAt: row.createdAt, lastCheckedAt: row.lastCheckedAt, now }))
        // Never-checked first, then the longest waiting.
        .sort(
          (a, b) =>
            (a.lastCheckedAt?.getTime() ?? Number.NEGATIVE_INFINITY) -
            (b.lastCheckedAt?.getTime() ?? Number.NEGATIVE_INFINITY),
        )
        .slice(0, MAX_PER_TICK);

      for (const row of batch) {
        try {
          const result = await deps.check(row, now);
          if (result?.newlyVerified) {
            try {
              await deps.prewarm(row.domain);
            } catch (error) {
              deps.log({
                event: "own_domain_prewarm_failed",
                domain: row.domain,
                error: messageOf(error),
              });
            }
          }
        } catch (error) {
          deps.log({
            event: "own_domain_check_failed",
            domain: row.domain,
            error: messageOf(error),
          });
        }
      }
    } finally {
      running = false;
    }
  }

  return { tick };
}
