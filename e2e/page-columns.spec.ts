import { randomInt } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import { logIn } from "./helpers/auth.ts";
import {
  createAdmin,
  createDraftFor,
  deleteEntriesBy,
  deleteTestUser,
  setRole,
  type TestUser,
  withDatabase,
} from "./helpers/users.ts";

let editor: TestUser;

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({
    "X-Forwarded-For": `10.${randomInt(256)}.${randomInt(256)}.11`,
  });
  editor = createAdmin("Columns Editor");
  await setRole(editor.email, "editor");
});

test.afterEach(async () => {
  await deleteEntriesBy(editor.email);
  await deleteTestUser(editor.email);
});

const leaf = (id: string, text: string) => ({ id, type: "text", data: { text: [{ text }] } });
const columnsSection = (id: string, columns: string[][]) => ({
  id,
  type: "section",
  data: {
    layout: String(columns.length),
    children: columns.map((column, c) => column.map((text, i) => leaf(`${id}-${c}-${i}`, text))),
  },
});

async function publishPage(title: string, sections: unknown[]) {
  await createDraftFor(editor.email, title, [], {
    type: "page",
    blocksFormat: "v3",
    status: "published",
  });
  await withDatabase(
    (sql) => sql`update entries set blocks = ${sql.json(sections as never)} where title = ${title}`,
  );
}

test("a published page shows columns side by side on a wide screen and stacked in order on a phone", async ({
  page,
}) => {
  await publishPage("Column Layouts", [
    columnsSection("two", [["One"], ["Two"]]),
    columnsSection("three", [["Left"], [], ["Right"]]),
  ]);

  await page.setViewportSize({ width: 1024, height: 800 });
  await page.goto("/column-layouts");
  const two = page.locator('[data-columns="2"] [data-column]');
  await expect(two).toHaveText(["One", "Two"]);
  const [a, b] = [await two.nth(0).boundingBox(), await two.nth(1).boundingBox()];
  expect(a && b && Math.abs(a.y - b.y) < 2 && b.x > a.x + a.width - 1).toBe(true);

  // An empty middle column keeps its cell, so "Right" stays in the third.
  const three = page.locator('[data-columns="3"] [data-column]');
  await expect(three).toHaveCount(3);
  const [l, r] = [await three.nth(0).boundingBox(), await three.nth(2).boundingBox()];
  expect(l && r && r.x > l.x + 2 * (l.width * 0.9)).toBe(true);

  await page.setViewportSize({ width: 375, height: 800 });
  const [first, second] = [await two.nth(0).boundingBox(), await two.nth(1).boundingBox()];
  expect(first && second && second.y > first.y + first.height - 1).toBe(true);
  await expect(three.nth(1)).toBeHidden();
  const [left, right] = [await three.nth(0).boundingBox(), await three.nth(2).boundingBox()];
  expect(left && right && right.y > left.y + left.height - 1).toBe(true);
  // A string, so this file needs no DOM types.
  expect(await page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")).toBe(
    true,
  );
});

const writing = (page: Page) => page.locator("[data-section-id] [contenteditable=true]");
const columnsOf = (page: Page) => page.locator("[data-section-id] [data-columns] > div");

test("a two-column section opens as two editors, and an edit in column 2 saves in column 2", async ({
  page,
}) => {
  const id = await createDraftFor(editor.email, "Two Columns", [], {
    type: "page",
    blocksFormat: "v3",
  });
  await withDatabase(
    (sql) =>
      sql`update entries set blocks = ${sql.json([columnsSection("s1", [["Left"], ["Right"]])] as never)} where id = ${id}`,
  );
  await logIn(page, editor);
  await page.goto(`/admin/pages/${id}`);
  await expect(writing(page)).toHaveText(["Left", "Right"]);
  await expect(page.getByRole("region", { name: "Section 1, column 2 content" })).toBeVisible();

  await writing(page).nth(1).click();
  await page.keyboard.press("End");
  await page.keyboard.type(" side");
  const saved = page.waitForResponse((response) => response.request().method() === "POST");
  await page.getByRole("button", { name: "Save draft" }).click();
  await saved;
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();

  const [row] = await withDatabase((sql) => sql`select blocks from entries where id = ${id}`);
  const [stored] = row.blocks;
  expect(stored.data.layout).toBe("2");
  expect(stored.data.children[0][0].data.text).toEqual([{ text: "Left" }]);
  expect(stored.data.children[1][0].data.text).toEqual([{ text: "Right side" }]);
  await page.reload();
  await expect(writing(page)).toHaveText(["Left", "Right side"]);
});

