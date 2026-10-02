import { randomInt } from "node:crypto";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { logIn } from "./helpers/auth.ts";
import {
  createAdmin,
  createDraftFor,
  deleteEntriesBy,
  deleteTestUser,
  setRole,
  storedEntry,
  type TestUser,
} from "./helpers/users.ts";

// Item 14a1, step 3: a v4 entry opens in the TipTap document editor - text
// styles, lists, quote, bold, italic, links, undo and redo - and what it saves
// is the v4 contract and nothing else.

let editor: TestUser;
// The admin's Content-Security-Policy is not loosened for TipTap: anything it
// refuses while the editor runs fails the test (Chromium logs each refusal).
let refusedByPolicy: string[];

test.beforeEach(async ({ page }) => {
  refusedByPolicy = [];
  page.on("console", (message) => {
    if (message.text().includes("Content Security Policy")) refusedByPolicy.push(message.text());
  });
  await page.setExtraHTTPHeaders({
    "X-Forwarded-For": `10.${randomInt(256)}.${randomInt(256)}.15`,
  });
  editor = createAdmin("Document Writer");
  await setRole(editor.email, "editor");
});

test.afterEach(async () => {
  await deleteEntriesBy(editor.email);
  await deleteTestUser(editor.email);
  expect(refusedByPolicy).toEqual([]);
});

const startDocument = {
  type: "doc",
  content: [
    {
      type: "section",
      attrs: { align: "top", background: "none" },
      content: [
        {
          type: "column",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Start here." }] }],
        },
      ],
    },
  ],
};

async function openSeeded(page: Page, type: "post" | "page", title: string) {
  const id = await createDraftFor(editor.email, title, startDocument, { type, blocksFormat: "v4" });
  await logIn(page, editor);
  await page.goto(`/admin/${type}s/${id}`);
  const name = type === "page" ? "Page content" : "Post content";
  const textbox = page.getByRole("textbox", { name });
  await expect(textbox).toBeVisible();
  return { id, textbox };
}

/**
 * Lets the editor read a caret the browser moved itself (a click, End,
 * Shift+Home). ProseMirror learns of it from `selectionchange`, which Chromium
 * fires as a separate task - a key pressed faster than that, as only a test
 * can, would act on the caret's old place.
 */
async function settle(page: Page) {
  await page.evaluate("new Promise((done) => requestAnimationFrame(() => setTimeout(done)))");
}

/** Puts the caret at the end of the given text and starts a new paragraph. */
async function newParagraphAfter(page: Page, textbox: Locator, text = "Start here.") {
  await textbox.getByText(text).click();
  await settle(page);
  await page.keyboard.press("End");
  await settle(page);
  await page.keyboard.press("Enter");
}

async function save(page: Page) {
  const saved = page.waitForResponse((response) => response.request().method() === "POST");
  await page.getByRole("button", { name: "Save draft" }).click();
  expect((await saved).ok()).toBe(true);
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
}

/** The v4 contract's node types and marks, and the attrs each may carry. */
const CONTRACT_NODES: Record<string, string[]> = {
  doc: [],
  section: ["align", "background"],
  column: [],
  paragraph: [],
  heading: ["level"],
  bulletList: [],
  orderedList: [],
  listItem: [],
  blockquote: [],
  text: [],
};
const CONTRACT_MARKS: Record<string, string[]> = { bold: [], italic: [], link: ["href"] };
const NODE_KEYS = new Set(["type", "attrs", "content", "text", "marks"]);

/** Every way a stored document strays from the contract, as readable strings. */
function contractViolations(node: unknown, path = "doc", insideItem = false): string[] {
  const problems: string[] = [];
  const { type, attrs, content, marks, ...rest } = node as Record<string, unknown>;
  for (const key of Object.keys(rest))
    if (!NODE_KEYS.has(key)) problems.push(`${path}: key ${key}`);
  const allowed = CONTRACT_NODES[type as string];
  if (!allowed) return [...problems, `${path}: node ${String(type)}`];
  if (insideItem && (type === "bulletList" || type === "orderedList")) {
    problems.push(`${path}: nested list`);
  }
  for (const key of Object.keys((attrs as object) ?? {})) {
    if (!allowed.includes(key)) problems.push(`${path}: attr ${key}`);
  }
  for (const mark of (marks as { type: string; attrs?: object }[]) ?? []) {
    const markAttrs = CONTRACT_MARKS[mark.type];
    if (!markAttrs) problems.push(`${path}: mark ${mark.type}`);
    for (const key of Object.keys(mark.attrs ?? {})) {
      if (!markAttrs?.includes(key)) problems.push(`${path}: mark attr ${key}`);
    }
  }
  (content as unknown[] | undefined)?.forEach((child, index) => {
    problems.push(
      ...contractViolations(child, `${path}.${index}`, insideItem || type === "listItem"),
    );
  });
  return problems;
}

