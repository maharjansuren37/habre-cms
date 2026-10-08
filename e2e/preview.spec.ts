import { randomInt } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import { logIn } from "./helpers/auth.ts";
import {
  createSite,
  createSiteAdmin,
  createSiteWithAddress,
  deleteSite,
  siteUrl,
} from "./helpers/sites.ts";
import { setRole, type TestUser, withDatabase } from "./helpers/users.ts";

// Item 18b4b, Step 2: the preview of the home page. Each test makes its own
// site and members, never site 1; the draft is made the way a person does it
// (a seeded succeeded run, then Use this draft).
let siteId: string;
let address: string;
let admin: TestUser;

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({
    "X-Forwarded-For": `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`,
  });
  const site = await createSiteWithAddress("preview");
  siteId = site.id;
  address = site.address;
  admin = await createSiteAdmin(siteId, "Preview Admin");
});

test.afterEach(async () => {
  await deleteSite(siteId);
});

function proposal() {
  const text = { kind: "text", heading: "Details", paragraphs: ["One."] };
  const hero = {
    kind: "hero",
    heading: "Front",
    body: "Fresh bread.",
    buttonLabel: "See more",
    buttonTarget: "p2",
  };
  return {
    siteDescription: "A bakery.",
    brandColor: "#aa5500",
    pages: [
      { key: "p1", title: "Front", seoTitle: "Front", seoDescription: "Bread.", sections: [hero] },
      { key: "p2", title: "About", seoTitle: "About", seoDescription: "Us.", sections: [text] },
    ],
    navigation: ["p1", "p2"],
  };
}

async function useDraft(page: Page) {
  const runId = await withDatabase(async (sql) => {
    const [row] = await sql<{ id: string }[]>`
      insert into ai_runs (site_id, kind, description, status, result, finished_at)
      values (${siteId}, 'business', 'A bakery.', 'succeeded', ${sql.json(proposal() as never)}, now())
      returning id
    `;
    return row.id;
  });
  await logIn(page, admin);
  await page.goto(`/start/${runId}`);
  await page.getByRole("button", { name: "Use this draft" }).click();
  await page.waitForURL(/\/admin$/);
}

test("an admin's /admin/preview shows the draft home page in the site's look, marked and not indexed", async ({
  page,
}) => {
  await useDraft(page);
  const stylePreset = await withDatabase(async (sql) => {
    const [row] = await sql<{ style_preset: string }[]>`
      select style_preset from site_settings where site_id = ${siteId}
    `;
    return row.style_preset;
  });

  const response = await page.goto("/admin/preview");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Front");

  const bar = page.getByRole("complementary", { name: "Preview" });
  await expect(bar).toHaveAttribute("lang", "en");
  await expect(bar).toContainText("Preview - nobody else can see this until you publish.");
  await expect(bar.getByRole("link", { name: "Back to Home" })).toHaveAttribute("href", "/admin");

  const menu = page.getByRole("navigation", { name: "Site" });
  await expect(menu.getByRole("link")).toHaveText(["Front", "About"]);
  await expect(menu.getByRole("link", { name: "Front" })).toHaveAttribute("href", "/admin/preview");
  await expect(menu.getByRole("link", { name: "About" })).toHaveAttribute(
    "href",
    "/admin/preview/about",
  );
  await expect(page.getByRole("banner")).toContainText(address);

  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-surface", "site");
  await expect(html).toHaveAttribute("data-style", stylePreset);
  const source = (await response?.text()) ?? "";
  expect(source).toMatch(/<style nonce="[^"]+">\[data-surface="site"\]\{--color-primary:/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex");
});

test("the site host's / is unchanged: the preview never reaches it", async ({ page }) => {
  await useDraft(page);
  await page.goto(siteUrl("/", address));
  await expect(page.getByText("This site is being set up.")).toBeVisible();
});

test("with no home page, the preview shows the being-set-up placeholder in the preview chrome", async ({
  page,
}) => {
  await useDraft(page);
  await withDatabase(async (sql) => {
    await sql`update site_settings set home_page_id = null where site_id = ${siteId}`;
  });
  await page.goto("/admin/preview");
  await expect(page.getByText("This site is being set up.")).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Preview" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
});

for (const role of ["editor", "author"] as const) {
  test(`an ${role} gets Not Found at /admin/preview`, async ({ page }) => {
    await setRole(admin.email, role);
    await logIn(page, admin);
    const response = await page.goto("/admin/preview");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("complementary", { name: "Preview" })).toHaveCount(0);
  });
}

test("a signed-out visitor is sent to sign in", async ({ page }) => {
  await page.goto("/admin/preview");
  await page.waitForURL(/\/admin\/login/);
});

test("the preview does not scroll sideways at 390px", async ({ page }) => {
  await useDraft(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/preview");
  await expect(page.getByRole("complementary", { name: "Preview" })).toBeVisible();
  expect(await page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")).toBe(
    true,
  );
});

// Step 3: every page of the site, drafts included.
test("following the menu opens each drafted page's preview with one h1", async ({ page }) => {
  await useDraft(page);
  await page.goto("/admin/preview");
  const menu = page.getByRole("navigation", { name: "Site" });
  await menu.getByRole("link", { name: "About" }).click();
  await page.waitForURL("**/admin/preview/about");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("About");
  await expect(page.getByRole("complementary", { name: "Preview" })).toBeVisible();

  await menu.getByRole("link", { name: "Front" }).click();
  await page.waitForURL(/\/admin\/preview$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Front");
});

test("the hero's button leads to the drafted page's preview address", async ({ page }) => {
  await useDraft(page);
  await page.goto("/admin/preview");
  const button = page.getByRole("main").getByRole("link", { name: "See more" });
  await expect(button).toHaveAttribute("href", "/admin/preview/about");
  await button.click();
  await page.waitForURL("**/admin/preview/about");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("About");
});

test("the site name in the header leads back to /admin/preview", async ({ page }) => {
  await useDraft(page);
  await page.goto("/admin/preview/about");
  const brand = page.getByRole("banner").getByRole("link", { name: address });
  await expect(brand).toHaveAttribute("href", "/admin/preview");
  await brand.click();
  await page.waitForURL(/\/admin\/preview$/);
});

test("the home page's own preview address lands on /admin/preview", async ({ page }) => {
  await useDraft(page);
  await page.goto("/admin/preview/front");
  await page.waitForURL(/\/admin\/preview$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Front");
});

test("another site's page is Not Found in the preview", async ({ page }) => {
  await useDraft(page);
  const other = await createSite("preview-other");
  try {
    await withDatabase(async (sql) => {
      await sql`
        insert into entries (site_id, type, title, slug, blocks, blocks_format, status)
        values (${other}, 'page', 'Elsewhere', 'elsewhere',
                ${sql.json({ type: "doc", content: [] } as never)}, 'v4', 'draft')
      `;
    });
    const response = await page.goto("/admin/preview/elsewhere");
    expect(response?.status()).toBe(404);
    await expect(page.getByText("Page not found.")).toBeVisible();
    await expect(page.getByRole("complementary", { name: "Preview" })).toBeVisible();
  } finally {
    await deleteSite(other);
  }
});

test("a draft page's address on the site host is still Not Found", async ({ page }) => {
  await useDraft(page);
  const response = await page.goto(siteUrl("/about", address));
  expect(response?.status()).toBe(404);
});
