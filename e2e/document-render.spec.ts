import { randomInt } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import { buttonBlock, imageBlock, lineBlock, spaceBlock } from "./helpers/documents.ts";
import { deleteTestMedia, insertTestMediaRow } from "./helpers/media.ts";
import { resetSiteSettings } from "./helpers/site-settings.ts";
import {
  createAdmin,
  createDraftFor,
  deleteEntriesBy,
  deleteTestUser,
  setRole,
  type TestUser,
  withDatabase,
} from "./helpers/users.ts";

// Item 14a1, step 2: a v4 document (one TipTap document per entry, D169)
// renders on the public site as real elements, found here by role.

let editor: TestUser;
let mediaIds: string[];

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({
    "X-Forwarded-For": `10.${randomInt(256)}.${randomInt(256)}.14`,
  });
  mediaIds = [];
  editor = createAdmin("Document Editor");
  await setRole(editor.email, "editor");
});

test.afterEach(async () => {
  await resetSiteSettings(); // the home page test points it at an entry
  await deleteEntriesBy(editor.email);
  for (const id of mediaIds) await deleteTestMedia(id);
  await deleteTestUser(editor.email);
});

type Mark = { type: "bold" } | { type: "italic" } | { type: "link"; attrs: { href: string } };
const text = (value: string, marks?: Mark[]) => ({
  type: "text",
  text: value,
  ...(marks && { marks }),
});
const paragraph = (...content: ReturnType<typeof text>[]) => ({
  type: "paragraph",
  ...(content.length > 0 && { content }),
});
const heading = (level: number, value?: string) => ({
  type: "heading",
  attrs: { level },
  ...(value && { content: [text(value)] }),
});
const list = (type: "bulletList" | "orderedList", items: string[]) => ({
  type,
  content: items.map((item) => ({ type: "listItem", content: [paragraph(text(item))] })),
});
const section = (...columns: unknown[][]) => ({
  type: "section",
  attrs: { align: "top", background: "none" },
  content: columns.map((content) => ({ type: "column", content })),
});
const doc = (...sections: unknown[]) => ({ type: "doc", content: sections });

async function publish(type: "post" | "page", title: string, document: unknown) {
  await createDraftFor(editor.email, title, document, {
    type,
    status: "published",
  });
}

function sectionHolding(page: Page, name: string) {
  return page.locator("main section", { has: page.getByRole("heading", { name }) });
}

const studio = doc(
  section([
    heading(1, "Our studio"),
    paragraph(
      text("Plain, "),
      text("bold", [{ type: "bold" }]),
      text(", "),
      text("italic", [{ type: "italic" }]),
      text(" and "),
      text("a link", [{ type: "link", attrs: { href: "https://example.com/about" } }]),
      text("."),
    ),
  ]),
  // Nothing in it but an empty paragraph and an empty heading.
  section([paragraph(), heading(2)]),
  section([
    heading(2, "Services"),
    paragraph(),
    heading(3, "Weddings"),
    heading(4, "Details"),
    list("bulletList", ["Photos", "Films"]),
    list("orderedList", ["Book", "Shoot"]),
    { type: "blockquote", content: [paragraph(text("Worth every cent."))] },
  ]),
  section([paragraph(text("Left column"))], [paragraph(text("Right column"))]),
);

