import { randomInt } from "node:crypto";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { logIn } from "./helpers/auth.ts";
import {
  buttonBlock,
  imageBlock,
  inSection,
  lineBlock,
  spaceBlock,
  textDocument,
} from "./helpers/documents.ts";
import { deleteTestMedia, insertTestMediaRow, testMediaFilename } from "./helpers/media.ts";
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
// Media rows a test seeded; removed before the user they belong to.
let seededMedia: string[];

test.beforeEach(async ({ page }) => {
  refusedByPolicy = [];
  seededMedia = [];
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
  for (const id of seededMedia) await deleteTestMedia(id);
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
  image: ["mediaId"],
  button: ["label", "href", "style"],
  horizontalRule: [],
  space: [],
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
  await page
    .getByRole("toolbar", { name: "Formatting" })
    .getByRole("button", { name: "Quote" })
    .click();

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

test("copying a selection that holds an image is handled by the editor and does not throw (F-167)", async ({
  page,
}) => {
  const media = await seedMedia("A copied gate");
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const { textbox } = await openSeeded(
    page,
    "page",
    "Copy Image Page",
    inSection(
      { type: "paragraph", content: [{ type: "text", text: "Before the gate" }] },
      imageBlock(media),
    ),
  );
  await textbox.getByText("Before the gate").click();
  await page.keyboard.press("ControlOrMeta+A");
  await settle(page);
  // ProseMirror writes the clipboard from the event's clipboard data, so the
  // test hands it one - written as source, since these tests' types have no DOM.
  const copied = await page.evaluate(`(() => {
    const element = document.querySelector('[role="textbox"]');
    const data = new DataTransfer();
    const event = new ClipboardEvent("copy", { clipboardData: data, bubbles: true, cancelable: true });
    element.dispatchEvent(event);
    return { prevented: event.defaultPrevented, html: data.getData("text/html"), text: data.getData("text/plain") };
  })()`);
  expect(errors).toEqual([]);
  expect(copied).toMatchObject({ prevented: true });
  expect((copied as { html: string }).html).toContain("Before the gate");
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

/** Presses the chip's Section settings and returns the panel it opens, named `name` ("Section 2"). */
async function openSectionSettings(page: Page, name: string) {
  await page.getByRole("button", { name: "Section settings" }).click();
  const panel = page.getByRole("complementary", { name, exact: true });
  await expect(panel).toBeVisible();
  return panel;
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

test("3 columns -> 2 keeps every block, as one undoable step (Section settings, Columns)", async ({
  page,
}) => {
  const { id, textbox } = await openSeeded(
    page,
    "page",
    "Columns Page",
    doc(section(["First"]), section(["Alpha"], ["Beta"], ["Gamma", "Delta"])),
  );
  await textbox.getByText("Alpha").click();
  const columns = await openSectionSettings(page, "Section 2").then((panel) =>
    panel.getByLabel("Columns"),
  );
  await expect(columns).toHaveValue("3");

  await columns.selectOption("2");
  expect(await canvasShape(page)).toEqual([[["First"]], [["Alpha"], ["Beta", "Gamma", "Delta"]]]);
  // The canvas draws the new count from the same stylesheet the site uses.
  expect(
    await page.evaluate(
      `getComputedStyle(document.querySelectorAll('[role="textbox"] [data-node="section"] > div')[1]).getPropertyValue("--columns").trim()`,
    ),
  ).toBe("2");

  // One Undo reverts the whole change; Redo puts it back.
  await textbox.getByText("Alpha").click();
  await settle(page);
  await page.keyboard.press("Control+z");
  expect(await canvasShape(page)).toEqual([[["First"]], [["Alpha"], ["Beta"], ["Gamma", "Delta"]]]);
  await expect(columns).toHaveValue("3");
  await page.keyboard.press("Control+Shift+z");
  expect(await canvasShape(page)).toEqual([[["First"]], [["Alpha"], ["Beta", "Gamma", "Delta"]]]);

  // Growing adds an empty column on the right.
  await columns.selectOption("3");
  expect(await canvasShape(page)).toEqual([
    [["First"]],
    [["Alpha"], ["Beta", "Gamma", "Delta"], [""]],
  ]);
  await columns.selectOption("2");

  await save(page);
  const stored = await storedEntry(id);
  expect(stored.blocks).toEqual(
    doc(section(["First"]), section(["Alpha"], ["Beta", "Gamma", "Delta"])),
  );
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

test("Tab from the writing area reaches the chip's Section settings button", async ({ page }) => {
  const { textbox } = await openSeeded(page, "post", "Tab Post");
  await textbox.getByText("Start here.").click();
  await page.keyboard.press("Tab");
  await expect(
    chip(page, "Section 1 of 1").getByRole("button", { name: "Section settings" }),
  ).toBeFocused();
});

test("a page saved with 2 sections of 2 columns renders them side by side on the public page", async ({
  page,
}) => {
  const { textbox } = await openSeeded(page, "page", "Two By Two");
  const columns = () => textbox.locator('[data-node="column"]');

  await textbox.getByText("Start here.").click();
  await (await openSectionSettings(page, "Section 1")).getByLabel("Columns").selectOption("2");
  await columns().nth(1).click();
  await page.keyboard.type("Top right");
  await page.getByRole("button", { name: "Add a section" }).click();
  await page.keyboard.type("Bottom left");
  await (await openSectionSettings(page, "Section 2")).getByLabel("Columns").selectOption("2");
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

// Step 6b: the canvas gives the document the width the public page gives it,
// so the 40rem container query places columns in the editor as it publishes.
test("a 2-column section sits side by side in the canvas at 1280px and stacks at 390px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const { textbox } = await openSeeded(
    page,
    "page",
    "Canvas Columns",
    doc(section(["Left"], ["Right"])),
  );
  const left = textbox.getByText("Left", { exact: true });
  const right = textbox.getByText("Right", { exact: true });

  let [a, b] = [await left.boundingBox(), await right.boundingBox()];
  expect(a && b && Math.abs(a.y - b.y) < 2 && b.x >= a.x + a.width).toBe(true);

  await page.setViewportSize({ width: 390, height: 800 });
  [a, b] = [await left.boundingBox(), await right.boundingBox()];
  expect(a && b && b.y >= a.y + a.height && Math.abs(a.x - b.x) < 2).toBe(true);
  expect(await page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")).toBe(
    true,
  );
});

test("the canvas's content box is as wide as the public page's at 1280px", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const id = await createDraftFor(editor.email, "Same Width", doc(section(["Measure"])), {
    type: "page",
    status: "published",
  });
  await logIn(page, editor);
  await page.goto(`/admin/pages/${id}`);
  const textbox = page.getByRole("textbox", { name: "Page content" });
  await expect(textbox).toBeVisible();
  const inEditor = await textbox.locator('[data-node="section"]').boundingBox();

  await page.goto("/same-width");
  const published = await page.getByRole("main").locator("section").boundingBox();

  expect(inEditor && published).toBeTruthy();
  expect(Math.abs((inEditor?.width ?? 0) - (published?.width ?? 0))).toBeLessThanOrEqual(1);
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

// ---- Step 7: a refused save keeps the draft, and the bar's numbers ---------

const TOO_LONG = "This is too long to save. Remove some text and save again.";
// Past the 1 MB a save body may be: 220,000 five-byte words.
const OVER_A_MEGABYTE = "word ".repeat(220_000);

test("text past 1 MB is refused before it is sent, and stays in the writing area (F-39)", async ({
  page,
}) => {
  const { id, textbox } = await openSeeded(page, "page", "Too Long Page");
  await newParagraphAfter(page, textbox);
  await page.keyboard.type("Keep this draft.");
  await settle(page);
  await page.evaluate(`(() => {
    const element = document.querySelector('[role="textbox"]');
    const data = new DataTransfer();
    data.setData("text/plain", ${JSON.stringify(` ${OVER_A_MEGABYTE}`)});
    element.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  })()`);

  const posts: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST") posts.push(request.url());
  });
  await page.getByRole("button", { name: "Save draft" }).click();

  await expect(page.getByText("Your changes were not saved.")).toBeVisible();
  await expect(page.getByText(TOO_LONG)).toBeVisible();
  await expect(page.getByText("Not saved - see message below")).toBeVisible();
  await expect(textbox).toContainText("Keep this draft.");
  expect(((await textbox.textContent()) ?? "").length).toBeGreaterThan(1_000_000);
  expect(posts).toEqual([]);
  expect((await storedEntry(id)).version).toBe(1);
});

test("a save the server refuses as too large shows the message and keeps the editor", async ({
  page,
}) => {
  const { id, textbox } = await openSeeded(page, "post", "Server Refused Post");
  await newParagraphAfter(page, textbox);
  await page.keyboard.type("Still here.");
  // The browser's own check passes this small body; the request is padded on
  // its way out, so only the server's check can refuse it.
  await page.route("**/admin/posts/**", (route) => {
    const request = route.request();
    if (request.method() !== "POST") return route.continue();
    return route.continue({ postData: `${request.postData()}&pad=${"x".repeat(1_100_000)}` });
  });
  const refused = page.waitForResponse((response) => response.request().method() === "POST");
  await page.getByRole("button", { name: "Save draft" }).click();

  expect((await refused).status()).toBe(413);
  await expect(page.getByText(TOO_LONG)).toBeVisible();
  await expect(textbox).toContainText("Still here.");
  expect((await storedEntry(id)).version).toBe(1);
});

// The browser's check would hide the server's, so this posts past it: a
// plain fetch from the logged-in page, as any script on the machine could.
test("a raw POST over 1 MB to any entry save answers 413 with the message, not an error", async ({
  page,
}) => {
  const postId = await createDraftFor(editor.email, "Raw Post", startDocument, { type: "post" });
  const pageId = await createDraftFor(editor.email, "Raw Page", startDocument, { type: "page" });
  await logIn(page, editor);
  const blocks = JSON.stringify(textDocument(OVER_A_MEGABYTE));

  for (const path of [
    `/admin/posts/${postId}`,
    `/admin/pages/${pageId}`,
    "/admin/posts/new",
    "/admin/pages/new",
  ]) {
    const { status, text } = (await page.evaluate(`(async () => {
      const body = new URLSearchParams({ intent: "save", version: "1", title: "Raw", blocks: ${JSON.stringify(blocks)} });
      const response = await fetch(${JSON.stringify(path)}, { method: "POST", body, redirect: "manual" });
      return { status: response.status, text: await response.text() };
    })()`)) as { status: number; text: string };
    expect(status, path).toBe(413);
    expect(text, path).toContain(TOO_LONG);
  }
  expect((await storedEntry(postId)).version).toBe(1);
  expect((await storedEntry(pageId)).version).toBe(1);
});

/** A document at the caps: 30 sections and 200 blocks of about 1,000 characters. */
function documentAtTheCaps() {
  const sentence = "A sentence of ordinary length that a writer might put on a page. ";
  const text = (n: number) => `Block ${n}. ${sentence.repeat(15)}`.trim();
  let n = 0;
  return doc(
    ...Array.from({ length: 30 }, (_, s) => {
      const blocks = s < 20 ? 7 : 6; // 20 x 7 + 10 x 6 = 200
      const columns = (s % 3) + 1;
      const content = Array.from({ length: columns }, () => ({
        type: "column",
        content: [] as unknown[],
      }));
      for (let b = 0; b < blocks; b++) {
        n += 1;
        content[b % columns].content.push(
          b === 0
            ? {
                type: "heading",
                attrs: { level: 2 },
                content: [{ type: "text", text: `Part ${n}` }],
              }
            : para(text(n)),
        );
      }
      return { type: "section", attrs: { align: "top", background: "none" }, content };
    }),
  );
}

test("a document at the caps saves in under 1 s and its published page answers in under 500 ms", async ({
  page,
}) => {
  const atTheCaps = documentAtTheCaps();
  const { id, textbox } = await openSeeded(page, "page", "At The Caps", atTheCaps);
  await expect(textbox.locator('[data-node="section"]')).toHaveCount(30);
  await textbox.getByText("Part 1", { exact: true }).click();
  await page.keyboard.press("End");
  await page.keyboard.type(" edited");

  const response = page.waitForResponse((r) => r.request().method() === "POST");
  const started = Date.now();
  await page.getByRole("button", { name: "Save draft" }).click();
  expect((await response).ok()).toBe(true);
  const saveMs = Date.now() - started;
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  const stored = await storedEntry(id);
  expect(stored.version).toBe(2);
  expect((stored.blocks as { content: unknown[] }).content).toHaveLength(30);

  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page).toHaveURL(/\/admin\/pages\?/);

  const timings: number[] = [];
  for (let i = 0; i < 5; i++) {
    const before = Date.now();
    const published = await page.request.get("/at-the-caps");
    expect(published.status()).toBe(200);
    expect(await published.text()).toContain("Part 1 edited");
    timings.push(Date.now() - before);
  }
  console.log(`At the caps: save ${saveMs} ms; published page ${timings.join(", ")} ms`);
  expect(saveMs).toBeLessThan(1000);
  expect(Math.max(...timings)).toBeLessThan(500);
});

test("the Text style select keeps focus while arrow keys step through its styles (F-153)", async ({
  page,
}) => {
  const { textbox } = await openSeeded(page, "page", "Keyboard Style Page");
  const textStyle = page.getByLabel("Text style");

  await textbox.getByText("Start here.").click();
  await settle(page);
  await textStyle.focus();

  // With the select closed, Chromium fires `change` on each arrow key.
  for (const level of [2, 3, 4]) {
    await page.keyboard.press("ArrowDown");
    await expect(textStyle).toBeFocused();
    await expect(textbox.getByRole("heading", { level, name: "Start here." })).toBeVisible();
  }
});

test("content the editor cannot read is not saved over (F-154)", async ({ page }) => {
  const unknownNode = {
    type: "doc",
    content: [
      {
        type: "section",
        attrs: { align: "top", background: "none" },
        content: [
          {
            type: "column",
            content: [
              { type: "paragraph", content: [{ type: "text", text: "Keep me." }] },
              // Not a node of the v4 contract (an image became one in 14a2).
              { type: "video", attrs: { src: "x" } },
            ],
          },
        ],
      },
    ],
  };
  const { id } = await openSeeded(page, "page", "Unreadable Page", unknownNode);
  const before = await storedEntry(id);

  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("The editor's content could not be read.")).toBeVisible();

  const after = await storedEntry(id);
  expect(after.version).toBe(before.version);
  expect(after.blocks).toEqual(before.blocks);
});

test("a re-render of the entry form never hands the editor new options (F-158)", async ({
  page,
}) => {
  const { textbox } = await openSeeded(page, "post", "Options Post");
  // TipTap sets `editor` on the writing area; count each setOptions call.
  await textbox.evaluate((dom) => {
    const instance = (dom as unknown as { editor: { setOptions: (o: unknown) => void } }).editor;
    const original = instance.setOptions.bind(instance);
    const calls = { count: 0 };
    (globalThis as unknown as { setOptionsCalls: { count: number } }).setOptionsCalls = calls;
    instance.setOptions = (options) => {
      calls.count += 1;
      original(options);
    };
  });
  // Typing in the title flips the form's unsaved state, which re-renders it
  // and the editor inside it.
  await page.getByRole("textbox", { name: "Title" }).fill("Options Post, edited");
  await expect(page.getByText("Not saved yet", { exact: true })).toBeVisible();
  await settle(page);
  const count = await page.evaluate(
    () => (globalThis as unknown as { setOptionsCalls: { count: number } }).setOptionsCalls.count,
  );
  expect(count).toBe(0);
});

// ---- Item 14a2, step 3: image, button, line and space on the canvas ---------

/** A page holding an image, a button, a line, a space and an image whose media row is gone. */
async function openWithFourBlocks(page: Page) {
  const present = await insertTestMediaRow({ uploadedBy: editor.email, altText: "A red door" });
  const gone = await insertTestMediaRow({ uploadedBy: editor.email, altText: "Lost picture" });
  seededMedia.push(present, gone);
  const blocks = [
    { type: "paragraph", content: [{ type: "text", text: "Before the blocks." }] },
    imageBlock(present),
    buttonBlock("Book now", "/about", "outline"),
    lineBlock(),
    spaceBlock(),
    imageBlock(gone),
  ];
  const seeded = inSection(...blocks);
  const { id, textbox } = await (async () => {
    const entryId = await createDraftFor(
      editor.email,
      `Blocks Page ${randomInt(1_000_000)}`,
      seeded,
      { type: "page" },
    );
    await deleteTestMedia(gone);
    await logIn(page, editor);
    await page.goto(`/admin/pages/${entryId}`);
    const box = page.getByRole("textbox", { name: "Page content" });
    await expect(box).toBeVisible();
    return { id: entryId, textbox: box };
  })();
  return { id, textbox, blocks };
}

test("an image, a button, a line, a space and a deleted image are all drawn in the canvas", async ({
  page,
}) => {
  const { textbox } = await openWithFourBlocks(page);
  await expect(textbox.getByRole("img", { name: "A red door" })).toBeVisible();
  await expect(textbox.getByText("Book now", { exact: true })).toBeVisible();
  await expect(textbox.getByRole("separator")).toBeVisible();
  await expect(textbox.locator('[data-node="space"]')).toBeVisible();
  await expect(textbox.getByText("This image is no longer available.")).toBeVisible();
  // Nothing interactive sits inside the writing area (D169); it stays the
  // only content textbox.
  await expect(textbox.getByRole("textbox")).toHaveCount(0);
  await expect(textbox.getByRole("link")).toHaveCount(0);
  await expect(textbox.getByRole("button")).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: /content$/ })).toHaveCount(1);
});

test("clicking the line then Backspace removes it, and Ctrl+Z restores it", async ({ page }) => {
  const { textbox } = await openWithFourBlocks(page);
  const line = textbox.getByRole("separator");
  await line.click();
  await settle(page);
  await page.keyboard.press("Backspace");
  await expect(textbox.getByRole("separator")).toHaveCount(0);
  await expect(textbox.getByText("Book now", { exact: true })).toBeVisible();
  await page.keyboard.press("Control+z");
  await expect(textbox.getByRole("separator")).toBeVisible();
});

test("Save then reload keeps every attr of the four blocks, and stores nothing else", async ({
  page,
}) => {
  const { id, textbox, blocks } = await openWithFourBlocks(page);
  await save(page);
  const stored = await storedEntry(id);
  expect(contractViolations(stored.blocks)).toEqual([]);
  expect(firstColumn(stored.blocks)).toEqual(blocks);

  await page.reload();
  await expect(textbox).toBeVisible();
  await expect(textbox.getByRole("img", { name: "A red door" })).toBeVisible();
  await expect(textbox.getByText("Book now", { exact: true })).toBeVisible();
  await expect(textbox.getByRole("separator")).toBeVisible();
  await expect(textbox.getByText("This image is no longer available.")).toBeVisible();
});

test("an insert the editor refuses after it has loaded does not lock Save (F-154 follow-up)", async ({
  page,
}) => {
  const { id, textbox } = await openSeeded(page, "page", "Late Error Page");
  await textbox.evaluate((dom) => {
    const instance = (
      dom as unknown as {
        editor: { commands: { insertContent: (c: unknown, o?: unknown) => boolean } };
      }
    ).editor;
    // A node the schema does not have, once the stored document has loaded.
    instance.commands.insertContent({ type: "video" }, { errorOnInvalidContent: true });
  });
  await save(page);
  await expect(page.getByText("The editor's content could not be read.")).toHaveCount(0);
  expect((await storedEntry(id)).version).toBe(2);
});

// ---- Item 14a2, step 4: the palette and its keyboard path ---------------------

function palette(page: Page) {
  return page.getByRole("complementary", { name: "Add to the page" });
}

function tile(page: Page, name: string) {
  return palette(page).getByRole("button", { name, exact: true });
}

/** The column blocks' types, in order, of the section's column `index`, as stored. */
function columnTypes(stored: unknown, columnIndex: number): string[] {
  const column = (stored as { content: { content: { content: { type: string }[] }[] }[] })
    .content[0].content[columnIndex];
  return column.content.map((block) => block.type);
}

test("keyboard only: Tab to the Line tile, Enter - the line lands after the cursor's block, in column 2", async ({
  page,
}) => {
  const { id, textbox } = await openSeeded(
    page,
    "page",
    "Palette Keyboard",
    doc(section(["Alpha"], ["Beta", "Gamma"])),
  );
  await textbox.getByText("Gamma").click();
  await settle(page);

  // Shift+Tab walks back out of the writing area: the title, then the palette's
  // tiles from the last (Space) to Line.
  const line = tile(page, "Line");
  for (let presses = 0; presses < 3; presses++) await page.keyboard.press("Shift+Tab");
  await expect(line).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(textbox.getByRole("separator")).toBeVisible();
  await expect(textbox).toBeFocused();
  await save(page);
  const stored = (await storedEntry(id)).blocks;
  expect(columnTypes(stored, 0)).toEqual(["paragraph"]);
  expect(columnTypes(stored, 1)).toEqual(["paragraph", "paragraph", "horizontalRule"]);
});

test("Enter on the Text tile leaves the cursor in a new paragraph where typing lands", async ({
  page,
}) => {
  const { id, textbox } = await openSeeded(page, "page", "Palette Text");
  await textbox.getByText("Start here.").click();
  await settle(page);
  await tile(page, "Text").focus();
  await page.keyboard.press("Enter");
  await expect(textbox).toBeFocused();
  await page.keyboard.type("Typed after");
  await save(page);
  const stored = (await storedEntry(id)).blocks;
  expect(firstColumn(stored)).toEqual([para("Start here."), para("Typed after")]);
});

test("each tile adds its block after the one just added", async ({ page }) => {
  const { id, textbox } = await openSeeded(page, "page", "Palette Tiles");
  await textbox.getByText("Start here.").click();
  await settle(page);
  for (const name of ["Text", "Heading", "List", "Button", "Quote", "Line", "Space"]) {
    await tile(page, name).click();
  }
  await save(page);
  const stored = (await storedEntry(id)).blocks;
  expect(contractViolations(stored)).toEqual([]);
  expect(columnTypes(stored, 0)).toEqual([
    "paragraph",
    "paragraph",
    "heading",
    "bulletList",
    "button",
    "blockquote",
    "horizontalRule",
    "space",
  ]);
  expect((firstColumn(stored)[2] as { attrs: { level: number } }).attrs.level).toBe(2);
});

test("the Image tile adds an image with no file chosen, selected", async ({ page }) => {
  const { textbox } = await openSeeded(page, "page", "Palette Image");
  await textbox.getByText("Start here.").click();
  await settle(page);
  await tile(page, "Image").click();
  await expect(textbox.getByText("No image chosen")).toBeVisible();
  await expect(textbox).toBeFocused();
  // An atom becomes the selected node: Backspace removes it.
  await page.keyboard.press("Backspace");
  await expect(textbox.getByText("No image chosen")).toHaveCount(0);
});

test("one Ctrl+Z removes an added block", async ({ page }) => {
  const { textbox } = await openSeeded(page, "page", "Palette Undo");
  await textbox.getByText("Start here.").click();
  await settle(page);
  await tile(page, "Line").click();
  await expect(textbox.getByRole("separator")).toBeVisible();
  await page.keyboard.press("Control+z");
  await expect(textbox.getByRole("separator")).toHaveCount(0);
  await expect(textbox.getByText("Start here.")).toBeVisible();
});

test("inserting from inside a list item lands the block after the whole list", async ({ page }) => {
  const { id, textbox } = await openSeeded(
    page,
    "page",
    "Palette List",
    inSection(
      {
        type: "bulletList",
        content: [
          { type: "listItem", content: [para("One")] },
          { type: "listItem", content: [para("Two")] },
        ],
      },
      para("After"),
    ),
  );
  await textbox.getByText("One").click();
  await settle(page);
  await tile(page, "Line").click();
  await save(page);
  expect(columnTypes((await storedEntry(id)).blocks, 0)).toEqual([
    "bulletList",
    "horizontalRule",
    "paragraph",
  ]);
});

test("at 390px the palette is hidden, Add opens it in a dialog, a tile adds its block and closes it", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 800 });
  const { id, textbox } = await openSeeded(page, "page", "Palette Phone");
  await expect(palette(page)).toBeHidden();
  await textbox.getByText("Start here.").click();
  await settle(page);

  await page.getByRole("button", { name: "Add", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Blocks" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Close" })).toBeVisible();
  await dialog.getByRole("button", { name: "Line", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(textbox.getByRole("separator")).toBeVisible();
  await expect(textbox).toBeFocused();
  await save(page);
  expect(columnTypes((await storedEntry(id)).blocks, 0)).toEqual(["paragraph", "horizontalRule"]);
});

