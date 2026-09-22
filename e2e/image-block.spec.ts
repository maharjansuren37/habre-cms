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
  storedEntry,
  type TestUser,
} from "./helpers/users.ts";

let author: TestUser;
let mediaId: string;
let filename: string;

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "X-Forwarded-For": `10.${randomInt(256)}.${randomInt(256)}.3` });
  author = createAdmin("Image Block Author");
  await setRole(author.email, "author");
  await logIn(page, author);
  const origin = new URL(page.url()).origin;
  const uploaded = await uploadTestMedia(page.request, origin, "1x1.jpg", "A fixture pixel");
  mediaId = uploaded.id;
  filename = uploaded.filename;
});

test.afterEach(async () => {
  // Media and entries both reference the user - delete them first, or the
  // user's own delete violates a foreign key.
  await deleteTestMedia(mediaId);
  await deleteEntriesBy(author.email);
  await deleteTestUser(author.email);
});

/** Focuses the editor's first (empty) block and opens the + block-type menu. */
async function openBlockMenu(page: Page) {
  await page.locator("[contenteditable=true]").first().click();
  await page.locator(".ce-toolbar__plus").click();
  await page.locator(".ce-popover-item__title", { hasText: "Image" }).waitFor();
}

async function insertImageBlock(page: Page) {
  await openBlockMenu(page);
  await page.locator(".ce-popover-item__title", { hasText: "Image" }).click();
  await page.getByRole("button", { name: "Choose image" }).waitFor();
}

test("the dialog's Escape key, backdrop click and Close button each dismiss it without selecting anything", async ({
  page,
}) => {
  await page.goto("/admin/posts/new");
  await insertImageBlock(page);

  await page.getByRole("button", { name: "Choose image" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByText(filename).waitFor();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Choose image" })).toBeVisible();

  await page.getByRole("button", { name: "Choose image" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByText(filename).waitFor();
  // Outside the dialog's own centered box - the backdrop, not its content.
  await page.mouse.click(5, 5);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Choose image" })).toBeVisible();

  await page.getByRole("button", { name: "Choose image" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Choose image" })).toBeVisible();
});

test("choosing an image from the dialog shows it with its alt text, and only its media id is saved", async ({
  page,
}) => {
  await page.goto("/admin/posts/new");
  await page.getByRole("textbox", { name: "Title" }).fill("A post with an image");
  await insertImageBlock(page);

  await page.getByRole("button", { name: "Choose image" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByText(filename).click();

  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Choose image" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Change image" })).toBeVisible();
  await expect(page.getByText("A fixture pixel")).toBeVisible();

  await page.getByRole("button", { name: "Save draft" }).click();
  await page.waitForURL(/\/admin\/posts\/[0-9a-f-]{36}$/);
  const id = page.url().split("/").pop() as string;

  const { blocks } = await storedEntry(id);
  const imageBlocks = (blocks as { type: string; data: unknown }[]).filter(
    (b) => b.type === "image",
  );
  expect(imageBlocks).toHaveLength(1);
  expect(imageBlocks[0].data).toEqual({ mediaId });
});

test("picking an image leaves keyboard focus on the new Change image button, not lost to <body>", async ({
  page,
}) => {
  // F-76: everything outside an open modal <dialog> is inert, so the dialog
  // has to actually close before focus can move to the button renderContent()
  // just inserted - closing the dialog around the same time it removes the
  // "Choose image" button that focus would otherwise have been restored to.
  await page.goto("/admin/posts/new");
  await insertImageBlock(page);

  await page.getByRole("button", { name: "Choose image" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByText(filename).click();

  await expect(page.getByRole("button", { name: "Change image" })).toBeFocused();
});

test("an empty library shows a link to /admin/media instead of nothing to pick", async ({
  page,
}) => {
  // The picker is shared across everyone (D54) - genuinely empty means no
  // media row anywhere, so the beforeEach's own upload has to go first.
  await deleteTestMedia(mediaId);

  await page.goto("/admin/posts/new");
  await insertImageBlock(page);
  await page.getByRole("button", { name: "Choose image" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();

  const uploadLink = page.getByRole("link", { name: "Upload one" });
  await expect(uploadLink).toBeVisible();
  await expect(uploadLink).toHaveAttribute("href", "/admin/media");
  await expect(uploadLink).toHaveAttribute("target", "_blank");
});

test("reopening a saved post shows its image immediately, with no picker round trip", async ({
  page,
}) => {
  const id = await createDraftFor(author.email, "Reopened With Image", [
    { id: "img1", type: "image", data: { mediaId } },
  ]);

  const pickerRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/admin/media/picker")) pickerRequests.push(request.url());
  });

  await page.goto(`/admin/posts/${id}`);
  await expect(page.getByRole("button", { name: "Change image" })).toBeVisible();
  await expect(page.getByText("A fixture pixel")).toBeVisible();
  await expect(page.getByRole("button", { name: "Choose image" })).toHaveCount(0);
  expect(pickerRequests).toHaveLength(0);
});

test("a published post with an image renders a real <img> on the public site", async ({ page }) => {
  const title = "Published With Image";
  await createDraftFor(author.email, title, [{ id: "img1", type: "image", data: { mediaId } }], {
    status: "published",
  });
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  await page.goto(`/posts/${slug}`);
  const img = page.getByRole("img", { name: "A fixture pixel" });
  await expect(img).toBeVisible();
  await expect(img).toHaveAttribute("src", /.+/);
});

test("deleting the image file degrades gracefully instead of crashing either side", async ({
  page,
}) => {
  const title = "Image Later Deleted";
  const id = await createDraftFor(
    author.email,
    title,
    [
      { id: "t1", type: "text", data: { text: [{ text: "Text that must survive." }] } },
      { id: "img1", type: "image", data: { mediaId } },
    ],
    { status: "published" },
  );
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  const origin = new URL(page.url()).origin;
  const deleteResponse = await page.request.post(`${origin}/admin/media/${mediaId}/delete`, {
    headers: { Origin: origin },
  });
  expect(deleteResponse.ok()).toBe(true);

  // The editor: the block shows as unavailable, not a crash.
  await page.goto(`/admin/posts/${id}`);
  await expect(page.getByText("This image is no longer available.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Choose image" })).toBeVisible();

  // The public page: the block is silently dropped, the rest of the post is not.
  const response = await page.goto(`/posts/${slug}`);
  expect(response?.status()).toBe(200);
  await expect(page.getByText("Text that must survive.")).toBeVisible();
  expect(await page.locator("main img").count()).toBe(0);
});
