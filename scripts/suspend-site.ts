// Suspends a site by its address (D158). Run it on the server.
//
//   npm run suspend-site -- --address <address>
//
// Takes effect on the next request: the host lookup refuses a suspended site.
// An unknown address changes nothing and exits 1. Repeating the command changes
// nothing and exits 0.
import { parseArgs } from "node:util";
import { setSiteSuspended } from "#app/features/sites/suspend-site.server.ts";
import { sql } from "#app/lib/db.server.ts";

const USAGE = "Usage: npm run suspend-site -- --address <address>";

async function suspendSite(): Promise<number> {
  const { values } = parseArgs({ options: { address: { type: "string" } }, strict: true });
  const address = (values.address ?? "").trim().toLowerCase();
  if (address === "") {
    console.error(USAGE);
    return 1;
  }

  const { outcome } = await setSiteSuspended(address, true);
  if (outcome === "unknown") {
    console.error(`No site has the address ${address}. Nothing was changed.`);
    return 1;
  }
  console.log(outcome === "changed" ? `Suspended ${address}.` : `${address} is already suspended.`);
  return 0;
}

try {
  process.exitCode = await suspendSite();
} catch (error) {
  console.error("Suspending the site failed:", error);
  process.exitCode = 1;
} finally {
  await sql.end();
}