test("at 1280px there is no Add button", async ({ page }) => {
  await openSeeded(page, "page", "Palette Desktop");
  await expect(page.getByRole("button", { name: "Add", exact: true })).toBeHidden();
  await expect(palette(page)).toBeVisible();
});

test("a document of 200 blocks disables every tile and says why", async ({ page }) => {
  const { textbox } = await openSeeded(
    page,
    "page",
    "Palette Full",
    textDocument(...Array.from({ length: 200 }, (_, n) => `Block ${n + 1}`)),
  );
  await expect(textbox).toBeVisible();
  await expect(palette(page).getByText("You can have at most 200 blocks.")).toBeVisible();
  for (const name of ["Text", "Heading", "List", "Image", "Button", "Quote", "Line", "Space"]) {
    await expect(tile(page, name)).toBeDisabled();
  }
});

// ---- Item 14a2, step 6: the settings panel -----------------------------------

function settingsPanel(page: Page, name: string) {
  return page.getByRole("complementary", { name, exact: true });
}

/** Opens the picker from the panel and chooses the seeded row by its thumbnail's filename. */
async function pickImage(page: Page, buttonName: string, mediaId: string) {
  await settingsPanel(page, "Image").getByRole("button", { name: buttonName }).click();
  const picker = page.getByRole("dialog", { name: "Choose an image" });
  await expect(picker).toBeVisible();
  await picker.getByRole("button", { name: await testMediaFilename(mediaId) }).click();
  await expect(picker).toHaveCount(0);
}

