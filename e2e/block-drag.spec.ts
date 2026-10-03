import { randomInt } from "node:crypto";
import { expect, type Locator, type Page, test } from "@playwright/test";
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

// Item 14b: dragging the selected block by its grip, and a palette tile, to a
// place in any column - a gap labelled where it will land, a ghost following
// the pointer, the place announced in the polite status region.

let editor: TestUser;
// The admin's Content-Security-Policy is not loosened for dragging: the ghost
// and the gap are placed with CSSOM, never a style attribute.
let refusedByPolicy: string[];

test.beforeEach(async ({ page }) => {
  refusedByPolicy = [];
  page.on("console", (message) => {
    if (message.text().includes("Content Security Policy")) refusedByPolicy.push(message.text());
  });
  await page.setExtraHTTPHeaders({
    "X-Forwarded-For": `10.${randomInt(256)}.${randomInt(256)}.17`,
  });
  editor = createAdmin("Drag Writer");
  await setRole(editor.email, "editor");
});

test.afterEach(async () => {
  await deleteEntriesBy(editor.email);
  await deleteTestUser(editor.email);
  expect(refusedByPolicy).toEqual([]);
});

const GRIP = "Drag to move, or use Move up and Move down";

function text(value: string): TestNode {
  return { type: "paragraph", content: [{ type: "text", text: value }] };
}

