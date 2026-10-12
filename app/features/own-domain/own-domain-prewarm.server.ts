import { env } from "#app/lib/env.server.ts";
import { prewarmWith } from "./own-domain-prewarm.ts";

/**
 * Warms a newly verified domain's certificate. A no-op when SITES_URL is http:
 * own domains are served only over https there, so the request would reach
 * nothing (`mainHost` in app/lib/site-origin.ts).
 */
export async function prewarmDomain(domain: string): Promise<void> {
  if (new URL(env.SITES_URL).protocol === "http:") return;
  await prewarmWith(domain, {
    fetch: (url, init) => fetch(url, init),
    log: (line) => console.error(JSON.stringify(line)),
  });
}
