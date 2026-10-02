import { type APIRequestContext, expect, test } from "@playwright/test";
import { inSection, listItem, textDocument } from "./helpers/documents.ts";
import {
  createAdmin,
  createDraftFor,
  deleteEntriesBy,
  deleteTestUser,
  type TestUser,
} from "./helpers/users.ts";

let author: TestUser;

test.beforeEach(() => {
  author = createAdmin("Public Site Author");
});

test.afterEach(async () => {
  await deleteEntriesBy(author.email);
  await deleteTestUser(author.email);
});

test("/posts lists only published posts, newest first", async ({ page }) => {
  await createDraftFor(author.email, "Older Published", textDocument(), {
    status: "published",
    publishedAt: new Date("2026-01-01T00:00:00Z"),
  });
  await createDraftFor(author.email, "Newer Published", textDocument(), {
    status: "published",
    publishedAt: new Date("2026-02-01T00:00:00Z"),
  });
  await createDraftFor(author.email, "A Draft", textDocument(), { status: "draft" });

  await page.goto("/posts");
  // Only this test's own titles: other specs publish posts of their own, and the
  // list shows every author's (F-86).
  await expect(page.getByRole("link", { name: "Older Published" })).toBeVisible();
  const mine = ["Newer Published", "Older Published", "A Draft"];
  const shown = (await page.locator("main a").allInnerTexts()).filter((t) => mine.includes(t));
  expect(shown).toEqual(["Newer Published", "Older Published"]);
});

test("with nothing published, /posts says so instead of showing a blank page", async ({ page }) => {
  await page.goto("/posts");
  await expect(page.getByText("Nothing has been published yet.")).toBeVisible();
});

test("with no home page chosen, / shows the placeholder under the site title, not the post list", async ({
  page,
}) => {
  await createDraftFor(author.email, "Placeholder Spec Post", textDocument(), {
    status: "published",
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Habre CMS" })).toBeVisible();
  await expect(page.getByText("This site is being set up.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Placeholder Spec Post" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Read the posts" })).toHaveAttribute(
    "href",
    "/posts",
  );
});

test("a published page and post ship no entry id and no settings beyond title, logo and menu", async ({
  request,
}) => {
  const postId = await createDraftFor(author.email, "Lean Data Post", textDocument(), {
    status: "published",
  });
  const pageId = await createDraftFor(author.email, "Lean Data Page", textDocument(), {
    status: "published",
    type: "page",
  });

  for (const [path, id] of [
    ["/posts/lean-data-post", postId],
    ["/lean-data-page", pageId],
  ] as const) {
    const response = await request.get(path);
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).not.toContain(id);
    expect(html).not.toContain("homePageId");
    // The key as serialized into the page's script: React Router escapes its
    // quotes there, so match both forms - and not the bare word, which any
    // visible label could contain (F-141).
    expect(html).not.toMatch(/\\?"navigation\\?"/);
  }
});

test("a published post renders its blocks and inline formatting as real elements", async ({
  page,
}) => {
  await createDraftFor(
    author.email,
    "Rendered Post",
    inSection(
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Plain para with " },
          { type: "text", text: "bold", marks: [{ type: "bold" }] },
          { type: "text", text: " and " },
          {
            type: "text",
            text: "a link",
            marks: [{ type: "link", attrs: { href: "https://example.com" } }],
          },
          { type: "text", text: "." },
        ],
      },
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "A heading" }],
      },
      {
        type: "bulletList",
        content: [
          listItem([{ type: "text", text: "item one" }]),
          listItem([{ type: "text", text: "item two", marks: [{ type: "italic" }] }]),
        ],
      },
    ),
    { status: "published" },
  );

  await page.goto("/posts/rendered-post");
  await expect(page.getByRole("heading", { level: 1, name: "Rendered Post" })).toBeVisible();
  await expect(page.getByText("Plain para with")).toContainText("Plain para with bold and a link.");
  await expect(page.locator("main strong")).toHaveText("bold");
  await expect(page.locator("main a[href='https://example.com']")).toHaveText("a link");
  await expect(page.getByRole("heading", { level: 2, name: "A heading" })).toBeVisible();
  await expect(page.locator("main li")).toHaveText(["item one", "item two"]);
  await expect(page.locator("main em")).toHaveText("item two");
});

