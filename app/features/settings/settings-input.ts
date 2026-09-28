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

// The Home page select sends "" for "Latest posts" - stored as null, the only
// encoding of the default (item 9's D-1). Anything else must be a well-formed
// id; whether it is actually a page is the action's check, not this one.
export const homePageIdSchema = z.union([z.literal("").transform(() => null), z.uuid()]);
