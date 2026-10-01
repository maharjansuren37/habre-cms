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
  editor = createAdmin("CTA Editor");
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
const cta = (id: string, data: Record<string, unknown> = {}) => ({
  id,
  type: "cta",
  data: {
    heading: "Join us",
    text: "",
    button: { label: "Sign up", href: "/join" },
    ...data,
  },
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

test("a published call to action is a bordered panel with its heading, text and button, escaped", async ({
  page,
}) => {
  await publishPage("CTA Public", [
    hero("h1", { heading: "Top" }),
    cta("c1", {
      heading: "Join <b>us</b>",
      text: "Come along.",
      button: { label: "<i>Sign up</i>", href: "/join" },
    }),
    plain("s1", "Body text"),
  ]);

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/cta-public");
  const panel = page.locator('section[data-kind="cta"]');
  await expect(panel).toHaveCount(1);
  await expect(panel.getByRole("heading", { level: 2 })).toHaveText("Join <b>us</b>");
  await expect(panel.locator("b, i")).toHaveCount(0);
  await expect(panel.getByText("Come along.")).toBeVisible();
  await expect(panel.getByRole("link", { name: "<i>Sign up</i>" })).toHaveAttribute(
    "href",
    "/join",
  );
  // Order: hero, call to action, plain section.
  await expect(page.locator("section")).toHaveCount(3);
  await expect(page.locator("section").nth(1)).toHaveAttribute("data-kind", "cta");
  await expect(page.locator("section").nth(2)).toHaveText("Body text");
  await expect(panel).toHaveCSS("text-align", "center");
  await expect(panel).toHaveCSS("border-top-width", "1px");

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

test("a call to action opens as a form with required button fields, saves, and has no Columns control", async ({
  page,
}) => {
  const id = await seedDraft("CTA Form", [
    cta("c1", {
      heading: "Join us",
      text: "Come along",
      button: { label: "Sign up", href: "/join" },
    }),
  ]);
  await logIn(page, editor);
  await page.goto(`/admin/pages/${id}`);
  await expect(field(page, "Heading (required)")).toHaveValue("Join us");
  await expect(field(page, "Text")).toHaveValue("Come along");
  await expect(field(page, "Button label (required)")).toHaveValue("Sign up");
  await expect(field(page, "Button link (required)")).toHaveValue("/join");
  await expect(page.getByRole("radio", { name: /column/ })).toHaveCount(0);
  await expect(page.getByText("Call to action", { exact: true })).toBeVisible();

  await field(page, "Heading (required)").fill("Join today");
  await save(page);
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  expect((await storedBlocks(id))[0]).toEqual({
    id: "c1",
    type: "cta",
    data: {
      heading: "Join today",
      text: "Come along",
      button: { label: "Sign up", href: "/join" },
    },
  });
  await page.reload();
  await expect(field(page, "Heading (required)")).toHaveValue("Join today");
});

test("a call to action moves and is removed among hero and plain sections", async ({ page }) => {
  const id = await seedDraft("CTA Order", [plain("s1", "First"), cta("c1"), hero("h1", {})]);
  await logIn(page, editor);
  await page.goto(`/admin/pages/${id}`);
  await page.getByRole("button", { name: "Move up (section 2 of 3)" }).click();
  await save(page);
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  expect((await storedBlocks(id)).map((each) => each.type)).toEqual(["cta", "section", "hero"]);

  await page.getByRole("button", { name: "Remove (section 1 of 3)" }).click();
  await expect(page.getByText("Remove this section?")).toBeVisible();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await save(page);
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  expect((await storedBlocks(id)).map((each) => each.type)).toEqual(["section", "hero"]);
});

test("a call to action with a missing heading, label or link is refused with its section named and nothing lost", async ({
  page,
}) => {
  const id = await seedDraft("CTA Refusal", [plain("s1", "First"), cta("c1")]);
  await logIn(page, editor);
  await page.goto(`/admin/pages/${id}`);
  await field(page, "Heading (required)").fill("");
  await field(page, "Text").fill("Still here");
  await save(page);
  await expect(
    page.getByText("Section 2 (call to action): the heading is required."),
  ).toBeVisible();
  await expect(field(page, "Text")).toHaveValue("Still here");

  const needs = "Section 2 (call to action): the button needs a label and a link.";
  await field(page, "Heading (required)").fill("Join");
  await field(page, "Button link (required)").fill("");
  await save(page);
  await expect(page.getByText(needs)).toBeVisible();
  await field(page, "Button link (required)").fill("/join");
  await field(page, "Button label (required)").fill("");
  await save(page);
  await expect(page.getByText(needs)).toBeVisible();
  await field(page, "Button label (required)").fill("Go");
  await field(page, "Button link (required)").fill("javascript:alert(1)");
  await save(page);
  await expect(page.getByText("the button link cannot be used.", { exact: false })).toBeVisible();
  expect(JSON.stringify(await storedBlocks(id))).not.toContain("javascript");
  expect((await storedBlocks(id))[1]).toMatchObject({ data: { heading: "Join us" } });
});

test("Add call to action adds a card with focus in Heading, by keyboard, and it shows publicly", async ({
  page,
}) => {
  await logIn(page, editor);
  await page.goto("/admin/pages/new");
  await page.getByPlaceholder("Page title").fill("CTA Added");
  await page.locator("[data-section-id] [contenteditable=true]").first().waitFor();
  await page.getByRole("button", { name: "Add call to action" }).click();
  await expect(page.locator("[data-section-id]")).toHaveCount(2);
  await expect(page.getByText("Call to action section added. Now 2 sections.")).toBeAttached();
  await expect(field(page, "Heading (required)")).toBeFocused();

  await page.keyboard.type("Made by keyboard");
  await page.keyboard.press("Tab");
  await page.keyboard.type("A short line");
  await page.keyboard.press("Tab");
  await page.keyboard.type("Go now");
  await page.keyboard.press("Tab");
  await page.keyboard.type("/go");
  await save(page);
  await page.waitForURL(/\/admin\/pages\/[0-9a-f-]+$/);
  const id = new URL(page.url()).pathname.split("/").pop() ?? "";
  const stored = await storedBlocks(id);
  expect(stored.map((each) => each.type)).toEqual(["section", "cta"]);
  expect(stored[1]?.data).toEqual({
    heading: "Made by keyboard",
    text: "A short line",
    button: { label: "Go now", href: "/go" },
  });
  await withDatabase(
    (sql) => sql`update entries set status = 'published', published_at = now() where id = ${id}`,
  );
  await page.goto("/cta-added");
  await expect(page.locator('section[data-kind="cta"] h2')).toHaveText("Made by keyboard");
  await expect(page.getByRole("link", { name: "Go now" })).toHaveAttribute("href", "/go");
});

test("at 30 sections all three add buttons are disabled, and the blank and hero announcements are unchanged", async ({
  page,
}) => {
  const thirty = Array.from({ length: 29 }, (_, index) => plain(`s${index}`, `Part ${index + 1}`));
  const id = await seedDraft("CTA Limit", [...thirty, cta("c1")]);
  await logIn(page, editor);
  await page.goto(`/admin/pages/${id}`);
  await expect(page.locator("[data-section-id]")).toHaveCount(30);
  for (const name of ["Add blank section", "Add hero section", "Add call to action"])
    await expect(page.getByRole("button", { name })).toBeDisabled();

  const fresh = await seedDraft("CTA Blank", [plain("s1", "One")]);
  await page.goto(`/admin/pages/${fresh}`);
  await page.getByRole("button", { name: "Add blank section" }).click();
  await expect(page.getByText("Section added. Now 2 sections.")).toBeAttached();
  await page.getByRole("button", { name: "Add hero section" }).click();
  await expect(page.getByText("Hero section added. Now 3 sections.")).toBeAttached();
});

test("a 30-section page of plain, hero and call to action sections saves in under 1 s and serves in under 500 ms", async ({
  page,
}) => {
  const sections = Array.from({ length: 30 }, (_, index) => {
    if (index % 3 === 0) return cta(`s${index}`, { text: "Text" });
    if (index % 3 === 1) return hero(`s${index}`, { text: "Text" });
    return {
      id: `s${index}`,
      type: "section",
      data: {
        layout: "3",
        children: [[leaf(`${index}a`, "A")], [leaf(`${index}b`, "B")], [leaf(`${index}c`, "C")]],
      },
    };
  });
  const id = await seedDraft("CTA Thirty", sections);
  await logIn(page, editor);
  await page.goto(`/admin/pages/${id}`);
  await expect(page.locator("[data-section-id]")).toHaveCount(30);
  await expect(page.locator("[data-section-id] [contenteditable=true]")).toHaveCount(30);

  const started = Date.now();
  await save(page);
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  const saveMs = Date.now() - started;
  console.log(`30-section mixed page save round trip ${saveMs} ms`);
  expect(saveMs).toBeLessThan(1000);

  await withDatabase(
    (sql) => sql`update entries set status = 'published', published_at = now() where id = ${id}`,
  );
  const times: number[] = [];
  for (let attempt = 0; attempt < 5; attempt++) {
    const begin = Date.now();
    const response = await page.request.get("/cta-thirty");
    expect(response.ok()).toBe(true);
    times.push(Date.now() - begin);
  }
  console.log(`public page response times ${times.join(", ")} ms`);
  expect(Math.max(...times)).toBeLessThan(500);
});
