import {
  BLOCKS_FORMAT,
  type Block,
  PAGE_BLOCKS_FORMAT,
  type Section,
  sectionsFromBlocks,
} from "#app/features/blocks/blocks.ts";
import { BLOCKS_FORMAT_V4, type Document } from "#app/features/blocks/document.ts";
import type { Role } from "#app/features/users/roles.ts";
import { sql } from "#app/lib/db.server.ts";
import { assertKnownFormat, readableFormats } from "./blocks-format.ts";
import type { DocumentInput, EntryInput, PageInput } from "./entry-input.ts";
import type { EntryListQuery } from "./entry-list-query.ts";
import { type EntryType, nextFreeSlug, RESERVED_PAGE_SLUGS, slugFromTitle } from "./slug.ts";

export type { EntryType };

// A page of the list, in one screenful. Comfortably below the quality bar's
// scale (a few thousand entries -> at most a few hundred pages).
export const PAGE_SIZE = 20;

type EntryBase = {
  id: string;
  title: string;
  slug: string;
  status: "draft" | "published";
  authorId: string;
  version: number;
  updatedAt: Date;
};

/** A post is a flat list of blocks; a page is a list of sections (D114). */
export type PostEntry = EntryBase & { type: "post"; blocks: Block[] };
export type PageEntry = EntryBase & { type: "page"; sections: Section[] };
/** From `v4` (item 14a1, D169), a post or a page is one document. */
export type DocumentEntry = EntryBase & { type: EntryType; document: Document };
export type Entry = PostEntry | PageEntry | DocumentEntry;

/** What a stored `blocks` column holds, before its format is known. */
type StoredContent = Block[] | Section[] | Document;

/**
 * What a stored `blocks` column means for this entry type and format. A `v2`
 * page loads as the one section it is shown as; nothing is rewritten until its
 * next save. The column is trusted as stored, the same as it always was -
 * `assertKnownFormat` has already refused a format this build cannot read.
 */
function pageSections(format: string, stored: StoredContent): Section[] {
  return format === "v2" ? sectionsFromBlocks(stored as Block[]) : (stored as Section[]);
}

/** Who is asking. Ownership is decided from this, never from the form. */
export type Actor = { id: string; role: Role };

const entryColumns = sql`
  id, type, title, slug, blocks,
  blocks_format as "blocksFormat",
  status,
  author_id as "authorId",
  version,
  updated_at as "updatedAt"
`;

/** What the columns above return; the format is checked, then reshaped. */
type EntryRow = EntryBase & {
  type: EntryType;
  blocks: StoredContent;
  blocksFormat: string;
};

function toEntry({ blocks, blocksFormat, ...entry }: EntryRow): Entry {
  assertKnownFormat(entry.id, entry.type, blocksFormat);
  if (blocksFormat === BLOCKS_FORMAT_V4) return { ...entry, document: blocks as Document };
  return entry.type === "page"
    ? { ...entry, type: "page", sections: pageSections(blocksFormat, blocks) }
    : { ...entry, type: "post", blocks: blocks as Block[] };
}

/**
 * Authors see only their own entries; editors and admins see every one.
 * Qualified to `e` (F-60): every caller aliases its `entries` reference the
 * same way, so this stays correct wherever it is composed into a query that
 * also joins another table - `listEntries` joins `users`, which happens to
 * have no `author_id` column today, but an unqualified fragment would have
 * broken silently the day it did.
 */
function ownedBy(actor: Actor) {
  return actor.role === "author" ? sql`and e.author_id = ${actor.id}` : sql``;
}

export async function findEntryForUser(
  type: "post",
  id: string,
  actor: Actor,
): Promise<PostEntry | DocumentEntry | null>;
export async function findEntryForUser(
  type: "page",
  id: string,
  actor: Actor,
): Promise<PageEntry | DocumentEntry | null>;
export async function findEntryForUser(
  type: EntryType,
  id: string,
  actor: Actor,
): Promise<Entry | null>;
export async function findEntryForUser(
  type: EntryType,
  id: string,
  actor: Actor,
): Promise<Entry | null> {
  const [row] = await sql<EntryRow[]>`
    select ${entryColumns} from entries e
    where e.id = ${id} and e.type = ${type} ${ownedBy(actor)}
  `;
  return row ? toEntry(row) : null;
}