/** The blocks of the first (only) column, as stored. */
function firstColumn(stored: unknown): unknown[] {
  return (stored as typeof startDocument).content[0].content[0].content;
}

test("text styles, both lists and a quote survive Save and a reload, stored as v4", async ({
  page,
}) => {
  const { id, textbox } = await openSeeded(page, "page", "Styled Page");
  const textStyle = page.getByLabel("Text style");

  await newParagraphAfter(page, textbox);
  await page.keyboard.type("Big idea");
  await textStyle.selectOption({ label: "Heading" });
  await newParagraphAfter(page, textbox, "Big idea");
  await page.keyboard.type("Smaller");
  await textStyle.selectOption({ label: "Subheading" });
  await newParagraphAfter(page, textbox, "Smaller");
  await page.keyboard.type("Smallest");
  await textStyle.selectOption({ label: "Small heading" });
  await newParagraphAfter(page, textbox, "Smallest");
  await page.keyboard.type("Plain again");
  await textStyle.selectOption({ label: "Heading" });
  await textStyle.selectOption({ label: "Text" });
  await newParagraphAfter(page, textbox, "Plain again");

  await page.keyboard.type("One");
  await page.getByRole("button", { name: "Bulleted list" }).click();
  await page.keyboard.press("Enter");
  await page.keyboard.type("Two");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.keyboard.type("First");
  await page.getByRole("button", { name: "Numbered list" }).click();
  await page.keyboard.press("Enter");
  await page.keyboard.type("Second");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Quoted words");
  await page.getByRole("button", { name: "Quote" }).click();

  await save(page);
  await page.reload();
  await expect(textbox.getByRole("heading", { level: 2, name: "Big idea" })).toBeVisible();
  await expect(textbox.getByRole("heading", { level: 3, name: "Smaller" })).toBeVisible();
  await expect(textbox.getByRole("heading", { level: 4, name: "Smallest" })).toBeVisible();
  await expect(textbox.getByRole("list")).toHaveCount(2);
  await expect(textbox.locator("ul").getByRole("listitem")).toHaveText(["One", "Two"]);
  await expect(textbox.locator("ol").getByRole("listitem")).toHaveText(["First", "Second"]);
  await expect(textbox.getByRole("blockquote")).toHaveText("Quoted words");

  const stored = await storedEntry(id);
  expect(stored.blocksFormat).toBe("v4");
  expect(contractViolations(stored.blocks)).toEqual([]);
  const para = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });
  const item = (text: string) => ({ type: "listItem", content: [para(text)] });
  const heading = (level: number, text: string) => ({
    type: "heading",
    attrs: { level },
    content: [{ type: "text", text }],
  });
  expect(firstColumn(stored.blocks)).toEqual([
    para("Start here."),
    heading(2, "Big idea"),
    heading(3, "Smaller"),
    heading(4, "Smallest"),
    para("Plain again"),
    { type: "bulletList", content: [item("One"), item("Two")] },
    { type: "orderedList", content: [item("First"), item("Second")] },
    { type: "blockquote", content: [para("Quoted words")] },
  ]);
});

test("bold and italic by button and keyboard, and a link through the dialog, survive a reload", async ({
  page,
}) => {
  const { id, textbox } = await openSeeded(page, "post", "Marked Post");
  const bold = page.getByRole("button", { name: "Bold" });
  const italic = page.getByRole("button", { name: "Italic" });

  await newParagraphAfter(page, textbox);
  await bold.click();
  await expect(bold).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.type("loud");
  await bold.click();
  await page.keyboard.type(" and ");
  await page.keyboard.press("Control+b");
  await page.keyboard.type("strong");
  await page.keyboard.press("Control+b");
  await page.keyboard.type(" then ");
  await italic.click();
  await page.keyboard.type("lean");
  await italic.click();
  await page.keyboard.type(" and ");
  await page.keyboard.press("Control+i");
  await page.keyboard.type("slant");
  await page.keyboard.press("Control+i");

  await page.keyboard.press("Enter");
  await page.keyboard.type("Visit us");
  await page.keyboard.press("Shift+Home");
  await settle(page);
  await page.getByRole("button", { name: "Link" }).click();
  const dialog = page.getByRole("dialog", { name: "Add a link" });
  const address = dialog.getByLabel("Web address");
  await address.fill("javascript:alert(1)");
  await dialog.getByRole("button", { name: "Add link" }).click();
  // Refused beside the field; the dialog stays open with the address in it.
  await expect(dialog.getByText("This address cannot be used.", { exact: false })).toBeVisible();
  await expect(address).toHaveAttribute("aria-invalid", "true");
  await address.fill("https://example.com/visit");
  await dialog.getByRole("button", { name: "Add link" }).click();
  await expect(dialog).toBeHidden();

  await save(page);
  await page.reload();
  await expect(textbox.getByRole("strong")).toHaveText(["loud", "strong"]);
  await expect(textbox.getByRole("emphasis")).toHaveText(["lean", "slant"]);
  await expect(textbox.getByRole("link", { name: "Visit us" })).toHaveAttribute(
    "href",
    "https://example.com/visit",
  );

  const stored = await storedEntry(id);
  expect(stored.blocksFormat).toBe("v4");
  expect(contractViolations(stored.blocks)).toEqual([]);
  const text = (value: string, mark?: object) => ({
    type: "text",
    text: value,
    ...(mark && { marks: [mark] }),
  });
  expect(firstColumn(stored.blocks)).toEqual([
    { type: "paragraph", content: [text("Start here.")] },
    {
      type: "paragraph",
      content: [
        text("loud", { type: "bold" }),
        text(" and "),
        text("strong", { type: "bold" }),
        text(" then "),
        text("lean", { type: "italic" }),
        text(" and "),
        text("slant", { type: "italic" }),
      ],
    },
    {
      type: "paragraph",
      content: [text("Visit us", { type: "link", attrs: { href: "https://example.com/visit" } })],
    },
  ]);
});

