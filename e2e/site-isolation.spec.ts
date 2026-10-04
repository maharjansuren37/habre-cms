import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { createSite, createSiteAdmin, deleteSite, siteOneId } from "./helpers/sites.ts";
import { deleteTestUser, withDatabase } from "./helpers/users.ts";

// Database only - no page. Setup and cleanup run as the owner (which bypasses
// row-level security, D152); the checks run as the app role, the way the
// running app connects. Migration 0011 is what makes these pass.

type Fixture = {
  siteOne: string;
  siteTwo: string;
  oneUserId: string;
  twoUserId: string;
  oneEmail: string;
};

const TABLES = ["entries", "media", "site_settings"] as const;

let fixture: Fixture;

async function userId(email: string): Promise<string> {
  return withDatabase(async (sql) => {
    const [row] = await sql<{ id: string }[]>`select id from users where email = ${email}`;
    return row.id;
  });
}

async function insertRows(siteId: string, authorId: string, tag: string): Promise<void> {
  await withDatabase(async (sql) => {
    await sql`
      insert into entries (site_id, type, title, slug, blocks, blocks_format, status, author_id)
      values (${siteId}, 'page', ${tag}, ${tag}, ${sql.json({ type: "doc", content: [] })}, 'v4', 'draft', ${authorId})
    `;
    await sql`
      insert into media (site_id, storage_key, filename, mime_type, byte_size, width, height, alt_text, uploaded_by)
      values (${siteId}, ${`e2e-test/${tag}.jpg`}, ${`${tag}.jpg`}, 'image/jpeg', 1000, 10, 10, 'alt', ${authorId})
    `;
  });
}

/** Site 1 (the oldest) already has a settings row; this fills in entries and media for both. */
test.beforeAll(async () => {
  const siteOne = await siteOneId();
  const siteTwo = await createSite("isolation");
  const one = await createSiteAdmin(siteOne, "Isolation One");
  const two = await createSiteAdmin(siteTwo, "Isolation Two");
  const oneUserId = await userId(one.email);
  const twoUserId = await userId(two.email);
  const tag = randomUUID().slice(0, 8);
  await insertRows(siteOne, oneUserId, `iso-one-${tag}`);
  await insertRows(siteTwo, twoUserId, `iso-two-${tag}`);
  fixture = { siteOne, siteTwo, oneUserId, twoUserId, oneEmail: one.email };
});

test.afterAll(async () => {
  await withDatabase(async (sql) => {
    await sql`delete from entries where author_id = ${fixture.oneUserId}`;
    await sql`delete from media where uploaded_by = ${fixture.oneUserId}`;
  });
  await deleteTestUser(fixture.oneEmail);
  await deleteSite(fixture.siteTwo);
});

function appRole(): postgres.Sql {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set - browser tests need .env");
  return postgres(url, { max: 1 });
}

test("an entry whose author belongs to another site is refused by a foreign key", async () => {
  // As the owner: foreign keys apply to every role, row-level security only to the app's.
  const error = await withDatabase(async (sql) => {
    try {
      await sql`
        insert into entries (site_id, type, title, slug, blocks, blocks_format, status, author_id)
        values (${fixture.siteTwo}, 'page', 'Wrong author', ${`wrong-${randomUUID()}`},
                ${sql.json({ type: "doc", content: [] })}, 'v4', 'draft', ${fixture.oneUserId})
      `;
      return null;
    } catch (caught) {
      return caught as { code?: string; constraint_name?: string };
    }
  });
  expect(error?.code).toBe("23503");
  expect(error?.constraint_name).toBe("entries_author_member_fkey");
});

test("with no site set the app role sees no rows, though every table holds two sites", async () => {
  await withDatabase(async (sql) => {
    for (const table of TABLES) {
      const [row] = await sql<{ sites: number }[]>`
        select count(distinct site_id)::int as sites from ${sql(table)}
        where site_id in ${sql([fixture.siteOne, fixture.siteTwo])}
      `;
      expect(row.sites, `${table} holds both sites`).toBe(2);
    }
  });
  const app = appRole();
  try {
    for (const table of TABLES) {
      const [row] = await app<
        { count: number }[]
      >`select count(*)::int as count from ${app(table)}`;
      expect(row.count, `${table} with no site set`).toBe(0);
    }
  } finally {
    await app.end();
  }
});

test("with a site set the app role sees only that site's rows", async () => {
  const app = appRole();
  try {
    for (const table of TABLES) {
      const expected = await withDatabase(async (sql) => {
        const [row] = await sql<{ count: number }[]>`
          select count(*)::int as count from ${sql(table)} where site_id = ${fixture.siteTwo}
        `;
        return row.count;
      });
      expect(expected).toBeGreaterThan(0);
      const rows = await app.begin(async (tx) => {
        await tx`select set_config('app.site_id', ${fixture.siteTwo}, true)`;
        return tx<{ siteId: string }[]>`select site_id as "siteId" from ${tx(table)}`;
      });
      expect(rows.length, `${table} rows for site 2`).toBe(expected);
      expect(rows.every((row) => row.siteId === fixture.siteTwo)).toBe(true);
    }
  } finally {
    await app.end();
  }
});

test("a write naming another site is refused by the policy", async () => {
  const app = appRole();
  const rollback = new Error("rolled back");
  try {
    let message = "";
    try {
      await app.begin(async (tx) => {
        await tx`select set_config('app.site_id', ${fixture.siteTwo}, true)`;
        await tx`
          insert into entries (site_id, type, title, slug, blocks, blocks_format, status, author_id)
          values (${fixture.siteOne}, 'page', 'Across sites', ${`across-${randomUUID()}`},
                  ${tx.json({ type: "doc", content: [] })}, 'v4', 'draft', ${fixture.oneUserId})
        `;
        // Reached only if the insert was allowed; undo it either way.
        throw rollback;
      });
    } catch (caught) {
      message = (caught as Error).message;
    }
    expect(message).toMatch(/new row violates row-level security policy/);
  } finally {
    await app.end();
  }
});

test("the owner sees every row", async () => {
  await withDatabase(async (sql) => {
    for (const table of TABLES) {
      const [row] = await sql<{ count: number }[]>`
        select count(*)::int as count from ${sql(table)}
        where site_id in ${sql([fixture.siteOne, fixture.siteTwo])}
      `;
      expect(row.count, `${table} as the owner`).toBeGreaterThanOrEqual(2);
    }
  });
});
