import { randomInt } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import { logIn } from "./helpers/auth.ts";
import type { TestNode } from "./helpers/documents.ts";
import {
  createAdmin,
  createDraftFor,
  deleteEntriesBy,
  deleteTestUser,
  setRole,
  storedEntry,
  type TestUser,
} from "./helpers/users.ts";

// Item 14c1: the palette's Sections group - four ready-made sections added
// after the selection's section, announced, one undo step each.

let editor: TestUser;
let refusedByPolicy: string[];

test.beforeEach(async ({ page }) => {
  refusedByPolicy = [];
  page.on("console", (message) => {
    if (message.text().includes("Content Security Policy")) refusedByPolicy.push(message.text());
  });
  await page.setExtraHTTPHeaders({
    "X-Forwarded-For": `10.${randomInt(256)}.${randomInt(256)}.17`,
  });
  editor = createAdmin("Template Writer");
  await setRole(editor.email, "editor");
});

test.afterEach(async () => {
  await deleteEntriesBy(editor.email);
  await deleteTestUser(editor.email);
  expect(refusedByPolicy).toEqual([]);
});

function section(...blocks: TestNode[]): TestNode {
  return {
    type: "section",
    attrs: { align: "top", background: "none" },
    content: [{ type: "column", content: blocks }],
  };
}

function paragraph(value: string): TestNode {
  return { type: "paragraph", content: [{ type: "text", text: value }] };
}

function heading(value: string, level: number): TestNode {
  return { type: "heading", attrs: { level }, content: [{ type: "text", text: value }] };
}

/** Two sections, the first holding a Heading (so the page has a main heading elsewhere or not). */
const TWO_SECTIONS: TestNode = {
  type: "doc",
  content: [section(heading("Welcome", 2), paragraph("Intro")), section(paragraph("Second"))],
};

async function openEntry(
  page: Page,
  document: TestNode,
  type: "page" | "post" = "page",
  title = "Template Entry",
) {
  const id = await createDraftFor(editor.email, title, document, { type });
  await logIn(page, editor);
  await page.goto(`/admin/${type === "page" ? "pages" : "posts"}/${id}`);
  const textbox = page.getByRole("textbox", {
    name: type === "page" ? "Page content" : "Post content",
  });
  await expect(textbox).toBeVisible();
  return { id, textbox };
}

async function settle(page: Page) {
  await page.evaluate("new Promise((done) => requestAnimationFrame(() => setTimeout(done)))");
}

/** Click a block to select it (the F-152 workaround: the editor must read the selection first). */
async function select(page: Page, locator: ReturnType<Page["locator"]>) {
  await locator.click();
  await settle(page);
}

/** Each section's columns, each column's blocks as their node names. */
async function canvasShape(page: Page) {
  return page.evaluate(`[...document.querySelectorAll('[role="textbox"] [data-node="section"]')].map(
    (section) => [...section.querySelectorAll('[data-node="column"]')].map(
      (column) => [...column.children].map((block) => block.dataset.node || block.tagName.toLowerCase()),
    ),
  )`);
}

const SHAPES: Record<string, { name: string; shape: string[][] }> = {
  blank: { name: "Blank section", shape: [["p"]] },
  hero: { name: "Hero", shape: [["h1", "p", "space", "button"], ["div"]] },
  "image-text": { name: "Image and text", shape: [["div"], ["h2", "p"]] },
  cta: { name: "Call to action", shape: [["h2", "p", "button"]] },
};

for (const [kind, { name }] of Object.entries(SHAPES)) {
  test(`${name}: clicking its tile adds it as section 2 of 3, announced, and typing lands in it`, async ({
    page,
  }) => {
    const { textbox } = await openEntry(page, TWO_SECTIONS);
    await select(page, textbox.getByText("Welcome"));
    await page.getByRole("button", { name, exact: true }).click();
    await expect(page.getByRole("status")).toHaveText(`${name} added: now section 2 of 3.`);
    const shape = (await canvasShape(page)) as string[][][];
    expect(shape).toHaveLength(3);
    expect(shape[1].map((column) => column.length)).toEqual(
      SHAPES[kind].shape.map((column) => column.length),
    );
    expect(shape[1]).toEqual(SHAPES[kind].shape.map((column) => column));
    expect(shape[0]).toEqual([["h2", "p"]]);
    expect(shape[2]).toEqual([["p"]]);

    // An image block is a `div`; with no file chosen it says so.
    const imageCount = SHAPES[kind].shape.flat().filter((block) => block === "div").length;
    await expect(
      textbox.locator('[data-node="section"]').nth(1).getByText("No image chosen"),
    ).toHaveCount(imageCount);

    await expect(textbox).toBeFocused();
    await page.keyboard.type("Hello");
    const added = textbox.locator('[data-node="section"]').nth(1);
    await expect(added.getByText("Hello", { exact: true })).toBeVisible();
    const first = added.locator('[data-node="column"] > :is(h1, h2, p)').first();
    await expect(first).toHaveText("Hello");
  });
}

