import { randomInt } from "node:crypto";
import { type Browser, expect, type Page, test } from "@playwright/test";
import { logIn } from "./helpers/auth.ts";
import { textDocument } from "./helpers/documents.ts";
import { createSite, createSiteAdmin, deleteSite } from "./helpers/sites.ts";
import { setRole, type TestUser, withDatabase } from "./helpers/users.ts";

// Every test makes its own site and users, never site 1 (no test deletes or
// reshapes the oldest site, which the public-site specs read).
let siteId: string;
let subdomain: string;
let admin: TestUser;
let otherAdmin: TestUser;
let author: TestUser;
let postTitle: string;

function randomIp(): string {
  return `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`;
}

test.beforeEach(async ({ page }) => {
  // Failed logins are rate-limited per IP; see auth.spec.ts.
  await page.setExtraHTTPHeaders({ "X-Forwarded-For": randomIp() });
});

test.afterEach(async () => {
  // deleteSite also clears whoever the test left behind.
  if (siteId) await deleteSite(siteId);
  siteId = "";
});

/** A site with two active admins and an author who has a published post. */
async function makeSite(): Promise<void> {
  siteId = await createSite("leave");
  subdomain = await withDatabase(async (sql) => {
    const [row] = await sql<
      { subdomain: string }[]
    >`select subdomain from sites where id = ${siteId}`;
    return row.subdomain;
  });
  admin = await createSiteAdmin(siteId, "First Admin");
  otherAdmin = await createSiteAdmin(siteId, "Second Admin");
  author = await createSiteAdmin(siteId, "Leaving Author");
  await setRole(author.email, "author");
  postTitle = `Leaving Post ${randomInt(1_000_000)}`;
  await withDatabase(async (sql) => {
    await sql`
      insert into entries (site_id, type, title, slug, blocks, blocks_format, status, published_at, author_id)
      select ${siteId}, 'post', ${postTitle}, ${postTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-")},
             ${sql.json(textDocument("Body") as never)}, 'v4', 'published', now(), id
      from users where email = ${author.email}
    `;
  });
}

async function userExists(email: string): Promise<boolean> {
  return withDatabase(async (sql) => {
    const rows = await sql`select 1 from users where email = ${email}`;
    return rows.length > 0;
  });
}

/** Submits the form and waits for the server's answer, so a repeated message is never a stale one. */
async function submitDelete(page: Page, password: string): Promise<void> {
  await page.getByLabel("Current password").fill(password);
  const answered = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" && response.url().includes("/admin/account/delete"),
  );
  await page.getByRole("button", { name: "Delete my account" }).click();
  await answered;
}

/** Signs in on a fresh browser and waits for the outcome, never reading the URL early (F-252). */
async function signInOutcome(
  browser: Browser,
  email: string,
  password: string,
): Promise<"signed in" | "refused"> {
  const context = await browser.newContext({ extraHTTPHeaders: { "X-Forwarded-For": randomIp() } });
  try {
    const page = await context.newPage();
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Log in" }).click();
    const refusal = page.getByText("That email and password don’t match.");
    return await Promise.race([
      page.waitForURL("**/admin/posts").then(() => "signed in" as const),
      refusal.waitFor().then(() => "refused" as const),
    ]);
  } finally {
    await context.close();
  }
}

test("an author leaves from Your account: wrong password refused, right one signs out", async ({
  page,
  browser,
}) => {
  await makeSite();
  await logIn(page, author);
  await page.goto("/admin/account");
  await expect(page.getByRole("heading", { level: 2, name: "Delete account" })).toBeVisible();
  await page.getByRole("link", { name: "Delete your account" }).click();
  await expect(page).toHaveURL("/admin/account/delete");
  await expect(page.getByRole("heading", { level: 1, name: "Delete your account" })).toBeVisible();
  await expect(page.getByText("You'll be signed out and can't sign in again.")).toBeVisible();
  await expect(page.getByText(subdomain, { exact: false }).first()).toBeVisible();
  await expect(page.getByText("credited to Deleted account")).toBeVisible();

  await submitDelete(page, "not the password");
  const field = page.getByLabel("Current password");
  await expect(page.getByText("That's not your current password.")).toBeVisible();
  await expect(field).toHaveAttribute("aria-invalid", "true");
  expect(await userExists(author.email)).toBe(true);

  await submitDelete(page, author.password);
  await expect(page).toHaveURL("/admin/login?deleted=1");
  await expect(page.getByRole("status")).toContainText("Your account is deleted.");
  expect(await userExists(author.email)).toBe(false);

  expect(await signInOutcome(browser, author.email, author.password)).toBe("refused");

  await logIn(page, admin);
  await page.goto("/admin/posts");
  const postRow = page
    .getByRole("row")
    .filter({ has: page.getByRole("link", { name: postTitle }) });
  await expect(postRow.getByText("Deleted account")).toBeVisible();
});

