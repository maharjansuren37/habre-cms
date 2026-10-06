import { randomInt } from "node:crypto";
import { expect, test } from "@playwright/test";
import { logIn } from "./helpers/auth.ts";
import { textDocument } from "./helpers/documents.ts";
import { deleteTestMedia, uploadTestMedia } from "./helpers/media.ts";
import { resetSiteSettings } from "./helpers/site-settings.ts";
import { createSiteAdmin, createSiteWithAddress, deleteSite, siteUrl } from "./helpers/sites.ts";
import { STORAGE_REASON, skipWithoutStorage } from "./helpers/storage.ts";
import {
  createAdmin,
  createDraftFor,
  deleteEntriesBy,
  deleteTestUser,
  setRole,
  type TestUser,
  withDatabase,
} from "./helpers/users.ts";

let admin: TestUser;
// Set by a test that uploads a fixture; cleared in afterEach regardless of
// how the test ends, so a failed assertion never leaves the row behind to
// break the next test's own user cleanup via media's foreign key.
let uploadedMediaId: string | undefined;

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({
    "X-Forwarded-For": `10.${randomInt(256)}.${randomInt(256)}.11`,
  });
  admin = createAdmin("Settings Admin");
  uploadedMediaId = undefined;
});

test.afterEach(async () => {
  if (uploadedMediaId) await deleteTestMedia(uploadedMediaId);
  // Restored unconditionally - site_settings has no per-test isolation, and
  // public-site.spec.ts / smoke.spec.ts assert the literal default title.
  await resetSiteSettings();
  await deleteEntriesBy(admin.email);
  await deleteTestUser(admin.email);
});

