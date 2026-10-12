// Sets a site's plan by its address (item 21a). Run it on the server.
//
//   npm run set-plan -- --address <address> --plan free|paid
//
// `paid` is Launch. Until billing's webhooks (item 21b) write the plan, this is
// the only way to change it. Takes effect on the next request: limits and the
// footer link read the plan from the site row. An unknown address changes
// nothing and exits 1.
import { parseArgs } from "node:util";
import { sql } from "#app/lib/db.server.ts";
import { parseSetPlanArgs } from "./set-plan-args.ts";

const USAGE = "Usage: npm run set-plan -- --address <address> --plan free|paid";

async function setPlan(): Promise<number> {
  const { values } = parseArgs({
    options: { address: { type: "string" }, plan: { type: "string" } },
    strict: true,
  });
  const args = parseSetPlanArgs(values);
  if ("error" in args) {
    console.error(`${args.error}\n${USAGE}`);
    return 1;
  }

  const [site] = await sql<{ plan: string }[]>`
    select plan from sites where subdomain = ${args.address}
  `;
  if (!site) {
    console.error(`No site has the address ${args.address}. Nothing was changed.`);
    return 1;
  }
  await sql`update sites set plan = ${args.plan} where subdomain = ${args.address}`;
  console.log(`${args.address}: plan ${site.plan} -> ${args.plan}.`);
  return 0;
}

try {
  process.exitCode = await setPlan();
} catch (error) {
  console.error("Setting the plan failed:", error);
  process.exitCode = 1;
} finally {
  await sql.end();
}
