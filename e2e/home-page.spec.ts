import { randomInt } from "node:crypto";
import { expect, test } from "@playwright/test";
import { logIn } from "./helpers/auth.ts";
import { resetSiteSettings } from "./helpers/site-settings.ts";
import {
  createAdmin,
  createDraftFor,
  deleteEntriesBy,
  deleteTestUser,
  type TestUser,
  withDatabase,
} from "./helpers/users.ts";

let admin: TestUser;
// Unique per test, so a page's slug never collides with another run's leftovers.
let pageTitle: string;
let pageId: string;

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({
    "X-Forwarded-For": `10.${randomInt(256)}.${randomInt(256)}.19`,
  });
  admin = createAdmin("Home Page Admin");
  pageTitle = `Welcome ${randomInt(1_000_000)}`;
  pageId = await createDraftFor(admin.email, pageTitle, [], { type: "page" });
});

test.afterEach(async () => {
  // site_settings is a singleton every public spec reads: `/` must be back to
  // the latest posts whatever happened above (resetSiteSettings clears
  // home_page_id too).
  await resetSiteSettings();
  await deleteEntriesBy(admin.email);
  await deleteTestUser(admin.email);
});

function storedHomePageId(): Promise<string | null> {
  return withDatabase(async (sql) => {
    const [row] = await sql<{ homePageId: string | null }[]>`
      select home_page_id as "homePageId" from site_settings where id = 1
    `;
    return row.homePageId;
  });
}

test("an admin can choose a page as the home page, and switch back to the latest posts", async ({
  page,
}) => {
  await logIn(page, admin);
  await page.goto("/admin/settings");
  await expect(page.getByLabel("Home page")).toHaveValue("");

  await page.getByLabel("Home page").selectOption({ label: pageTitle });
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Settings updated.")).toBeVisible();
  // A draft can be chosen (D-5), with the hint saying what visitors see meanwhile.
  await expect(
    page.getByText("Not published - visitors see the latest posts until it is."),
  ).toBeVisible();
  // A fresh load, not reload(): the ?updated=1 banner would otherwise already
  // be showing and let the next save's assertion pass before it lands.
  await page.goto("/admin/settings");
  await expect(page.getByLabel("Home page")).toHaveValue(pageId);
  expect(await storedHomePageId()).toBe(pageId);

  await page.getByLabel("Home page").selectOption({ label: "Latest posts" });
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Settings updated.")).toBeVisible();
  expect(await storedHomePageId()).toBeNull();
});

test.describe("without JavaScript", () => {
  // Only a full-page round trip proves the action carries the choice back:
  // with JavaScript the select keeps its own DOM value and would pass anyway.
  test.use({ javaScriptEnabled: false });

  test("the chosen home page survives a navigation add/remove round trip before saving", async ({
    page,
  }) => {
    await logIn(page, admin);
    await page.goto("/admin/settings");
    await page.getByLabel("Home page").selectOption({ label: pageTitle });
    await page.getByRole("button", { name: "Add item" }).click();
    await expect(page.getByRole("group", { name: "Item 1" })).toBeVisible();
    await expect(page.getByLabel("Home page")).toHaveValue(pageId);
  });
});

test("a post's id or an unknown id as the home page gets a friendly 400, and nothing is saved", async ({
  page,
}) => {
  // D-6: the foreign key cannot tell a page from a post, and an unknown id
  // would reach the database as an unhandled 23503 (F-89's pattern).
  const postId = await createDraftFor(admin.email, `Not a page ${randomInt(1_000_000)}`, []);
  await logIn(page, admin);
  const origin = new URL(page.url()).origin;
  for (const homePageId of [postId, "00000000-0000-0000-0000-000000000000", "not-a-uuid"]) {
    const response = await page.request.post(`${origin}/admin/settings`, {
      headers: { Origin: origin },
      form: { siteTitle: "Doesn't matter", logoMediaId: "", homePageId },
    });
    expect(response.status()).toBe(400);
    expect(await response.text()).toContain("That home page could not be saved. Choose it again.");
  }
  expect(await storedHomePageId()).toBeNull();
});

test("the latest posts are at / by default, and at /posts always", async ({ page }) => {
  const postTitle = `Home Spec Post ${randomInt(1_000_000)}`;
  await createDraftFor(admin.email, postTitle, [], { status: "published" });

  await page.goto("/");
  await expect(page.getByRole("link", { name: postTitle })).toBeVisible();
  await expect(page).toHaveTitle("Habre CMS");
  await page.goto("/posts");
  await expect(page.getByRole("link", { name: postTitle })).toBeVisible();
});

test("a chosen page takes /, its own address lands on /, and unpublishing it brings the list back", async ({
  page,
}) => {
  const postTitle = `Home Spec Post ${randomInt(1_000_000)}`;
  await createDraftFor(admin.email, postTitle, [], { status: "published" });
  const homeTitle = `Front Door ${randomInt(1_000_000)}`;
  const homeSlug = homeTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  await createDraftFor(
    admin.email,
    homeTitle,
    [{ id: "welcome", type: "text", data: { text: [{ text: "Welcome to the front door." }] } }],
    { status: "published", type: "page" },
  );

  await logIn(page, admin);
  await page.goto("/admin/settings");
  await page.getByLabel("Home page").selectOption({ label: homeTitle });
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Settings updated.")).toBeVisible();

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: homeTitle })).toBeVisible();
  await expect(page.getByText("Welcome to the front door.")).toBeVisible();
  await expect(page).toHaveTitle(`${homeTitle} - Habre CMS`);

  await page.goto("/posts");
  await expect(page.getByRole("link", { name: postTitle })).toBeVisible();

  const response = await page.goto(`/${homeSlug}`);
  expect(new URL(page.url()).pathname).toBe("/");
  expect(response?.request().redirectedFrom()?.url()).toContain(`/${homeSlug}`);
  await expect(page.getByRole("heading", { level: 1, name: homeTitle })).toBeVisible();

  await page.goto("/admin/pages");
  await page.getByRole("link", { name: homeTitle, exact: true }).click();
  await page.waitForURL(/\/admin\/pages\/[0-9a-f-]+$/);
  await page.getByRole("button", { name: "Unpublish" }).click();
  await page.waitForURL(/unpublished=/);

  await page.goto("/");
  await expect(page.getByRole("link", { name: postTitle })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: homeTitle })).toHaveCount(0);

  // Leave `/` as every other spec expects it; afterEach is only the backstop.
  await resetSiteSettings();
});
