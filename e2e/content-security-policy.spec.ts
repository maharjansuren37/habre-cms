import { randomInt } from "node:crypto";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { logIn } from "./helpers/auth.ts";
import { inSection, textDocument } from "./helpers/documents.ts";
import { deleteTestMedia, uploadTestMedia } from "./helpers/media.ts";
import { STORAGE_REASON, skipWithoutStorage } from "./helpers/storage.ts";
import {
  createAdmin,
  createDraftFor,
  deleteEntriesBy,
  deleteTestUser,
  type TestUser,
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
type LoadedImage = { complete: boolean; naturalWidth: number };

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

/**
 * A blocked image is still "visible" as a broken box, so this waits for real
 * pixels - polled, because the public site's images are `loading="lazy"`.
 */
async function expectImageLoaded(image: Locator) {
  await image.scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      image.evaluate((el) => {
        const img = el as unknown as LoadedImage;
        return img.complete && img.naturalWidth > 0;
      }),
    )
    .toBe(true);
}

test("HTML pages carry the Content-Security-Policy, with inline styles allowed only in the admin", async ({
  page,
}) => {
  const publicPage = await page.goto("/");
  const publicPolicy = publicPage?.headers()["content-security-policy"] ?? "";
  expect(publicPolicy).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+'/);
  expect(publicPolicy).toContain("style-src 'self';");

  const adminPage = await page.goto("/admin/login");
  const adminPolicy = adminPage?.headers()["content-security-policy"] ?? "";
  expect(adminPolicy).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+'/);
  expect(adminPolicy).toContain("style-src 'self' 'unsafe-inline';");
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

  await page.goto("/posts");
  await expect(page.getByRole("link", { name: "CSP Post" })).toBeVisible();

  await page.goto("/posts/csp-post");
  await expect(page.getByText("Some bold")).toBeVisible();

  await page.goto("/csp-page");
  await expect(page.getByText("A page.")).toBeVisible();

  const missing = await page.goto("/no-such-page-for-csp");
  expect(missing?.status()).toBe(404);

  expect(violations).toEqual([]);
});

test("the post editor, posts list, media, settings and users screens work with nothing refused by the policy", async ({
  page,
}) => {
  test.skip(skipWithoutStorage, STORAGE_REASON);
  await logIn(page, admin);
  const filename = await uploadPixel(page);

  // The editor: text, both inline tools, the + toolbox, and an image from the picker.
  await page.goto("/admin/posts/new");
  await page.getByRole("textbox", { name: "Title" }).fill("CSP Editor Post");
  const paragraph = page.locator(".ce-paragraph").first();
  await paragraph.click();
  await page.keyboard.type("Make this bold and linked");
  await page.keyboard.press("Shift+Control+ArrowLeft");
  await page.locator(".ce-inline-toolbar [data-item-name='bold']").click();
  await expect(paragraph.locator("b")).toHaveText("linked");
  await page.keyboard.press("Shift+Control+ArrowLeft");
  await page.locator(".ce-inline-toolbar .ce-inline-tool--link").click();
  await page.locator(".ce-inline-tool-input").fill("https://example.com/");
  await page.keyboard.press("Enter");
  await expect(paragraph.locator("a")).toHaveAttribute("href", "https://example.com/");

  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.locator(".ce-toolbar__plus").click();
  await page.locator(".ce-popover-item__title", { hasText: "Image" }).click();
  await page.getByRole("button", { name: "Choose image" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByText(filename).click();
  // The editor's image is decorative (alt=""); its alt text shows as a caption.
  await expect(page.getByText("A CSP pixel")).toBeVisible();
  await expectImageLoaded(page.locator(".codex-editor img").first());

  await page.getByRole("button", { name: "Save draft" }).click();
  await page.waitForURL(/\/admin\/posts\/[0-9a-f-]{36}$/);

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

  await page.goto("/admin/users");
  await expect(page.getByText(admin.email).first()).toBeVisible();

  expect(violations).toEqual([]);
});
