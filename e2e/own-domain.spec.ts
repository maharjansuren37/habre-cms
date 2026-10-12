import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { logIn } from "./helpers/auth.ts";
import { PORT } from "./helpers/ports.ts";
import {
  createSite,
  createSiteAdmin,
  createSiteWithAddress,
  deleteSite,
  siteOneId,
  siteUrl,
} from "./helpers/sites.ts";
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

  test("answers a path variant like the path itself (F-421)", async ({ request }) => {
    const query = `?domain=${encodeURIComponent(verified)}`;
    for (const path of ["/_caddy/ask/", "/_Caddy/Ask", "/%5Fcaddy/ask"]) {
      const url = `http://127.0.0.1:${PORT}${path}${query}`;
      expect((await request.get(url)).status(), path).toBe(200);
      const proxied = await request.get(url, { headers: { "X-Forwarded-Host": verified } });
      expect(proxied.status(), path).toBe(404);
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

// The Own domain section of /admin/plan (item 21c, Step 5). Each test makes
// sites of its own and removes them. `.invalid` never resolves, so a check
// always answers "not found yet".
test.describe("the Own domain section", () => {
  const PLATFORM = `http://127.0.0.1:${PORT}`;
  const NO_TXT = "We cannot see the verification record yet.";
  const LIMITED = "That is ten checks in the last hour.";
  let site: { id: string; address: string };
  let admin: Awaited<ReturnType<typeof createSiteAdmin>>;
  const extraSites: string[] = [];

  const invalidDomain = () => `e2e-${randomUUID().slice(0, 8)}.invalid`;
  const makePaid = (id = site.id) =>
    withDatabase((sql) => sql`update sites set plan = 'paid' where id = ${id}`);
  const rowsOf = (id: string) =>
    withDatabase(
      (sql) => sql<
        { domain: string; verifiedAt: Date | null; token: string | null }[]
      >`select domain, verified_at as "verifiedAt", verification_token as token
        from site_domains where site_id = ${id} order by domain`,
    );
  const post = (
    request: import("@playwright/test").APIRequestContext,
    form: Record<string, string>,
  ) =>
    request.post(`${PLATFORM}/admin/plan`, {
      headers: { Origin: PLATFORM },
      form,
      maxRedirects: 0,
    });

  test.beforeEach(async () => {
    site = await createSiteWithAddress("own-domain-page");
    admin = await createSiteAdmin(site.id, "Domain Admin");
  });

  test.afterEach(async () => {
    await deleteSite(site.id);
    for (const id of extraSites.splice(0)) await deleteSite(id);
  });

  test("a Launch admin adds a domain, sees its records, checks it and removes it", async ({
    page,
  }) => {
    await makePaid();
    await logIn(page, admin);
    await page.goto("/admin/plan");
    const section = page.getByRole("region", { name: "Own domain" });
    const domain = invalidDomain();

    await section.getByLabel("Domain").fill(domain);
    await section.getByRole("button", { name: "Add domain" }).click();

    const table = section.getByRole("table", {
      name: "Records to add at your domain's DNS provider",
    });
    await expect(table).toBeVisible();
    const [row] = await rowsOf(site.id);
    expect(row.domain).toBe(domain);
    expect(row.token).toMatch(/^[0-9a-f]{32}$/);
    await expect(table.getByRole("columnheader")).toHaveText(["Type", "Name", "Value"]);
    await expect(table.getByText(`_habre-verify.${domain}`)).toBeVisible();
    await expect(table.getByText(`habre-verify=${row.token}`)).toBeVisible();
    await expect(table.getByText(`${site.address}.localhost`)).toBeVisible();

    await section.getByRole("button", { name: "Check now" }).click();
    await expect(section.getByText(NO_TXT)).toBeVisible();
    await expect(table).toBeVisible();

    await section.getByRole("button", { name: "Remove" }).click();
    await expect(section.getByLabel("Domain")).toBeVisible();
    await expect(section.getByRole("table")).toHaveCount(0);
    expect(await rowsOf(site.id)).toHaveLength(0);
  });

  test("an invalid entry shows its refusal and keeps what was typed", async ({ page }) => {
    await makePaid();
    await logIn(page, admin);
    await page.goto("/admin/plan");
    const section = page.getByRole("region", { name: "Own domain" });

    await section.getByLabel("Domain").fill("https://x.test/y");
    await section.getByRole("button", { name: "Add domain" }).click();

    await expect(section.getByText("That does not look like a domain name.")).toBeVisible();
    await expect(section.getByLabel("Domain")).toHaveValue("https://x.test/y");
    expect(await rowsOf(site.id)).toHaveLength(0);
  });

  test("a Free admin sees no field and that the domain is part of Launch", async ({ page }) => {
    await logIn(page, admin);
    await page.goto("/admin/plan");
    const section = page.getByRole("region", { name: "Own domain" });

    await expect(section.getByText("Your own domain is part of Launch.")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Domain" })).toHaveCount(0);
    // A tampered request is refused too, and nothing is stored.
    const response = await post(page.request, { intent: "add-domain", domain: invalidDomain() });
    expect(response.status()).toBe(400);
    expect(await rowsOf(site.id)).toHaveLength(0);
  });

  test("another site's admin cannot check, remove or take a site's domain", async ({
    page,
    request,
  }) => {
    const domain = invalidDomain();
    await withDatabase(
      (sql) => sql`
        insert into site_domains (domain, site_id, verification_token)
        values (${domain}, ${site.id}, ${"owner-token"})`,
    );
    const other = await createSiteWithAddress("own-domain-other-page");
    extraSites.push(other.id);
    await makePaid(other.id);
    const otherAdmin = await createSiteAdmin(other.id, "Other Domain Admin");
    await logIn(page, otherAdmin);
    await page.goto("/admin/plan");
    await expect(page.getByText(domain)).toHaveCount(0);

    const check = await post(page.request, { intent: "check-domain", domain });
    expect(check.status()).toBe(400);
    const remove = await post(page.request, { intent: "remove-domain", domain });
    expect(remove.status()).toBe(400);
    const add = await post(page.request, { intent: "add-domain", domain });
    expect(add.status()).toBe(400);

    const rows = await rowsOf(site.id);
    expect(rows).toEqual([{ domain, verifiedAt: null, token: "owner-token" }]);
    expect(await rowsOf(other.id)).toHaveLength(0);
    // Without a session the request never reaches the action.
    const anonymous = await post(request, { intent: "remove-domain" });
    expect(anonymous.status()).not.toBe(200);
    expect(await rowsOf(site.id)).toHaveLength(1);
  });

  test("a verified domain shows as the site's address and the subdomain still serves", async ({
    page,
    request,
  }) => {
    const domain = invalidDomain();
    await withDatabase(
      (sql) => sql`
        insert into site_domains (domain, site_id, verified_at)
        values (${domain}, ${site.id}, now())`,
    );
    await logIn(page, admin);
    await page.goto("/admin/plan");
    const section = page.getByRole("region", { name: "Own domain" });

    await expect(section.getByText(`${domain} is your site's address.`)).toBeVisible();
    await expect(section.getByRole("button", { name: "Remove" })).toBeVisible();
    await expect(section.getByLabel("Domain")).toHaveCount(0);
    // SITES_URL is http in tests, so own domains are not the main address here.
    const served = await request.get(siteUrl("/", site.address), { maxRedirects: 0 });
    expect(served.status()).toBe(200);
  });

  test.describe("removing a verified domain asks first", () => {
    let domain: string;

    test.beforeEach(async () => {
      domain = invalidDomain();
      await withDatabase(
        (sql) => sql`
          insert into site_domains (domain, site_id, verified_at)
          values (${domain}, ${site.id}, now())`,
      );
    });

    test("Remove shows the confirmation and Cancel leaves the domain", async ({ page }) => {
      await logIn(page, admin);
      await page.goto("/admin/plan");
      const section = page.getByRole("region", { name: "Own domain" });

      await section.getByRole("button", { name: "Remove" }).click();
      await expect(section.getByRole("heading", { name: `Remove ${domain}?` })).toBeVisible();
      await expect(
        section.getByText("will serve your site again.", { exact: false }),
      ).toBeVisible();
      await expect(
        section.getByText("you will need to add a new verification record.", { exact: false }),
      ).toBeVisible();
      expect(await rowsOf(site.id)).toHaveLength(1);

      await section.getByRole("link", { name: "Cancel" }).click();
      await expect(section.getByText(`${domain} is your site's address.`)).toBeVisible();
      await expect(section.getByRole("heading", { name: `Remove ${domain}?` })).toHaveCount(0);
      expect(await rowsOf(site.id)).toHaveLength(1);
    });

    test("Remove domain deletes the row and shows the banner", async ({ page }) => {
      await logIn(page, admin);
      await page.goto("/admin/plan?confirm=remove-domain");
      const section = page.getByRole("region", { name: "Own domain" });

      await section.getByRole("button", { name: "Remove domain" }).click();
      await expect(section.getByText("Domain removed.")).toBeVisible();
      expect(await rowsOf(site.id)).toHaveLength(0);
    });

    test("a posted remove without confirm answers 400 and keeps the row", async ({ page }) => {
      await logIn(page, admin);
      await page.goto("/admin/plan");
      const bare = await post(page.request, { intent: "remove-domain" });
      expect(bare.status()).toBe(400);
      const no = await post(page.request, { intent: "remove-domain", confirm: "no" });
      expect(no.status()).toBe(400);
      expect(await rowsOf(site.id)).toHaveLength(1);
    });
  });

  test("the eleventh check in an hour is refused", async ({ page }) => {
    test.setTimeout(120_000);
    const domain = invalidDomain();
    await makePaid();
    await withDatabase(
      (sql) => sql`
        insert into site_domains (domain, site_id, verification_token)
        values (${domain}, ${site.id}, ${"limit-token"})`,
    );
    await logIn(page, admin);
    await page.goto("/admin/plan");

    for (let attempt = 1; attempt <= 10; attempt++) {
      const response = await post(page.request, { intent: "check-domain" });
      expect(response.status(), `check ${attempt}`).toBe(200);
    }
    const eleventh = await post(page.request, { intent: "check-domain" });
    expect(eleventh.status()).toBe(429);

    await page.goto("/admin/plan");
    await page.getByRole("button", { name: "Check now" }).click();
    await expect(page.getByText(LIMITED)).toBeVisible();
  });
});
