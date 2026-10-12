import { randomInt } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import sharp from "sharp";
import { logIn } from "./helpers/auth.ts";
import { countSiteMedia, fillTestStorage } from "./helpers/media.ts";
import { createSiteAdmin, createSiteWithAddress, deleteSite, siteUrl } from "./helpers/sites.ts";
import { STORAGE_REASON, skipWithoutStorage } from "./helpers/storage.ts";
import { setRole, type TestUser, withDatabase } from "./helpers/users.ts";

/** White 200x100 with an 80x60 green block and a 40x60 gold block. Green is the more used. */
export const GREEN = "#2f6b5a";
export const GOLD = "#c9a25e";

export async function twoColourPng(): Promise<Buffer> {
  const block = (width: number, hex: string) =>
    sharp({
      create: {
        width,
        height: 60,
        channels: 3,
        background: {
          r: Number(`0x${hex.slice(1, 3)}`),
          g: Number(`0x${hex.slice(3, 5)}`),
          b: Number(`0x${hex.slice(5, 7)}`),
        },
      },
    })
      .png()
      .toBuffer();
  return sharp({
    create: { width: 200, height: 100, channels: 3, background: "#ffffff" },
  })
    .composite([
      { input: await block(80, GREEN), left: 10, top: 20 },
      { input: await block(40, GOLD), left: 120, top: 20 },
    ])
    .png()
    .toBuffer();
}

/** Every channel within `step` of the expected colour. */
export function expectNearColour(actual: string, expected: string, step = 3) {
  expect(actual).toMatch(/^#[0-9a-f]{6}$/);
  for (const i of [1, 3, 5]) {
    const a = Number(`0x${actual.slice(i, i + 2)}`);
    const e = Number(`0x${expected.slice(i, i + 2)}`);
    expect(Math.abs(a - e)).toBeLessThanOrEqual(step);
  }
}

export async function uploadToMedia(page: Page, name: string, buffer: Buffer, alt: string) {
  await page.goto("/admin/media");
  await page.getByLabel("Image").setInputFiles({ name, mimeType: "image/png", buffer });
  await page.getByLabel("Alt text").fill(alt);
  await page.getByRole("button", { name: "Upload" }).click();
  await expect(page.getByRole("status")).toContainText("was uploaded");
}

let siteId: string;
let address: string;
let admin: TestUser;

const randomIp = () => `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`;

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "X-Forwarded-For": randomIp() });
  ({ id: siteId, address } = await createSiteWithAddress("logo"));
  admin = await createSiteAdmin(siteId, "Logo Admin");
  await logIn(page, admin);
});

test.afterEach(async () => {
  await deleteSite(siteId);
});

test("the picker lists a new upload's colours, most used first", async ({ page }) => {
  test.skip(skipWithoutStorage, STORAGE_REASON);
  await uploadToMedia(page, "two-colour.png", await twoColourPng(), "Two colours");

  const response = await page.request.get("/admin/media/picker");
  const body = await response.json();
  const item = body.media.find((m: { filename: string }) => m.filename === "two-colour.png");

  expect(item.colours).toHaveLength(2);
  expectNearColour(item.colours[0], GREEN);
  expectNearColour(item.colours[1], GOLD);
});

async function storageMeterValue(page: Page): Promise<number> {
  await page.goto("/admin/media");
  return Number(await page.getByRole("meter", { name: "Storage" }).getAttribute("value"));
}

test("an admin uploads a logo in Settings, saves it, and it shows on the site, in Media and in storage used", async ({
  page,
}) => {
  test.skip(skipWithoutStorage, STORAGE_REASON);
  const before = await storageMeterValue(page);

  await page.goto("/admin/settings");
  await page.getByLabel("Upload logo").setInputFiles({
    name: "two-colour.png",
    mimeType: "image/png",
    buffer: await twoColourPng(),
  });
  await expect(page.getByRole("button", { name: "Change logo" })).toBeVisible();
  await expect(page.getByLabel("Replace logo")).toBeAttached();
  await expect(page.getByRole("group", { name: "Logo" }).locator("img")).toBeVisible();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Settings updated.")).toBeVisible();

  await page.goto(siteUrl("/", address));
  await expect(page.locator("header img")).toBeVisible();

  await page.goto("/admin/media");
  await expect(page.getByRole("paragraph").filter({ hasText: "two-colour.png" })).toBeVisible();
  expect(await storageMeterValue(page)).toBeGreaterThan(before);
});

