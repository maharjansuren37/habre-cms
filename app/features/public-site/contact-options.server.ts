import type { ContactFormOptions } from "#app/features/blocks/contact-form.ts";
import { blocksOf, type Document } from "#app/features/blocks/document-nodes.ts";
import { parseContactAnswer } from "#app/features/contact/contact-message.ts";
import { issueContactToken } from "#app/features/contact/contact-token.server.ts";

/**
 * What a public loader hands the contact form (item 19b): the entry id, a
 * fresh token and the answer from `?contact=` - and only when the document
 * holds a contact form, so the id stays off the wire otherwise (F-108).
 */
export function contactFor(
  document: Document,
  entryId: string,
  request: Request,
): ContactFormOptions | undefined {
  if (!blocksOf(document).some((block) => block.type === "contactForm")) return undefined;
  return {
    entryId,
    started: issueContactToken(Date.now()),
    answer: parseContactAnswer(new URL(request.url).searchParams.get("contact")),
  };
}
