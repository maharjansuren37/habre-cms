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
// is the v4 contract and nothing else. Step 4: sections and columns - Add a
// section, the section chip's Columns and Remove section, and typing or
// deleting never crossing a section or column.

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

async function openSeeded(
  page: Page,
  type: "post" | "page",
  title: string,
  document: unknown = startDocument,
) {
  const id = await createDraftFor(editor.email, title, document, { type });
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

// ---- Step 4: sections and columns ------------------------------------------

const para = (text?: string) => ({
  type: "paragraph",
  ...(text && { content: [{ type: "text", text }] }),
});
const section = (...columns: string[][]) => ({
  type: "section",
  attrs: { align: "top", background: "none" },
  content: columns.map((texts) => ({ type: "column", content: texts.map((text) => para(text)) })),
});
const doc = (...sections: unknown[]) => ({ type: "doc", content: sections });

/** The section chip, found by the name it reads ("Section 2 of 5"). */
function chip(page: Page, name: string) {
  return page.getByRole("group", { name, exact: true });
}

/** The canvas's sections, as the texts of each column: [[["A"], ["B"]], ...].
 *  Run in the page, so written as source: these tests' types have no DOM. */
async function canvasShape(page: Page) {
  return page.evaluate(`[...document.querySelectorAll('[role="textbox"] [data-node="section"]')].map(
    (section) => [...section.querySelectorAll('[data-node="column"]')].map(
      (column) => [...column.children].map((block) => block.textContent),
    ),
  )`);
}

test("Add a section, then type in it: the chip reads Section 2 of 2 with the cursor there", async ({
  page,
}) => {
  const { id, textbox } = await openSeeded(page, "page", "Added Section Page");
  await textbox.getByText("Start here.").click();
  await expect(chip(page, "Section 1 of 1")).toBeVisible();
  // The last section cannot be removed, so the chip does not offer it.
  await expect(page.getByRole("button", { name: "Remove section" })).toHaveCount(0);

  await page.getByRole("button", { name: "Add a section" }).click();
  await page.keyboard.type("A second section");
  await expect(chip(page, "Section 2 of 2")).toBeVisible();
  await expect(
    chip(page, "Section 2 of 2").getByRole("button", { name: "Remove section" }),
  ).toBeVisible();
  expect(await canvasShape(page)).toEqual([[["Start here."]], [["A second section"]]]);

  await save(page);
  const stored = await storedEntry(id);
  expect(stored.blocks).toEqual(doc(section(["Start here."]), section(["A second section"])));
});

test("3 columns -> 2 keeps every block, as one undoable step", async ({ page }) => {
  const { id, textbox } = await openSeeded(
    page,
    "page",
    "Columns Page",
    doc(section(["Alpha"], ["Beta"], ["Gamma", "Delta"])),
  );
  await textbox.getByText("Alpha").click();
  const columns = chip(page, "Section 1 of 1").getByLabel("Columns");
  await expect(columns).toHaveValue("3");

  await columns.selectOption("2");
  expect(await canvasShape(page)).toEqual([[["Alpha"], ["Beta", "Gamma", "Delta"]]]);
  // The canvas draws the new count from the same stylesheet the site uses.
  expect(
    await page.evaluate(
      `getComputedStyle(document.querySelector('[role="textbox"] [data-node="section"] > div')).getPropertyValue("--columns").trim()`,
    ),
  ).toBe("2");

  // One Undo reverts the whole change; Redo puts it back.
  await textbox.getByText("Alpha").click();
  await settle(page);
  await page.keyboard.press("Control+z");
  expect(await canvasShape(page)).toEqual([[["Alpha"], ["Beta"], ["Gamma", "Delta"]]]);
  await expect(columns).toHaveValue("3");
  await page.keyboard.press("Control+Shift+z");
  expect(await canvasShape(page)).toEqual([[["Alpha"], ["Beta", "Gamma", "Delta"]]]);

  // Growing adds an empty column on the right.
  await columns.selectOption("3");
  expect(await canvasShape(page)).toEqual([[["Alpha"], ["Beta", "Gamma", "Delta"], [""]]]);
  await columns.selectOption("2");

  await save(page);
  const stored = await storedEntry(id);
  expect(stored.blocks).toEqual(doc(section(["Alpha"], ["Beta", "Gamma", "Delta"])));
});

test("Remove section, then Ctrl+Z restores it with its text", async ({ page }) => {
  const { id, textbox } = await openSeeded(
    page,
    "page",
    "Removed Section Page",
    doc(section(["First words"]), section(["Second words"], ["More words"])),
  );
  await textbox.getByText("Second words").click();
  await expect(chip(page, "Section 2 of 2")).toBeVisible();

  await page.getByRole("button", { name: "Remove section" }).click();
  expect(await canvasShape(page)).toEqual([[["First words"]]]);
  await expect(chip(page, "Section 1 of 1")).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove section" })).toHaveCount(0);

  await page.keyboard.press("Control+z");
  expect(await canvasShape(page)).toEqual([[["First words"]], [["Second words"], ["More words"]]]);

  await save(page);
  const stored = await storedEntry(id);
  expect(stored.blocks).toEqual(
    doc(section(["First words"]), section(["Second words"], ["More words"])),
  );
});

test("Backspace at the start of a column and Delete at the end of a section change nothing outside them", async ({
  page,
}) => {
  const seeded = doc(section(["Left"], ["Right"]), section(["Below"]));
  const { id, textbox } = await openSeeded(page, "page", "Isolated Page", seeded);
  const shape = [[["Left"], ["Right"]], [["Below"]]];

  // The start of the second column.
  await textbox.getByText("Right").click();
  await settle(page);
  await page.keyboard.press("Home");
  await settle(page);
  await page.keyboard.press("Backspace");
  expect(await canvasShape(page)).toEqual(shape);

  // The end of the first section (its last column's last block).
  await page.keyboard.press("End");
  await settle(page);
  await page.keyboard.press("Delete");
  expect(await canvasShape(page)).toEqual(shape);

  // The start of the second section.
  await textbox.getByText("Below").click();
  await settle(page);
  await page.keyboard.press("Home");
  await settle(page);
  await page.keyboard.press("Backspace");
  expect(await canvasShape(page)).toEqual(shape);

  // The end of the first column.
  await textbox.getByText("Left").click();
  await settle(page);
  await page.keyboard.press("End");
  await settle(page);
  await page.keyboard.press("Delete");
  expect(await canvasShape(page)).toEqual(shape);

  await save(page);
  expect((await storedEntry(id)).blocks).toEqual(seeded);
});

test("Tab from the writing area reaches the chip's Columns control", async ({ page }) => {
  const { textbox } = await openSeeded(page, "post", "Tab Post");
  await textbox.getByText("Start here.").click();
  await page.keyboard.press("Tab");
  await expect(chip(page, "Section 1 of 1").getByLabel("Columns")).toBeFocused();
});

test("a page saved with 2 sections of 2 columns renders them side by side on the public page", async ({
  page,
}) => {
  const { textbox } = await openSeeded(page, "page", "Two By Two");
  const columns = () => textbox.locator('[data-node="column"]');

  await textbox.getByText("Start here.").click();
  await page.getByLabel("Columns").selectOption("2");
  await columns().nth(1).click();
  await page.keyboard.type("Top right");
  await page.getByRole("button", { name: "Add a section" }).click();
  await page.keyboard.type("Bottom left");
  await page.getByLabel("Columns").selectOption("2");
  await columns().nth(3).click();
  await page.keyboard.type("Bottom right");
  expect(await canvasShape(page)).toEqual([
    [["Start here."], ["Top right"]],
    [["Bottom left"], ["Bottom right"]],
  ]);

  await save(page);
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page).toHaveURL(/\/admin\/pages\?/);

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/two-by-two");
  await expect(page.getByRole("main").locator("section")).toHaveCount(2);
  for (const [left, right] of [
    ["Start here.", "Top right"],
    ["Bottom left", "Bottom right"],
  ]) {
    const a = await page.getByText(left, { exact: true }).boundingBox();
    const b = await page.getByText(right, { exact: true }).boundingBox();
    expect(a && b && Math.abs(a.y - b.y) < 2 && b.x >= a.x + a.width).toBe(true);
  }
});