test("an editor posting to the logo route gets 404", async ({ browser }) => {
  const editor = await createSiteAdmin(siteId, "Logo Editor");
  await setRole(editor.email, "editor");
  const context = await browser.newContext({ extraHTTPHeaders: { "X-Forwarded-For": randomIp() } });
  const page = await context.newPage();
  try {
    await logIn(page, editor);
    const origin = new URL(page.url()).origin;
    const response = await page.request.post(`${origin}/admin/settings/logo`, {
      headers: { Origin: origin },
      multipart: {
        file: { name: "logo.png", mimeType: "image/png", buffer: await twoColourPng() },
      },
    });
    expect(response.status()).toBe(404);
    expect(await countSiteMedia(siteId)).toBe(0);
  } finally {
    await context.close();
  }
});

test("a text file named .png is refused with the image message and adds no media", async ({
  page,
}) => {
  await page.goto("/admin/settings");
  await page.getByLabel("Upload logo").setInputFiles({
    name: "logo.png",
    mimeType: "image/png",
    buffer: Buffer.from("this is not an image"),
  });

  await expect(page.getByText("This file is not a JPEG, PNG, WebP or GIF image.")).toBeVisible();
  expect(await countSiteMedia(siteId)).toBe(0);
});

test("a site at its storage limit is refused with the storage message", async ({ page }) => {
  await fillTestStorage(siteId, admin.email, 50);

  await page.goto("/admin/settings");
  await page.getByLabel("Upload logo").setInputFiles({
    name: "logo.png",
    mimeType: "image/png",
    buffer: await twoColourPng(),
  });

  await expect(
    page.getByText(
      "This image would take your site past its 500 MB of storage. Delete images you no longer use, then try again. An admin can upgrade on the Plan page for more storage.",
    ),
  ).toBeVisible();
  expect(await countSiteMedia(siteId)).toBe(50);
});

const fixture = (name: string) => readFileSync(path.join(import.meta.dirname, "fixtures", name));

/** Passes the logo POST on and resolves to its raw body text (binary read as latin1), read
 *  inside the route because a finished request no longer holds its body. */
function logoRequest(page: Page): Promise<string> {
  return new Promise((resolve) => {
    page.route("**/admin/settings/logo", async (route) => {
      resolve(route.request().postDataBuffer()?.toString("latin1") ?? "");
      await route.fallback();
    });
  });
}

async function uploadSvg(page: Page, name: string) {
  await page.goto("/admin/settings");
  await page.getByLabel("Upload logo").setInputFiles({
    name,
    mimeType: "image/svg+xml",
    buffer: fixture(name),
  });
}

async function storedLogo(): Promise<{ mime_type: string; width: number; height: number }> {
  return withDatabase(async (sql) => {
    const [row] = await sql<{ mime_type: string; width: number; height: number }[]>`
      select mime_type, width, height from media where site_id = ${siteId}
    `;
    return row;
  });
}

test("an SVG logo is sent as a PNG with no SVG bytes, and stored as a 1200px WebP", async ({
  page,
}) => {
  test.skip(skipWithoutStorage, STORAGE_REASON);
  const sent = logoRequest(page);
  await uploadSvg(page, "logo.svg");
  const body = await sent;

  expect(body).toContain("Content-Type: image/png");
  expect(body).toContain('filename="logo.svg"');
  expect(body).not.toContain("<svg");
  await expect(page.getByText("Saved as a PNG for the web.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Change logo" })).toBeVisible();

  const row = await storedLogo();
  expect(row.mime_type).toBe("image/webp");
  expect(row.width).toBe(1200);
  expect(row.height).toBe(600);
});

test("an SVG with only a viewBox keeps the viewBox's ratio", async ({ page }) => {
  test.skip(skipWithoutStorage, STORAGE_REASON);
  await uploadSvg(page, "logo-viewbox.svg");
  await expect(page.getByRole("button", { name: "Change logo" })).toBeVisible();

  const row = await storedLogo();
  expect(row.width).toBe(1200);
  expect(row.height).toBe(600);
});

test("a scripted SVG runs nothing and still converts", async ({ page }) => {
  // The server's answer is faked, so this runs in CI too: only the conversion is under test.
  await page.route("**/admin/settings/logo", (route) =>
    route.fulfill({ status: 400, json: { problem: "stub" } }),
  );
  const sent = logoRequest(page);
  await uploadSvg(page, "logo-scripted.svg");
  const body = await sent;

  expect(body).toContain("Content-Type: image/png");
  expect(body).not.toContain("<svg");
  expect(body).not.toContain("__svg");
  const flags = await page.evaluate("[window.__svgRan, window.__svgOnload]");
  expect(flags).toEqual([undefined, undefined]);
});

