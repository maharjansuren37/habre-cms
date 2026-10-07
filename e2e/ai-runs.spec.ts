import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { createSite, deleteSite } from "./helpers/sites.ts";
import { withDatabase } from "./helpers/users.ts";

// Database only - no page. F-329: a `running` row whose finish write was lost
// must stop blocking its site after the run limit plus a minute.

let siteId: string;

test.beforeAll(async () => {
  siteId = await createSite("ai-runs");
});

test.afterAll(async () => {
  await deleteSite(siteId);
});

async function insertRunning(age: string): Promise<void> {
  await withDatabase(async (sql) => {
    await sql`delete from ai_runs where site_id = ${siteId}`;
    await sql`
      insert into ai_runs (site_id, kind, description, status, created_at)
      values (${siteId}, 'website', 'age check', 'running', now() - ${age}::interval)
    `;
  });
}

// The app's own store, run by node (the e2e project cannot import app/), as the app role.
function hasRunningRun(): boolean {
  const out = execFileSync(
    "node",
    [
      "--input-type=module",
      "-e",
      'import { runStore } from "#app/features/ai/runs.server.ts"; const busy = await runStore.hasRunningRun(process.env.SITE_ID); process.stdout.write(String(busy)); process.exit(0);',
    ],
    { env: { ...process.env, SITE_ID: siteId }, encoding: "utf8" },
  );
  return out === "true";
}

test("a site with a ten-minute-old running row may start a run", async () => {
  await insertRunning("10 minutes");
  expect(hasRunningRun()).toBe(false);
});

test("a site with a fresh running row may not", async () => {
  await insertRunning("0 minutes");
  expect(hasRunningRun()).toBe(true);
});
