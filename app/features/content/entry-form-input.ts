import { type Document, parseDocument } from "#app/features/blocks/document.ts";
import { seoDescriptionSchema, seoTitleSchema, titleSchema } from "./entry-input.ts";
import type { EntryType } from "./slug.ts";

/** The editor's submitted `blocks` field, parsed as JSON, or why it cannot be read. */
function readEditorOutput(
  form: FormData,
): { ok: true; value: unknown } | { ok: false; message: string } {
  // An absent field is not an empty post. The editor adds `blocks` as it
  // submits, so a submission without it never came from the editor - a native
  // submit with JavaScript off, a keypress before hydration, a truncated body -
  // and treating that as "no blocks" wiped the body of a saved post (F-34).
  // An empty post is still legal: what matters is that the field was sent.
  if (!form.has("blocks")) {
    return {
      ok: false,
      message: "The editor had not finished loading, so nothing was saved. Reload and try again.",
    };
  }

  try {
    return { ok: true, value: JSON.parse(String(form.get("blocks"))) };
  } catch {
    return { ok: false, message: "The editor's content could not be read. Reload and try again." };
  }
}

export type DocumentFormResult =
  | { ok: true; title: string; seoTitle: string; seoDescription: string; document: Document }
  | { ok: false; message: string };

/**
 * Turns a submitted form into validated input, or into the one sentence the
 * writer reads: its title, and its document as `parseDocument` returns it - the
 * schema's output, never the submitted JSON (item 14a1). The author is never
 * taken from here - it comes from the session.
 */
export function parseDocumentForm(form: FormData, type: EntryType): DocumentFormResult {
  const editorOutput = readEditorOutput(form);
  if (!editorOutput.ok) return editorOutput;
  const title = titleSchema.safeParse(form.get("title") ?? "");
  if (!title.success) {
    return { ok: false, message: title.error.issues[0]?.message ?? "This could not be saved." };
  }
  const document = parseDocument(editorOutput.value, type);
  if (!document.ok) return document;
  // Absent is not empty, for the same reason as `blocks` (F-34, F-107): a form
  // from before these fields existed, or a crafted post, must not clear what
  // is saved. The editor always renders both, so a submission without them is
  // out of date.
  if (!form.has("seoTitle") || !form.has("seoDescription")) {
    return {
      ok: false,
      message:
        "The search and sharing fields were missing, so nothing was saved. Reload and try again.",
    };
  }
  const seoTitle = seoTitleSchema.safeParse(String(form.get("seoTitle")));
  if (!seoTitle.success) {
    return { ok: false, message: seoTitle.error.issues[0]?.message ?? "This could not be saved." };
  }
  const seoDescription = seoDescriptionSchema.safeParse(String(form.get("seoDescription")));
  if (!seoDescription.success) {
    return {
      ok: false,
      message: seoDescription.error.issues[0]?.message ?? "This could not be saved.",
    };
  }
  return {
    ok: true,
    title: title.data,
    seoTitle: seoTitle.data,
    seoDescription: seoDescription.data,
    document: document.document,
  };
}

/** The version the editor loaded, or null when the form carried no usable one. */
export function parseVersion(form: FormData): number | null {
  const version = Number(form.get("version"));
  return Number.isInteger(version) && version > 0 ? version : null;
}
