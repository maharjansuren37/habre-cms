import { randomInt } from "node:crypto";
import { expect, test } from "@playwright/test";
import { logIn } from "./helpers/auth.ts";
import { textDocument } from "./helpers/documents.ts";
import { resetSiteSettings } from "./helpers/site-settings.ts";
import { siteOneId, siteUrl } from "./helpers/sites.ts";
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
  pageId = await createDraftFor(admin.email, pageTitle, textDocument(), { type: "page" });
});

test.afterEach(async () => {
  // site_settings is a singleton every public spec reads: `/` must be back to
  // no home page whatever happened above (resetSiteSettings clears
  // home_page_id too).
  await resetSiteSettings();
  await deleteEntriesBy(admin.email);
  await deleteTestUser(admin.email);
});

async function storedHomePageId(): Promise<string | null> {
  const siteId = await siteOneId();
  return withDatabase(async (sql) => {
    const [row] = await sql<{ homePageId: string | null }[]>`
      select home_page_id as "homePageId" from site_settings where site_id = ${siteId}
    `;
    return row.homePageId;
  });
}

async function storedSiteTitle(): Promise<string> {
  const siteId = await siteOneId();
  return withDatabase(async (sql) => {
    const [row] = await sql<{ siteTitle: string }[]>`
      select site_title as "siteTitle" from site_settings where site_id = ${siteId}
    `;
    return row.siteTitle;
  });
}

test("an admin can choose a page as the home page, and switch back to no home page", async ({
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
    page.getByText("Not published - visitors see a placeholder until it is."),
  ).toBeVisible();
  // A fresh load, not reload(): the ?updated=1 banner would otherwise already
  // be showing and let the next save's assertion pass before it lands.
  await page.goto("/admin/settings");
  await expect(page.getByLabel("Home page")).toHaveValue(pageId);
  expect(await storedHomePageId()).toBe(pageId);

  await page.getByLabel("Home page").selectOption({ label: "No home page" });
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
  const postId = await createDraftFor(
    admin.email,
    `Not a page ${randomInt(1_000_000)}`,
    textDocument(),
  );
  const titleBefore = await storedSiteTitle();
  await logIn(page, admin);
  const origin = new URL(page.url()).origin;
  for (const homePageId of [postId, "00000000-0000-0000-0000-000000000000", "not-a-uuid"]) {
    const response = await page.request.post(`${origin}/admin/settings`, {
      headers: { Origin: origin },
      form: {
        siteTitle: "Doesn't matter",
        logoMediaId: "",
        homePageId,
        siteDescription: "",
        language: "en",
        contactNotifyEmail: "",
      },
    });
    expect(response.status()).toBe(400);
    expect(await response.text()).toContain("That home page could not be saved. Choose it again.");
  }
  expect(await storedHomePageId()).toBeNull();
  // Nothing means nothing: the title in the same refused form was not saved either (F-109).
  expect(await storedSiteTitle()).toBe(titleBefore);
});

test("/ shows the placeholder by default, never the posts, which are at /posts (D-12)", async ({
  page,
}) => {
  const postTitle = `Home Spec Post ${randomInt(1_000_000)}`;
  await createDraftFor(admin.email, postTitle, textDocument(), { status: "published" });

  await page.goto(siteUrl("/"));
  await expect(page.getByText("This site is being set up.")).toBeVisible();
  await expect(page.getByRole("link", { name: postTitle })).toHaveCount(0);
  await expect(page).toHaveTitle("Habre CMS");
  await page.getByRole("link", { name: "Read the posts" }).click();
  await expect(page).toHaveURL(/\/posts$/);
  await expect(page.getByRole("link", { name: postTitle })).toBeVisible();
});

