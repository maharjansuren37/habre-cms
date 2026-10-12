import { env } from "#app/lib/env.server.ts";
import { checkDomain, ownDomainStore } from "./own-domain.server.ts";
import { createOwnDomainChecker } from "./own-domain-checker.ts";
import { prewarmDomain } from "./own-domain-prewarm.server.ts";

const TICK_MS = 30_000;

export const ownDomainChecker = createOwnDomainChecker({
  // A DNS name carries no port: the hostname, like the plan page.
  dueCandidates: (now) => ownDomainStore.dueCandidates(now, new URL(env.SITES_URL).hostname),
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
