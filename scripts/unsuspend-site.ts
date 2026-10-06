// Unsuspends a site by its address (D158). Run it on the server.
//
//   npm run unsuspend-site -- --address <address>
//
// Takes effect on the next request: the host lookup refuses a suspended site.
// An unknown address changes nothing and exits 1. Repeating the command changes
// nothing and exits 0.
import { parseArgs } from "node:util";
import { setSiteSuspended } from "#app/features/sites/suspend-site.server.ts";
import { sql } from "#app/lib/db.server.ts";

const USAGE = "Usage: npm run unsuspend-site -- --address <address>";

async function unsuspendSite(): Promise<number> {
  const { values } = parseArgs({ options: { address: { type: "string" } }, strict: true });
  const address = (values.address ?? "").trim().toLowerCase();
  if (address === "") {
    console.error(USAGE);
    return 1;
  }

  const { outcome } = await setSiteSuspended(address, false);
  if (outcome === "unknown") {
    console.error(`No site has the address ${address}. Nothing was changed.`);
    return 1;
  }
  console.log(
    outcome === "changed" ? `Unsuspended ${address}.` : `${address} is already not suspended.`,
  );
  return 0;
}

try {
  process.exitCode = await unsuspendSite();
} catch (error) {
  console.error("Unsuspending the site failed:", error);
  process.exitCode = 1;
} finally {
  await sql.end();
}
