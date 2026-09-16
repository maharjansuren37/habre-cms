/**
 * Whether what the editor handed back can be saved.
 *
 * Kept in a plain module rather than inside `post-form.tsx`, because
 * `node --test` cannot run JSX and this is the branch that has to stay correct
 * (coding-standards.md; `post-form-input.ts` is the same split). Editor.js's own
 * failure modes are reasoned from its source - `save()` resolves `undefined`
 * when a tool throws inside it, and `isReady` rejects when the editor never
 * started - but what this project does about them is testable, and is tested.
 */
export function isReadableEditorContent(content: unknown): content is { blocks: unknown[] } {
  return (
    typeof content === "object" &&
    content !== null &&
    Array.isArray((content as { blocks?: unknown }).blocks)
  );
}
