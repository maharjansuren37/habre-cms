import { randomInt } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import { logIn } from "./helpers/auth.ts";
import {
  createAdmin,
  createDraftFor as createDraftForFormat,
  deleteEntriesBy,
  deleteTestUser,
  setRole,
  storedEntry,
  type TestUser,
} from "./helpers/users.ts";

// Editor.js entries are v2/v3; the helper now defaults to v4 (removed in step 6).
const createDraftFor = (
  email: string,
  title: string,
  blocks: unknown,
  options: Parameters<typeof createDraftForFormat>[3] = {},
) => createDraftForFormat(email, title, blocks, { blocksFormat: "v2", ...options });

let author: TestUser;

test.beforeEach(async ({ page }) => {
  // A fresh address per test keeps one test's failed logins out of another's budget.
  await page.setExtraHTTPHeaders({ "X-Forwarded-For": `10.${randomInt(256)}.${randomInt(256)}.3` });
  author = createAdmin("Formatting Author");
  await setRole(author.email, "author");
});

test.afterEach(async () => {
  await deleteEntriesBy(author.email);
  await deleteTestUser(author.email);
});

/** Selects the last word of a block by keyboard, which opens the inline toolbar. */
async function selectLastWord(page: Page, block: string) {
  await page.locator(block).first().click();
  await page.keyboard.press("End");
  await page.keyboard.press("Shift+Control+ArrowLeft");
}

/**
 * Saves and waits for the server's answer. "Saved" is already on screen when a
 * saved draft opens, so waiting for that text would read the database too soon.
 */
async function save(page: Page) {
  const answered = page.waitForResponse((response) => response.request().method() === "POST");
  await page.getByRole("button", { name: "Save draft" }).click();
  await answered;
}

test("formatting stored as runs loads into the editor and saves back unchanged", async ({
  page,
}) => {
  // Seeded rather than made through the toolbar: this proves the round trip
  // through the real Editor.js tools in both directions (status gotcha: the
  // floating menus are not worth driving).
  const blocks = [
    {
      id: "p1",
      type: "text",
      data: {
        text: [
          { text: "Some " },
          { text: "bold", bold: true },
          { text: " and " },
          { text: "italic", italic: true },
          { text: " with " },
          { text: "a link", href: "https://example.com/" },
        ],
      },
    },
    {
      id: "l1",
      type: "list",
      data: {
        style: "bullet",
        items: [[{ text: "strong item", bold: true }], [{ text: "plain" }]],
      },
    },
  ];
  const id = await createDraftFor(author.email, "Formatted post", blocks);

  await logIn(page, author);
  await page.goto(`/admin/posts/${id}`);
  const paragraph = page.locator(".ce-paragraph").first();
  await expect(paragraph.locator("b")).toHaveText("bold");
  await expect(paragraph.locator("i")).toHaveText("italic");
  await expect(paragraph.locator("a")).toHaveAttribute("href", "https://example.com/");
  await expect(page.locator(".cdx-list b")).toHaveText("strong item");

  await save(page);
  const stored = await storedEntry(id);
  expect(stored.version).toBe(2);
  expect(stored.blocks).toEqual(blocks);
});

test("making a word bold with the keyboard stores a bold run", async ({ page }) => {
  const id = await createDraftFor(author.email, "Keyboard bold", [
    { id: "p1", type: "text", data: { text: [{ text: "Make this bold" }] } },
  ]);
  await logIn(page, author);
  await page.goto(`/admin/posts/${id}`);

  await selectLastWord(page, ".ce-paragraph");
  await page.keyboard.press("Control+b");
  await save(page);

  expect((await storedEntry(id)).blocks).toEqual([
    {
      id: "p1",
      type: "text",
      data: { text: [{ text: "Make this " }, { text: "bold", bold: true }] },
    },
  ]);
});

