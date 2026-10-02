import { randomInt } from "node:crypto";
import { expect, test } from "@playwright/test";
import { logIn } from "./helpers/auth.ts";
import { textDocument } from "./helpers/documents.ts";
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

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({
    "X-Forwarded-For": `10.${randomInt(256)}.${randomInt(256)}.15`,
  });
  admin = createAdmin("Nav Admin");
  await createDraftFor(admin.email, "About Us", textDocument(), {
    status: "published",
    type: "page",
  });
});

test.afterEach(async () => {
  // navigation has no per-test isolation any more than site_title does
  // (site-settings.ts) - reset before the entries it might still reference
  // go, not only after.
  await resetSiteSettings();
  await deleteEntriesBy(admin.email);
  await deleteTestUser(admin.email);
});

test("an admin adds a page item and a URL item, reorders, removes one, and the header reflects it", async ({
  page,
}) => {
  await logIn(page, admin);
  await page.goto("/admin/settings");

  await page.getByRole("button", { name: "Add item" }).click();
  await page.getByLabel("Label").nth(0).fill("About");
  await page.getByLabel("Existing page").nth(0).selectOption({ label: "About Us" });

  await page.getByRole("button", { name: "Add item" }).click();
  await page.getByLabel("Label").nth(1).fill("Docs");
  await page.getByLabel("Web address").nth(1).fill("https://example.com");

  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Settings updated.")).toBeVisible();

  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Site" });
  const links = nav.getByRole("link");
  await expect(links).toHaveCount(2);
  await expect(links.nth(0)).toHaveText("About");
  await expect(links.nth(1)).toHaveText("Docs");
  await expect(links.nth(0)).toHaveAttribute("href", "/about-us");
  await expect(links.nth(1)).toHaveAttribute("href", "https://example.com");

  // Reorder ("Docs" up, ahead of "About") and remove "About", then save again.
  await page.goto("/admin/settings");
  await page
    .getByRole("button", { name: /Move.*up/ })
    .nth(1)
    .click();
  await expect(page.getByLabel("Label").nth(0)).toHaveValue("Docs");
  await page
    .getByRole("button", { name: /^Remove/ })
    .nth(1)
    .click();
  await expect(page.getByLabel("Label")).toHaveCount(1);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Settings updated.")).toBeVisible();

  await page.goto("/");
  const linksAfter = page.getByRole("navigation", { name: "Site" }).getByRole("link");
  await expect(linksAfter).toHaveCount(1);
  await expect(linksAfter.nth(0)).toHaveText("Docs");
});

test("an empty menu renders no navigation landmark", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Site" })).toHaveCount(0);
});

test("unpublishing a linked page drops it from the header with no error", async ({ page }) => {
  await logIn(page, admin);
  await page.goto("/admin/settings");
  await page.getByRole("button", { name: "Add item" }).click();
  await page.getByLabel("Label").fill("About");
  await page.getByLabel("Existing page").selectOption({ label: "About Us" });
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Settings updated.")).toBeVisible();

  await page.goto("/");
  await expect(
    page.getByRole("navigation", { name: "Site" }).getByRole("link", { name: "About" }),
  ).toBeVisible();

  await page.goto("/admin/pages");
  await page.getByRole("link", { name: "About Us", exact: true }).click();
  await page.waitForURL(/\/admin\/pages\/[0-9a-f-]+$/);
  await page.getByRole("button", { name: "Unpublish" }).click();
  await page.waitForURL(/unpublished=/);

  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("navigation", { name: "Site" })).toHaveCount(0);
});

test("a menu row whose page was deleted says so beside its select (F-95)", async ({ page }) => {
  const goneId = await createDraftFor(admin.email, "Soon Gone", textDocument(), {
    status: "published",
    type: "page",
  });
  const items = [{ label: "Gone", pageId: goneId }];
  await withDatabase(async (sql) => {
    await sql`update site_settings set navigation = ${sql.json(items)} where id = 1`;
    await sql`delete from entries where id = ${goneId}`;
  });

  await logIn(page, admin);
  await page.goto("/admin/settings");
  await expect(
    page.getByText("This page no longer exists - choose another page or remove this item."),
  ).toBeVisible();
});
