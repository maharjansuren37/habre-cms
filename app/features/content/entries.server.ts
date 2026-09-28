import { BLOCKS_FORMAT, type Block } from "#app/features/blocks/blocks.ts";
import type { Role } from "#app/features/users/roles.ts";
import { sql } from "#app/lib/db.server.ts";
import { assertKnownFormat } from "./blocks-format.ts";
import type { EntryInput } from "./entry-input.ts";
import type { EntryListQuery } from "./entry-list-query.ts";
import { type EntryType, nextFreeSlug, RESERVED_PAGE_SLUGS, slugFromTitle } from "./slug.ts";

export type { EntryType };

// A page of the list, in one screenful. Comfortably below the quality bar's
// scale (a few thousand entries -> at most a few hundred pages).
export const PAGE_SIZE = 20;

export type Entry = {
  id: string;
  type: EntryType;
  title: string;
  slug: string;
  blocks: Block[];
  status: "draft" | "published";
  authorId: string;
  version: number;
  updatedAt: Date;
};

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

/** What the columns above return; the format is checked, then left out. */
type EntryRow = Entry & { blocksFormat: string };

function toEntry({ blocksFormat, ...entry }: EntryRow): Entry {
  assertKnownFormat(entry.id, blocksFormat);
  return entry;
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

export async function createDraft(
  type: EntryType,
  input: EntryInput,
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
      // sql.json, not JSON.stringify: the column is jsonb, and a string would
      // be stored as a JSON string rather than the array itself.
      blocks: sql.json(input.blocks),
      blocks_format: BLOCKS_FORMAT,
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
  type: EntryType,
  id: string,
  input: EntryInput,
  version: number,
  actor: Actor,
  transition?: StatusTransition,
): Promise<UpdateResult> {
  const [row] = await sql<EntryRow[]>`
    update entries e set
      title = ${input.title},
      blocks = ${sql.json(input.blocks)},
      blocks_format = ${BLOCKS_FORMAT},
      version = version + 1,
      updated_at = now()
      ${transitionUpdate(transition)}
    where e.id = ${id} and e.version = ${version} and e.type = ${type} ${ownedBy(actor)}
      -- Only over a row this build can read: a tab opened before a format change
      -- would otherwise replace newer content with the old format (F-46). Such a
      -- row changes nothing here, and findEntryForUser below refuses it loudly.
      and e.blocks_format = ${BLOCKS_FORMAT}
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
export type PublicEntry = {
  title: string;
  blocks: Block[];
  publishedAt: Date;
  authorName: string;
};

/** What the columns below return; the format is checked, then left out - same
 *  reason `toEntry` does this for the admin side. */
type PublicEntryRow = PublicEntry & { blocksFormat: string };

/** A published entry found by its address, plus whether it is the page an
 *  admin chose for `/` - its own address then redirects there (item 9's D-4). */
export type PublishedEntry = PublicEntry & { id: string; isHomePage: boolean };

/**
 * A published entry by its address, or `null` if there is none - a draft and a
 * missing slug get the same answer, so an entry's existence is never leaked by
 * its status (the same rule `findEntryForUser` applies for ownership).
 */
export async function findPublishedEntry(
  type: EntryType,
  slug: string,
): Promise<PublishedEntry | null> {
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
  const { blocksFormat, ...post } = row;
  assertKnownFormat(slug, blocksFormat);
  return post;
}

/**
 * The page an admin chose for `/` (item 9), or `null` when none is set, it is
 * not published, or it is not a page - `/` then shows the latest posts (D-2).
 * One query: the settings row joined to the entry, rather than a settings read
 * followed by an entry read on every public home request.
 */
export async function findHomePage(): Promise<PublicEntry | null> {
  const [row] = await sql<(PublicEntryRow & { slug: string })[]>`
    select e.slug, e.title, e.blocks, e.blocks_format as "blocksFormat",
      e.published_at as "publishedAt", u.name as "authorName"
    from site_settings s
      join entries e on e.id = s.home_page_id
      join users u on u.id = e.author_id
    where s.id = 1 and e.type = 'page' and e.status = 'published'
  `;
  if (!row) return null;
  const { blocksFormat, slug, ...page } = row;
  assertKnownFormat(slug, blocksFormat);
  return page;
}
