import { randomInt } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import { logIn } from "./helpers/auth.ts";
import { textDocument } from "./helpers/documents.ts";
import { HOST_SPLIT_PORT } from "./helpers/ports.ts";
import { createSiteAdmin, createSiteWithAddress, deleteSite, siteUrl } from "./helpers/sites.ts";
import { setRole, type TestUser, withDatabase } from "./helpers/users.ts";

// Item 18b4a, Step 5: Home at /admin. Each test makes its own site and members,
// never site 1.
let siteId: string;
let address: string;
let admin: TestUser;

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({
    "X-Forwarded-For": `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`,
  });
  const site = await createSiteWithAddress("home");
  siteId = site.id;
  address = site.address;
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

// Item 18b4a, Step 6: Home's panel. Runs are seeded as the owner, so nothing
// waits on the fake provider.
function proposal() {
  const text = { kind: "text", heading: "Details", paragraphs: ["One."] };
  return {
    siteDescription: "A bakery.",
    brandColor: "#aa5500",
    pages: [
      { key: "p1", title: "Front", seoTitle: "Front", seoDescription: "Bread.", sections: [text] },
      { key: "p2", title: "About", seoTitle: "About", seoDescription: "Us.", sections: [text] },
    ],
    navigation: ["p1", "p2"],
  };
}

async function seedRun(status: "succeeded" | "applied", result: unknown = proposal()) {
  return withDatabase(async (sql) => {
    const [row] = await sql<{ id: string }[]>`
      insert into ai_runs (site_id, kind, description, status, result, finished_at)
      values (${siteId}, 'business', 'A bakery.', ${status}, ${sql.json(result as never)}, now())
      returning id
    `;
    return row.id;
  });
}

async function useDraft(page: Page, runId: string) {
  await page.goto(`/start/${runId}`);
  await page.getByRole("button", { name: "Use this draft" }).click();
  await page.waitForURL(/\/admin$/);
}

