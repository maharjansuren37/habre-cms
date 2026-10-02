import {
  type Block,
  fromEditorJs,
  fromEditorJsSections,
  type Section,
} from "#app/features/blocks/blocks.ts";
import { type Document, parseDocument } from "#app/features/blocks/document.ts";
import { documentTitleSchema, entryInputSchema, pageInputSchema } from "./entry-input.ts";
import type { EntryType } from "./slug.ts";

// An entry of 200 blocks at the per-block cap is far smaller than this. The
// limit bounds what one authenticated request can make the server buffer - the
// same guard login has (F-01, where three 100 MB bodies took the process past
// 1.5 GB).
const MAX_ENTRY_BODY_BYTES = 1024 * 1024;

/**
 * Whether a save's declared size is small enough to read. A missing
 * Content-Length means a body of unknown size, which a form submission from the
 * editor never sends.
 */
export function isEntryBodySizeAllowed(headers: Headers): boolean {
  const declared = Number(headers.get("Content-Length"));
  return Number.isFinite(declared) && declared > 0 && declared <= MAX_ENTRY_BODY_BYTES;
}

export type EntryFormResult =
  | { ok: true; title: string; blocks: Block[] }
  | { ok: false; message: string };

export type PageFormResult =
  | { ok: true; title: string; sections: Section[] }
  | { ok: false; message: string };

/**
 * Turns a submitted form into validated input, or into the one sentence the
 * writer reads. The author is never taken from here - it comes from the session.
 *
 * A page's editor submits sections, a post's a flat list of blocks.
 */
export function parseEntryForm(form: FormData, type: "post"): EntryFormResult;
export function parseEntryForm(form: FormData, type: "page"): PageFormResult;
export function parseEntryForm(form: FormData, type: EntryType): EntryFormResult | PageFormResult {
  const editorOutput = readEditorOutput(form);
  if (!editorOutput.ok) return editorOutput;

  const title = form.get("title") ?? "";
  if (type === "page") {
    const sections = fromEditorJsSections(editorOutput.value);
    if (!sections.ok) return { ok: false, message: sections.message };
    const input = pageInputSchema.safeParse({ title, sections: sections.sections });
    if (!input.success) {
      return { ok: false, message: input.error.issues[0]?.message ?? "This could not be saved." };
    }
    return { ok: true, title: input.data.title, sections: input.data.sections };
  }

  const blocks = fromEditorJs(editorOutput.value);
  if (!blocks.ok) return { ok: false, message: blocks.message };

  const input = entryInputSchema.safeParse({ title, blocks: blocks.blocks });
  if (!input.success) {
    return {
      ok: false,
      message: input.error.issues[0]?.message ?? "This could not be saved.",
    };
  }
  return { ok: true, title: input.data.title, blocks: input.data.blocks };
}

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
  | { ok: true; title: string; document: Document }
  | { ok: false; message: string };

/**
 * A v4 editor's submission (item 14a1): its title, and its document as
 * `parseDocument` returns it - the schema's output, never the submitted JSON.
 */
export function parseDocumentForm(form: FormData, type: EntryType): DocumentFormResult {
  const editorOutput = readEditorOutput(form);
  if (!editorOutput.ok) return editorOutput;
  const title = documentTitleSchema.safeParse(form.get("title") ?? "");
  if (!title.success) {
    return { ok: false, message: title.error.issues[0]?.message ?? "This could not be saved." };
  }
  const document = parseDocument(editorOutput.value, type);
  if (!document.ok) return document;
  return { ok: true, title: title.data, document: document.document };
}

/** The version the editor loaded, or null when the form carried no usable one. */
export function parseVersion(form: FormData): number | null {
  const version = Number(form.get("version"));
  return Number.isInteger(version) && version > 0 ? version : null;
}