test("markup in a post's text renders as text on the public page, never runs", async ({ page }) => {
  await createDraftFor(
    author.email,
    "XSS Check",
    textDocument("use <img src=x onerror=\"document.title='XSS-FIRED'\"> here"),
    { status: "published" },
  );

  await page.goto("/posts/xss-check");
  // D26/D28: the public renderer is JSX only, never dangerouslySetInnerHTML -
  // unlike the admin editor (F-33), there is no innerHTML step to exploit here.
  expect(await page.title()).not.toBe("XSS-FIRED");
  expect(await page.locator("main img").count()).toBe(0);
  await expect(page.getByText("use <img", { exact: false })).toBeVisible();
});

test("a draft's URL 404s inside the public chrome, not root's bare error page", async ({
  page,
}) => {
  await createDraftFor(author.email, "Hidden Draft", textDocument(), { status: "draft" });

  const draftResponse = await page.goto("/posts/hidden-draft");
  expect(draftResponse?.status()).toBe(404);
  await expect(page.getByText("Page not found.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Habre CMS" })).toBeVisible();

  const missingResponse = await page.goto("/posts/does-not-exist");
  expect(missingResponse?.status()).toBe(404);
  await expect(page.getByText("Page not found.")).toBeVisible();
});

test("a published page renders its blocks at its own address", async ({ page }) => {
  await createDraftFor(
    author.email,
    "Rendered Page",
    inSection(
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "A heading" }],
      },
      {
        type: "orderedList",
        content: [
          listItem([{ type: "text", text: "item one" }]),
          listItem([{ type: "text", text: "item two" }]),
        ],
      },
    ),
    { status: "published", type: "page" },
  );

  await page.goto("/rendered-page");
  await expect(page.getByRole("heading", { level: 1, name: "Rendered Page" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "A heading" })).toBeVisible();
  await expect(page.locator("main li")).toHaveText(["item one", "item two"]);
});

test("markup in a page's text renders as text on the public page, never runs", async ({ page }) => {
  await createDraftFor(
    author.email,
    "Page XSS Check",
    textDocument("use <img src=x onerror=\"document.title='XSS-FIRED'\"> here"),
    { status: "published", type: "page" },
  );

  await page.goto("/page-xss-check");
  expect(await page.title()).not.toBe("XSS-FIRED");
  expect(await page.locator("main img").count()).toBe(0);
  await expect(page.getByText("use <img", { exact: false })).toBeVisible();
});

test("a draft page's URL 404s inside the public chrome, and so does an unclaimed slug", async ({
  page,
}) => {
  await createDraftFor(author.email, "Hidden Draft Page", textDocument(), {
    status: "draft",
    type: "page",
  });

  const draftResponse = await page.goto("/hidden-draft-page");
  expect(draftResponse?.status()).toBe(404);
  await expect(page.getByText("Page not found.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Habre CMS" })).toBeVisible();

  const missingResponse = await page.goto("/does-not-exist-either");
  expect(missingResponse?.status()).toBe(404);
  await expect(page.getByText("Page not found.")).toBeVisible();
});

/** The 95th-percentile duration of `samples` GET requests, in milliseconds. */
async function measureP95(request: APIRequestContext, url: string, samples = 30): Promise<number> {
  const durations: number[] = [];
  for (let i = 0; i < samples; i++) {
    const start = performance.now();
    const response = await request.get(url);
    await response.body();
    durations.push(performance.now() - start);
  }
  durations.sort((a, b) => a - b);
  return durations[Math.ceil(0.95 * durations.length) - 1];
}

test("public pages meet the quality bar's 500ms p95 (server-side)", async ({ request }) => {
  await createDraftFor(author.email, "Timing Post", textDocument(), { status: "published" });
  await createDraftFor(author.email, "Timing Page", textDocument(), {
    status: "published",
    type: "page",
  });

  const homeP95 = await measureP95(request, "/");
  const postP95 = await measureP95(request, "/posts/timing-post");
  const pageP95 = await measureP95(request, "/timing-page");
  console.log(
    `p95: GET / = ${homeP95.toFixed(1)}ms, GET /posts/:slug = ${postP95.toFixed(1)}ms, GET /:slug = ${pageP95.toFixed(1)}ms`,
  );

  expect(homeP95).toBeLessThan(500);
  expect(postP95).toBeLessThan(500);
  expect(pageP95).toBeLessThan(500);
});
