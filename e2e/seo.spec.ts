import { randomUUID } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import { logIn } from "./helpers/auth.ts";
import { textDocument } from "./helpers/documents.ts";
import { deleteTestMedia, insertTestMediaRow, testMediaFilename } from "./helpers/media.ts";
import { PORT, PROXIED_PORT } from "./helpers/ports.ts";
import {
  createSite,
  createSiteAdmin,
  createSiteWithAddress,
  deleteSite,
  siteUrl,
} from "./helpers/sites.ts";
import {
  createAdmin,
  createDraftFor,
  deleteEntriesBy,
  deleteTestUser,
  setRole,
  storedEntry,
  type TestUser,
  withDatabase,
} from "./helpers/users.ts";

// Database only - no page. Setup and checks run as the owner, so the foreign
// key itself is what is under test, not row-level security. Both sites are the
// test's own: site 1's shared rows are never touched (F-103).

let siteA: string;
let siteB: string;

test.beforeAll(async () => {
  siteA = await createSite("seo-a");
  siteB = await createSite("seo-b");
});

test.afterAll(async () => {
  await deleteSite(siteA);
  await deleteSite(siteB);
});

test("an entry cannot use another site's image", async () => {
  const tag = randomUUID().slice(0, 8);
  const adminA = await createSiteAdmin(siteA, "Seo A");
  const adminB = await createSiteAdmin(siteB, "Seo B");
  const mediaA = await insertTestMediaRow({ uploadedBy: adminA.email, siteId: siteA });
  const mediaB = await insertTestMediaRow({ uploadedBy: adminB.email, siteId: siteB });

  await withDatabase(async (sql) => {
    const [entry] = await sql<{ id: string }[]>`
      insert into entries (site_id, type, title, slug, blocks, blocks_format, status, author_id)
      select ${siteA}, 'page', ${tag}, ${tag}, ${sql.json({ type: "doc", content: [] })}, 'v4', 'draft', id
      from users where email = ${adminA.email}
      returning id
    `;

    // New entries start with no search fields and no image.
    const [fresh] = await sql`
      select seo_title, seo_description, social_image_media_id from entries where id = ${entry.id}
    `;
    expect(fresh).toEqual({ seo_title: "", seo_description: "", social_image_media_id: null });

    // Another site's media row is refused by the foreign key.
    const refused = await sql`
      update entries set social_image_media_id = ${mediaB} where id = ${entry.id}
    `.then(
      () => null,
      (error: { code?: string; constraint_name?: string }) => error,
    );
    expect(refused?.code).toBe("23503");
    expect(refused?.constraint_name).toBe("entries_social_image_media_id_fkey");

    // Its own site's row is accepted...
    await sql`update entries set social_image_media_id = ${mediaA} where id = ${entry.id}`;
    const [set] = await sql`select social_image_media_id from entries where id = ${entry.id}`;
    expect(set.social_image_media_id).toBe(mediaA);

    // ...and deleting that image clears the reference, not the entry.
    await sql`delete from media where id = ${mediaA}`;
    const [cleared] = await sql`
      select social_image_media_id, site_id from entries where id = ${entry.id}
    `;
    expect(cleared).toEqual({ social_image_media_id: null, site_id: siteA });
  });

  await deleteTestMedia(mediaB);
});

// Step 2: the main address and the canonical link. The proxied server's
// SITES_URL is https, so a verified own domain is the main address there; the
// primary server's is http, so the subdomain always is.
const PROXIED = `http://127.0.0.1:${PROXIED_PORT}`;

function canonicalOf(html: string): string | null {
  const tag = html.match(/<link[^>]*rel="canonical"[^>]*>/)?.[0];
  return tag?.match(/href="([^"]*)"/)?.[1] ?? null;
}

