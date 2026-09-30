/**
 * Whether what the editor handed back can be saved.
 *
 * Kept in a plain module rather than inside `entry-form.tsx`, because
 * `node --test` cannot run JSX and this is the branch that has to stay correct
 * (coding-standards.md; `entry-form-input.ts` is the same split). Editor.js's own
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

/**
 * The page editor's counterpart: one or more readable columns per section. Anything less
 * is not saved, for the reason `isReadableEditorContent` gives.
 */
export function isReadableSectionsContent(
  content: unknown,
): content is { sections: { id: string; columns: { blocks: unknown[] }[] }[] } {
  if (typeof content !== "object" || content === null) return false;
  const { sections } = content as { sections?: unknown };
  return (
    Array.isArray(sections) &&
    sections.length > 0 &&
    sections.every(
      (section) =>
        typeof section === "object" &&
        section !== null &&
        Array.isArray((section as { columns?: unknown }).columns) &&
        (section as { columns: unknown[] }).columns.every(isReadableEditorContent),
    )
  );
}
