import { randomInt } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import { logIn } from "./helpers/auth.ts";
import { imageBlock, lineBlock, type TestNode } from "./helpers/documents.ts";
import { deleteTestMedia, insertTestMediaRow } from "./helpers/media.ts";
import {
  createAdmin,
  createDraftFor,
  deleteEntriesBy,
  deleteTestUser,
  setRole,
  storedEntry,
  type TestUser,
} from "./helpers/users.ts";

// Item 14a3: the selected block's ring and toolbar - Move up, Move down and
// Delete, announced in a polite status region - and the hint an untouched
// column shows in a section of two or three columns.

let editor: TestUser;
// The admin's Content-Security-Policy is not loosened for the toolbar: anything
// it refuses while the editor runs fails the test (Chromium logs each refusal).
let refusedByPolicy: string[];

test.beforeEach(async ({ page }) => {
  refusedByPolicy = [];
  page.on("console", (message) => {
    if (message.text().includes("Content Security Policy")) refusedByPolicy.push(message.text());
  });
  await page.setExtraHTTPHeaders({
    "X-Forwarded-For": `10.${randomInt(256)}.${randomInt(256)}.16`,
  });
  editor = createAdmin("Toolbar Writer");
  await setRole(editor.email, "editor");
});

test.afterEach(async () => {
  await deleteEntriesBy(editor.email);
  await deleteTestUser(editor.email);
  expect(refusedByPolicy).toEqual([]);
});

const HINT = "Empty column - add a block or change Columns in Section settings.";

function text(value: string): TestNode {
  return { type: "paragraph", content: [{ type: "text", text: value }] };
}

/** A section of these columns, each a list of blocks (a string is a paragraph). */
function section(...columns: (TestNode | string)[][]): TestNode {
  return {
    type: "section",
    attrs: { align: "top", background: "none" },
    content: columns.map((blocks) => ({
      type: "column",
      content: blocks.map((block) => (typeof block === "string" ? text(block) : block)),
    })),
  };
}

function doc(...sections: TestNode[]): TestNode {
  return { type: "doc", content: sections };
}

const EMPTY = { type: "paragraph" };

async function openPage(page: Page, title: string, document: TestNode, published = false) {
  const id = await createDraftFor(editor.email, title, document, {
    type: "page",
    status: published ? "published" : "draft",
  });
  await logIn(page, editor);
  await page.goto(`/admin/pages/${id}`);
  const textbox = page.getByRole("textbox", { name: "Page content" });
  await expect(textbox).toBeVisible();
  return { id, textbox };
}

/** Lets the editor read a caret the browser moved itself (see document-editor.spec.ts). */
async function settle(page: Page) {
  await page.evaluate("new Promise((done) => requestAnimationFrame(() => setTimeout(done)))");
}

/** The canvas's sections, as the texts of each column's blocks. */
async function canvasShape(page: Page) {
  return page.evaluate(`[...document.querySelectorAll('[role="textbox"] [data-node="section"]')].map(
    (section) => [...section.querySelectorAll('[data-node="column"]')].map(
      (column) => [...column.children].map((block) => block.textContent),
    ),
  )`);
}

/** The text of the block holding the browser's caret. */
async function caretBlockText(page: Page) {
  return page.evaluate(`(() => {
    let node = window.getSelection().anchorNode;
    while (node && !(node.parentElement && node.parentElement.dataset.node === "column")) node = node.parentNode;
    return node ? node.textContent : null;
  })()`);
}

async function save(page: Page) {
  const saved = page.waitForResponse((response) => response.request().method() === "POST");
  await page.getByRole("button", { name: "Save draft" }).click();
  expect((await saved).ok()).toBe(true);
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
}

