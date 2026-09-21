import { type APIRequestContext, expect, test } from "@playwright/test";
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

test("the home page lists only published posts, newest first", async ({ page }) => {
  await createDraftFor(author.email, "Older Published", [], {
    status: "published",
    publishedAt: new Date("2026-01-01T00:00:00Z"),
  });
  await createDraftFor(author.email, "Newer Published", [], {
    status: "published",
    publishedAt: new Date("2026-02-01T00:00:00Z"),
  });
  await createDraftFor(author.email, "A Draft", [], { status: "draft" });

  await page.goto("/");
  await expect(page.locator("main a")).toHaveText(["Newer Published", "Older Published"]);
  await expect(page.getByText("A Draft")).toHaveCount(0);
});

test("with nothing published, the home page says so instead of showing a blank page", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("Nothing has been published yet.")).toBeVisible();
});

test("a published post renders its blocks and inline formatting as real elements", async ({
  page,
}) => {
  await createDraftFor(
    author.email,
    "Rendered Post",
    [
      {
        id: "b1",
        type: "text",
        data: {
          text: [
            { text: "Plain para with " },
            { text: "bold", bold: true },
            { text: " and " },
            { text: "a link", href: "https://example.com" },
            { text: "." },
          ],
        },
      },
      { id: "b2", type: "heading", data: { level: 2, text: [{ text: "A heading" }] } },
      {
        id: "b3",
        type: "list",
        data: {
          style: "bullet",
          items: [[{ text: "item one" }], [{ text: "item two", italic: true }]],
        },
      },
    ],
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
    [
      {
        id: "b1",
        type: "text",
        data: { text: [{ text: "use <img src=x onerror=\"document.title='XSS-FIRED'\"> here" }] },
      },
    ],
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
  await createDraftFor(author.email, "Hidden Draft", [], { status: "draft" });

  const draftResponse = await page.goto("/posts/hidden-draft");
  expect(draftResponse?.status()).toBe(404);
  await expect(page.getByText("Page not found.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Habre CMS" })).toBeVisible();

  const missingResponse = await page.goto("/posts/does-not-exist");
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
  await createDraftFor(author.email, "Timing Post", [], { status: "published" });

  const homeP95 = await measureP95(request, "/");
  const postP95 = await measureP95(request, "/posts/timing-post");
  console.log(`p95: GET / = ${homeP95.toFixed(1)}ms, GET /posts/:slug = ${postP95.toFixed(1)}ms`);

  expect(homeP95).toBeLessThan(500);
  expect(postP95).toBeLessThan(500);
});
