import { expect, test } from "@playwright/test";

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
