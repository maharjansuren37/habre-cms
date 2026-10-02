import { randomInt } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import {
  createAdmin,
  deactivateUser,
  deleteTestUser,
  revokeSessions,
  type TestUser,
} from "./helpers/users.ts";

let user: TestUser;
// Failed logins are rate-limited per IP, and without a proxy every request
// would share one address. Each test gets its own random address, so failures
// in one test never count towards another test's limit.
let testIp: string;

test.beforeEach(async ({ page }) => {
  testIp = `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`;
  await page.setExtraHTTPHeaders({ "X-Forwarded-For": testIp });
  user = createAdmin("Amara Okafor");
});

test.afterEach(async () => {
  await deleteTestUser(user.email);
});

async function logIn(page: Page, email = user.email, password = user.password) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
}

test("logging in from a protected page returns to that page", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL("/admin/login?redirectTo=%2Fadmin");

  await logIn(page);

  // /admin itself redirects to the posts list (item 3) - the same admin area
  // the protected page asked for.
  await expect(page).toHaveURL("/admin/posts");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Posts");
});

test("a wrong password is refused without saying which part was wrong", async ({ page }) => {
  await page.goto("/admin/login");
  await logIn(page, user.email, "not the right password");

  await expect(page.getByRole("alert")).toHaveText(
    "That email and password don’t match.Check them and try again.",
  );
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("an unknown email is refused with the same message", async ({ page }) => {
  await page.goto("/admin/login");
  await logIn(page, `nobody-${randomInt(1e9)}@example.test`, user.password);

  await expect(page.getByRole("alert")).toHaveText(
    "That email and password don’t match.Check them and try again.",
  );
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("five failed logins lock the email, even for the right password", async ({ page }) => {
  await page.goto("/admin/login");
  for (let attempt = 1; attempt <= 5; attempt++) {
    // Wait for each answer, so the attempts are sequential like a person's.
    const answered = page.waitForResponse((response) => response.request().method() === "POST");
    await logIn(page, user.email, "not the right password");
    expect((await answered).status()).toBe(400);
  }

  await logIn(page);

  await expect(page.getByRole("alert")).toHaveText(
    "Too many attempts.Wait 15 minutes, then try again.",
  );
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("a logged-in visitor to the login page is sent to the admin", async ({ page }) => {
  await page.goto("/admin/login");
  await logIn(page);
  await expect(page).toHaveURL("/admin/posts");

  await page.goto("/admin/login");

  await expect(page).toHaveURL("/admin/posts");
});

test("a cross-site POST is refused before reaching the action", async ({ request }) => {
  const response = await request.post("/admin/logout", {
    headers: { Origin: "https://evil.example", "X-Forwarded-For": testIp },
    maxRedirects: 0,
  });

  expect(response.status()).toBe(403);
});

test("an oversized login request is refused before its body is read", async ({
  request,
  baseURL,
}) => {
  const response = await request.post("/admin/login", {
    headers: { Origin: baseURL ?? "", "X-Forwarded-For": testIp },
    form: { email: user.email, password: "x".repeat(9000) },
    maxRedirects: 0,
  });

  expect(response.status()).toBe(413);
});

test("a deactivated user is refused with the same message", async ({ page }) => {
  await deactivateUser(user.email);
  await page.goto("/admin/login");
  await logIn(page);

  await expect(page.getByRole("alert")).toContainText("That email and password don’t match.");
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("revoking a user's sessions sends them to login on their next request", async ({ page }) => {
  await page.goto("/admin/login");
  await logIn(page);
  await expect(page).toHaveURL("/admin/posts");

  await revokeSessions(user.email);
  await page.reload();

  await expect(page).toHaveURL("/admin/login?redirectTo=%2Fadmin%2Fposts");
});

test("a session ending during a client-side navigation returns to that page after login", async ({
  page,
}) => {
  await page.goto("/admin/login");
  await logIn(page);
  await expect(page).toHaveURL("/admin/posts");

  await revokeSessions(user.email);
  // A nav link, not page.goto: the browser fetches /admin/pages.data, and the
  // page to come back to must be recorded without that suffix.
  await page.getByRole("link", { name: "Pages" }).click();
  await expect(page).toHaveURL("/admin/login?redirectTo=%2Fadmin%2Fpages");

  await logIn(page);
  await expect(page).toHaveURL("/admin/pages");
});

test("logging out ends the session, including any copy of its cookie", async ({
  page,
  context,
}) => {
  await page.goto("/admin/login");
  await logIn(page);
  await expect(page).toHaveURL("/admin/posts");
  const sessionCookies = await context.cookies();

  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL("/admin/login");
  await page.goto("/admin");
  await expect(page).toHaveURL("/admin/login?redirectTo=%2Fadmin");

  // The cookie from before logging out, as if it had been copied elsewhere.
  await context.addCookies(sessionCookies);
  await page.goto("/admin");
  await expect(page).toHaveURL("/admin/login?redirectTo=%2Fadmin");
});

test("a client-side navigation to New post after the session is gone goes to login", async ({
  page,
}) => {
  await page.goto("/admin/login");
  await logIn(page);
  await expect(page).toHaveURL("/admin/posts");

  await page.context().clearCookies();
  await page.getByRole("link", { name: "New post" }).first().click();

  await expect(page).toHaveURL(/\/admin\/login/);
});

test("a client-side navigation to New page after the session is gone goes to login", async ({
  page,
}) => {
  await page.goto("/admin/login");
  await logIn(page);
  await expect(page).toHaveURL("/admin/posts");
  await page.goto("/admin/pages");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Pages");

  await page.context().clearCookies();
  await page.getByRole("link", { name: "New page" }).first().click();

  await expect(page).toHaveURL(/\/admin\/login/);
});