test("a chosen page takes /, its own address lands on /, and unpublishing it brings the placeholder back", async ({
  page,
}) => {
  const postTitle = `Home Spec Post ${randomInt(1_000_000)}`;
  await createDraftFor(admin.email, postTitle, textDocument(), { status: "published" });
  const homeTitle = `Front Door ${randomInt(1_000_000)}`;
  const homeSlug = homeTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  await createDraftFor(admin.email, homeTitle, textDocument("Welcome to the front door."), {
    status: "published",
    type: "page",
  });

  await logIn(page, admin);
  await page.goto("/admin/settings");
  await page.getByLabel("Home page").selectOption({ label: homeTitle });
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Settings updated.")).toBeVisible();

  await page.goto(siteUrl("/"));
  await expect(page.getByRole("heading", { level: 1, name: homeTitle })).toBeVisible();
  await expect(page.getByText("Welcome to the front door.")).toBeVisible();
  await expect(page).toHaveTitle(`${homeTitle} - Habre CMS`);

  await page.goto(siteUrl("/posts"));
  await expect(page.getByRole("link", { name: postTitle })).toBeVisible();

  const response = await page.goto(siteUrl(`/${homeSlug}`));
  expect(new URL(page.url()).pathname).toBe("/");
  expect(response?.request().redirectedFrom()?.url()).toContain(`/${homeSlug}`);
  await expect(page.getByRole("heading", { level: 1, name: homeTitle })).toBeVisible();

  await page.goto("/admin/pages");
  await page.getByRole("link", { name: homeTitle, exact: true }).click();
  await page.waitForURL(/\/admin\/pages\/[0-9a-f-]+$/);
  await page.getByRole("button", { name: "Unpublish" }).click();
  await page.waitForURL(/unpublished=/);

  await page.goto(siteUrl("/"));
  await expect(page.getByText("This site is being set up.")).toBeVisible();
  await expect(page.getByRole("link", { name: postTitle })).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1, name: homeTitle })).toHaveCount(0);

  // Leave `/` as every other spec expects it; afterEach is only the backstop.
  await resetSiteSettings();
});

test("with a home page set, a post's All posts link still leads to the post list (F-105)", async ({
  page,
}) => {
  const postTitle = `Home Spec Post ${randomInt(1_000_000)}`;
  const postSlug = postTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  await createDraftFor(admin.email, postTitle, textDocument(), { status: "published" });
  const homeId = await createDraftFor(
    admin.email,
    `Front Door ${randomInt(1_000_000)}`,
    textDocument(),
    {
      status: "published",
      type: "page",
    },
  );
  const siteId = await siteOneId();
  await withDatabase(
    (sql) => sql`update site_settings set home_page_id = ${homeId} where site_id = ${siteId}`,
  );

  await page.goto(siteUrl(`/posts/${postSlug}`));
  await page.getByRole("link", { name: "All posts" }).click();
  await expect(page).toHaveURL(/\/posts$/);
  await expect(page.getByRole("link", { name: postTitle })).toBeVisible();

  // Leave `/` as every other spec expects it; afterEach is only the backstop.
  await resetSiteSettings();
});

test("a save with no homePageId is refused with 400 and changes nothing (F-107)", async ({
  page,
}) => {
  await logIn(page, admin);
  await page.goto("/admin/settings");
  await page.getByLabel("Home page").selectOption({ label: pageTitle });
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Settings updated.")).toBeVisible();
  const titleBefore = await storedSiteTitle();

  const origin = new URL(page.url()).origin;
  const response = await page.request.post(`${origin}/admin/settings`, {
    headers: { Origin: origin },
    form: { siteTitle: "Should not be saved", logoMediaId: "" },
  });
  expect(response.status()).toBe(400);
  expect(await response.text()).toContain(
    "This form is out of date. Reload the page and try again.",
  );
  expect(await storedHomePageId()).toBe(pageId);
  expect(await storedSiteTitle()).toBe(titleBefore);

  await resetSiteSettings();
});

test("a settings save over 16 KB is refused with 413 (F-117)", async ({ page }) => {
  await logIn(page, admin);
  const origin = new URL(page.url()).origin;
  const response = await page.request.post(`${origin}/admin/settings`, {
    headers: { Origin: origin },
    form: { siteTitle: "x".repeat(17 * 1024), logoMediaId: "", homePageId: "" },
  });
  expect(response.status()).toBe(413);
});
