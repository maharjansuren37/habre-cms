import { randomInt } from "node:crypto";
import { expect, test } from "@playwright/test";
import { logIn } from "./helpers/auth.ts";
import { textDocument } from "./helpers/documents.ts";
import { createSite, createSiteAdmin, deleteSite } from "./helpers/sites.ts";
import { setRole, type TestUser, withDatabase } from "./helpers/users.ts";

// Item 18b4a, Step 5: Home at /admin. Each test makes its own site and members,
// never site 1.
let siteId: string;
let admin: TestUser;

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({
    "X-Forwarded-For": `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`,
  });
  siteId = await createSite("home");
  admin = await createSiteAdmin(siteId, "Home Admin");
});

test.afterEach(async () => {
  await deleteSite(siteId);
});

async function seedPage(title: string, slug: string, status: "draft" | "published" = "draft") {
  await withDatabase(async (sql) => {
    await sql`
      insert into entries (site_id, type, title, slug, blocks, blocks_format, status, published_at, author_id)
      select ${siteId}, 'page', ${title}, ${slug}, ${sql.json(textDocument("Hello.") as never)}, 'v4',
             ${status}, ${status === "published" ? new Date() : null}, id
      from users where email = ${admin.email}
    `;
  });
}

test("an admin's /admin is Home, listing the site's pages with Draft and an Edit link", async ({
  page,
}) => {
  await seedPage("Seeded Draft", "seeded-draft");
  await logIn(page, admin);

  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Home");

  const card = page.getByRole("region", { name: "Your pages" });
  const row = card.getByRole("listitem").filter({ hasText: "Seeded Draft" });
  await expect(row).toContainText("Draft");

  await row.getByRole("link", { name: "Edit Seeded Draft" }).click();
  await page.waitForURL(/\/admin\/pages\/[0-9a-f-]{36}$/);
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Seeded Draft");
});

test("a published page reads Published, and a site with no pages says so with a way to add one", async ({
  page,
}) => {
  await logIn(page, admin);
  const card = page.getByRole("region", { name: "Your pages" });
  await expect(card.getByText("No pages yet.")).toBeVisible();
  await expect(card.getByRole("link", { name: "Add a page" })).toHaveAttribute(
    "href",
    "/admin/pages/new",
  );

  await seedPage("Live One", "live-one", "published");
  await page.goto("/admin");
  await expect(card.getByRole("listitem").filter({ hasText: "Live One" })).toContainText(
    "Published",
  );
});

test("Your pages shows the first 20 and links to Pages for the rest", async ({ page }) => {
  for (let i = 1; i <= 21; i++) await seedPage(`Bulk ${i}`, `bulk-${i}`);
  await logIn(page, admin);
  const card = page.getByRole("region", { name: "Your pages" });
  await expect(card.getByRole("listitem")).toHaveCount(20);
  await expect(card.getByRole("link", { name: "All pages" })).toHaveAttribute(
    "href",
    "/admin/pages",
  );
});

test("the sidebar's Home is first and is the current page on Home", async ({ page }) => {
  await logIn(page, admin);
  const nav = page.getByRole("navigation", { name: "Admin" });
  await expect(nav.getByRole("link").first()).toHaveText("Home");
  await expect(nav.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
});

for (const role of ["editor", "author"] as const) {
  test(`an ${role} landing on /admin reaches Posts and has no Home in the sidebar`, async ({
    page,
  }) => {
    await setRole(admin.email, role);
    await logIn(page, admin);
    await page.goto("/admin");
    await page.waitForURL("**/admin/posts");
    await expect(
      page.getByRole("navigation", { name: "Admin" }).getByRole("link", { name: "Home" }),
    ).toHaveCount(0);
  });
}

test("Home does not scroll sideways at 390px", async ({ page }) => {
  await seedPage("A page with a fairly long title that has to wrap on a phone", "long-one");
  await page.setViewportSize({ width: 390, height: 800 });
  await logIn(page, admin);
  await expect(page.getByRole("heading", { level: 1, name: "Home" })).toBeVisible();
  expect(await page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")).toBe(
    true,
  );
});