test("the Columns control grows a section, merges it back in order, and saves what is left", async ({
  page,
}) => {
  await logIn(page, editor);
  await page.goto("/admin/pages/new");
  await page.getByPlaceholder("Page title").fill("Column Control");
  await writing(page).first().waitFor();
  await writing(page).first().click();
  await page.keyboard.type("One");

  await page.getByRole("radio", { name: "3 columns" }).check();
  await expect(page.getByText("Section 1 now has 3 columns.")).toBeAttached();
  await expect(writing(page)).toHaveCount(3);
  await writing(page).nth(1).click();
  await page.keyboard.type("Two");
  await writing(page).nth(2).click();
  await page.keyboard.type("Three");
  await expect(writing(page)).toHaveText(["One", "Two", "Three"]);

  // 3 -> 2 merges the third column into the second, nothing is dropped.
  await page.getByRole("radio", { name: "2 columns" }).check();
  await expect(page.getByText("Column 3 merged into column 2.", { exact: false })).toBeAttached();
  await expect(columnsOf(page)).toHaveCount(2);
  await expect(writing(page)).toHaveText(["One", "Two", "Three"]);
  await expect(columnsOf(page).nth(1).locator(".ce-block")).toHaveCount(2);

  await page.getByRole("radio", { name: "1 column" }).check();
  await expect(columnsOf(page)).toHaveCount(1);
  await expect(page.locator("[data-section-id] .ce-block")).toHaveText(["One", "Two", "Three"]);

  await page.getByRole("radio", { name: "2 columns" }).check();
  await expect(columnsOf(page)).toHaveCount(2);
  await page.getByRole("button", { name: "Save draft" }).click();
  await page.waitForURL(/\/admin\/pages\/[0-9a-f-]+$/);
  const id = new URL(page.url()).pathname.split("/").pop() ?? "";
  const [row] = await withDatabase((sql) => sql`select blocks from entries where id = ${id}`);
  const { layout, children } = row.blocks[0].data;
  expect(layout).toBe("2");
  expect(
    children[0].map((b: { data: { text: { text: string }[] } }) => b.data.text[0].text),
  ).toEqual(["One", "Two", "Three"]);
  expect(children[1]).toEqual([]);
  await page.reload();
  await expect(page.getByRole("radio", { name: "2 columns" })).toBeChecked();
});

test("the Columns control works from the keyboard alone", async ({ page }) => {
  await logIn(page, editor);
  await page.goto("/admin/pages/new");
  await writing(page).first().waitFor();
  const one = page.getByRole("radio", { name: "1 column" });
  await one.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("radio", { name: "2 columns" })).toBeChecked();
  await expect(page.getByRole("radio", { name: "2 columns" })).toBeFocused();
  await expect(writing(page)).toHaveCount(2);
});

