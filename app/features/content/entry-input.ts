import { z } from "zod";
import { blocksSchema } from "#app/features/blocks/blocks.ts";

/**
 * The trust boundary for everything the editor submits. Messages are what the
 * writer reads, so they say what to do rather than naming a rule.
 *
 * Kept out of `entries.server.ts` on purpose: that module opens a database
 * connection when it is imported, and this schema is pure logic that
 * `node --test` must be able to load without one (coding-standards.md).
 */
export const entryInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, { message: "Give your post a title before saving." })
    .max(200, { message: "Titles can be up to 200 characters." }),
  blocks: blocksSchema,
});

export type EntryInput = z.infer<typeof entryInputSchema>;
