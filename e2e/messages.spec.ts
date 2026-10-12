import { randomInt, randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { logIn } from "./helpers/auth.ts";
import { textDocument } from "./helpers/documents.ts";
import { createSiteAdmin, createSiteWithAddress, deleteSite } from "./helpers/sites.ts";
import { type TestUser, withDatabase } from "./helpers/users.ts";

// Item 19c, Step 5: the admin's Messages screen. Each test gets its own site, so
// the counts below are exact and the tests never see each other's messages.

let siteId: string;
let admin: TestUser;
let pageId: string;

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({
    "X-Forwarded-For": `10.${randomInt(256)}.${randomInt(256)}.12`,
  });
  const site = await createSiteWithAddress("messages");
  siteId = site.id;
  admin = await createSiteAdmin(siteId, "Messages Admin");
  const slug = `contact-${randomUUID().slice(0, 8)}`;
  pageId = await withDatabase(async (sql) => {
    const [row] = await sql<{ id: string }[]>`
      insert into entries (site_id, type, title, slug, blocks, blocks_format, status, published_at, author_id)
      select ${siteId}, 'page', 'Get in touch', ${slug}, ${sql.json(textDocument("Hi") as never)},
             'v4', 'published', now(), id
      from users where email = ${admin.email}
      returning id
    `;
    return row.id;
  });
});

test.afterEach(async () => {
  await deleteSite(siteId);
});

type Seed = {
  name?: string;
  message?: string;
  entryId?: string | null;
  minutesAgo?: number;
  notified?: boolean;
  read?: boolean;
};

async function seed(over: Seed = {}): Promise<string> {
  const entryId = over.entryId === undefined ? pageId : over.entryId;
  return withDatabase(async (sql) => {
    const [row] = await sql<{ id: string }[]>`
      insert into contact_submissions
        (site_id, entry_id, name, email, message, created_at, notified_at, read_at)
      values (${siteId}, ${entryId}, ${over.name ?? "Lena Visitor"}, 'lena@example.org',
              ${over.message ?? "Hello there.\nCan you call me?"},
              now() - (${over.minutesAgo ?? 0} * interval '1 minute'),
              ${over.notified === false ? null : new Date()},
              ${over.read ? new Date() : null})
      returning id
    `;
    return row.id;
  });
}

test("with no messages an admin sees the empty state, one h1 and a labelled nav", async ({
  page,
}) => {
  await logIn(page, admin);
  await page.getByRole("link", { name: "Messages" }).click();
  await expect(page).toHaveURL(/\/admin\/messages$/);
  await expect(page).toHaveTitle("Messages - Habre CMS");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Messages");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("navigation").first()).toBeVisible();
  await expect(page.getByText("No messages yet.")).toBeVisible();
  await expect(
    page.getByText(
      "Add a contact form to a page from the editor's palette, and what visitors send appears here.",
    ),
  ).toBeVisible();
});

test("a message shows its sender, a mailto link, the page and Unread", async ({ page }) => {
  await seed();
  await logIn(page, admin);
  await page.goto("/admin/messages");
  const message = page.getByRole("article");
  await expect(message).toHaveCount(1);
  await expect(message.getByText("Lena Visitor", { exact: true })).toBeVisible();
  const mail = message.getByRole("link", { name: "lena@example.org" });
  await expect(mail).toHaveAttribute("href", "mailto:lena@example.org");
  await expect(message.getByText("Sent from Get in touch")).toBeVisible();
  await expect(message.getByText("Unread", { exact: true })).toBeVisible();
  await expect(message.locator("time")).toHaveAttribute("datetime", /^\d{4}-\d\d-\d\dT/);
  await expect(message.getByText("Hello there.")).toBeVisible();
});

test("Mark as read and Mark as unread work with JavaScript off", async ({ browser }) => {
  await seed();
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.setExtraHTTPHeaders({
    "X-Forwarded-For": `10.${randomInt(256)}.${randomInt(256)}.13`,
  });
  try {
    await logIn(page, admin);
    await page.goto("/admin/messages");
    await expect(page.getByText("Unread", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: /Mark as read/ }).click();
    await expect(page.getByText("Unread", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: /Mark as unread/ }).click();
    await expect(page.getByText("Unread", { exact: true })).toBeVisible();
  } finally {
    await context.close();
  }
});

test("21 messages paginate 20 + 1 and a page past the end lands on the last", async ({ page }) => {
  for (let i = 0; i < 21; i++) await seed({ name: `Visitor ${i}`, minutesAgo: i });
  await logIn(page, admin);
  await page.goto("/admin/messages");
  await expect(page.getByRole("article")).toHaveCount(20);
  await page.getByRole("link", { name: "Next" }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByRole("article")).toHaveCount(1);
  await page.goto("/admin/messages?page=99");
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByRole("article")).toHaveCount(1);
});

test("a message from a deleted page says so", async ({ page }) => {
  await seed();
  await withDatabase((sql) => sql`delete from entries where id = ${pageId}`);
  await logIn(page, admin);
  await page.goto("/admin/messages");
  await expect(page.getByText("Sent from a page that has been deleted")).toBeVisible();
});

test("an old message never emailed shows the failed line, a fresh one does not", async ({
  page,
}) => {
  await seed({ name: "Old One", minutesAgo: 10, notified: false });
  await seed({ name: "Fresh One", minutesAgo: 0, notified: false });
  await logIn(page, admin);
  await page.goto("/admin/messages");
  const failed = "We couldn't email this message to you.";
  await expect(page.getByText(failed)).toHaveCount(1);
  const old = page.getByRole("article").filter({ hasText: "Old One" });
  await expect(old.getByText(failed)).toBeVisible();
  const fresh = page.getByRole("article").filter({ hasText: "Fresh One" });
  await expect(fresh.getByText(failed)).toHaveCount(0);
});

for (const role of ["editor", "author"] as const) {
  test(`an ${role} gets Not Found and sees no Messages link`, async ({ page }) => {
    await withDatabase(
      (sql) => sql`
        update site_members set role = ${role}
        where site_id = ${siteId} and user_id = (select id from users where email = ${admin.email})
      `,
    );
    await logIn(page, admin);
    await expect(page.getByRole("link", { name: "Messages" })).toHaveCount(0);
    const response = await page.goto("/admin/messages");
    expect(response?.status()).toBe(404);
  });
}