async function seedMedia(altText: string) {
  const id = await insertTestMediaRow({ uploadedBy: editor.email, altText });
  seededMedia.push(id);
  return id;
}

test("settings panel: selecting an image opens it headed Image; text, line and space hide it", async ({
  page,
}) => {
  const { textbox } = await openWithFourBlocks(page);
  await expect(settingsPanel(page, "Image")).toHaveCount(0);
  await textbox.getByRole("img", { name: "A red door" }).click();
  await expect(settingsPanel(page, "Image")).toBeVisible();
  await expect(settingsPanel(page, "Image").getByRole("heading", { level: 2 })).toHaveText("Image");

  await textbox.getByText("Before the blocks.").click();
  await expect(settingsPanel(page, "Image")).toHaveCount(0);
  await textbox.getByRole("img", { name: "A red door" }).click();
  await expect(settingsPanel(page, "Image")).toBeVisible();
  await textbox.getByRole("separator").click();
  await expect(settingsPanel(page, "Image")).toHaveCount(0);
  await textbox.getByRole("img", { name: "A red door" }).click();
  await textbox.locator('[data-node="space"]').click();
  await expect(settingsPanel(page, "Image")).toHaveCount(0);
  // A button has its own panel (step 7), not the image's.
  await textbox.getByText("Book now", { exact: true }).click();
  await expect(settingsPanel(page, "Button")).toBeVisible();
  await expect(settingsPanel(page, "Image")).toHaveCount(0);
});

