import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { deleteTestMedia, insertTestMediaRow } from "./helpers/media.ts";
import { PORT, PROXIED_PORT } from "./helpers/ports.ts";
import {
  createSite,
  createSiteAdmin,
  createSiteWithAddress,
  deleteSite,
  siteUrl,
} from "./helpers/sites.ts";
import { withDatabase } from "./helpers/users.ts";

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
