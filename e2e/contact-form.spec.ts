import { randomInt, randomUUID } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import { logIn } from "./helpers/auth.ts";
import { inSection, textDocument } from "./helpers/documents.ts";
import { messagesTo } from "./helpers/mail.ts";
import { createSiteAdmin, createSiteWithAddress, deleteSite, siteUrl } from "./helpers/sites.ts";
import { type TestUser, withDatabase } from "./helpers/users.ts";

// Item 19b, Step 5: the contact form's journey. An admin adds the block and
// publishes; a visitor on the site host fills it in and sends it; the message is
// stored under the right site and entry. The server's 3 s minimum fill time
// (19a) is waited out for the happy paths and deliberately not for `again`.

const THANKS = "Thanks, we will reply soon.";
const MIN_FILL_MS = 3200;

type Site = { id: string; address: string };
type Row = { site_id: string; entry_id: string; name: string; email: string; message: string };

let site: Site;
let admin: TestUser;

test.beforeAll(async () => {
  site = await createSiteWithAddress("contact-form");
  admin = await createSiteAdmin(site.id);
});

test.afterAll(async () => {
  await deleteSite(site.id);
});

/** A distinct client address per context, so the per-IP limiter never bleeds between tests. */
function freshIp(): string {
  return `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`;
}

async function addPage(
  title: string,
  status: "draft" | "published",
  document: unknown,
): Promise<{ id: string; slug: string }> {
  const slug = `${title}-${randomUUID().slice(0, 8)}`;
  const id = await withDatabase(async (sql) => {
    const [row] = await sql<{ id: string }[]>`
      insert into entries (site_id, type, title, slug, blocks, blocks_format, status, published_at, author_id)
      select ${site.id}, 'page', ${slug}, ${slug}, ${sql.json(document as never)}, 'v4',
             ${status}, ${status === "published" ? new Date() : null}, id
      from users where email = ${admin.email}
      returning id
    `;
    return row.id;
  });
  return { id, slug };
}

function rowsFor(entryId: string): Promise<Row[]> {
  return withDatabase(
    (sql) => sql<Row[]>`
      select site_id, entry_id, name, email, message
      from contact_submissions where site_id = ${site.id} and entry_id = ${entryId}`,
  );
}

function contactPage() {
  return addPage(
    "form",
    "published",
    inSection({
      type: "contactForm",
      attrs: { buttonLabel: "Send message", thanks: THANKS },
    }),
  );
}

async function fillIn(page: Page, message: string) {
  await page.getByLabel("Name").fill("Lena");
  await page.getByLabel("Email").fill("lena@example.org");
  await page.getByLabel("Message").fill(message);
}

async function sendAfterWaiting(page: Page, slug: string, message: string) {
  await page.goto(siteUrl(`/${slug}`, site.address));
  await expect(page.getByRole("button", { name: "Send message" })).toBeEnabled();
  await page.waitForTimeout(MIN_FILL_MS);
  await fillIn(page, message);
  await page.getByRole("button", { name: "Send message" }).click();
}

test("an admin adds the form and publishes; a visitor sends a message and sees the thanks", async ({
  page,
}) => {
  await page.setExtraHTTPHeaders({ "X-Forwarded-For": freshIp() });
  const { id, slug } = await addPage("journey", "draft", textDocument("Start here."));

  await logIn(page, admin);
  await page.goto(`/admin/pages/${id}`);
  const textbox = page.getByRole("textbox", { name: "Page content" });
  await textbox.getByText("Start here.").click();
  await page.evaluate("new Promise((done) => requestAnimationFrame(() => setTimeout(done)))");
  await page
    .getByRole("complementary", { name: "Add to the page" })
    .getByRole("button", { name: "Contact form", exact: true })
    .click();
  await expect(textbox.locator('[data-node="contactForm"]')).toBeVisible();
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page).toHaveURL(/\/admin\/pages\?/);

  const response = await page.goto(siteUrl(`/${slug}`, site.address));
  // 19a's note: the page's policy already lets the form post to its own site.
  expect(response?.headers()["content-security-policy"]).toContain("form-action 'self'");

  await page.getByLabel("Name").fill("Lena");
  await page.getByLabel("Email").fill("lena@example.org");
  await page.getByLabel("Message").fill("Hello from the journey.");
  await page.waitForTimeout(MIN_FILL_MS);
  await page.getByRole("button", { name: "Send message" }).click();

  await expect(page).toHaveURL(siteUrl(`/${slug}?contact=sent#contact`, site.address));
  await expect(page.getByRole("status")).toHaveText("Thanks - your message has been sent.");
  expect(await rowsFor(id)).toEqual([
    {
      site_id: site.id,
      entry_id: id,
      name: "Lena",
      email: "lena@example.org",
      message: "Hello from the journey.",
    },
  ]);
});