test("a heading offers italic and link but not bold, and italic saves", async ({ page }) => {
  // Headings are already bold, so Editor.js's Bold un-bolds them with a <span>
  // no save can keep - the writer's change vanished on reload (F-43).
  const id = await createDraftFor(author.email, "Heading marks", [
    { id: "h1", type: "heading", data: { text: [{ text: "A section heading" }], level: 2 } },
  ]);
  await logIn(page, author);
  await page.goto(`/admin/posts/${id}`);

  await selectLastWord(page, ".ce-header");
  const toolbar = page.locator(".ce-inline-toolbar");
  await expect(toolbar.locator(".ce-inline-tool--italic")).toBeVisible();
  await expect(toolbar.locator(".ce-inline-tool--link")).toBeVisible();
  await expect(toolbar.locator("[data-item-name='bold']")).toHaveCount(0);

  await page.keyboard.press("Control+i");
  await save(page);
  expect((await storedEntry(id)).blocks).toEqual([
    {
      id: "h1",
      type: "heading",
      data: { text: [{ text: "A section " }, { text: "heading", italic: true }], level: 2 },
    },
  ]);
});

test("a link to a javascript: address is refused, and the writer keeps their text", async ({
  page,
}) => {
  const id = await createDraftFor(author.email, "Unsafe link", [
    { id: "p1", type: "text", data: { text: [{ text: "Click here" }] } },
  ]);
  await logIn(page, author);
  await page.goto(`/admin/posts/${id}`);

  // The editor's own link field accepts any `scheme:`, so the server is the
  // only thing between this and a stored script link.
  await selectLastWord(page, ".ce-paragraph");
  await page.locator(".ce-inline-toolbar .ce-inline-tool--link").click();
  await page.locator(".ce-inline-tool-input").fill("javascript:alert(1)");
  await page.keyboard.press("Enter");
  await expect(page.locator(".ce-paragraph a")).toHaveAttribute("href", "javascript:alert(1)");

  await save(page);
  await expect(
    page.getByText("Block 1 has a link to an address that cannot be used."),
  ).toBeVisible();
  await expect(page.locator(".ce-paragraph")).toHaveText("Click here");
  const stored = await storedEntry(id);
  expect(stored.version).toBe(1);
  expect(stored.blocks).toEqual([
    { id: "p1", type: "text", data: { text: [{ text: "Click here" }] } },
  ]);
});

test("stored text that looks like markup opens as text and never runs", async ({ page }) => {
  // The F-33 regression, kept for v2: Editor.js renders with innerHTML, so
  // runsToHtml is the only thing stopping this becoming an element.
  const id = await createDraftFor(author.email, "Markup in a run", [
    {
      id: "p1",
      type: "text",
      data: { text: [{ text: "<img src=x onerror=\"document.title='XSS-FIRED'\">", bold: true }] },
    },
  ]);
  await logIn(page, author);
  await page.goto(`/admin/posts/${id}`);
  await page.locator(".ce-paragraph").first().waitFor();

  await expect(page.locator(".ce-paragraph b")).toHaveText(
    "<img src=x onerror=\"document.title='XSS-FIRED'\">",
  );
  expect(await page.locator(".codex-editor img").count()).toBe(0);
  expect(await page.title()).not.toBe("XSS-FIRED");
});

test("keyboard focus on a toolbar button is visible, and differs from hover", async ({ page }) => {
  // Editor.js's own focus affordance is a background swap at 1.1:1, identical to
  // hover, so a keyboard user could not see where they were (F-48). The ring is
  // CSS, and this is what stops it being deleted unnoticed.
  const id = await createDraftFor(author.email, "Focus ring", [
    { id: "p1", type: "text", data: { text: [{ text: "Paragraph words here" }] } },
  ]);
  await logIn(page, author);
  await page.goto(`/admin/posts/${id}`);

  await selectLastWord(page, ".ce-paragraph");
  await page.locator(".ce-inline-toolbar .ce-inline-tool--italic").waitFor();
  // Focus here is a class Editor.js moves, not DOM focus - the caret stays put.
  await page.keyboard.press("Tab");
  const focused = page.locator(".ce-inline-toolbar .ce-popover-item--focused");
  await expect(focused).toHaveCount(1);
  await expect(focused).toHaveCSS("outline-style", "solid");
  await expect(focused).toHaveCSS("outline-width", "2px");

  // A hovered button that is not focused keeps no ring, so the two read apart.
  const italic = page.locator(".ce-inline-toolbar .ce-inline-tool--italic");
  await italic.hover();
  await expect(italic).not.toHaveClass(/ce-popover-item--focused/);
  await expect(italic).toHaveCSS("outline-style", "none");
});
