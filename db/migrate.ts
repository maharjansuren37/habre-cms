import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";
import { z } from "zod";
import { parseEnv } from "#app/lib/database-env.server.ts";
import { pendingMigrations } from "./pending-migrations.ts";

// Migrations run as the owner role (D152), never the app role, which cannot
// create tables. The web app never reads this variable.
const migrateEnv = parseEnv(
  z.object({ DATABASE_OWNER_URL: z.url({ protocol: /^postgres(ql)?$/ }) }),
  process.env,
);
const sql = postgres(migrateEnv.DATABASE_OWNER_URL, { max: 1 });

const MIGRATIONS_DIR = path.join(import.meta.dirname, "migrations");

async function migrate() {
  await sql`
    create table if not exists schema_migrations (
      filename text primary key,
      applied_at timestamptz not null default now()
    )
  `;
  const applied = await sql<{ filename: string }[]>`select filename from schema_migrations`;
  const pending = pendingMigrations(
    await readdir(MIGRATIONS_DIR),
    applied.map((row) => row.filename),
  );

  if (pending.length === 0) {
    console.log("No pending migrations.");
    return;
  }

  // Sequential on purpose: each migration may depend on the one before it.
  for (const filename of pending) {
    const statements = await readFile(path.join(MIGRATIONS_DIR, filename), "utf8");
    await sql.begin(async (transaction) => {
      await transaction.unsafe(statements);
      await transaction.unsafe("insert into schema_migrations (filename) values ($1)", [filename]);
    });
    console.log(`Applied ${filename}`);
  }
}

try {
  await migrate();
} catch (error) {
  console.error("Migration failed, nothing after the failing file was applied:", error);
  process.exitCode = 1;
} finally {
  await sql.end();
}
