import { randomInt } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import { logIn } from "./helpers/auth.ts";
import { createSiteAdmin, createSiteWithAddress, deleteSite, siteUrl } from "./helpers/sites.ts";
import { type TestUser, withDatabase } from "./helpers/users.ts";

// Each test gets its own site, so none of them shares site 1's settings row (F-103).
let siteId: string;
let address: string;
let admin: TestUser;

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({
    "X-Forwarded-For": `10.${randomInt(256)}.${randomInt(256)}.12`,
  });
  const site = await createSiteWithAddress("levels");
  siteId = site.id;
  address = site.address;
  admin = await createSiteAdmin(siteId, "Levels Admin");
});

test.afterEach(async () => {
  await deleteSite(siteId);
});

// The banner from the previous save is still on screen, so wait for this save's own answer.
async function save(page: Page) {
  const answer = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      /^\/admin\/settings(\.data)?$/.test(new URL(response.url()).pathname),
  );
  await page.getByRole("button", { name: "Save" }).click();
  await answer;
  await expect(page.getByText("Settings updated.")).toBeVisible();
}

function storedLook(): Promise<{ level: string; darkMode: boolean }> {
  return withDatabase(async (sql) => {
    const [row] = await sql<{ level: string; darkMode: boolean }[]>`
      select level, dark_mode as "darkMode" from site_settings where site_id = ${siteId}
    `;
    return row;
  });
}

