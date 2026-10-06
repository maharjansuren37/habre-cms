/**
 * The web address an entry is served at, derived from its title. Shown to
 * editors as "Web address", never "slug" (design.md, Words).
 */

export type EntryType = "post" | "page";

// Long enough to stay readable in a URL, short enough to keep the column sane.
const MAX_LENGTH = 80;
// A title of only punctuation or emoji leaves nothing; every entry still needs
// an address, and the type name is a truthful one.
const FALLBACK: Record<EntryType, string> = { post: "post", page: "page" };

// Addresses a page can never be handed, whether or not one is already taken in
// the database - `admin` and `posts` are routes this app already answers,
// `healthz` is the health check, and `api` is reserved for a route that does
// not exist yet, so a page cannot claim it first (item 6a). The rest are the
// platform paths: on a site host they redirect to the platform (item 16a), so
// a page at one of them could never be seen.
export const RESERVED_PAGE_SLUGS = [
  "admin",
  "posts",
  "api",
  "healthz",
  "signup",
  "verify",
  "forgot-password",
  "reset-password",
  "confirm-email",
] as const;

export function slugFromTitle(title: string, type: EntryType): string {
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
  return slug === "" ? FALLBACK[type] : slug;
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
