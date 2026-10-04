import { randomInt } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
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

const NEW_PASSWORD = "a brand new passphrase";

function randomIp(): string {
  return `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`;
}

async function savePassword(page: Page, current: string, next: string): Promise<void> {
  await page.getByLabel("Current password").fill(current);
  await page.getByLabel("New password").fill(next);
  // Waits for the answer: a repeated attempt shows the same message as the one
  // before it, so asserting on the page alone could pass on the stale one.
  const answered = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" && response.url().includes("/admin/account"),
  );
  await page.getByRole("button", { name: "Save password" }).click();
  await answered;
}

test("changing the password keeps this browser in and signs the other one out", async ({
  browser,
}) => {
  const user = createAdmin("Two Browsers");
  const contexts = [
    await browser.newContext({ extraHTTPHeaders: { "X-Forwarded-For": randomIp() } }),
    await browser.newContext({ extraHTTPHeaders: { "X-Forwarded-For": randomIp() } }),
  ];
  try {
    const [first, second] = await Promise.all(contexts.map((context) => context.newPage()));
    await logIn(first, user);
    await logIn(second, user);

    await first.goto("/admin/account");
    await savePassword(first, user.password, NEW_PASSWORD);
    await expect(first).toHaveURL("/admin/account?saved=password");
    await expect(first.getByRole("status")).toContainText("Your password is saved.");
    await first.reload();
    await expect(first).toHaveURL(/\/admin\/account/);
    await expect(first.getByRole("heading", { level: 1, name: "Your account" })).toBeVisible();

    await second.goto("/admin/account");
    await expect(second).toHaveURL(/\/admin\/login/);

    const fresh = await browser.newContext({
      extraHTTPHeaders: { "X-Forwarded-For": randomIp() },
    });
    contexts.push(fresh);
    const page = await fresh.newPage();
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/admin\/login/);
    await page.getByLabel("Password").fill(NEW_PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL("/admin/posts");
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
    await deleteTestUser(user.email);
  }
});

test("a wrong current password is refused below its field and changes nothing", async ({
  page,
  browser,
}) => {
  const user = createAdmin("Wrong Current");
  try {
    await logIn(page, user);
    await page.goto("/admin/account");
    await savePassword(page, "not the password", NEW_PASSWORD);

    const field = page.getByLabel("Current password");
    await expect(page.getByText("That's not your current password.")).toBeVisible();
    await expect(field).toHaveAttribute("aria-invalid", "true");

    const fresh = await browser.newContext({
      extraHTTPHeaders: { "X-Forwarded-For": randomIp() },
    });
    try {
      await logIn(await fresh.newPage(), user);
    } finally {
      await fresh.close();
    }
  } finally {
    await deleteTestUser(user.email);
  }
});

test("five wrong current passwords lock the check, even for the right one", async ({
  page,
  browser,
}) => {
  const user = createAdmin("Lock Out");
  const otherContext = await browser.newContext({
    extraHTTPHeaders: { "X-Forwarded-For": randomIp() },
  });
  try {
    await logIn(page, user);
    const other = await otherContext.newPage();
    await logIn(other, user);
    await page.goto("/admin/account");
    for (let attempt = 0; attempt < 5; attempt++) {
      await savePassword(page, "not the password", NEW_PASSWORD);
      await expect(page.getByText("That's not your current password.")).toBeVisible();
    }
    await savePassword(page, "not the password", NEW_PASSWORD);
    await expect(page.getByText("Too many attempts. Try again in 15 minutes.")).toBeVisible();

    await savePassword(page, user.password, NEW_PASSWORD);
    await expect(page.getByText("Too many attempts. Try again in 15 minutes.")).toBeVisible();
    await expect(page).not.toHaveURL(/saved=password/);

    // Nothing changed: the other browser's session still holds, which a
    // password change (it bumps token_version) would have ended.
    await other.goto("/admin/account");
    await expect(other).toHaveURL("/admin/account");
  } finally {
    await otherContext.close();
    await deleteTestUser(user.email);
  }
});
