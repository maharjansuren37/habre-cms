import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { createOwnDomainStore } from "../app/features/own-domain/own-domain-store.server.ts";
import { createSite, deleteSite } from "./helpers/sites.ts";
import { withDatabase } from "./helpers/users.ts";

// Database only. The store (item 21c, F-415) runs as the app role, the way the
// running app connects, with fake DNS lookups; setup and cleanup are the owner.
// Every domain is unique and every site is this file's own - site 1's seeded
// row is never touched.

const HOSTS = { platformHost: "app.localhost:3000", sitesHost: "localhost:3000" };
const SITES_HOSTNAME = "localhost";
const HOUR = 60 * 60 * 1000;

let app: postgres.Sql;
const sites: string[] = [];

const store = () =>
  createOwnDomainStore(app, {
    lookups: {
      txt: async () => {
        throw new Error("these tests always pass their own lookups");
      },
      addresses: async () => {
        throw new Error("these tests always pass their own lookups");
      },
    },
  });

const uniqueDomain = () => `e2e-${randomUUID().slice(0, 8)}.example`;

async function newSite(label: string, plan: "free" | "paid" = "paid"): Promise<string> {
  const id = await createSite(`own-domain-store-${label}`);
  sites.push(id);
  if (plan === "paid") {
    await withDatabase((sql) => sql`update sites set plan = 'paid' where id = ${id}`);
  }
  return id;
}

type Stored = {
  siteId: string;
  verifiedAt: Date | null;
  token: string | null;
  checkedAt: Date | null;
};
const rowOf = (domain: string) =>
  withDatabase(
    async (sql) =>
      (
        await sql<Stored[]>`
          select site_id as "siteId", verified_at as "verifiedAt",
                 verification_token as token, last_checked_at as "checkedAt"
          from site_domains where domain = ${domain}`
      )[0],
  );

const insertClaim = (input: {
  domain: string;
  siteId: string;
  token?: string | null;
  verified?: boolean;
  ageMs?: number;
}) =>
  withDatabase(
    (sql) => sql`
      insert into site_domains (domain, site_id, verification_token, verified_at, created_at)
      values (${input.domain}, ${input.siteId}, ${input.token ?? null},
              ${input.verified ? new Date() : null},
              ${new Date(Date.now() - (input.ageMs ?? 0))})`,
  );

test.beforeAll(() => {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set - browser tests need .env");
  app = postgres(url, { max: 2 });
});

test.afterAll(async () => {
  await app?.end();
  for (const id of sites.splice(0)) await deleteSite(id);
});

test.describe("checkDomain", () => {
  test("a matching TXT and a shared address verify the domain once", async () => {
    const siteId = await newSite("verify");
    const domain = uniqueDomain();
    const added = await store().addDomain({ siteId, typed: domain, hosts: HOSTS });
    if (!added.ok) throw new Error(`add refused: ${added.reason}`);
    const lookups = {
      txt: async () => [`habre-verify=${added.token}`],
      addresses: async () => ["203.0.113.5"],
    };

    const first = await store().checkDomain({
      siteId,
      siteHost: "lena.localhost",
      lookups,
    });
    expect(first).toEqual({ outcome: "verified", newlyVerified: true });
    const row = await rowOf(domain);
    expect(row.verifiedAt).not.toBeNull();
    expect(row.token).toBeNull();
    expect(row.checkedAt).not.toBeNull();

    const second = await store().checkDomain({ siteId, siteHost: "lena.localhost", lookups });
    expect(second).toEqual({ outcome: "verified", newlyVerified: false });
  });

  test("a wrong TXT leaves the row unverified, checked and with its token", async () => {
    const siteId = await newSite("wrong-txt");
    const domain = uniqueDomain();
    const added = await store().addDomain({ siteId, typed: domain, hosts: HOSTS });
    if (!added.ok) throw new Error(`add refused: ${added.reason}`);

    const result = await store().checkDomain({
      siteId,
      siteHost: "lena.localhost",
      lookups: {
        txt: async () => ["habre-verify=not-the-token"],
        addresses: async () => ["203.0.113.5"],
      },
    });
    expect(result).toEqual({ outcome: "wrong-txt", newlyVerified: false });
    const row = await rowOf(domain);
    expect(row.verifiedAt).toBeNull();
    expect(row.token).toBe(added.token);
    expect(row.checkedAt).not.toBeNull();
  });
});

