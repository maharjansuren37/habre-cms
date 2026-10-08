import { randomInt } from "node:crypto";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { logIn } from "./helpers/auth.ts";
import { imageBlock, inSection, textDocument } from "./helpers/documents.ts";
import { deleteTestMedia, uploadTestMedia } from "./helpers/media.ts";
import { createSite, createSiteAdmin, deleteSite, siteUrl } from "./helpers/sites.ts";
import { STORAGE_REASON, skipWithoutStorage } from "./helpers/storage.ts";
import {
  createAdmin,
  createDraftFor,
  deleteEntriesBy,
  deleteTestUser,
  type TestUser,
  withDatabase,
} from "./helpers/users.ts";

// F-100: the policy is proven by walking every screen with it enforced and
// seeing nothing refused. A violation blocks silently - a missing image, an
// editor that never loads - so each one is collected from both the page's own
// `securitypolicyviolation` event and Chromium's console error.

// The e2e project is typechecked without the DOM library (tsconfig.node.json),
// so the little of the browser these tests touch is described here.
type BrowserGlobals = {
  document: {
    addEventListener(
      type: "securitypolicyviolation",
      listener: (event: {
        violatedDirective: string;
        blockedURI: string;
        sourceFile: string;
        lineNumber: number;
      }) => void,
    ): void;
  };
  reportCspViolation(violation: string): void;
};

let admin: TestUser;
let mediaId: string | undefined;
let violations: string[];

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({
    "X-Forwarded-For": `10.${randomInt(256)}.${randomInt(256)}.13`,
  });
  admin = createAdmin("CSP Admin");
  mediaId = undefined;
  violations = [];

  await page.exposeFunction("reportCspViolation", (violation: string) => {
    violations.push(violation);
  });
  await page.addInitScript(() => {
    const browser = globalThis as unknown as BrowserGlobals;
    browser.document.addEventListener("securitypolicyviolation", (event) => {
      browser.reportCspViolation(
        `${event.violatedDirective} blocked ${event.blockedURI || "inline"} ` +
          `(from ${event.sourceFile || "unknown"}:${event.lineNumber})`,
      );
    });
  });
  page.on("console", (message) => {
    if (message.text().includes("Content Security Policy")) violations.push(message.text());
  });
});

test.afterEach(async () => {
  // Media and entries both reference the user, so they go first.
  if (mediaId) await deleteTestMedia(mediaId);
  await deleteEntriesBy(admin.email);
  await deleteTestUser(admin.email);
});

/** Uploads the fixture pixel through the real action; needs a logged-in page. */
async function uploadPixel(page: Page): Promise<string> {
  const uploaded = await uploadTestMedia(
    page.request,
    new URL(page.url()).origin,
    "1x1.jpg",
    "A CSP pixel",
  );
  mediaId = uploaded.id;
  return uploaded.filename;
}

test("HTML pages carry the Content-Security-Policy, and neither area allows inline styles or data: images", async ({
  page,
}) => {
  const publicPage = await page.goto(siteUrl("/"));
  const publicPolicy = publicPage?.headers()["content-security-policy"] ?? "";
  expect(publicPolicy).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+'/);
  // The public area also allows this response's nonce, for the brand style (18a1).
  expect(publicPolicy).toMatch(/style-src 'self' 'nonce-[A-Za-z0-9+/=]+';/);
  expect(publicPolicy).not.toContain("unsafe-inline");

  const adminPage = await page.goto("/admin/login");
  const adminPolicy = adminPage?.headers()["content-security-policy"] ?? "";
  expect(adminPolicy).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+'/);
  expect(adminPolicy).toContain("style-src 'self';");
  // Dropped in 14a3, once nothing in the editor needed them.
  expect(adminPolicy).not.toContain("unsafe-inline");
  expect(adminPolicy).not.toContain("data:");
});

test("the public site renders with nothing refused by the policy", async ({ page }) => {
  await logIn(page, admin);
  await createDraftFor(
    admin.email,
    "CSP Post",
    inSection({
      type: "paragraph",
      content: [
        { type: "text", text: "Some " },
        { type: "text", text: "bold", marks: [{ type: "bold" }] },
      ],
    }),
    { status: "published" },
  );
  await createDraftFor(admin.email, "CSP Page", textDocument("A page."), {
    status: "published",
    type: "page",
  });

  await page.goto(siteUrl("/posts"));
  await expect(page.getByRole("link", { name: "CSP Post" })).toBeVisible();

  await page.goto(siteUrl("/posts/csp-post"));
  await expect(page.getByText("Some bold")).toBeVisible();

  await page.goto(siteUrl("/csp-page"));
  await expect(page.getByText("A page.")).toBeVisible();

  const missing = await page.goto(siteUrl("/no-such-page-for-csp"));
  expect(missing?.status()).toBe(404);

  expect(violations).toEqual([]);
});

