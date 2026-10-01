import { randomInt } from "node:crypto";
import { expect, test } from "@playwright/test";
import { logIn } from "./helpers/auth.ts";
import {
  createAdmin,
  createDraftFor,
  deleteEntriesBy,
  deleteTestUser,
  entryExists,
  entryStatus,
  setRole,
  type TestUser,
} from "./helpers/users.ts";

let author: TestUser;

test.beforeEach(async ({ page }) => {
  // A fresh address per test keeps one test's failed logins out of another's budget.
  await page.setExtraHTTPHeaders({ "X-Forwarded-For": `10.${randomInt(256)}.${randomInt(256)}.4` });
  author = createAdmin("List Author");
  await setRole(author.email, "author");
});

test.afterEach(async () => {
  await deleteEntriesBy(author.email);
  await deleteTestUser(author.email);
});

test("the list is scoped by role, and the tabs' counts match", async ({ page }) => {
  const other = createAdmin("Other List Author");
  await setRole(other.email, "author");
  try {
    await createDraftFor(author.email, "My draft", [], { status: "draft" });
    await createDraftFor(author.email, "My published post", [], { status: "published" });
    await createDraftFor(other.email, "Someone else's post", [], { status: "draft" });

    await logIn(page, author);
    // Newest changed first - "My published post" was created after "My draft".
    await expect(page.locator("table tbody tr td:first-child a")).toHaveText([
      "My published post",
      "My draft",
    ]);

    const tabs = page.getByRole("navigation", { name: "Filter posts" });
    await expect(tabs.getByRole("link", { name: /^All/ })).toHaveText("All2");
    await expect(tabs.getByRole("link", { name: /^Drafts/ })).toHaveText("Drafts1");
    await expect(tabs.getByRole("link", { name: /^Published/ })).toHaveText("Published1");

    // An editor sees every author's posts (plan section 6, Permissions).
    await setRole(author.email, "editor");
    await page.reload();
    await expect(
      page.getByRole("link", { name: "Someone else's post", exact: true }),
    ).toBeVisible();
    // At least the three posts made here: other specs running at the same time
    // add posts of their own, which an editor sees too, so an exact count flakes.
    const allTab = await tabs.getByRole("link", { name: /^All/ }).innerText();
    expect(Number(allTab.replace("All", ""))).toBeGreaterThanOrEqual(3);
  } finally {
    await deleteEntriesBy(other.email);
    await deleteTestUser(other.email);
  }
});

test("with no posts at all, the big empty state offers the first one", async ({ page }) => {
  await logIn(page, author);
  const empty = page.getByRole("region", { name: "Write your first post" });
  await expect(empty).toBeVisible();
  await expect(empty.getByRole("link", { name: "New post" })).toHaveAttribute(
    "href",
    "/admin/posts/new",
  );
});

test("a search narrows the table within the active tab, and clears cleanly", async ({ page }) => {
  await createDraftFor(author.email, "Spring planting day", [], { status: "draft" });
  await createDraftFor(author.email, "Zebra migration report", [], { status: "draft" });
  await createDraftFor(author.email, "Autumn harvest report", [], { status: "published" });
  await logIn(page, author);

  await page
    .getByRole("navigation", { name: "Filter posts" })
    .getByRole("link", { name: /^Drafts/ })
    .click();
  await page.waitForURL(/status=draft/);

  const search = page.getByPlaceholder("Search posts");
  await search.fill("Zebra");
  await search.press("Enter");
  await page.waitForURL(/q=Zebra/);
  await expect(page.locator("table tbody tr td:first-child a")).toHaveText([
    "Zebra migration report",
  ]);
  // The published post never appears: the search stayed within the Drafts tab.
  await expect(page.getByText("Autumn harvest report")).toHaveCount(0);

  await search.fill("");
  await search.press("Enter");
  await page.waitForURL(/status=draft/);
  // Newest changed first - "Zebra migration report" was created after "Spring planting day".
  await expect(page.locator("table tbody tr td:first-child a")).toHaveText([
    "Zebra migration report",
    "Spring planting day",
  ]);
});

test("a search with no matches shows a line, not the empty-state panel", async ({ page }) => {
  await createDraftFor(author.email, "A real post", [], { status: "draft" });
  await logIn(page, author);

  const search = page.getByPlaceholder("Search posts");
  await search.fill("nothing matches this");
  await search.press("Enter");
  await page.waitForURL(/q=/);

  await expect(page.getByText("No posts match this filter or search.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Write your first post" })).toHaveCount(0);
});

test("more than one page is paginated, and switching tabs resets to page one", async ({ page }) => {
  for (let n = 1; n <= 25; n++) {
    await createDraftFor(author.email, `Post ${String(n).padStart(2, "0")}`, [], {
      status: "draft",
    });
  }
  await logIn(page, author);

  await expect(page.locator("table tbody tr")).toHaveCount(20);
  await expect(page.getByText("Page 1 of 2")).toBeVisible();

  await page.getByRole("link", { name: /Next/ }).click();
  await page.waitForURL(/page=2/);
  await expect(page.locator("table tbody tr")).toHaveCount(5);
  await expect(page.getByText("Page 2 of 2")).toBeVisible();

  await page
    .getByRole("navigation", { name: "Filter posts" })
    .getByRole("link", { name: /^Drafts/ })
    .click();
  await expect(page).not.toHaveURL(/page=2/);
  await expect(page.locator("table tbody tr")).toHaveCount(20);
});

