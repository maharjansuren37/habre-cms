/**
 * Whether what the editor handed back can be saved.
 *
 * Kept in a plain module rather than inside `entry-form.tsx`, because
 * `node --test` cannot run JSX and this is the branch that has to stay correct
 * (coding-standards.md; `entry-form-input.ts` is the same split).
 *
 * TipTap's `getJSON()` is a document holding a list of sections (item 14a1).
 * The contract itself is `parseDocument`'s, on the server; this only refuses
 * what is plainly not a document - nothing at all when the editor had not
 * mounted (F-42) - rather than send it to be refused there.
 */
export function isReadableDocumentContent(
  content: unknown,
): content is { type: "doc"; content: unknown[] } {
  return (
    typeof content === "object" &&
    content !== null &&
    (content as { type?: unknown }).type === "doc" &&
    Array.isArray((content as { content?: unknown }).content)
  );
}
