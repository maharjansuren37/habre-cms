import postgres from "postgres";
import { env } from "#app/lib/env.server.ts";

// Small pool: PostgreSQL shares a 1 GB server with the app (plan section 8).
export const sql = postgres(env.DATABASE_URL, { max: 5 });