test("an admin can set the site title and logo, and both reach the admin sidebar and the public home page", async ({
  page,
}) => {
  test.skip(skipWithoutStorage, STORAGE_REASON);
  await logIn(page, admin);
  const origin = new URL(page.url()).origin;
  const uploaded = await uploadTestMedia(page.request, origin, "1x1.png", "A fixture logo");
  uploadedMediaId = uploaded.id;

  await page.goto("/admin/settings");
  await page.getByLabel("Site title").fill("Verify Settings Site");
  await page.getByRole("button", { name: "Choose logo" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByText(uploaded.filename).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Settings updated.")).toBeVisible();

  // The admin sidebar: no other spec asserts its text, so no race to worry about.
  await expect(page.getByText("Verify Settings Site")).toBeVisible();

  // The public home page: the same literal two other spec files check for the
  // default - restored the instant this assertion is done (afterEach is the backstop).
  await page.goto(siteUrl("/"));
  await expect(page.getByRole("link", { name: "Verify Settings Site" })).toBeVisible();
  await expect(page.locator("header img")).toBeVisible();
});

test("every public page's browser title names the site, not the CMS (F-116)", async ({ page }) => {
  const siteTitle = `Title Spec Site ${randomInt(1_000_000)}`;
  const postTitle = `Title Spec Post ${randomInt(1_000_000)}`;
  const pageTitle = `Title Spec Page ${randomInt(1_000_000)}`;
  const slugOf = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  await createDraftFor(admin.email, postTitle, textDocument(), { status: "published" });
  await createDraftFor(admin.email, pageTitle, textDocument(), {
    status: "published",
    type: "page",
  });

  await logIn(page, admin);
  await page.goto("/admin/settings");
  await page.getByLabel("Site title").fill(siteTitle);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Settings updated.")).toBeVisible();

  await page.goto(siteUrl(`/posts/${slugOf(postTitle)}`));
  await expect(page).toHaveTitle(`${postTitle} - ${siteTitle}`);
  await page.goto(siteUrl(`/${slugOf(pageTitle)}`));
  await expect(page).toHaveTitle(`${pageTitle} - ${siteTitle}`);
  await page.goto(siteUrl("/posts"));
  await expect(page).toHaveTitle(`Posts - ${siteTitle}`);
  await page.goto(siteUrl("/"));
  await expect(page).toHaveTitle(siteTitle);
  const response = await page.goto(siteUrl(`/no-such-page-${randomInt(1_000_000)}`));
  expect(response?.status()).toBe(404);
  await expect(page).toHaveTitle(`Page not found - ${siteTitle}`);

  // Two other spec files assert the default title - restored now, not only in afterEach.
  await resetSiteSettings();
});

test("picking a logo for the first time leaves keyboard focus on the new Change logo button, not lost to <body>", async ({
  page,
}) => {
  test.skip(skipWithoutStorage, STORAGE_REASON);
  // F-88, the same mechanism F-76 already fixed for the image block: the
  // dialog closes and restores focus to whatever opened it, but that element
  // is exactly what this re-render is about to replace. No save happens here,
  // so this never touches the shared site_settings row.
  await logIn(page, admin);
  const origin = new URL(page.url()).origin;
  const uploaded = await uploadTestMedia(page.request, origin, "1x1.png", "A fixture logo");
  uploadedMediaId = uploaded.id;

  await page.goto("/admin/settings");
  await page.getByRole("button", { name: "Choose logo" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByText(uploaded.filename).click();

  await expect(page.getByRole("button", { name: "Change logo" })).toBeFocused();
});

test("a logo id for a media row that does not exist gets a friendly error, not a crash", async ({
  page,
}) => {
  // F-89: the column has a real foreign key, so an unchecked id would
  // otherwise reach the database as an unhandled 23503. Never touches
  // site_settings - the save is refused before updateSiteIdentity runs.
  await logIn(page, admin);
  const origin = new URL(page.url()).origin;
  const response = await page.request.post(`${origin}/admin/settings`, {
    headers: { Origin: origin },
    form: {
      siteTitle: "Doesn't matter",
      logoMediaId: "00000000-0000-0000-0000-000000000000",
      homePageId: "",
      siteDescription: "",
      language: "en",
    },
  });
  expect(response.status()).toBe(400);
  expect(await response.text()).toContain("That logo could not be saved");
});

test("an editor gets 404 from /admin/settings, and Settings is not in their nav", async ({
  page,
}) => {
  await setRole(admin.email, "editor");
  await logIn(page, admin);
  await expect(page.getByRole("link", { name: "Settings" })).toHaveCount(0);
  const response = await page.goto("/admin/settings");
  expect(response?.status()).toBe(404);
});

test("an author gets 404 from /admin/settings, and Settings is not in their nav", async ({
  page,
}) => {
  await setRole(admin.email, "author");
  await logIn(page, admin);
  await expect(page.getByRole("link", { name: "Settings" })).toHaveCount(0);
  const response = await page.goto("/admin/settings");
  expect(response?.status()).toBe(404);
});

// Item 17, step 4. These use a site of their own (F-103): a language changed on
// site 1's shared settings row would fail every other spec reading its pages.
async function withOwnSite(
  run: (site: { id: string; address: string; admin: TestUser }) => Promise<void>,
): Promise<void> {
  const site = await createSiteWithAddress("seo-settings");
  try {
    const siteAdmin = await createSiteAdmin(site.id, "Own Site Admin");
    await run({ ...site, admin: siteAdmin });
  } finally {
    await deleteSite(site.id);
  }
}

function storedSeoSettings(siteId: string) {
  return withDatabase(async (sql) => {
    const [row] = await sql<{ siteDescription: string; language: string }[]>`
      select site_description as "siteDescription", language from site_settings
      where site_id = ${siteId}
    `;
    return row;
  });
}

test("choosing a language and a description saves both, and the site's pages and 404 speak that language", async ({
  page,
}) => {
  await withOwnSite(async ({ id, address, admin: siteAdmin }) => {
    await logIn(page, siteAdmin);
    await page.goto("/admin/settings");
    await page.getByLabel("Language").selectOption({ label: "Nepali" });
    await page.getByLabel("Site description").fill("A small site about Kathmandu.");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Settings updated.")).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("Language")).toHaveValue("ne");
    await expect(page.getByLabel("Site description")).toHaveValue("A small site about Kathmandu.");
    expect(await storedSeoSettings(id)).toEqual({
      siteDescription: "A small site about Kathmandu.",
      language: "ne",
    });

    await page.goto(siteUrl("/", address));
    await expect(page.locator("html")).toHaveAttribute("lang", "ne");
    const missing = await page.goto(siteUrl("/no-such-page", address));
    expect(missing?.status()).toBe(404);
    await expect(page.locator("html")).toHaveAttribute("lang", "ne");

    // The admin is not the site's page: it keeps the interface language.
    await page.goto("/admin/settings");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });
});

test("a language that is not in the list is refused beside the field, keeping the input and saving nothing", async ({
  page,
}) => {
  await withOwnSite(async ({ id, admin: siteAdmin }) => {
    await logIn(page, siteAdmin);
    await page.goto("/admin/settings");
    await page.getByLabel("Site description").fill("Kept after the refusal");
    // A crafted value: the Nepali option is rewritten in the DOM, then chosen,
    // so the real form posts `language=xx-evil`.
    await page.locator('#language option[value="ne"]').evaluate((option) => {
      (option as unknown as { value: string }).value = "xx-evil";
    });
    await page.getByLabel("Language").selectOption("xx-evil");
    await page.getByRole("button", { name: "Save" }).click();

    const select = page.getByLabel("Language");
    await expect(page.getByText("Choose a language from the list.")).toBeVisible();
    await expect(select).toHaveAttribute("aria-invalid", "true");
    await expect(select).toHaveAccessibleDescription(/Choose a language from the list\./);
    await expect(page.getByLabel("Site description")).toHaveValue("Kept after the refusal");
    expect(await storedSeoSettings(id)).toEqual({ siteDescription: "", language: "en" });
  });
});

test("a 301-character description is refused beside the field, keeping the input and saving nothing", async ({
  page,
}) => {
  await withOwnSite(async ({ id, admin: siteAdmin }) => {
    await logIn(page, siteAdmin);
    await page.goto("/admin/settings");
    const tooLong = "d".repeat(301);
    await page.getByLabel("Site description").fill(tooLong);
    await page.getByLabel("Site title").fill("Title kept too");
    await page.getByRole("button", { name: "Save" }).click();

    const field = page.getByLabel("Site description");
    await expect(page.getByText("Site description can be up to 300 characters.")).toBeVisible();
    await expect(field).toHaveAttribute("aria-invalid", "true");
    await expect(field).toHaveAccessibleDescription(/up to 300 characters\.$/);
    await expect(field).toHaveValue(tooLong);
    await expect(page.getByLabel("Site title")).toHaveValue("Title kept too");
    expect(await storedSeoSettings(id)).toEqual({ siteDescription: "", language: "en" });
  });
});

test("a save without the description or language fields is refused as out of date and changes nothing", async ({
  page,
}) => {
  await withOwnSite(async ({ id, admin: siteAdmin }) => {
    await withDatabase(
      (sql) =>
        sql`update site_settings set site_description = 'Keep me', language = 'ne' where site_id = ${id}`,
    );
    await logIn(page, siteAdmin);
    const origin = new URL(page.url()).origin;
    const post = (form: Record<string, string>) =>
      page.request.post(`${origin}/admin/settings`, { headers: { Origin: origin }, form });

    const noDescription = await post({
      siteTitle: "Nope",
      logoMediaId: "",
      homePageId: "",
      language: "en",
    });
    expect(noDescription.status()).toBe(400);
    expect(await noDescription.text()).toContain("This form is out of date.");
    const noLanguage = await post({
      siteTitle: "Nope",
      logoMediaId: "",
      homePageId: "",
      siteDescription: "",
    });
    expect(noLanguage.status()).toBe(400);
    expect(await noLanguage.text()).toContain("This form is out of date.");
    expect(await storedSeoSettings(id)).toEqual({ siteDescription: "Keep me", language: "ne" });
  });
});

test("saving settings takes under a second", async ({ page }) => {
  await withOwnSite(async ({ admin: siteAdmin }) => {
    await logIn(page, siteAdmin);
    await page.goto("/admin/settings");
    await page.getByLabel("Site description").fill("Timed save");
    const started = Date.now();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Settings updated.")).toBeVisible();
    const elapsed = Date.now() - started;
    console.log(`settings save, click to banner: ${elapsed} ms`);
    expect(elapsed).toBeLessThan(1000);
  });
});
