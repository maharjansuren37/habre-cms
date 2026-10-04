import { randomInt } from "node:crypto";
import { type Browser, expect, type Page, test } from "@playwright/test";
import { logIn } from "./helpers/auth.ts";
import { textDocument } from "./helpers/documents.ts";
import { messagesTo, waitForMail } from "./helpers/mail.ts";
import { insertTestMediaRow, uploadTestMedia } from "./helpers/media.ts";
import { HOST_SPLIT_PORT } from "./helpers/ports.ts";
import { createSite, createSiteAdmin, deleteSite } from "./helpers/sites.ts";
import { STORAGE_REASON, skipWithoutStorage } from "./helpers/storage.ts";
import { deactivateUser, setRole, type TestUser, withDatabase } from "./helpers/users.ts";

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

const CHANGED = "Something changed on your site. Check what will be deleted and try again.";

/** What of the site is left: rows in each table that names it, and its users by email. */
async function leftOfSite(emails: string[]): Promise<Record<string, number>> {
  return withDatabase(async (sql) => {
    const count = async (rows: PromiseLike<readonly unknown[]>) => (await rows).length;
    return {
      sites: await count(sql`select 1 from sites where id = ${siteId}`),
      settings: await count(sql`select 1 from site_settings where site_id = ${siteId}`),
      entries: await count(sql`select 1 from entries where site_id = ${siteId}`),
      media: await count(sql`select 1 from media where site_id = ${siteId}`),
      members: await count(sql`select 1 from site_members where site_id = ${siteId}`),
      users: await count(sql`select 1 from users where email in ${sql(emails)}`),
    };
  });
}

let deactivated: TestUser;
let editor: TestUser;

/** A site with one active admin, a deactivated admin, an editor, 2 posts, a home page and 2 images. */
async function makeSoleAdminSite(): Promise<void> {
  siteId = await createSite("takes");
  subdomain = await withDatabase(async (sql) => {
    const [row] = await sql<
      { subdomain: string }[]
    >`select subdomain from sites where id = ${siteId}`;
    return row.subdomain;
  });
  admin = await createSiteAdmin(siteId, "Only Admin");
  deactivated = await createSiteAdmin(siteId, "Deactivated Admin");
  await deactivateUser(deactivated.email);
  editor = await createSiteAdmin(siteId, "The Editor");
  await setRole(editor.email, "editor");
  await withDatabase(async (sql) => {
    const doc = sql.json(textDocument("Body") as never);
    for (const [type, slug] of [
      ["post", "first-post"],
      ["post", "second-post"],
      ["page", "home"],
    ] as const) {
      await sql`
        insert into entries (site_id, type, title, slug, blocks, blocks_format, status, published_at, author_id)
        select ${siteId}, ${type}, ${slug}, ${slug}, ${doc}, 'v4', 'published', now(), id
        from users where email = ${editor.email}
      `;
    }
    await sql`
      update site_settings set home_page_id = (select id from entries where site_id = ${siteId} and slug = 'home')
      where site_id = ${siteId}
    `;
  });
  await insertTestMediaRow({ uploadedBy: editor.email, siteId });
  await insertTestMediaRow({ uploadedBy: editor.email, siteId });
}

test("the last active admin sees what goes, and a wrong address deletes nothing", async ({
  page,
}) => {
  await makeSoleAdminSite();
  await logIn(page, admin);
  await page.goto("/admin/account");
  await page.getByRole("link", { name: "Delete your account" }).click();
  await expect(page).toHaveURL("/admin/account/delete");
  const summary = page.getByText("is deleted with your account:");
  await expect(summary).toContainText(subdomain);
  await expect(summary).toContainText("2 posts, 1 page, 2 images");
  await expect(summary).toContainText("the accounts of Deactivated Admin and The Editor");

  await page.getByLabel("Current password").fill(admin.password);
  const address = page.getByLabel(`Type ${subdomain} to confirm`);
  await address.fill("not-the-address");
  const answered = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" && response.url().includes("/admin/account/delete"),
  );
  await page.getByRole("button", { name: "Delete my account" }).click();
  await answered;
  await expect(page.getByText("That isn't your site's address.")).toBeVisible();
  await expect(address).toHaveAttribute("aria-invalid", "true");
  await expect(address).toHaveValue("not-the-address");
  const left = await leftOfSite([admin.email, deactivated.email, editor.email]);
  expect(left).toEqual({ sites: 1, settings: 1, entries: 3, media: 2, members: 3, users: 3 });
});

test("the right address and password delete the site, its members, and free its address", async ({
  page,
  browser,
}) => {
  await makeSoleAdminSite();
  await logIn(page, admin);
  await page.goto("/admin/account/delete");
  await page.getByLabel(`Type ${subdomain} to confirm`).fill(`  ${subdomain.toUpperCase()} `);
  await submitDelete(page, admin.password);
  await expect(page).toHaveURL("/admin/login?deleted=1");
  await expect(page.getByRole("status")).toContainText("Your account is deleted.");
  expect(await leftOfSite([admin.email, deactivated.email, editor.email])).toEqual({
    sites: 0,
    settings: 0,
    entries: 0,
    media: 0,
    members: 0,
    users: 0,
  });
  expect(await signInOutcome(browser, editor.email, editor.password)).toBe("refused");

  // The address can be taken again straight away.
  const reused = await withDatabase(async (sql) => {
    const [row] = await sql<{ id: string }[]>`
      insert into sites (subdomain) values (${subdomain}) returning id`;
    return row.id;
  });
  siteId = reused;
});

