/**
 * The web address an entry is served at, derived from its title. Shown to
 * editors as "Web address", never "slug" (design.md, Words).
 */

// Long enough to stay readable in a URL, short enough to keep the column sane.
const MAX_LENGTH = 80;
// A title of only punctuation or emoji leaves nothing; every entry still needs
// an address, and the type name is a truthful one.
const FALLBACK = "post";

export function slugFromTitle(title: string): string {
  const slug = title
    .normalize("NFKD")
    // Strip the accents NFKD just separated: café -> cafe, not caf.
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_LENGTH)
    // Slicing can leave a trailing hyphen where a word was cut.
    .replace(/-+$/g, "");
  return slug === "" ? FALLBACK : slug;
}

/**
 * The first address not already in use, given the ones that are. Suffixes start
 * at 2, so the second "Hello world" is `hello-world-2` - what a person would
 * write themselves.
 */
export function nextFreeSlug(base: string, taken: readonly string[]): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let suffix = 2; ; suffix++) {
    // Keep the whole thing within MAX_LENGTH by trimming the base, not the number.
    const room = MAX_LENGTH - `-${suffix}`.length;
    const candidate = `${base.slice(0, room).replace(/-+$/g, "")}-${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
}