test.describe("checkDomain racing a verification (F-423)", () => {
  test("a failing check never clears a verified_at set behind its read", async () => {
    const siteId = await newSite("verified-behind-read");
    const domain = uniqueDomain();
    const added = await store().addDomain({ siteId, typed: domain, hosts: HOSTS });
    if (!added.ok) throw new Error(`add refused: ${added.reason}`);

    // The store has read the unverified row; before its update runs, another
    // check verifies it (through the owner, as the winning check would).
    const result = await store().checkDomain({
      siteId,
      siteHost: "lena.localhost",
      lookups: {
        txt: async () => {
          await withDatabase(
            (sql) => sql`
              update site_domains
              set verified_at = now(), verification_token = null
              where domain = ${domain}`,
          );
          return [];
        },
        addresses: async () => ["203.0.113.5"],
      },
    });
    expect(result).toEqual({ outcome: "no-txt", newlyVerified: false });
    const row = await rowOf(domain);
    expect(row.verifiedAt).not.toBeNull();
    expect(row.token).toBeNull();
  });
});

test.describe("addDomain", () => {
  test("replaces another site's unverified claim after 25 hours", async () => {
    const holder = await newSite("old-holder");
    const siteId = await newSite("old-claimant");
    const domain = uniqueDomain();
    await insertClaim({ domain, siteId: holder, token: "old", ageMs: 25 * HOUR });

    const result = await store().addDomain({ siteId, typed: domain, hosts: HOSTS });
    expect(result.ok).toBe(true);
    const row = await rowOf(domain);
    expect(row.siteId).toBe(siteId);
    expect(row.verifiedAt).toBeNull();
  });

  test("refuses another site's one-hour-old unverified claim as taken", async () => {
    const holder = await newSite("fresh-holder");
    const siteId = await newSite("fresh-claimant");
    const domain = uniqueDomain();
    await insertClaim({ domain, siteId: holder, token: "fresh", ageMs: HOUR });

    const result = await store().addDomain({ siteId, typed: domain, hosts: HOSTS });
    expect(result).toEqual({ ok: false, reason: "taken" });
    const row = await rowOf(domain);
    expect(row.siteId).toBe(holder);
    expect(row.token).toBe("fresh");
  });

  test("refuses a verified claim, however old, as taken", async () => {
    const holder = await newSite("verified-holder");
    const siteId = await newSite("verified-claimant");
    const domain = uniqueDomain();
    await insertClaim({ domain, siteId: holder, verified: true, ageMs: 72 * HOUR });

    const result = await store().addDomain({ siteId, typed: domain, hosts: HOSTS });
    expect(result).toEqual({ ok: false, reason: "taken" });
    expect((await rowOf(domain)).siteId).toBe(holder);
  });

  test("refuses a Free site and a site that already has a domain", async () => {
    const free = await newSite("free", "free");
    const freeResult = await store().addDomain({
      siteId: free,
      typed: uniqueDomain(),
      hosts: HOSTS,
    });
    expect(freeResult).toEqual({ ok: false, reason: "free" });

    const siteId = await newSite("has-domain");
    const first = await store().addDomain({ siteId, typed: uniqueDomain(), hosts: HOSTS });
    expect(first.ok).toBe(true);
    const second = await store().addDomain({ siteId, typed: uniqueDomain(), hosts: HOSTS });
    expect(second).toEqual({ ok: false, reason: "has_domain" });
  });
});

test.describe("dueCandidates", () => {
  test("includes a fresh unverified row and leaves out the rest", async () => {
    const fresh = { siteId: await newSite("due-fresh"), domain: uniqueDomain() };
    const verified = { siteId: await newSite("due-verified"), domain: uniqueDomain() };
    const old = { siteId: await newSite("due-old"), domain: uniqueDomain() };
    const suspended = { siteId: await newSite("due-suspended"), domain: uniqueDomain() };
    const tokenless = { siteId: await newSite("due-tokenless"), domain: uniqueDomain() };

    await insertClaim({ ...fresh, token: "t-fresh", ageMs: HOUR });
    await insertClaim({ ...verified, verified: true, ageMs: HOUR });
    await insertClaim({ ...old, token: "t-old", ageMs: 25 * HOUR });
    await insertClaim({ ...suspended, token: "t-suspended", ageMs: HOUR });
    await insertClaim({ ...tokenless, token: null, ageMs: HOUR });
    await withDatabase(
      (sql) => sql`update sites set suspended_at = now() where id = ${suspended.siteId}`,
    );

    const due = await store().dueCandidates(new Date(), SITES_HOSTNAME);
    const domains = due.map((row) => row.domain);
    expect(domains).toContain(fresh.domain);
    for (const left of [verified, old, suspended, tokenless]) {
      expect(domains, left.domain).not.toContain(left.domain);
    }
    const [row] = due.filter((candidate) => candidate.domain === fresh.domain);
    const [{ subdomain }] = await withDatabase(
      (sql) => sql<{ subdomain: string }[]>`select subdomain from sites where id = ${fresh.siteId}`,
    );
    expect(row.siteHost).toBe(`${subdomain}.${SITES_HOSTNAME}`);
    expect(row.siteId).toBe(fresh.siteId);
    expect(row.lastCheckedAt).toBeNull();
  });
});
