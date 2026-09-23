# Feature: Navigation menu

**From build plan:** item 7b (split from item 7, "Site settings and menu" -
7a shipped the title and logo; this is the second and final sub-item)
**Type:** Feature
**Status:** shipped 2026-09-23

## Goal

An admin can build an ordered list of navigation links - each pointing at an
existing page or a plain web address - from `/admin/settings`, and that list
renders as a menu in the public site's header.

## In scope

- Validating and storing nav items in the `navigation` column `0005_site_settings.sql`
  already created and reserved (item 7a) - no new migration.
- A navigation editor on `/admin/settings`: add an item, remove one, reorder
  with move-up/move-down, each item picking either an existing page (from a
  dropdown) or typing a web address - then Save persists title, logo and
  navigation together in one form, matching the screen 7a already built.
- Rendering the saved list as a `<nav>` in the public header
  (`public-site/layout.tsx`'s `Chrome`), in order, links only.
- Reusing the existing link allowlist (`isSafeHref`) for the web-address
  option - no new scheme rules.

## Out of scope

- Drag-and-drop reordering (needs client JS; move-up/move-down works without
  it, matching D10). A future item can add drag-and-drop as a JS enhancement
  over the same server actions if this ever feels slow to use.
- Linking directly to a post. The plan's own data shape is `{label, pageId |
  url}` - a post is still reachable by typing its `/posts/:slug` address in
  the web-address field, same as any other path.
- Nested/multi-level menus, per-item icons, and a separate footer menu -
  `design.md`'s only mention of a menu is in the header.
- Any change to `entries`, `media`, or `users`.

## Design reference

Not in `prototype`'s mockups (predates this item, like every screen since
5a). Build the editor from the existing conventions already on
`/admin/settings`: bordered form, `Field`/`Button`, the success/error
`Message` banner. The public nav itself has no prior reference - it is new
visual surface in the header - so Step 3 measures its contrast against
`--color-bg` (the header's background) the way 2b measured the inline
toolbar and 7a measured the settings screen, and records it in `design.md`
rather than assuming the existing link/focus tokens transfer unmeasured.

## Build steps

- [x] **Step 1 - Data and validation** - `app/features/settings/navigation-input.ts`:
  a `NavItem` type (`{ label: string } & ({ pageId: string } | { url: string })`,
  matching the plan's own shape) and `navigationSchema` (`z.array(...).max(20)`
  - label 1-100 chars via `isStorableText`, `pageId` a UUID, `url` checked
  with the existing `isSafeHref` from `inline-runs.ts` - reused directly, not
  reimplemented). `app/features/content/entries.server.ts` gains
  `listPagesForNav()` (every page, any status, `{id, title, slug, status}`,
  ordered by title - feeds both the admin dropdown and the save-time
  existence check) and `findPublishedPageSlugs(ids)` (published only,
  `{id, slug}` - feeds the public render). `settings.server.ts`: extend
  `SiteSettings`/`getSiteSettings` to also select and return the raw
  `navigation` column (same row, no new query), and add
  `updateNavigation(items: NavItem[])` touching only that column - a sibling
  of `updateSiteIdentity`, not a merged `updateSiteSettings` (matches 7a's
  own note, F-40's split). *Done when:* unit tests cover a valid page item, a
  valid URL item, an empty label, a `javascript:` URL rejected by the reused
  `isSafeHref`, and more than 20 items rejected.

- [x] **Step 2 - Navigation editor on `/admin/settings`** - `settings.tsx`'s
  form grows a "Navigation" section: each row shows the label field, a page
  dropdown (from `listPagesForNav()`, a blank "No page" option first) and a
  web-address field: exactly one of the two must be filled per item; both or
  neither is a validation error. "Add item", "Remove" (per row), "Move up"/
  "Move down" (per row, disabled at the ends) are submit buttons on the same
  `<Form>`, each with its own `intent` value - matching the project's
  existing `intent`-keyed action pattern (D42). Add/remove/move intents only
  reshape and re-render the draft (no database write); `intent=save`
  validates with Step 1's schema (rejecting an item whose `pageId` no longer
  matches `listPagesForNav()`, the same "choose it again" pattern F-89
  already established for the logo) and calls both `updateSiteIdentity` and
  `updateNavigation`, then redirects back with the existing success banner.
  A row whose page is not currently published shows a small inline note
  ("not published - hidden from visitors") rather than staying silent about
  it. Every button gets a real accessible name (e.g. "Move Contact up", not
  just "Move up") and is keyboard-operable. *Done when:* with no JavaScript,
  an admin can add two items (one page, one URL), reorder them, remove one,
  and save - each step is a normal form submit and the page still works;
  saving is measured against `quality-bar.md`'s admin-save bar (< 1 s p95).

- [x] **Step 3 - Render the menu on the public site** - `public-site/layout.tsx`'s
  loader resolves the saved navigation after reading `getSiteSettings`:
  collect the `pageId`s, call `findPublishedPageSlugs`, and build the final
  `{label, href}` list - a `url` item passes through as-is, a `pageId` item
  becomes `/${slug}` if its page is published, or is silently dropped if it
  is not (deleted or unpublished) - matching the image block's own
  degrade-silently precedent (D61), not a new rule. `Chrome` renders a
  `<nav aria-label="Site">` next to the site title, empty list renders no
  `<nav>` at all. Measure link contrast (default, hover, focus) against the
  header background in both themes and record it in `design.md`, replacing
  its "navigation menu itself is item 7b, not yet built" note. *Done when:*
  a saved page link and a saved URL link both render and work on `/`; unpublishing
  the linked page removes it from the header on the next load with no error;
  the public page load stays within `quality-bar.md`'s < 500 ms p95.

- [x] **Step 4 - Browser tests** - extend `e2e/manage-settings.spec.ts` (or a
  new `e2e/site-navigation.spec.ts`, mirroring `manage-pages.spec.ts`'s
  shape if the settings file is getting long): an admin adds a page-link item
  and a URL item, saves, and sees both - in order - in the public header;
  removing one and reordering the other are each reflected after a save.
  `e2e/helpers/site-settings.ts`'s `resetSiteSettings` also resets
  `navigation` back to `'[]'`, since it is the same unscoped singleton row
  `public-site.spec.ts`/`smoke.spec.ts` already depend on staying at its
  default. *Done when:* the new test(s) pass and the full suite (`npm run
  test:e2e`) still passes.

- [x] **Step 5 - Repair F-94** - the settings form now has many `type="submit"`
  buttons (each row's Move up/Move down/Remove, then Add item, then Save), so
  pressing Enter in a text field targets whichever is first in DOM order, not
  Save - confirmed live: with a row present it lands on that row's own
  (disabled) "Move up", so Enter does nothing; with none present it lands on
  "Add item", so Enter appends a blank row instead of saving. Add a hidden
  default submit button (`intent=save`, `visually-hidden`, `tabIndex={-1}`,
  `aria-hidden`) as the first focusable descendant of the `<Form>`, so
  implicit submission always saves regardless of what else is in the form -
  the standard fix for "several submit buttons, one intended default." *Done
  when:* typing a new site title and pressing Enter saves it (the banner
  shows and the title persists on reload), both with at least one nav row
  present and with none.

## Files and areas

- New: `app/features/settings/navigation-input.ts`,
  `app/features/settings/navigation-input.test.ts`, possibly
  `e2e/site-navigation.spec.ts`
- Changed: `app/features/settings/settings.server.ts`,
  `app/features/settings/settings.tsx` (+ `settings.module.css`),
  `app/features/content/entries.server.ts`,
  `app/features/public-site/layout.tsx` (+ `layout.module.css`),
  `e2e/manage-settings.spec.ts`, `e2e/helpers/site-settings.ts`,
  `blueprint/context/design.md`, `blueprint/context/needs-you.md`

## Data and contracts

- **No migration.** `navigation jsonb not null default '[]'` already exists
  on `site_settings` (0005, item 7a) - this item is the first to read or
  write it.
- **`NavItem`** (locked here): `{ label: string } & ({ pageId: string } |
  { url: string })`. Stored exactly as the plan describes it -
  `{label, pageId | url}` - discriminated by which key is present, no added
  `kind` field.
- **`pageId` is checked to exist at save time** (any status) but **not** a
  real foreign key - like an image block's `mediaId` (D60/D61), not like
  `logo_media_id` (a real column with `on delete set null`). A page deleted
  after being added to the menu degrades the same way an image does: dropped
  silently at render, not an error.
- **`url` reuses `isSafeHref` from `inline-runs.ts` unchanged** - same
  scheme allowlist (`http`, `https`, `mailto`, site-relative `/path`,
  `#fragment`), same 2,048-character cap. No second allowlist to keep in
  sync with D30's.