test("a site with an own domain redirects its subdomain there, and the domain serves it", async ({
  request,
}) => {
  const site = await createSiteWithAddress("seo-main");
  const domain = `seo-${randomUUID().slice(0, 8)}.example`;
  try {
    await withDatabase(async (sql) => {
      await sql`
        insert into site_domains (domain, site_id, verified_at) values (${domain}, ${site.id}, now())
      `;
    });
    const subdomain = await request.get(
      `http://${site.address}.localhost:${PROXIED_PORT}/posts?x=1`,
      { maxRedirects: 0 },
    );
    expect(subdomain.status()).toBe(301);
    expect(subdomain.headers().location).toBe(`https://${domain}/posts?x=1`);
    // Cached a day at most: item 21 can take a domain away again.
    expect(subdomain.headers()["cache-control"]).toBe("max-age=86400");

    const own = await request.get(`${PROXIED}/posts`, {
      headers: { "X-Forwarded-Host": domain, "X-Forwarded-Proto": "https" },
      maxRedirects: 0,
    });
    expect(own.status()).toBe(200);
    expect(canonicalOf(await own.text())).toBe(`https://${domain}/posts`);

    // Only GET and HEAD move; a POST is served where it arrives.
    const post = await request.post(`http://${site.address}.localhost:${PROXIED_PORT}/posts`, {
      maxRedirects: 0,
    });
    expect(post.status()).not.toBe(301);
  } finally {
    await withDatabase(async (sql) => {
      await sql`delete from site_domains where domain = ${domain}`;
    });
    await deleteSite(site.id);
  }
});

test("a site with no own domain is not redirected on the proxied server", async ({ request }) => {
  const site = await createSiteWithAddress("seo-nodomain");
  try {
    const response = await request.get(`http://${site.address}.localhost:${PROXIED_PORT}/`, {
      maxRedirects: 0,
    });
    expect(response.status()).toBe(200);
  } finally {
    await deleteSite(site.id);
  }
});

test("site 1 answers at its address with its own address as canonical", async ({ request }) => {
  const response = await request.get(siteUrl("/"), { maxRedirects: 0 });
  expect(response.status()).toBe(200);
  expect(canonicalOf(await response.text())).toBe(`http://surenmaharjan.localhost:${PORT}/`);
});

test("a published page's canonical link is its own path", async ({ request }) => {
  const site = await createSiteWithAddress("seo-canon");
  try {
    const admin = await createSiteAdmin(site.id, "Seo Canon");
    await withDatabase(async (sql) => {
      await sql`
        insert into entries (site_id, type, title, slug, blocks, blocks_format, status, published_at, author_id)
        select ${site.id}, 'page', 'About us', 'about-us', ${sql.json({ type: "doc", content: [] })}, 'v4', 'published', now(), id
        from users where email = ${admin.email}
      `;
    });
    const url = siteUrl("/about-us", site.address);
    const response = await request.get(url, { maxRedirects: 0 });
    expect(response.status()).toBe(200);
    expect(canonicalOf(await response.text())).toBe(url);
  } finally {
    await deleteSite(site.id);
  }
});

// Step 3: robots.txt, sitemap.xml and noindex.
const EMPTY_DOC = { type: "doc", content: [] };

type SeedEntry = { type: "page" | "post"; slug: string; status: "draft" | "published" };

/** Inserts entries as the owner and returns the page ids by slug. */
async function seedEntries(siteId: string, authorEmail: string, entries: SeedEntry[]) {
  return withDatabase(async (sql) => {
    const ids: Record<string, string> = {};
    for (const e of entries) {
      const [row] = await sql<{ id: string }[]>`
        insert into entries (site_id, type, title, slug, blocks, blocks_format, status, published_at, author_id)
        select ${siteId}, ${e.type}, ${e.slug}, ${e.slug}, ${sql.json(EMPTY_DOC)}, 'v4', ${e.status},
          ${e.status === "published" ? sql`now()` : null}, id
        from users where email = ${authorEmail}
        returning id
      `;
      ids[e.slug] = row.id;
    }
    return ids;
  });
}

function locsOf(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);
}

