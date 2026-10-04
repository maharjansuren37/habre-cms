import { z } from "zod";

// Limits on what a site may use (item 15d). Kept apart from env.server.ts,
// which parses process.env when imported, so node --test can exercise these
// rules. env.server.ts spreads the fields and renames the key to bytes.

const BYTES_PER_MB = 1024 * 1024;

// A blank variable (`STORAGE_LIMIT_MB=` copied from .env.example) counts as unset.
const optional = <Schema extends z.ZodType>(schema: Schema) =>
  z.preprocess((value) => (value === "" ? undefined : value), schema);

const storageLimitMb = z
  .string()
  .regex(/^(?:none|[1-9][0-9]*)$/, {
    message: "STORAGE_LIMIT_MB must be a whole number of MB from 1, or none",
  })
  .transform((value) => (value === "none" ? null : Number(value) * BYTES_PER_MB));

export const limitsEnvFields = {
  // Each site's media storage limit, in MB of 1,048,576 bytes. Parsed to bytes,
  // or null for no limit. Unset gives 500 MB (D150).
  STORAGE_LIMIT_MB: optional(storageLimitMb.default(500 * BYTES_PER_MB)),
};

export const limitsEnvSchema = z.object(limitsEnvFields);
