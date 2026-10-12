import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { PORT } from "./helpers/ports.ts";
import { createSite, deleteSite, siteOneId } from "./helpers/sites.ts";
import { withDatabase } from "./helpers/users.ts";

// Database only - no page. Setup and cleanup run as the owner; the checks run as
// the app role, the way the running app connects. Migration 0026 and db/roles.sql
// give that role insert and update on site_domains by column, never site_id or
// domain on update, and never verified_at on insert (item 21c, F-270).

let siteId: string;
let otherSiteId: string;
let app: postgres.Sql;

function uniqueDomain(): string {
  return `e2e-${randomUUID().slice(0, 8)}.example`;
}

async function refusedCode(run: () => Promise<unknown>): Promise<string | undefined> {
  try {
    await run();
    return undefined;
  } catch (caught) {
    return (caught as { code?: string }).code;
  }
}

test.beforeAll(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set - browser tests need .env");
  app = postgres(url, { max: 1 });
  siteId = await createSite("own-domain");
  otherSiteId = await createSite("own-domain-other");
});

test.afterAll(async () => {
  await app?.end();
  await deleteSite(siteId);
  await deleteSite(otherSiteId);
});

test("the app role can add an unverified domain with a verification token", async () => {
  const domain = uniqueDomain();
  await app`
    insert into site_domains (domain, site_id, verification_token)
    values (${domain}, ${siteId}, ${"token-1"})
  `;
  const rows = await withDatabase(
    (sql) =>
      sql<
        { verifiedAt: Date | null; token: string | null }[]
      >`select verified_at as "verifiedAt", verification_token as token from site_domains where domain = ${domain}`,
  );
  expect(rows).toHaveLength(1);
  expect(rows[0].verifiedAt).toBeNull();
  expect(rows[0].token).toBe("token-1");
});

test("the app role can record a check and a verification on its domain", async () => {
  const domain = uniqueDomain();
  await app`
    insert into site_domains (domain, site_id, verification_token)
    values (${domain}, ${siteId}, ${"token-2"})
  `;
  await app`
    update site_domains set verified_at = now(), last_checked_at = now(), verification_token = null
    where domain = ${domain} and site_id = ${siteId}
  `;
  const [row] = await withDatabase(
    (sql) => sql<
      { verifiedAt: Date | null; checkedAt: Date | null; token: string | null }[]
    >`select verified_at as "verifiedAt", last_checked_at as "checkedAt", verification_token as token
      from site_domains where domain = ${domain}`,
  );
  expect(row.verifiedAt).not.toBeNull();
  expect(row.checkedAt).not.toBeNull();
  expect(row.token).toBeNull();
});

test("the app role cannot move a domain to another site", async () => {
  const domain = uniqueDomain();
  await app`
    insert into site_domains (domain, site_id, verification_token)
    values (${domain}, ${siteId}, ${"token-3"})
  `;
  const code = await refusedCode(
    () => app`update site_domains set site_id = ${otherSiteId} where domain = ${domain}`,
  );
  expect(code).toBe("42501");
});

test("the app role cannot rename a domain", async () => {
  const domain = uniqueDomain();
  await app`
    insert into site_domains (domain, site_id, verification_token)
    values (${domain}, ${siteId}, ${"token-4"})
  `;
  const code = await refusedCode(
    () => app`update site_domains set domain = ${uniqueDomain()} where domain = ${domain}`,
  );
  expect(code).toBe("42501");
});

test("the app role cannot insert a domain that is already verified", async () => {
  const code = await refusedCode(
    () => app`
      insert into site_domains (domain, site_id, verification_token, verified_at)
      values (${uniqueDomain()}, ${siteId}, ${"token-5"}, now())
    `,
  );
  expect(code).toBe("42501");
});

test("site 1's own domain row is still verified and holds no token", async () => {
  const one = await siteOneId();
  const rows = await withDatabase(
    (sql) => sql<
      { siteId: string; verifiedAt: Date | null; token: string | null }[]
    >`select site_id as "siteId", verified_at as "verifiedAt", verification_token as token
      from site_domains where domain = 'surenmaharjan.fyi'`,
  );
  expect(rows).toHaveLength(1);
  expect(rows[0].siteId).toBe(one);
  expect(rows[0].verifiedAt).not.toBeNull();
  expect(rows[0].token).toBeNull();
});

// Caddy's on-demand TLS check (item 21c step 4): loopback only, no forwarded
// headers, a verified domain of a site that is not suspended.
test.describe("the Caddy ask endpoint", () => {
  const ask = (domain: string) =>
    `http://127.0.0.1:${PORT}/_caddy/ask?domain=${encodeURIComponent(domain)}`;
  let suspendedSiteId: string;
  let verified: string;
  let unverified: string;
  let ofSuspended: string;

  test.beforeAll(async () => {
    suspendedSiteId = await createSite("own-domain-ask-suspended");
    verified = uniqueDomain();
    unverified = uniqueDomain();
    ofSuspended = uniqueDomain();
    await withDatabase(async (sql) => {
      await sql`
        insert into site_domains (domain, site_id, verified_at)
        values (${verified}, ${siteId}, now()), (${ofSuspended}, ${suspendedSiteId}, now())
      `;
      await sql`
        insert into site_domains (domain, site_id, verification_token)
        values (${unverified}, ${siteId}, ${"ask-token"})
      `;
      await sql`update sites set suspended_at = now() where id = ${suspendedSiteId}`;
    });
  });

  test.afterAll(async () => {
    await deleteSite(suspendedSiteId);
  });

  test("answers 200, empty, for a verified domain of a live site", async ({ request }) => {
    const response = await request.get(ask(verified));
    expect(response.status()).toBe(200);
    expect(await response.text()).toBe("");
    expect(response.headers()["cache-control"]).toBe("no-store");
  });

  test("answers 404 for an unverified, an unknown and a suspended site's domain", async ({
    request,
  }) => {
    for (const domain of [unverified, uniqueDomain(), ofSuspended]) {
      const response = await request.get(ask(domain));
      expect(response.status(), domain).toBe(404);
      expect(await response.text(), domain).toBe("");
    }
  });

  test("answers 404 without a domain or with two", async ({ request }) => {
    expect((await request.get(`http://127.0.0.1:${PORT}/_caddy/ask`)).status()).toBe(404);
    const twice = `http://127.0.0.1:${PORT}/_caddy/ask?domain=${verified}&domain=${verified}`;
    expect((await request.get(twice)).status()).toBe(404);
  });

  test("answers 404 when the request was proxied", async ({ request }) => {
    const forwardedHost = await request.get(ask(verified), {
      headers: { "X-Forwarded-Host": verified },
    });
    expect(forwardedHost.status()).toBe(404);
    const forwardedFor = await request.get(ask(verified), {
      headers: { "X-Forwarded-For": "203.0.113.9" },
    });
    expect(forwardedFor.status()).toBe(404);
  });
});
