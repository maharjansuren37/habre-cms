import type postgres from "postgres";
import { parseBrandColor } from "#app/features/brand/brand-colours.ts";
import { mediaSources } from "#app/features/media/media-objects.ts";
import { inSite } from "#app/lib/db.server.ts";
import { type NavItem, parseStoredNavigation } from "./navigation-input.ts";
import { readSiteLevel, type SiteLevel } from "./site-level.ts";

export type SiteSettings = {
  siteTitle: string;
  logoMediaId: string | null;
  logoUrl: string | null;
  /** The logo's colours, most-used first; `[]` with no logo. */
  logoColours: string[];
  navigation: NavItem[];
  homePageId: string | null;
  siteDescription: string;
  language: string;
  /** `''` (neutral ink) or `#rrggbb`. */
  brandColor: string;
  stylePreset: StylePreset;
  /** Where contact messages are emailed; `""` means every admin of the site. */
  contactNotifyEmail: string;
  level: SiteLevel;
  /** Whether public pages follow the visitor's dark setting; applies at every level. */
  darkMode: boolean;
};

export type StylePreset = "classic" | "modern" | "friendly";

/** Just the level - what the admin shell and the editor need on every request. */
export async function getSiteLevel(siteId: string): Promise<SiteLevel> {
  const [row] = await inSite(
    siteId,
    (tx) => tx<{ level: string }[]>`select level from site_settings where site_id = ${siteId}`,
  );
  return readSiteLevel(row?.level);
}

/** Just the brand - what the editor's canvas needs, without the logo and menu. */
export async function getSiteBrand(
  siteId: string,
): Promise<{ brandColor: string; stylePreset: StylePreset }> {
  const [row] = await inSite(
    siteId,
    (tx) => tx<{ brandColor: string; stylePreset: string }[]>`
      select brand_color as "brandColor", style_preset as "stylePreset"
      from site_settings where site_id = ${siteId}
    `,
  );
  return {
    brandColor: parseBrandColor(row.brandColor),
    stylePreset: readStylePreset(row.stylePreset),
  };
}

