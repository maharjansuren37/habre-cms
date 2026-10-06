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