/**
 * What an entry is stored as: a post keeps its flat blocks as `v2`, a page its
 * sections as `v3`, and either one a document as `v4` (item 14a1). `sql.json`,
 * not `JSON.stringify`: the column is jsonb, and a string would be stored as a
 * JSON string rather than the value itself.
 */
function storedContent(type: EntryType, input: EntryInput | PageInput | DocumentInput) {
  if ("document" in input) {
    return { blocks: sql.json(input.document as never), blocks_format: BLOCKS_FORMAT_V4 };
  }
  return type === "page" && "sections" in input
    ? { blocks: sql.json(input.sections), blocks_format: PAGE_BLOCKS_FORMAT }
    : { blocks: sql.json((input as EntryInput).blocks), blocks_format: BLOCKS_FORMAT };
}

export async function createDraft(
  type: "post",
  input: EntryInput,
  authorId: string,
): Promise<Entry>;
export async function createDraft(type: "page", input: PageInput, authorId: string): Promise<Entry>;
export async function createDraft(
  type: EntryType,
  input: EntryInput | PageInput,
  authorId: string,
): Promise<Entry> {
  const base = slugFromTitle(input.title, type);
  // Only addresses that could collide with this one, not the whole table.
  const taken = await sql<{ slug: string }[]>`
    select slug from entries where type = ${type} and slug like ${`${base}%`}
  `;
  // A page can never take an address a route already answers to, or one
  // reserved for a route that does not exist yet (item 6a) - folded into the
  // same free-address search a title collision already goes through, so
  // "Admin" becomes /admin-2 with no separate refusal.
  const reserved = type === "page" ? RESERVED_PAGE_SLUGS : [];
  const slug = nextFreeSlug(base, [...taken.map((row) => row.slug), ...reserved]);

  const [row] = await sql<EntryRow[]>`
    insert into entries ${sql({
      type,
      title: input.title,
      slug,
      ...storedContent(type, input),
      status: "draft",
      author_id: authorId,
    })}
    returning ${entryColumns}
  `;
  return toEntry(row);
}

export type UpdateResult =
  | { ok: true; entry: Entry }
  // The entry moved on since this editor loaded it - someone else saved, or the
  // same person in another tab. Never resolved by overwriting.
  | { ok: false; reason: "stale" }
  | { ok: false; reason: "not_found" };

export type StatusTransition = "publish" | "unpublish";

/**
 * The status half of a save, alongside the content half below. `published_at`
 * is set only the first time (F-40's item: 0002_entries.sql already commits to
 * "kept when unpublished, so a republished entry keeps its original date") -
 * unpublishing never touches it.
 */
function transitionUpdate(transition: StatusTransition | undefined) {
  if (transition === "publish") {
    return sql`, status = 'published', published_at = coalesce(published_at, now())`;
  }
  if (transition === "unpublish") return sql`, status = 'draft'`;
  return sql``;
}

/**
 * Saves an entry's content, and optionally its publish status, in one
 * atomic update - only over the version the editor loaded. The version is
 * part of the `where`, so two saves racing from the same version cannot both
 * win - the second changes no rows and is told, rather than silently replacing
 * work it never saw. Named for what it does now that a save can publish or
 * unpublish, not only ever touch a draft (F-40).
 */
export async function saveEntry(
  type: "post",
  id: string,
  input: EntryInput | DocumentInput,
  version: number,
  actor: Actor,
  transition?: StatusTransition,
): Promise<UpdateResult>;
export async function saveEntry(
  type: "page",
  id: string,
  input: PageInput | DocumentInput,
  version: number,
  actor: Actor,
  transition?: StatusTransition,
): Promise<UpdateResult>;
export async function saveEntry(
  type: EntryType,
  id: string,
  input: EntryInput | PageInput | DocumentInput,
  version: number,
  actor: Actor,
  transition?: StatusTransition,
): Promise<UpdateResult> {
  const stored = storedContent(type, input);
  const [row] = await sql<EntryRow[]>`
    update entries e set
      title = ${input.title},
      blocks = ${stored.blocks},
      blocks_format = ${stored.blocks_format},
      version = version + 1,
      updated_at = now()
      ${transitionUpdate(transition)}
    where e.id = ${id} and e.version = ${version} and e.type = ${type} ${ownedBy(actor)}
      -- Only over a row this build can read: a tab opened before a format change
      -- would otherwise replace newer content with the old format (F-46). Such a
      -- row changes nothing here, and findEntryForUser below refuses it loudly.
      and e.blocks_format = any(${readableFormats(type)})
    returning ${entryColumns}
  `;
  if (row) return { ok: true, entry: toEntry(row) };

  // No row changed: either this person cannot see it at all, or its version moved.
  const existing = await findEntryForUser(type, id, actor);
  return existing ? { ok: false, reason: "stale" } : { ok: false, reason: "not_found" };
}

