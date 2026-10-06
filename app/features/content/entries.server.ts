import type { TransactionSql } from "postgres";
import { BLOCKS_FORMAT_V4, type Document } from "#app/features/blocks/document.ts";
import type { LinkablePage } from "#app/features/blocks/document-nodes.ts";
import type { Role } from "#app/features/users/roles.ts";
import { inSite, sql } from "#app/lib/db.server.ts";
import { assertKnownFormat, readableFormats } from "./blocks-format.ts";
import type { DocumentInput } from "./entry-input.ts";
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
  authorId: string | null;
  version: number;
  updatedAt: Date;
};

/** A post or a page is one document (item 14a1, D169). */
export type Entry = EntryBase & {
  type: EntryType;
  /** `''` when not set (item 17). */
  seoTitle: string;
  seoDescription: string;
  document: Document;
};

/** Who is asking. Ownership is decided from this, never from the form. */
export type Actor = { id: string; role: Role };

const entryColumns = sql`
  id, type, title, slug, blocks,
  seo_title as "seoTitle",
  seo_description as "seoDescription",
  blocks_format as "blocksFormat",
  status,
  author_id as "authorId",
  version,
  updated_at as "updatedAt"
`;

/** What the columns above return; the format is checked, then reshaped. */
type EntryRow = EntryBase & {
  type: EntryType;
  seoTitle: string;
  seoDescription: string;
  blocks: Document;
  blocksFormat: string;
};

/** The stored column is trusted as stored, as it always was - `assertKnownFormat`
 *  has already refused a format this build cannot read. */
