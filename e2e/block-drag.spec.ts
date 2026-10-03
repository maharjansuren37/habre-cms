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

/**
 * Moves the held pointer to just inside the top (or bottom) edge of a block.
 * A gap opening on the way moves the blocks below it, so the block is
 * measured again once the pointer has arrived, and the last step corrects.
 */
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

// ---- Step 4: dragging a palette tile ----------------------------------------

function tile(page: Page, name: string) {
  return page
    .getByRole("complementary", { name: "Add to the page" })
    .getByRole("button", { name, exact: true });
}

test("dragging the Image tile to the top of column 2 shows the gap, ghost and place, adds a selected image there, and one Ctrl+Z removes it", async ({
  page,
}) => {
  const { id, textbox } = await openPage(page, "Tile Drag", SEEDED());
  await select(textbox, "A");
  await pickUp(page, tile(page, "Image"));
  await hover(page, textbox.getByText("C", { exact: true }), "top");

  await expect(page.locator("[data-drop-zone]")).toHaveText("Drop image here");
  await expect(page.locator("[data-drag-ghost]")).toHaveText("Image");
  await expect(page.getByRole("status")).toHaveText(
    "Image: drop at block 1 of 2 in column 2 of section 1.",
  );
  await expect(tile(page, "Image")).toHaveCSS("border-top-style", "dashed");
  // The ghost is Habre's chrome: its border and icon take the tiles' rust.
  // Run in the page, so written as source: these tests' types have no DOM.
  const rust = (await page.evaluate(
    `getComputedStyle(document.querySelector('[aria-label="Add to the page"] button svg')).stroke`,
  )) as string;
  expect(rust).not.toBe("none");
  await expect(page.locator("[data-drag-ghost]")).toHaveCSS("border-top-color", rust);
  await expect(page.locator("[data-drag-ghost] svg")).toHaveCSS("stroke", rust);
  await expect(tile(page, "Text")).not.toHaveCSS("border-top-style", "dashed");

  await page.mouse.up();
  await expect(page.getByRole("status")).toHaveText(
    "Image added: block 1 of 2 in column 2 of section 1.",
  );
  expect(await canvasShape(page)).toEqual([
    [
      ["A", "B"],
      ["No image chosen", "C"],
    ],
    [["D"]],
  ]);
  await expect(page.getByRole("toolbar", { name: "Image" })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Image", exact: true })).toBeVisible();
  await expect(tile(page, "Image")).not.toHaveCSS("border-top-style", "dashed");
  await expectClean(page, textbox);

  await page.keyboard.press("ControlOrMeta+z");
  expect(await canvasShape(page)).toEqual([[["A", "B"], ["C"]], [["D"]]]);
  // What is stored, not only what is drawn (F-198): an image with no file, first in column 2.
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await save(page);
  expect((await storedEntry(id)).blocks).toEqual(
    doc(section(["A", "B"], [{ type: "image", attrs: { mediaId: "" } }, "C"]), section(["D"])),
  );
});

test("dropping a Text tile into an untouched column replaces its empty paragraph", async ({
  page,
}) => {
  const { id, textbox } = await openPage(
    page,
    "Tile Untouched",
    doc({
      type: "section",
      attrs: { align: "top", background: "none" },
      content: [
        { type: "column", content: [text("Left")] },
        { type: "column", content: [EMPTY] },
      ],
    }),
  );
  await select(textbox, "Left");
  await pickUp(page, tile(page, "Text"));
  await hover(page, textbox.locator('[data-node="column"]').nth(1), "top");
  await expect(page.getByRole("status")).toHaveText(
    "Text: drop at block 1 of 1 in column 2 of section 1.",
  );
  await page.mouse.up();
  await page.keyboard.type("Typed right");
  await save(page);
  expect((await storedEntry(id)).blocks).toEqual(doc(section(["Left"], ["Typed right"])));
});

test("a click on the Line tile still adds one line after the selected block, and a drag never also clicks", async ({
  page,
}) => {
  const { textbox } = await openPage(page, "Tile Click", doc(section(["First", "Last"])));
  await select(textbox, "First");
  await tile(page, "Line").click();
  await expect(textbox.locator("hr")).toHaveCount(1);
  expect(await canvasShape(page)).toEqual([[["First", "", "Last"]]]);

  // A drag released over the palette adds nothing: no drop, and no click.
  await select(textbox, "Last");
  await pickUp(page, tile(page, "Line"));
  await page.mouse.up();
  await expect(page.getByRole("status")).toHaveText("Drag cancelled.");
  await expect(textbox.locator("hr")).toHaveCount(1);
});

// F-195: a drag cancelled by Escape waits for its gesture to end. A gesture
// that ends in pointercancel, not pointerup, must not leave the click blocker
// behind to eat the next click.
test("after a drag is cancelled by Escape and its gesture ends in pointercancel, the next click adds a line", async ({
  page,
}) => {
  const { textbox } = await openPage(page, "Cancel Click", doc(section(["First", "Last"])));
  await select(textbox, "First");
  await pickUp(page, page.getByRole("button", { name: GRIP }));
  await page.keyboard.press("Escape");
  await expect(page.getByRole("status")).toHaveText("Drag cancelled.");
  await page.evaluate(
    'window.dispatchEvent(new PointerEvent("pointercancel", { pointerId: 1, bubbles: true }))',
  );
  // Within the blocker's one-second fallback, so that cannot be what removed it.
  await tile(page, "Line").dispatchEvent("click");
  await expect(textbox.locator("hr")).toHaveCount(1);
  expect(await canvasShape(page)).toEqual([[["First", "", "Last"]]]);
  await page.mouse.up();
});

// Journey 2 (design.md, *Edit and publish*), the drag's part: open a page,
// drag a Text tile into section 1, type, Publish, and the public page shows
// it where it was dropped. ("Home" and "View site" arrive with items 15-19.)
for (const arrival of ["a full page load", "the admin's own links"] as const) {
  test(`journey 2: open a page by ${arrival}, drag a Text tile in, type, Publish, and the public page shows it there`, async ({
    page,
  }) => {
    const title = `Dragged Journey ${randomInt(1_000_000)}`;
    const id = await createDraftFor(editor.email, title, doc(section(["First", "Second"])), {
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
    await expect(textbox).toBeVisible();
    await pickUp(page, tile(page, "Text"));
    await hover(page, textbox.getByText("Second", { exact: true }), "top");
    await page.mouse.up();
    await page.keyboard.type("Dragged in");
    expect(await canvasShape(page)).toEqual([[["First", "Dragged in", "Second"]]]);

    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page).toHaveURL(/\/admin\/pages\?/);
    await page.goto(`/${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`);
    await expect(page.getByRole("main").getByRole("paragraph")).toHaveText([
      "First",
      "Dragged in",
      "Second",
    ]);
  });
}

// ---- Step 5: long pages, and a change mid-drag ------------------------------

test("on a page taller than the window, holding a block at the window's bottom edge scrolls until section 12 is reachable, and it drops there", async ({
  page,
}) => {
  const sections = Array.from({ length: 12 }, (_, i) =>
    section([`S${i + 1} first`, `S${i + 1} second`]),
  );
  const { id, textbox } = await openPage(page, "Long Drag", doc(...sections));
  expect(
    await page.evaluate("document.documentElement.scrollHeight > window.innerHeight * 2"),
  ).toBe(true);
  await select(textbox, "S1 first");
  await pickUp(page, page.getByRole("button", { name: GRIP }));
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("no viewport");
  // Held still, near the bottom edge: the window scrolls on its own.
  await page.mouse.move(viewport.width / 2, viewport.height - 6, { steps: 8 });
  await expect(textbox.getByText("S12 second", { exact: true })).toBeInViewport({
    timeout: 15_000,
  });
  await hover(page, textbox.getByText("S12 second", { exact: true }), "bottom");
  await expect(page.getByRole("status")).toHaveText("Text: drop at block 3 of 3 in section 12.");
  await page.mouse.up();
  await expect(page.getByRole("status")).toHaveText("Text moved: block 3 of 3 in section 12.");
  await save(page);
  const stored = (await storedEntry(id)).blocks as { content: TestNode[] };
  expect(stored.content[0]).toEqual(section(["S1 second"]));
  expect(stored.content[11]).toEqual(section(["S12 first", "S12 second", "S1 first"]));
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

test("holding a block at the window's bottom edge while it scrolls announces a place only once it has held for 300 ms", async ({
  page,
}) => {
  const sections = Array.from({ length: 12 }, (_, i) =>
    section([`S${i + 1} first`, `S${i + 1} second`]),
  );
  const { textbox } = await openPage(page, "Settled Block Drag", doc(...sections));
  await select(textbox, "S1 first");
  await recordStatus(page);
  await pickUp(page, page.getByRole("button", { name: GRIP }));
  await expectSettledWhileScrolling(page);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(page.getByRole("status")).toHaveText("Drag cancelled.");
});

test("near the sticky top bar the window scrolls back up", async ({ page }) => {
  const sections = Array.from({ length: 12 }, (_, i) => section([`S${i + 1} only`]));
  const { textbox } = await openPage(page, "Scroll Up", doc(...sections));
  await select(textbox, "S12 only");
  await expect(textbox.getByText("S1 only", { exact: true })).not.toBeInViewport();
  await pickUp(page, page.getByRole("button", { name: GRIP }));
  const bar = await page.getByRole("button", { name: "Save draft" }).boundingBox();
  if (!bar) throw new Error("no top bar");
  await page.mouse.move(bar.x, bar.y + bar.height + 20, { steps: 8 });
  await expect(textbox.getByText("S1 only", { exact: true })).toBeInViewport({ timeout: 15_000 });
  await page.keyboard.press("Escape");
  await page.mouse.up();
});

// F-193: a point under something drawn over the writing area is no place. The
// window scrolls up while the pointer is over the sticky bar (it is inside the
// scroll zone), so the page is scrolled well down first and the release comes
// within a second, while sections still lie under the bar.
test("releasing over the sticky top bar cancels and stores nothing, though a section lies under it", async ({
  page,
}) => {
  // Tall sections, so the bar's scroll never leaves the pointer in a margin between two.
  const sections = Array.from({ length: 30 }, (_, i) =>
    section(["a", "b", "c", "d", "e"].map((letter) => `S${i + 1} ${letter}`)),
  );
  const { id, textbox } = await openPage(page, "Under The Bar", doc(...sections));
  await select(textbox, "S25 a");
  await expect(textbox.getByText("S1 a", { exact: true })).not.toBeInViewport();
  const shape = await canvasShape(page);
  const stored = (await storedEntry(id)).blocks;
  // Scroll so the section above the selected one sits under the bar.
  const bar = await centre(page.locator("[data-sticky-bar]"));
  const above = await centre(textbox.getByText("S24 c", { exact: true }));
  await page.mouse.wheel(0, above.y - bar.y);
  await page.evaluate(
    "new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))",
  );
  await pickUp(page, page.getByRole("button", { name: GRIP }));
  const canvas = await centre(textbox);
  const over = bar.y;
  await page.mouse.move(canvas.x, over, { steps: 8 });
  await page.evaluate(
    "new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))",
  );
  // The bar scrolls the page, so the place is announced once it has held for 300 ms (F-197).
  await page.waitForTimeout(350);
  // Read once: the bar keeps scrolling the page, so a retry could catch a margin between sections.
  expect(await page.getByRole("status").textContent()).toBe("Text: release to cancel.");
  await expect(page.locator("[data-drop-zone]")).toHaveCount(0);
  await page.mouse.up();
  await expect(page.getByRole("status")).toHaveText("Drag cancelled.");
  expect(await canvasShape(page)).toEqual(shape);
  await save(page);
  expect((await storedEntry(id)).blocks).toEqual(stored);
});

test("Ctrl+Z while dragging undoes the typing, cancels the drag, and the release stores nothing more", async ({
  page,
}) => {
  const { textbox } = await openPage(page, "Undo Mid Drag", SEEDED());
  await textbox.getByText("A", { exact: true }).click();
  await page.keyboard.press("End");
  await page.keyboard.type(" typed");
  await expect(textbox.getByText("A typed", { exact: true })).toBeVisible();
  await select(textbox, "B");
  await pickUp(page, page.getByRole("button", { name: GRIP }));
  await hover(page, textbox.getByText("D", { exact: true }), "bottom");
  await expect(page.locator("[data-drop-zone]")).toHaveCount(1);
  await page.keyboard.press("ControlOrMeta+z");
  await expect(page.getByRole("status")).toHaveText("Drag cancelled.");
  expect(await canvasShape(page)).toEqual([[["A", "B"], ["C"]], [["D"]]]);
  await expectClean(page, textbox);
  await page.mouse.up();
  expect(await canvasShape(page)).toEqual([[["A", "B"], ["C"]], [["D"]]]);
});

// ---- Step 6: a phone, by touch ------------------------------------------------

test.describe("at 390px by touch", () => {
  test.use({ viewport: { width: 390, height: 800 }, hasTouch: true });

  test("a touch drag on the grip moves a block to another section, without scrolling the page or overflowing it", async ({
    page,
  }) => {
    const { id, textbox } = await openPage(page, "Touch Drag", SEEDED());
    await textbox.getByText("A", { exact: true }).tap();
    const grip = page.getByRole("button", { name: GRIP });
    await expect(grip).toBeVisible();
    await expect(grip).toHaveCSS("touch-action", "none");
    const scrollY = await page.evaluate("window.scrollY");

    // Real touch input through the browser, so its own panning would show.
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: "touchStart" | "touchMove" | "touchEnd", x: number, y: number) =>
      cdp.send("Input.dispatchTouchEvent", {
        type,
        touchPoints: type === "touchEnd" ? [] : [{ x, y }],
      });
    const from = await centre(grip);
    await touch("touchStart", from.x, from.y);
    // D's top: the gap opens above D and pushes it down, under a still finger.
    const target = await centre(textbox.getByText("D", { exact: true }));
    const goal = { x: target.box.x + target.box.width / 2, y: target.box.y + 3 };
    for (let i = 1; i <= 12; i++) {
      await touch(
        "touchMove",
        from.x + ((goal.x - from.x) * i) / 12,
        from.y + ((goal.y - from.y) * i) / 12,
      );
    }
    // A gap opened on the way moves D: aim at its top again, as a finger would.
    for (let i = 0; i < 2; i++) {
      await page.evaluate(
        "new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))",
      );
      const again = await centre(textbox.getByText("D", { exact: true }));
      await touch("touchMove", again.x, again.box.y + 3);
    }
    await expect(page.getByRole("status")).toHaveText("Text: drop at block 1 of 2 in section 2.");
    await expect(page.locator("[data-drag-ghost]")).toHaveText("Text");
    const gap = await page.locator("[data-drop-zone]").boundingBox();
    const canvas = await textbox.boundingBox();
    if (!gap || !canvas) throw new Error("not drawn");
    expect(gap.x).toBeGreaterThanOrEqual(canvas.x);
    expect(gap.x + gap.width).toBeLessThanOrEqual(canvas.x + canvas.width);
    expect(await page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")).toBe(
      true,
    );
    expect(await page.evaluate("window.scrollY")).toBe(scrollY);
    await touch("touchEnd", 0, 0);

    await expect(page.getByRole("status")).toHaveText("Text moved: block 1 of 2 in section 2.");
    await expectClean(page, textbox);
    await save(page);
    expect((await storedEntry(id)).blocks).toEqual(doc(section(["B"], ["C"]), section(["A", "D"])));
  });

  // F-193: below 1024px the settings panel is a bottom sheet over the page's foot.
  test("releasing a dragged image over the settings sheet cancels, though a section lies under it", async ({
    page,
  }) => {
    const sections = Array.from({ length: 8 }, (_, i) => section([`S${i + 1} only`]));
    const { textbox } = await openPage(
      page,
      "Under The Sheet",
      doc(section([{ type: "image", attrs: { mediaId: "" } }, "S0 only"]), ...sections),
    );
    await textbox.getByText("No image chosen").tap();
    const sheet = page.getByRole("complementary", { name: "Image", exact: true });
    await expect(sheet).toBeVisible();
    const shape = await canvasShape(page);
    await pickUp(page, page.getByRole("button", { name: GRIP }));
    const over = await centre(sheet);
    await page.mouse.move(over.x, over.y, { steps: 8 });
    // The premise: a section is under the sheet at this point.
    expect(
      await page.evaluate(
        `document.elementsFromPoint(${over.x}, ${over.y}).some((el) => el.matches('[data-node="section"]'))`,
      ),
    ).toBe(true);
    await expect(page.getByRole("status")).toHaveText("Image: release to cancel.", {
      timeout: 1000,
    });
    await page.mouse.up();
    await expect(page.getByRole("status")).toHaveText("Drag cancelled.");
    expect(await canvasShape(page)).toEqual(shape);
  });
});

// F-196: on a landscape tablet the side panel shows. A touch on a tile is a
// tap, never a drag; touch drags by the grip only.
test.describe("a touch on a palette tile at 1280px", () => {
  test.use({ viewport: { width: 1280, height: 800 }, hasTouch: true });

  test("moving 20px never starts a drag", async ({ page }) => {
    const { textbox } = await openPage(page, "Touch Tile", SEEDED());
    await select(textbox, "A");
    const from = await centre(tile(page, "Text"));
    const fire = (type: string, dy: number) =>
      page.evaluate(
        `document.elementFromPoint(${from.x}, ${from.y}).dispatchEvent(new PointerEvent("${type}", { pointerId: 7, pointerType: "touch", isPrimary: true, bubbles: true, clientX: ${from.x}, clientY: ${from.y + dy} }))`,
      );
    await fire("pointerdown", 0);
    for (const dy of [4, 8, 14, 20]) {
      await fire("pointermove", dy);
      await page.evaluate(
        "new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))",
      );
    }
    await expect(page.locator("[data-drag-ghost]")).toHaveCount(0);
    await expect(page.locator("[data-drop-zone]")).toHaveCount(0);
    await fire("pointerup", 20);
    await expect(page.locator("[data-drag-ghost]")).toHaveCount(0);
  });

  test("a tap on the Line tile adds one line after the selected block", async ({ page }) => {
    const { textbox } = await openPage(page, "Tap Tile", doc(section(["First", "Last"])));
    await select(textbox, "First");
    await tile(page, "Line").tap();
    await expect(textbox.locator("hr")).toHaveCount(1);
    expect(await canvasShape(page)).toEqual([[["First", "", "Last"]]]);
  });
});
