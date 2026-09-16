import { randomInt } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import {
  createAdmin,
  deleteEntriesBy,
  deleteTestUser,
  entriesBy,
  PASSWORD,
  setRole,
  type TestUser,
} from "./helpers/users.ts";

let author: TestUser;

test.beforeEach(async ({ page }) => {
  // Failed logins are rate-limited per IP; a fresh address per test keeps one
  // test's failures out of another's budget.
  await page.setExtraHTTPHeaders({ "X-Forwarded-For": `10.${randomInt(256)}.${randomInt(256)}.1` });
  author = createAdmin("Post Author");
  await setRole(author.email, "author");
});

test.afterEach(async () => {
  await deleteEntriesBy(author.email);
  await deleteTestUser(author.email);
});

async function logIn(page: Page, user: TestUser) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL("**/admin");
}

async function writeBody(page: Page, text: string) {
  // Editor.js owns a contenteditable canvas rather than a form field.
  const canvas = page.locator("[contenteditable=true]").first();
  await canvas.waitFor();
  await canvas.click();
  await page.keyboard.type(text);
}

test("a draft is written, saved, and still there after a reload", async ({ page }) => {
  await logIn(page, author);
  await page.goto("/admin/posts/new");

  await page.getByRole("textbox", { name: "Title" }).fill("My first post");
  await writeBody(page, "Hello from the editor.");
  await page.getByRole("button", { name: "Save draft" }).click();

  // The first save chooses the address and moves to the post's own URL.
  await page.waitForURL(/\/admin\/posts\/[0-9a-f-]{36}$/);
  await expect(page.getByText("/posts/my-first-post")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("textbox", { name: "Title" })).toHaveValue("My first post");
  await expect(page.getByText("Hello from the editor.")).toBeVisible();
});

test("a post with no title is refused, and nothing is written", async ({ page }) => {
  await logIn(page, author);
  await page.goto("/admin/posts/new");

  await writeBody(page, "Body without a title.");
  await page.getByRole("button", { name: "Save draft" }).click();

  await expect(page.getByText("Give your post a title before saving.")).toBeVisible();
  expect(page.url()).toContain("/admin/posts/new");
  expect((await entriesBy(author.email)).count).toBe(0);
});

test("an author cannot open someone else's post, and an editor can", async ({ page, browser }) => {
  const other = createAdmin("Other Author");
  await setRole(other.email, "author");
  try {
    // The other author writes a post.
    const otherContext = await browser.newContext();
    const otherPage = await otherContext.newPage();
    await logIn(otherPage, { ...other, password: PASSWORD });
    await otherPage.goto("/admin/posts/new");
    await otherPage.getByRole("textbox", { name: "Title" }).fill("Someone else's post");
    await writeBody(otherPage, "Private draft.");
    await otherPage.getByRole("button", { name: "Save draft" }).click();
    await otherPage.waitForURL(/\/admin\/posts\/[0-9a-f-]{36}$/);
    const postUrl = otherPage.url();
    await otherContext.close();

    // The author sees a 404, not a hint that the post exists.
    await logIn(page, author);
    const asAuthor = await page.goto(postUrl);
    expect(asAuthor?.status()).toBe(404);

    // An editor sees every post (plan section 6, Permissions).
    await setRole(author.email, "editor");
    const asEditor = await page.goto(postUrl);
    expect(asEditor?.status()).toBe(200);
    await expect(page.getByRole("textbox", { name: "Title" })).toHaveValue("Someone else's post");
  } finally {
    await deleteEntriesBy(other.email);
    await deleteTestUser(other.email);
  }
});

test("a save from a stale version is refused, and the writer keeps their text", async ({
  page,
  browser,
}) => {
  await logIn(page, author);
  await page.goto("/admin/posts/new");
  await page.getByRole("textbox", { name: "Title" }).fill("Shared draft");
  await writeBody(page, "First version.");
  await page.getByRole("button", { name: "Save draft" }).click();
  await page.waitForURL(/\/admin\/posts\/[0-9a-f-]{36}$/);
  const postUrl = page.url();

  // A second tab loads the same version, then the first saves.
  const secondContext = await browser.newContext();
  const secondPage = await secondContext.newPage();
  await logIn(secondPage, author);
  await secondPage.goto(postUrl);
  await secondPage.getByRole("textbox", { name: "Title" }).fill("Saved by the other tab");

  await page.getByRole("textbox", { name: "Title" }).fill("Saved first");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();

  // The second tab is still on the version it loaded, so its save is refused.
  await secondPage.getByRole("button", { name: "Save draft" }).click();
  await expect(secondPage.getByText("Your changes were not saved.")).toBeVisible();
  await expect(secondPage.getByRole("textbox", { name: "Title" })).toHaveValue(
    "Saved by the other tab",
  );

  const stored = await entriesBy(author.email);
  expect(stored.newestTitle).toBe("Saved first");
  // Created at 1, one successful save since: the refused one changed nothing.
  expect(stored.newestVersion).toBe(2);
  await secondContext.close();
});

test("a mistyped post address is not found, rather than an error", async ({ page }) => {
  await logIn(page, author);
  // Not a uuid: it can never match a row, and reaching the database with it
  // used to raise invalid input syntax and answer 500 (F-28).
  const response = await page.goto("/admin/posts/not-a-uuid");
  expect(response?.status()).toBe(404);
  await expect(page.getByText("An unexpected error occurred")).toBeHidden();
});

test("without JavaScript the page says so instead of showing an empty canvas", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.setExtraHTTPHeaders({ "X-Forwarded-For": `10.${randomInt(256)}.1.1` });
  // Logging in works without JavaScript - it is a plain form.
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(author.email);
  await page.getByLabel("Password").fill(author.password);
  await page.getByRole("button", { name: "Log in" }).click();

  await page.goto("/admin/posts/new");
  await expect(page.getByText("The editor needs JavaScript")).toBeVisible();
  await context.close();
});