test("an admin switches between Simple and Pro and sets dark mode at either level", async ({
  page,
}) => {
  await logIn(page, admin);
  await page.goto("/admin/settings");

  // A new site is Simple, light.
  await expect(page.getByRole("radio", { name: /^Simple/ })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Dark mode" })).not.toBeChecked();

  // Dark mode is offered in Simple.
  await page.getByRole("checkbox", { name: "Dark mode" }).check();
  await save(page);
  expect(await storedLook()).toEqual({ level: "simple", darkMode: true });

  await page.getByRole("radio", { name: /^Pro/ }).check();
  await save(page);
  expect(await storedLook()).toEqual({ level: "pro", darkMode: true });
  await expect(page.getByRole("radio", { name: /^Pro/ })).toBeChecked();

  // And back: the dark choice is kept.
  await page.getByRole("radio", { name: /^Simple/ }).check();
  await save(page);
  expect(await storedLook()).toEqual({ level: "simple", darkMode: true });
});

test("a forged level is refused and nothing is saved", async ({ page }) => {
  await logIn(page, admin);
  const origin = new URL(page.url()).origin;
  const response = await page.request.post(`${origin}/admin/settings`, {
    headers: { Origin: origin },
    form: {
      intent: "save",
      siteTitle: "Forged",
      homePageId: "",
      siteDescription: "",
      language: "en",
      contactNotifyEmail: "",
      level: "admin",
    },
  });
  expect(response.status()).toBe(400);
  expect(await storedLook()).toEqual({ level: "simple", darkMode: false });
});

test("Users is hidden and Not Found in Simple, and works in Pro", async ({ page }) => {
  await logIn(page, admin);

  await expect(page.getByRole("navigation", { name: "Admin" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Users" })).toHaveCount(0);
  for (const path of ["/admin/users", "/admin/users/new"]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
  }

  await withDatabase(async (sql) => {
    await sql`update site_settings set level = 'pro' where site_id = ${siteId}`;
  });
  await page.goto("/admin");
  await expect(page.getByRole("link", { name: "Users" })).toBeVisible();
  const list = await page.goto("/admin/users");
  expect(list?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Users", level: 1 })).toBeVisible();

  // And back to Simple: the link goes and the screen is Not Found again.
  await withDatabase(async (sql) => {
    await sql`update site_settings set level = 'simple' where site_id = ${siteId}`;
  });
  const again = await page.goto("/admin/users");
  expect(again?.status()).toBe(404);
});

/** A page of one Heading 5 and one paragraph, made directly so it needs no Pro editor. */
async function seedHeadingFivePage(): Promise<string> {
  return withDatabase(async (sql) => {
    const document = {
      type: "doc",
      content: [
        {
          type: "section",
          attrs: { align: "top", background: "none" },
          content: [
            {
              type: "column",
              content: [
                {
                  type: "heading",
                  attrs: { level: 5 },
                  content: [{ type: "text", text: "Fine print" }],
                },
                { type: "paragraph", content: [{ type: "text", text: "Body words" }] },
              ],
            },
          ],
        },
      ],
    };
    const [row] = await sql<{ id: string }[]>`
      insert into entries (site_id, type, title, slug, blocks, blocks_format, status, author_id)
      select ${siteId}, 'page', 'Levels page', 'levels-page', ${sql.json(document as never)}, 'v4',
        'draft', u.id
      from users u where u.email = ${admin.email}
      returning id
    `;
    return row.id;
  });
}

test("Heading 5 and 6 are offered in Pro; in Simple a Heading 5 keeps rendering, locked, with its text editable", async ({
  page,
}) => {
  const id = await seedHeadingFivePage();
  await withDatabase(async (sql) => {
    await sql`update site_settings set level = 'pro' where site_id = ${siteId}`;
  });
  await logIn(page, admin);
  await page.goto(`/admin/pages/${id}`);
  const textbox = page.getByRole("textbox", { name: "Page content" });
  await textbox.getByText("Fine print", { exact: true }).click();

  // Pro: the style is a menu offering both.
  const toolbar = page.getByRole("toolbar", { name: "Heading 5" });
  const styleButton = toolbar.getByRole("button", { name: "Text style: Heading 5" });
  await styleButton.click();
  const menu = page.getByRole("menu", { name: "Text style" });
  await expect(menu.getByRole("menuitemradio", { name: "Heading 5" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(menu.getByRole("menuitemradio", { name: "Heading 6" })).toBeVisible();
  await page.keyboard.press("Escape");

  // Simple: the same page, the same heading, but the style is read-only.
  await withDatabase(async (sql) => {
    await sql`update site_settings set level = 'simple' where site_id = ${siteId}`;
  });
  await page.goto(`/admin/pages/${id}`);
  await textbox.getByText("Fine print", { exact: true }).click();
  await expect(textbox.getByRole("heading", { level: 5, name: "Fine print" })).toBeVisible();
  const locked = page
    .getByRole("toolbar", { name: "Heading 5" })
    .getByRole("button", { name: /^Text style: Heading 5/ });
  await expect(locked).toHaveAttribute("aria-disabled", "true");
  // Playwright treats aria-disabled as not clickable; a real press is what is meant here.
  await locked.click({ force: true });
  await expect(page.getByRole("menu", { name: "Text style" })).toHaveCount(0);

  // The text is still editable.
  await textbox.getByText("Fine print", { exact: true }).click();
  await page.keyboard.press("End");
  await page.keyboard.type(" edited");
  await expect(textbox.getByRole("heading", { level: 5, name: "Fine print edited" })).toBeVisible();

  // Typing the shortcut makes nothing new in Simple.
  await textbox.getByText("Body words", { exact: true }).click();
  await page.keyboard.press("Home");
  await page.keyboard.type("##### ");
  await expect(textbox.locator("h5")).toHaveCount(1);
  await expect(textbox.getByText("##### Body words", { exact: true })).toBeVisible();

  // And the block still moves.
  await textbox.getByText("Fine print edited", { exact: true }).click();
  await page
    .getByRole("toolbar", { name: "Heading 5" })
    .getByRole("button", { name: "Move down", exact: true })
    .click();
  await expect(textbox.locator("h5")).toHaveCount(1);
});

test("Simple's Text style menu stops at Small heading", async ({ page }) => {
  const id = await seedHeadingFivePage();
  await logIn(page, admin);
  await page.goto(`/admin/pages/${id}`);
  const textbox = page.getByRole("textbox", { name: "Page content" });
  await textbox.getByText("Body words", { exact: true }).click();
  await page.getByRole("button", { name: /^Text style:/ }).click();
  await expect(page.getByRole("menuitemradio")).toHaveText([
    "Text",
    "Main headingOne per page.",
    "Heading",
    "Subheading",
    "Small heading",
  ]);
});

const LIGHT = "rgb(255, 255, 255)";
const DARK = "rgb(10, 10, 10)";

async function setLook(level: "simple" | "pro", darkMode: boolean, brandColor = "") {
  await withDatabase(async (sql) => {
    await sql`
      update site_settings
      set level = ${level}, dark_mode = ${darkMode}, brand_color = ${brandColor}
      where site_id = ${siteId}
    `;
  });
}

test.describe("on a dark device", () => {
  test.use({ colorScheme: "dark" });

  for (const level of ["simple", "pro"] as const) {
    test(`a ${level} site is light with dark mode off and dark with it on`, async ({ page }) => {
      await setLook(level, false);
      await page.goto(siteUrl("/", address));
      await expect(page.locator("html")).toHaveCSS("background-color", LIGHT);
      await expect(page.locator("html")).not.toHaveAttribute("data-dark", /.+/);

      await setLook(level, true);
      await page.goto(siteUrl("/", address));
      await expect(page.locator("html")).toHaveAttribute("data-dark", "auto");
      await expect(page.locator("html")).toHaveCSS("background-color", DARK);
    });
  }

  test("a brand colour gets its dark shades, still readable on the dark page", async ({ page }) => {
    await setLook("simple", true, "#1a237e");
    await page.goto(siteUrl("/", address));
    // Not the light derivation's own colour: a dark blue would vanish on #0a0a0a.
    const html = page.locator("html");
    await expect(html).toHaveCSS("--color-primary", /^#[0-9a-f]{6}$/);
    await expect(html).not.toHaveCSS("--color-primary", "#1a237e");
  });
});

test("on a light device a dark-mode site stays light", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await setLook("pro", true);
  await page.goto(siteUrl("/", address));
  await expect(page.locator("html")).toHaveCSS("background-color", LIGHT);
});

test("on a Simple site Ctrl+Alt+5 and 6 make no Heading 5 or 6, and cannot unmake one", async ({
  page,
}) => {
  const id = await seedHeadingFivePage();
  await logIn(page, admin);
  await page.goto(`/admin/pages/${id}`);
  const textbox = page.getByRole("textbox", { name: "Page content" });
  await expect(textbox.locator("h5")).toHaveCount(1);

  // In the Heading 5 itself, first: no toolbar covers it yet. The style it has
  // cannot be shortcut away, to another level or to text.
  await textbox.getByText("Fine print", { exact: true }).click();
  for (const keys of ["Control+Alt+3", "Control+Alt+6", "Control+Alt+0"]) {
    await page.keyboard.press(keys);
  }
  await expect(textbox.getByRole("heading", { level: 5, name: "Fine print" })).toBeVisible();

  // Undo and Duplicate of the one it has are not refused.
  await page
    .getByRole("toolbar", { name: "Heading 5" })
    .getByRole("button", { name: /^Duplicate/ })
    .click();
  await expect(textbox.locator("h5")).toHaveCount(2);
  await page.keyboard.press("Control+z");
  await expect(textbox.locator("h5")).toHaveCount(1);

  // In the paragraph below: nothing makes a new one.
  await textbox.getByText("Body words", { exact: true }).click();
  await page.keyboard.press("Control+Alt+5");
  await page.keyboard.press("Control+Alt+6");
  await expect(textbox.locator("h5, h6")).toHaveCount(1);
  await expect(textbox.getByText("Body words", { exact: true })).toBeVisible();

  // A site that is Pro still can.
  await withDatabase(async (sql) => {
    await sql`update site_settings set level = 'pro' where site_id = ${siteId}`;
  });
  await page.goto(`/admin/pages/${id}`);
  await textbox.getByText("Body words", { exact: true }).click();
  await page.keyboard.press("Control+Alt+6");
  await expect(textbox.locator("h6")).toHaveCount(1);
});

test("on a Simple site a cut Heading 5 pastes back (F-401)", async ({ page }) => {
  const id = await seedHeadingFivePage();
  await logIn(page, admin);
  await page.goto(`/admin/pages/${id}`);
  const textbox = page.getByRole("textbox", { name: "Page content" });
  await expect(textbox.locator("h5")).toHaveCount(1);

  // Cut the whole page and paste it back: a Heading 5 inside it must survive.
  await textbox.getByText("Body words", { exact: true }).click();
  await page.keyboard.press("Control+a");
  await page.keyboard.press("Control+x");
  await expect(textbox.locator("h5")).toHaveCount(0);
  await page.keyboard.press("Control+v");
  await expect(textbox.getByText("Body words", { exact: true })).toBeVisible();
  await expect(textbox.getByRole("heading", { level: 5, name: "Fine print" })).toBeVisible();
});

test("on a Simple site Enter in the middle of a Heading 5 splits it (F-403)", async ({ page }) => {
  const id = await seedHeadingFivePage();
  await logIn(page, admin);
  await page.goto(`/admin/pages/${id}`);
  const textbox = page.getByRole("textbox", { name: "Page content" });
  await textbox.getByText("Fine print", { exact: true }).click();
  await page.keyboard.press("Home");
  for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowRight");
  // A typed character shows the editor has the caret where the keys put it.
  await page.keyboard.type("-");
  await expect(textbox.getByRole("heading", { level: 5, name: "Fine- print" })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(textbox.locator("h5")).toHaveCount(2);
  await expect(textbox.getByRole("heading", { level: 5, name: "Fine-" })).toBeVisible();
  await expect(textbox.getByRole("heading", { level: 5, name: "print" })).toBeVisible();
});
