import { z } from "zod";

// Limits on what a site may use (item 15d). Kept apart from env.server.ts,
// which parses process.env when imported, so node --test can exercise these
// rules. env.server.ts spreads the fields and renames the key to bytes.

const BYTES_PER_MB = 1024 * 1024;

// A blank variable (`STORAGE_LIMIT_MB=` copied from .env.example) counts as unset.
const optional = <Schema extends z.ZodType>(schema: Schema) =>
  z.preprocess((value) => (value === "" ? undefined : value), schema);

const storageLimitMb = (variable: string) =>
  z
    .string()
    .regex(/^(?:none|[1-9][0-9]*)$/, {
      message: `${variable} must be a whole number of MB from 1, or none`,
    })
    .transform((value) => (value === "none" ? null : Number(value) * BYTES_PER_MB));

// Launch's storage limit when LAUNCH_STORAGE_LIMIT_MB is unset (item 21a).
const LAUNCH_DEFAULT_BYTES = 10240 * BYTES_PER_MB;

export const limitsEnvFields = {
  // Each site's media storage limit, in MB of 1,048,576 bytes. Parsed to bytes,
  // or null for no limit. Unset gives 500 MB (D150).
  STORAGE_LIMIT_MB: optional(storageLimitMb("STORAGE_LIMIT_MB").default(500 * BYTES_PER_MB)),
  // Launch's limit (item 21a), same rules. Left undefined when unset:
  // launchStorageBytes gives the default, never lower than Free's.
  LAUNCH_STORAGE_LIMIT_MB: optional(storageLimitMb("LAUNCH_STORAGE_LIMIT_MB").optional()),
};

type LaunchStorageFields = {
  STORAGE_LIMIT_MB: number | null;
  LAUNCH_STORAGE_LIMIT_MB?: number | null | undefined;
};

// Launch may not be set below Free (null is no limit, so above every number).
export const requireLaunchStorageAtLeastFree = (
  fields: LaunchStorageFields,
  context: z.RefinementCtx,
) => {
  const launch = fields.LAUNCH_STORAGE_LIMIT_MB;
  const free = fields.STORAGE_LIMIT_MB;
  if (launch === undefined || launch === null) return;
  if (free === null || launch < free) {
    context.addIssue({
      code: "custom",
      path: ["LAUNCH_STORAGE_LIMIT_MB"],
      message: "LAUNCH_STORAGE_LIMIT_MB must not be lower than STORAGE_LIMIT_MB",
    });
  }
};

// Launch's storage limit in bytes, or null for none. Unset gives 10240 MB, or
// Free's when that is higher.
export const launchStorageBytes = (fields: LaunchStorageFields): number | null => {
  if (fields.LAUNCH_STORAGE_LIMIT_MB !== undefined) return fields.LAUNCH_STORAGE_LIMIT_MB;
  if (fields.STORAGE_LIMIT_MB === null) return null;
  return Math.max(LAUNCH_DEFAULT_BYTES, fields.STORAGE_LIMIT_MB);
};

export const limitsEnvSchema = z
  .object(limitsEnvFields)
  .superRefine(requireLaunchStorageAtLeastFree);