test("canceling a delete leaves the post exactly as it was", async ({ page }) => {
  const id = await createDraftFor(author.email, "Keep this one", [], { status: "draft" });
  await logIn(page, author);

  await page.getByRole("link", { name: /^Delete Keep this one/ }).click();
  await page.waitForURL(new RegExp(`${id}/delete`));
  await expect(page.getByText("Keep this one")).toBeVisible();

  await page.getByRole("link", { name: "Cancel" }).click();
  await page.waitForURL("**/admin/posts");
  await expect(page.getByRole("link", { name: "Keep this one", exact: true })).toBeVisible();
  expect(await entryExists(id)).toBe(true);
});

test("confirming a delete removes the post and shows a success banner on the list", async ({
  page,
}) => {
  const id = await createDraftFor(author.email, "Remove this one", [], { status: "draft" });
  await logIn(page, author);

  await page.getByRole("link", { name: /^Delete Remove this one/ }).click();
  await page.waitForURL(new RegExp(`${id}/delete`));
  await page.getByRole("button", { name: "Delete post" }).click();

  await page.waitForURL(/deleted=/);
  await expect(page.getByText('"Remove this one" was deleted.')).toBeVisible();
  expect(await entryExists(id)).toBe(false);
});

test("an author cannot reach or delete another author's post - a 404, not a hint", async ({
  page,
}) => {
  const other = createAdmin("Protected List Author");
  await setRole(other.email, "author");
  try {
    const id = await createDraftFor(other.email, "Not yours", [], { status: "draft" });

    await logIn(page, author);
    const getResponse = await page.goto(`/admin/posts/${id}/delete`);
    expect(getResponse?.status()).toBe(404);

    // Same authenticated context as the GET above - page.request shares its
    // cookies - with a matching Origin so the same-origin check is not what
    // answers (that would be a 403, not the 404 this test is about).
    const origin = new URL(page.url()).origin;
    const postResponse = await page.request.post(`${origin}/admin/posts/${id}/delete`, {
      headers: { Origin: origin },
    });
    expect(postResponse.status()).toBe(404);

    expect(await entryExists(id)).toBe(true);
  } finally {
    await deleteEntriesBy(other.email);
    await deleteTestUser(other.email);
  }
});

test("publishing a draft shows it as Published, with a success banner", async ({ page }) => {
  const id = await createDraftFor(author.email, "Ready To Go", [], { status: "draft" });
  await logIn(page, author);
  await page.goto(`/admin/posts/${id}`);

  await page.getByRole("button", { name: "Publish" }).click();
  await page.waitForURL(/published=/);
  await expect(page.getByText('"Ready To Go" was published.')).toBeVisible();
  await expect(
    page
      .locator("tr")
      .filter({ has: page.getByRole("link", { name: "Ready To Go" }) })
      .getByText("Published"),
  ).toBeVisible();
  expect((await entryStatus(id)).status).toBe("published");
});

test("unpublishing a published post reverts it to Draft, with a success banner", async ({
  page,
}) => {
  const id = await createDraftFor(author.email, "Take It Down", [], { status: "published" });
  await logIn(page, author);
  await page.goto(`/admin/posts/${id}`);

  await page.getByRole("button", { name: "Unpublish" }).click();
  await page.waitForURL(/unpublished=/);
  await expect(page.getByText('"Take It Down" was unpublished.')).toBeVisible();
  expect((await entryStatus(id)).status).toBe("draft");
});

test("publishing, unpublishing, then publishing again keeps the original published_at", async ({
  page,
}) => {
  const id = await createDraftFor(author.email, "Round Trip", [], { status: "draft" });
  await logIn(page, author);

  await page.goto(`/admin/posts/${id}`);
  await page.getByRole("button", { name: "Publish" }).click();
  await page.waitForURL(/published=/);
  const firstPublishedAt = (await entryStatus(id)).publishedAt;
  expect(firstPublishedAt).not.toBeNull();

  await page.goto(`/admin/posts/${id}`);
  await page.getByRole("button", { name: "Unpublish" }).click();
  await page.waitForURL(/unpublished=/);
  expect((await entryStatus(id)).publishedAt?.getTime()).toBe(firstPublishedAt?.getTime());

  await page.goto(`/admin/posts/${id}`);
  await page.getByRole("button", { name: "Publish" }).click();
  await page.waitForURL(/published=/);
  expect((await entryStatus(id)).publishedAt?.getTime()).toBe(firstPublishedAt?.getTime());
});

test("an author cannot publish or unpublish another author's post", async ({ page }) => {
  const other = createAdmin("Protected Publish Author");
  await setRole(other.email, "author");
  try {
    const id = await createDraftFor(other.email, "Not Yours To Publish", [], { status: "draft" });
    await logIn(page, author);

    // Same-origin, so the same-origin check is not what answers (that would
    // be a 400, not the 404 this test is about) - matching the delete
    // ownership test above.
    const origin = new URL(page.url()).origin;
    const response = await page.request.post(`${origin}/admin/posts/${id}`, {
      headers: { Origin: origin },
      form: {
        intent: "publish",
        title: "Not Yours To Publish",
        version: "1",
        blocks: JSON.stringify({ blocks: [] }),
      },
    });
    expect(response.status()).toBe(404);
    expect((await entryStatus(id)).status).toBe("draft");
  } finally {
    await deleteEntriesBy(other.email);
    await deleteTestUser(other.email);
  }
});

test("a stale-version publish is refused rather than overwriting a concurrent edit", async ({
  page,
}) => {
  const id = await createDraftFor(author.email, "Racing Save", [], { status: "draft" });
  await logIn(page, author);

  const origin = new URL(page.url()).origin;
  const response = await page.request.post(`${origin}/admin/posts/${id}`, {
    headers: { Origin: origin },
    form: {
      intent: "publish",
      title: "Racing Save",
      version: "999",
      blocks: JSON.stringify({ blocks: [] }),
    },
  });
  expect(response.status()).toBe(409);
  expect((await entryStatus(id)).status).toBe("draft");
});
