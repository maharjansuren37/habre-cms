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

// Item 14c2: dragging a palette section tile to a place between sections - a
// gap labelled where it will land, a ghost following the pointer, the place
// announced, the ready-made section added there as one undo step.

// Tall enough that the whole palette, the Sections group included, is on screen.
test.use({ viewport: { width: 1280, height: 1000 } });

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
  editor = createAdmin("Section Drag Writer");
  await setRole(editor.email, "editor");
});

test.afterEach(async () => {
  await deleteEntriesBy(editor.email);
  await deleteTestUser(editor.email);
  expect(refusedByPolicy).toEqual([]);
});

function paragraph(value: string): TestNode {
  return { type: "paragraph", content: [{ type: "text", text: value }] };
}

function section(value: string): TestNode {
  return {
    type: "section",
    attrs: { align: "top", background: "none" },
    content: [{ type: "column", content: [paragraph(value)] }],
  };
}

/** Sections [A], [B], [C]: a page with no main heading. */
const THREE = (): TestNode => ({
  type: "doc",
  content: [section("A"), section("B"), section("C")],
});

async function openPage(page: Page, title: string, document: TestNode) {
  const id = await createDraftFor(editor.email, title, document, { type: "page" });
  await logIn(page, editor);
  await page.goto(`/admin/pages/${id}`);
  const textbox = page.getByRole("textbox", { name: "Page content" });
  await expect(textbox).toBeVisible();
  return { id, textbox };
}

function tile(page: Page, name: string) {
  return page
    .getByRole("complementary", { name: "Add to the page" })
    .getByRole("button", { name, exact: true });
}

/** Each section's columns, each column's blocks as their node names (the gap excluded). */
async function canvasShape(page: Page) {
  return page.evaluate(`[...document.querySelectorAll('[role="textbox"] [data-node="section"]')].map(
    (section) => [...section.querySelectorAll('[data-node="column"]')].map(
      (column) => [...column.children].filter((block) => !block.hasAttribute("data-drop-zone")).map((block) => block.dataset.node || block.tagName.toLowerCase()),
    ),
  )`);
}

/** The first text of each section, in order: "A", "", "B"... (the hero's heading is empty). */
async function sectionTexts(page: Page) {
  return page.evaluate(`[...document.querySelectorAll('[role="textbox"] [data-node="section"]')].map(
    (section) => section.querySelector('[data-node="column"] > :is(p, h1, h2)').textContent,
  )`);
}

const HERO_SHAPE = [["h1", "p", "space", "button"], ["div"]];

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

/** Moves the held pointer to just inside the top (or bottom) edge of a block, measured again after the gap opens. */
async function hover(page: Page, block: Locator, edge: "top" | "bottom") {
  for (const steps of [8, 2]) {
    const { box } = await centre(block);
    const y = edge === "top" ? box.y + 3 : box.y + box.height - 3;
    await page.mouse.move(box.x + box.width / 2, y, { steps });
    await page.evaluate(
      "new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))",
    );
  }
}

async function expectClean(page: Page, textbox: Locator) {
  await expect(page.locator("[data-drop-zone]")).toHaveCount(0);
  await expect(page.locator("[data-drag-ghost]")).toHaveCount(0);
  await expect(page.locator("[data-dragged]")).toHaveCount(0);
  await expect(tile(page, "Hero")).not.toHaveCSS("border-top-style", "dashed");
  await expect(tile(page, "Call to action")).not.toHaveCSS("border-top-style", "dashed");
  await expect(textbox.getByRole("textbox")).toHaveCount(0);
  await expect(textbox.getByRole("button")).toHaveCount(0);
}

function sectionOf(textbox: Locator, index: number) {
  return textbox.locator('[data-node="section"]').nth(index);
}

test("dragging Hero between A and B shows the gap, ghost and place; the drop adds it there, the heading is the Main heading, and Save stores no gap", async ({
  page,
}) => {
  const { id, textbox } = await openPage(page, "Hero Drag", THREE());
  await select(textbox, "A");
  await pickUp(page, tile(page, "Hero"));
  await hover(page, sectionOf(textbox, 1), "top");

  const gap = page.locator("[data-drop-zone]");
  await expect(gap).toHaveText("Drop hero here");
  // A direct child of the writing area, between sections, not in a column.
  await expect(textbox.locator("> [data-drop-zone]")).toHaveCount(1);
  expect(
    await gap.evaluate(
      (zone) =>
        `${zone.previousElementSibling?.getAttribute("data-node")}|${zone.nextElementSibling?.getAttribute("data-node")}`,
    ),
  ).toBe("section|section");
  await expect(page.locator("[data-drag-ghost]")).toHaveText("Hero");
  await expect(tile(page, "Hero")).toHaveCSS("border-top-style", "dashed");
  await expect(page.getByRole("status")).toHaveText("Hero: drop as section 2 of 4.");
  // The toolbar and the section chip are out of the way while dragging.
  await expect(page.getByRole("toolbar")).toHaveCount(0);
  await expect(page.locator("[data-section-chip]")).toBeHidden();

  await page.mouse.up();
  await expect(page.getByRole("status")).toHaveText("Hero added: now section 2 of 4.");
  const shape = (await canvasShape(page)) as string[][][];
  expect(shape).toHaveLength(4);
  expect(shape[0]).toEqual([["p"]]);
  expect(shape[1]).toEqual(HERO_SHAPE);
  expect(shape[2]).toEqual([["p"]]);
  expect(shape[3]).toEqual([["p"]]);
  expect(await sectionTexts(page)).toEqual(["A", "", "B", "C"]);
  await expectClean(page, textbox);

  await expect(textbox).toBeFocused();
  await page.keyboard.type("Welcome");
  await expect(sectionOf(textbox, 1).locator("h1")).toHaveText("Welcome");
  await expect(page.getByRole("button", { name: "Text style: Main heading" })).toBeVisible();

  const saved = page.waitForResponse((response) => response.request().method() === "POST");
  await page.getByRole("button", { name: "Save draft" }).click();
  expect((await saved).ok()).toBe(true);
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  const stored = (await storedEntry(id)).blocks as TestNode;
  expect(stored.content?.map((node) => node.type)).toEqual([
    "section",
    "section",
    "section",
    "section",
  ]);
  expect(JSON.stringify(stored)).not.toContain("drop");
});

