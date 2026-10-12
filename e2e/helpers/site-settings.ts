import { siteOneId } from "./sites.ts";
import { withDatabase } from "./users.ts";

const DEFAULT_SITE_TITLE = "Habre CMS";

/**
 * `site_settings` is a true singleton (item 7a) - unlike `entries` or
 * `media`, no test can scope its own row away from another's. `public-site
 * .spec.ts` and `smoke.spec.ts` both assert the literal default title, so
 * every test here that changes it restores this default immediately after
 * its own assertions, not only on success - this is the `afterEach` backstop
 * for the case where a test fails partway through. `navigation` joined this
 * reset in item 7b, the first item to write it - the same tests assert an
 * empty header `<nav>` by default, so a menu left over from a failed test
 * would break them the same way a leftover title would.
 */
export function resetSiteSettings(): Promise<void> {
  return withDatabase(async (sql) => {
    const siteId = await siteOneId();
    await sql`update site_settings set site_title = ${DEFAULT_SITE_TITLE}, logo_media_id = null, navigation = '[]'::jsonb, home_page_id = null where site_id = ${siteId}`;
  });
}

/** Switches a site's editing level, for the specs that visit Users (item 20: Pro only). */
export function setSiteLevel(siteId: string, level: "simple" | "pro"): Promise<void> {
  return withDatabase(async (sql) => {
    await sql`update site_settings set level = ${level} where site_id = ${siteId}`;
  });
}
