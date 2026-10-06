import type postgres from "postgres";
import { buildMediaUrl } from "#app/features/media/media-url.ts";
import { inSite } from "#app/lib/db.server.ts";
import { type NavItem, parseStoredNavigation } from "./navigation-input.ts";

export type SiteSettings = {
  siteTitle: string;
  logoMediaId: string | null;
  logoUrl: string | null;
  navigation: NavItem[];
  homePageId: string | null;
  siteDescription: string;
  language: string;
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
export async function getSiteSettings(siteId: string, r2PublicUrl: string): Promise<SiteSettings> {
  const [row] = await inSite(
    siteId,
    (tx) => tx<
      {
        siteTitle: string;
        logoMediaId: string | null;
        storageKey: string | null;
        navigation: unknown;
        homePageId: string | null;
        siteDescription: string;
        language: string;
      }[]
    >`
    select s.site_title as "siteTitle", s.logo_media_id as "logoMediaId",
      m.storage_key as "storageKey", s.navigation as "navigation",
      s.home_page_id as "homePageId", s.site_description as "siteDescription",
      s.language as "language"
    from site_settings s
    left join media m on m.id = s.logo_media_id and m.site_id = s.site_id
    where s.site_id = ${siteId}
  `,
  );
  return {
    siteTitle: row.siteTitle,
    logoMediaId: row.logoMediaId,
    logoUrl: row.storageKey ? buildMediaUrl(r2PublicUrl, row.storageKey) : null,
    navigation: parseStoredNavigation(row.navigation),
    homePageId: row.homePageId,
    siteDescription: row.siteDescription,
    language: row.language,
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
  siteId: string,
  input: { siteTitle: string; logoMediaId: string | null },
): Promise<void> {
  await tx`
    update site_settings
    set site_title = ${input.siteTitle}, logo_media_id = ${input.logoMediaId}, updated_at = now()
    where site_id = ${siteId}
  `;
}

/**
 * A sibling of `updateSiteIdentity`, not a merged `updateSiteSettings`
 * (F-40's split, restated in this item's own notes) - each function still
 * touches only the column it owns.
 */
async function updateNavigation(
  tx: postgres.TransactionSql,
  siteId: string,
  items: NavItem[],
): Promise<void> {
  await tx`
    update site_settings set navigation = ${tx.json(items)}, updated_at = now()
    where site_id = ${siteId}
  `;
}

/** Another F-40 sibling: only `home_page_id`. `null` means no home page (item 9's D-1). */
async function updateHomePage(
  tx: postgres.TransactionSql,
  siteId: string,
  pageId: string | null,
): Promise<void> {
  await tx`
    update site_settings set home_page_id = ${pageId}, updated_at = now()
    where site_id = ${siteId}
  `;
}

/** Another F-40 sibling: only the site's description and language (item 17). */
async function updateSeoDefaults(
  tx: postgres.TransactionSql,
  siteId: string,
  input: { siteDescription: string; language: string },
): Promise<void> {
  await tx`
    update site_settings
    set site_description = ${input.siteDescription}, language = ${input.language},
      updated_at = now()
    where site_id = ${siteId}
  `;
}

export type SaveSettingsResult = "saved" | "logo-gone" | "home-page-gone";

/**
 * The settings form's Save, all or nothing (item 9's D-11). The action checks
 * the logo and home page exist first, but either can be deleted between that
 * check and these writes; its foreign key then refuses the write, the whole
 * save rolls back, and the caller gets which one went instead of a 500 over a
 * half-saved row (F-106, F-110).
 */
export async function saveSiteSettings(
  siteId: string,
  input: {
    siteTitle: string;
    logoMediaId: string | null;
    homePageId: string | null;
    navigation: NavItem[];
    siteDescription: string;
    language: string;
  },
): Promise<SaveSettingsResult> {
  try {
    await inSite(siteId, async (tx) => {
      await updateSiteIdentity(tx, siteId, input);
      await updateHomePage(tx, siteId, input.homePageId);
      await updateNavigation(tx, siteId, input.navigation);
      await updateSeoDefaults(tx, siteId, input);
    });
    return "saved";
  } catch (error) {
    if (isForeignKeyViolation(error, "site_settings_logo_media_id_fkey")) return "logo-gone";
    if (isForeignKeyViolation(error, "site_settings_home_page_id_fkey")) return "home-page-gone";
    throw error;
  }
}

const FOREIGN_KEY_VIOLATION = "23503";

export function isForeignKeyViolation(error: unknown, constraint: string): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    error.code === FOREIGN_KEY_VIOLATION &&
    "constraint_name" in error &&
    error.constraint_name === constraint
  );
}
