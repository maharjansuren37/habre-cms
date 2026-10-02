import { z } from "zod";
import { blocksSchema, sectionsSchema } from "#app/features/blocks/blocks.ts";
import type { Document } from "#app/features/blocks/document.ts";

/**
 * The trust boundary for everything the editor submits. Messages are what the
 * writer reads, so they say what to do rather than naming a rule.
 *
 * Kept out of `entries.server.ts` on purpose: that module opens a database
 * connection when it is imported, and this schema is pure logic that
 * `node --test` must be able to load without one (coding-standards.md).
 */
const titleSchema = z
  .string()
  .trim()
  .min(1, { message: "Give it a title before saving." })
  .max(200, { message: "Titles can be up to 200 characters." })
  // PostgreSQL refuses U+0000 in a text column, so a crafted title reached the
  // insert and answered 500 (F-47's residual). Refused at the boundary, the
  // way a block's text already is.
  .refine((title) => !title.includes("\u0000"), {
    message: "The title has a character that cannot be stored. Remove it and save again.",
  });

/** A post: a title and a flat list of blocks. */
export const entryInputSchema = z.object({ title: titleSchema, blocks: blocksSchema });

/** A page: a title and its sections (`blocks_format` v3, D114). */
export const pageInputSchema = z.object({ title: titleSchema, sections: sectionsSchema });

/** A v4 entry's title (item 14a1); its document is `parseDocument`'s. */
export const documentTitleSchema = titleSchema;

export type EntryInput = z.infer<typeof entryInputSchema>;
/** A v4 post or page: a title and one document (D169). */
export type DocumentInput = { title: string; document: Document };
export type PageInput = z.infer<typeof pageInputSchema>;