test("a malformed SVG shows the message and sends nothing", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/admin/settings/logo")) requests.push(request.url());
  });
  await uploadSvg(page, "logo-malformed.svg");

  await expect(page.getByText("This SVG could not be read. Try a PNG instead.")).toBeVisible();
  await page.waitForTimeout(300);
  expect(requests).toEqual([]);
  expect(await countSiteMedia(siteId)).toBe(0);
});

test("a raw SVG posted to the logo route and to Media is refused and adds no media", async ({
  page,
}) => {
  const origin = new URL(page.url()).origin;
  const file = { name: "logo.svg", mimeType: "image/svg+xml", buffer: fixture("logo.svg") };

  const logo = await page.request.post(`${origin}/admin/settings/logo`, {
    headers: { Origin: origin },
    multipart: { file },
  });
  expect(logo.status()).toBe(400);
  expect((await logo.json()).problem).toBe("This file is not a JPEG, PNG, WebP or GIF image.");

  const media = await page.request.post(`${origin}/admin/media`, {
    headers: { Origin: origin },
    multipart: { file, altText: "An SVG" },
    maxRedirects: 0,
  });
  expect(media.status()).toBe(400);
  expect(await countSiteMedia(siteId)).toBe(0);
});

// Step 6: colours from your logo.
function rgb(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => Number(`0x${hex.slice(i, i + 2)}`));
  return `rgb(${r}, ${g}, ${b})`;
}

async function uploadTwoColourLogo(page: Page) {
  await page.goto("/admin/settings");
  await page.getByLabel("Upload logo").setInputFiles({
    name: "two-colour.png",
    mimeType: "image/png",
    buffer: await twoColourPng(),
  });
  await expect(page.getByRole("button", { name: "Change logo" })).toBeVisible();
}

