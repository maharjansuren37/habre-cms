import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { PORT, PROXIED_PORT } from "./helpers/ports.ts";
import { createSiteWithAddress, deleteSite, siteOneId, siteUrl } from "./helpers/sites.ts";
import { withDatabase } from "./helpers/users.ts";

// Item 16a's host rules: which host answers what. Root middleware decides
// before any route runs, so these use the request API with `maxRedirects: 0`:
// the subject is the status and the Location header of one request, and a
// browser would follow the redirect and hide it. A site's address is a
// `*.localhost` name, which Chromium and Node both resolve to the loopback.
const PLATFORM = `http://127.0.0.1:${PORT}`;
const PROXIED = `http://127.0.0.1:${PROXIED_PORT}`;
const unknownAddress = () => `no-such-site-${randomUUID().slice(0, 8)}`;

test("an unknown address under the sites domain answers 404", async ({ request }) => {
  const response = await request.get(siteUrl("/", unknownAddress()), { maxRedirects: 0 });
  expect(response.status()).toBe(404);
});

test("a site answers at its address until it is suspended, then answers 404", async ({
  request,
}) => {
  const site = await createSiteWithAddress("suspend");
  try {
    const before = await request.get(siteUrl("/", site.address), { maxRedirects: 0 });
    expect(before.status()).toBe(200);
    expect(await before.text()).toContain(site.address);

    await withDatabase(async (sql) => {
      await sql`update sites set suspended_at = now() where id = ${site.id}`;
    });

    const after = await request.get(siteUrl("/", site.address), { maxRedirects: 0 });
    expect(after.status()).toBe(404);
  } finally {
    await deleteSite(site.id);
  }
});

test("a forwarded own domain serves the site it is verified for", async ({ request }) => {
  const siteId = await siteOneId();
  const [settings] = await withDatabase(
    (sql) =>
      sql<{ title: string }[]>`
        select site_title as title from site_settings where site_id = ${siteId}
      `,
  );
  const response = await request.get(`${PROXIED}/`, {
    headers: { "X-Forwarded-Host": "surenmaharjan.fyi", "X-Forwarded-Proto": "https" },
    maxRedirects: 0,
  });
  expect(response.status()).toBe(200);
  expect(await response.text()).toContain(settings.title);
});

test("a domain that is not verified answers 404, and serves once it is", async ({ request }) => {
  const site = await createSiteWithAddress("domain");
  const domain = `unverified-${randomUUID().slice(0, 8)}.example`;
  const headers = { "X-Forwarded-Host": domain, "X-Forwarded-Proto": "https" };
  try {
    await withDatabase(async (sql) => {
      await sql`insert into site_domains (domain, site_id) values (${domain}, ${site.id})`;
    });
    const unverified = await request.get(`${PROXIED}/`, { headers, maxRedirects: 0 });
    expect(unverified.status()).toBe(404);

    await withDatabase(async (sql) => {
      await sql`update site_domains set verified_at = now() where domain = ${domain}`;
    });
    const verified = await request.get(`${PROXIED}/`, { headers, maxRedirects: 0 });
    expect(verified.status()).toBe(200);
    expect(await verified.text()).toContain(site.address);
  } finally {
    await withDatabase(async (sql) => {
      await sql`delete from site_domains where domain = ${domain}`;
    });
    await deleteSite(site.id);
  }
});

test("an admin path on a site host redirects to the same path on the platform", async ({
  request,
}) => {
  const response = await request.get(siteUrl("/admin/posts"), { maxRedirects: 0 });
  expect(response.status()).toBe(302);
  expect(response.headers().location).toBe(`${PLATFORM}/admin/posts`);
});

test("a POST to an admin path on a site host answers 404", async ({ request }) => {
  // The Origin is the site's own, so React Router's same-origin form check (which
  // runs before middleware, and answers 400 otherwise) lets it through. The host
  // rule then answers 404 before this project's cross-site check would run.
  const response = await request.post(siteUrl("/admin/login"), {
    headers: { Origin: siteUrl(""), "Content-Type": "application/x-www-form-urlencoded" },
    data: "email=nobody@example.org&password=wrongpassword123",
    maxRedirects: 0,
  });
  expect(response.status()).toBe(404);
});

test("a public path on the platform host answers 404", async ({ request }) => {
  const response = await request.get(`${PLATFORM}/posts/x`, { maxRedirects: 0 });
  expect(response.status()).toBe(404);
});

test("the platform host's root redirects to the admin", async ({ request }) => {
  const response = await request.get(`${PLATFORM}/`, { maxRedirects: 0 });
  expect(response.status()).toBe(302);
  expect(response.headers().location).toBe("/admin");
});

for (const [kind, url] of [
  ["the platform host", () => `${PLATFORM}/healthz`],
  ["a site host", () => siteUrl("/healthz")],
  ["an unknown host", () => siteUrl("/healthz", unknownAddress())],
] as const) {
  test(`/healthz answers 200 on ${kind}`, async ({ request }) => {
    const response = await request.get(url(), { maxRedirects: 0 });
    expect(response.status()).toBe(200);
  });
}
