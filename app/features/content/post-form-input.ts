import { type Block, fromEditorJs } from "#app/features/blocks/blocks.ts";
import { entryInputSchema } from "./entry-input.ts";

// A post of 200 blocks at the per-block cap is far smaller than this. The limit
// bounds what one authenticated request can make the server buffer - the same
// guard login has (F-01, where three 100 MB bodies took the process past 1.5 GB).
const MAX_POST_BODY_BYTES = 1024 * 1024;

/**
 * Whether a save's declared size is small enough to read. A missing
 * Content-Length means a body of unknown size, which a form submission from the
 * editor never sends.
 */
export function isPostBodySizeAllowed(headers: Headers): boolean {
  const declared = Number(headers.get("Content-Length"));
  return Number.isFinite(declared) && declared > 0 && declared <= MAX_POST_BODY_BYTES;
}

export type PostFormResult =
  | { ok: true; title: string; blocks: Block[] }
  | { ok: false; message: string };

/**
 * Turns a submitted form into validated input, or into the one sentence the
 * writer reads. The author is never taken from here - it comes from the session.
 */
export function parsePostForm(form: FormData): PostFormResult {
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

  let editorOutput: unknown;
  try {
    editorOutput = JSON.parse(String(form.get("blocks")));
  } catch {
    return { ok: false, message: "The editor's content could not be read. Reload and try again." };
  }

  const blocks = fromEditorJs(editorOutput);
  if (!blocks.ok) return { ok: false, message: blocks.message };

  const input = entryInputSchema.safeParse({
    title: form.get("title") ?? "",
    blocks: blocks.blocks,
  });
  if (!input.success) {
    return {
      ok: false,
      message: input.error.issues[0]?.message ?? "This post could not be saved.",
    };
  }
  return { ok: true, title: input.data.title, blocks: input.data.blocks };
}

/** The version the editor loaded, or null when the form carried no usable one. */
export function parseVersion(form: FormData): number | null {
  const version = Number(form.get("version"));
  return Number.isInteger(version) && version > 0 ? version : null;
}
