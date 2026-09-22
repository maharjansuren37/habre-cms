import type { Role } from "#app/features/users/roles.ts";
import { sql } from "#app/lib/db.server.ts";

// A grid page. Comfortably below the quality bar's scale (a few thousand
// media files -> a few hundred pages).
export const MEDIA_PAGE_SIZE = 24;

export type Media = {
  id: string;
  storageKey: string;
  filename: string;
  mimeType: string;
  byteSize: number;
  width: number;
  height: number;
  altText: string;
  uploadedBy: string;
  uploadedByName: string;
  createdAt: Date;
};

/** Who is asking. Ownership is decided from this, never from the form. */
export type Actor = { id: string; role: Role };

const mediaColumns = sql`
  m.id, m.storage_key as "storageKey", m.filename, m.mime_type as "mimeType",
  m.byte_size as "byteSize", m.width, m.height, m.alt_text as "altText",
  m.uploaded_by as "uploadedBy", u.name as "uploadedByName", m.created_at as "createdAt"
`;

export type NewMedia = {
  storageKey: string;
  filename: string;
  mimeType: string;
  byteSize: number;
  width: number;
  height: number;
  altText: string;
};

/**
 * Written once, at upload - nothing in this item edits a media row afterward.
 * The caller redirects to the list on success, which re-queries `listMedia`
 * for the full joined row - so this returns only the id.
 */
export async function insertMedia(input: NewMedia, uploadedBy: string): Promise<{ id: string }> {
  const [row] = await sql<{ id: string }[]>`
    insert into media ${sql({
      storage_key: input.storageKey,
      filename: input.filename,
      mime_type: input.mimeType,
      byte_size: input.byteSize,
      width: input.width,
      height: input.height,
      alt_text: input.altText,
      uploaded_by: uploadedBy,
    })}
    returning id
  `;
  return row;
}

export type MediaList = { media: Media[]; total: number; totalPages: number };

/**
 * Every role sees every file - the plan's "media library to reuse them"
 * requires seeing what other people uploaded, not just your own (spec's
 * Decisions). Only deletion is ownership-scoped (deleteMedia).
 */
export async function listMedia(page: number): Promise<MediaList> {
  const [rows, totalRows] = await Promise.all([
    sql<Media[]>`
      select ${mediaColumns}
      from media m join users u on u.id = m.uploaded_by
      order by m.created_at desc
      limit ${MEDIA_PAGE_SIZE} offset ${(page - 1) * MEDIA_PAGE_SIZE}
    `,
    sql<{ total: number }[]>`select count(*)::int as total from media`,
  ]);
  const total = totalRows[0]?.total ?? 0;
  return {
    media: rows,
    total,
    totalPages: Math.max(1, Math.ceil(total / MEDIA_PAGE_SIZE)),
  };
}

export type MediaSummaryRow = {
  id: string;
  storageKey: string;
  altText: string;
  width: number;
  height: number;
};

/**
 * Every image block a post references, resolved in one query - not one per
 * block. Unscoped by actor, matching `listMedia`'s own rule (every
 * signed-in role sees every upload, D54). An id with no matching row is
 * simply absent from the result; the caller (the loader) treats that as
 * "no longer available" rather than an error.
 */
export async function findMediaByIds(ids: string[]): Promise<MediaSummaryRow[]> {
  if (ids.length === 0) return [];
  return sql<MediaSummaryRow[]>`
    select id, storage_key as "storageKey", alt_text as "altText", width, height
    from media
    where id = any(${ids})
  `;
}

/**
 * One file, scoped for the delete-confirmation screen only - an author gets
 * `null` for someone else's upload, the same answer a missing id gets
 * (`findEntryForUser`'s rule: existence stays private to who cannot act on
 * it). Everyone can still see the file in `listMedia`'s shared grid; only the
 * confirm-then-delete path is ownership-scoped.
 */
export async function findMediaForUser(id: string, actor: Actor): Promise<Media | null> {
  const [row] = await sql<Media[]>`
    select ${mediaColumns}
    from media m join users u on u.id = m.uploaded_by
    where m.id = ${id} ${ownedBy(actor)}
  `;
  return row ?? null;
}

/** Authors delete only their own uploads; editors and admins delete any. */
function ownedBy(actor: Actor) {
  return actor.role === "author" ? sql`and m.uploaded_by = ${actor.id}` : sql``;
}

/**
 * The deleted file's own storage key and filename, for the caller to remove
 * the R2 object (row first, per the plan's data rule) and announce the
 * success banner - or `null` when there was nothing this actor could delete
 * (not found, or not theirs).
 */
export async function deleteMedia(
  id: string,
  actor: Actor,
): Promise<{ storageKey: string; filename: string } | null> {
  const [row] = await sql<{ storageKey: string; filename: string }[]>`
    delete from media m where m.id = ${id} ${ownedBy(actor)}
    returning m.storage_key as "storageKey", m.filename
  `;
  return row ?? null;
}
