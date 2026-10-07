import { randomInt } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import { textDocument } from "./helpers/documents.ts";
import { HOST_SPLIT_PORT } from "./helpers/ports.ts";
import { createSite, createSiteAdmin, deleteSite } from "./helpers/sites.ts";
import { setRole, type TestUser, withDatabase } from "./helpers/users.ts";

// Item 18b3, Step 4: /start, step 1. The primary server runs AI_PROVIDERS=fake
// (playwright.config.ts); the host-split server has AI off. Each test makes its
// own empty site and admin, never site 1.
let siteId: string;
let admin: TestUser;

test.beforeEach(async ({ page }) => {
  // Failed and busy logins are limited per IP; see auth.spec.ts.
  await page.setExtraHTTPHeaders({
    "X-Forwarded-For": `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`,
  });
  siteId = await createSite("onboarding");
  admin = await createSiteAdmin(siteId, "Start Admin");
});

test.afterEach(async () => {
  await deleteSite(siteId);
});

async function signIn(page: Page, user: TestUser): Promise<void> {
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Log in" }).click();
}

async function logInThenOpen(page: Page, path: string): Promise<void> {
  await page.goto(`/admin/login?redirectTo=${encodeURIComponent(path)}`);
  await signIn(page, admin);
  await page.waitForURL(`**${path}`);
}

test("a new admin of an empty site sees step 1, and Continue is reachable by keyboard alone", async ({
  page,
}) => {
  await logInThenOpen(page, "/start");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("What do you want to create?");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByText("Step 1 of 2")).toBeVisible();
  await expect(page.getByRole("link", { name: "Start blank instead" })).toHaveAttribute(
    "href",
    "/admin",
  );

  const group = page.getByRole("group", { name: "Kind of website" });
  await expect(group.getByRole("radio")).toHaveCount(4);
  for (const name of ["Website", "Blog", "Business", "Portfolio"]) {
    await expect(group.getByRole("radio", { name })).toBeVisible();
  }

  // Tab into the group, arrow to Business (Website -> Blog -> Business), Tab to
  // Continue, Enter. Nothing is clicked.
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Start blank instead" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(group.getByRole("radio", { name: "Website" })).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(group.getByRole("radio", { name: "Business" })).toBeFocused();
  await page.keyboard.press("Space");
  await expect(group.getByRole("radio", { name: "Business" })).toBeChecked();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Continue" })).toBeFocused();
  await page.keyboard.press("Enter");
  // /start/about arrives in Step 5, so only the address is asserted here.
  await page.waitForURL("**/start/about?kind=business");
});

test("/start?kind=blog pre-checks Blog", async ({ page }) => {
  await logInThenOpen(page, "/start?kind=blog");
  await expect(page.getByRole("radio", { name: "Blog" })).toBeChecked();
  await expect(page.getByRole("radio", { name: "Website" })).not.toBeChecked();
});

test("signed out, /start goes to sign in and back to /start", async ({ page }) => {
  await page.goto("/start");
  await page.waitForURL("**/admin/login?redirectTo=%2Fstart");
  await signIn(page, admin);
  await page.waitForURL("**/start");
  await expect(
    page.getByRole("heading", { level: 1, name: "What do you want to create?" }),
  ).toBeVisible();
});

test("an author of the same site gets Not Found", async ({ page }) => {
  await setRole(admin.email, "author");
  await page.goto("/admin/login");
  await signIn(page, admin);
  await page.waitForURL("**/admin/posts");
  const response = await page.goto("/start");
  expect(response?.status()).toBe(404);
});

test("a site with a published page goes to /admin", async ({ page }) => {
  await withDatabase(async (sql) => {
    await sql`
      insert into entries (site_id, type, title, slug, blocks, blocks_format, status, published_at, author_id)
      select ${siteId}, 'page', 'About', 'about', ${sql.json(textDocument("Hello.") as never)}, 'v4',
             'published', now(), id
      from users where email = ${admin.email}
    `;
  });
  await page.goto("/admin/login");
  await signIn(page, admin);
  await page.waitForURL("**/admin/posts");
  await page.goto("/start");
  await page.waitForURL("**/admin/posts");
  expect(new URL(page.url()).pathname).toBe("/admin/posts");
});

test("a suspended site goes to /admin", async ({ page }) => {
  await page.goto("/admin/login");
  await signIn(page, admin);
  await page.waitForURL("**/admin/posts");
  await withDatabase(async (sql) => {
    await sql`update sites set suspended_at = now() where id = ${siteId}`;
  });
  await page.goto("/start");
  await page.waitForURL("**/admin/posts");
});

test("with AI off, /start goes to /admin", async ({ page }) => {
  const off = `http://127.0.0.1:${HOST_SPLIT_PORT}`;
  await page.goto(`${off}/admin/login`);
  await signIn(page, admin);
  await page.waitForURL("**/admin/posts");
  await page.goto(`${off}/start`);
  await page.waitForURL("**/admin/posts");
});

test("step 1 has no horizontal scroll at 390px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await logInThenOpen(page, "/start");
  await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
  expect(await page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")).toBe(
    true,
  );
});
