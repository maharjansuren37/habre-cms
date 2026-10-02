/**
 * Text and link checks shared by every place that stores what someone typed:
 * the document schema (`document.ts`), the editor's link dialog, the site
 * settings and the navigation menu, and media alt text. The name is from
 * `blocks_format` v2's inline runs, which item 14a1 removed; moving these is a
 * refactor of its own (current-work.md, Notes).
 */

const MAX_HREF_LENGTH = 2_048;

/**
 * Whether PostgreSQL can hold this text in `jsonb`. It refuses U+0000 and any
 * lone surrogate - both pass every other check here, and both would otherwise
 * surface as a 500 from the save rather than a message (F-47, F-49).
 */
export function isStorableText(text: string): boolean {
  return !text.includes("\u0000") && text.isWellFormed();
}

/**
 * Whether a link address is safe to store and render. An allowlist, because the
 * editor's own link field accepts any `scheme:` - `javascript:` included.
 */
export function isSafeHref(href: string): boolean {
  if (href.length === 0 || href.length > MAX_HREF_LENGTH) return false;
  if (!isStorableText(href)) return false;
  // Browsers ignore these before reading a scheme, so `java\tscript:` is still
  // `javascript:` to them and has to be to this check.
  // biome-ignore lint/suspicious/noControlCharactersInRegex: matching them is the point
  const compact = href.replace(/[\u0000-\u0020\u007f]/g, "");
  if (compact.startsWith("#")) return true;
  // `//host` and `/\host` both leave the site in a browser.
  if (compact.startsWith("/")) return compact[1] !== "/" && compact[1] !== "\\";
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(compact)?.[1]?.toLowerCase();
  return scheme === "http" || scheme === "https" || scheme === "mailto";
}

/** What a person reads when a link address is refused - the link dialog's and the button's settings. */
export const LINK_ERRORS = {
  unsafe:
    "This address cannot be used. Use a web address (https://…), an email link (mailto:…) or a page on this site (/…).",
  tooLong: "This address is too long. A link address can be at most 2,048 characters.",
} as const;