test("one Ctrl+Z right after the drop restores A, B, C", async ({ page }) => {
  const { textbox } = await openPage(page, "Hero Undo", THREE());
  await select(textbox, "A");
  await pickUp(page, tile(page, "Hero"));
  await hover(page, sectionOf(textbox, 1), "top");
  await page.mouse.up();
  await expect(page.getByRole("status")).toHaveText("Hero added: now section 2 of 4.");
  await page.keyboard.press("ControlOrMeta+z");
  expect(await sectionTexts(page)).toEqual(["A", "B", "C"]);
});

test("Call to action dragged above A lands first, and below C lands last", async ({ page }) => {
  const { textbox } = await openPage(page, "Cta Drag", THREE());
  await select(textbox, "A");
  await pickUp(page, tile(page, "Call to action"));
  await hover(page, sectionOf(textbox, 0), "top");
  await expect(page.locator("[data-drop-zone]")).toHaveText("Drop call to action here");
  await expect(page.getByRole("status")).toHaveText("Call to action: drop as section 1 of 4.");
  await page.mouse.up();
  await expect(page.getByRole("status")).toHaveText("Call to action added: now section 1 of 4.");
  expect(((await canvasShape(page)) as string[][][])[0]).toEqual([["h2", "p", "button"]]);
  expect(await sectionTexts(page)).toEqual(["", "A", "B", "C"]);
  await expectClean(page, textbox);

  await select(textbox, "A");
  await pickUp(page, tile(page, "Call to action"));
  await hover(page, sectionOf(textbox, 3), "bottom");
  await expect(page.getByRole("status")).toHaveText("Call to action: drop as section 5 of 5.");
  await page.mouse.up();
  await expect(page.getByRole("status")).toHaveText("Call to action added: now section 5 of 5.");
  expect(await sectionTexts(page)).toEqual(["", "A", "B", "C", ""]);
  expect(((await canvasShape(page)) as string[][][])[4]).toEqual([["h2", "p", "button"]]);
  await expectClean(page, textbox);
});

test("over the palette the status says release to cancel, and a release there stores nothing", async ({
  page,
}) => {
  const { textbox } = await openPage(page, "Hero Palette", THREE());
  await select(textbox, "A");
  await pickUp(page, tile(page, "Hero"));
  const palette = page.getByRole("complementary", { name: "Add to the page" });
  const { x, y } = await centre(palette);
  await page.mouse.move(x, y, { steps: 8 });
  await expect(page.getByRole("status")).toHaveText("Hero: release to cancel.");
  await expect(page.locator("[data-drop-zone]")).toHaveCount(0);
  await page.mouse.up();
  await expect(page.getByRole("status")).toHaveText("Drag cancelled.");
  expect(await sectionTexts(page)).toEqual(["A", "B", "C"]);
  await expectClean(page, textbox);
});

test("Escape mid-drag cancels and the release stores nothing", async ({ page }) => {
  const { textbox } = await openPage(page, "Hero Escape", THREE());
  await select(textbox, "A");
  await pickUp(page, tile(page, "Hero"));
  await hover(page, sectionOf(textbox, 1), "top");
  await expect(page.locator("[data-drop-zone]")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("status")).toHaveText("Drag cancelled.");
  await expectClean(page, textbox);
  await page.mouse.up();
  expect(await sectionTexts(page)).toEqual(["A", "B", "C"]);
});

test("a click on the Hero tile without moving still adds it after the selection's section, and the writing area is the only textbox", async ({
  page,
}) => {
  const { textbox } = await openPage(page, "Hero Click", THREE());
  await select(textbox, "A");
  await tile(page, "Hero").click();
  await expect(page.getByRole("status")).toHaveText("Hero added: now section 2 of 4.");
  expect(await sectionTexts(page)).toEqual(["A", "", "B", "C"]);
  await expectClean(page, textbox);
});
