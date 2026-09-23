import { randomInt } from "node:crypto";
import { expect, test } from "@playwright/test";
import { logIn } from "./helpers/auth.ts";
import { deleteTestMedia, uploadTestMedia } from "./helpers/media.ts";
import { resetSiteSettings } from "./helpers/site-settings.ts";
import { createAdmin, deleteTestUser, setRole, type TestUser } from "./helpers/users.ts";

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
  await deleteTestUser(admin.email);
});

test("an admin can set the site title and logo, and both reach the admin sidebar and the public home page", async ({
  page,
}) => {
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
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Verify Settings Site" })).toBeVisible();
  await expect(page.locator("header img")).toBeVisible();
});

test("picking a logo for the first time leaves keyboard focus on the new Change logo button, not lost to <body>", async ({
  page,
}) => {
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
    form: { siteTitle: "Doesn't matter", logoMediaId: "00000000-0000-0000-0000-000000000000" },
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
