import { randomInt } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import { logIn } from "./helpers/auth.ts";
import { deleteTestMedia, uploadTestMedia } from "./helpers/media.ts";
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
let mediaId: string;
let filename: string;
let otherId: string;
let otherFilename: string;

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({
    "X-Forwarded-For": `10.${randomInt(256)}.${randomInt(256)}.14`,
  });
  editor = createAdmin("Image Text Editor");
  await setRole(editor.email, "editor");
  await logIn(page, editor);
  const origin = new URL(page.url()).origin;
  const first = await uploadTestMedia(page.request, origin, "1x1.png", "A fixture pixel");
  mediaId = first.id;
  filename = first.filename;
  const second = await uploadTestMedia(page.request, origin, "1x1.jpg", "Another pixel");
  otherId = second.id;
  otherFilename = second.filename;
});

test.afterEach(async () => {
  await deleteEntriesBy(editor.email);
  await deleteTestMedia(mediaId);
  await deleteTestMedia(otherId);
  await deleteTestUser(editor.email);
});

const leaf = (id: string, text: string) => ({ id, type: "text", data: { text: [{ text }] } });
const plain = (id: string, text: string) => ({
  id,
  type: "section",
  data: { layout: "1", children: [[leaf(`${id}-a`, text)]] },
});
const hero = (id: string) => ({ id, type: "hero", data: { heading: "Welcome", text: "" } });
const imageText = (id: string, data: Record<string, unknown> = {}) => ({
  id,
  type: "image-text",
  data: { mediaId, heading: "Our story", text: "Since 1990.", ...data },
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

test("an image and text section shows its picture, heading, text and button in order", async ({
  page,
}) => {
  await publishPage("IT Public", [
    hero("h1"),
    imageText("i1", { button: { label: "Read on", href: "/more" } }),
    plain("s1", "After"),
  ]);
  await page.goto("/it-public");
  const section = page.locator('section[data-kind="image-text"]');
  await expect(section.locator("img")).toHaveAttribute("alt", "A fixture pixel");
  await expect(section.locator("h2")).toHaveText("Our story");
  await expect(section.getByText("Since 1990.")).toBeVisible();
  await expect(section.getByRole("link", { name: "Read on" })).toHaveAttribute("href", "/more");
  const html = await section.innerHTML();
  expect(html.indexOf("<img")).toBeLessThan(html.indexOf("<h2"));
  expect(html.indexOf("<h2")).toBeLessThan(html.indexOf("Since 1990."));
  expect(html.indexOf("Since 1990.")).toBeLessThan(html.indexOf("Read on"));
});

test("a heading with markup is shown as text, never as an element", async ({ page }) => {
  await publishPage("IT Escape", [imageText("i1", { heading: "<b>x</b>" })]);
  await page.goto("/it-escape");
  await expect(page.locator('section[data-kind="image-text"] h2')).toHaveText("<b>x</b>");
  await expect(page.locator('section[data-kind="image-text"] h2 b')).toHaveCount(0);
});

test("with the media row gone, the text still shows and the picture does not", async ({ page }) => {
  await publishPage("IT Missing", [imageText("i1")]);
  await withDatabase((sql) => sql`delete from media where id = ${mediaId}`);
  await page.goto("/it-missing");
  const section = page.locator('section[data-kind="image-text"]');
  await expect(section.locator("h2")).toHaveText("Our story");
  await expect(section.locator("img")).toHaveCount(0);
});

test("the picture sits beside the text on a wide screen and above it on a narrow one", async ({
  page,
}) => {
  await publishPage("IT Layout", [imageText("i1")]);
  const box = async () => {
    const image = await page.locator('section[data-kind="image-text"] img').boundingBox();
    const heading = await page.locator('section[data-kind="image-text"] h2').boundingBox();
    if (!image || !heading) throw new Error("image or heading not laid out");
    return { image, heading };
  };
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/it-layout");
  let { image, heading } = await box();
  expect(image.x + image.width).toBeLessThanOrEqual(heading.x);

  await page.setViewportSize({ width: 375, height: 800 });
  await page.reload();
  ({ image, heading } = await box());
  expect(image.y + image.height).toBeLessThanOrEqual(heading.y);
  expect(await page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")).toBe(
    true,
  );
});

const seedDraft = async (title: string, sections: unknown[]) => {
  const id = await createDraftFor(editor.email, title, [], { type: "page", blocksFormat: "v3" });
  await withDatabase(
    (sql) => sql`update entries set blocks = ${sql.json(sections as never)} where id = ${id}`,
  );
  return id;
};
const storedBlocks = async (id: string) => {
  const [row] = await withDatabase((sql) => sql`select blocks from entries where id = ${id}`);
  return row.blocks as Record<string, unknown>[];
};
const field = (page: Page, name: string) => page.getByLabel(name, { exact: false });
const save = async (page: Page) => {
  const saved = page.waitForResponse((response) => response.request().method() === "POST");
  await page.getByRole("button", { name: "Save draft" }).click();
  await saved;
};
const pick = async (page: Page, name: string) => {
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByText(name).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
};

test("an image and text section opens with its picture and fields, and a new picture saves", async ({
  page,
}) => {
  const id = await seedDraft("IT Form", [
    imageText("i1", { button: { label: "Read on", href: "/more" } }),
  ]);
  await page.goto(`/admin/pages/${id}`);
  await expect(page.getByText("Alt text: A fixture pixel")).toBeVisible();
  await expect(field(page, "Heading (required)")).toHaveValue("Our story");
  await expect(field(page, "Button label")).toHaveValue("Read on");
  await expect(page.getByRole("radio", { name: /column/ })).toHaveCount(0);
  await expect(page.getByText("Image and text", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Change image" }).click();
  await pick(page, otherFilename);
  await expect(page.getByRole("button", { name: "Change image" })).toBeFocused();
  await expect(page.getByText("Alt text: Another pixel")).toBeVisible();
  await field(page, "Heading (required)").fill("New story");
  await save(page);
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  expect((await storedBlocks(id))[0]).toEqual(
    imageText("i1", {
      mediaId: otherId,
      heading: "New story",
      button: { label: "Read on", href: "/more" },
    }),
  );
  await page.reload();
  await expect(page.getByText("Alt text: Another pixel")).toBeVisible();
});

test("Move and Remove work among other sections", async ({ page }) => {
  const id = await seedDraft("IT Order", [plain("s1", "First"), imageText("i1"), hero("h1")]);
  await page.goto(`/admin/pages/${id}`);
  await page
    .locator('[data-section-id="i1"]')
    .getByRole("button", { name: /Move up/ })
    .click();
  await page
    .locator('[data-section-id="i1"]')
    .getByRole("button", { name: /^Remove/ })
    .click();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await save(page);
  expect((await storedBlocks(id)).map((each) => each.type)).toEqual(["section", "hero"]);
});

test("Add image and text puts focus on Choose image, and the page shows it publicly", async ({
  page,
}) => {
  await page.goto("/admin/pages/new");
  await page.getByPlaceholder("Page title").fill("IT Added");
  await page.locator("[data-section-id] [contenteditable=true]").first().waitFor();
  await page.getByRole("button", { name: "Add image and text" }).click();
  await expect(page.locator("[data-section-id]")).toHaveCount(2);
  await expect(page.getByText("Image and text section added. Now 2 sections.")).toBeAttached();
  await expect(page.getByRole("button", { name: "Choose image" })).toBeFocused();

  await page.keyboard.press("Enter");
  await pick(page, filename);
  await field(page, "Heading (required)").fill("Made by hand");
  await save(page);
  await page.waitForURL(/\/admin\/pages\/[0-9a-f-]+$/);
  const id = new URL(page.url()).pathname.split("/").pop() ?? "";
  const stored = await storedBlocks(id);
  expect(stored.map((each) => each.type)).toEqual(["section", "image-text"]);
  expect(stored[1]?.data).toEqual({ mediaId, heading: "Made by hand", text: "" });
  await withDatabase(
    (sql) => sql`update entries set status = 'published', published_at = now() where id = ${id}`,
  );
  await page.goto("/it-added");
  await expect(page.locator('section[data-kind="image-text"] h2')).toHaveText("Made by hand");
  await expect(page.locator('section[data-kind="image-text"] img')).toHaveAttribute(
    "alt",
    "A fixture pixel",
  );
});

test("with no image the save is refused, naming the section, and typed text is kept", async ({
  page,
}) => {
  const id = await seedDraft("IT Refusal", [plain("s1", "First"), imageText("i1")]);
  await page.goto(`/admin/pages/${id}`);
  await page.getByRole("button", { name: "Add image and text" }).click();
  await field(page, "Heading (required)").last().fill("Typed text");
  await save(page);
  await expect(page.getByText("Section 3 (image and text): choose an image.")).toBeVisible();
  await expect(field(page, "Heading (required)").last()).toHaveValue("Typed text");
  expect(await storedBlocks(id)).toHaveLength(2);
});

test("a picture deleted from the library is flagged, and the save asks for another", async ({
  page,
}) => {
  const id = await seedDraft("IT Gone", [imageText("i1", { mediaId: otherId })]);
  await withDatabase((sql) => sql`delete from media where id = ${otherId}`);
  await page.goto(`/admin/pages/${id}`);
  await expect(
    page.getByText("This image is no longer in the library. Choose another."),
  ).toBeVisible();
  await save(page);
  await expect(page.getByText("Section 1 (image and text): choose an image.")).toBeVisible();
  await page.getByRole("button", { name: "Choose image" }).click();
  await pick(page, filename);
  await save(page);
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  expect((await storedBlocks(id))[0]).toMatchObject({ data: { mediaId } });
});

test("a javascript: link is refused", async ({ page }) => {
  const id = await seedDraft("IT Link", [imageText("i1")]);
  await page.goto(`/admin/pages/${id}`);
  await field(page, "Button label").fill("Go");
  await field(page, "Button link").fill("javascript:alert(1)");
  await save(page);
  await expect(page.getByText("the button link cannot be used.", { exact: false })).toBeVisible();
  expect(JSON.stringify(await storedBlocks(id))).not.toContain("javascript");
});

test("at 30 sections all four add buttons are disabled", async ({ page }) => {
  const thirty = Array.from({ length: 30 }, (_, n) => plain(`s${n}`, `Section ${n}`));
  const id = await seedDraft("IT Limit", thirty);
  await page.goto(`/admin/pages/${id}`);
  for (const name of [
    "Add blank section",
    "Add hero section",
    "Add call to action",
    "Add image and text",
  ])
    await expect(page.getByRole("button", { name })).toBeDisabled();
});

test("a 30-section page of all four kinds saves in under 1 s and serves in under 500 ms", async ({
  page,
}) => {
  const cta = (id: string) => ({
    id,
    type: "cta",
    data: { heading: "Join", text: "Text", button: { label: "Go", href: "/go" } },
  });
  const sections = Array.from({ length: 30 }, (_, index) => {
    const id = `s${index}`;
    if (index % 4 === 0) return cta(id);
    if (index % 4 === 1) return { ...hero(id), data: { heading: "Hi", text: "Text" } };
    if (index % 4 === 2) return imageText(id, { mediaId: index % 8 === 2 ? mediaId : otherId });
    return plain(id, "Body");
  });
  const id = await seedDraft("IT Thirty", sections);
  await page.goto(`/admin/pages/${id}`);
  await expect(page.locator("[data-section-id]")).toHaveCount(30);
  await expect(page.locator("[data-section-id] [contenteditable=true]")).toHaveCount(7);

  const started = Date.now();
  await save(page);
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  const saveMs = Date.now() - started;
  console.log(`30-section four-kind page save round trip ${saveMs} ms`);
  expect(saveMs).toBeLessThan(1000);

  await withDatabase(
    (sql) => sql`update entries set status = 'published', published_at = now() where id = ${id}`,
  );
  const times: number[] = [];
  for (let attempt = 0; attempt < 5; attempt++) {
    const begin = Date.now();
    const response = await page.request.get("/it-thirty");
    expect(response.ok()).toBe(true);
    times.push(Date.now() - begin);
  }
  console.log(`public page response times ${times.join(", ")} ms`);
  expect(Math.max(...times)).toBeLessThan(500);
});
