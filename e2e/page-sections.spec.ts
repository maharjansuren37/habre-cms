import { randomInt } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import { logIn } from "./helpers/auth.ts";
import { deleteTestMedia, uploadTestMedia } from "./helpers/media.ts";
import { STORAGE_REASON, skipWithoutStorage } from "./helpers/storage.ts";
import {
  createAdmin,
  createDraftFor as createDraftForFormat,
  deleteEntriesBy,
  deleteTestUser,
  setRole,
  type TestUser,
  withDatabase,
} from "./helpers/users.ts";

// Editor.js entries are v2/v3; the helper now defaults to v4 (removed in step 6).
const createDraftFor = (
  email: string,
  title: string,
  blocks: unknown,
  options: Parameters<typeof createDraftForFormat>[3] = {},
) => createDraftForFormat(email, title, blocks, { blocksFormat: "v2", ...options });

let editor: TestUser;

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "X-Forwarded-For": `10.${randomInt(256)}.${randomInt(256)}.9` });
  editor = createAdmin("Sections Editor");
  await setRole(editor.email, "editor");
});

test.afterEach(async () => {
  await deleteEntriesBy(editor.email);
  await deleteTestUser(editor.email);
});

const writing = (page: Page) => page.locator("[data-section-id] [contenteditable=true]");
const section = (n: number, of: number) => `(section ${n} of ${of})`;

const sectionOf = (id: string, text: string) => ({
  id,
  type: "section",
  data: {
    layout: "1",
    children: [[{ id: `${id}-t`, type: "text", data: { text: [{ text }] } }]],
  },
});

test("sections can be added, moved and saved, and come back in the order left", async ({
  page,
}) => {
  await logIn(page, editor);
  await page.goto("/admin/pages/new");
  await page.getByPlaceholder("Page title").fill("Sections Page");

  await writing(page).first().waitFor();
  await writing(page).first().click();
  await page.keyboard.type("First");
  // Adding a section moves focus into its editor, so typing goes straight there.
  await page.getByRole("button", { name: "Add blank section" }).click();
  await expect(writing(page).nth(1)).toBeFocused();
  await page.keyboard.type("Second");
  await page.getByRole("button", { name: "Add blank section" }).click();
  await expect(writing(page).nth(2)).toBeFocused();
  await page.keyboard.type("Third");

  await page.getByRole("button", { name: `Move up ${section(3, 3)}` }).click();
  await expect(writing(page)).toHaveText(["First", "Third", "Second"]);
  await expect(page.getByText("Section moved to position 2 of 3.")).toBeAttached();

  await page.getByRole("button", { name: "Save draft" }).click();
  await page.waitForURL(/\/admin\/pages\/[0-9a-f-]+$/);
  const id = new URL(page.url()).pathname.split("/").pop() ?? "";
  await page.reload();
  await expect(writing(page)).toHaveText(["First", "Third", "Second"]);

  const [row] = await withDatabase(
    (sql) =>
      sql`select blocks_format, jsonb_array_length(blocks) as n from entries where id = ${id}`,
  );
  expect(row).toMatchObject({ blocks_format: "v3", n: 3 });
});

test("removing a section asks first, and the last section cannot be removed", async ({ page }) => {
  const id = await createDraftFor(editor.email, "Removal Page", [], {
    type: "page",
    blocksFormat: "v3",
    // not via the editor: two sections already stored
  });
  await withDatabase(
    (sql) =>
      sql`update entries set blocks = ${sql.json([sectionOf("s1", "Keep me"), sectionOf("s2", "Drop me")] as never)} where id = ${id}`,
  );
  await logIn(page, editor);
  await page.goto(`/admin/pages/${id}`);
  await expect(writing(page)).toHaveText(["Keep me", "Drop me"]);

  await page.getByRole("button", { name: `Remove ${section(2, 2)}` }).click();
  await expect(page.getByText("Remove this section?")).toBeVisible();
  await page.getByRole("button", { name: "Keep" }).click();
  await expect(writing(page)).toHaveCount(2);

  await page.getByRole("button", { name: `Remove ${section(2, 2)}` }).click();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(writing(page)).toHaveText(["Keep me"]);
  await expect(page.getByRole("button", { name: /^Remove/ })).toHaveCount(0);
});