test("settings panel: Choose image on an empty image draws the pick, and Save stores its id", async ({
  page,
}) => {
  const { id, textbox } = await openSeeded(page, "page", "Choose Image Page");
  const media = await seedMedia("A blue boat");
  await textbox.getByText("Start here.").click();
  await settle(page);
  await tile(page, "Image").click();
  await expect(settingsPanel(page, "Image")).toBeVisible();
  await expect(
    settingsPanel(page, "Image").getByRole("button", { name: "Replace image" }),
  ).toHaveCount(0);

  await pickImage(page, "Choose image", media);
  await expect(textbox.getByRole("img", { name: "A blue boat" })).toBeVisible();
  // The panel stays, now offering Replace, with the alt text read-only.
  const panel = settingsPanel(page, "Image");
  await expect(panel.getByRole("button", { name: "Replace image" })).toBeVisible();
  await expect(panel.getByText("Alt text", { exact: true })).toBeVisible();
  await expect(panel.getByText("A blue boat", { exact: true })).toBeVisible();
  await expect(panel.getByText("Alt text is set when the image is uploaded.")).toBeVisible();
  await expect(panel.getByRole("textbox")).toHaveCount(0);

  await save(page);
  const blocks = firstColumn((await storedEntry(id)).blocks) as { type: string; attrs?: unknown }[];
  expect(blocks.map((block) => block.type)).toEqual(["paragraph", "image"]);
  expect(blocks[1].attrs).toEqual({ mediaId: media });
});

