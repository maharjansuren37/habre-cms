import { z } from "zod";
import type { Document } from "#app/features/blocks/document.ts";

/**
 * The trust boundary for an entry's title; its document is `parseDocument`'s.
 * Messages are what the writer reads, so they say what to do rather than naming
 * a rule.
 *
 * Kept out of `entries.server.ts` on purpose: that module opens a database
 * connection when it is imported, and this schema is pure logic that
 * `node --test` must be able to load without one (coding-standards.md).
 */
export const titleSchema = z
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

/** A post or page: a title and one document (D169). */
export type DocumentInput = { title: string; document: Document };
