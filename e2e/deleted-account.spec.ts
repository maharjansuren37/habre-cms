import { randomInt } from "node:crypto";
import { expect, test } from "@playwright/test";
import { logIn } from "./helpers/auth.ts";
import { textDocument } from "./helpers/documents.ts";
import { insertTestMediaRow } from "./helpers/media.ts";
import { siteOneId, siteUrl } from "./helpers/sites.ts";
import {
  createAdmin,
  createDraftFor,
  removeMembership,
  setRole,
  storedEntry,
  type TestUser,
  withDatabase,
} from "./helpers/users.ts";

// Site 1, as before item 16a, when the public site served only the oldest
// site; it could now move to a site of its own (D308). site_settings'
// home_page_id is shared with home-page.spec.ts (F-103), so it is changed late
// and put back at once.
let admin: TestUser;
let member: TestUser;
let postId: string;
let pageId: string;
let mediaId: string;
let postTitle: string;
let pageTitle: string;
let postSlug: string;
let previousHomePageId: string | null;

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({
    "X-Forwarded-For": `10.${randomInt(256)}.${randomInt(256)}.23`,
  });
  const tag = randomInt(1_000_000);
  postTitle = `Leaver Post ${tag}`;
  pageTitle = `Leaver Page ${tag}`;
  postSlug = postTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  admin = createAdmin("Deleted Spec Admin");
  member = createAdmin("Leaving Member Name");
  await setRole(member.email, "author");
  postId = await createDraftFor(member.email, postTitle, textDocument("Body text"), {
    status: "published",
  });
  pageId = await createDraftFor(member.email, pageTitle, textDocument("Front door"), {
    status: "published",
    type: "page",
  });
  mediaId = await insertTestMediaRow({ uploadedBy: member.email, altText: "Leaver image" });
});

test.afterEach(async () => {
  // The rows have a null author now, so deleteTestUser cannot find them.
  const siteId = await siteOneId();
  await withDatabase(async (sql) => {
    await sql`update site_settings set home_page_id = ${previousHomePageId} where site_id = ${siteId} and home_page_id = ${pageId}`;
    await sql`delete from entries where id in (${postId}, ${pageId})`;
    await sql`delete from media where id = ${mediaId}`;
    await sql`
      delete from site_members where user_id in (select id from users where email in (${admin.email}, ${member.email}))
    `;
    await sql`delete from users where email in (${admin.email}, ${member.email})`;
  });
});

test("a deleted member's rows stay, shown as Deleted account, and stay public", async ({
  page,
}) => {
  const siteId = await siteOneId();
  await withDatabase(async (sql) => {
    const [row] = await sql<{ homePageId: string | null }[]>`
      select home_page_id as "homePageId" from site_settings where site_id = ${siteId}
    `;
    previousHomePageId = row.homePageId;
    await sql`update site_settings set home_page_id = ${pageId} where site_id = ${siteId}`;
  });
  await removeMembership(member.email);

  await logIn(page, admin);

  await page.goto("/admin/posts");
  const postRow = page
    .getByRole("row")
    .filter({ has: page.getByRole("link", { name: postTitle }) });
  await expect(postRow.getByText("Deleted account")).toBeVisible();
  await expect(postRow.getByText("Leaving Member Name")).toHaveCount(0);

  await page.goto("/admin/pages");
  const pageRow = page
    .getByRole("row")
    .filter({ has: page.getByRole("link", { name: pageTitle }) });
  await expect(pageRow.getByText("Deleted account")).toBeVisible();

  await page.goto("/admin/media");
  await expect(page.getByText(/^Deleted account ·/)).toBeVisible();

  const editor = await page.goto(`/admin/posts/${postId}`);
  expect(editor?.status()).toBe(200);
  const versionBefore = (await storedEntry(postId)).version;
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect.poll(async () => (await storedEntry(postId)).version).toBeGreaterThan(versionBefore);

  const publicPost = await page.goto(siteUrl(`/posts/${postSlug}`));
  expect(publicPost?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: postTitle })).toBeVisible();
  await expect(page.locator("time")).toBeVisible();
  await expect(page.getByText("Leaving Member Name")).toHaveCount(0);
  await expect(page.getByText("Deleted account")).toHaveCount(0);
  await expect(page.locator("main p").first()).not.toContainText("·");

  await page.goto(siteUrl("/"));
  await expect(page.getByText("Front door")).toBeVisible();
});
