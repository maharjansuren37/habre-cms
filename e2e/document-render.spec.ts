import { randomInt } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import {
  createAdmin,
  createDraftFor,
  deleteEntriesBy,
  deleteTestUser,
  setRole,
  type TestUser,
} from "./helpers/users.ts";

// Item 14a1, step 2: a v4 document (one TipTap document per entry, D169)
// renders on the public site as real elements, found here by role.

let editor: TestUser;

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({
    "X-Forwarded-For": `10.${randomInt(256)}.${randomInt(256)}.14`,
  });
  editor = createAdmin("Document Editor");
  await setRole(editor.email, "editor");
});

test.afterEach(async () => {
  await deleteEntriesBy(editor.email);
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
    blocksFormat: "v4",
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
