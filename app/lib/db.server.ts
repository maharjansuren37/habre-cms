import postgres, { type TransactionSql } from "postgres";
import { databaseEnv } from "#app/lib/database-env.server.ts";

// Small pool: PostgreSQL shares a 1 GB server with the app (plan section 8).
export const sql = postgres(databaseEnv.DATABASE_URL, { max: 5 });

/**
 * Runs `run` in one transaction with `app.site_id` set to this site. The
 * setting is transaction-local (`set_config(..., true)`), so a pooled
 * connection never carries it into another request. Row-level security reads
 * it (migration 0011); every site-owned query goes through here AND names `site_id`
 * itself - D151's two guards, so neither alone is the only line of defence.
 */
export async function inSite<T>(
  siteId: string,
  run: (tx: TransactionSql) => Promise<T>,
): Promise<T> {
  // `begin`'s callback type is `UnwrapPromiseArray<T>`, which does not simplify
  // for a generic `T`; the value is exactly what `run` resolved to.
  return (await sql.begin(async (tx) => {
    await tx`select set_config('app.site_id', ${siteId}, true)`;
    return run(tx);
  })) as T;
}