test("settings panel: Replace image swaps it, and one Ctrl+Z restores the first", async ({
  page,
}) => {
  const first = await seedMedia("The first picture");
  const second = await seedMedia("The second picture");
  const { id, textbox } = await openSeeded(
    page,
    "page",
    "Replace Image Page",
    inSection(imageBlock(first)),
  );
  await textbox.getByRole("img", { name: "The first picture" }).click();
  await pickImage(page, "Replace image", second);
  await expect(textbox.getByRole("img", { name: "The second picture" })).toBeVisible();
  await expect(textbox.getByRole("img", { name: "The first picture" })).toHaveCount(0);
  // The image stays selected, so its panel is still there.
  await expect(settingsPanel(page, "Image")).toBeVisible();

  await textbox.focus();
  await page.keyboard.press("Control+z");
  await expect(textbox.getByRole("img", { name: "The first picture" })).toBeVisible();
  await expect(textbox.getByRole("img", { name: "The second picture" })).toHaveCount(0);

  await save(page);
  expect(firstColumn((await storedEntry(id)).blocks)).toEqual([imageBlock(first)]);
});

test("settings panel: a deleted image's panel offers Replace image, and the swap clears the message", async ({
  page,
}) => {
  const { textbox } = await openWithFourBlocks(page);
  const replacement = await seedMedia("A fresh picture");
  const message = "This image is no longer available.";
  await textbox.getByText(message).click();
  const panel = settingsPanel(page, "Image");
  await expect(panel.getByText(message)).toBeVisible();
  await expect(panel.getByRole("button", { name: "Choose image" })).toHaveCount(0);

  await pickImage(page, "Replace image", replacement);
  await expect(textbox.getByRole("img", { name: "A fresh picture" })).toBeVisible();
  await expect(panel.getByText(message)).toHaveCount(0);
  await expect(textbox.getByText(message)).toHaveCount(0);
});

test("settings panel: the chip's Section settings opens Section 2, and the chip no longer holds Columns", async ({
  page,
}) => {
  const { textbox } = await openSeeded(
    page,
    "page",
    "Section Panel Page",
    doc(section(["One"]), section(["Two"])),
  );
  await textbox.getByText("Two").click();
  await expect(chip(page, "Section 2 of 2").getByLabel("Columns")).toHaveCount(0);
  await expect(
    chip(page, "Section 2 of 2").getByRole("button", { name: "Remove section" }),
  ).toBeVisible();
  await expect(page.getByRole("complementary", { name: /^Section/ })).toHaveCount(0);
  const panel = await openSectionSettings(page, "Section 2");
  await expect(panel.getByRole("heading", { level: 2 })).toHaveText("Section 2");
  // Moving the cursor to another section hides it.
  await textbox.getByText("One").click();
  await expect(page.getByRole("complementary", { name: /^Section/ })).toHaveCount(0);
});

test("settings panel: Section settings opens the section's panel when its first block is a selected image (F-166)", async ({
  page,
}) => {
  const media = await seedMedia("A green gate");
  const imageFirst = {
    type: "section",
    attrs: { align: "top", background: "none" },
    content: [{ type: "column", content: [imageBlock(media), para("After the gate")] }],
  };
  const { textbox } = await openSeeded(
    page,
    "page",
    "Image First Section Page",
    doc(section(["One"]), imageFirst),
  );
  await textbox.getByRole("img", { name: "A green gate" }).click();
  await expect(settingsPanel(page, "Image")).toBeVisible();
  await chip(page, "Section 2 of 2").getByRole("button", { name: "Section settings" }).click();
  const panel = settingsPanel(page, "Section 2");
  await expect(panel).toBeVisible();
  await expect(settingsPanel(page, "Image")).toHaveCount(0);
  await expect(panel.getByLabel("Columns")).toBeVisible();
  await panel.getByLabel("Columns").selectOption("2");
  await expect(settingsPanel(page, "Section 2").getByLabel("Columns")).toHaveValue("2");
});

