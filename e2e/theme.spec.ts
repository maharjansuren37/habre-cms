import { randomInt } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import { logIn } from "./helpers/auth.ts";
import { deleteTestMedia, uploadTestMedia } from "./helpers/media.ts";
import { STORAGE_REASON, skipWithoutStorage } from "./helpers/storage.ts";
import {
  createAdmin,
  createDraftFor,
  deleteEntriesBy,
  deleteTestUser,
  type TestUser,
} from "./helpers/users.ts";

// Habre's tokens and self-hosted Inter, read from the real login page
// (needs no sign-in). Colours are computed by the browser, so the
// light-dark() pairs in app.css are resolved for the emulated scheme.

test("the page is warm cream in light mode", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/admin/login");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(251, 248, 244)");
});

test("the page is chestnut-black in dark mode", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/admin/login");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(24, 17, 13)");
});

test("Inter Variable loads", async ({ page }) => {
  await page.goto("/admin/login");
  // A string, because e2e/ is type-checked without the DOM lib.
  const loaded = await page.evaluate(`(async () => {
    await document.fonts.load('16px "Inter Variable"');
    await document.fonts.ready;
    return document.fonts.check('16px "Inter Variable"');
  })()`);
  expect(loaded).toBe(true);
});

test("the font is served from the app's own origin under /assets/", async ({ page, baseURL }) => {
  const fontUrls: string[] = [];
  page.on("response", (response) => {
    const url = response.url();
    if (/\.woff2?(\?|$)/.test(url)) fontUrls.push(url);
  });
  await page.goto("/admin/login");
  await page.evaluate(`document.fonts.load('16px "Inter Variable"')`);
  await page.evaluate("document.fonts.ready");

  const origin = new URL(baseURL ?? "").origin;
  expect(fontUrls.length).toBeGreaterThan(0);
  for (const url of fontUrls) {
    expect(new URL(url).origin).toBe(origin);
  }
  expect(fontUrls.some((url) => new URL(url).pathname.startsWith("/assets/"))).toBe(true);
});

// Customer sites sit in the site scope: neutral greys, light only, even when
// the visitor's device is dark (a Pro setting, item 20, turns dark on later).
for (const [name, path] of [
  ["the public home", "/"],
  ["a missing public page", "/no-such-page-13b"],
] as const) {
  test(`${name} is in the site scope and stays light under a dark device`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto(path);
    await expect(page.locator("html")).toHaveAttribute("data-surface", "site");
    await expect(page.locator("html")).toHaveCSS("color-scheme", "light");
    await expect(page.locator("body")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  });
}

test("an admin page is outside the site scope and stays dark", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/admin/login");
  await expect(page.locator("html")).not.toHaveAttribute("data-surface", /.*/);
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(24, 17, 13)");
});

// Shared controls, login and the admin shell (13b step 5).

// The page's sideways overflow: empty when nothing scrolls sideways, otherwise
// the elements whose right edge passes the viewport, so a failure names them.
async function sidewaysOverflow(page: Page): Promise<string[]> {
  // A string, because e2e/ is type-checked without the DOM lib.
  return page.evaluate(`(() => {
    const root = document.documentElement;
    if (root.scrollWidth <= root.clientWidth) return [];
    return [...document.body.querySelectorAll("*")]
      .filter((el) => el.getBoundingClientRect().right > root.clientWidth + 0.5)
      .map((el) => el.tagName.toLowerCase() + (el.className ? "." + String(el.className).split(" ")[0] : ""));
  })()`) as Promise<string[]>;
}

/** Tabs forward until the focused element has this accessible-ish text, or gives up. */
async function tabTo(page: Page, text: string): Promise<void> {
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press("Tab");
    const focused = await page.evaluate("document.activeElement?.textContent?.trim() ?? ''");
    if (focused === text) return;
  }
  throw new Error(`Tab never reached "${text}"`);
}

test("the login page does not scroll sideways at 390px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/login");
  await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
  expect(await sidewaysOverflow(page)).toEqual([]);
});

test.describe("the admin shell", () => {
  let admin: TestUser;

  test.beforeEach(async ({ page }) => {
    await page.setExtraHTTPHeaders({
      "X-Forwarded-For": `10.${randomInt(256)}.${randomInt(256)}.16`,
    });
    admin = createAdmin("Theme Admin");
  });

  test.afterEach(async () => {
    await deleteEntriesBy(admin.email);
    await deleteTestUser(admin.email);
  });

  test("the posts list does not scroll sideways at 390px", async ({ page }) => {
    // Rows with long titles and addresses: an empty list cannot overflow.
    await createDraftFor(admin.email, "A published post about gardens", [], {
      status: "published",
    });
    await createDraftFor(admin.email, "A draft still being written", []);
    await page.setViewportSize({ width: 390, height: 844 });
    await logIn(page, admin);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await sidewaysOverflow(page)).toEqual([]);
  });

  test("the users list and a delete confirmation do not scroll sideways at 390px", async ({
    page,
  }) => {
    const id = await createDraftFor(admin.email, "A published post about gardens", [], {
      status: "published",
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await logIn(page, admin);
    for (const path of ["/admin/users", `/admin/posts/${id}/delete`]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(await sidewaysOverflow(page), path).toEqual([]);
    }
  });

  test("the settings form does not scroll sideways at 390px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await logIn(page, admin);
    await page.goto("/admin/settings");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // A menu row puts its page and address fields side by side when there is room.
    await page.getByRole("button", { name: "Add item" }).click();
    expect(await sidewaysOverflow(page)).toEqual([]);
  });

  test("the post editor does not scroll sideways at 390px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await logIn(page, admin);
    await page.goto("/admin/posts/new");
    await expect(page.getByRole("textbox", { name: "Title" })).toBeVisible();
    expect(await sidewaysOverflow(page)).toEqual([]);
  });

  test("the media grid does not scroll sideways at 390px", async ({ page }) => {
    test.skip(skipWithoutStorage, STORAGE_REASON);
    await page.setViewportSize({ width: 390, height: 844 });
    await logIn(page, admin);
    const origin = new URL(page.url()).origin;
    const uploaded = await uploadTestMedia(page.request, origin, "1x1.jpg", "A fixture pixel");
    try {
      for (const path of ["/admin/media", `/admin/media/${uploaded.id}/delete`]) {
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        expect(await sidewaysOverflow(page), path).toEqual([]);
      }
    } finally {
      await deleteTestMedia(uploaded.id);
    }
  });

  test("keyboard focus on a nav link and on a button shows a 2px solid ring", async ({ page }) => {
    await logIn(page, admin);
    await tabTo(page, "Media");
    const link = page.getByRole("navigation", { name: "Admin" }).getByRole("link", {
      name: "Media",
    });
    await expect(link).toBeFocused();
    await expect(link).toHaveCSS("outline-style", "solid");
    await expect(link).toHaveCSS("outline-width", "2px");

    await tabTo(page, "Log out");
    const button = page.getByRole("button", { name: "Log out" });
    await expect(button).toBeFocused();
    await expect(button).toHaveCSS("outline-style", "solid");
    await expect(button).toHaveCSS("outline-width", "2px");
  });
});