function heading(level: number, value: string): TestNode {
  return { type: "heading", attrs: { level }, content: [{ type: "text", text: value }] };
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
const SEEDED = () => doc(section(["A", "B"], ["C"]), section(["D"]));

async function openPage(page: Page, title: string, document: TestNode) {
  const id = await createDraftFor(editor.email, title, document, { type: "page" });
  await logIn(page, editor);
  await page.goto(`/admin/pages/${id}`);
  const textbox = page.getByRole("textbox", { name: "Page content" });
  await expect(textbox).toBeVisible();
  return { id, textbox };
}

/** The canvas's sections, as the texts of each column's blocks (the gap excluded). */
async function canvasShape(page: Page) {
  return page.evaluate(`[...document.querySelectorAll('[role="textbox"] [data-node="section"]')].map(
    (section) => [...section.querySelectorAll('[data-node="column"]')].map(
      (column) => [...column.children].filter((block) => !block.hasAttribute("data-drop-zone")).map((block) => block.textContent),
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

/** Selects the block holding this text, so its toolbar and grip show. */
async function select(textbox: Locator, value: string) {
  await textbox.getByText(value, { exact: true }).click();
}

async function centre(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("not visible");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, box };
}

/** Presses on `from` and moves in steps past the 6px threshold, holding. */
async function pickUp(page: Page, from: Locator) {
  const { x, y } = await centre(from);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 4, y + 4, { steps: 2 });
  await page.mouse.move(x + 12, y + 12, { steps: 3 });
}

/** Moves the held pointer to just inside the top (or bottom) edge of a block. */
async function hover(page: Page, block: Locator, edge: "top" | "bottom") {
  const { box } = await centre(block);
  const y = edge === "top" ? box.y + 3 : box.y + box.height - 3;
  await page.mouse.move(box.x + box.width / 2, y, { steps: 8 });
}

/** No gap, ghost or dimmed block is left, and nothing interactive sits in the writing area. */
async function expectClean(page: Page, textbox: Locator) {
  await expect(page.locator("[data-drop-zone]")).toHaveCount(0);
  await expect(page.locator("[data-drag-ghost]")).toHaveCount(0);
  await expect(page.locator("[data-dragged]")).toHaveCount(0);
  await expect(textbox.getByRole("textbox")).toHaveCount(0);
  await expect(textbox.getByRole("button")).toHaveCount(0);
}

test("dragging A by its grip to below C shows the gap, ghost and place, drops it there as one undo step, and Save stores it", async ({
  page,
}) => {
  const { id, textbox } = await openPage(page, "Drag Page", SEEDED());
  await select(textbox, "A");
  await pickUp(page, page.getByRole("button", { name: GRIP }));
  await hover(page, textbox.getByText("C", { exact: true }), "bottom");

  const gap = page.locator("[data-drop-zone]");
  await expect(gap).toHaveText("Drop text here");
  await expect(gap).toHaveAttribute("aria-hidden", "true");
  await expect(page.locator("[data-drag-ghost]")).toHaveText("Text");
  await expect(page.getByRole("status")).toHaveText(
    "Text: drop at block 2 of 2 in column 2 of section 1.",
  );
  // The gap opens after C, in C's column.
  expect(await canvasShape(page)).toEqual([[["A", "B"], ["C"]], [["D"]]]);
  await expect(
    textbox.locator('[data-node="column"]').nth(1).locator("[data-drop-zone]"),
  ).toHaveCount(1);
  // The dragged block is dimmed in place; the toolbar and chip are out of the way.
  await expect(page.locator("[data-dragged]")).toHaveText("A");
  await expect(page.getByRole("toolbar")).toHaveCount(0);
  await expect(page.getByRole("group", { name: /^Section \d of \d$/ })).toHaveCount(0);

  await page.mouse.up();
  await expect(page.getByRole("status")).toHaveText(
    "Text moved: block 2 of 2 in column 2 of section 1.",
  );
  expect(await canvasShape(page)).toEqual([[["B"], ["C", "A"]], [["D"]]]);
  await expect(page.getByRole("toolbar", { name: "Text" })).toBeVisible();
  expect(await caretBlockText(page)).toBe("A");
  await expect(page.getByRole("group", { name: "Section 1 of 2", exact: true })).toBeVisible();
  await expectClean(page, textbox);

  await page.keyboard.press("ControlOrMeta+z");
  expect(await canvasShape(page)).toEqual([[["A", "B"], ["C"]], [["D"]]]);
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await save(page);
  expect((await storedEntry(id)).blocks).toEqual(doc(section(["B"], ["C", "A"]), section(["D"])));
});

test("dragging B into section 2's top lands it first there, and column 1 keeps an empty paragraph with its hint", async ({
  page,
}) => {
  const { id, textbox } = await openPage(
    page,
    "Drag Across",
    doc(section(["B"], ["C"]), section(["D"])),
  );
  await select(textbox, "B");
  await pickUp(page, page.getByRole("button", { name: GRIP }));
  await hover(page, textbox.getByText("D", { exact: true }), "top");
  await expect(page.getByRole("status")).toHaveText("Text: drop at block 1 of 2 in section 2.");
  await page.mouse.up();
  await expect(page.getByRole("status")).toHaveText("Text moved: block 1 of 2 in section 2.");
  expect(await canvasShape(page)).toEqual([[[""], ["C"]], [["B", "D"]]]);
  await expect(textbox.locator("[data-hint]")).toHaveCount(1);
  await save(page);
  expect((await storedEntry(id)).blocks).toEqual(
    doc(
      {
        type: "section",
        attrs: { align: "top", background: "none" },
        content: [
          { type: "column", content: [EMPTY] },
          { type: "column", content: [text("C")] },
        ],
      },
      section(["B", "D"]),
    ),
  );
  await expectClean(page, textbox);
});

test("hovering the block's own place shows no gap, and releasing there changes nothing", async ({
  page,
}) => {
  const { textbox } = await openPage(page, "Own Place", SEEDED());
  await select(textbox, "A");
  await pickUp(page, page.getByRole("button", { name: GRIP }));
  await hover(page, textbox.getByText("A", { exact: true }), "top");
  await expect(page.getByRole("status")).toHaveText("Text: drop here to leave it in place.");
  await expect(page.locator("[data-drop-zone]")).toHaveCount(0);
  await page.mouse.up();
  expect(await canvasShape(page)).toEqual([[["A", "B"], ["C"]], [["D"]]]);
  await expect(page.getByRole("button", { name: "Undo" })).toBeDisabled();
  await expectClean(page, textbox);
});

test("Escape mid-drag cancels, announced, and the release stores nothing", async ({ page }) => {
  const { textbox } = await openPage(page, "Escape Drag", SEEDED());
  await select(textbox, "A");
  await pickUp(page, page.getByRole("button", { name: GRIP }));
  await hover(page, textbox.getByText("D", { exact: true }), "bottom");
  await expect(page.locator("[data-drop-zone]")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("status")).toHaveText("Drag cancelled.");
  await expectClean(page, textbox);
  await page.mouse.up();
  expect(await canvasShape(page)).toEqual([[["A", "B"], ["C"]], [["D"]]]);
  await expect(page.getByRole("toolbar", { name: "Text" })).toBeVisible();
});

test("releasing over the palette cancels and stores nothing", async ({ page }) => {
  const { textbox } = await openPage(page, "Palette Release", SEEDED());
  await select(textbox, "A");
  await pickUp(page, page.getByRole("button", { name: GRIP }));
  const palette = page.getByRole("complementary", { name: "Add to the page" });
  const { x, y } = await centre(palette);
  await page.mouse.move(x, y, { steps: 8 });
  await expect(page.getByRole("status")).toHaveText("Text: release to cancel.");
  await expect(page.locator("[data-drop-zone]")).toHaveCount(0);
  await page.mouse.up();
  await expect(page.getByRole("status")).toHaveText("Drag cancelled.");
  expect(await canvasShape(page)).toEqual([[["A", "B"], ["C"]], [["D"]]]);
  await expectClean(page, textbox);
});

test("dragging a page's main heading keeps it level 1", async ({ page }) => {
  const { id, textbox } = await openPage(
    page,
    "Drag Main",
    doc(section([heading(1, "Welcome"), "Intro"])),
  );
  await select(textbox, "Welcome");
  await pickUp(page, page.getByRole("button", { name: GRIP }));
  await hover(page, textbox.getByText("Intro", { exact: true }), "bottom");
  await expect(page.locator("[data-drop-zone]")).toHaveText("Drop main heading here");
  await page.mouse.up();
  await expect(page.getByRole("status")).toHaveText(
    "Main heading moved: block 2 of 2 in section 1.",
  );
  await save(page);
  expect((await storedEntry(id)).blocks).toEqual(doc(section(["Intro", heading(1, "Welcome")])));
});

test("a press on the grip without moving says how to move the block, and moves nothing", async ({
  page,
}) => {
  const { textbox } = await openPage(page, "Grip Press", SEEDED());
  await select(textbox, "A");
  await page.getByRole("button", { name: GRIP }).click();
  await expect(page.getByRole("status")).toHaveText("Drag to move, or use Move up and Move down.");
  expect(await canvasShape(page)).toEqual([[["A", "B"], ["C"]], [["D"]]]);
  await expectClean(page, textbox);
});

test("the grip is out of the toolbar's arrow order: Tab still lands on Move up", async ({
  page,
}) => {
  const { textbox } = await openPage(page, "Grip Order", SEEDED());
  await select(textbox, "A");
  await page.keyboard.press("Tab");
  const toolbar = page.getByRole("toolbar", { name: "Text" });
  await expect(toolbar.getByRole("button", { name: "Move up", exact: true })).toBeFocused();
  await page.keyboard.press("Home");
  await expect(toolbar.getByRole("button", { name: "Move up", exact: true })).toBeFocused();
  await expect(toolbar.getByRole("button", { name: GRIP })).toHaveAttribute("tabindex", "-1");
});
