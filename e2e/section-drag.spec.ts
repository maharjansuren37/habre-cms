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

// ---- Step 3: long pages, a change mid-drag, the cap, the journey -------------

async function save(page: Page) {
  const saved = page.waitForResponse((response) => response.request().method() === "POST");
  await page.getByRole("button", { name: "Save draft" }).click();
  expect((await saved).ok()).toBe(true);
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
}

test("on a page taller than the window, holding the Blank tile at the bottom edge scrolls until the last section is reachable, and it drops below it as section 13", async ({
  page,
}) => {
  const sections = Array.from({ length: 12 }, (_, i) => section(`S${i + 1}`));
  const { id, textbox } = await openPage(page, "Long Section Drag", {
    type: "doc",
    content: sections,
  });
  expect(
    await page.evaluate("document.documentElement.scrollHeight > window.innerHeight * 1.5"),
  ).toBe(true);
  await pickUp(page, tile(page, "Blank section"));
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("no viewport");
  await page.mouse.move(viewport.width / 2, viewport.height - 6, { steps: 8 });
  await expect(textbox.getByText("S12", { exact: true })).toBeInViewport({ timeout: 15_000 });
  await hover(page, sectionOf(textbox, 11), "bottom");
  await expect(page.getByRole("status")).toHaveText("Blank section: drop as section 13 of 13.");
  await page.mouse.up();
  await expect(page.getByRole("status")).toHaveText("Blank section added: now section 13 of 13.");
  await save(page);
  const stored = (await storedEntry(id)).blocks as TestNode;
  expect(stored.content).toHaveLength(13);
  expect(stored.content?.[11]).toEqual(section("S12"));
  const last = stored.content?.[12];
  expect(last?.type).toBe("section");
  expect(last?.content).toHaveLength(1);
  expect(last?.content?.[0]?.content).toEqual([{ type: "paragraph" }]);
});

/** Records each message the status region shows (not the blank between two) with the time, in `window.__said`. */
async function recordStatus(page: Page) {
  await page.evaluate(`(() => {
    const element = document.querySelector('[role="status"]');
    const said = [];
    window.__said = said;
    new MutationObserver(() => {
      const text = element.textContent ?? "";
      if (text && text !== said.at(-1)?.text) said.push({ t: performance.now(), text });
    }).observe(element, { childList: true, characterData: true, subtree: true });
  })()`);
}

/**
 * With the pointer held at the window's bottom edge for 2 seconds (the window
 * scrolling under it): no two announcements come under 300 ms apart, and the
 * place where the scrolling ends is announced within 600 ms. (F-197)
 */
async function expectSettledWhileScrolling(page: Page) {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("no viewport");
  const before = (await page.evaluate("window.scrollY")) as number;
  await page.mouse.move(viewport.width / 2, viewport.height - 6, { steps: 8 });
  const arrived = (await page.evaluate("performance.now()")) as number;
  await page.waitForTimeout(2000);
  expect(((await page.evaluate("window.scrollY")) as number) > before).toBe(true);
  const stopped = (await page.evaluate(`new Promise((done) => {
    const check = () =>
      window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 1
        ? done(performance.now())
        : requestAnimationFrame(check);
    check();
  })`)) as number;
  await page.waitForTimeout(700);
  const said = (await page.evaluate("window.__said")) as { t: number; text: string }[];
  const during = said.filter((entry) => entry.t >= arrived);
  expect(during.length).toBeGreaterThan(0);
  const gaps = during.slice(1).map((entry, i) => Math.round(entry.t - (during[i]?.t ?? 0)));
  expect(
    Math.min(...gaps, 300),
    `gaps between announcements: ${gaps.join(", ")} ms`,
  ).toBeGreaterThanOrEqual(300);
  const last = said.at(-1);
  expect(last && last.t - stopped).toBeLessThanOrEqual(600);
  await expect(page.getByRole("status")).toHaveText(last?.text ?? "");
}

test("holding a Hero tile at the window's bottom edge while it scrolls announces a place only once it has held for 300 ms", async ({
  page,
}) => {
  const sections = Array.from({ length: 12 }, (_, i) => section(`S${i + 1}`));
  await openPage(page, "Settled Section Drag", { type: "doc", content: sections });
  await recordStatus(page);
  await pickUp(page, tile(page, "Hero"));
  await expectSettledWhileScrolling(page);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(page.getByRole("status")).toHaveText("Drag cancelled.");
});