- **Cap: 20 items, 100-character labels** - a menu, not a sitemap; keeps the
  editor's own diff and the header's layout bounded.

## Testing

- Unit: `navigation-input.test.ts` (Step 1's cases above).
- Browser: Step 4's scenario, run as part of `npm run test:e2e`.
- No unit test can reach `updateNavigation`/`listPagesForNav`/
  `findPublishedPageSlugs` without a database (same as every other
  `*.server.ts` function in this project) - covered by the browser test
  instead, consistent with how `entries.server.ts` and `settings.server.ts`
  are already tested.

## Decisions

- **Reorder is move-up/move-down, not drag-and-drop** - keeps the editor
  working with no JavaScript (D10), matching the project's existing
  progressive-enhancement stance. Beats a drag handle, which would need
  client script and a fallback anyway.
- **Add/remove/move are re-render-only intents on the same form Save
  persists** - no separate "draft" storage, no second table. Beats a
  JS-driven local list state, which would leave the no-JS path unable to add
  or remove a row at all.
- **A row needs exactly one of page or URL, not a type toggle field** -
  avoids needing JS to show/hide the "other" input based on a radio choice;
  simplicity over slightly tighter validation. Beats adding a `kind` radio
  that would have to render both fields anyway to work without JS.
- **`pageId` existence is checked at save; publish status is checked at
  render** - mirrors the image block's own split (D60 exists-check at
  save-adjacent time / D61 silent degrade at render) rather than inventing a
  new rule for this table.
