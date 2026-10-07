import { z } from "zod";
import { isStorableText } from "#app/features/blocks/inline-runs.ts";
import { parseBrandColor } from "#app/features/brand/brand-colours.ts";
import { isLanguageTag } from "./languages.ts";

// Same bound as entries.title (0002_entries.sql) - a site title is the same
// kind of short, plain-text field.
export const siteTitleSchema = z
  .string()
  .trim()
  .min(1, { message: "Enter a site title." })
  .max(200, { message: "Site title can be up to 200 characters." })
  .refine(isStorableText, { message: "The site title has a character that cannot be stored." });

// Same bound as entries.seo_description (0016_seo.sql). Empty is allowed: no
// description is the default.
export const siteDescriptionSchema = z
  .string()
  .trim()
  .max(300, { message: "Site description can be up to 300 characters." })
  .refine(isStorableText, {
    message: "The site description has a character that cannot be stored.",
  });

// The app's list is the allowlist; the column's format check is only a backstop.
export const languageSchema = z
  .string()
  .refine(isLanguageTag, { message: "Choose a language from the list." });

// The picker only ever sends a real media id or nothing (Remove logo) - a
// crafted request could send anything else, so this is checked, not trusted.
export const logoMediaIdSchema = z.uuid().nullable();

// The Home page select sends "" for "No home page" - stored as null, the only
// encoding of the default (item 9's D-1). Anything else must be a well-formed
// id; whether it is actually a page is the action's check, not this one.
export const homePageIdSchema = z.union([z.literal("").transform(() => null), z.uuid()]);

// "" is No colour. Anything else must be exactly #rrggbb (parseBrandColor's own
// rule, the same one the page's <style> is built from - D171), and is stored
// lowercase. Never the submitted text.
export const brandColorSchema = z
  .string()
  .refine((value) => value === "" || parseBrandColor(value) !== "", {
    message: "Choose a colour from the swatches or the colour picker.",
  })
  .transform((value) => parseBrandColor(value));

export const stylePresetSchema = z.enum(["classic", "modern", "friendly"], {
  message: "Choose one of the three styles.",
});

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