test("a published v4 page renders each node as its own element, found by role", async ({
  page,
}) => {
  await publish("page", "Studio Page", studio);
  await page.goto("/studio-page");
  const main = page.getByRole("main");

  // The page's level-1 heading is its only h1; the title is not drawn as one.
  await expect(main.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(main.getByRole("heading", { level: 1 })).toHaveText("Our studio");
  await expect(page.getByRole("heading", { name: "Studio Page" })).toHaveCount(0);

  await expect(main.getByRole("heading", { level: 2, name: "Services" })).toBeVisible();
  await expect(main.getByRole("heading", { level: 3, name: "Weddings" })).toBeVisible();
  await expect(main.getByRole("heading", { level: 4, name: "Details" })).toBeVisible();

  const lists = main.getByRole("list");
  await expect(lists).toHaveCount(2);
  await expect(lists.nth(0).getByRole("listitem")).toHaveText(["Photos", "Films"]);
  await expect(lists.nth(1).getByRole("listitem")).toHaveText(["Book", "Shoot"]);
  await expect(main.locator("ul")).toHaveCount(1);
  await expect(main.locator("ol")).toHaveCount(1);

  await expect(main.getByRole("blockquote")).toHaveText("Worth every cent.");
  await expect(main.getByRole("strong")).toHaveText("bold");
  await expect(main.getByRole("emphasis")).toHaveText("italic");
  await expect(main.getByRole("link", { name: "a link" })).toHaveAttribute(
    "href",
    "https://example.com/about",
  );

  // The empty section adds no element: four stored, three drawn.
  await expect(main.locator("section")).toHaveCount(3);
  // The empty paragraph beside "Services" adds no element; nor does the empty heading.
  // (Its only paragraph is the quote's own.)
  await expect(sectionHolding(page, "Services").locator("p")).toHaveCount(1);
  await expect(sectionHolding(page, "Services").locator("blockquote p")).toHaveCount(1);
  await expect(main.getByRole("heading")).toHaveCount(4);
});

test("a published v4 post's title is its h1", async ({ page }) => {
  await publish(
    "post",
    "Post Title Here",
    doc(section([heading(2, "Inside the post"), paragraph(text("Post body."))])),
  );
  await page.goto("/posts/post-title-here");
  const main = page.getByRole("main");

  await expect(main.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(main.getByRole("heading", { level: 1 })).toHaveText("Post Title Here");
  await expect(main.getByRole("heading", { level: 2, name: "Inside the post" })).toBeVisible();
  await expect(main.getByText("Post body.")).toBeVisible();
});

test("a page without a level-1 heading shows its title as the h1", async ({ page }) => {
  await publish("page", "Titled Page", doc(section([paragraph(text("Just words."))])));
  await page.goto("/titled-page");
  const main = page.getByRole("main");

  await expect(main.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(main.getByRole("heading", { level: 1 })).toHaveText("Titled Page");
});

test("a 2-column section sits side by side at 1280px and stacks at 390px", async ({ page }) => {
  await publish("page", "Column Page", studio);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/column-page");
  const left = page.getByText("Left column");
  const right = page.getByText("Right column");

  let [a, b] = [await left.boundingBox(), await right.boundingBox()];
  expect(a && b && Math.abs(a.y - b.y) < 2 && b.x >= a.x + a.width).toBe(true);

  await page.setViewportSize({ width: 390, height: 800 });
  [a, b] = [await left.boundingBox(), await right.boundingBox()];
  expect(a && b && b.y >= a.y + a.height && Math.abs(a.x - b.x) < 2).toBe(true);
  expect(await page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")).toBe(
    true,
  );
});

// Item 14a2, step 2: image, button, line and space on the public site.

async function seedMedia(altText: string, size = { width: 640, height: 480 }): Promise<string> {
  const id = await insertTestMediaRow({ uploadedBy: editor.email, altText, ...size });
  mediaIds.push(id);
  return id;
}

/** A media row that existed, so a block can point at it, and was then deleted. */
async function seedDeletedMedia(): Promise<string> {
  const id = await insertTestMediaRow({ uploadedBy: editor.email, altText: "Gone image" });
  await deleteTestMedia(id);
  return id;
}

async function blocksDocument() {
  const first = await seedMedia("Harbour at dawn", { width: 800, height: 600 });
  const second = await seedMedia("Market at noon", { width: 320, height: 200 });
  const gone = await seedDeletedMedia();
  return doc(
    section([
      heading(2, "Gallery"),
      imageBlock(first),
      buttonBlock("Book a session", "/contact"),
      lineBlock(),
      imageBlock(second),
      buttonBlock("See prices", "https://example.com/prices", "outline"),
    ]),
    // Nothing in it renders: a deleted image, a button without text, a button
    // without an address, and spacing.
    section([
      imageBlock(gone),
      buttonBlock("", "/nowhere"),
      buttonBlock("No address", ""),
      spaceBlock(),
    ]),
    // Only spaces: the whole section is dropped.
    section([spaceBlock(), spaceBlock()]),
    section([paragraph(text("Above")), spaceBlock(), paragraph(text("Below"))]),
  );
}

test("a published page draws an image, a button and a line as an img, a link and a separator", async ({
  page,
}) => {
  await publish("page", "Blocks Page", await blocksDocument());
  await page.goto("/blocks-page");
  const main = page.getByRole("main");

  const harbour = main.getByRole("img", { name: "Harbour at dawn" });
  await expect(harbour).toHaveAttribute("width", "800");
  await expect(harbour).toHaveAttribute("height", "600");
  await expect(harbour).toHaveAttribute("src", /^https?:\/\/.+\/e2e-test\/.+\.jpg$/);
  const market = main.getByRole("img", { name: "Market at noon" });
  await expect(market).toHaveAttribute("width", "320");
  await expect(market).toHaveAttribute("height", "200");

  await expect(main.getByRole("link", { name: "Book a session" })).toHaveAttribute(
    "href",
    "/contact",
  );
  await expect(main.getByRole("link", { name: "See prices" })).toHaveAttribute(
    "href",
    "https://example.com/prices",
  );
  await expect(main.getByRole("separator")).toHaveCount(1);
});

test("the first image loads at once with high priority and every later one lazily", async ({
  page,
}) => {
  await publish("page", "Priority Page", await blocksDocument());
  await page.goto("/priority-page");
  const images = page.getByRole("main").getByRole("img");

  await expect(images).toHaveCount(2);
  await expect(images.nth(0)).toHaveAttribute("fetchpriority", "high");
  await expect(images.nth(0)).not.toHaveAttribute("loading", /.*/);
  await expect(images.nth(1)).toHaveAttribute("loading", "lazy");
  await expect(images.nth(1)).not.toHaveAttribute("fetchpriority", /.*/);
});

test("a deleted image, an empty button and a section of spaces add no element", async ({
  page,
}) => {
  await publish("page", "Nothing Page", await blocksDocument());
  await page.goto("/nothing-page");
  const main = page.getByRole("main");

  // Four sections stored, two drawn: the second holds nothing that renders and
  // the third only spaces.
  await expect(main.locator("section")).toHaveCount(2);
  await expect(main.locator("img")).toHaveCount(2);
  await expect(main.locator("a")).toHaveCount(2);
  await expect(main.locator("hr")).toHaveCount(1);
  await expect(main.getByText("No address")).toHaveCount(0);
  // A space between two rendered blocks is spacing only: no text, nothing announced.
  const between = main.locator("section", { has: page.getByText("Above") });
  await expect(between.locator("div[aria-hidden='true']:empty")).toHaveCount(1);
  expect(await main.locator("div[aria-hidden='true']:empty").count()).toBe(1);
});

test("an image's alt text is announced once and there is no figcaption (F-79)", async ({
  page,
}) => {
  await publish("page", "Alt Page", await blocksDocument());
  await page.goto("/alt-page");
  const main = page.locator("main");

  const snapshot = await main.ariaSnapshot();
  expect(snapshot.split("Harbour at dawn").length - 1).toBe(1);
  expect(snapshot.split("Market at noon").length - 1).toBe(1);
  await expect(page.locator("figcaption")).toHaveCount(0);
  await expect(page.locator("figure")).toHaveCount(0);
});

test("a post draws an image the same way", async ({ page }) => {
  const id = await seedMedia("Post picture", { width: 100, height: 50 });
  await publish("post", "Image Post", doc(section([imageBlock(id), buttonBlock("Go", "/x")])));
  await page.goto("/posts/image-post");
  const image = page.getByRole("main").getByRole("img", { name: "Post picture" });

  await expect(image).toHaveAttribute("width", "100");
  await expect(image).toHaveAttribute("height", "50");
  await expect(image).toHaveAttribute("fetchpriority", "high");
  await expect(image).not.toHaveAttribute("loading", /.*/);
  await expect(page.getByRole("main").getByRole("link", { name: "Go" })).toBeVisible();
});

test("the chosen home page draws an image the same way", async ({ page }) => {
  const id = await seedMedia("Home picture", { width: 90, height: 60 });
  const pageId = await createDraftFor(
    editor.email,
    "Home Blocks",
    doc(section([imageBlock(id), lineBlock()])),
    { type: "page", status: "published" },
  );
  await withDatabase(async (sql) => {
    await sql`update site_settings set home_page_id = ${pageId} where id = 1`;
  });
  await page.goto("/");
  const main = page.getByRole("main");
  const image = main.getByRole("img", { name: "Home picture" });

  await expect(image).toHaveAttribute("width", "90");
  await expect(image).toHaveAttribute("height", "60");
  await expect(image).toHaveAttribute("fetchpriority", "high");
  await expect(main.getByRole("separator")).toHaveCount(1);
});

test("a published page holding 30 images answers in under 500 ms", async ({ page }) => {
  const ids = await Promise.all(
    Array.from({ length: 30 }, (_, index) => seedMedia(`Gallery picture ${index + 1}`)),
  );
  await publish("page", "Thirty Images", doc(section(ids.map((id) => imageBlock(id)))));

  const timings: number[] = [];
  for (let i = 0; i < 5; i++) {
    const before = Date.now();
    const response = await page.request.get("/thirty-images");
    expect(response.status()).toBe(200);
    expect(await response.text()).toContain("Gallery picture 30");
    timings.push(Date.now() - before);
  }
  console.log(`30 images: published page ${timings.join(", ")} ms`);
  expect(Math.max(...timings)).toBeLessThan(500);
});