- **A row left completely untouched (no label, no page, no URL) is dropped
  silently at save, not treated as a validation error** - settled during
  Step 2, not stated by the spec. An admin who clicks "Add item" and changes
  their mind should not be forced to also click "Remove"; the "choose a page
  or type a web address" error is reserved for a row that has a label but no
  target, which is the case that actually signals a half-finished item.
- **The public header renders every nav link as a plain `<a>`, not React
  Router's `<Link>`** - settled during Step 3. A `pageId` item's href is a
  known internal path, but a `url` item's is whatever the admin typed
  (external, `mailto:`, a fragment), and the resolved list mixes both without
  keeping the distinction around; `<a>` is correct for all of them, `<Link>`
  only for some.

## Notes

- Reuse `isSafeHref` and `isStorableText` from `#app/features/blocks/inline-runs.ts`
  directly - do not copy them into `navigation-input.ts`.
- `updateSiteIdentity` and `updateNavigation` stay two functions even though
  Step 2's Save action calls both - matches 7a's own recorded intent (its
  `settings.server.ts` comment already says so).
- Widen `needs-you.md`'s existing "screen-reader and keyboard pass over
  `/admin/login` and the admin shell" line to include the navigation editor,
  and its "public site" line to include the new header `<nav>` - same
  pattern every prior item used when it grew one of those two screens.