function toEntry({ blocks, blocksFormat, ...entry }: EntryRow): Entry {
  assertKnownFormat(entry.id, entry.type, blocksFormat);
  return { ...entry, document: blocks };
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

async function findEntryIn(
  tx: TransactionSql,
  siteId: string,
  type: EntryType,
  id: string,
  actor: Actor,
): Promise<Entry | null> {
  const [row] = await tx<EntryRow[]>`
    select ${entryColumns} from entries e
    where e.site_id = ${siteId} and e.id = ${id} and e.type = ${type} ${ownedBy(actor)}
  `;
  return row ? toEntry(row) : null;
}

export async function findEntryForUser(
  siteId: string,
  type: EntryType,
  id: string,
  actor: Actor,
): Promise<Entry | null> {
  return inSite(siteId, (tx) => findEntryIn(tx, siteId, type, id, actor));
}

/**
 * What an entry is stored as: one document, `v4` (item 14a1). `sql.json`, not
 * `JSON.stringify`: the column is jsonb, and a string would be stored as a JSON
 * string rather than the value itself.
 */
function storedContent(input: DocumentInput) {
  return { blocks: sql.json(input.document as never), blocks_format: BLOCKS_FORMAT_V4 };
}

export async function createDraft(
  siteId: string,
  type: EntryType,
  input: DocumentInput,
  authorId: string,
): Promise<Entry> {
  const base = slugFromTitle(input.title, type);
  return inSite(siteId, async (tx) => {
    // Only addresses that could collide with this one, in this site, not the whole table.
    const taken = await tx<{ slug: string }[]>`
    select slug from entries
    where site_id = ${siteId} and type = ${type} and slug like ${`${base}%`}
  `;
    // A page can never take an address a route already answers to, or one
    // reserved for a route that does not exist yet (item 6a) - folded into the
    // same free-address search a title collision already goes through, so
    // "Admin" becomes /admin-2 with no separate refusal.
    const reserved = type === "page" ? RESERVED_PAGE_SLUGS : [];
    const slug = nextFreeSlug(base, [...taken.map((row) => row.slug), ...reserved]);

    const [row] = await tx<EntryRow[]>`
    insert into entries ${sql({
      site_id: siteId,
      type,
      title: input.title,
      seo_title: input.seoTitle,
      seo_description: input.seoDescription,
      slug,
      ...storedContent(input),
      status: "draft",
      author_id: authorId,
    })}
    returning ${entryColumns}
  `;
    return toEntry(row);
  });
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
  siteId: string,
  type: EntryType,
  id: string,
  input: DocumentInput,
  version: number,
  actor: Actor,
  transition?: StatusTransition,
): Promise<UpdateResult> {
  const stored = storedContent(input);
  return inSite(siteId, async (tx) => {
    const [row] = await tx<EntryRow[]>`
    update entries e set
      title = ${input.title},
      seo_title = ${input.seoTitle},
      seo_description = ${input.seoDescription},
      blocks = ${stored.blocks},
      blocks_format = ${stored.blocks_format},
      version = version + 1,
      updated_at = now()
      ${transitionUpdate(transition)}
    where e.site_id = ${siteId} and e.id = ${id} and e.version = ${version}
      and e.type = ${type} ${ownedBy(actor)}
      -- Only over a row this build can read: a tab opened before a format change
      -- would otherwise replace newer content with the old format (F-46). Such a
      -- row changes nothing here, and findEntryForUser below refuses it loudly.
      and e.blocks_format = any(${readableFormats(type)})
    returning ${entryColumns}
  `;
    if (row) return { ok: true, entry: toEntry(row) };

    // No row changed: either this person cannot see it at all, or its version moved.
    const existing = await findEntryIn(tx, siteId, type, id, actor);
    return existing ? { ok: false, reason: "stale" } : { ok: false, reason: "not_found" };
  });
}

/** One row of the list - lighter than `Entry`, since the list never needs `blocks`. */
export type EntrySummary = {
  id: string;
  title: string;
  slug: string;
  status: "draft" | "published";
  authorName: string | null;
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
  siteId: string,
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

  // The three queries queue on the transaction's one connection: still correct,
  // no longer concurrent - fine at this scale.
  const [rows, totalRows, statusCounts] = await inSite(siteId, (tx) =>
    Promise.all([
      tx<EntrySummary[]>`
      select e.id, e.title, e.slug, e.status, u.name as "authorName", e.updated_at as "updatedAt"
      from entries e left join users u on u.id = e.author_id
      where e.site_id = ${siteId} and e.type = ${type} ${ownedBy(actor)} ${statusFilter}
        ${searchFilter}
      order by e.updated_at desc
      limit ${PAGE_SIZE} offset ${(query.page - 1) * PAGE_SIZE}
    `,
      tx<{ total: number }[]>`
      select count(*)::int as total from entries e
      where e.site_id = ${siteId} and e.type = ${type} ${ownedBy(actor)} ${statusFilter}
        ${searchFilter}
    `,
      tx<{ status: "draft" | "published"; count: number }[]>`
      select status, count(*)::int as count from entries e
      where e.site_id = ${siteId} and e.type = ${type} ${ownedBy(actor)}
      group by status
    `,
    ]),
  );

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
  siteId: string,
  type: EntryType,
  id: string,
  actor: Actor,
): Promise<{ title: string } | null> {
  const [row] = await inSite(
    siteId,
    (tx) => tx<{ title: string }[]>`
    delete from entries e
    where e.site_id = ${siteId} and e.id = ${id} and e.type = ${type} ${ownedBy(actor)}
    returning title
  `,
  );
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
export async function listPublishedPosts(
  siteId: string,
  limit: number,
): Promise<PublicPostSummary[]> {
  return inSite(
    siteId,
    (tx) => tx<PublicPostSummary[]>`
    select title, slug, published_at as "publishedAt"
    from entries
    where site_id = ${siteId} and type = 'post' and status = 'published'
    order by published_at desc
    limit ${limit}
  `,
  );
}

/** Whether `/`'s placeholder should link to `/posts` - only asked when no
 *  home page is shown, so a page at `/` costs no extra query (item 9's D-12). */
export async function hasPublishedPosts(siteId: string): Promise<boolean> {
  const [row] = await inSite(
    siteId,
    (tx) => tx<{ exists: boolean }[]>`
    select exists(
      select 1 from entries
      where site_id = ${siteId} and type = 'post' and status = 'published'
    ) as "exists"
  `,
  );
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

export async function listPagesForNav(siteId: string): Promise<NavPageOption[]> {
  return inSite(
    siteId,
    (tx) => tx<NavPageOption[]>`
    select id, title, slug, status from entries
    where site_id = ${siteId} and type = 'page' order by title
  `,
  );
}

/**
 * The pages a button can link to, for the editor's "Goes to" list: the same
 * ones the Pages list shows this person (`ownedBy` - an author's own, an
 * editor's and an admin's all of them), drafts included, with no body.
 */
export async function listLinkablePages(siteId: string, actor: Actor): Promise<LinkablePage[]> {
  return inSite(
    siteId,
    (tx) => tx<LinkablePage[]>`
    select e.id, e.title, e.slug, e.status from entries e
    where e.site_id = ${siteId} and e.type = 'page' ${ownedBy(actor)}
    order by e.title
  `,
  );
}

/** Published pages among the given ids, for resolving a saved menu's page
 *  links at render time - an id whose page is unpublished or deleted is
 *  simply absent from the result (D61's same silent-degrade rule). */
export async function findPublishedPageSlugs(
  siteId: string,
  ids: string[],
): Promise<{ id: string; slug: string }[]> {
  if (ids.length === 0) return [];
  return inSite(
    siteId,
    (tx) => tx<{ id: string; slug: string }[]>`
    select id, slug from entries
    where site_id = ${siteId} and type = 'page' and status = 'published' and id = any(${ids})
  `,
  );
}

/** One published entry's full content, for its own page. */
type PublicBase = {
  title: string;
  publishedAt: Date;
  authorName: string | null;
};
export type PublicPost = PublicBase & { document: Document };
export type PublicPage = PublicBase & { document: Document };

/** What the columns below return; the format is checked, then reshaped - same
 *  reason `toEntry` does this for the admin side. */
type PublicEntryRow = PublicBase & {
  blocks: Document;
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
export async function findPublishedEntry(
  siteId: string,
  type: "post",
  slug: string,
): Promise<PublishedPost | null>;
export async function findPublishedEntry(
  siteId: string,
  type: "page",
  slug: string,
): Promise<PublishedPage | null>;
export async function findPublishedEntry(
  siteId: string,
  type: EntryType,
  slug: string,
): Promise<PublishedPost | PublishedPage | null> {
  // isHomePage rides on this query rather than a second settings read on every
  // public page request - only a page can be one (the settings action's check).
  const [row] = await inSite(
    siteId,
    (tx) => tx<(PublicEntryRow & { id: string; isHomePage: boolean })[]>`
    select e.id, e.title, e.blocks, e.blocks_format as "blocksFormat",
      e.published_at as "publishedAt", u.name as "authorName",
      coalesce(e.id = (select home_page_id from site_settings where site_id = ${siteId}), false)
        as "isHomePage"
    from entries e left join users u on u.id = e.author_id
    where e.site_id = ${siteId} and e.type = ${type} and e.status = 'published'
      and e.slug = ${slug}
  `,
  );
  if (!row) return null;
  const { blocks, blocksFormat, ...rest } = row;
  assertKnownFormat(slug, type, blocksFormat);
  return { ...rest, document: blocks };
}

/**
 * Every published page and post of a site, for its sitemap (item 17): newest
 * published first, at most 50,000 (the sitemap file's limit). `isHomePage` marks
 * the published page `site_settings.home_page_id` points at.
 */
export async function listSitemapEntries(
  siteId: string,
): Promise<{ type: EntryType; slug: string; updatedAt: Date; isHomePage: boolean }[]> {
  return inSite(
    siteId,
    (tx) => tx<{ type: EntryType; slug: string; updatedAt: Date; isHomePage: boolean }[]>`
    select e.type, e.slug, e.updated_at as "updatedAt",
      (e.type = 'page' and e.id = s.home_page_id) as "isHomePage"
    from entries e left join site_settings s on s.site_id = e.site_id
    where e.site_id = ${siteId} and e.status = 'published'
    order by e.published_at desc, e.slug
    limit 50000
  `,
  );
}

/**
 * The page an admin chose for `/` (item 9), or `null` when none is set, it is
 * not published, or it is not a page - `/` then shows a placeholder (D-2).
 * One query: the settings row joined to the entry, rather than a settings read
 * followed by an entry read on every public home request.
 */
export async function findHomePage(siteId: string): Promise<PublicPage | null> {
  const [row] = await inSite(
    siteId,
    (tx) => tx<(PublicEntryRow & { slug: string })[]>`
    select e.slug, e.title, e.blocks, e.blocks_format as "blocksFormat",
      e.published_at as "publishedAt", u.name as "authorName"
    from site_settings s
      join entries e on e.id = s.home_page_id and e.site_id = s.site_id
      left join users u on u.id = e.author_id
    where s.site_id = ${siteId} and e.type = 'page' and e.status = 'published'
  `,
  );
  if (!row) return null;
  const { blocks, blocksFormat, slug, ...page } = row;
  assertKnownFormat(slug, "page", blocksFormat);
  return { ...page, document: blocks };
}