test("/admin/preview carries the public-style policy with a style nonce and renders with nothing refused (18b4b)", async ({
  page,
}) => {
  const siteId = await createSite("csp-preview");
  try {
    const previewAdmin = await createSiteAdmin(siteId, "CSP Preview Admin");
    await withDatabase(async (sql) => {
      const [entry] = await sql<{ id: string }[]>`
        insert into entries (site_id, type, title, slug, blocks, blocks_format, status, author_id)
        select ${siteId}, 'page', 'Preview Home', 'preview-home',
               ${sql.json(textDocument("Drafted text.") as never)}, 'v4', 'draft', id
        from users where email = ${previewAdmin.email}
        returning id
      `;
      await sql`
        update site_settings set home_page_id = ${entry.id}, brand_color = '#aa5500'
        where site_id = ${siteId}
      `;
    });
    await logIn(page, previewAdmin);
    const response = await page.goto("/admin/preview");
    const policy = response?.headers()["content-security-policy"] ?? "";
    expect(policy).toMatch(/style-src 'self' 'nonce-[A-Za-z0-9+/=]+';/);
    expect(policy).not.toContain("unsafe-inline");
    await expect(page.getByText("Drafted text.")).toBeVisible();
    expect(violations).toEqual([]);
  } finally {
    await deleteSite(siteId);
  }
});

test("a published page's image loads under the public policy with nothing refused", async ({
  page,
}) => {
  test.skip(skipWithoutStorage, STORAGE_REASON);
  await logIn(page, admin);
  await uploadPixel(page);
  await createDraftFor(admin.email, "CSP Image Page", inSection(imageBlock(mediaId as string)), {
    status: "published",
    type: "page",
  });

  await page.goto(siteUrl("/csp-image-page"));
  const image = page.getByRole("main").getByRole("img", { name: "A CSP pixel" });
  await expect(image).toBeVisible();
  await expect
    .poll(() => image.evaluate((element) => (element as { naturalWidth: number }).naturalWidth))
    .toBeGreaterThan(0);

  expect(violations).toEqual([]);
});