## Findings

### 07b/F-94 [P2] closed - Pressing Enter on `/admin/settings` either does nothing or silently adds a blank menu item instead of saving

**File:** app/features/settings/settings.tsx:198-282 (the nav row Move up/Move down/Remove buttons, all `type="submit"`, rendered before the "Add item" and "Save" buttons)
**Found:** 2026-09-23 by review (scope: changed, item 7b; lens: quality) - confirmed live, not a hypothesis
**Why it matters:** The form now has many `type="submit"` buttons - each row's Move up/Move down/Remove, then Add item, then Save - and HTML's implicit-submission rule (pressing Enter in a single-line text field) always targets the **first** submit button in tree order, not the one visually last or most obviously "the" save action. Confirmed with the running app (production build, JS on): with at least one nav row present, the first submit button in the DOM is that row's own "Move up" button - which is `disabled` whenever it is row 0 - and per the HTML spec a disabled default button makes implicit submission do nothing at all. Typing a new site title and pressing Enter: no request fires, no banner, the title is silently not saved. With **no** rows present, the first (and only) submit button is "Add item" (not disabled) - typing a new title and pressing Enter submits with `intent=nav-add` instead of `intent=save`: a blank navigation row is appended and, again, the title is not saved. Before this item, the form had exactly one submit button ("Save"), so Enter correctly saved; this is a regression introduced by adding the reshape buttons ahead of it in the DOM. Reachable by the most ordinary interaction there is - finishing a text field and pressing Enter - not a crafted or unusual case, and it affects the **Site title** field too, not just the new navigation rows. Non-destructive (the admin can always click Save explicitly, and a stray blank row from the "no rows" case is silently dropped by `draftRowsToNavItems` if left untouched), so P2 rather than P1.
**Suggested fix:** Add a hidden default submit button as the very first focusable descendant of the `<Form>`, e.g. `<button type="submit" name="intent" value="save" className="visually-hidden" tabIndex={-1} aria-hidden="true" />` before the Site title field - the standard fix for "many submit buttons, one intended default." A quick regression check: fill Site title, press Enter, assert the title saved (this is exactly the scenario used to confirm the finding).
**Resolution:** Repaired 2026-09-23 by build, exactly as suggested: a hidden `<button type="submit" name="intent" value="save">` is now the first child of the `<Form>`, `visually-hidden`, `tabIndex={-1}`, `aria-hidden="true"` - present only to be HTML's implicit-submission target, never a second discoverable Save control. Evidence: both scenarios that confirmed the finding were re-driven against the running app (production build, JS on) - typing a new site title and pressing Enter now saves it (the "Settings updated." banner shows and the title persists on reload), confirmed both with at least one nav row present and with none. `npm run verify` -> exit 0; `npm run test:e2e` -> 78 passed, no regression.