test("keyboard only: Move down twice crosses into the next column, announced, and one Ctrl+Z undoes one move", async ({
  page,
}) => {
  const { id, textbox } = await openPage(
    page,
    "Moving Page",
    doc(section(["A", "B"], ["C"]), section(["D"])),
  );
  await textbox.getByText("A", { exact: true }).click();
  await settle(page);
  await page.keyboard.press("End");
  await settle(page);

  await page.keyboard.press("Tab");
  const toolbar = page.getByRole("toolbar", { name: "Text" });
  const moveUp = toolbar.getByRole("button", { name: "Move up" });
  const moveDown = toolbar.getByRole("button", { name: "Move down" });
  await expect(moveUp).toBeFocused();
  // Nothing is above A: the button says so and does nothing, and keeps focus.
  await expect(moveUp).toHaveAttribute("aria-disabled", "true");
  await page.keyboard.press("Enter");
  expect(await canvasShape(page)).toEqual([[["A", "B"], ["C"]], [["D"]]]);
  await expect(moveUp).toBeFocused();

  await page.keyboard.press("ArrowRight");
  await expect(moveDown).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toHaveText(
    "Text moved down: block 2 of 2 in column 1 of section 1.",
  );
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toHaveText(
    "Text moved down: block 1 of 2 in column 2 of section 1.",
  );
  await expect(moveDown).toBeFocused();
  expect(await canvasShape(page)).toEqual([[["B"], ["A", "C"]], [["D"]]]);

  // Escape returns to the writing area with the cursor where it was, then one
  // Ctrl+Z undoes one move.
  await page.keyboard.press("Escape");
  await expect(textbox).toBeFocused();
  expect(await caretBlockText(page)).toBe("A");
  await page.keyboard.press("ControlOrMeta+z");
  expect(await canvasShape(page)).toEqual([[["B", "A"], ["C"]], [["D"]]]);
  await page.keyboard.press("ControlOrMeta+Shift+z");

  await save(page);
  const stored = (await storedEntry(id)).blocks;
  expect(stored).toEqual(doc(section(["B"], ["A", "C"]), section(["D"])));
  // Nothing interactive was put inside the writing area.
  await expect(textbox.getByRole("toolbar")).toHaveCount(0);
  await expect(textbox.getByRole("textbox")).toHaveCount(0);
});

test("a selected line shows its ring and a Line toolbar; Delete removes it, announced, and Ctrl+Z restores it", async ({
  page,
}) => {
  const { textbox } = await openPage(
    page,
    "Line Page",
    doc(section(["Before", lineBlock(), "After"])),
  );
  const line = textbox.locator("hr");
  await line.click();
  const toolbar = page.getByRole("toolbar", { name: "Line" });
  await expect(toolbar).toBeVisible();
  await expect(line).toHaveCSS("outline-width", "2px");

  await page.keyboard.press("Tab");
  await page.keyboard.press("End");
  const remove = toolbar.getByRole("button", { name: "Delete line" });
  await expect(remove).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toHaveText("Line deleted.");
  await expect(textbox.locator("hr")).toHaveCount(0);
  await expect(textbox).toBeFocused();
  expect(await caretBlockText(page)).toBe("After");

  await page.keyboard.press("ControlOrMeta+z");
  await expect(textbox.locator("hr")).toHaveCount(1);
});

test("an untouched column of a two-column section shows the hint, in the editor only", async ({
  page,
}) => {
  const { textbox } = await openPage(
    page,
    "Hint Page",
    doc(section(["A"], ["B"]), section(["C"])),
    true,
  );
  const hinted = textbox.locator("[data-hint]");
  await expect(hinted).toHaveCount(0);

  // B, column 2's only block, moves up into column 1 and leaves the placeholder.
  await textbox.getByText("B", { exact: true }).click();
  await settle(page);
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  expect(await canvasShape(page)).toEqual([[["A", "B"], [""]], [["C"]]]);
  await expect(hinted).toHaveCount(1);
  await expect(hinted).toHaveAttribute("data-hint", HINT);
  // Run in the page, so written as source: these tests' types have no DOM.
  expect(
    await page.evaluate(
      `getComputedStyle(document.querySelector('[role="textbox"] [data-hint]'), "::before").content`,
    ),
  ).toBe(`"${HINT}"`);
  // The cursor is in B, not in the hinted column.
  await page.keyboard.press("Escape");
  expect(await caretBlockText(page)).toBe("B");
  await expect(hinted).toHaveCount(1);

  // Moving a block back in takes the placeholder's place, and the hint goes.
  await page.keyboard.press("Tab");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  expect(await canvasShape(page)).toEqual([[["A"], ["B"]], [["C"]]]);
  await expect(hinted).toHaveCount(0);

  // The public page draws nothing for an untouched column.
  const id = await createDraftFor(editor.email, "Public Hint", doc(section(["A"], [EMPTY])), {
    type: "page",
    status: "published",
  });
  expect(id).not.toBe("");
  await page.goto("/public-hint");
  await expect(page.getByText("A", { exact: true })).toBeVisible();
  await expect(page.getByText(HINT)).toHaveCount(0);
  await expect(page.locator("[data-hint]")).toHaveCount(0);
});

