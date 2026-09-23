import { z } from "zod";
import { isSafeHref, isStorableText } from "#app/features/blocks/inline-runs.ts";

/**
 * The stored shape (plan section 6): a label plus either an existing page or a
 * plain web address, never both - `pageId`/`url` are two variants, not one
 * item with an optional field of each.
 */
export type NavItem = { label: string } & ({ pageId: string } | { url: string });

// A menu, not a sitemap - keeps the editor's own diff and the header's layout
// bounded (current-work.md's Decisions).
export const NAV_MAX_ITEMS = 20;
const MAX_LABEL_LENGTH = 100;

const labelSchema = z
  .string()
  .trim()
  .min(1, { message: "Enter a label." })
  .max(MAX_LABEL_LENGTH, { message: "Label can be up to 100 characters." })
  .refine(isStorableText, { message: "The label has a character that cannot be stored." });

// `strictObject` on both variants is what makes "exactly one of page or URL"
// a schema property rather than a hand-written check: an item carrying both
// keys fails every variant's excess-key check, and one carrying neither
// matches neither variant.
const pageItemSchema = z.strictObject({
  label: labelSchema,
  pageId: z.uuid(),
});

const urlItemSchema = z.strictObject({
  label: labelSchema,
  // isSafeHref already bounds length (2,048) and reuses the same scheme
  // allowlist inline links use (D30) - no second allowlist to keep in sync.
  url: z.string().refine(isSafeHref, { message: "That address cannot be used." }),
});

export const navItemSchema = z.union([pageItemSchema, urlItemSchema]);

export const navigationSchema = z.array(navItemSchema).max(NAV_MAX_ITEMS, {
  message: `A menu can have up to ${NAV_MAX_ITEMS} items.`,
});