test("settings panel: Section settings opens the panel of a section holding only an image (F-166)", async ({
  page,
}) => {
  const media = await seedMedia("A lone gate");
  const { textbox } = await openSeeded(
    page,
    "page",
    "Image Only Section Page",
    doc({
      type: "section",
      attrs: { align: "top", background: "none" },
      content: [{ type: "column", content: [imageBlock(media)] }],
    }),
  );
  await textbox.getByRole("img", { name: "A lone gate" }).click();
  await chip(page, "Section 1 of 1").getByRole("button", { name: "Section settings" }).click();
  const panel = settingsPanel(page, "Section 1");
  await expect(panel).toBeVisible();
  await expect(panel.getByLabel("Columns")).toBeVisible();
});

test("settings panel: Close settings and Escape on a section panel opened over an image leave no panel (F-176)", async ({
  page,
}) => {
  const media = await seedMedia("A closed gate");
  const { textbox } = await openSeeded(
    page,
    "page",
    "Close Over Image Page",
    doc(
      {
        type: "section",
        attrs: { align: "top", background: "none" },
        content: [{ type: "column", content: [imageBlock(media)] }],
      },
      section(["Elsewhere"]),
    ),
  );
  const image = textbox.getByRole("img", { name: "A closed gate" });
  const noPanel = async () => {
    await expect(settingsPanel(page, "Image")).toHaveCount(0);
    await expect(settingsPanel(page, "Section 1")).toHaveCount(0);
  };

  await image.click();
  await openSectionSettings(page, "Section 1");
  await page.getByRole("button", { name: "Close settings" }).click();
  await noPanel();
  await expect(textbox).toBeFocused();

  // Selecting the image again brings its panel back; the gear, then Escape.
  await textbox.getByText("Elsewhere").click();
  await image.click();
  await expect(settingsPanel(page, "Image")).toBeVisible();
  const panel = await openSectionSettings(page, "Section 1");
  await panel.getByLabel("Columns").focus();
  await page.keyboard.press("Escape");
  await noPanel();
  await expect(textbox).toBeFocused();
});

test("settings panel: reducing Columns with the image in a removed column selected keeps the section panel and its focus (F-177)", async ({
  page,
}) => {
  const media = await seedMedia("A moved gate");
  const { textbox } = await openSeeded(
    page,
    "page",
    "Reduce Columns Image Page",
    doc({
      type: "section",
      attrs: { align: "top", background: "none" },
      content: [
        { type: "column", content: [para("Left words")] },
        { type: "column", content: [imageBlock(media)] },
      ],
    }),
  );
  await textbox.getByRole("img", { name: "A moved gate" }).click();
  const panel = await openSectionSettings(page, "Section 1");
  await panel.getByLabel("Columns").selectOption("1");
  await expect(settingsPanel(page, "Section 1")).toBeVisible();
  await expect(settingsPanel(page, "Image")).toHaveCount(0);
  await expect(settingsPanel(page, "Section 1").getByLabel("Columns")).toBeFocused();
  await expect(settingsPanel(page, "Section 1").getByLabel("Columns")).toHaveValue("1");
  // Both blocks are now in the one column.
  await expect(textbox.locator('[data-node="column"]')).toHaveCount(1);
  await expect(textbox.locator('[data-node="column"]').getByText("Left words")).toBeVisible();
  await expect(
    textbox.locator('[data-node="column"]').getByRole("img", { name: "A moved gate" }),
  ).toBeVisible();
});

test("settings panel: a text cursor moved by reducing Columns does not swallow the next selection - Close, then an image elsewhere (F-179)", async ({
  page,
}) => {
  const media = await seedMedia("A later gate");
  const { textbox } = await openSeeded(
    page,
    "page",
    "Cursor Moved Close Page",
    doc(section(["Left words"], ["Right words"]), {
      type: "section",
      attrs: { align: "top", background: "none" },
      content: [{ type: "column", content: [imageBlock(media)] }],
    }),
  );
  await textbox.getByText("Right words").click();
  const panel = await openSectionSettings(page, "Section 1");
  await panel.getByLabel("Columns").selectOption("1");
  await expect(settingsPanel(page, "Section 1").getByLabel("Columns")).toHaveValue("1");
  await page.getByRole("button", { name: "Close settings" }).click();
  await expect(settingsPanel(page, "Section 1")).toHaveCount(0);
  await textbox.getByRole("img", { name: "A later gate" }).click();
  await expect(settingsPanel(page, "Image")).toBeVisible();
});

test("settings panel: a text cursor moved by reducing Columns does not swallow the next selection - an image in the same section (F-179)", async ({
  page,
}) => {
  const media = await seedMedia("A kept gate");
  const { textbox } = await openSeeded(
    page,
    "page",
    "Cursor Moved Same Section Page",
    doc({
      type: "section",
      attrs: { align: "top", background: "none" },
      content: [
        { type: "column", content: [para("Left words"), imageBlock(media)] },
        { type: "column", content: [para("Right words")] },
      ],
    }),
  );
  await textbox.getByText("Right words").click();
  const panel = await openSectionSettings(page, "Section 1");
  await panel.getByLabel("Columns").selectOption("1");
  await expect(settingsPanel(page, "Section 1").getByLabel("Columns")).toHaveValue("1");
  await textbox.getByRole("img", { name: "A kept gate" }).click();
  await expect(settingsPanel(page, "Image")).toBeVisible();
  await expect(settingsPanel(page, "Section 1")).toHaveCount(0);
});

test("settings panel: Escape closes it with focus in the writing area, and Close settings does too", async ({
  page,
}) => {
  const { textbox } = await openSeeded(page, "page", "Escape Panel Page");
  await textbox.getByText("Start here.").click();
  const panel = await openSectionSettings(page, "Section 1");
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(textbox).toBeFocused();

  // Pressing Section settings again brings it back.
  await openSectionSettings(page, "Section 1");
  await page.getByRole("button", { name: "Close settings" }).click();
  await expect(panel).toHaveCount(0);
  await expect(textbox).toBeFocused();
});

test("settings panel: Escape and Close settings hide an image's panel until the image is selected again", async ({
  page,
}) => {
  const { textbox } = await openWithFourBlocks(page);
  const image = textbox.getByRole("img", { name: "A red door" });
  await image.click();
  await settingsPanel(page, "Image").getByRole("button", { name: "Close settings" }).focus();
  await page.keyboard.press("Escape");
  await expect(settingsPanel(page, "Image")).toHaveCount(0);
  await expect(textbox).toBeFocused();

  await textbox.getByText("Before the blocks.").click();
  await image.click();
  await expect(settingsPanel(page, "Image")).toBeVisible();
  await page.getByRole("button", { name: "Close settings" }).click();
  await expect(settingsPanel(page, "Image")).toHaveCount(0);
  await expect(textbox).toBeFocused();
});

