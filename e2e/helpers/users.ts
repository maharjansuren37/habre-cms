import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import postgres from "postgres";

export const PASSWORD = "correct horse battery staple";

export type TestUser = { email: string; name: string; password: string };

/** Creates an admin through the real create-admin command, as a person would. */
export function createAdmin(name = "E2E Admin"): TestUser {
  const email = `e2e-${randomUUID()}@example.test`;
  execFileSync("node", ["scripts/create-admin.ts", "--email", email, "--name", name], {
    input: `${PASSWORD}\n`,
    env: process.env,
    stdio: ["pipe", "ignore", "inherit"],
  });
  return { email, name, password: PASSWORD };
}

/** Runs one statement against the development database, then disconnects.
 *  Exported for other helper modules (e.g. `media.ts`) - one pool-per-call
 *  pattern, not a shared connection. */
export async function withDatabase<T>(run: (sql: postgres.Sql) => Promise<T>): Promise<T> {
  // The owner, not the app role: test setup and cleanup must not be limited by
  // the row-level security the app runs under (D152).
  const databaseUrl = process.env.DATABASE_OWNER_URL;
  if (!databaseUrl) throw new Error("DATABASE_OWNER_URL is not set - browser tests need .env");
  const sql = postgres(databaseUrl, { max: 1 });
  try {
    return await run(sql);
  } finally {
    await sql.end();
  }
}

export function deactivateUser(email: string): Promise<void> {
  return withDatabase(async (sql) => {
    await sql`
      update site_members set deactivated_at = now()
      where user_id in (select id from users where email = ${email})
    `;
  });
}

export function revokeSessions(email: string): Promise<void> {
  return withDatabase(async (sql) => {
    await sql`update users set token_version = token_version + 1 where email = ${email}`;
  });
}

/** Test cleanup only - the product deactivates users, never deletes them. */
export function deleteTestUser(email: string): Promise<void> {
  return withDatabase(async (sql) => {
    await sql`
      delete from site_members where user_id in (select id from users where email = ${email})
    `;
    await sql`delete from users where email = ${email}`;
  });
}

/** Test-only: create-admin makes admins, and some tests need another role. */
export function setRole(email: string, role: "admin" | "editor" | "author"): Promise<void> {
  return withDatabase(async (sql) => {
    await sql`
      update site_members set role = ${role}
      where user_id in (select id from users where email = ${email})
    `;
  });
}

/** Test-only: removes the membership, leaving a user who belongs to no site. */
export function removeMembership(email: string): Promise<void> {
  return withDatabase(async (sql) => {
    await sql`
      delete from site_members where user_id in (select id from users where email = ${email})
    `;
  });
}

/** Test cleanup: entries reference their author, so they go first. */
export function deleteEntriesBy(email: string): Promise<void> {
  return withDatabase(async (sql) => {
    await sql`delete from entries where author_id in (select id from users where email = ${email})`;
  });
}

/** How many entries this author has, and the version of their newest one. */
export async function entriesBy(
  email: string,
): Promise<{ count: number; newestVersion: number | null; newestTitle: string | null }> {
  let result = {
    count: 0,
    newestVersion: null as number | null,
    newestTitle: null as string | null,
  };
  await withDatabase(async (sql) => {
    const rows = await sql<{ version: number; title: string }[]>`
      select version, title from entries
      where author_id in (select id from users where email = ${email})
      order by updated_at desc
    `;
    result = {
      count: rows.length,
      newestVersion: rows[0]?.version ?? null,
      newestTitle: rows[0]?.title ?? null,
    };
  });
  return result;
}

/** Test-only: a draft with blocks already in it, for load-and-save tests. */
export async function createDraftFor(
  email: string,
  title: string,
  /** A v4 document (see `e2e/helpers/documents.ts`). */
  blocks: unknown,
  options: {
    status?: "draft" | "published";
    publishedAt?: Date;
    /** Defaults to "post" - most callers are posts tests; item 6a's pages
     *  tests pass "page" to seed a page instead. */
    type?: "post" | "page";
  } = {},
): Promise<string> {
  const status = options.status ?? "draft";
  const type = options.type ?? "post";
  // A real publish always sets this (item 4a); a test row claiming to be
  // published needs one too, or anything ordering by it (item 4b's public
  // home) sees every seeded row tie at null.
  const publishedAt = options.publishedAt ?? (status === "published" ? new Date() : null);
  let id = "";
  await withDatabase(async (sql) => {
    const [row] = await sql<{ id: string }[]>`
      insert into entries (type, title, slug, blocks, blocks_format, status, published_at, author_id)
      select ${type}, ${title}, ${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")},
             ${sql.json(blocks as never)}, 'v4', ${status}, ${publishedAt}, id
      from users where email = ${email}
      returning id
    `;
    id = row.id;
  });
  return id;
}

/** Test-only: whether an entry with this id still exists - for delete tests. */
export async function entryExists(id: string): Promise<boolean> {
  let exists = false;
  await withDatabase(async (sql) => {
    const rows = await sql<{ id: string }[]>`select id from entries where id = ${id}`;
    exists = rows.length === 1;
  });
  return exists;
}

/** Test-only: the blocks, their format and version stored for one entry, as the database holds them. */
export async function storedEntry(
  id: string,
): Promise<{ blocks: unknown; blocksFormat: string; version: number }> {
  let entry = { blocks: null as unknown, blocksFormat: "", version: 0 };
  await withDatabase(async (sql) => {
    const [row] = await sql<{ blocks: unknown; blocksFormat: string; version: number }[]>`
      select blocks, blocks_format as "blocksFormat", version from entries where id = ${id}
    `;
    entry = row;
  });
  return entry;
}

/** Test-only: an entry's status and published_at, for publish/unpublish tests. */
export async function entryStatus(
  id: string,
): Promise<{ status: "draft" | "published"; publishedAt: Date | null }> {
  let result: { status: "draft" | "published"; publishedAt: Date | null } = {
    status: "draft",
    publishedAt: null,
  };
  await withDatabase(async (sql) => {
    const [row] = await sql<{ status: "draft" | "published"; published_at: Date | null }[]>`
      select status, published_at from entries where id = ${id}
    `;
    if (row) result = { status: row.status, publishedAt: row.published_at };
  });
  return result;
}