test("a one-column empty section shows the page's placeholder, not the hint", async ({ page }) => {
  const { textbox } = await openPage(page, "Empty Page", doc(section([EMPTY])));
  await expect(textbox.locator("[data-hint]")).toHaveCount(0);
  await expect(textbox.locator("p[data-placeholder]")).toHaveAttribute(
    "data-placeholder",
    "Write your page…",
  );
});

test("keyboard only: the Text style menu turns text into a Subheading and back, and arrows alone change nothing", async ({
  page,
}) => {
  const { id, textbox } = await openPage(page, "Style Page", doc(section(["Words"])));
  await textbox.getByText("Words", { exact: true }).click();
  await settle(page);
  await page.keyboard.press("Tab");
  const toolbar = page.getByRole("toolbar", { name: "Text" });
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  const styleButton = toolbar.getByRole("button", { name: "Text style: Text" });
  await expect(styleButton).toBeFocused();
  await expect(styleButton).toHaveAttribute("aria-haspopup", "menu");

  // Down opens the menu on the checked item.
  await page.keyboard.press("ArrowDown");
  const menu = page.getByRole("menu", { name: "Text style" });
  await expect(menu.getByRole("menuitemradio", { name: "Text", exact: true })).toBeFocused();
  await expect(menu.getByRole("menuitemradio", { checked: true })).toHaveText("Text");
  // F-153's concern, kept: moving through the styles changes nothing until one is chosen.
  // Text, Main heading (a page's), Heading, Subheading.
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await expect(menu.getByRole("menuitemradio", { name: "Subheading" })).toBeFocused();
  await expect(textbox.getByRole("heading")).toHaveCount(0);
  await page.keyboard.press("Enter");
  await expect(menu).toHaveCount(0);
  await expect(textbox).toBeFocused();
  await expect(textbox.getByRole("heading", { level: 3, name: "Words" })).toBeVisible();

  // Back again: Tab to the toolbar, which remembers the menu button.
  await page.keyboard.press("Tab");
  const subheadingButton = page
    .getByRole("toolbar", { name: "Subheading" })
    .getByRole("button", { name: "Text style: Subheading" });
  await expect(subheadingButton).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(menu.getByRole("menuitemradio", { checked: true })).toHaveText("Subheading");
  // Escape closes back to the button.
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(subheadingButton).toBeFocused();
  await page.keyboard.press(" ");
  await page.keyboard.press("Home");
  await page.keyboard.press("Enter");
  await expect(textbox.getByRole("heading")).toHaveCount(0);

  await page.keyboard.press("Tab");
  await expect(toolbar.getByRole("button", { name: "Text style: Text" })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(menu.getByRole("menuitemradio", { name: "Text", exact: true })).toBeFocused();
  await page.keyboard.press("End");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter");
  await save(page);
  expect((await storedEntry(id)).blocks).toEqual(
    doc(
      section([
        { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "Words" }] },
      ]),
    ),
  );
});

test("an image's toolbar has Move and Delete but no Text style", async ({ page }) => {
  const mediaId = await insertTestMediaRow({ uploadedBy: editor.email, altText: "A pier" });
  const { textbox } = await openPage(
    page,
    "Image Page",
    doc(section(["Above", imageBlock(mediaId)])),
  );
  await textbox.getByRole("img", { name: "A pier" }).click();
  const toolbar = page.getByRole("toolbar", { name: "Image" });
  await expect(toolbar.getByRole("button", { name: "Delete image" })).toBeVisible();
  await expect(toolbar.getByRole("button", { name: /^Text style/ })).toHaveCount(0);
  await expect(toolbar.getByRole("button", { name: "Bold" })).toHaveCount(0);
  await deleteEntriesBy(editor.email);
  await deleteTestMedia(mediaId);
});

