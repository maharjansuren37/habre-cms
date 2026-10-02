// How big one save of a post or page may be. Shared by the browser, which
// checks before it sends, and the server, which is the real boundary. No
// imports, so it costs the browser bundle nothing.

/**
 * An entry of 200 ordinary blocks is far smaller than this. The limit bounds
 * what one authenticated request can make the server buffer - the same guard
 * login has (F-01, where three 100 MB bodies took the process past 1.5 GB).
 */
export const MAX_ENTRY_BODY_BYTES = 1024 * 1024;

/** What the writer reads when a save is too big, from either check (F-39). */
export const ENTRY_TOO_LONG_MESSAGE = "This is too long to save. Remove some text and save again.";

/**
 * Whether a save's declared size is small enough to read. A missing
 * Content-Length means a body of unknown size, which a form submission from the
 * editor never sends.
 */
export function isEntryBodySizeAllowed(headers: Headers): boolean {
  const declared = Number(headers.get("Content-Length"));
  return Number.isFinite(declared) && declared > 0 && declared <= MAX_ENTRY_BODY_BYTES;
}

/**
 * The size of the body this form becomes: React Router submits a form as
 * `application/x-www-form-urlencoded`, so what counts is the encoded text in
 * UTF-8 - a quote becomes three bytes, an "é" six - not the length typed.
 */
export function encodedFormBytes(form: FormData): number {
  const body = new URLSearchParams();
  for (const [name, value] of form) body.append(name, typeof value === "string" ? value : "");
  return new TextEncoder().encode(body.toString()).length;
}

/** Whether the browser may send this form without the server refusing it for size. */
export function isEntryFormSizeAllowed(form: FormData): boolean {
  return encodedFormBytes(form) <= MAX_ENTRY_BODY_BYTES;
}