test("the editor's toolbar, menu, link dialog, picker and panel, then posts, media, settings and users, work with nothing refused by the policy", async ({
  page,
}) => {
  test.skip(skipWithoutStorage, STORAGE_REASON);
  await logIn(page, admin);
  const filename = await uploadPixel(page);

  // The editor: text, the block toolbar's Bold, a link through its dialog, a
  // move, the Text style menu, and an image block's panel and media picker.
  await page.goto("/admin/posts/new");
  await page.getByRole("textbox", { name: "Title" }).fill("CSP Editor Post");
  const writing = page.getByRole("textbox", { name: "Post content" });
  await writing.click();
  await page.keyboard.type("Make this bold and linked");
  // Let the editor settle after typing; a selection made while it is still
  // catching up is sometimes lost (F-152).
  await expect(writing).toHaveText("Make this bold and linked");
  await page.evaluate(
    "new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))",
  );
  await page.keyboard.press("Shift+Control+ArrowLeft");
  // ProseMirror reads a keyboard selection from `selectionchange`, a separate task.
  await page.evaluate("new Promise((done) => requestAnimationFrame(() => setTimeout(done)))");
  await page.getByRole("button", { name: "Bold" }).click();
  await expect(writing.locator("strong")).toHaveText("linked");
  await page.getByRole("button", { name: "Link" }).click();
  const dialog = page.getByRole("dialog", { name: "Add a link" });
  await dialog.getByLabel("Web address").fill("https://example.com/");
  await dialog.getByRole("button", { name: "Add link" }).click();
  await expect(writing.locator("a")).toHaveAttribute("href", "https://example.com/");

  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Moved up");
  await page
    .getByRole("toolbar", { name: "Text" })
    .getByRole("button", { name: "Move up", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Text moved up: block 1 of 2 in section 1.");
  await page.getByRole("button", { name: /^Text style:/ }).click();
  await expect(page.getByRole("menu", { name: "Text style" })).toBeVisible();
  await page.keyboard.press("Escape");

  // Dragging (14b): a Line tile, then the selected block by its grip - the
  // gap and the ghost are placed with CSSOM, never a style attribute.
  await drag(
    page,
    page
      .getByRole("complementary", { name: "Add to the page" })
      .getByRole("button", { name: "Line", exact: true }),
    writing.getByText("Moved up", { exact: true }),
  );
  await expect(page.getByRole("status")).toHaveText("Line added: block 2 of 3 in section 1.");
  await drag(
    page,
    page.getByRole("button", { name: "Drag to move, or use Move up and Move down" }),
    writing.locator("p").last(),
  );
  await expect(page.getByRole("status")).toHaveText("Line moved: block 3 of 3 in section 1.");
  // A section tile (14c2): the same gap and ghost, between sections.
  await drag(
    page,
    page
      .getByRole("complementary", { name: "Add to the page" })
      .getByRole("button", { name: "Blank section", exact: true }),
    writing.locator("p").last(),
  );
  await expect(page.getByRole("status")).toHaveText("Blank section added: now section 2 of 2.");

  await page
    .getByRole("complementary", { name: "Add to the page" })
    .getByRole("button", { name: "Image", exact: true })
    .click();
  const panel = page.getByRole("complementary", { name: "Image", exact: true });
  await panel.getByRole("button", { name: "Choose image" }).click();
  const picker = page.getByRole("dialog", { name: "Choose an image" });
  await expect(picker).toBeVisible();
  await picker.getByRole("button", { name: filename }).click();
  await expect(picker).toHaveCount(0);
  await expect(writing.getByRole("img", { name: "A CSP pixel" })).toBeVisible();

  await page.getByRole("button", { name: "Save draft" }).click();
  await page.waitForURL(/\/admin\/posts\/[0-9a-f-]{36}$/);

  // Home, the admin's landing (item 18b4a).
  await page.goto("/admin");
  await expect(page.getByRole("heading", { level: 1, name: "Home" })).toBeVisible();

  await page.goto("/admin/posts");
  await expect(
    page.locator("table tbody tr td:first-child a", { hasText: "CSP Editor Post" }),
  ).toBeVisible();

  await page.goto("/admin/media");
  await expect(page.getByText(filename).first()).toBeVisible();

  // Chosen but not saved: site_settings is one shared row other specs assert on.
  await page.goto("/admin/settings");
  await page.getByRole("button", { name: "Choose logo" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByText(filename).click();
  await expect(page.getByRole("button", { name: "Change logo" })).toBeVisible();

  // The brand preview takes its colours and style through the CSSOM, not a style attribute.
  const colourPicker = page.getByLabel("Pick other colour", { exact: true });
  await colourPicker.click();
  await colourPicker.fill("#c9a25e");
  await page.getByRole("radio", { name: "Friendly" }).check();
  await expect(
    page.getByRole("img", { name: /^Preview of your site/ }).locator("[data-preview='button']"),
  ).toHaveCSS("background-color", /^rgb\(/);

  await page.goto("/admin/users");
  await expect(page.getByText(admin.email).first()).toBeVisible();

  expect(violations).toEqual([]);
});

test("/start carries the admin policy and renders with nothing refused", async ({ page }) => {
  // Site 1 has published pages, which would send /start to /admin: an empty site's admin.
  const siteId = await createSite("csp-start");
  try {
    const startAdmin = await createSiteAdmin(siteId, "CSP Start Admin");
    await page.goto("/admin/login?redirectTo=%2Fstart");
    await page.getByLabel("Email").fill(startAdmin.email);
    await page.getByLabel("Password").fill(startAdmin.password);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL("**/start");
    await expect(
      page.getByRole("heading", { level: 1, name: "What do you want to create?" }),
    ).toBeVisible();

    const response = await page.goto("/start");
    const policy = response?.headers()["content-security-policy"] ?? "";
    expect(policy).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+'/);
    expect(policy).toContain("style-src 'self';");
    expect(policy).not.toContain("unsafe-inline");
    expect(violations).toEqual([]);
  } finally {
    await deleteSite(siteId);
  }
});

/** Drags `from` past the 6px threshold and drops it just below the top of `to`. */
async function drag(page: Page, from: Locator, to: Locator) {
  const start = await from.boundingBox();
  if (!start) throw new Error("nothing to drag");
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(start.x + start.width / 2 + 12, start.y + start.height / 2 + 12, {
    steps: 4,
  });
  for (const steps of [8, 2]) {
    const end = await to.boundingBox();
    if (!end) throw new Error("nowhere to drop");
    await page.mouse.move(end.x + end.width / 2, end.y + end.height - 3, { steps });
    await page.evaluate(
      "new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))",
    );
  }
  await page.mouse.up();
}
