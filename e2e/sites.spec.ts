import { randomInt } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import { createSite, createSiteAdmin, deleteSite } from "./helpers/sites.ts";
import {
  createAdmin,
  deactivateUser,
  deleteTestUser,
  removeMembership,
  type TestUser,
} from "./helpers/users.ts";

test.beforeEach(async ({ page }) => {
  // Failed logins are rate-limited per IP; see auth.spec.ts.
  const ip = `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`;
  await page.setExtraHTTPHeaders({ "X-Forwarded-For": ip });
});

async function logIn(page: Page, user: TestUser) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Log in" }).click();
}

test.describe("a person signs in only through an active membership", () => {
  let user: TestUser;

  test.beforeEach(() => {
    user = createAdmin("Amara Okafor");
  });

  test.afterEach(async () => {
    await deleteTestUser(user.email);
  });

  test("a user whose membership is removed cannot log in", async ({ page }) => {
    await removeMembership(user.email);
    await logIn(page, user);

    await expect(page.getByRole("alert")).toContainText("That email and password don’t match.");
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("a user whose membership is removed loses an open session", async ({ page }) => {
    await logIn(page, user);
    await expect(page).toHaveURL("/admin/posts");

    await removeMembership(user.email);
    await page.reload();

    await expect(page).toHaveURL("/admin/login?redirectTo=%2Fadmin%2Fposts");
  });

  test("a user deactivated through site_members cannot log in", async ({ page }) => {
    await deactivateUser(user.email);
    await logIn(page, user);

    await expect(page.getByRole("alert")).toContainText("That email and password don’t match.");
  });

  test("a user deactivated through site_members loses an open session", async ({ page }) => {
    await logIn(page, user);
    await expect(page).toHaveURL("/admin/posts");

    await deactivateUser(user.email);
    await page.reload();

    await expect(page).toHaveURL("/admin/login?redirectTo=%2Fadmin%2Fposts");
  });
});

test("an admin of a second site can log in and reach the admin", async ({ page }) => {
  const siteId = await createSite("second");
  try {
    const admin = await createSiteAdmin(siteId);
    await logIn(page, admin);

    await expect(page).toHaveURL("/admin/posts");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Posts");
  } finally {
    await deleteSite(siteId);
  }
});
