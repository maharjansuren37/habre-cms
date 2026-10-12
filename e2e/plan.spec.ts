import { randomInt } from "node:crypto";
import { expect, test } from "@playwright/test";
import { logIn } from "./helpers/auth.ts";
import { textDocument } from "./helpers/documents.ts";
import { PORT } from "./helpers/ports.ts";
import { createSiteAdmin, createSiteWithAddress, deleteSite, siteUrl } from "./helpers/sites.ts";
import { setRole, withDatabase } from "./helpers/users.ts";

// Item 21a, Step 6: the "Made with Habre" credit follows the plan. Each test
// makes a site of its own (F-103).

const PLATFORM = `http://127.0.0.1:${PORT}`;

let siteId: string;
let address: string;
let adminEmail: string;
let adminUser: Awaited<ReturnType<typeof createSiteAdmin>>;

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({
    "X-Forwarded-For": `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`,
  });
  const site = await createSiteWithAddress("plan");
  siteId = site.id;
  address = site.address;
  adminUser = await createSiteAdmin(siteId, "Plan Admin");
  adminEmail = adminUser.email;
  await withDatabase(async (sql) => {
    await sql`
      insert into entries (site_id, type, title, slug, blocks, blocks_format, status, published_at, author_id)
      select ${siteId}, 'page', 'Plan Page', 'plan-page',
             ${sql.json(textDocument("Hello.") as never)}, 'v4', 'published', now(), id
      from users where email = ${adminEmail}
    `;
  });
});

test.afterEach(async () => {
  await deleteSite(siteId);
});

async function makePaid() {
  await withDatabase((sql) => sql`update sites set plan = 'paid' where id = ${siteId}`);
}

test("a Free site's page has a Made with Habre link in its footer, to the platform", async ({
  page,
}) => {
  await page.goto(siteUrl("/plan-page", address));

  const link = page.getByRole("contentinfo").getByRole("link", { name: "Made with Habre" });
  await expect(link).toHaveCount(1);
  await expect(link).toHaveAttribute("href", PLATFORM);
});

test("a Launch site's page has no Made with Habre link", async ({ page }) => {
  await makePaid();

  await page.goto(siteUrl("/plan-page", address));

  await expect(page.getByRole("contentinfo")).toBeVisible();
  await expect(page.getByRole("link", { name: "Made with Habre" })).toHaveCount(0);
});

test("the admin Preview shows the credit the way the public page does", async ({ page }) => {
  await logIn(page, adminUser);
  await page.goto("/admin/preview/plan-page");
  await expect(
    page.getByRole("contentinfo").getByRole("link", { name: "Made with Habre" }),
  ).toHaveAttribute("href", PLATFORM);

  await makePaid();
  await page.goto("/admin/preview/plan-page");
  await expect(page.getByRole("contentinfo")).toBeVisible();
  await expect(page.getByRole("link", { name: "Made with Habre" })).toHaveCount(0);
});

// Step 8: /admin/plan.

test("an admin sees the Free plan, its storage and AI meters, and what Launch adds", async ({
  page,
}) => {
  await logIn(page, adminUser);
  await page.getByRole("link", { name: "Plan", exact: true }).click();

  await expect(page).toHaveURL(/\/admin\/plan$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Plan");
  await expect(page.getByText("Your site is on the Free plan.")).toBeVisible();
  await expect(page.getByText("0 MB of 500 MB used")).toBeVisible();
  await expect(page.getByRole("meter", { name: "Storage" })).toHaveAttribute("max", "524288000");
  await expect(page.getByRole("meter", { name: "AI allowance" })).toBeVisible();
  const adds = page.getByRole("region", { name: "What Launch adds" });
  await expect(adds.getByRole("listitem").filter({ hasText: "1000 MB of storage" })).toHaveCount(1);
  await expect(adds.getByRole("listitem").filter({ hasText: "Made with Habre" })).toHaveCount(1);
  await expect(page.getByText("Paid plans are coming soon.")).toBeVisible();
  await expect(page.getByRole("button", { name: /upgrade/i })).toHaveCount(0);
});

test("a Launch site sees the Launch storage limit", async ({ page }) => {
  await makePaid();
  await logIn(page, adminUser);
  await page.goto("/admin/plan");

  await expect(page.getByText("Your site is on the Launch plan.")).toBeVisible();
  await expect(page.getByText("0 MB of 1000 MB used")).toBeVisible();
  await expect(page.getByRole("meter", { name: "Storage" })).toHaveAttribute("max", "1048576000");
});

test("an author or editor gets a 404 and no Plan link", async ({ page }) => {
  for (const role of ["author", "editor"] as const) {
    const user = await createSiteAdmin(siteId, `Plan ${role}`);
    await setRole(user.email, role);
    await page.context().clearCookies();
    await logIn(page, user);
    await expect(page.getByRole("link", { name: "Plan", exact: true })).toHaveCount(0);
    const response = await page.goto("/admin/plan");
    expect(response?.status()).toBe(404);
  }
});