test("one of two admins leaves and the other still signs in and sees the site", async ({
  page,
  browser,
}) => {
  await makeSite();
  await logIn(page, admin);
  await page.goto("/admin/account/delete");
  await expect(page.getByRole("button", { name: "Delete my account" })).toBeVisible();
  await submitDelete(page, admin.password);
  await expect(page).toHaveURL("/admin/login?deleted=1");
  expect(await userExists(admin.email)).toBe(false);
  expect(await userExists(otherAdmin.email)).toBe(true);

  expect(await signInOutcome(browser, admin.email, admin.password)).toBe("refused");
  await logIn(page, otherAdmin);
  await page.goto("/admin/posts");
  await expect(page.getByRole("link", { name: postTitle, exact: true })).toBeVisible();
});

test("a second browser signed in as the person lands on sign-in at its next request", async ({
  page,
  browser,
}) => {
  await makeSite();
  const other = await browser.newContext({ extraHTTPHeaders: { "X-Forwarded-For": randomIp() } });
  try {
    const otherPage = await other.newPage();
    await logIn(otherPage, author);
    await logIn(page, author);
    await page.goto("/admin/account/delete");
    await submitDelete(page, author.password);
    await expect(page).toHaveURL("/admin/login?deleted=1");

    await otherPage.goto("/admin/posts");
    await expect(otherPage).toHaveURL(/\/admin\/login/);
  } finally {
    await other.close();
  }
});

test("five wrong passwords lock the check, and a sixth with the right one deletes nothing", async ({
  page,
}) => {
  await makeSite();
  await logIn(page, author);
  await page.goto("/admin/account/delete");
  for (let attempt = 0; attempt < 5; attempt++) {
    await submitDelete(page, "not the password");
    await expect(page.getByText("That's not your current password.")).toBeVisible();
  }
  await submitDelete(page, "not the password");
  await expect(page.getByText("Too many attempts. Try again in 15 minutes.")).toBeVisible();

  await submitDelete(page, author.password);
  await expect(page.getByText("Too many attempts. Try again in 15 minutes.")).toBeVisible();
  await expect(page).not.toHaveURL(/deleted=1/);
  expect(await userExists(author.email)).toBe(true);
});

test("signed out, the delete screen leads to sign-in and back", async ({ page }) => {
  await makeSite();
  await page.goto("/admin/account/delete");
  await expect(page).toHaveURL("/admin/login?redirectTo=%2Fadmin%2Faccount%2Fdelete");
  await page.getByLabel("Email").fill(author.email);
  await page.getByLabel("Password").fill(author.password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL("/admin/account/delete");
  await expect(page.getByRole("heading", { level: 1, name: "Delete your account" })).toBeVisible();
});

test("a site's only active admin sees the refusal, no form, and a built POST deletes nothing", async ({
  page,
}) => {
  siteId = await createSite("sole");
  admin = await createSiteAdmin(siteId, "Only Admin");
  await logIn(page, admin);
  await page.goto("/admin/account/delete");
  await expect(page.getByRole("heading", { level: 1, name: "Delete your account" })).toBeVisible();
  await expect(
    page.getByText(
      "This is the platform's main site, so it can't be deleted yet. Make another member an admin first, then delete your account.",
    ),
  ).toBeVisible();
  await expect(page.getByLabel("Current password")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Delete my account" })).toHaveCount(0);

  const origin = new URL(page.url()).origin;
  const response = await page.request.post("/admin/account/delete", {
    headers: { Origin: origin },
    form: { expect: "leave", currentPassword: admin.password },
  });
  expect(response.status()).toBe(409);
  expect(await userExists(admin.email)).toBe(true);
  await page.goto("/admin/posts");
  await expect(page).toHaveURL(/\/admin\/posts/);
});
