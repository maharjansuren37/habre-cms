import { sql } from "#app/lib/db.server.ts";
import { env } from "#app/lib/env.server.ts";
import { checkDomain } from "./own-domain.server.ts";
import { createOwnDomainChecker, type DueDomain } from "./own-domain-checker.ts";
import { prewarmDomain } from "./own-domain-prewarm.server.ts";
import { CHECK_WINDOW_MS } from "./own-domain-schedule.ts";

const TICK_MS = 30_000;
// The rows read per tick; the checker itself takes at most 20 of the due ones.
const CANDIDATE_LIMIT = 200;

type CandidateRow = {
  site_id: string;
  domain: string;
  subdomain: string;
  created_at: Date;
  last_checked_at: Date | null;
};

async function dueCandidates(now: Date): Promise<DueDomain[]> {
  const since = new Date(now.getTime() - CHECK_WINDOW_MS);
  // Platform tables, outside row-level security. A suspended site is left alone.
  const rows = await sql<CandidateRow[]>`
    select d.site_id, d.domain, s.subdomain, d.created_at, d.last_checked_at
    from site_domains d
    join sites s on s.id = d.site_id
    where d.verified_at is null
      and d.verification_token is not null
      and d.created_at > ${since}
      and s.suspended_at is null
    order by d.last_checked_at asc nulls first
    limit ${CANDIDATE_LIMIT}`;
  // A DNS name carries no port: the hostname, like the plan page.
  const sitesHostname = new URL(env.SITES_URL).hostname;
  return rows.map((row) => ({
    siteId: row.site_id,
    domain: row.domain,
    siteHost: `${row.subdomain}.${sitesHostname}`,
    createdAt: row.created_at,
    lastCheckedAt: row.last_checked_at,
  }));
}

export const ownDomainChecker = createOwnDomainChecker({
  dueCandidates,
  // The automatic check does not spend the person's manual check limit
  // (`checkLimit` guards the Check now button only).
  check: (row, now) => checkDomain({ siteId: row.siteId, siteHost: row.siteHost, now }),
  prewarm: prewarmDomain,
  now: () => new Date(),
  log: (line) => console.error(JSON.stringify(line)),
});

const STARTED = Symbol.for("habre.ownDomainChecker.started");

/**
 * Starts the re-check timer, once per process. Not started when SITES_URL is
 * http: own domains are served only over https there. Vite's dev reloads
 * re-run this module, so the guard lives on `globalThis`, not in the module.
 */
export function startOwnDomainChecker(): void {
  if (new URL(env.SITES_URL).protocol === "http:") return;
  const state = globalThis as Record<symbol, unknown>;
  if (state[STARTED]) return;
  state[STARTED] = true;
  setInterval(() => void ownDomainChecker.tick(), TICK_MS).unref();
}
