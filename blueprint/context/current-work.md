# Feature: Navigation menu

**From build plan:** item 7b (split from item 7, "Site settings and menu" -
7a shipped the title and logo; this is the second and final sub-item)
**Type:** Feature
**Status:** not started

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

- [ ] **Step 1 - Data and validation** - `app/features/settings/navigation-input.ts`:
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
