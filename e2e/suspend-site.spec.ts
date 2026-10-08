import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { logIn } from "./helpers/auth.ts";
import { createSiteAdmin, createSiteWithAddress, deleteSite, siteUrl } from "./helpers/sites.ts";
import { withDatabase } from "./helpers/users.ts";

// Item 16b, Step 1: the operator commands, run for real as a person would run
// them. Each test makes its own site, never site 1.
type Run = { status: number; stdout: string; stderr: string };

function run(script: string, args: string[]): Run {
  try {
    const stdout = execFileSync("node", [`scripts/${script}.ts`, ...args], {
      env: process.env,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { status: 0, stdout, stderr: "" };
  } catch (error) {
    const failed = error as { status: number; stdout: string; stderr: string };
    return { status: failed.status, stdout: failed.stdout, stderr: failed.stderr };
  }
}

function suspendedAt(siteId: string): Promise<Date | null> {
  return withDatabase(async (sql) => {
    const [row] = await sql<{ suspendedAt: Date | null }[]>`
      select suspended_at as "suspendedAt" from sites where id = ${siteId}
    `;
    return row.suspendedAt;
  });
}

test("suspending takes the site off at once, and unsuspending puts it back", async ({
  request,
}) => {
  const site = await createSiteWithAddress("suspend-cmd");
  try {
    const home = () => request.get(siteUrl("/", site.address), { maxRedirects: 0 });
    expect((await home()).status()).toBe(200);

    const suspended = run("suspend-site", ["--address", site.address]);
    expect(suspended.status).toBe(0);
    expect(suspended.stdout).toContain(`Suspended ${site.address}.`);
    expect((await home()).status()).toBe(404);

    const restored = run("unsuspend-site", ["--address", site.address]);
    expect(restored.status).toBe(0);
    expect(restored.stdout).toContain(`Unsuspended ${site.address}.`);
    expect((await home()).status()).toBe(200);
    expect(await suspendedAt(site.id)).toBeNull();
  } finally {
    await deleteSite(site.id);
  }
});

test("suspending twice exits 0, says so, and keeps the first time", async () => {
  const site = await createSiteWithAddress("suspend-twice");
  try {
    expect(run("suspend-site", ["--address", site.address]).status).toBe(0);
    const first = await suspendedAt(site.id);
    expect(first).not.toBeNull();

    const again = run("suspend-site", ["--address", site.address]);
    expect(again.status).toBe(0);
    expect(again.stdout).toContain("already suspended");
    expect(await suspendedAt(site.id)).toEqual(first);

    const unsuspended = run("unsuspend-site", ["--address", site.address]);
    expect(unsuspended.status).toBe(0);
    const twice = run("unsuspend-site", ["--address", site.address]);
    expect(twice.status).toBe(0);
    expect(twice.stdout).toContain("already not suspended");
  } finally {
    await deleteSite(site.id);
  }
});

test("an unknown address exits 1 and changes no row", async () => {
  const site = await createSiteWithAddress("suspend-unknown");
  try {
    for (const script of ["suspend-site", "unsuspend-site"]) {
      const result = run(script, ["--address", `${site.address}-nope`]);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("No site has the address");
    }
    expect(await suspendedAt(site.id)).toBeNull();
    const anySuspendedByUs = await withDatabase(
      (sql) =>
        sql`select 1 from sites where suspended_at is not null and subdomain like ${`${site.address}%`}`,
    );
    expect(anySuspendedByUs.length).toBe(0);
  } finally {
    await deleteSite(site.id);
  }
});

test("the address is found whatever its case", async () => {
  const site = await createSiteWithAddress("suspend-case");
  try {
    const result = run("suspend-site", ["--address", site.address.toUpperCase()]);
    expect(result.status).toBe(0);
    expect(await suspendedAt(site.id)).not.toBeNull();
  } finally {
    await deleteSite(site.id);
  }
});

test("without an address the command prints its usage and exits 1", () => {
  for (const script of ["suspend-site", "unsuspend-site"]) {
    const result = run(script, []);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`Usage: npm run ${script} -- --address <address>`);
  }
});

// Step 2: members keep the admin, with a standing notice that is not a live region.
const NOTICE = "This site is suspended.";

test("a suspended site's admin sees a standing notice on every screen, until unsuspended", async ({
  page,
}) => {
  const site = await createSiteWithAddress("suspend-notice");
  try {
    const admin = await createSiteAdmin(site.id);
    expect(run("suspend-site", ["--address", site.address]).status).toBe(0);

    await logIn(page, admin);
    const notice = page.getByText(NOTICE, { exact: true });

    // A full page load of /admin, which is Home for an admin.
    await page.goto("/admin");
    await expect(notice).toBeVisible();
    await expect(page.getByText("Visitors see Not Found instead of its pages.")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Home");

    // The banner around the title carries no role: it is a fact, not an outcome.
    const banner = notice.locator("xpath=ancestor::div[1]/..");
    await expect(banner).not.toHaveAttribute("role", /.*/);
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.getByRole("status").filter({ hasText: NOTICE })).toHaveCount(0);

    // After a client-side navigation.
    await page.getByRole("link", { name: "Pages", exact: true }).click();
    await page.waitForURL("**/admin/pages");
    await expect(notice).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Pages");

    // A full page load of /admin/pages.
    await page.goto("/admin/pages");
    await expect(notice).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);

    expect(run("unsuspend-site", ["--address", site.address]).status).toBe(0);
    await page.goto("/admin/pages");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Pages");
    await expect(notice).toHaveCount(0);
  } finally {
    await deleteSite(site.id);
  }
});

// F-282: the editor screens sit outside the shell, and show the notice too.
test("a suspended site's editor screens show the notice, until unsuspended", async ({ page }) => {
  const site = await createSiteWithAddress("suspend-editor");
  try {
    const admin = await createSiteAdmin(site.id);
    expect(run("suspend-site", ["--address", site.address]).status).toBe(0);

    await logIn(page, admin);
    const notice = page.getByText(NOTICE, { exact: true });

    for (const path of ["/admin/posts/new", "/admin/pages/new"]) {
      await page.goto(path);
      await expect(page.getByLabel("Title", { exact: true })).toBeVisible();
      await expect(notice).toBeVisible();
      await expect(page.getByText("Visitors see Not Found instead of its pages.")).toBeVisible();
      await expect(page.getByRole("alert")).toHaveCount(0);
    }

    // After a client-side navigation from the shell into the editor.
    await page.goto("/admin/posts");
    await page.getByRole("link", { name: "New post" }).first().click();
    await page.waitForURL("**/admin/posts/new");
    await expect(notice).toBeVisible();

    expect(run("unsuspend-site", ["--address", site.address]).status).toBe(0);
    await page.goto("/admin/posts/new");
    await expect(page.getByLabel("Title", { exact: true })).toBeVisible();
    await expect(notice).toHaveCount(0);
  } finally {
    await deleteSite(site.id);
  }
});