test("settings panel: at 390px it is a bottom sheet that leaves the selected image visible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 800 });
  const { textbox } = await openWithFourBlocks(page);
  const image = textbox.getByRole("img", { name: "A red door" });
  await image.click();
  const panel = settingsPanel(page, "Image");
  await expect(panel).toBeVisible();

  await expect
    .poll(async () => {
      const sheet = await panel.boundingBox();
      const picture = await image.boundingBox();
      if (!sheet || !picture) return false;
      return (
        picture.y >= 0 &&
        picture.y + picture.height <= sheet.y + 1 &&
        sheet.y + sheet.height <= 800 + 1 &&
        sheet.height <= 800 * 0.45 + 1
      );
    })
    .toBe(true);
  // Fixed to the bottom edge.
  const sheet = await panel.boundingBox();
  expect(Math.round((sheet?.y ?? 0) + (sheet?.height ?? 0))).toBe(800);
});

test("settings panel: the writing area is still the only content textbox, and the panel holds none", async ({
  page,
}) => {
  const { textbox } = await openWithFourBlocks(page);
  await textbox.getByRole("img", { name: "A red door" }).click();
  const panel = settingsPanel(page, "Image");
  await expect(panel).toBeVisible();
  // The page holds two textboxes: the Title input and the writing area.
  await expect(page.getByRole("textbox")).toHaveCount(2);
  await expect(page.getByRole("textbox", { name: /content$/ })).toHaveCount(1);
  await expect(panel.getByRole("textbox")).toHaveCount(0);
  await expect(textbox.getByRole("textbox")).toHaveCount(0);
  await expect(textbox.getByRole("button")).toHaveCount(0);
});

// ---- Item 14a2, step 7: the button's settings ---------------------------------

function buttonPanel(page: Page) {
  return settingsPanel(page, "Button");
}

/** A page to link to; its address is the slug the seed helper derives from the title. */
async function seedTarget(status: "draft" | "published" = "published") {
  const title = `Target ${randomInt(1_000_000)}`;
  await createDraftFor(editor.email, title, startDocument, { type: "page", status });
  return { title, slug: title.toLowerCase().replace(/[^a-z0-9]+/g, "-") };
}

/** A page holding one button, opened in the editor with that button selected. */
async function openWithButton(
  page: Page,
  attrs: { label?: string; href?: string; style?: "filled" | "outline" } = {},
  status: "draft" | "published" = "draft",
) {
  const label = attrs.label ?? "Seeded";
  const title = `Button Host ${randomInt(1_000_000)}`;
  const id = await createDraftFor(
    editor.email,
    title,
    inSection(buttonBlock(label, attrs.href ?? "", attrs.style ?? "filled")),
    { type: "page", status },
  );
  await logIn(page, editor);
  await page.goto(`/admin/pages/${id}`);
  const textbox = page.getByRole("textbox", { name: "Page content" });
  await expect(textbox).toBeVisible();
  await textbox.locator('[data-node="button"]').click();
  await expect(buttonPanel(page)).toBeVisible();
  return { id, title, slug: title.toLowerCase().replace(/[^a-z0-9]+/g, "-"), textbox };
}

function storedButton(stored: unknown) {
  return firstColumn(stored).find((node) => (node as { type: string }).type === "button") as {
    attrs: { label: string; href: string; style: string };
  };
}

const UNSAFE_MESSAGE = /This address cannot be used\./;

test("button: add one from the palette, type its text, choose a page, Publish - the public page links to it", async ({
  page,
}) => {
  const target = await seedTarget();
  const { textbox } = await openSeeded(page, "page", "Button Journey Host");
  await textbox.getByText("Start here.").click();
  await settle(page);
  await tile(page, "Button").click();
  await expect(buttonPanel(page)).toBeVisible();
  await expect(buttonPanel(page).getByRole("heading", { level: 2 })).toHaveText("Button");
  await expect(textbox.getByText("Button text", { exact: true })).toBeVisible();

  // Key by key: each keystroke is a transaction, and the caret must stay at the end.
  await buttonPanel(page).getByLabel("Button text").pressSequentially("Book now");
  await expect(buttonPanel(page).getByLabel("Button text")).toHaveValue("Book now");
  await expect(textbox.getByText("Book now", { exact: true })).toBeVisible();
  const goesTo = buttonPanel(page).getByLabel("Goes to");
  await expect(goesTo.locator("option:checked")).toHaveText("Choose where it goes");
  await goesTo.selectOption({ label: target.title });

  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page).toHaveURL(/\/admin\/pages\?/);
  await page.goto("/button-journey-host");
  const link = page.getByRole("main").getByRole("link", { name: "Book now" });
  await expect(link).toHaveAttribute("href", `/${target.slug}`);
});

test("button: a draft page is offered as 'Title (not published)'; a published one by its title", async ({
  page,
}) => {
  const draft = await seedTarget("draft");
  const published = await seedTarget("published");
  await openWithButton(page);
  const goesTo = buttonPanel(page).getByLabel("Goes to");
  await expect(goesTo.getByRole("option", { name: `${draft.title} (not published)` })).toHaveCount(
    1,
  );
  await expect(goesTo.getByRole("option", { name: published.title, exact: true })).toHaveCount(1);
  await expect(goesTo.getByRole("option", { name: "A web address…" })).toHaveCount(1);
  await expect(goesTo.getByRole("option", { name: "An email address…" })).toHaveCount(1);
});

test("button: an unsafe web address is refused beside its field and never stored", async ({
  page,
}) => {
  const { id } = await openWithButton(page, { href: "/about" });
  const panel = buttonPanel(page);
  await panel.getByLabel("Goes to").selectOption({ label: "A web address…" });
  const field = panel.getByLabel("Web address");
  await field.fill("javascript:alert(1)");
  // Not on each keystroke: nothing is said until Enter or leaving the field.
  await expect(panel.getByText(UNSAFE_MESSAGE)).toHaveCount(0);
  await field.press("Enter");
  await expect(panel.getByText(UNSAFE_MESSAGE)).toBeVisible();
  await expect(field).toHaveAttribute("aria-invalid", "true");
  const describedBy = await field.getAttribute("aria-describedby");
  await expect(page.locator(`[id="${describedBy}"]`)).toHaveText(UNSAFE_MESSAGE);
  // Enter did not submit the entry form.
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();

  // Typing again clears the message; leaving the field with a bad value shows it again.
  await field.fill("data:text/html,x");
  await expect(panel.getByText(UNSAFE_MESSAGE)).toHaveCount(0);
  await panel.getByLabel("Button text").focus();
  await expect(panel.getByText(UNSAFE_MESSAGE)).toBeVisible();

  await save(page);
  expect(storedButton((await storedEntry(id)).blocks).attrs.href).toBe("/about");
});

