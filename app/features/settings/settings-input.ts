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
