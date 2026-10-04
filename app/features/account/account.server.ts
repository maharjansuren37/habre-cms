import { sql } from "#app/lib/db.server.ts";

/** Sets the signed-in person's own name. `userId` is the session's, never the form's. */
export async function changeName(userId: string, name: string): Promise<void> {
  await sql`update users set name = ${name}, updated_at = now() where id = ${userId}`;
}