test("button: a safe web address is stored as typed", async ({ page }) => {
  const { id } = await openWithButton(page);
  const panel = buttonPanel(page);
  await panel.getByLabel("Goes to").selectOption({ label: "A web address…" });
  await panel.getByLabel("Web address").fill("https://example.com/book");
  await panel.getByLabel("Web address").press("Enter");
  await expect(panel.getByText(UNSAFE_MESSAGE)).toHaveCount(0);
  await save(page);
  expect(storedButton((await storedEntry(id)).blocks).attrs.href).toBe("https://example.com/book");
});

test("button: an email address is stored as mailto:, and one without @ is refused", async ({
  page,
}) => {
  const { id } = await openWithButton(page);
  const panel = buttonPanel(page);
  await panel.getByLabel("Goes to").selectOption({ label: "An email address…" });
  const field = panel.getByLabel("Email address");
  await field.fill("not an address");
  await field.press("Enter");
  await expect(field).toHaveAttribute("aria-invalid", "true");
  await expect(panel.getByText(UNSAFE_MESSAGE)).toBeVisible();
  await field.fill("hello@example.com");
  await field.press("Enter");
  await expect(field).not.toHaveAttribute("aria-invalid", "true");
  await save(page);
  expect(storedButton((await storedEntry(id)).blocks).attrs.href).toBe("mailto:hello@example.com");
});

test("button: Outline draws the outline in the canvas and on the public page", async ({ page }) => {
  const { slug, textbox } = await openWithButton(page, { href: "/about" }, "published");
  const canvasButton = textbox.locator('[data-node="button"]');
  const backgroundOf = (locator: Locator) =>
    locator.evaluate(
      (element) => element.ownerDocument.defaultView?.getComputedStyle(element).backgroundColor,
    );
  expect(await backgroundOf(canvasButton)).not.toBe("rgba(0, 0, 0, 0)");

  const style = buttonPanel(page).getByRole("group", { name: "Style" });
  await expect(style.getByRole("radio", { name: "Filled" })).toBeChecked();
  await style.getByRole("radio", { name: "Outline" }).check();
  await expect(style.getByRole("radio", { name: "Outline" })).toBeChecked();
  expect(await backgroundOf(canvasButton)).toBe("rgba(0, 0, 0, 0)");

  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await page.goto(`/${slug}`);
  const link = page.getByRole("main").getByRole("link", { name: "Seeded" });
  expect(await backgroundOf(link)).toBe("rgba(0, 0, 0, 0)");
});

test("button: reopening the panel shows the stored page, web address and email", async ({
  page,
}) => {
  const target = await seedTarget();
  const draft = await seedTarget("draft");
  const buttons = [
    buttonBlock("To page", `/${target.slug}`, "filled"),
    buttonBlock("To draft", `/${draft.slug}`, "filled"),
    buttonBlock("To web", "https://example.com/x", "outline"),
    buttonBlock("To email", "mailto:a@example.com", "filled"),
    buttonBlock("To nowhere", "", "filled"),
  ];
  const id = await createDraftFor(editor.email, "Reopen Host", inSection(...buttons), {
    type: "page",
  });
  await logIn(page, editor);
  await page.goto(`/admin/pages/${id}`);
  const textbox = page.getByRole("textbox", { name: "Page content" });
  await expect(textbox).toBeVisible();
  const panel = buttonPanel(page);
  const goesTo = panel.getByLabel("Goes to");
  const chosen = goesTo.locator("option:checked");

  async function open(label: string) {
    // Selecting a button, then another, closes and reopens the panel.
    await textbox.getByText(label, { exact: true }).click();
    await expect(panel.getByLabel("Button text")).toHaveValue(label);
  }

  await open("To page");
  await expect(chosen).toHaveText(target.title);
  await open("To draft");
  await expect(chosen).toHaveText(`${draft.title} (not published)`);
  await open("To web");
  await expect(chosen).toHaveText("A web address…");
  await expect(panel.getByLabel("Web address")).toHaveValue("https://example.com/x");
  await expect(panel.getByRole("radio", { name: "Outline" })).toBeChecked();
  await open("To email");
  await expect(chosen).toHaveText("An email address…");
  await expect(panel.getByLabel("Email address")).toHaveValue("a@example.com");
  await open("To nowhere");
  await expect(chosen).toHaveText("Choose where it goes");
  await expect(panel.getByLabel("Web address")).toHaveCount(0);
  await expect(panel.getByLabel("Email address")).toHaveCount(0);

  // Escape closes the panel.
  await textbox.getByText("To page", { exact: true }).click();
  await expect(panel.getByLabel("Button text")).toHaveValue("To page");
  await panel.getByLabel("Button text").focus();
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(textbox).toBeFocused();
});

// Journey 2 (design.md, *Edit and publish*), the button's part: Pages -> open a
// page -> add a Button from the palette -> set it -> Publish -> the public page
// links to it, and the link works. Opened once by a full page load, once by the
// admin's own links; the public page is reached both ways too.
for (const arrival of ["a full page load", "the admin's own links"] as const) {
  test(`Journey 2: open a page by ${arrival}, add a Button, Publish, and the public page shows its link`, async ({
    page,
  }) => {
    const target = await seedTarget();
    const title = `Button Trip ${randomInt(1_000_000)}`;
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const id = await createDraftFor(editor.email, title, startDocument, { type: "page" });
    await logIn(page, editor);
    if (arrival === "a full page load") {
      await page.goto("/admin/pages");
    } else {
      await page.goto("/admin");
      await page.getByRole("link", { name: "Pages", exact: true }).click();
    }
    await expect(page).toHaveURL(/\/admin\/pages$/);
    await page.getByRole("link", { name: title, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/pages/${id}$`));

    const textbox = page.getByRole("textbox", { name: "Page content" });
    await textbox.getByText("Start here.").click();
    await settle(page);
    await tile(page, "Button").click();
    await buttonPanel(page).getByLabel("Button text").fill("Book now");
    await buttonPanel(page).getByLabel("Goes to").selectOption({ label: target.title });
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page).toHaveURL(/\/admin\/pages\?/);

    await page.goto(`/${slug}`);
    const link = page.getByRole("main").getByRole("link", { name: "Book now" });
    await expect(link).toHaveAttribute("href", `/${target.slug}`);
    // And through the site's own link: it leads to the page it names.
    await link.click();
    await expect(page).toHaveURL(new RegExp(`/${target.slug}$`));
    await expect(page.getByRole("main").getByText("Start here.")).toBeVisible();
  });
}
