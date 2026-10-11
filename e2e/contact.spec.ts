import { createHmac, randomInt, randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { inSection, textDocument } from "./helpers/documents.ts";
import { createSiteAdmin, createSiteWithAddress, deleteSite, siteUrl } from "./helpers/sites.ts";
import { withDatabase } from "./helpers/users.ts";

// Item 19a, Steps 4-5: POST /_contact on a site host, by request, no page. The
// token is minted here with the server's JWT_SECRET in the format
// `<issued-ms>.<HMAC-SHA-256, base64url>`; the app has no endpoint that issues one.

type Site = { id: string; address: string; origin: string; entryId: string; slug: string };

function token(issuedMsAgo: number, secret = process.env.JWT_SECRET): string {
  // The servers inherit this process's environment (CI's GITHUB_ENV line, or a local
  // .env), so an empty secret here would fail every valid-token case with no hint why.
  if (!secret) throw new Error("JWT_SECRET is not set in the test process");
  const issued = String(Date.now() - issuedMsAgo);
  return `${issued}.${createHmac("sha256", secret).update(issued).digest("base64url")}`;
}

/** A distinct client address per call, so the per-IP limiter never bleeds between tests. */
function freshIp(): string {
  return `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`;
}

async function makeSite(label: string): Promise<Site> {
  const site = await createSiteWithAddress(label);
  const admin = await createSiteAdmin(site.id);
  const slug = `contact-${randomUUID().slice(0, 8)}`;
  const entryId = await addPage(site.id, admin.email, slug, "published");
  return { ...site, origin: new URL(siteUrl("/", site.address)).origin, entryId, slug };
}

async function addPage(
  siteId: string,
  authorEmail: string,
  slug: string,
  status: "draft" | "published",
  document: unknown = textDocument("Hello"),
  type: "page" | "post" = "page",
): Promise<string> {
  return withDatabase(async (sql) => {
    const [row] = await sql<{ id: string }[]>`
      insert into entries (site_id, type, title, slug, blocks, blocks_format, status, published_at, author_id)
      select ${siteId}, ${type}, ${slug}, ${slug}, ${sql.json(document as never)}, 'v4',
             ${status}, ${status === "published" ? new Date() : null}, id
      from users where email = ${authorEmail}
      returning id
    `;
    return row.id;
  });
}

type Row = {
  site_id: string;
  entry_id: string;
  name: string;
  email: string;
  message: string;
  notified_at: Date | null;
  read_at: Date | null;
};

function rowsFor(siteId: string): Promise<Row[]> {
  return withDatabase(
    (sql) => sql<Row[]>`select * from contact_submissions where site_id = ${siteId}`,
  );
}

let site: Site;
let other: Site;

test.beforeAll(async () => {
  site = await makeSite("contact-a");
  other = await makeSite("contact-b");
});

test.afterAll(async () => {
  await deleteSite(site.id);
  await deleteSite(other.id);
});

type Fields = Record<string, string>;

function validFields(over: Fields = {}): Fields {
  return {
    name: "Lena",
    email: "lena@example.org",
    message: "Hello there.\nCan you call me?",
    entry: site.entryId,
    started: token(5000),
    url: "",
    ...over,
  };
}

async function post(
  request: import("@playwright/test").APIRequestContext,
  fields: Fields,
  options: { ip?: string; origin?: string; on?: Site } = {},
) {
  const target = options.on ?? site;
  return request.post(siteUrl("/_contact", target.address), {
    form: fields,
    headers: {
      Origin: options.origin ?? target.origin,
      "X-Forwarded-For": options.ip ?? freshIp(),
    },
    maxRedirects: 0,
  });
}

function location(response: { headers(): Record<string, string> }): string {
  return response.headers().location ?? "";
}

test("a valid message is stored for the site and the page, and answered sent", async ({
  request,
}) => {
  const before = (await rowsFor(site.id)).length;
  const response = await post(request, validFields({ name: "  Ada  " }));

  expect(response.status()).toBe(303);
  expect(location(response)).toBe(`/${site.slug}?contact=sent#contact`);
  const rows = await rowsFor(site.id);
  expect(rows).toHaveLength(before + 1);
  const row = rows.find((r) => r.name === "Ada");
  expect(row).toMatchObject({
    site_id: site.id,
    entry_id: site.entryId,
    email: "lena@example.org",
    message: "Hello there.\nCan you call me?",
    notified_at: null,
    read_at: null,
  });
});

test("a filled honeypot is answered sent and stores nothing", async ({ request }) => {
  const before = (await rowsFor(site.id)).length;
  const response = await post(request, validFields({ url: "https://spam.example" }));

  expect(response.status()).toBe(303);
  expect(location(response)).toBe(`/${site.slug}?contact=sent#contact`);
  expect(await rowsFor(site.id)).toHaveLength(before);
});

test("a token issued under 3 seconds ago answers again and stores nothing", async ({ request }) => {
  const before = (await rowsFor(site.id)).length;
  const response = await post(request, validFields({ started: token(500) }));

  expect(response.status()).toBe(303);
  expect(location(response)).toBe(`/${site.slug}?contact=again#contact`);
  expect(await rowsFor(site.id)).toHaveLength(before);
});

test("a forged, missing or stale token answers again", async ({ request }) => {
  const before = (await rowsFor(site.id)).length;
  for (const started of [token(5000, "not the secret"), "", token(25 * 60 * 60 * 1000)]) {
    const response = await post(request, validFields({ started }));
    expect(location(response)).toBe(`/${site.slug}?contact=again#contact`);
  }
  expect(await rowsFor(site.id)).toHaveLength(before);
});

test("an empty name, a bad email or a 5,001-character message is invalid", async ({ request }) => {
  const before = (await rowsFor(site.id)).length;
  const cases: Fields[] = [{ name: "   " }, { email: "no-at-sign" }, { message: "x".repeat(5001) }];
  for (const over of cases) {
    const response = await post(request, validFields(over));
    expect(response.status()).toBe(303);
    expect(location(response)).toBe(`/${site.slug}?contact=invalid#contact`);
  }
  expect(await rowsFor(site.id)).toHaveLength(before);
});

test("a message of exactly 5,000 characters is accepted", async ({ request }) => {
  const response = await post(request, validFields({ message: "y".repeat(5000) }));

  expect(location(response)).toBe(`/${site.slug}?contact=sent#contact`);
});

test("the sixth post from one address is busy, another address still works", async ({
  request,
}) => {
  const ip = freshIp();
  const before = (await rowsFor(site.id)).length;
  for (let i = 0; i < 5; i++) {
    const response = await post(request, validFields({ message: `Message ${i}` }), { ip });
    expect(location(response)).toBe(`/${site.slug}?contact=sent#contact`);
  }
  const sixth = await post(request, validFields({ message: "Message 6" }), { ip });
  expect(sixth.status()).toBe(303);
  expect(location(sixth)).toBe("/?contact=busy#contact");
  expect(await rowsFor(site.id)).toHaveLength(before + 5);

  const elsewhere = await post(request, validFields());
  expect(location(elsewhere)).toBe(`/${site.slug}?contact=sent#contact`);
});

test("a draft entry is invalid and stores nothing", async ({ request }) => {
  const admin = await withDatabase(
    (sql) => sql<{ email: string }[]>`
      select u.email from users u join site_members m on m.user_id = u.id
      where m.site_id = ${site.id} limit 1`,
  );
  const draftId = await addPage(
    site.id,
    admin[0].email,
    `draft-${randomUUID().slice(0, 8)}`,
    "draft",
  );
  const before = (await rowsFor(site.id)).length;

  const response = await post(request, validFields({ entry: draftId }));

  expect(response.status()).toBe(303);
  expect(location(response)).toBe("/?contact=invalid#contact");
  expect(await rowsFor(site.id)).toHaveLength(before);
});

test("a body over 16 KiB is refused with 413", async ({ request }) => {
  const response = await post(request, validFields({ message: "z".repeat(17 * 1024) }));

  expect(response.status()).toBe(413);
});

test("a cross-origin post is refused with 403 and stores nothing", async ({ request, baseURL }) => {
  const before = (await rowsFor(site.id)).length;
  const fromPlatform = await post(request, validFields(), { origin: baseURL ?? "" });
  const fromOtherSite = await post(request, validFields(), { origin: other.origin });

  expect(fromPlatform.status()).toBe(403);
  expect(fromOtherSite.status()).toBe(403);
  expect(await rowsFor(site.id)).toHaveLength(before);
});

test("GET /_contact is 405", async ({ request }) => {
  const response = await request.get(siteUrl("/_contact", site.address), { maxRedirects: 0 });

  expect(response.status()).toBe(405);
});

test("a submission to site A is stored under A and not B", async ({ request }) => {
  const beforeA = (await rowsFor(site.id)).length;
  const beforeB = (await rowsFor(other.id)).length;

  const response = await post(request, validFields({ message: "For A only" }));

  expect(location(response)).toBe(`/${site.slug}?contact=sent#contact`);
  expect(await rowsFor(site.id)).toHaveLength(beforeA + 1);
  expect(await rowsFor(other.id)).toHaveLength(beforeB);
});

test("an entry of site B posted to site A is invalid and stores nothing", async ({ request }) => {
  const beforeA = (await rowsFor(site.id)).length;
  const beforeB = (await rowsFor(other.id)).length;

  const response = await post(request, validFields({ entry: other.entryId }));

  expect(location(response)).toBe("/?contact=invalid#contact");
  expect(await rowsFor(site.id)).toHaveLength(beforeA);
  expect(await rowsFor(other.id)).toHaveLength(beforeB);
});

test("a post to the platform host is 404 and stores nothing", async ({ request, baseURL }) => {
  const before = (await rowsFor(site.id)).length;
  const response = await request.post(`${baseURL}/_contact`, {
    form: validFields(),
    headers: { Origin: baseURL ?? "", "X-Forwarded-For": freshIp() },
    maxRedirects: 0,
  });

  expect(response.status()).toBe(404);
  expect(await rowsFor(site.id)).toHaveLength(before);
});

test("a suspended site answers 404 and stores nothing", async ({ request }) => {
  const before = (await rowsFor(site.id)).length;
  await withDatabase((sql) => sql`update sites set suspended_at = now() where id = ${site.id}`);
  try {
    const response = await post(request, validFields());
    expect(response.status()).toBe(404);
  } finally {
    await withDatabase((sql) => sql`update sites set suspended_at = null where id = ${site.id}`);
  }
  expect(await rowsFor(site.id)).toHaveLength(before);
});

// Item 19b, Step 3: what the public loaders hand a page. Entry id and token only
// reach the HTML when the document holds a contact form (F-108).
const THANKS = "Thanks, we will reply soon.";

async function addContactPage(on: Site): Promise<{ id: string; slug: string }> {
  const [admin] = await withDatabase(
    (sql) => sql<{ email: string }[]>`
      select u.email from users u join site_members m on m.user_id = u.id
      where m.site_id = ${on.id} limit 1`,
  );
  const slug = `form-${randomUUID().slice(0, 8)}`;
  const document = inSection({
    type: "contactForm",
    attrs: { buttonLabel: "Send message", thanks: THANKS },
  });
  const id = await addPage(on.id, admin.email, slug, "published", document);
  return { id, slug };
}

test("a page with a contact form carries its entry id and a started token", async ({ page }) => {
  const form = await addContactPage(site);
  await page.goto(siteUrl(`/${form.slug}`, site.address));

  await expect(page.locator('input[name="entry"]')).toHaveValue(form.id);
  await expect(page.locator('input[name="started"]')).toHaveValue(/^\d+\.[\w-]+$/);
  await expect(page.getByRole("status")).toHaveCount(0);
});

test("a page without a contact form carries neither entry id nor token", async ({ request }) => {
  const response = await request.get(siteUrl(`/${site.slug}`, site.address));
  const html = await response.text();

  expect(response.status()).toBe(200);
  expect(html).not.toContain(site.entryId);
  expect(html).not.toContain("started");
});

test("?contact=sent shows the block's thanks line", async ({ page }) => {
  const form = await addContactPage(site);
  await page.goto(siteUrl(`/${form.slug}?contact=sent`, site.address));

  await expect(page.getByRole("status")).toHaveText(THANKS);
});

test("?contact=again shows the fixed line", async ({ page }) => {
  const form = await addContactPage(site);
  await page.goto(siteUrl(`/${form.slug}?contact=again`, site.address));

  await expect(page.getByRole("status")).toContainText("a little quick");
});

test("an unknown ?contact= value shows no status line", async ({ page }) => {
  const form = await addContactPage(site);
  await page.goto(siteUrl(`/${form.slug}?contact=bogus`, site.address));

  await expect(page.locator("form#contact")).toBeVisible();
  await expect(page.getByRole("status")).toHaveCount(0);
});

// Item 19b review F-397: the post and home loaders hand the form the same way.
async function adminEmail(on: Site): Promise<string> {
  const [admin] = await withDatabase(
    (sql) => sql<{ email: string }[]>`
      select u.email from users u join site_members m on m.user_id = u.id
      where m.site_id = ${on.id} limit 1`,
  );
  return admin.email;
}

function contactDocument(): unknown {
  return inSection({
    type: "contactForm",
    attrs: { buttonLabel: "Send message", thanks: THANKS },
  });
}

async function addPost(on: Site, document: unknown): Promise<{ id: string; slug: string }> {
  const slug = `post-${randomUUID().slice(0, 8)}`;
  const id = await addPage(on.id, await adminEmail(on), slug, "published", document, "post");
  return { id, slug };
}

async function setHome(on: Site, entryId: string | null): Promise<void> {
  await withDatabase(
    (sql) => sql`update site_settings set home_page_id = ${entryId} where site_id = ${on.id}`,
  );
}

test("a post with a contact form carries its entry id and a started token", async ({ page }) => {
  const post = await addPost(site, contactDocument());
  await page.goto(siteUrl(`/posts/${post.slug}`, site.address));

  await expect(page.locator('input[name="entry"]')).toHaveValue(post.id);
  await expect(page.locator('input[name="started"]')).toHaveValue(/^\d+\.[\w-]+$/);
});

test("a post without a contact form carries neither entry id nor token", async ({ request }) => {
  const post = await addPost(site, textDocument("Plain post"));
  const response = await request.get(siteUrl(`/posts/${post.slug}`, site.address));
  const html = await response.text();

  expect(response.status()).toBe(200);
  expect(html).not.toContain(post.id);
  expect(html).not.toContain("started");
});

test("a home page with a contact form carries its entry id and a started token", async ({
  page,
}) => {
  const form = await addContactPage(other);
  await setHome(other, form.id);
  await page.goto(siteUrl("/", other.address));

  await expect(page.locator('input[name="entry"]')).toHaveValue(form.id);
  await expect(page.locator('input[name="started"]')).toHaveValue(/^\d+\.[\w-]+$/);
});

test("a home page without a contact form carries neither entry id nor token", async ({
  request,
}) => {
  await setHome(other, other.entryId);
  const response = await request.get(siteUrl("/", other.address));
  const html = await response.text();

  expect(response.status()).toBe(200);
  expect(html).not.toContain(other.entryId);
  expect(html).not.toContain("started");
});

test("?contact=sent on the home page shows the thanks line", async ({ page }) => {
  const form = await addContactPage(other);
  await setHome(other, form.id);
  await page.goto(siteUrl("/?contact=sent", other.address));

  await expect(page.getByRole("status")).toHaveText(THANKS);
});