/** One row of the list - lighter than `Entry`, since the list never needs `blocks`. */
export type EntrySummary = {
  id: string;
  title: string;
  slug: string;
  status: "draft" | "published";
  authorName: string;
  updatedAt: Date;
};

export type EntryList = {
  entries: EntrySummary[];
  // Matches the current status and search.
  total: number;
  totalPages: number;
  // Independent of the search: what each tab's own count reads.
  counts: { all: number; draft: number; published: number };
};

export async function listEntries(
  type: EntryType,
  actor: Actor,
  query: EntryListQuery,
): Promise<EntryList> {
  // Qualified to `e` (F-60), matching `ownedBy` - these compose into a query
  // that joins `users`, and an unqualified `status`/`title` would go from
  // "happens to be unambiguous" to a runtime "column reference is ambiguous"
  // the day `users` gains a same-named column.
  const statusFilter = query.status === "all" ? sql`` : sql`and e.status = ${query.status}`;
  const searchFilter = query.q === "" ? sql`` : sql`and e.title ilike ${`%${query.q}%`}`;

  const [rows, totalRows, statusCounts] = await Promise.all([
    sql<EntrySummary[]>`
      select e.id, e.title, e.slug, e.status, u.name as "authorName", e.updated_at as "updatedAt"
      from entries e join users u on u.id = e.author_id
      where e.type = ${type} ${ownedBy(actor)} ${statusFilter} ${searchFilter}
      order by e.updated_at desc
      limit ${PAGE_SIZE} offset ${(query.page - 1) * PAGE_SIZE}
    `,
    sql<{ total: number }[]>`
      select count(*)::int as total from entries e
      where e.type = ${type} ${ownedBy(actor)} ${statusFilter} ${searchFilter}
    `,
    sql<{ status: "draft" | "published"; count: number }[]>`
      select status, count(*)::int as count from entries e
      where e.type = ${type} ${ownedBy(actor)}
      group by status
    `,
  ]);

  const draft = statusCounts.find((row) => row.status === "draft")?.count ?? 0;
  const published = statusCounts.find((row) => row.status === "published")?.count ?? 0;
  const total = totalRows[0]?.total ?? 0;

  return {
    entries: rows,
    total,
    // PAGE_SIZE stays server-only; the client works from this number instead.
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    counts: { all: draft + published, draft, published },
  };
}

/** The deleted entry's own title, for the list's success message - or `null`
 *  when there was nothing this actor could delete (not found, or not theirs). */
export async function deleteEntry(
  type: EntryType,
  id: string,
  actor: Actor,
): Promise<{ title: string } | null> {
  const [row] = await sql<{ title: string }[]>`
    delete from entries e where e.id = ${id} and e.type = ${type} ${ownedBy(actor)}
    returning title
  `;
  return row ?? null;
}

/** What the public home page shows for one post - no `Actor`, no ownership:
 *  every visitor sees the same published list. */
export type PublicPostSummary = { title: string; slug: string; publishedAt: Date };

/**
 * The newest published posts, for the public home page. Ordered by
 * `published_at`, not `updated_at` (item 4b's D-3) - an unrelated copy-edit
 * must never reorder the public list.
 */
export async function listPublishedPosts(limit: number): Promise<PublicPostSummary[]> {
  return sql<PublicPostSummary[]>`
    select title, slug, published_at as "publishedAt"
    from entries
    where type = 'post' and status = 'published'
    order by published_at desc
    limit ${limit}
  `;
}

/** Whether `/`'s placeholder should link to `/posts` - only asked when no
 *  home page is shown, so a page at `/` costs no extra query (item 9's D-12). */
export async function hasPublishedPosts(): Promise<boolean> {
  const [row] = await sql<{ exists: boolean }[]>`
    select exists(
      select 1 from entries where type = 'post' and status = 'published'
    ) as "exists"
  `;
  return row.exists;
}

