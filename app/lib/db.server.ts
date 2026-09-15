import postgres from "postgres";
import { databaseEnv } from "#app/lib/database-env.server.ts";

// Small pool: PostgreSQL shares a 1 GB server with the app (plan section 8).
export const sql = postgres(databaseEnv.DATABASE_URL, { max: 5 });