test("Enter on the focused Hero tile adds the section", async ({ page }) => {
  const { textbox } = await openEntry(page, TWO_SECTIONS);
  await select(page, textbox.getByText("Welcome"));
  await page.getByRole("button", { name: "Hero", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toHaveText("Hero added: now section 2 of 3.");
  expect(await canvasShape(page)).toHaveLength(3);
});

test("one Undo removes the added section", async ({ page }) => {
  const { textbox } = await openEntry(page, TWO_SECTIONS);
  await select(page, textbox.getByText("Welcome"));
  await page.getByRole("button", { name: "Hero", exact: true }).click();
  expect(await canvasShape(page)).toHaveLength(3);
  await page.getByRole("button", { name: "Undo" }).click();
  expect(await canvasShape(page)).toHaveLength(2);
});

test("on a page with no main heading the hero's heading is the Main heading, the next hero's a Heading", async ({
  page,
}) => {
  const { textbox } = await openEntry(page, TWO_SECTIONS);
  await select(page, textbox.getByText("Welcome"));
  await page.getByRole("button", { name: "Hero", exact: true }).click();
  await expect(page.getByRole("button", { name: "Text style: Main heading" })).toBeVisible();
  await page.getByRole("button", { name: "Hero", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Text style: Heading", exact: true }),
  ).toBeVisible();
});

test("on a post the hero's heading is a Heading", async ({ page }) => {
  const { textbox } = await openEntry(page, TWO_SECTIONS, "post");
  await select(page, textbox.getByText("Welcome"));
  await page.getByRole("button", { name: "Hero", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Text style: Heading", exact: true }),
  ).toBeVisible();
});

test("at 390px Add opens 'Add to the page' with Blocks and Sections, and Hero closes it and adds", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 800 });
  const { textbox } = await openEntry(page, TWO_SECTIONS);
  await select(page, textbox.getByText("Welcome"));
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add to the page" });
  await expect(dialog.getByRole("heading", { name: "Blocks", level: 3 })).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Sections", level: 3 })).toBeVisible();
  await dialog.getByRole("button", { name: "Hero", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("status")).toHaveText("Hero added: now section 2 of 3.");
  expect(await canvasShape(page)).toHaveLength(3);
});

test("a page of 30 sections shows all four section tiles disabled, with the reason", async ({
  page,
}) => {
  const many: TestNode = {
    type: "doc",
    content: Array.from({ length: 30 }, (_, index) => section(paragraph(`S${index}`))),
  };
  await openEntry(page, many);
  for (const { name } of Object.values(SHAPES)) {
    await expect(page.getByRole("button", { name, exact: true })).toBeDisabled();
  }
  await expect(page.getByText("Thirty sections is the most there can be.").first()).toBeVisible();
});

test("a saved page with an added hero (images unchosen) saves", async ({ page }) => {
  const { id, textbox } = await openEntry(page, TWO_SECTIONS);
  await select(page, textbox.getByText("Welcome"));
  await page.getByRole("button", { name: "Hero", exact: true }).click();
  const saved = page.waitForResponse((response) => response.request().method() === "POST");
  await page.getByRole("button", { name: "Save draft" }).click();
  expect((await saved).ok()).toBe(true);
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await expect(page.getByText("An image needs a file from Media.")).toHaveCount(0);
  const stored = (await storedEntry(id)).blocks as TestNode;
  expect(stored.content).toHaveLength(3);
});

/** The browser's own function; the e2e project has no DOM types. */
declare function getComputedStyle(element: unknown, pseudo: string): { content: string };

/** What the canvas draws before an element, from its `::before` (quotes stripped). */
async function drawnHint(locator: ReturnType<Page["locator"]>): Promise<string> {
  return locator.evaluate((element) => {
    const content = getComputedStyle(element, "::before").content;
    return content === "none" || content === "normal" ? "" : content.replace(/^"|"$/g, "");
  });
}

test("a fresh hero's empty heading and text show their hints once the cursor is elsewhere, and typing removes one", async ({
  page,
}) => {
  const { textbox } = await openEntry(page, TWO_SECTIONS);
  await select(page, textbox.getByText("Welcome"));
  await page.getByRole("button", { name: "Hero", exact: true }).click();
  await select(page, textbox.getByText("Welcome"));
  const added = textbox.locator('[data-node="section"]').nth(1);
  const heading = added.locator("h1");
  const text = added.locator('[data-node="column"]').first().locator("> p").first();
  await expect(heading).toHaveAttribute("data-placeholder", "Main heading");
  await expect(text).toHaveAttribute("data-placeholder", "Text");
  expect(await drawnHint(heading)).toBe("Main heading");
  expect(await drawnHint(text)).toBe("Text");

  await heading.click();
  await settle(page);
  await page.keyboard.type("Hi");
  await expect(heading).toHaveText("Hi");
  await expect(heading).not.toHaveAttribute("data-placeholder", /./);
  await expect(text).toHaveAttribute("data-placeholder", "Text");
});

test("an untouched one-column section shows only the page's placeholder, and only with the cursor in it", async ({
  page,
}) => {
  const { textbox } = await openEntry(page, {
    type: "doc",
    content: [section(paragraph("Words")), section({ type: "paragraph" })],
  });
  const empty = textbox.locator('[data-node="section"]').nth(1).locator("p");
  await select(page, textbox.getByText("Words"));
  expect(await drawnHint(empty)).toBe("");
  await select(page, empty);
  await expect(empty).toHaveAttribute("data-placeholder", "Write your page…");
  expect(await drawnHint(empty)).toBe("Write your page…");
});

test("an untouched column of a two-column section shows only the empty-column hint", async ({
  page,
}) => {
  const { textbox } = await openEntry(page, {
    type: "doc",
    content: [
      {
        type: "section",
        attrs: { align: "top", background: "none" },
        content: [
          { type: "column", content: [paragraph("Left")] },
          { type: "column", content: [{ type: "paragraph" }] },
        ],
      },
    ],
  });
  await select(page, textbox.getByText("Left"));
  const empty = textbox.locator("[data-hint]");
  await expect(empty).toHaveCount(1);
  expect(await drawnHint(empty)).toMatch(/^Empty column/);
  await expect(
    empty.locator("xpath=..").locator("[data-placeholder]:not([data-placeholder=''])"),
  ).toHaveCount(0);
  await expect(empty).not.toHaveAttribute("data-placeholder", /./);
});
