import { z } from "zod";
import { isStorableText } from "#app/features/blocks/inline-runs.ts";

// Same bound as entries.title (0002_entries.sql) - a site title is the same
// kind of short, plain-text field.
export const siteTitleSchema = z
  .string()
  .trim()
  .min(1, { message: "Enter a site title." })
  .max(200, { message: "Site title can be up to 200 characters." })
  .refine(isStorableText, { message: "The site title has a character that cannot be stored." });

// The picker only ever sends a real media id or nothing (Remove logo) - a
// crafted request could send anything else, so this is checked, not trusted.
export const logoMediaIdSchema = z.uuid().nullable();

// The Home page select sends "" for "No home page" - stored as null, the only
// encoding of the default (item 9's D-1). Anything else must be a well-formed
// id; whether it is actually a page is the action's check, not this one.
export const homePageIdSchema = z.union([z.literal("").transform(() => null), z.uuid()]);

// 20 navigation rows and a title are well under this. It bounds what one
// authenticated request can make the server buffer (F-117, the F-01 rule).
const MAX_SETTINGS_BODY_BYTES = 16 * 1024;

/**
 * Whether a save's declared size is small enough to read. A missing or
 * non-numeric Content-Length is refused: the settings form always sends one.
 */
export function isSettingsFormBodyAllowed(headers: Headers): boolean {
  const declared = Number(headers.get("Content-Length"));
  return Number.isFinite(declared) && declared > 0 && declared <= MAX_SETTINGS_BODY_BYTES;
}
