import { randomInt } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import { logIn } from "./helpers/auth.ts";
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

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({
    "X-Forwarded-For": `10.${randomInt(256)}.${randomInt(256)}.12`,
  });
  editor = createAdmin("Hero Editor");
  await setRole(editor.email, "editor");
});

test.afterEach(async () => {
  await deleteEntriesBy(editor.email);
  await deleteTestUser(editor.email);
});

const leaf = (id: string, text: string) => ({ id, type: "text", data: { text: [{ text }] } });
const plain = (id: string, text: string) => ({
  id,
  type: "section",
  data: { layout: "1", children: [[leaf(`${id}-a`, text)]] },
});
const hero = (id: string, data: Record<string, unknown>) => ({
  id,
  type: "hero",
  data: { heading: "Welcome", text: "", ...data },
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

test("a published hero shows its heading, text and button, and escapes what it holds", async ({
  page,
}) => {
  await publishPage("Hero Public", [
    hero("h1", {
      heading: "Welcome <b>home</b>",
      text: "A line about us.",
      button: { label: "Read more", href: "/about" },
    }),
    plain("s1", "Body text"),
    hero("h2", { heading: "No button here" }),
  ]);

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/hero-public");
  const heroes = page.locator('section[data-kind="hero"]');
  await expect(heroes).toHaveCount(2);
  const first = heroes.nth(0);
  await expect(first.getByRole("heading", { level: 2 })).toHaveText("Welcome <b>home</b>");
  await expect(first.locator("b")).toHaveCount(0);
  await expect(first.getByText("A line about us.")).toBeVisible();
  await expect(first.getByRole("link", { name: "Read more" })).toHaveAttribute("href", "/about");
  // Order: hero, plain section, hero.
  await expect(page.locator("section")).toHaveCount(3);
  await expect(page.locator("section").nth(1)).toHaveText("Body text");
  // A hero with no text and no button has neither a paragraph nor a link.
  await expect(heroes.nth(1).locator("p, a")).toHaveCount(0);
  await expect(first).toHaveCSS("text-align", "center");

  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 800 });
    expect(await page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")).toBe(
      true,
    );
  }
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

test("a hero opens as a form, an edit saves and reloads, and it has no Columns control", async ({
  page,
}) => {
  const id = await seedDraft("Hero Form", [
    hero("h1", {
      heading: "Welcome",
      text: "About us",
      button: { label: "Read more", href: "/about" },
    }),
  ]);
  await logIn(page, editor);
  await page.goto(`/admin/pages/${id}`);
  await expect(field(page, "Heading (required)")).toHaveValue("Welcome");
  await expect(field(page, "Text")).toHaveValue("About us");
  await expect(field(page, "Button label")).toHaveValue("Read more");
  await expect(field(page, "Button link")).toHaveValue("/about");
  await expect(page.getByRole("radio", { name: /column/ })).toHaveCount(0);
  await expect(page.getByText("Hero", { exact: true })).toBeVisible();

  await field(page, "Heading (required)").fill("Hello there");
  await field(page, "Button link").fill("https://example.com/");
  await save(page);
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  expect((await storedBlocks(id))[0]).toEqual({
    id: "h1",
    type: "hero",
    data: {
      heading: "Hello there",
      text: "About us",
      button: { label: "Read more", href: "https://example.com/" },
    },
  });
  await page.reload();
  await expect(field(page, "Heading (required)")).toHaveValue("Hello there");
});

test("a hero moves and is removed among plain sections, and the plain ones are untouched", async ({
  page,
}) => {
  const id = await seedDraft("Hero Order", [plain("s1", "First"), hero("h1", {})]);
  await logIn(page, editor);
  await page.goto(`/admin/pages/${id}`);
  await expect(page.locator("[data-section-id]")).toHaveCount(2);
  await page.getByRole("button", { name: "Move up (section 2 of 2)" }).click();
  await expect(page.locator("[data-section-id]").first()).toHaveAttribute("data-section-id", "h1");
  await save(page);
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  const stored = await storedBlocks(id);
  expect(stored.map((each) => each.type)).toEqual(["hero", "section"]);

  await page.getByRole("button", { name: "Remove (section 1 of 2)" }).click();
  await expect(page.getByText("Remove this section?")).toBeVisible();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(page.locator("[data-section-id]")).toHaveCount(1);
  await save(page);
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  expect((await storedBlocks(id)).map((each) => each.type)).toEqual(["section"]);
});

test("a hero with no heading is refused with its section named, and the typed values stay", async ({
  page,
}) => {
  const id = await seedDraft("Hero Refusal", [plain("s1", "First"), hero("h1", {})]);
  await logIn(page, editor);
  await page.goto(`/admin/pages/${id}`);
  await field(page, "Heading (required)").fill("");
  await field(page, "Text").fill("Still here");
  await save(page);
  await expect(page.getByText("Section 2 (hero): the heading is required.")).toBeVisible();
  await expect(field(page, "Text")).toHaveValue("Still here");
  expect((await storedBlocks(id))[1]).toMatchObject({ data: { heading: "Welcome" } });
});

test("Add hero section adds a card with focus in Heading, and the saved hero shows publicly", async ({
  page,
}) => {
  await logIn(page, editor);
  await page.goto("/admin/pages/new");
  await page.getByPlaceholder("Page title").fill("Hero Added");
  await page.locator("[data-section-id] [contenteditable=true]").first().waitFor();
  await page.getByRole("button", { name: "Add hero section" }).click();
  await expect(page.locator("[data-section-id]")).toHaveCount(2);
  await expect(page.getByText("Hero section added. Now 2 sections.")).toBeAttached();
  await expect(field(page, "Heading (required)")).toBeFocused();

  await page.keyboard.type("Made by keyboard");
  await page.keyboard.press("Tab");
  await page.keyboard.type("A short line");
  await save(page);
  await page.waitForURL(/\/admin\/pages\/[0-9a-f-]+$/);
  const id = new URL(page.url()).pathname.split("/").pop() ?? "";
  const stored = await storedBlocks(id);
  expect(stored.map((each) => each.type)).toEqual(["section", "hero"]);
  expect(stored[1]?.data).toEqual({ heading: "Made by keyboard", text: "A short line" });

  await withDatabase(
    (sql) => sql`update entries set status = 'published', published_at = now() where id = ${id}`,
  );
  await page.goto("/hero-added");
  await expect(page.locator('section[data-kind="hero"] h2')).toHaveText("Made by keyboard");
});

test("a blank section's announcement is unchanged, and at 30 sections both add buttons are disabled", async ({
  page,
}) => {
  const thirty = Array.from({ length: 29 }, (_, index) => plain(`s${index}`, `Part ${index + 1}`));
  const id = await seedDraft("Hero Limit", [...thirty, hero("h1", {})]);
  await logIn(page, editor);
  await page.goto(`/admin/pages/${id}`);
  await expect(page.locator("[data-section-id]")).toHaveCount(30);
  await expect(page.getByRole("button", { name: "Add blank section" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Add hero section" })).toBeDisabled();
  await expect(page.getByText("A page can have up to 30 sections.")).toBeVisible();

  const fresh = await seedDraft("Hero Blank", [plain("s1", "One")]);
  await page.goto(`/admin/pages/${fresh}`);
  await page.getByRole("button", { name: "Add blank section" }).click();
  await expect(page.getByText("Section added. Now 2 sections.")).toBeAttached();
});

test("a button with a label but no link, and a javascript: link, are each refused and nothing is lost", async ({
  page,
}) => {
  const id = await seedDraft("Hero Links", [hero("h1", {})]);
  await logIn(page, editor);
  await page.goto(`/admin/pages/${id}`);
  await field(page, "Button label").fill("Go");
  await save(page);
  await expect(
    page.getByText("Section 1 (hero): the button has a label but no link.", { exact: false }),
  ).toBeVisible();
  await field(page, "Button link").fill("javascript:alert(1)");
  await save(page);
  await expect(
    page.getByText("Section 1 (hero): the button link cannot be used.", { exact: false }),
  ).toBeVisible();
  await expect(field(page, "Button label")).toHaveValue("Go");
  expect((await storedBlocks(id))[0]).toMatchObject({ data: { heading: "Welcome" } });
  expect(JSON.stringify(await storedBlocks(id))).not.toContain("javascript");
});

test("a 30-section page of heroes and columns saves in under 1 s and serves in under 500 ms", async ({
  page,
}) => {
  const sections = Array.from({ length: 30 }, (_, index) =>
    index % 2 === 0
      ? hero(`s${index}`, { text: "Text", button: { label: "Go", href: "/x" } })
      : {
          id: `s${index}`,
          type: "section",
          data: {
            layout: "3",
            children: [
              [leaf(`${index}a`, "A")],
              [leaf(`${index}b`, "B")],
              [leaf(`${index}c`, "C")],
            ],
          },
        },
  );
  const id = await seedDraft("Hero Thirty", sections);
  await logIn(page, editor);
  await page.goto(`/admin/pages/${id}`);
  await expect(page.locator("[data-section-id]")).toHaveCount(30);
  await expect(page.locator("[data-section-id] [contenteditable=true]")).toHaveCount(45);

  const started = Date.now();
  await save(page);
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  const saveMs = Date.now() - started;
  console.log(`30-section hero page save round trip ${saveMs} ms`);
  expect(saveMs).toBeLessThan(1000);

  await withDatabase(
    (sql) => sql`update entries set status = 'published', published_at = now() where id = ${id}`,
  );
  const times: number[] = [];
  for (let attempt = 0; attempt < 5; attempt++) {
    const begin = Date.now();
    const response = await page.request.get("/hero-thirty");
    expect(response.ok()).toBe(true);
    times.push(Date.now() - begin);
  }
  console.log(`public page response times ${times.join(", ")} ms`);
  expect(Math.max(...times)).toBeLessThan(500);
});

test("a relative button link such as /about saves - the link box does not use the browser's url check", async ({
  page,
}) => {
  const id = await seedDraft("Hero Relative", [
    hero("h1", { button: { label: "About", href: "/about" } }),
  ]);
  await logIn(page, editor);
  await page.goto(`/admin/pages/${id}`);
  await field(page, "Text").fill("Edited");
  await save(page);
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  expect((await storedBlocks(id))[0]).toMatchObject({
    data: { text: "Edited", button: { href: "/about" } },
  });
});