test("Ctrl+Z while dragging a section tile undoes the typing, cancels the drag, and the release stores nothing more", async ({
  page,
}) => {
  const { textbox } = await openPage(page, "Section Undo Mid Drag", THREE());
  await textbox.getByText("A", { exact: true }).click();
  await page.keyboard.press("End");
  await page.keyboard.type(" typed");
  await expect(textbox.getByText("A typed", { exact: true })).toBeVisible();
  await pickUp(page, tile(page, "Hero"));
  await hover(page, sectionOf(textbox, 1), "top");
  await expect(page.locator("[data-drop-zone]")).toHaveCount(1);
  await page.keyboard.press("ControlOrMeta+z");
  await expect(page.getByRole("status")).toHaveText("Drag cancelled.");
  expect(await sectionTexts(page)).toEqual(["A", "B", "C"]);
  await expectClean(page, textbox);
  await page.mouse.up();
  expect(await sectionTexts(page)).toEqual(["A", "B", "C"]);
});

test("at 30 sections every section tile is disabled, and pressing and moving on one shows no ghost and no gap", async ({
  page,
}) => {
  const { textbox } = await openPage(page, "Thirty Sections", {
    type: "doc",
    content: Array.from({ length: 30 }, (_, i) => section(`S${i}`)),
  });
  const names = ["Blank section", "Hero", "Image and text", "Call to action"];
  for (const name of names) await expect(tile(page, name)).toBeDisabled();
  for (const name of names) {
    await pickUp(page, tile(page, name));
    await hover(page, sectionOf(textbox, 1), "top");
    await expect(page.locator("[data-drag-ghost]")).toHaveCount(0);
    await expect(page.locator("[data-drop-zone]")).toHaveCount(0);
    await page.mouse.up();
  }
  await expect(textbox.locator('[data-node="section"]')).toHaveCount(30);
});

// Journey 2 (design.md, *Edit and publish*), the section drag's part.
for (const arrival of ["a full page load", "the admin's own links"] as const) {
  test(`journey 2: open a page by ${arrival}, drag a Call to action below the last section, type its heading, Publish, and the public page shows it last`, async ({
    page,
  }) => {
    const title = `Section Journey ${randomInt(1_000_000)}`;
    const id = await createDraftFor(editor.email, title, THREE(), { type: "page" });
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
    await expect(textbox).toBeVisible();
    await pickUp(page, tile(page, "Call to action"));
    await hover(page, sectionOf(textbox, 2), "bottom");
    await expect(page.getByRole("status")).toHaveText("Call to action: drop as section 4 of 4.");
    await page.mouse.up();
    await expect(textbox).toBeFocused();
    await page.keyboard.type("Join us");
    await expect(sectionOf(textbox, 3).getByRole("heading")).toHaveText("Join us");

    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page).toHaveURL(/\/admin\/pages\?/);
    await page.goto(`/${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`);
    const sections = page.getByRole("main").locator("section");
    await expect(sections).toHaveCount(4);
    await expect(sections.last()).toHaveAttribute("data-background", "band");
    await expect(sections.last()).toContainText("Join us");
  });
}

// F-193: the sticky top bar covers sections on a scrolled page. The window
// scrolls up while the pointer is over the bar, so the release comes within a
// second, while sections still lie under it.
test("a Hero tile released over the sticky top bar adds no section", async ({ page }) => {
  const sections = Array.from({ length: 29 }, (_, i) => section(`S${i + 1}`));
  const { textbox } = await openPage(page, "Tile Under The Bar", {
    type: "doc",
    content: sections,
  });
  await select(textbox, "S29");
  await expect(textbox.getByText("S1", { exact: true })).not.toBeInViewport();
  const texts = await sectionTexts(page);
  await pickUp(page, tile(page, "Hero"));
  const bar = await centre(page.locator("[data-sticky-bar]"));
  const canvas = await centre(textbox);
  await page.mouse.move(canvas.x, bar.y, { steps: 8 });
  // The premise: a section is under the bar at this point.
  expect(
    await page.evaluate(
      `document.elementsFromPoint(${canvas.x}, ${bar.y}).some((el) => el.matches('[data-node="section"]'))`,
    ),
  ).toBe(true);
  await page.evaluate(
    "new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))",
  );
  // The bar scrolls the page, so the place is announced once it has held for 300 ms (F-197).
  await page.waitForTimeout(350);
  // Read once: the bar keeps scrolling the page, so a retry could catch a margin between sections.
  expect(await page.getByRole("status").textContent()).toBe("Hero: release to cancel.");
  await expect(page.locator("[data-drop-zone]")).toHaveCount(0);
  await page.mouse.up();
  await expect(page.getByRole("status")).toHaveText("Drag cancelled.");
  expect(await sectionTexts(page)).toEqual(texts);
  expect(await sectionTexts(page)).toHaveLength(29);
});
