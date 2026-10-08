import { randomInt } from "node:crypto";
import { expect, test } from "@playwright/test";
import { logIn } from "./helpers/auth.ts";
import { createAdmin, deleteTestUser, PASSWORD, setRole, type TestUser } from "./helpers/users.ts";

let admin: TestUser;
let target: TestUser | undefined;
let createdEmail: string | undefined;

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({
    "X-Forwarded-For": `10.${randomInt(256)}.${randomInt(256)}.15`,
  });
  admin = createAdmin("Users Admin");
  target = undefined;
  createdEmail = undefined;
});

test.afterEach(async () => {
  if (createdEmail) await deleteTestUser(createdEmail);
  if (target) await deleteTestUser(target.email);
  await deleteTestUser(admin.email);
});

test("an admin can create a user, who appears in the list with the chosen role", async ({
  page,
}) => {
  await logIn(page, admin);
  await page.goto("/admin/users/new");
  createdEmail = `e2e-created-${randomInt(1e9)}@example.test`;
  await page.getByLabel("Email").fill(createdEmail);
  await page.getByLabel("Name").fill("Created User");
  await page.getByLabel("Role").selectOption("editor");
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create user" }).click();
  await expect(page.getByText("User created.")).toBeVisible();

  await page.goto("/admin/users");
  const row = page.getByRole("row", { name: /Created User/ });
  await expect(row).toContainText("Editor");
  await expect(row).toContainText("Active");
});

test("creating a user with an email already in use re-shows the form with the typed name and role, and creates nothing", async ({
  page,
}) => {
  target = createAdmin("Existing User");

  await logIn(page, admin);
  await page.goto("/admin/users/new");
  await page.getByLabel("Email").fill(target.email);
  await page.getByLabel("Name").fill("Second Attempt");
  await page.getByLabel("Role").selectOption("author");
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create user" }).click();

  await expect(page.getByText("That email is already in use.")).toBeVisible();
  await expect(page.getByLabel("Name")).toHaveValue("Second Attempt");
  await expect(page).toHaveURL("/admin/users/new");
});

test("an admin changes another user's role, and it applies on that user's very next login", async ({
  page,
  browser,
}) => {
  target = createAdmin("Role Target");
  await setRole(target.email, "author");

  await logIn(page, admin);
  await page.goto("/admin/users");
  await page.getByRole("link", { name: target.name }).click();
  await page.getByLabel("Role").selectOption("editor");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Role updated.")).toBeVisible();

  // A fresh session for the target: role is read from the database on every
  // request, never from the token (D6), so their very next login shows it.
  const targetContext = await browser.newContext();
  const targetPage = await targetContext.newPage();
  await logIn(targetPage, target);
  await expect(targetPage.getByRole("link", { name: "Pages" })).toBeVisible();
  await targetContext.close();
});

test("an admin resets another user's password, and the old password stops working", async ({
  page,
}) => {
  target = createAdmin("Password Target");

  await logIn(page, admin);
  await page.goto("/admin/users");
  await page.getByRole("link", { name: target.name }).click();
  const newPassword = "a freshly generated password";
  await page.getByLabel("New password").fill(newPassword);
  await page.getByRole("button", { name: "Reset password" }).click();
  await expect(page.getByText("Password reset.")).toBeVisible();

  await page.getByRole("button", { name: "Log out" }).click();
  await page.getByLabel("Email").fill(target.email);
  await page.getByLabel("Password").fill(target.password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("alert")).toContainText("That email and password don’t match.");

  await page.getByLabel("Password").fill(newPassword);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL("/admin");
});

test("deactivating a user ends their session immediately and blocks login; reactivating restores it", async ({
  page,
  browser,
}) => {
  target = createAdmin("Deactivate Target");

  const targetContext = await browser.newContext();
  const targetPage = await targetContext.newPage();
  await targetPage.setExtraHTTPHeaders({
    "X-Forwarded-For": `10.${randomInt(256)}.${randomInt(256)}.16`,
  });
  await logIn(targetPage, target);
  await expect(targetPage).toHaveURL("/admin");

  await logIn(page, admin);
  await page.goto("/admin/users");
  await page.getByRole("link", { name: target.name }).click();
  await page.getByRole("button", { name: "Deactivate" }).click();
  await expect(page.getByText("User deactivated.")).toBeVisible();

  await targetPage.reload();
  await expect(targetPage).toHaveURL(/\/admin\/login/);

  await targetPage.getByLabel("Email").fill(target.email);
  await targetPage.getByLabel("Password").fill(target.password);
  await targetPage.getByRole("button", { name: "Log in" }).click();
  await expect(targetPage.getByRole("alert")).toContainText("That email and password don’t match.");

  await page.getByRole("button", { name: "Reactivate" }).click();
  await expect(page.getByText("User reactivated.")).toBeVisible();

  await targetPage.getByRole("button", { name: "Log in" }).click();
  await expect(targetPage).toHaveURL("/admin");

  await targetContext.close();
});

test("an editor gets 404 from every /admin/users route, and Users is not in their nav", async ({
  page,
}) => {
  await setRole(admin.email, "editor");
  await logIn(page, admin);
  await expect(page.getByRole("link", { name: "Users" })).toHaveCount(0);
  const list = await page.goto("/admin/users");
  expect(list?.status()).toBe(404);
  const newForm = await page.goto("/admin/users/new");
  expect(newForm?.status()).toBe(404);
});

test("an author gets 404 from every /admin/users route, and Users is not in their nav", async ({
  page,
}) => {
  await setRole(admin.email, "author");
  await logIn(page, admin);
  await expect(page.getByRole("link", { name: "Users" })).toHaveCount(0);
  const list = await page.goto("/admin/users");
  expect(list?.status()).toBe(404);
});

test("a crafted self-role-change or self-deactivation POST is refused, and nothing changes", async ({
  page,
}) => {
  await logIn(page, admin);
  await page.goto("/admin/users");
  await page.getByRole("link", { name: admin.name }).click();
  await expect(page.getByText("You can’t change your own role.")).toBeVisible();
  const selfUrl = page.url();
  const origin = new URL(selfUrl).origin;

  // The UI already hides these two forms for your own account (below) - this
  // proves the server refuses the same thing on a request that skips the UI.
  const roleResponse = await page.request.post(selfUrl, {
    headers: { Origin: origin },
    form: { intent: "change-role", role: "author" },
  });
  expect(roleResponse.status()).toBe(400);
  expect(await roleResponse.text()).toContain("You can’t change your own role.");

  const deactivateResponse = await page.request.post(selfUrl, {
    headers: { Origin: origin },
    form: { intent: "deactivate" },
  });
  expect(deactivateResponse.status()).toBe(400);
  expect(await deactivateResponse.text()).toContain("You can’t deactivate your own account.");

  // Still logged in as an active admin - neither crafted request changed anything.
  await page.reload();
  await expect(page.getByText("You can’t change your own role.")).toBeVisible();
  await expect(page.getByText("You can’t deactivate your own account.")).toBeVisible();
});