/** One page, for the navigation editor's dropdown - every page regardless of
 *  status, so an admin can link to a draft before it is published. */
export type NavPageOption = {
  id: string;
  title: string;
  slug: string;
  status: "draft" | "published";
};

export async function listPagesForNav(): Promise<NavPageOption[]> {
  return sql<NavPageOption[]>`
    select id, title, slug, status from entries where type = 'page' order by title
  `;
}

/** Published pages among the given ids, for resolving a saved menu's page
 *  links at render time - an id whose page is unpublished or deleted is
 *  simply absent from the result (D61's same silent-degrade rule). */
export async function findPublishedPageSlugs(
  ids: string[],
): Promise<{ id: string; slug: string }[]> {
  if (ids.length === 0) return [];
  return sql<{ id: string; slug: string }[]>`
    select id, slug from entries where type = 'page' and status = 'published' and id = any(${ids})
  `;
}

/** One published entry's full content, for its own page. */
type PublicBase = {
  title: string;
  publishedAt: Date;
  authorName: string;
};
export type PublicPost = PublicBase & ({ blocks: Block[] } | { document: Document });
export type PublicPage = PublicBase & ({ sections: Section[] } | { document: Document });

/** What the columns below return; the format is checked, then reshaped - same
 *  reason `toEntry` does this for the admin side. */
type PublicEntryRow = PublicBase & {
  blocks: StoredContent;
  blocksFormat: string;
};

/** A published entry found by its address, plus whether it is the page an
 *  admin chose for `/` - its own address then redirects there (item 9's D-4). */
export type PublishedPost = PublicPost & { id: string; isHomePage: boolean };
export type PublishedPage = PublicPage & { id: string; isHomePage: boolean };

/**
 * A published entry by its address, or `null` if there is none - a draft and a
 * missing slug get the same answer, so an entry's existence is never leaked by
 * its status (the same rule `findEntryForUser` applies for ownership).
 */
export async function findPublishedEntry(type: "post", slug: string): Promise<PublishedPost | null>;
export async function findPublishedEntry(type: "page", slug: string): Promise<PublishedPage | null>;
export async function findPublishedEntry(
  type: EntryType,
  slug: string,
): Promise<PublishedPost | PublishedPage | null> {
  // isHomePage rides on this query rather than a second settings read on every
  // public page request - only a page can be one (the settings action's check).
  const [row] = await sql<(PublicEntryRow & { id: string; isHomePage: boolean })[]>`
    select e.id, e.title, e.blocks, e.blocks_format as "blocksFormat",
      e.published_at as "publishedAt", u.name as "authorName",
      coalesce(e.id = (select home_page_id from site_settings where id = 1), false)
        as "isHomePage"
    from entries e join users u on u.id = e.author_id
    where e.type = ${type} and e.status = 'published' and e.slug = ${slug}
  `;
  if (!row) return null;
  const { blocks, blocksFormat, ...rest } = row;
  assertKnownFormat(slug, type, blocksFormat);
  if (blocksFormat === BLOCKS_FORMAT_V4) return { ...rest, document: blocks as Document };
  return type === "page"
    ? { ...rest, sections: pageSections(blocksFormat, blocks) }
    : { ...rest, blocks: blocks as Block[] };
}

/**
 * The page an admin chose for `/` (item 9), or `null` when none is set, it is
 * not published, or it is not a page - `/` then shows a placeholder (D-2).
 * One query: the settings row joined to the entry, rather than a settings read
 * followed by an entry read on every public home request.
 */
export async function findHomePage(): Promise<PublicPage | null> {
  const [row] = await sql<(PublicEntryRow & { slug: string })[]>`
    select e.slug, e.title, e.blocks, e.blocks_format as "blocksFormat",
      e.published_at as "publishedAt", u.name as "authorName"
    from site_settings s
      join entries e on e.id = s.home_page_id
      join users u on u.id = e.author_id
    where s.id = 1 and e.type = 'page' and e.status = 'published'
  `;
  if (!row) return null;
  const { blocks, blocksFormat, slug, ...page } = row;
  assertKnownFormat(slug, "page", blocksFormat);
  if (blocksFormat === BLOCKS_FORMAT_V4) return { ...page, document: blocks as Document };
  return { ...page, sections: pageSections(blocksFormat, blocks) };
}
