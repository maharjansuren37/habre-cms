import { sql } from "#app/lib/db.server.ts";

const NO_STORE = { "Cache-Control": "no-store" };

export async function loader() {
  try {
    await sql`select 1`;
    return Response.json({ status: "ok", database: "up" }, { headers: NO_STORE });
  } catch (error) {
    console.error("healthz: database check failed:", error);
    return Response.json({ status: "error", database: "down" }, { status: 503, headers: NO_STORE });
  }
}