// Journey 2 (design.md, *Edit and publish*), the part this item has: open a
// page, change its text, Publish, and the public page shows it - once opening
// the editor as a full page load, once through the admin's own links.
for (const arrival of ["a full page load", "the admin's own links"] as const) {
  test(`Journey 2: open a page by ${arrival}, change its text, Publish, and the public page shows it`, async ({
    page,
  }) => {
    const title = `Journey Page ${randomInt(1_000_000)}`;
    const id = await createDraftFor(editor.email, title, startDocument, {
      type: "page",
    });
    await logIn(page, editor);
    if (arrival === "a full page load") {
      await page.goto(`/admin/pages/${id}`);
    } else {
      await page.goto("/admin");
      await page.getByRole("link", { name: "Pages", exact: true }).click();
      await page.getByRole("link", { name: title, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/admin/pages/${id}$`));
    }
    const textbox = page.getByRole("textbox", { name: "Page content" });
    await textbox.getByText("Start here.").click();
    await settle(page);
    await page.keyboard.press("End");
    await settle(page);
    await page.keyboard.type(" Changed for the journey.");

    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByText(`Published`, { exact: false }).first()).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/pages\?/);

    await page.goto(`/${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`);
    await expect(
      page.getByRole("main").getByText("Start here. Changed for the journey."),
    ).toBeVisible();
  });
}

// Step 6: Editor.js is gone, so a new entry starts as the empty v4 document.
for (const type of ["post", "page"] as const) {
  test(`a new ${type} opens in the document editor and saves as v4`, async ({ page }) => {
    await logIn(page, editor);
    await page.goto(`/admin/${type}s/new`);
    const name = type === "page" ? "Page content" : "Post content";
    const textbox = page.getByRole("textbox", { name });
    await expect(textbox).toBeVisible();

    await page.getByRole("textbox", { name: "Title" }).fill(`Fresh ${type}`);
    await textbox.click();
    await page.keyboard.type("Written from scratch.");
    await page.getByRole("button", { name: "Save draft" }).click();
    await page.waitForURL(new RegExp(`/admin/${type}s/[0-9a-f-]{36}$`));
    const id = new URL(page.url()).pathname.split("/").pop() ?? "";

    const stored = await storedEntry(id);
    expect(stored.blocksFormat).toBe("v4");
    expect(firstColumn(stored.blocks)).toEqual([
      { type: "paragraph", content: [{ type: "text", text: "Written from scratch." }] },
    ]);
    await page.reload();
    await expect(page.getByRole("textbox", { name })).toContainText("Written from scratch.");
  });
}
