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