test("a list's toolbar switches it to numbered, and the format bar is gone", async ({ page }) => {
  const bulleted = {
    type: "bulletList",
    content: [
      { type: "listItem", content: [text("One")] },
      { type: "listItem", content: [text("Two")] },
    ],
  };
  const { id, textbox } = await openPage(page, "List Page", doc(section([bulleted])));
  await textbox.getByText("Two", { exact: true }).click();
  await settle(page);
  await page.keyboard.press("Tab");
  const toolbar = page.getByRole("toolbar", { name: "List" });
  await expect(toolbar.getByRole("button", { name: "Bulleted list" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(toolbar.getByRole("button", { name: /^Text style/ })).toHaveCount(0);
  await toolbar.getByRole("button", { name: "Numbered list" }).focus();
  await page.keyboard.press("Enter");
  await expect(textbox.locator("ol").getByRole("listitem")).toHaveText(["One", "Two"]);
  await expect(page.getByRole("toolbar", { name: "Formatting" })).toHaveCount(0);

  await save(page);
  expect((await storedEntry(id)).blocks).toEqual(
    doc(section([{ ...bulleted, type: "orderedList" }])),
  );
});

for (const width of [1280, 390]) {
  test(`Undo and Redo are in the top bar at ${width}px, with no horizontal scroll`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    const { textbox } = await openPage(page, `Undo ${width}`, doc(section(["Words"])));
    await textbox.getByText("Words", { exact: true }).click();
    await settle(page);
    await page.keyboard.press("End");
    await page.keyboard.type(" more");
    const undo = page.getByRole("button", { name: "Undo" });
    const redo = page.getByRole("button", { name: "Redo" });
    await expect(undo).toBeVisible();
    await expect(redo).toBeVisible();
    await undo.click();
    await expect(textbox).toHaveText("Words");
    await expect(redo).toBeEnabled();
    expect(await page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")).toBe(
      true,
    );
  });
}

function heading(level: number, value: string): TestNode {
  return { type: "heading", attrs: { level }, content: [{ type: "text", text: value }] };
}

/** Pastes this HTML at the caret - written as source, since these tests' types have no DOM. */
async function paste(page: Page, html: string) {
  await page.evaluate(`(() => {
    const element = document.querySelector('[role="textbox"]');
    const data = new DataTransfer();
    data.setData("text/html", ${JSON.stringify(html)});
    data.setData("text/plain", "Pasted");
    element.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  })()`);
}

test("journey 4: Main heading moves the page's one h1, announced, undone in one step, and published", async ({
  page,
}) => {
  const { id, textbox } = await openPage(
    page,
    "Journey Four",
    doc(section([heading(1, "Welcome"), "Intro", heading(2, "Our work")])),
    true,
  );
  await textbox.getByText("Our work", { exact: true }).click();
  await settle(page);
  await page.keyboard.press("Tab");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  const styleButton = page
    .getByRole("toolbar", { name: "Heading" })
    .getByRole("button", { name: "Text style: Heading" });
  await expect(styleButton).toBeFocused();
  await page.keyboard.press("Enter");
  const main = page.getByRole("menuitemradio", { name: /^Main heading/ });
  await expect(main).toContainText('One per page. Now: "Welcome"');
  await page.keyboard.press("ArrowUp");
  await expect(main).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page.getByRole("status")).toHaveText('"Welcome" is now a Heading.');
  await expect(textbox).toBeFocused();
  await expect(textbox.getByRole("heading", { level: 1 })).toHaveText(["Our work"]);
  await expect(textbox.getByRole("heading", { level: 2 })).toHaveText(["Welcome"]);

  // One Ctrl+Z restores both.
  await page.keyboard.press("ControlOrMeta+z");
  await expect(textbox.getByRole("heading", { level: 1 })).toHaveText(["Welcome"]);
  await expect(textbox.getByRole("heading", { level: 2 })).toHaveText(["Our work"]);
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect(textbox.getByRole("heading", { level: 1 })).toHaveText(["Our work"]);

  const saved = page.waitForResponse((response) => response.request().method() === "POST");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  expect((await saved).ok()).toBe(true);
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  expect((await storedEntry(id)).blocks).toEqual(
    doc(section([heading(2, "Welcome"), "Intro", heading(1, "Our work")])),
  );

  await page.goto("/journey-four");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(["Our work"]);
  await expect(page.getByRole("heading", { name: "Journey Four" })).toHaveCount(0);
});

test("a page with no main heading still shows its title as the h1", async ({ page }) => {
  await createDraftFor(editor.email, "Title Shown", doc(section(["Body"])), {
    type: "page",
    status: "published",
  });
  await page.goto("/title-shown");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(["Title Shown"]);
});

test("a pasted h1 on a page that has a main heading arrives as a Heading, and Save succeeds", async ({
  page,
}) => {
  const { id, textbox } = await openPage(
    page,
    "Pasted Main",
    doc(section([heading(1, "Welcome"), "Body"])),
  );
  await textbox.getByText("Body", { exact: true }).click();
  await settle(page);
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await paste(page, "<h1>Pasted</h1>");
  await expect(textbox.getByRole("heading", { level: 2, name: "Pasted" })).toBeVisible();
  await expect(textbox.getByRole("heading", { level: 1 })).toHaveText(["Welcome"]);
  await save(page);
  await expect(page.getByText("Your changes were not saved.")).toHaveCount(0);
  expect((await storedEntry(id)).blocks).toEqual(
    doc(section([heading(1, "Welcome"), "Body", heading(2, "Pasted")])),
  );
});

test("a post's menu has no Main heading, and typing # never makes a level-1 heading", async ({
  page,
}) => {
  const id = await createDraftFor(editor.email, "No Main Post", doc(section(["Words"])), {
    type: "post",
  });
  await logIn(page, editor);
  await page.goto(`/admin/posts/${id}`);
  const textbox = page.getByRole("textbox", { name: "Post content" });
  await textbox.getByText("Words", { exact: true }).click();
  await settle(page);
  await page.getByRole("button", { name: /^Text style:/ }).click();
  await expect(page.getByRole("menuitemradio")).toHaveText([
    "Text",
    "Heading",
    "Subheading",
    "Small heading",
  ]);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(textbox).toBeFocused();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("# Not a main heading");
  await expect(textbox.getByRole("heading", { level: 1 })).toHaveCount(0);
  await paste(page, "<h1>Pasted</h1>");
  await expect(textbox.getByRole("heading", { level: 1 })).toHaveCount(0);
  await save(page);
  expect(JSON.stringify((await storedEntry(id)).blocks)).not.toContain('"level":1');
});

test("keyboard only: the chip's Move section down makes section 1 the second, announced, and one Ctrl+Z restores it", async ({
  page,
}) => {
  const { id, textbox } = await openPage(
    page,
    "Three Sections",
    doc(section(["One"]), section(["Two"]), section(["Three"])),
  );
  await textbox.getByText("One", { exact: true }).click();
  await settle(page);
  // The writing area, then the block toolbar (one stop), then the chip.
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  const first = page.getByRole("group", { name: "Section 1 of 3", exact: true });
  const up = first.getByRole("button", { name: "Move section up" });
  await expect(up).toBeFocused();
  await expect(up).toHaveAttribute("aria-disabled", "true");
  await page.keyboard.press("Enter");
  expect(await canvasShape(page)).toEqual([[["One"]], [["Two"]], [["Three"]]]);

  await page.keyboard.press("Tab");
  const down = page.getByRole("button", { name: "Move section down" });
  await expect(down).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toHaveText("Section moved down: now section 2 of 3.");
  await expect(page.getByRole("group", { name: "Section 2 of 3", exact: true })).toBeVisible();
  await expect(down).toBeFocused();
  expect(await canvasShape(page)).toEqual([[["Two"]], [["One"]], [["Three"]]]);

  await save(page);
  expect((await storedEntry(id)).blocks).toEqual(
    doc(section(["Two"]), section(["One"]), section(["Three"])),
  );

  await textbox.focus();
  await page.keyboard.press("ControlOrMeta+z");
  expect(await canvasShape(page)).toEqual([[["One"]], [["Two"]], [["Three"]]]);
});