test("the platform host's robots.txt disallows everything", async ({ request }) => {
  const response = await request.get(`http://127.0.0.1:${PORT}/robots.txt`, { maxRedirects: 0 });
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("text/plain; charset=utf-8");
  const body = await response.text();
  expect(body).toContain("User-agent: *");
  expect(body).toContain("Disallow: /");
  expect(body).not.toContain("Allow: /\n");
  // Only robots.txt is new on the platform host.
  const sitemap = await request.get(`http://127.0.0.1:${PORT}/sitemap.xml`, { maxRedirects: 0 });
  expect(sitemap.status()).toBe(404);
});

test("a site's robots.txt allows everything and names its sitemap on the main address", async ({
  request,
}) => {
  const site = await createSiteWithAddress("seo-robots");
  try {
    const response = await request.get(siteUrl("/robots.txt", site.address), { maxRedirects: 0 });
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("text/plain; charset=utf-8");
    const body = await response.text();
    expect(body).toContain("User-agent: *");
    expect(body).toContain("Allow: /");
    expect(body).not.toContain("Disallow");
    expect(body).toContain(`Sitemap: http://${site.address}.localhost:${PORT}/sitemap.xml`);
  } finally {
    await deleteSite(site.id);
  }
});

test("the sitemap lists published pages and posts, the home page only as /, never a draft", async ({
  request,
}) => {
  const site = await createSiteWithAddress("seo-map");
  try {
    const admin = await createSiteAdmin(site.id, "Seo Map");
    const ids = await seedEntries(site.id, admin.email, [
      { type: "page", slug: "front", status: "published" },
      { type: "page", slug: "about", status: "published" },
      { type: "page", slug: "secret", status: "draft" },
      { type: "post", slug: "hello", status: "published" },
      { type: "post", slug: "wip", status: "draft" },
    ]);
    await withDatabase(async (sql) => {
      await sql`update site_settings set home_page_id = ${ids.front} where site_id = ${site.id}`;
    });
    const response = await request.get(siteUrl("/sitemap.xml", site.address), { maxRedirects: 0 });
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("application/xml; charset=utf-8");
    const xml = await response.text();
    const origin = `http://${site.address}.localhost:${PORT}`;
    expect([...locsOf(xml)].sort()).toEqual(
      [`${origin}/`, `${origin}/about`, `${origin}/posts`, `${origin}/posts/hello`].sort(),
    );
    expect(xml).toMatch(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/);
  } finally {
    await deleteSite(site.id);
  }
});

test("a site with nothing published has an empty sitemap and a noindex placeholder", async ({
  request,
}) => {
  const site = await createSiteWithAddress("seo-empty");
  try {
    const admin = await createSiteAdmin(site.id, "Seo Empty");
    await seedEntries(site.id, admin.email, [{ type: "page", slug: "draft", status: "draft" }]);
    const sitemap = await request.get(siteUrl("/sitemap.xml", site.address), { maxRedirects: 0 });
    expect(sitemap.status()).toBe(200);
    expect(locsOf(await sitemap.text())).toEqual([]);

    const home = await request.get(siteUrl("/", site.address), { maxRedirects: 0 });
    expect(await home.text()).toMatch(/<meta[^>]*name="robots"[^>]*content="noindex"/);
  } finally {
    await deleteSite(site.id);
  }
});

test("a site with a published home page carries no noindex", async ({ request }) => {
  const site = await createSiteWithAddress("seo-home");
  try {
    const admin = await createSiteAdmin(site.id, "Seo Home");
    const ids = await seedEntries(site.id, admin.email, [
      { type: "page", slug: "front", status: "published" },
    ]);
    await withDatabase(async (sql) => {
      await sql`update site_settings set home_page_id = ${ids.front} where site_id = ${site.id}`;
    });
    const home = await request.get(siteUrl("/", site.address), { maxRedirects: 0 });
    expect(home.status()).toBe(200);
    expect(await home.text()).not.toMatch(/name="robots"/);
  } finally {
    await deleteSite(site.id);
  }
});

