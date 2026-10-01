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

/** A ready-made hero's four fields, all text - what its form hands over. */
function isReadableHero(section: { kind?: unknown; fields?: unknown }): boolean {
  if (section.kind !== "hero") return false;
  const { fields } = section;
  return (
    typeof fields === "object" &&
    fields !== null &&
    ["heading", "text", "buttonLabel", "buttonHref"].every(
      (name) => typeof (fields as Record<string, unknown>)[name] === "string",
    )
  );
}

/**
 * The page editor's counterpart: each section is either readable columns or a
 * hero's fields. Anything less is not saved, for the reason
 * `isReadableEditorContent` gives.
 */
export function isReadableSectionsContent(content: unknown): content is { sections: unknown[] } {
  if (typeof content !== "object" || content === null) return false;
  const { sections } = content as { sections?: unknown };
  return (
    Array.isArray(sections) &&
    sections.length > 0 &&
    sections.every((section) => {
      if (typeof section !== "object" || section === null) return false;
      const each = section as { columns?: unknown; kind?: unknown; fields?: unknown };
      if (each.kind !== undefined) return each.columns === undefined && isReadableHero(each);
      return Array.isArray(each.columns) && each.columns.every(isReadableEditorContent);
    })
  );
}
