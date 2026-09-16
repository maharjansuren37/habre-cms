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

/** Runs one statement against the development database, then disconnects. */
async function withDatabase(run: (sql: postgres.Sql) => Promise<unknown>): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not set - browser tests need .env");
  const sql = postgres(databaseUrl, { max: 1 });
  try {
    await run(sql);
  } finally {
    await sql.end();
  }
}

export function deactivateUser(email: string): Promise<void> {
  return withDatabase((sql) => sql`update users set deactivated_at = now() where email = ${email}`);
}

export function revokeSessions(email: string): Promise<void> {
  return withDatabase(
    (sql) => sql`update users set token_version = token_version + 1 where email = ${email}`,
  );
}

/** Test cleanup only - the product deactivates users, never deletes them. */
export function deleteTestUser(email: string): Promise<void> {
  return withDatabase((sql) => sql`delete from users where email = ${email}`);
}

/** Test-only: create-admin makes admins, and some tests need another role. */
export function setRole(email: string, role: "admin" | "editor" | "author"): Promise<void> {
  return withDatabase((sql) => sql`update users set role = ${role} where email = ${email}`);
}

/** Test cleanup: entries reference their author, so they go first. */
export function deleteEntriesBy(email: string): Promise<void> {
  return withDatabase(
    (sql) =>
      sql`delete from entries where author_id in (select id from users where email = ${email})`,
  );
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
  blocks: unknown[],
): Promise<string> {
  let id = "";
  await withDatabase(async (sql) => {
    const [row] = await sql<{ id: string }[]>`
      insert into entries (type, title, slug, blocks, author_id)
      select 'post', ${title}, ${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")},
             ${sql.json(blocks as never)}, id
      from users where email = ${email}
      returning id
    `;
    id = row.id;
  });
  return id;
}
