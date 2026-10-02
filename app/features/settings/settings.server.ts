import type postgres from "postgres";
import { buildMediaUrl } from "#app/features/media/media-url.ts";
import { sql } from "#app/lib/db.server.ts";
import { type NavItem, parseStoredNavigation } from "./navigation-input.ts";

export type SiteSettings = {
  siteTitle: string;
  logoMediaId: string | null;
  logoUrl: string | null;
  navigation: NavItem[];
  homePageId: string | null;
};

/**
 * The one `site_settings` row, with the logo's URL resolved the same way a
 * post's image blocks are (5c's `buildMediaUrl`) - never stored, so a bucket
 * or domain change never touches this row. `logoUrl` is `null` both when no
 * logo is set and when the referenced media row is gone - the foreign key
 * (`on delete set null`) means the second case cannot actually happen, but
 * the type still allows it rather than asserting a guarantee this function
 * does not itself enforce. `navigation` is parsed on the way out; a malformed
 * value reads as an empty menu (F-96).
 */
export async function getSiteSettings(r2PublicUrl: string): Promise<SiteSettings> {
  const [row] = await sql<
    {
      siteTitle: string;
      logoMediaId: string | null;
      storageKey: string | null;
      navigation: unknown;
      homePageId: string | null;
    }[]
  >`
    select s.site_title as "siteTitle", s.logo_media_id as "logoMediaId",
      m.storage_key as "storageKey", s.navigation as "navigation",
      s.home_page_id as "homePageId"
    from site_settings s left join media m on m.id = s.logo_media_id
    where s.id = 1
  `;
  return {
    siteTitle: row.siteTitle,
    logoMediaId: row.logoMediaId,
    logoUrl: row.storageKey ? buildMediaUrl(r2PublicUrl, row.storageKey) : null,
    navigation: parseStoredNavigation(row.navigation),
    homePageId: row.homePageId,
  };
}

/**
 * Touches only the two columns this item owns - `navigation` gets its own
 * `updateNavigation` in 7b, matching `saveEntry`'s split from `updateDraft`
 * (F-40): a function scoped to what it actually updates, not a growing
 * do-everything `updateSiteSettings`. Run only inside `saveSiteSettings`'s
 * transaction, as are its two siblings below.
 */
async function updateSiteIdentity(
  tx: postgres.TransactionSql,
  input: { siteTitle: string; logoMediaId: string | null },
): Promise<void> {
  await tx`
    update site_settings
    set site_title = ${input.siteTitle}, logo_media_id = ${input.logoMediaId}, updated_at = now()
    where id = 1
  `;
}

/**
 * A sibling of `updateSiteIdentity`, not a merged `updateSiteSettings`
 * (F-40's split, restated in this item's own notes) - each function still
 * touches only the column it owns.
 */
async function updateNavigation(tx: postgres.TransactionSql, items: NavItem[]): Promise<void> {
  await tx`
    update site_settings set navigation = ${tx.json(items)}, updated_at = now() where id = 1
  `;
}

/** Another F-40 sibling: only `home_page_id`. `null` means no home page (item 9's D-1). */
async function updateHomePage(tx: postgres.TransactionSql, pageId: string | null): Promise<void> {
  await tx`update site_settings set home_page_id = ${pageId}, updated_at = now() where id = 1`;
}

export type SaveSettingsResult = "saved" | "logo-gone" | "home-page-gone";

/**
 * The settings form's Save, all or nothing (item 9's D-11). The action checks
 * the logo and home page exist first, but either can be deleted between that
 * check and these writes; its foreign key then refuses the write, the whole
 * save rolls back, and the caller gets which one went instead of a 500 over a
 * half-saved row (F-106, F-110).
 */
export async function saveSiteSettings(input: {
  siteTitle: string;
  logoMediaId: string | null;
  homePageId: string | null;
  navigation: NavItem[];
}): Promise<SaveSettingsResult> {
  try {
    await sql.begin(async (tx) => {
      await updateSiteIdentity(tx, input);
      await updateHomePage(tx, input.homePageId);
      await updateNavigation(tx, input.navigation);
    });
    return "saved";
  } catch (error) {
    if (isForeignKeyViolation(error, "site_settings_logo_media_id_fkey")) return "logo-gone";
    if (isForeignKeyViolation(error, "site_settings_home_page_id_fkey")) return "home-page-gone";
    throw error;
  }
}

const FOREIGN_KEY_VIOLATION = "23503";

function isForeignKeyViolation(error: unknown, constraint: string): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    error.code === FOREIGN_KEY_VIOLATION &&
    "constraint_name" in error &&
    error.constraint_name === constraint
  );
}