test("a page of 30 sections with 3 columns each opens and saves within the bar", async ({
  page,
}) => {
  const id = await createDraftFor(editor.email, "Ninety Columns", [], {
    type: "page",
    blocksFormat: "v3",
  });
  const full = Array.from({ length: 30 }, (_, index) =>
    columnsSection(`s${index}`, [[`A${index}`], [`B${index}`], [`C${index}`]]),
  );
  await withDatabase(
    (sql) => sql`update entries set blocks = ${sql.json(full as never)} where id = ${id}`,
  );
  await logIn(page, editor);
  const started = Date.now();
  await page.goto(`/admin/pages/${id}`);
  await expect(writing(page)).toHaveCount(90, { timeout: 15_000 });
  const mounted = Date.now() - started;
  console.log(`30 sections x 3 columns mounted in ${mounted} ms`);
  // The spec's own bar for opening a full page: every editor ready in 10 s.
  expect(mounted).toBeLessThan(10_000);

  // "Saved" is already on screen before a save, so time the request itself.
  const response = page.waitForResponse((each) => each.request().method() === "POST");
  const saveStarted = Date.now();
  await page.getByRole("button", { name: "Save draft" }).click();
  await response;
  const saved = Date.now() - saveStarted;
  console.log(`90-column save round trip ${saved} ms`);
  // Round trip includes reading 90 editors in the browser, so it is an upper
  // bound on the quality bar's 1 s server-side save.
  expect(saved).toBeLessThan(2_000);
});

test("a column that cannot be saved stops the count change, with a message and nothing lost", async ({
  page,
}) => {
  const id = await createDraftFor(editor.email, "Unreadable Column", [], {
    type: "page",
    blocksFormat: "v3",
  });
  const list = { id: "l1", type: "list", data: { style: "bullet", items: [[{ text: "Milk" }]] } };
  const section = {
    id: "s1",
    type: "section",
    data: { layout: "2", children: [[leaf("a", "Left")], [list]] },
  };
  await withDatabase(
    (sql) => sql`update entries set blocks = ${sql.json([section] as never)} where id = ${id}`,
  );
  await logIn(page, editor);
  await page.goto(`/admin/pages/${id}`);
  await expect(writing(page)).toHaveText(["Left", "Milk"]);

  // A checklist is the one block the tools offer that v3 cannot store (F-35).
  await page.getByText("Milk").click();
  await columnsOf(page).nth(1).locator(".ce-toolbar__settings-btn").click();
  await page.getByText("Checklist", { exact: true }).click();

  // `click`, not `check`: the radio is meant to stay where it was.
  await page.getByRole("radio", { name: "1 column" }).click();
  await expect(page.getByText("The columns were not changed.")).toBeVisible();
  await expect(page.getByText("Section 1, column 2, block 1 is a checklist")).toBeVisible();
  await expect(page.getByRole("radio", { name: "2 columns" })).toBeChecked();
  await expect(columnsOf(page)).toHaveCount(2);
  await expect(page.getByText("Milk")).toBeVisible();
  await expect(page.getByText("Left")).toBeVisible();

  // Fixing the block is an edit, which clears the message.
  await columnsOf(page).nth(1).locator(".ce-toolbar__settings-btn").click();
  await page.getByText("Unordered", { exact: true }).click();
  await expect(page.getByText("The columns were not changed.")).toBeHidden();
  await page.getByRole("radio", { name: "1 column" }).check();
  await expect(columnsOf(page)).toHaveCount(1);
});

test("a column that opens with a heading starts level with one that opens with text", async ({
  page,
}) => {
  const heading = { id: "h", type: "heading", data: { text: [{ text: "Heading" }], level: 2 } };
  const section = {
    id: "s1",
    type: "section",
    data: { layout: "2", children: [[heading, leaf("a", "Below")], [leaf("b", "Beside")]] },
  };
  await publishPage("Level Columns", [section]);
  await page.setViewportSize({ width: 1024, height: 800 });
  await page.goto("/level-columns");
  const top = async (selector: string) => (await page.locator(selector).boundingBox())?.y ?? -1;
  const headingTop = await top("[data-column] h2");
  const textTop = await top("[data-column] >> text=Beside");
  expect(Math.abs(headingTop - textTop)).toBeLessThan(4);
});
