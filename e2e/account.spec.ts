import { randomInt } from "node:crypto";
import { expect, test } from "@playwright/test";
import { logIn } from "./helpers/auth.ts";
import { createAdmin, deleteTestUser, setRole } from "./helpers/users.ts";

test.beforeEach(async ({ page }) => {
  // Failed logins are rate-limited per IP; see auth.spec.ts.
  const ip = `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`;
  await page.setExtraHTTPHeaders({ "X-Forwarded-For": ip });
});

test("an author changes their name from the shell link", async ({ page }) => {
  const user = createAdmin("Before Name");
  await setRole(user.email, "author");
  try {
    await logIn(page, user);
    await page.getByRole("link", { name: "Your account" }).click();
    await expect(page).toHaveURL("/admin/account");
    await expect(page.getByRole("heading", { level: 1, name: "Your account" })).toBeVisible();

    await page.getByLabel("Name").fill("After Name");
    await page.getByRole("button", { name: "Save name" }).click();

    await expect(page).toHaveURL("/admin/account?saved=name");
    await expect(page.getByRole("status")).toContainText("Your name is saved.");
    await expect(page.getByRole("complementary").getByText("After Name")).toBeVisible();
  } finally {
    await deleteTestUser(user.email);
  }
});

test("a blank name is refused below the field and what was typed is kept", async ({ page }) => {
  const user = createAdmin("Keep Name");
  await setRole(user.email, "author");
  try {
    await logIn(page, user);
    await page.goto("/admin/account");
    await page.getByLabel("Name").fill("   ");
    await page.getByRole("button", { name: "Save name" }).click();

    const field = page.getByLabel("Name");
    await expect(page.getByText("Enter a name.")).toBeVisible();
    await expect(field).toHaveAttribute("aria-invalid", "true");
    await expect(field).toHaveValue("   ");
  } finally {
    await deleteTestUser(user.email);
  }
});

test("signed out, Your account leads to sign-in and back", async ({ page }) => {
  const user = createAdmin("Round Trip");
  try {
    await page.goto("/admin/account");
    await expect(page).toHaveURL("/admin/login?redirectTo=%2Fadmin%2Faccount");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL("/admin/account");
    await expect(page.getByRole("heading", { level: 1, name: "Your account" })).toBeVisible();
  } finally {
    await deleteTestUser(user.email);
  }
});
