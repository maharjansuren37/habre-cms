import type { Section } from "./blocks.ts";

/**
 * Kept apart from `blocks.ts` on purpose: that module builds Zod schemas when it
 * is imported, and Zod's code generation is blocked by the site's content
 * security policy. The public renderer is bundled for the browser and needs only
 * this, so it imports nothing that runs Zod (`import type` is erased).
 */
/** The sections with something to show - an empty one renders nothing publicly. */
export function nonEmptySections(sections: Section[]): Section[] {
  return sections.filter((section) => section.data.children.some((column) => column.length > 0));
}
