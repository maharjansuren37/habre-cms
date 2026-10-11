import { inSite } from "#app/lib/db.server.ts";

export type NewContactSubmission = {
  entryId: string;
  name: string;
  email: string;
  message: string;
};

/**
 * The public path of a published entry of this site, or null when the entry is
 * a draft, missing or another site's. Same rules as the sitemap: the home page
 * is `/` (never also at its slug), a page is `/<slug>`, a post `/posts/<slug>`.
 */
export async function findPublishedEntryPath(
  siteId: string,
  entryId: string,
): Promise<string | null> {
  const [row] = await inSite(
    siteId,
    (tx) => tx<{ type: "page" | "post"; slug: string; isHomePage: boolean }[]>`
      select e.type, e.slug,
        coalesce(e.type = 'page' and e.id = s.home_page_id, false) as "isHomePage"
      from entries e left join site_settings s on s.site_id = e.site_id
      where e.site_id = ${siteId} and e.id = ${entryId} and e.status = 'published'
    `,
  );
  if (!row) return null;
  if (row.isHomePage) return "/";
  return row.type === "post" ? `/posts/${row.slug}` : `/${row.slug}`;
}

export async function insertContactSubmission(
  siteId: string,
  submission: NewContactSubmission,
): Promise<void> {
  await inSite(siteId, async (tx) => {
    await tx`
      insert into contact_submissions (site_id, entry_id, name, email, message)
      values (${siteId}, ${submission.entryId}, ${submission.name}, ${submission.email},
        ${submission.message})
    `;
  });
}
