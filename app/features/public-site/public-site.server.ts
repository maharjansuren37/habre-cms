import { sql } from "#app/lib/db.server.ts";

/**
 * The site the public host serves. Until item 16 this is the oldest site - the
 * install that existed before sites did (site 1). Item 16 replaces it with a
 * lookup by host (D153). Kept server-side: the id never reaches a public page.
 */
export async function findPublicSiteId(): Promise<string> {
  const [row] = await sql<{ id: string }[]>`select id from sites order by created_at, id limit 1`;
  // A migrated database always has site 1 (migration 0010).
  if (!row) throw new Error("No site exists to serve; run `npm run db:migrate`.");
  return row.id;
}