**Closed 2026-09-23 by review** (scope: current, item 7b), re-checked independently of the repair: re-drove both original scenarios again (Enter in Site title with a row present, and with none) plus a third the original finding didn't cover - Enter inside a nav row's own Label field - all three now save correctly. Confirmed the fix introduces no new problem: the hidden button is excluded from keyboard tab order (`Shift+Tab` from Site title skips it, landing on the sidebar's own prior control) and from the accessibility tree (`aria-hidden="true"`, verified in the DOM), so it is not a second, confusing Save control. `npm run verify` and the full `npm run test:e2e` (78/78, serial) both green. Status `closed`.

### 07b/F-16 [P2] closed - The backup has never been restored

**File:** deploy/backup-db.sh:1
**Found:** 2026-09-16 by preflight (first-release audit)
**Why it matters:** The quality bar promises at most 24 h of data loss and a rebuild in under an hour, and both rest on a restore nobody has performed. The mechanism is proven as far as it can be today - one run dumped, verified with `pg_restore --list`, uploaded, and the object's size was re-read from the bucket - but production's database has **0 tables** (migrations have never run there), so the dump is an empty database and restoring it proves nothing about the schema the code needs. Not a P1 only because there is no content to lose yet; it becomes one the moment anyone writes a post.
**Suggested fix:** `host`, immediately after the first `deploy` runs migrations: restore the newest dump into a scratch database and start the app against it (the dump is mode 600 root, so copy it for the `postgres` user first), then record the evidence here.
**Resolution:** Repaired 2026-09-16 by deploy, after release `52c2670` and with the schema in place. A fresh nightly backup ran (`habre_cms-20260916T024823Z.dump`, 7314 bytes, unit result `success`), was restored into a scratch database `habre_cms_restore_test` owned by the app's role, and **the application itself was started against that copy** - not merely opened in a database client, which only proves the file parses. Evidence: the restored copy holds `users` and `schema_migrations` with `0001_users.sql` recorded; `scripts/create-admin.ts` created an account against it; the app answered `/healthz` `{"status":"ok","database":"up"}`; a wrong password returned the form's own error (400) and **the right password returned 302 to `/admin`** - a real session issued from restored data. The scratch database was dropped and the throwaway account went with it. Recovery time for this data volume is seconds; the untested part that remains is a restore onto a **fresh server**, which is the D9 hour-long rebuild path. Status `fixed` for `preflight` to re-check and close.

**Closed 2026-09-21 by preflight** (milestone audit before deploying items 4a-4c to production). Re-checked against the live server rather than re-running the original test: `habre-cms-backup.timer` has fired nightly without interruption since the original fix - `journalctl` shows successful uploads on 2026-09-19 (`...T024004Z.dump`, 7504 bytes), 2026-09-20 (`...T023041Z.dump`, 7504 bytes) and 2026-09-21 (`...T023218Z.dump`, 7504 bytes), each logging `uploaded ... - no BACKUP_HEARTBEAT_URL set` (the missing heartbeat is F-15, separately accepted). The database now holds real schema (`users`, `entries`, `schema_migrations`, migrations `0001`-`0003` applied) rather than the empty one the original test restored, and the backup mechanism has not changed since. **Residual, unchanged from the original resolution:** a restore onto a genuinely fresh server (the full D9 rebuild path) is still untested - closing this only confirms the restore-and-start proof continues to hold for the mechanism itself. Status `closed`.

### 07b/F-18 [P2] accepted - Keyboard and screen-reader behaviour has never been checked

**File:** blueprint/context/design.md (Accessibility bar: WCAG 2.2 AA, listed unchecked)
**Found:** 2026-09-16 by preflight (first-release audit)
**Why it matters:** The project holds itself to WCAG 2.2 AA, and the only two screens that exist - `/admin/login` and the admin shell - have never been driven by keyboard alone or heard through a screen reader. No automated check hears what is announced; the open line in `needs-you.md` has been there since item 1's spec. Contrast was measured in `design.md`, so this is about focus order, focus visibility, labels and announcements.
**Suggested fix:** The user, from item 1's `verify --manual` walkthrough (NVDA, VoiceOver or Orca); `verify` records the result and closes the `needs-you.md` line.
**Resolution:** **Accepted 2026-09-21 by the owner**, for the release specifically covering items 4a-4c to production: shipping without a manual keyboard/screen-reader pass, same as the prior three releases. The scope has grown since this was first found - it now covers the admin shell, the block editor's two popovers, the public site, the pages screens (item 6a), the settings screen and logo picker (item 7a), and the navigation editor (item 7b) - and none of it has had a manual pass. Still open in substance: the lines in `needs-you.md` (block editor, admin shell/login, public site) stay open, and `preflight` reports this again at the next milestone audit until one actually happens. Carried into this archive as `accepted` because the owner's most recent explicit decision covers this state; a future `preflight` reopening it against the further-widened scope is expected, not a contradiction.
