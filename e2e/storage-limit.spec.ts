import { randomInt } from "node:crypto";
import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { logIn } from "./helpers/auth.ts";
import { countSiteMedia, deleteOneTestMediaRow, fillTestStorage } from "./helpers/media.ts";
import { createSite, createSiteAdmin, deleteSite } from "./helpers/sites.ts";
import { STORAGE_REASON, skipWithoutStorage } from "./helpers/storage.ts";
import { withDatabase } from "./helpers/users.ts";

const FIXTURE = path.join(import.meta.dirname, "..", "app/features/media/fixtures/1x1.jpg");

let siteId: string;
let email: string;

test.beforeEach(async ({ page }) => {
  // Failed logins are rate-limited per IP; see auth.spec.ts.
  const ip = `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`;
  await page.setExtraHTTPHeaders({ "X-Forwarded-For": ip });
  siteId = await createSite("storage-limit");
  const admin = await createSiteAdmin(siteId, "Storage Admin");
  email = admin.email;
  await logIn(page, admin);
});

test.afterEach(async () => {
  await deleteSite(siteId);
});

async function upload(page: Page) {
  await page.goto("/admin/media");
  await page.getByLabel("Image").setInputFiles(FIXTURE);
  await page.getByLabel("Alt text").fill("A single pixel");
  await page.getByRole("button", { name: "Upload" }).click();
}

test("an upload that would take the site past 500 MB is refused and adds no image", async ({
  page,
}) => {
  await fillTestStorage(siteId, email, 50);

  await upload(page);

  await expect(page.getByRole("alert")).toHaveText(
    "This image would take your site past its 500 MB of storage. Delete images you no longer use, then try again. Paid plans with more storage are coming soon.",
  );
  expect(await countSiteMedia(siteId)).toBe(50);
});

test("an upload that fits under the limit succeeds", async ({ page }) => {
  test.skip(skipWithoutStorage, STORAGE_REASON);
  await fillTestStorage(siteId, email, 49);

  await upload(page);

  await expect(page.getByRole("status")).toContainText("was uploaded");
  expect(await countSiteMedia(siteId)).toBe(50);
});

async function makePaid(id: string) {
  await withDatabase((sql) => sql`update sites set plan = 'paid' where id = ${id}`);
}

test("the same upload a Free site is refused for is accepted for a Launch site", async ({
  page,
}) => {
  test.skip(skipWithoutStorage, STORAGE_REASON);
  await fillTestStorage(siteId, email, 50);
  await upload(page);
  await expect(page.getByRole("alert")).toContainText("past its 500 MB of storage");
  expect(await countSiteMedia(siteId)).toBe(50);

  await makePaid(siteId);
  await upload(page);

  await expect(page.getByRole("status")).toContainText("was uploaded");
  expect(await countSiteMedia(siteId)).toBe(51);
});

test("a Launch site's Media meter shows the Launch limit", async ({ page }) => {
  await fillTestStorage(siteId, email, 3);
  await makePaid(siteId);

  await page.goto("/admin/media");

  await expect(page.getByText("30 MB of 1000 MB used")).toBeVisible();
  const meter = page.getByRole("meter", { name: "Storage" });
  await expect(meter).toHaveJSProperty("max", 1000 * 1024 * 1024);
});

const FULL_LINE =
  "Your site has used all of its 500 MB of storage. Delete images you no longer use to upload more.";

test("Media shows the storage used out of the limit with a meter", async ({ page }) => {
  await fillTestStorage(siteId, email, 3);

  await page.goto("/admin/media");

  await expect(page.getByText("30 MB of 500 MB used")).toBeVisible();
  const meter = page.getByRole("meter", { name: "Storage" });
  await expect(meter).toHaveJSProperty("value", 31457280);
  await expect(meter).toHaveJSProperty("max", 524288000);
  await expect(page.getByText(FULL_LINE)).toHaveCount(0);
});

test("a full site says its storage is full", async ({ page }) => {
  await fillTestStorage(siteId, email, 50);

  await page.goto("/admin/media");

  await expect(page.getByText("500 MB of 500 MB used")).toBeVisible();
  await expect(page.getByText(FULL_LINE, { exact: true })).toBeVisible();
});

test("deleting an image lowers the storage used", async ({ page }) => {
  await fillTestStorage(siteId, email, 50);
  // In the database, not the delete screen, so the test needs no R2 and runs in CI.
  await deleteOneTestMediaRow(siteId);

  await page.goto("/admin/media");

  await expect(page.getByText("490 MB of 500 MB used")).toBeVisible();
  await expect(page.getByText(FULL_LINE)).toHaveCount(0);
});