test("a site with 1,000 published posts answers its sitemap in under 500 ms", async ({
  request,
}) => {
  const site = await createSiteWithAddress("seo-big");
  try {
    const admin = await createSiteAdmin(site.id, "Seo Big");
    await withDatabase(async (sql) => {
      await sql`
        insert into entries (site_id, type, title, slug, blocks, blocks_format, status, published_at, author_id)
        select ${site.id}, 'post', 'Post ' || n, 'post-' || n, ${sql.json(EMPTY_DOC)}, 'v4', 'published',
          now() - (n || ' minutes')::interval, u.id
        from generate_series(1, 1000) n, users u where u.email = ${admin.email}
      `;
    });
    const url = siteUrl("/sitemap.xml", site.address);
    await request.get(url); // warm-up: connection, query plan
    const started = performance.now();
    const response = await request.get(url);
    const ms = performance.now() - started;
    console.log(`sitemap with 1,000 posts: ${ms.toFixed(0)} ms`);
    expect(response.status()).toBe(200);
    expect(locsOf(await response.text())).toHaveLength(1001); // 1,000 posts and /posts
    expect(ms).toBeLessThan(500);
  } finally {
    await deleteSite(site.id);
  }
});

// Step 5: the editor's Search and sharing disclosure. Entries are created by a
// fresh user on site 1 and removed afterwards; no site setting is touched.

async function openSearchAndSharing(page: Page) {
  const summary = page.locator("summary", { hasText: "Search and sharing" });
  await expect(page.getByLabel("Title in search results")).toBeHidden();
  // By keyboard: focus the summary, then Enter.
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Title in search results")).toBeVisible();
}

async function searchFieldsOf(id: string) {
  return withDatabase(async (sql) => {
    const [row] = await sql<{ seo_title: string; seo_description: string }[]>`
      select seo_title, seo_description from entries where id = ${id}
    `;
    return row;
  });
}

for (const kind of ["page", "post"] as const) {
  test.describe(`search and sharing fields on a ${kind}`, () => {
    let user: TestUser;

    test.beforeEach(async ({ page }) => {
      await page.setExtraHTTPHeaders({
        "X-Forwarded-For": `10.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.9`,
      });
      user = createAdmin("Seo Editor");
    });

    test.afterEach(async () => {
      await deleteEntriesBy(user.email);
      await deleteTestUser(user.email);
    });

    test(`the fields are kept after Save and a reload, and a 301-character description is refused`, async ({
      page,
    }) => {
      const id = await createDraftFor(user.email, `Seo ${kind}`, textDocument("Body"), {
        type: kind,
      });
      const url = `/admin/${kind}s/${id}`;
      await logIn(page, user);
      await page.goto(url);

      await openSearchAndSharing(page);
      await expect(page.getByLabel("Title in search results")).toHaveAttribute(
        "placeholder",
        `Seo ${kind}`,
      );
      await page.getByLabel("Title in search results").fill("A better title");
      await expect(page.getByText("Not saved yet")).toBeVisible();
      await page.getByLabel("Description", { exact: true }).fill("What this is about.");
      await page.getByRole("button", { name: "Save draft" }).click();
      await expect(page.getByText("Saved", { exact: true })).toBeVisible();

      await page.reload();
      await openSearchAndSharing(page);
      await expect(page.getByLabel("Title in search results")).toHaveValue("A better title");
      await expect(page.getByLabel("Description", { exact: true })).toHaveValue(
        "What this is about.",
      );
      expect(await searchFieldsOf(id)).toEqual({
        seo_title: "A better title",
        seo_description: "What this is about.",
      });

      // Too long: refused beside the message, nothing saved, version unchanged.
      const before = (await storedEntry(id)).version;
      await page.getByLabel("Description", { exact: true }).fill("x".repeat(301));
      await page.getByRole("button", { name: "Save draft" }).click();
      await expect(page.getByText("Your changes were not saved.")).toBeVisible();
      await expect(page.getByText("Description can be up to 300 characters.")).toBeVisible();
      expect((await storedEntry(id)).version).toBe(before);
      expect((await searchFieldsOf(id)).seo_description).toBe("What this is about.");
    });
  });
}