test("the logo's colours are offered as swatches, none chosen, and following one moves the preview and the public site", async ({
  page,
}) => {
  test.skip(skipWithoutStorage, STORAGE_REASON);
  await uploadTwoColourLogo(page);

  // The stored colours come from the WebP the server made, so they sit a step or two off the
  // fixture's exact values.
  const green = page.getByRole("radio", { name: /^Green from your logo, #[0-9a-f]{6}$/ });
  const gold = page.getByRole("radio", { name: /^Yellow from your logo, #[0-9a-f]{6}$/ });
  await expect(green).toBeVisible();
  await expect(gold).toBeVisible();
  await expect(green).not.toBeChecked();
  await expect(gold).not.toBeChecked();

  const button = page
    .getByRole("img", { name: /^Preview of your site/ })
    .locator("[data-preview='button']");
  await expect(button).toHaveCSS("background-color", "rgb(23, 23, 23)");
  const greenHex = await green.getAttribute("value");
  expectNearColour(greenHex ?? "", GREEN);
  expectNearColour((await gold.getAttribute("value")) ?? "", GOLD);
  const greenRgb = rgb(greenHex ?? "");
  await green.check();
  await expect(button).toHaveCSS("background-color", greenRgb);

  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Settings updated.")).toBeVisible();
  await page.goto(siteUrl("/", address));
  const primary = await page.evaluate(
    `getComputedStyle(document.querySelector('[data-surface="site"]')).getPropertyValue("--color-primary").trim()`,
  );
  expect(primary).toBe(greenHex);
});

test("removing the logo leaves its chosen colour chosen as Other colour", async ({ page }) => {
  test.skip(skipWithoutStorage, STORAGE_REASON);
  await uploadTwoColourLogo(page);
  const green = page.getByRole("radio", { name: /^Green from your logo, #[0-9a-f]{6}$/ });
  const greenHex = (await green.getAttribute("value")) ?? "";
  await green.check();

  await page.getByRole("button", { name: "Remove logo" }).click();

  await expect(page.getByRole("radio", { name: /from your logo/ })).toHaveCount(0);
  await expect(page.getByRole("radio", { name: "Other colour", exact: true })).toBeChecked();
  await expect(page.getByLabel("Pick other colour", { exact: true })).toHaveValue(greenHex);
  await expect(
    page.getByRole("img", { name: /^Preview of your site/ }).locator("[data-preview='button']"),
  ).toHaveCSS("background-color", rgb(greenHex));
});

test("with a logo set, Settings does not scroll sideways at 390px", async ({ page }) => {
  test.skip(skipWithoutStorage, STORAGE_REASON);
  await page.setViewportSize({ width: 390, height: 844 });
  await uploadTwoColourLogo(page);
  await expect(page.getByRole("button", { name: "Remove logo" })).toBeVisible();
  const overflow = (await page.evaluate(`(() => {
    const root = document.documentElement;
    if (root.scrollWidth <= root.clientWidth) return [];
    return [...document.body.querySelectorAll("*")]
      .filter((el) => el.getBoundingClientRect().right > root.clientWidth + 0.5)
      .map((el) => el.tagName.toLowerCase() + (el.className ? "." + String(el.className).split(" ")[0] : ""));
  })()`)) as string[];
  expect(overflow).toEqual([]);
});

// F-321 / F-322: the field's messages and focus. The server's answer is faked, so these run in CI.
const PNG_FILE = { name: "logo.png", mimeType: "image/png" };
const fakeMedia = (id: string) => ({
  id,
  url: "/favicon.ico",
  src: "/favicon.ico",
  filename: "logo.png",
  altText: "",
  width: 10,
  height: 10,
  colours: [],
});

test("Remove logo clears the PNG line and a refusal", async ({ page }) => {
  let answer: { status: number; json: object } = {
    status: 200,
    json: { media: fakeMedia("1") },
  };
  await page.route("**/admin/settings/logo", (route) => route.fulfill(answer));
  await page.goto("/admin/settings");
  await page.getByLabel("Upload logo").setInputFiles({ ...PNG_FILE, buffer: Buffer.from("x") });
  await expect(page.getByRole("button", { name: "Change logo" })).toBeVisible();

  await page.getByLabel("Replace logo").setInputFiles({
    name: "logo.svg",
    mimeType: "image/svg+xml",
    buffer: fixture("logo.svg"),
  });
  await expect(page.getByText("Saved as a PNG for the web.")).toBeVisible();
  await page.getByRole("button", { name: "Remove logo" }).click();
  await expect(page.getByText("Saved as a PNG for the web.")).toBeHidden();

  answer = { status: 200, json: { media: fakeMedia("2") } };
  await page.getByLabel("Upload logo").setInputFiles({ ...PNG_FILE, buffer: Buffer.from("x") });
  await expect(page.getByRole("button", { name: "Change logo" })).toBeVisible();
  answer = { status: 400, json: { problem: "A stubbed refusal." } };
  await page.getByLabel("Replace logo").setInputFiles({ ...PNG_FILE, buffer: Buffer.from("x") });
  await expect(page.getByText("A stubbed refusal.")).toBeVisible();
  await page.getByRole("button", { name: "Remove logo" }).click();
  await expect(page.getByText("A stubbed refusal.")).toBeHidden();
});

test("Change and Remove do nothing while an upload is in flight", async ({ page }) => {
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let calls = 0;
  await page.route("**/admin/settings/logo", async (route) => {
    calls++;
    if (calls === 2) await held;
    await route.fulfill({ status: 200, json: { media: fakeMedia(String(calls)) } });
  });
  await page.goto("/admin/settings");
  await page.getByLabel("Upload logo").setInputFiles({ ...PNG_FILE, buffer: Buffer.from("x") });
  await expect(page.getByRole("button", { name: "Change logo" })).toBeVisible();

  await page.getByLabel("Replace logo").setInputFiles({ ...PNG_FILE, buffer: Buffer.from("y") });
  const change = page.getByRole("button", { name: "Change logo" });
  const remove = page.getByRole("button", { name: "Remove logo" });
  await expect(change).toHaveAttribute("aria-disabled", "true");
  await expect(remove).toHaveAttribute("aria-disabled", "true");
  await remove.click({ force: true });
  await change.click({ force: true });
  await expect(page.getByRole("group", { name: "Logo" }).locator("img")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  release();
  await expect(change).not.toHaveAttribute("aria-disabled", "true");
  await expect(page.getByRole("group", { name: "Logo" }).locator("img")).toBeVisible();
});

test("keyboard focus stays on the file input after a refusal", async ({ page }) => {
  await page.route("**/admin/settings/logo", (route) =>
    route.fulfill({ status: 400, json: { problem: "A stubbed refusal." } }),
  );
  await page.goto("/admin/settings");
  const input = page.getByLabel("Upload logo");
  await input.focus();
  await input.setInputFiles({ ...PNG_FILE, buffer: Buffer.from("x") });
  await expect(page.getByText("A stubbed refusal.")).toBeVisible();
  await expect(input).toBeFocused();
});