test("a page loaded as leaving is refused once the other admin is deactivated", async ({
  page,
}) => {
  await makeSite();
  await logIn(page, admin);
  await page.goto("/admin/account/delete");
  await expect(page.getByText("You'll be signed out and can't sign in again.")).toBeVisible();
  await deactivateUser(otherAdmin.email);
  await submitDelete(page, admin.password);
  await expect(page.getByText(CHANGED)).toBeVisible();
  expect(await userExists(admin.email)).toBe(true);
  const left = await leftOfSite([admin.email, otherAdmin.email, author.email]);
  expect(left).toMatchObject({ sites: 1, entries: 1, members: 3, users: 3 });
});

test("two admins of one site deleting at once leave exactly one of them deleted", async ({
  page,
  browser,
}) => {
  await makeSite();
  const second = await browser.newContext({ extraHTTPHeaders: { "X-Forwarded-For": randomIp() } });
  try {
    const secondPage = await second.newPage();
    await logIn(page, admin);
    await logIn(secondPage, otherAdmin);
    await page.goto("/admin/account/delete");
    await secondPage.goto("/admin/account/delete");
    await page.getByLabel("Current password").fill(admin.password);
    await secondPage.getByLabel("Current password").fill(otherAdmin.password);
    await Promise.all([
      page.getByRole("button", { name: "Delete my account" }).click(),
      secondPage.getByRole("button", { name: "Delete my account" }).click(),
    ]);
    await expect
      .poll(async () => (await userExists(admin.email)) !== (await userExists(otherAdmin.email)))
      .toBe(true);
    const left = await leftOfSite([admin.email, otherAdmin.email, author.email]);
    expect(left).toMatchObject({ sites: 1, entries: 1, members: 2, users: 2 });
  } finally {
    await second.close();
  }
});

test("the other members of a deleted site are emailed, the person who deleted it is not", async ({
  page,
}) => {
  await makeSoleAdminSite();
  await logIn(page, admin);
  await page.goto("/admin/account/delete");
  await page.getByLabel(`Type ${subdomain} to confirm`).fill(subdomain);
  await submitDelete(page, admin.password);
  await expect(page).toHaveURL("/admin/login?deleted=1");

  const [text] = await waitForMail(editor.email);
  expect(text).toContain(`Your site ${subdomain} was deleted by its admin.`);
  expect(text).toMatch(/^Hi The,/);
  expect(await messagesTo(admin.email)).toEqual([]);
});

test("with email off, deleting a site with a member sends nothing and still succeeds", async ({
  page,
}) => {
  const off = `http://localhost:${HOST_SPLIT_PORT}`;
  await makeSoleAdminSite();
  await page.goto(`${off}/admin/login`);
  await page.getByLabel("Email").fill(admin.email);
  await page.getByLabel("Password").fill(admin.password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL("**/admin/posts");
  await page.goto(`${off}/admin/account/delete`);
  await page.getByLabel(`Type ${subdomain} to confirm`).fill(subdomain);
  await submitDelete(page, admin.password);
  await expect(page).toHaveURL(`${off}/admin/login?deleted=1`);
  expect(await leftOfSite([admin.email, deactivated.email, editor.email])).toMatchObject({
    sites: 0,
    users: 0,
  });
  // A short pause, so a message that should not exist has time to arrive.
  await new Promise((resolve) => setTimeout(resolve, 500));
  expect(await messagesTo(editor.email)).toEqual([]);
});

test("a deleted site's image answers 404 at its public URL", async ({ page }) => {
  test.skip(skipWithoutStorage, STORAGE_REASON);
  await makeSoleAdminSite();
  await logIn(page, admin);
  const origin = new URL(page.url()).origin;
  const uploaded = await uploadTestMedia(page.request, origin, "1x1.png", "Soon gone");
  const key = await withDatabase(async (sql) => {
    const [row] = await sql<{ key: string }[]>`
      select storage_key as key from media where id = ${uploaded.id}`;
    return row.key;
  });
  expect(key.startsWith(`sites/${siteId}/`)).toBe(true);
  const url = `${process.env.R2_PUBLIC_URL}/${key}`;
  expect((await fetch(url)).status).toBe(200);

  await page.goto("/admin/account/delete");
  await page.getByLabel(`Type ${subdomain} to confirm`).fill(subdomain);
  await submitDelete(page, admin.password);
  await expect(page).toHaveURL("/admin/login?deleted=1");
  // The removal is not awaited by the response, so poll.
  await expect.poll(async () => (await fetch(url)).status, { timeout: 15_000 }).toBe(404);
});