test("an author can set the search fields on their own post", async ({ page }) => {
  await page.setExtraHTTPHeaders({
    "X-Forwarded-For": `10.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.10`,
  });
  const author = createAdmin("Seo Author");
  await setRole(author.email, "author");
  try {
    const id = await createDraftFor(author.email, "Author post", textDocument("Body"));
    await logIn(page, author);
    await page.goto(`/admin/posts/${id}`);
    await openSearchAndSharing(page);
    await page.getByLabel("Title in search results").fill("Author search title");
    await page.getByLabel("Description", { exact: true }).fill("Author description.");
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();
    expect(await searchFieldsOf(id)).toEqual({
      seo_title: "Author search title",
      seo_description: "Author description.",
    });
  } finally {
    await deleteEntriesBy(author.email);
    await deleteTestUser(author.email);
  }
});

// Step 6: Image when shared.

async function socialImageOf(id: string) {
  return withDatabase(async (sql) => {
    const [row] = await sql<{ id: string | null }[]>`
      select social_image_media_id as id from entries where id = ${id}
    `;
    return row?.id ?? null;
  });
}

test.describe("image when shared", () => {
  let user: TestUser;
  let mediaId: string;
  let entryId: string;

  test.beforeEach(async ({ page }) => {
    await page.setExtraHTTPHeaders({
      "X-Forwarded-For": `10.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.11`,
    });
    user = createAdmin("Seo Image");
    mediaId = await insertTestMediaRow({ uploadedBy: user.email });
    entryId = await createDraftFor(user.email, "Image page", textDocument("Body"), {
      type: "page",
    });
    await logIn(page, user);
    await page.goto(`/admin/pages/${entryId}`);
    await openSearchAndSharing(page);
  });

  test.afterEach(async () => {
    await deleteEntriesBy(user.email);
    await deleteTestMedia(mediaId);
    await deleteTestUser(user.email);
  });

  async function choose(page: Page) {
    await page.getByRole("button", { name: "Choose image" }).click();
    await expect(page.getByRole("dialog", { name: "Choose an image to share" })).toBeVisible();
    await page.getByText(await testMediaFilename(mediaId)).click();
  }

  test("choosing an image and saving shows its thumbnail after a reload; Remove image clears it", async ({
    page,
  }) => {
    const field = page.getByRole("group", { name: "Image when shared" });
    await expect(field.locator("img")).toHaveCount(0);
    await choose(page);
    await expect(field.locator("img")).toHaveCount(1);
    await expect(page.getByText("Not saved yet")).toBeVisible();
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();
    expect(await socialImageOf(entryId)).toBe(mediaId);

    await page.reload();
    await openSearchAndSharing(page);
    await expect(field.locator("img")).toHaveCount(1);

    await page.getByRole("button", { name: "Remove image" }).click();
    await expect(page.getByText("Not saved yet")).toBeVisible();
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();
    await page.reload();
    await openSearchAndSharing(page);
    await expect(field.locator("img")).toHaveCount(0);
    expect(await socialImageOf(entryId)).toBeNull();
  });

  test("another site's image is refused and nothing is saved", async ({ page }) => {
    const other = await createSiteWithAddress(`seo-img-${randomUUID().slice(0, 8)}`);
    const otherAdmin = await createSiteAdmin(other.id, "Seo Img Other");
    const otherMedia = await insertTestMediaRow({
      uploadedBy: otherAdmin.email,
      siteId: other.id,
    });
    try {
      const before = (await storedEntry(entryId)).version;
      await page.getByLabel("Description", { exact: true }).fill("Should not be saved");
      // Crafted: the hidden field names another site's media row.
      await page.locator('input[name="socialImageMediaId"]').evaluate((input, value) => {
        Object.assign(input, { value });
      }, otherMedia);
      await page.getByRole("button", { name: "Save draft" }).click();
      await expect(page.getByText("Your changes were not saved.")).toBeVisible();
      await expect(page.getByText("Image when shared could not be saved")).toBeVisible();
      expect((await storedEntry(entryId)).version).toBe(before);
      expect(await socialImageOf(entryId)).toBeNull();
      expect((await searchFieldsOf(entryId)).seo_description).toBe("");
    } finally {
      await deleteTestMedia(otherMedia);
      await deleteSite(other.id);
    }
  });

  test("deleting the image from Media leaves the entry with none", async ({ page }) => {
    await choose(page);
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();
    expect(await socialImageOf(entryId)).toBe(mediaId);

    await page.goto(`/admin/media/${mediaId}/delete`);
    await page.getByRole("button", { name: "Delete image" }).click();
    await page.waitForURL(/\/admin\/media\?/);
    expect(await socialImageOf(entryId)).toBeNull();

    await page.goto(`/admin/pages/${entryId}`);
    await openSearchAndSharing(page);
    await expect(page.getByRole("group", { name: "Image when shared" }).locator("img")).toHaveCount(
      0,
    );
  });
});