test("undo and redo work by button and keyboard, and the result survives a reload", async ({
  page,
}) => {
  const { id, textbox } = await openSeeded(page, "page", "Undo Page");
  const typed = textbox.getByText("Second thoughts");

  await newParagraphAfter(page, textbox);
  await page.keyboard.type("Second thoughts");
  await expect(typed).toBeVisible();

  await page.keyboard.press("Control+z");
  await expect(typed).toHaveCount(0);
  await page.keyboard.press("Control+Shift+z");
  await expect(typed).toBeVisible();

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(typed).toHaveCount(0);
  await page.getByRole("button", { name: "Redo" }).click();
  await expect(typed).toBeVisible();

  await save(page);
  await page.reload();
  await expect(textbox.getByText("Second thoughts")).toBeVisible();
  const stored = await storedEntry(id);
  expect(firstColumn(stored.blocks)).toEqual([
    { type: "paragraph", content: [{ type: "text", text: "Start here." }] },
    { type: "paragraph", content: [{ type: "text", text: "Second thoughts" }] },
  ]);
});

test("in dark mode the canvas is the site's light background", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  const { textbox } = await openSeeded(page, "page", "Dark Page");
  const canvas = page.locator('[data-surface="site"]').filter({ has: textbox });
  await expect(canvas).toHaveCount(1);

  // Run in the page, so written as source: these tests' types have no DOM.
  // The second value is the scope's own --color-bg, resolved by the browser.
  const [canvasBackground, siteBackground, adminBackground] = (await page.evaluate(`(() => {
    const element = document.querySelector('[data-surface="site"]:has([role="textbox"])');
    const probe = document.createElement("div");
    probe.style.background = getComputedStyle(element).getPropertyValue("--color-bg");
    element.append(probe);
    const site = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return [getComputedStyle(element).backgroundColor, site, getComputedStyle(document.body).backgroundColor];
  })()`)) as string[];
  expect(canvasBackground).toBe("rgb(255, 255, 255)");
  expect(canvasBackground).toBe(siteBackground);
  expect(adminBackground).not.toBe(canvasBackground);
});

test("pasted HTML saves only contract nodes: image and table dropped, list flat, unsafe link gone", async ({
  page,
}) => {
  const { id, textbox } = await openSeeded(page, "page", "Pasted Page");
  await newParagraphAfter(page, textbox);

  const html = [
    "<p>Pasted words</p>",
    '<img src="https://example.com/photo.png" alt="A photo">',
    "<table><tr><td>Cell text</td></tr></table>",
    "<ul><li>Outer<ul><li>Inner</li></ul></li></ul>",
    '<p><a href="javascript:alert(1)">Bad link</a></p>',
  ].join("");
  // ProseMirror reads a paste from the event's clipboard data, so the test
  // hands it one - written as source, since these tests' types have no DOM.
  await page.evaluate(`(() => {
    const element = document.querySelector('[role="textbox"]');
    const data = new DataTransfer();
    data.setData("text/html", ${JSON.stringify(html)});
    data.setData("text/plain", "Pasted words");
    element.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  })()`);
  await expect(textbox.getByText("Pasted words")).toBeVisible();

  await save(page);
  await expect(page.getByText("Your changes were not saved.")).toHaveCount(0);
  const stored = await storedEntry(id);
  expect(stored.blocksFormat).toBe("v4");
  expect(contractViolations(stored.blocks)).toEqual([]);

  const json = JSON.stringify(stored.blocks);
  for (const kept of ["Pasted words", "Outer", "Inner", "Bad link"]) expect(json).toContain(kept);
  expect(json).not.toContain("javascript:");
  expect(json).not.toContain('"link"');
  expect(json).not.toContain("photo.png");
});
