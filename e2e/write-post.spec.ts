import { randomInt } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import {
  createAdmin,
  createDraftFor,
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

test("a heading and a list survive being loaded into the editor and saved again", async ({
  page,
}) => {
  // Seeded rather than typed through the + menu: this proves the round trip
  // through the real Editor.js tools in both directions, which is where F-32
  // lived (every list item came back as "[object Object]"). Driving the
  // floating menu proved too flaky to be worth what it adds.
  const id = await createDraftFor(author.email, "Every block type", [
    { id: "p1", type: "text", data: { text: "An opening paragraph." } },
    { id: "h1", type: "heading", data: { text: "A section heading", level: 2 } },
    { id: "l1", type: "list", data: { style: "bullet", items: ["first item", "second item"] } },
  ]);

  await logIn(page, author);
  await page.goto(`/admin/posts/${id}`);
  await page.locator("[contenteditable=true]").first().waitFor();

  // Loaded: the tools render what was stored.
  await expect(page.getByText("A section heading")).toBeVisible();
  await expect(page.getByText("first item")).toBeVisible();
  await expect(page.getByText("[object Object]")).toBeHidden();

  // Saved back: what the tools hand over is stored as text, not as objects.
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("An opening paragraph.")).toBeVisible();
  await expect(page.getByText("A section heading")).toBeVisible();
  await expect(page.getByText("first item")).toBeVisible();
  await expect(page.getByText("second item")).toBeVisible();
  await expect(page.getByText("[object Object]")).toBeHidden();
});

test("the block menu lists only the types this version can store", async ({ page }) => {
  await logIn(page, author);
  await page.goto("/admin/posts/new");
  await page.locator("[contenteditable=true]").first().click();
  // Editor.js keeps the menu in the DOM whether or not it is open, so this
  // asserts what the menu contains, not that opening it works - the list tool
  // otherwise registers three entries, including a Checklist whose ticks v1
  // cannot store (F-35).
  await page.locator(".ce-popover-item__title").first().waitFor({ state: "attached" });
  expect(await page.locator(".ce-popover-item__title").allInnerTexts()).toEqual([
    "Text",
    "Heading",
    "List",
  ]);
});

test("markup a writer types stays text and never runs", async ({ page }) => {
  await logIn(page, author);
  await page.goto("/admin/posts/new");
  await page.getByRole("textbox", { name: "Title" }).fill("Markup as text");
  await writeBody(page, "use <img src=x onerror=\"document.title='XSS-FIRED'\"> here");
  await page.getByRole("button", { name: "Save draft" }).click();
  await page.waitForURL(/\/admin\/posts\/[0-9a-f-]{36}$/);
  await page.reload();
  await page.locator("[contenteditable=true]").first().waitFor();

  // Editor.js renders with innerHTML, so unescaped text becomes an element and
  // executes (F-33).
  expect(await page.title()).not.toBe("XSS-FIRED");
  expect(await page.locator(".codex-editor img").count()).toBe(0);
  await expect(page.getByText("use <img", { exact: false })).toBeVisible();
});

test("a body cannot be wiped by saving without JavaScript", async ({ browser, page }) => {
  await logIn(page, author);
  await page.goto("/admin/posts/new");
  await page.getByRole("textbox", { name: "Title" }).fill("Keeps its body");
  await writeBody(page, "Text that must survive.");
  await page.getByRole("button", { name: "Save draft" }).click();
  await page.waitForURL(/\/admin\/posts\/[0-9a-f-]{36}$/);
  const postUrl = page.url();

  const context = await browser.newContext({ javaScriptEnabled: false });
  const noJs = await context.newPage();
  await noJs.setExtraHTTPHeaders({ "X-Forwarded-For": `10.${randomInt(256)}.2.2` });
  await noJs.goto("/admin/login");
  await noJs.getByLabel("Email").fill(author.email);
  await noJs.getByLabel("Password").fill(author.password);
  await noJs.getByRole("button", { name: "Log in" }).click();
  await noJs.goto(postUrl);

  await expect(noJs.getByText("The editor needs JavaScript")).toBeVisible();
  await expect(noJs.getByRole("button", { name: "Save draft" })).toBeHidden();

  // Hiding the button is not enough: with one text field and no submit button,
  // Enter in the title submits the form natively, carrying no blocks - which
  // read as an empty post and wiped the body (F-34, re-opened after the first
  // repair only removed the button).
  await noJs.getByRole("textbox", { name: "Title" }).click();
  await noJs.keyboard.press("Enter");
  await noJs.waitForLoadState();
  await expect(noJs.getByText("The editor had not finished loading")).toBeVisible();
  await context.close();

  await page.reload();
  await expect(page.getByText("Text that must survive.")).toBeVisible();
});

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