// Step 7: head tags on public pages.
async function metaOf(page: Page, url: string) {
  const response = await page.goto(url);
  const content = (selector: string) =>
    page.locator(selector).evaluateAll((els) => els.map((el) => el.getAttribute("content")));
  return {
    status: response?.status(),
    title: await page.title(),
    description: await content('meta[name="description"]'),
    ogTitle: await content('meta[property="og:title"]'),
    ogDescription: await content('meta[property="og:description"]'),
    ogUrl: await content('meta[property="og:url"]'),
    ogSiteName: await content('meta[property="og:site_name"]'),
    ogType: await content('meta[property="og:type"]'),
    ogImage: await content('meta[property="og:image"]'),
    twitterCard: await content('meta[name="twitter:card"]'),
    canonical: await page
      .locator('link[rel="canonical"]')
      .evaluateAll((els) => els.map((el) => el.getAttribute("href"))),
  };
}

test.describe("head tags", () => {
  const SITE_TITLE = "Head Tags Site";
  const SITE_DESCRIPTION = 'About us, "quoted" <b> & more';
  let site: { id: string; address: string };
  let postId: string;
  let pageId: string;
  let mediaId: string;
  let storageKey: string;

  test.beforeAll(async () => {
    site = await createSiteWithAddress("seo-head");
    const admin = await createSiteAdmin(site.id, "Seo Head");
    mediaId = await insertTestMediaRow({ uploadedBy: admin.email, siteId: site.id });
    const ids = await seedEntries(site.id, admin.email, [
      { type: "post", slug: "full", status: "published" },
      { type: "page", slug: "bare", status: "published" },
      { type: "page", slug: "front", status: "published" },
    ]);
    postId = ids.full;
    pageId = ids.bare;
    await withDatabase(async (sql) => {
      await sql`update site_settings set site_title = ${SITE_TITLE}, site_description = ${SITE_DESCRIPTION}
        where site_id = ${site.id}`;
      await sql`update entries set seo_title = 'Search title', seo_description = ${'A "post" <b> & co'},
        social_image_media_id = ${mediaId}, title = 'Full post' where id = ${postId}`;
      await sql`update entries set title = 'Bare page' where id = ${pageId}`;
      const [media] = await sql<{ storageKey: string }[]>`
        select storage_key as "storageKey" from media where id = ${mediaId}
      `;
      storageKey = media.storageKey;
    });
  });

  test.afterAll(async () => {
    await deleteSite(site.id);
  });

  test("a post with all three fields set carries exactly its own tags", async ({ page }) => {
    const url = siteUrl("/posts/full", site.address);
    const tags = await metaOf(page, url);
    expect(tags.status).toBe(200);
    expect(tags.title).toBe("Search title");
    expect(tags.description).toEqual(['A "post" <b> & co']);
    expect(tags.ogTitle).toEqual(["Search title"]);
    expect(tags.ogDescription).toEqual(['A "post" <b> & co']);
    expect(tags.canonical).toEqual([url]);
    expect(tags.ogUrl).toEqual([url]);
    expect(tags.ogSiteName).toEqual([SITE_TITLE]);
    expect(tags.ogType).toEqual(["article"]);
    expect(tags.ogImage).toEqual([`${process.env.R2_PUBLIC_URL}/${storageKey}`]);
    expect(tags.twitterCard).toEqual(["summary_large_image"]);
  });

  test("a page with none set has a suffixed title and no description or image", async ({
    page,
  }) => {
    const tags = await metaOf(page, siteUrl("/bare", site.address));
    expect(tags.title).toBe(`Bare page - ${SITE_TITLE}`);
    expect(tags.description).toEqual([]);
    expect(tags.ogDescription).toEqual([]);
    expect(tags.ogImage).toEqual([]);
    expect(tags.ogTitle).toEqual(["Bare page"]);
    expect(tags.twitterCard).toEqual(["summary"]);
    expect(tags.ogType).toEqual(["website"]);
  });

  test("the placeholder home and the post list fall back to the site description", async ({
    page,
  }) => {
    // No home page is set yet: the placeholder.
    const home = await metaOf(page, siteUrl("/", site.address));
    expect(home.description).toEqual([SITE_DESCRIPTION]);
    expect(home.ogDescription).toEqual([SITE_DESCRIPTION]);
    expect(home.ogTitle).toEqual([SITE_TITLE]);
    const posts = await metaOf(page, siteUrl("/posts", site.address));
    expect(posts.description).toEqual([SITE_DESCRIPTION]);
    expect(posts.title).toBe(`Posts - ${SITE_TITLE}`);
    expect(posts.ogType).toEqual(["website"]);
  });

  test("a home page with no description of its own falls back; one with its own keeps it", async ({
    page,
  }) => {
    const [front] = await withDatabase(async (sql) => {
      const rows = await sql<{ id: string }[]>`
        select id from entries where site_id = ${site.id} and slug = 'front'`;
      await sql`update site_settings set home_page_id = ${rows[0].id} where site_id = ${site.id}`;
      return rows;
    });
    try {
      const fallback = await metaOf(page, siteUrl("/", site.address));
      expect(fallback.description).toEqual([SITE_DESCRIPTION]);
      await withDatabase(
        (sql) => sql`update entries set seo_description = 'Home own' where id = ${front.id}`,
      );
      const own = await metaOf(page, siteUrl("/", site.address));
      expect(own.description).toEqual(["Home own"]);
    } finally {
      await withDatabase(
        (sql) => sql`update site_settings set home_page_id = null where site_id = ${site.id}`,
      );
    }
  });

  test("loader data and html hold no entry id and no share image id", async ({ request }) => {
    for (const path of ["/posts/full", "/bare"]) {
      const url = siteUrl(path, site.address);
      const html = await (await request.get(url)).text();
      const data = await (await request.get(`${url}.data`)).text();
      for (const body of [html, data]) {
        expect(body).not.toContain(postId);
        expect(body).not.toContain(pageId);
        expect(body).not.toContain(mediaId);
      }
      expect(data).toContain("imageUrl"); // the .data answer really carries the loader data
    }
  });

  test("a missing page carries no canonical and no Open Graph tags", async ({ page }) => {
    const tags = await metaOf(page, siteUrl("/no-such-page", site.address));
    expect(tags.status).toBe(404);
    expect(tags.canonical).toEqual([]);
    expect(tags.ogTitle).toEqual([]);
    expect(tags.ogUrl).toEqual([]);
    expect(tags.ogType).toEqual([]);
    expect(tags.description).toEqual([]);
  });
});
