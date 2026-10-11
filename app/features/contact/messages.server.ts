import { inSite } from "#app/lib/db.server.ts";

export const MESSAGES_PAGE_SIZE = 20;

export type MessageRow = {
  id: string;
  name: string;
  email: string;
  message: string;
  createdAt: Date;
  readAt: Date | null;
  notifiedAt: Date | null;
  /** The title of the page it was sent from; null once that page is deleted. */
  entryTitle: string | null;
};

export type MessageList = { rows: MessageRow[]; total: number; totalPages: number };

/** Newest first. The caller redirects a page past `totalPages` to the last. */
export async function listMessages(siteId: string, page: number): Promise<MessageList> {
  const safePage = Math.max(1, Math.floor(page) || 1);
  // `Promise.all` inside `inSite` runs on one connection: queued, not concurrent.
  const [rows, totalRows] = await inSite(siteId, (tx) =>
    Promise.all([
      tx<MessageRow[]>`
        select c.id, c.name, c.email, c.message,
               c.created_at as "createdAt", c.read_at as "readAt",
               c.notified_at as "notifiedAt", e.title as "entryTitle"
        from contact_submissions c
        left join entries e on e.id = c.entry_id and e.site_id = c.site_id
        where c.site_id = ${siteId}
        order by c.created_at desc, c.id desc
        limit ${MESSAGES_PAGE_SIZE} offset ${(safePage - 1) * MESSAGES_PAGE_SIZE}
      `,
      tx<{ total: number }[]>`
        select count(*)::int as total from contact_submissions where site_id = ${siteId}
      `,
    ]),
  );
  const total = totalRows[0]?.total ?? 0;
  return {
    rows,
    total,
    totalPages: Math.max(1, Math.ceil(total / MESSAGES_PAGE_SIZE)),
  };
}

/**
 * Marks one message read (keeping the first read time) or unread. Returns
 * whether a row of this site matched - false for a stale id or another site's.
 */
export async function setMessageRead(siteId: string, id: string, read: boolean): Promise<boolean> {
  const rows = await inSite(
    siteId,
    (tx) => tx<{ id: string }[]>`
      update contact_submissions
      set read_at = case when ${read} then coalesce(read_at, now()) else null end
      where site_id = ${siteId} and id = ${id}
      returning id
    `,
  );
  return rows.length > 0;
}
