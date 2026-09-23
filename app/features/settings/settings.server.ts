import { buildMediaUrl } from "#app/features/media/media-url.ts";
import { sql } from "#app/lib/db.server.ts";
import type { NavItem } from "./navigation-input.ts";

export type SiteSettings = {
  siteTitle: string;
  logoMediaId: string | null;
  logoUrl: string | null;
  navigation: NavItem[];
};

/**
 * The one `site_settings` row, with the logo's URL resolved the same way a
 * post's image blocks are (5c's `buildMediaUrl`) - never stored, so a bucket
 * or domain change never touches this row. `logoUrl` is `null` both when no
 * logo is set and when the referenced media row is gone - the foreign key
 * (`on delete set null`) means the second case cannot actually happen, but
 * the type still allows it rather than asserting a guarantee this function
 * does not itself enforce. `navigation` is returned as stored - item 7a
 * created and reserved the column, this item is the first to read it.
 */
export async function getSiteSettings(r2PublicUrl: string): Promise<SiteSettings> {
  const [row] = await sql<
    {
      siteTitle: string;
      logoMediaId: string | null;
      storageKey: string | null;
      navigation: NavItem[];
    }[]
  >`
    select s.site_title as "siteTitle", s.logo_media_id as "logoMediaId",
      m.storage_key as "storageKey", s.navigation as "navigation"
    from site_settings s left join media m on m.id = s.logo_media_id
    where s.id = 1
  `;
  return {
    siteTitle: row.siteTitle,
    logoMediaId: row.logoMediaId,
    logoUrl: row.storageKey ? buildMediaUrl(r2PublicUrl, row.storageKey) : null,
    navigation: row.navigation,
  };
}

/**
 * Touches only the two columns this item owns - `navigation` gets its own
 * `updateNavigation` in 7b, matching `saveEntry`'s split from `updateDraft`
 * (F-40): a function scoped to what it actually updates, not a growing
 * do-everything `updateSiteSettings`.
 */
export async function updateSiteIdentity(input: {
  siteTitle: string;
  logoMediaId: string | null;
}): Promise<void> {
  await sql`
    update site_settings
    set site_title = ${input.siteTitle}, logo_media_id = ${input.logoMediaId}, updated_at = now()
    where id = 1
  `;
}

/**
 * A sibling of `updateSiteIdentity`, not a merged `updateSiteSettings`
 * (F-40's split, restated in this item's own notes) - the settings form's
 * Save action calls both, but each function still touches only the column
 * it owns.
 */
export async function updateNavigation(items: NavItem[]): Promise<void> {
  await sql`
    update site_settings set navigation = ${sql.json(items)}, updated_at = now() where id = 1
  `;
}