test("a page at 30 sections cannot take a 31st, and stays usable", async ({ page }) => {
  const id = await createDraftFor(editor.email, "Full Page", [], {
    type: "page",
    blocksFormat: "v3",
  });
  const thirty = Array.from({ length: 30 }, (_, index) =>
    sectionOf(`s${index}`, `Part ${index + 1}`),
  );
  await withDatabase(
    (sql) => sql`update entries set blocks = ${sql.json(thirty as never)} where id = ${id}`,
  );
  await logIn(page, editor);
  const started = Date.now();
  await page.goto(`/admin/pages/${id}`);
  await expect(writing(page)).toHaveCount(30);
  console.log(`30 sections mounted in ${Date.now() - started} ms`);

  await expect(page.getByRole("button", { name: "Add blank section" })).toBeDisabled();
  await expect(page.getByText("A page can have up to 30 sections.")).toBeVisible();

  const saveStarted = Date.now();
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  console.log(`30-section save round trip ${Date.now() - saveStarted} ms`);
});

test("a published page shows its sections in order, and skips an empty one", async ({ page }) => {
  const title = "Ordered Sections";
  await createDraftFor(editor.email, title, [], {
    type: "page",
    blocksFormat: "v3",
    status: "published",
  });
  const empty = { id: "s-empty", type: "section", data: { layout: "1", children: [[]] } };
  await withDatabase(
    (sql) =>
      sql`update entries set blocks = ${sql.json([sectionOf("s1", "Alpha"), empty, sectionOf("s2", "Beta"), sectionOf("s3", "Gamma")] as never)} where title = ${title}`,
  );
  await page.goto("/ordered-sections");
  const sections = page.locator("main section");
  await expect(sections).toHaveCount(3);
  await expect(sections).toHaveText(["Alpha", "Beta", "Gamma"]);
});

test("a page stored before sections opens as one section and is saved as v3 with its content intact", async ({
  page,
}) => {
  const blocks = [
    { id: "a", type: "text", data: { text: [{ text: "Hello " }, { text: "bold", bold: true }] } },
    { id: "b", type: "heading", data: { text: [{ text: "Heading" }], level: 2 } },
  ];
  const id = await createDraftFor(editor.email, "Before Sections", blocks, { type: "page" });
  await logIn(page, editor);
  await page.goto(`/admin/pages/${id}`);
  await expect(page.getByRole("group", { name: "Section 1 of 1", exact: true })).toBeVisible();
  await expect(page.locator("[data-section-id]")).toHaveCount(1);
  await expect(page.getByText("Hello")).toBeVisible();

  const saved = page.waitForResponse((response) => response.request().method() === "POST");
  await page.getByRole("button", { name: "Save draft" }).click();
  await saved;
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();

  const [row] = await withDatabase(
    (sql) => sql`select blocks_format, blocks from entries where id = ${id}`,
  );
  expect(row.blocks_format).toBe("v3");
  expect(row.blocks).toHaveLength(1);
  // The placeholder id the page loaded with never reaches storage.
  expect(row.blocks[0].id).not.toBe("legacy");
  expect(row.blocks[0].data.children[0]).toEqual(blocks);
});

test("an image in the second section renders on the public page", async ({ page }) => {
  test.skip(skipWithoutStorage, STORAGE_REASON);
  await logIn(page, editor);
  const origin = new URL(page.url()).origin;
  const uploaded = await uploadTestMedia(page.request, origin, "1x1.jpg", "A section pixel");
  try {
    const title = "Image Sections";
    await createDraftFor(editor.email, title, [], {
      type: "page",
      blocksFormat: "v3",
      status: "published",
    });
    const withImage = {
      id: "s2",
      type: "section",
      data: {
        layout: "1",
        children: [[{ id: "img", type: "image", data: { mediaId: uploaded.id } }]],
      },
    };
    await withDatabase(
      (sql) =>
        sql`update entries set blocks = ${sql.json([sectionOf("s1", "Intro"), withImage] as never)} where title = ${title}`,
    );
    await page.goto("/image-sections");
    await expect(
      page.locator("main section").nth(1).getByRole("img", { name: "A section pixel" }),
    ).toBeVisible();
  } finally {
    await deleteEntriesBy(editor.email);
    await deleteTestMedia(uploaded.id);
  }
});
