import { randomInt } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import { textDocument } from "./helpers/documents.ts";
import { createSite, createSiteAdmin, deleteSite } from "./helpers/sites.ts";
import {
  createAdmin,
  createDraftFor,
  deactivateUser,
  deleteEntriesBy,
  deleteTestUser,
  PASSWORD,
  removeMembership,
  type TestUser,
  withDatabase,
} from "./helpers/users.ts";

test.beforeEach(async ({ page }) => {
  // Failed logins are rate-limited per IP; see auth.spec.ts.
  const ip = `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`;
  await page.setExtraHTTPHeaders({ "X-Forwarded-For": ip });
});

async function logIn(page: Page, user: TestUser) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Log in" }).click();
}

async function signIn(page: Page, user: TestUser) {
  await logIn(page, user);
  await expect(page).toHaveURL("/admin/posts");
}

test.describe("a person signs in only through an active membership", () => {
  let user: TestUser;

  test.beforeEach(() => {
    user = createAdmin("Amara Okafor");
  });

  test.afterEach(async () => {
    await deleteTestUser(user.email);
  });

  test("a user whose membership is removed cannot log in", async ({ page }) => {
    await removeMembership(user.email);
    await logIn(page, user);

    await expect(page.getByRole("alert")).toContainText("That email and password don’t match.");
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("a user whose membership is removed loses an open session", async ({ page }) => {
    await logIn(page, user);
    await expect(page).toHaveURL("/admin/posts");

    await removeMembership(user.email);
    await page.reload();

    await expect(page).toHaveURL("/admin/login?redirectTo=%2Fadmin%2Fposts");
  });

  test("a user deactivated through site_members cannot log in", async ({ page }) => {
    await deactivateUser(user.email);
    await logIn(page, user);

    await expect(page.getByRole("alert")).toContainText("That email and password don’t match.");
  });

  test("a user deactivated through site_members loses an open session", async ({ page }) => {
    await logIn(page, user);
    await expect(page).toHaveURL("/admin/posts");

    await deactivateUser(user.email);
    await page.reload();

    await expect(page).toHaveURL("/admin/login?redirectTo=%2Fadmin%2Fposts");
  });
});

test("an admin of a second site can log in and reach the admin", async ({ page }) => {
  const siteId = await createSite("second");
  try {
    const admin = await createSiteAdmin(siteId);
    await logIn(page, admin);

    await expect(page).toHaveURL("/admin/posts");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Posts");
  } finally {
    await deleteSite(siteId);
  }
});

test.describe("the Users screens act only on this site's members", () => {
  let siteId: string;
  let siteAdmin: TestUser;
  let siteOneMember: TestUser;
  let siteOneMemberId: string;

  test.beforeEach(async () => {
    siteId = await createSite("users");
    siteAdmin = await createSiteAdmin(siteId);
    siteOneMember = createAdmin("Site One Member");
    siteOneMemberId = await withDatabase(async (sql) => {
      const [row] = await sql<{ id: string }[]>`
        select id from users where email = ${siteOneMember.email}
      `;
      return row.id;
    });
  });

  test.afterEach(async () => {
    await deleteTestUser(siteOneMember.email);
    await deleteSite(siteId);
  });

  const roleOf = (userId: string) =>
    withDatabase(async (sql) => {
      const [row] = await sql<{ role: string }[]>`
        select role from site_members where user_id = ${userId}
      `;
      return row.role;
    });

  test("opening another site's member answers Not Found", async ({ page }) => {
    await signIn(page, siteAdmin);
    const response = await page.goto(`/admin/users/${siteOneMemberId}`);

    expect(response?.status()).toBe(404);
  });

  test("a role change, reset and deactivation posted for another site's member change nothing", async ({
    page,
  }) => {
    await signIn(page, siteAdmin);
    const origin = new URL(page.url()).origin;
    const url = `${origin}/admin/users/${siteOneMemberId}`;
    const before = await withDatabase(async (sql) => {
      const [row] = await sql<{ tokenVersion: number }[]>`
        select token_version as "tokenVersion" from users where id = ${siteOneMemberId}
      `;
      return row.tokenVersion;
    });

    const forms: Record<string, string>[] = [
      { intent: "change-role", role: "author" },
      { intent: "reset-password", password: "a brand new password 1" },
      { intent: "deactivate" },
    ];
    for (const form of forms) {
      const response = await page.request.post(url, { headers: { Origin: origin }, form });
      expect(response.status()).toBe(404);
    }

    expect(await roleOf(siteOneMemberId)).toBe("admin");
    const after = await withDatabase(async (sql) => {
      const [row] = await sql<{ tokenVersion: number; deactivated: boolean }[]>`
        select u.token_version as "tokenVersion", m.deactivated_at is not null as deactivated
        from users u join site_members m on m.user_id = u.id where u.id = ${siteOneMemberId}
      `;
      return row;
    });
    expect(after.tokenVersion).toBe(before);
    expect(after.deactivated).toBe(false);
  });

  test("the Users list shows only this site's members", async ({ page }) => {
    await signIn(page, siteAdmin);
    await page.goto("/admin/users");

    await expect(page.getByRole("row", { name: /Site Admin/ })).toHaveCount(1);
    await expect(page.getByText(siteOneMember.email)).toHaveCount(0);
    await expect(page.getByRole("row", { name: /Site One Member/ })).toHaveCount(0);
  });

  test("a user added by this site's admin is a member of this site only", async ({ page }) => {
    await signIn(page, siteAdmin);
    await page.goto("/admin/users/new");
    const addedEmail = `e2e-added-${randomInt(1e9)}@example.test`;
    await page.getByLabel("Email").fill(addedEmail);
    await page.getByLabel("Name").fill("Added Person");
    await page.getByLabel("Role").selectOption("editor");
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Create user" }).click();
    await expect(page.getByText("User created.")).toBeVisible();

    const memberships = await withDatabase(
      (sql) =>
        sql<{ siteId: string }[]>`
        select m.site_id as "siteId" from site_members m join users u on u.id = m.user_id
        where u.email = ${addedEmail}
      `,
    );
    expect(memberships.map((row) => row.siteId)).toEqual([siteId]);
  });
});

test.describe("content belongs to one site", () => {
  const tag = String(randomInt(1e9));
  let siteId: string;
  let siteAdmin: TestUser;
  let siteOneAuthor: TestUser;
  let postId: string;
  let pageId: string;
  const postTitle = `Cross site post ${tag}`;
  const pageTitle = `Cross site page ${tag}`;

  test.beforeEach(async () => {
    siteId = await createSite("content");
    siteAdmin = await createSiteAdmin(siteId);
    siteOneAuthor = createAdmin("Site One Author");
    postId = await createDraftFor(siteOneAuthor.email, postTitle, textDocument("Hello"));
    pageId = await createDraftFor(siteOneAuthor.email, pageTitle, textDocument("Hello"), {
      type: "page",
    });
  });

  test.afterEach(async () => {
    await deleteEntriesBy(siteOneAuthor.email);
    await deleteTestUser(siteOneAuthor.email);
    await deleteSite(siteId);
  });

  test("a site-2 admin opening another site's post or page gets Not Found", async ({ page }) => {
    await signIn(page, siteAdmin);

    expect((await page.goto(`/admin/posts/${postId}`))?.status()).toBe(404);
    expect((await page.goto(`/admin/pages/${pageId}`))?.status()).toBe(404);
    expect((await page.goto(`/admin/posts/${postId}/delete`))?.status()).toBe(404);
  });

  test("a site-2 admin's lists show none of another site's entries", async ({ page }) => {
    await signIn(page, siteAdmin);

    await page.goto("/admin/posts");
    await expect(page.getByText(postTitle)).toHaveCount(0);
    await page.goto("/admin/pages");
    await expect(page.getByText(pageTitle)).toHaveCount(0);
  });

  test("two sites can each have a page at the same address, and the public site shows site 1's", async ({
    page,
  }) => {
    const slug = `about-${tag}`;
    const siteOneTitle = `Site one about ${tag}`;
    const siteTwoTitle = `Site two about ${tag}`;
    await createDraftFor(siteOneAuthor.email, slug, textDocument("One"), {
      type: "page",
      status: "published",
    });
    await withDatabase(async (sql) => {
      await sql`update entries set title = ${siteOneTitle} where slug = ${slug}`;
      // The same address in site 2: the database accepts it.
      await sql`
        insert into entries (site_id, type, title, slug, blocks, blocks_format, status,
          published_at, author_id)
        select ${siteId}, 'page', ${siteTwoTitle}, ${slug}, ${sql.json(textDocument("Two") as never)},
          'v4', 'published', now(), u.id
        from users u join site_members m on m.user_id = u.id
        where m.site_id = ${siteId} limit 1
      `;
    });

    await page.goto(`/${slug}`);

    // The page's title is its document title; the body is "One" or "Two".
    await expect(page).toHaveTitle(new RegExp(siteOneTitle));
    await expect(page.getByText("Two")).toHaveCount(0);
  });
});