function readStylePreset(value: string): StylePreset {
  return value === "classic" || value === "friendly" ? value : "modern";
}

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
        variantWidths: number[] | null;
        colours: string[] | null;
        navigation: unknown;
        homePageId: string | null;
        siteDescription: string;
        language: string;
        brandColor: string;
        stylePreset: string;
        contactNotifyEmail: string | null;
        level: string;
        darkMode: boolean;
      }[]
    >`
    select s.site_title as "siteTitle", s.logo_media_id as "logoMediaId",
      m.storage_key as "storageKey", m.variant_widths as "variantWidths", m.colours as "colours", s.navigation as "navigation",
      s.home_page_id as "homePageId", s.site_description as "siteDescription",
      s.language as "language", s.brand_color as "brandColor", s.style_preset as "stylePreset",
      s.contact_notify_email as "contactNotifyEmail", s.level as "level",
      s.dark_mode as "darkMode"
    from site_settings s
    left join media m on m.id = s.logo_media_id and m.site_id = s.site_id
    where s.site_id = ${siteId}
  `,
  );
  return {
    siteTitle: row.siteTitle,
    logoMediaId: row.logoMediaId,
    logoUrl: row.storageKey
      ? mediaSources(r2PublicUrl, { storageKey: row.storageKey, variantWidths: row.variantWidths })
          .thumbnail
      : null,
    logoColours: row.colours ?? [],
    navigation: parseStoredNavigation(row.navigation),
    homePageId: row.homePageId,
    siteDescription: row.siteDescription,
    language: row.language,
    // Parsed again on the way out: this text ends up in a page's `<style>` (D171).
    brandColor: parseBrandColor(row.brandColor),
    stylePreset: readStylePreset(row.stylePreset),
    contactNotifyEmail: row.contactNotifyEmail ?? "",
    level: readSiteLevel(row.level),
    darkMode: row.darkMode,
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

/** Another F-40 sibling: only where contact messages are emailed (item 19c); blank is null. */
async function updateContactNotifyEmail(
  tx: postgres.TransactionSql,
  siteId: string,
  address: string,
): Promise<void> {
  await tx`
    update site_settings
    set contact_notify_email = ${address === "" ? null : address}, updated_at = now()
    where site_id = ${siteId}
  `;
}

/** Another F-40 sibling: only the brand colour and style preset (item 18a1). */
async function updateBrand(
  tx: postgres.TransactionSql,
  siteId: string,
  input: { brandColor: string; stylePreset: StylePreset },
): Promise<void> {
  await tx`
    update site_settings
    set brand_color = ${input.brandColor}, style_preset = ${input.stylePreset}, updated_at = now()
    where site_id = ${siteId}
  `;
}

/** Another F-40 sibling: only the editing level and dark mode (item 20). */
async function updateLook(
  tx: postgres.TransactionSql,
  siteId: string,
  input: { level: SiteLevel; darkMode: boolean },
): Promise<void> {
  await tx`
    update site_settings
    set level = ${input.level}, dark_mode = ${input.darkMode}, updated_at = now()
    where site_id = ${siteId}
  `;
}

/**
 * What "Use this draft" writes (18b4a), in the caller's transaction: only the
 * fields that are not `null`, so a description or colour the person already set
 * is left alone. The menu and the home page are always replaced.
 */
export async function applyDraftSettingsIn(
  tx: postgres.TransactionSql,
  siteId: string,
  input: {
    navigation: NavItem[];
    homePageId: string;
    siteDescription: string | null;
    brandColor: string | null;
  },
): Promise<void> {
  await updateNavigation(tx, siteId, input.navigation);
  await updateHomePage(tx, siteId, input.homePageId);
  if (input.siteDescription !== null) {
    await tx`
      update site_settings set site_description = ${input.siteDescription}, updated_at = now()
      where site_id = ${siteId}
    `;
  }
  if (input.brandColor !== null) {
    await tx`
      update site_settings set brand_color = ${input.brandColor}, updated_at = now()
      where site_id = ${siteId}
    `;
  }
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
    /** `""` for every admin of the site. */
    contactNotifyEmail: string;
    /** Absent leaves both columns as they are (a form from before the Brand section). */
    brand?: { brandColor: string; stylePreset: StylePreset };
    /** Absent leaves both columns as they are (a form from before item 20). */
    look?: { level: SiteLevel; darkMode: boolean };
  },
): Promise<SaveSettingsResult> {
  try {
    await inSite(siteId, async (tx) => {
      await updateSiteIdentity(tx, siteId, input);
      await updateHomePage(tx, siteId, input.homePageId);
      await updateNavigation(tx, siteId, input.navigation);
      await updateSeoDefaults(tx, siteId, input);
      await updateContactNotifyEmail(tx, siteId, input.contactNotifyEmail);
      if (input.brand) await updateBrand(tx, siteId, input.brand);
      if (input.look) await updateLook(tx, siteId, input.look);
    });
    return "saved";
  } catch (error) {
    if (isForeignKeyViolation(error, "site_settings_logo_media_id_fkey")) return "logo-gone";
    if (isForeignKeyViolation(error, "site_settings_home_page_id_fkey")) return "home-page-gone";
    throw error;
  }
}

/**
 * Onboarding step 3's Finish (18b5): the logo, brand colour and style in one
 * transaction. The action checks the logo is this site's media first; if it is
 * deleted in between, the foreign key refuses the write and nothing is saved.
 */
export async function saveBrandStep(
  siteId: string,
  input: { logoMediaId: string | null; brandColor: string; stylePreset: StylePreset },
): Promise<"saved" | "logo-gone"> {
  try {
    await inSite(siteId, async (tx) => {
      await tx`
        update site_settings
        set logo_media_id = ${input.logoMediaId}, brand_color = ${input.brandColor},
          style_preset = ${input.stylePreset}, updated_at = now()
        where site_id = ${siteId}
      `;
    });
    return "saved";
  } catch (error) {
    if (isForeignKeyViolation(error, "site_settings_logo_media_id_fkey")) return "logo-gone";
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