test("after a draft is used, Home says the website is ready and Edit the home page opens it", async ({
  page,
}) => {
  const runId = await seedRun("succeeded");
  await logIn(page, admin);
  await useDraft(page, runId);

  await expect(page.getByText("Not published yet")).toBeVisible();
  await expect(
    page.getByRole("heading", {
      level: 2,
      name: "Your website is ready. What would you like to change?",
    }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "We drafted 2 pages from your description. Look them over, change anything, then publish - nobody sees it before that.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Publish website" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Preview" })).toHaveAttribute(
    "href",
    "/admin/preview",
  );
  const suggestions = page.getByRole("region", { name: "Things to change" }).getByRole("link");
  await expect(suggestions).toHaveText(["Edit the home page", "Add your logo", "Change the menu"]);
  await expect(page.getByRole("link", { name: "Add your logo" })).toHaveAttribute(
    "href",
    "/admin/settings",
  );
  await expect(page.getByRole("link", { name: "Change the menu" })).toHaveAttribute(
    "href",
    "/admin/settings",
  );
  await expect(page.getByRole("link", { name: "Start from a description" })).toHaveCount(0);

  await page.getByRole("link", { name: "Edit the home page" }).click();
  await page.waitForURL(/\/admin\/pages\/[0-9a-f-]{36}$/);
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Front");
});

test("an admin of an empty site is offered Start from a description", async ({ page }) => {
  await logIn(page, admin);
  await page.getByRole("link", { name: "Start from a description" }).click();
  await page.waitForURL("**/start");
});

test("an unused succeeded run is offered as Review your draft", async ({ page }) => {
  const runId = await seedRun("succeeded");
  await logIn(page, admin);
  await expect(page.getByRole("link", { name: "Start from a description" })).toHaveCount(0);
  await page.getByRole("link", { name: "Review your draft" }).click();
  await page.waitForURL(`**/start/${runId}`);
});

test("a site with a published page shows no panel", async ({ page }) => {
  await seedPage("Live", "live", "published");
  await seedRun("succeeded");
  await logIn(page, admin);
  await expect(page.getByRole("heading", { level: 1, name: "Home" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Start from a description" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Review your draft" })).toHaveCount(0);
  await expect(page.getByText("Not published yet")).toHaveCount(0);
});

test("with AI off, Home shows no panel", async ({ page }) => {
  const off = `http://127.0.0.1:${HOST_SPLIT_PORT}`;
  await page.goto(`${off}/admin/login`);
  await page.getByLabel("Email").fill(admin.email);
  await page.getByLabel("Password").fill(admin.password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(/\/admin$/);
  await expect(page.getByRole("heading", { level: 1, name: "Home" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Start from a description" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Review your draft" })).toHaveCount(0);
});

test("This month shows the AI allowance as a percentage, never credits or tokens", async ({
  page,
}) => {
  await withDatabase(async (sql) => {
    // Two runs this month holding 250 credits; one from last month, not counted.
    await sql`
      insert into ai_runs (site_id, kind, description, status, credits, created_at, finished_at)
      values (${siteId}, 'business', 'A', 'failed', 100, now(), now()),
             (${siteId}, 'business', 'B', 'failed', 150, now(), now()),
             (${siteId}, 'business', 'C', 'failed', 400, date_trunc('month', now()) - interval '1 day', now())
    `;
  });
  await logIn(page, admin);
  const card = page.getByRole("region", { name: "This month" });
  const meter = card.getByRole("meter", { name: "AI allowance" });
  await expect(meter).toHaveAttribute("value", "250");
  await expect(card.getByText("25% of this month's AI allowance used.")).toBeVisible();
  await expect(card.getByRole("meter", { name: "Storage" })).toBeVisible();
  const body = (await page.locator("body").innerText()).toLowerCase();
  expect(body).not.toMatch(/credit|token/);
});

test("with AI off, This month has no AI meter and keeps storage", async ({ page }) => {
  const off = `http://127.0.0.1:${HOST_SPLIT_PORT}`;
  await page.goto(`${off}/admin/login`);
  await page.getByLabel("Email").fill(admin.email);
  await page.getByLabel("Password").fill(admin.password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(/\/admin$/);
  const card = page.getByRole("region", { name: "This month" });
  await expect(card.getByRole("meter", { name: "Storage" })).toBeVisible();
  await expect(card.getByRole("meter", { name: "AI allowance" })).toHaveCount(0);
});

// F-365: Home applies the same parse rule as the review page.
test("an unreadable succeeded run is not offered as Review your draft", async ({ page }) => {
  await seedRun("succeeded", {});
  await logIn(page, admin);
  await expect(page.getByRole("link", { name: "Start from a description" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Review your draft" })).toHaveCount(0);
});

test("an unreadable applied run does not say how many pages were drafted", async ({ page }) => {
  await seedRun("applied", {});
  await logIn(page, admin);
  await expect(page.getByText("Your website is ready")).toBeVisible();
  await expect(page.getByText("We drafted")).toHaveCount(0);
  await expect(page.getByText(/0 pages/)).toHaveCount(0);
});

// Item 18b4b, Step 4: Preview and Publish website.
test("Preview opens the preview in a new page", async ({ page, context }) => {
  const runId = await seedRun("succeeded");
  await logIn(page, admin);
  await useDraft(page, runId);
  const opened = context.waitForEvent("page");
  await page.getByRole("link", { name: "Preview" }).click();
  const preview = await opened;
  await preview.waitForURL("**/admin/preview");
  await expect(preview.getByRole("complementary", { name: "Preview" })).toBeVisible();
});

async function draftStatuses(type: "page" | "post") {
  return withDatabase(
    async (sql) =>
      sql<{ status: string; published_at: Date | null }[]>`
      select status, published_at from entries where site_id = ${siteId} and type = ${type}
    `,
  );
}

test("Publish website publishes every draft page, no post, and Home says so", async ({ page }) => {
  await withDatabase(async (sql) => {
    await sql`
      insert into entries (site_id, type, title, slug, blocks, blocks_format, status, author_id)
      select ${siteId}, 'post', 'Draft Post', 'draft-post', ${sql.json(textDocument("Hi.") as never)}, 'v4',
             'draft', id from users where email = ${admin.email}
    `;
  });
  const runId = await seedRun("succeeded");
  await logIn(page, admin);
  await useDraft(page, runId);

  const started = Date.now();
  await page.getByRole("button", { name: "Publish website" }).click();
  await page.waitForURL(/\/admin\?published=1$/);
  const elapsed = Date.now() - started;
  console.log(`publish website: click to /admin?published=1 in ${elapsed} ms`);
  expect(elapsed).toBeLessThan(1000);

  const banner = page.getByRole("status");
  await expect(banner).toContainText("Your website is published.");
  await expect(banner.getByRole("link", { name: "View your site" })).toHaveAttribute(
    "href",
    siteUrl("/", address),
  );
  await expect(page.getByText("Not published yet")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Publish website" })).toHaveCount(0);

  const pages = await draftStatuses("page");
  expect(pages).toHaveLength(2);
  for (const row of pages) {
    expect(row.status).toBe("published");
    expect(row.published_at).not.toBeNull();
  }
  expect((await draftStatuses("post")).map((row) => row.status)).toEqual(["draft"]);

  await page.goto(siteUrl("/", address));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Front");
  await expect(page.getByRole("navigation", { name: "Site" }).getByRole("link")).toHaveText([
    "Front",
    "About",
  ]);
});

test("an editor's intent=publish POST is Not Found and publishes nothing", async ({ page }) => {
  const runId = await seedRun("succeeded");
  await logIn(page, admin);
  await useDraft(page, runId);
  await setRole(admin.email, "editor");
  const origin = new URL(page.url()).origin;
  const response = await page.request.post(`${origin}/admin`, {
    form: { intent: "publish" },
    headers: { Origin: origin },
  });
  expect(response.status()).toBe(404);
  expect((await draftStatuses("page")).map((row) => row.status)).toEqual(["draft", "draft"]);
});

test("intent=publish on a site that already has a published page changes nothing", async ({
  page,
}) => {
  const runId = await seedRun("succeeded");
  await logIn(page, admin);
  await useDraft(page, runId);
  await seedPage("Live", "live", "published");
  const origin = new URL(page.url()).origin;
  const response = await page.request.post(`${origin}/admin`, {
    form: { intent: "publish" },
    headers: { Origin: origin },
    maxRedirects: 0,
  });
  expect(response.status()).toBe(302);
  expect(new URL(response.headers().location ?? "", origin).pathname).toBe("/admin");
  const statuses = (await draftStatuses("page")).map((row) => row.status).sort();
  expect(statuses).toEqual(["draft", "draft", "published"]);
});

test("Home does not scroll sideways at 390px with the ready panel or the banner", async ({
  page,
}) => {
  const runId = await seedRun("succeeded");
  await page.setViewportSize({ width: 390, height: 844 });
  await logIn(page, admin);
  await useDraft(page, runId);
  const fits = "document.documentElement.scrollWidth <= window.innerWidth";
  await expect(page.getByRole("button", { name: "Publish website" })).toBeVisible();
  expect(await page.evaluate(fits)).toBe(true);
  await page.getByRole("button", { name: "Publish website" }).click();
  await expect(page.getByRole("status")).toContainText("Your website is published.");
  expect(await page.evaluate(fits)).toBe(true);
});