test("with JavaScript off the form still sends and the thanks line shows", async ({ browser }) => {
  const { id, slug } = await contactPage();
  const context = await browser.newContext({
    javaScriptEnabled: false,
    extraHTTPHeaders: { "X-Forwarded-For": freshIp() },
  });
  try {
    const page = await context.newPage();
    await sendAfterWaiting(page, slug, "No scripts here.");

    await expect(page).toHaveURL(siteUrl(`/${slug}?contact=sent#contact`, site.address));
    await expect(page.getByRole("status")).toHaveText(THANKS);
    expect(await rowsFor(id)).toMatchObject([{ message: "No scripts here." }]);
  } finally {
    await context.close();
  }
});

test("an empty form is stopped by the browser beside the field and nothing is sent", async ({
  browser,
}) => {
  const { id, slug } = await contactPage();
  const context = await browser.newContext({ extraHTTPHeaders: { "X-Forwarded-For": freshIp() } });
  try {
    const page = await context.newPage();
    const address = siteUrl(`/${slug}`, site.address);
    await page.goto(address);
    await page.waitForTimeout(MIN_FILL_MS);
    await page.getByRole("button", { name: "Send message" }).click();

    await expect(page).toHaveURL(address);
    const name = page.getByLabel("Name");
    await expect(name).toBeFocused();
    await expect(page.locator('input[name="name"]:invalid')).toHaveCount(1);
    expect(await rowsFor(id)).toHaveLength(0);
  } finally {
    await context.close();
  }
});

test("a form sent in under 3 seconds shows the again line and stores nothing", async ({
  browser,
}) => {
  const { id, slug } = await contactPage();
  const context = await browser.newContext({ extraHTTPHeaders: { "X-Forwarded-For": freshIp() } });
  try {
    const page = await context.newPage();
    await page.goto(siteUrl(`/${slug}`, site.address));
    await fillIn(page, "Too fast.");
    await page.getByRole("button", { name: "Send message" }).click();

    await expect(page).toHaveURL(siteUrl(`/${slug}?contact=again#contact`, site.address));
    await expect(page.getByRole("status")).toContainText("a little quick");
    expect(await rowsFor(id)).toHaveLength(0);
  } finally {
    await context.close();
  }
});

test("journey 10: a visitor's message reaches the admin's Messages screen and inbox", async ({
  browser,
  page,
}) => {
  const { slug } = await contactPage();
  const message = `Journey ten ${randomUUID().slice(0, 8)}: can you call me?`;
  const visitor = await browser.newContext({ extraHTTPHeaders: { "X-Forwarded-For": freshIp() } });
  try {
    const visitorPage = await visitor.newPage();
    await sendAfterWaiting(visitorPage, slug, message);
    await expect(visitorPage).toHaveURL(siteUrl(`/${slug}?contact=sent#contact`, site.address));
    await expect(visitorPage.getByRole("status")).toHaveText(THANKS);
  } finally {
    await visitor.close();
  }

  await page.setExtraHTTPHeaders({ "X-Forwarded-For": freshIp() });
  await logIn(page, admin);
  await page.getByRole("link", { name: "Messages" }).click();
  await expect(page).toHaveURL(/\/admin\/messages$/);
  const card = page.getByRole("article").filter({ hasText: message });
  await expect(card).toHaveCount(1);
  await expect(card.getByText("Lena", { exact: true })).toBeVisible();
  await expect(card.getByRole("link", { name: "lena@example.org" })).toHaveAttribute(
    "href",
    "mailto:lena@example.org",
  );
  await expect(card.getByText("Unread", { exact: true })).toBeVisible();
  await card.getByRole("button", { name: /Mark as read/ }).click();
  await expect(card.getByText("Unread", { exact: true })).toHaveCount(0);

  // The site's admin also receives the other tests' messages, so find this one by its text.
  const inbox = async () =>
    Promise.all(
      (await messagesTo(admin.email)).map(async (id) => {
        const response = await fetch(`http://127.0.0.1:8025/api/v1/message/${id}`);
        return (await response.json()) as { Text: string; ReplyTo: { Address: string }[] };
      }),
    );
  await expect
    .poll(async () => (await inbox()).filter((mail) => mail.Text.includes(message)).length, {
      timeout: 10_000,
    })
    .toBe(1);
  const mail = (await inbox()).find((candidate) => candidate.Text.includes(message));
  expect(mail?.ReplyTo.map((to) => to.Address)).toEqual(["lena@example.org"]);
});
