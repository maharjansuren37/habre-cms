# Feature: Site title and logo

**From build plan:** item 7a (split from item 7, "Site settings and menu" - too
big for one reviewable spec; 7b, the navigation menu, follows once this ships)
**Type:** Feature
**Status:** built, verified, reviewed - all 10 steps and 5 repairs complete, merged

## Goal

An admin can set the site's title and logo from a new `/admin/settings`
screen, and that title/logo replace the hardcoded "Habre CMS" placeholder
everywhere it currently appears: the admin shell's sidebar and the public
site's header and footer.

## In scope

- `site_settings` table (single row) - full shape from the plan
  (`site_title`, `logo_media_id`, `navigation`, `updated_at`), migrated now so
  7b never needs a second migration on this table.
- `/admin/settings` - admin only. Set the site title; choose, change, or
  remove a logo from the existing media library via the same picker dialog
  the post editor's image block already uses.
- Admin shell sidebar and public site header/footer read the live title and
  logo instead of the literal string "Habre CMS".
- A "Settings" nav entry, admin-only (matches D35's growing-nav pattern).

## Out of scope

- The navigation menu itself (nav item list, page/URL picker, rendering it in
  the public header) - item 7b. The `navigation` column is created now and
  reserved, but nothing in this item reads or writes it.
- Any change to `entries`, `media`, or `users`.

## Design reference

Not in `prototype`'s mockups (predates this item, like the media library and
pages screens). Build from the existing conventions: bordered-card form
(`field-label` inputs, primary/default/quiet buttons), the success/error
`Message` banner pattern, and the image block's own picker dialog
(`design.md`'s *Image block and picker* entry) reused for the logo control.
Add a line to `design.md` recording what this screen reuses, the same way
5a/5b/6a did for their own un-mocked screens.

## Build steps

- [x] **Step 1 - Migration** - `db/migrations/0005_site_settings.sql`: a
  singleton `site_settings` table (`id smallint primary key default 1 check
  (id = 1)`, `site_title text not null check (length(site_title) between 1
  and 200)` - same bound as `entries.title`, `logo_media_id uuid references
  media (id) on delete set null`, `navigation jsonb not null default '[]'`,
  `updated_at timestamptz not null default now()`), seeded with one row
  (`site_title = 'Habre CMS'`, everything else default). *Done when:*
  `npm run db:migrate` applies it, `schema_migrations` records
  `0005_site_settings.sql`, and the table holds exactly one row with `id = 1`.
- [x] **Step 2 - Server functions and validation** - `app/features/settings/
  settings-input.ts` (pure: `siteTitleSchema`, `z.string().trim().min(1).max(200)`,
  and a `logoMediaId` schema accepting a UUID or `null`) and
  `app/features/settings/settings.server.ts`: `getSiteSettings()` (reads the
  one row, left-joins `media` to resolve the logo's URL via
  `buildMediaUrl`, same pattern `entries.server.ts` uses for images) and
  `updateSiteIdentity(input: { siteTitle: string; logoMediaId: string | null })`
  (updates only those two columns plus `updated_at` - named `Identity`, not
  `Settings`, so 7b's own `updateNavigation` reads as a sibling, not an
  overload of one do-everything function). *Done when:* unit tests cover an
  empty title, a title over 200 chars, a valid title with surrounding
  whitespace trimmed, and both a real UUID and `null` for `logoMediaId`.
- [x] **Step 3 - `/admin/settings` route** - `app/features/settings/settings.tsx`,
  admin-only (`requireRole(["admin"])`, the same 404-not-403 shape
  `page-list.tsx` already uses). Form: a title text input (works with no
  JavaScript); a logo control matching the image block's card - "Choose logo"
  opens the same `/admin/media/picker` dialog pattern (a new, deliberately
  duplicated client script, `logo-picker.client.ts` - this is the second use
  of that dialog shape, and `fundamentals.md` says copy the second time,
  extract on the third), and once a logo is set, the image plus "Change logo"
  and "Remove logo" controls. Action validates with Step 2's schemas and
  calls `updateSiteIdentity`, then redirects back with a success banner
  (matching the existing `?updated=`-style pattern). Registered in
  `app/routes.ts` inside the admin-shell layout; nav entry "Settings" added to
  `admin-shell/layout.tsx`, hidden for `editor`/`author` the same way "Pages"
  is hidden for `author`. *Done when:* an admin sets a title and a logo, sees
  the success banner and the new values on reload; an editor or author
  requesting `/admin/settings` gets 404; save is measured against
  `quality-bar.md`'s admin-save bar (< 1 s p95).
- [x] **Step 4 - Wire into the chrome** - `admin-shell/layout.tsx`'s loader
  calls `getSiteSettings()` and the sidebar renders the title (and logo, if
  set) in place of the literal "Habre CMS"; `public-site/layout.tsx` gets its
  own loader doing the same for the header, and the footer's "Habre CMS" text
  becomes the site title. *Done when:* changing the title/logo in
  `/admin/settings` is immediately visible on `/admin/posts`'s sidebar and on
  `/` (public home), in both light and dark, and a public page load stays
  within `quality-bar.md`'s < 500 ms p95.
- [x] **Step 5 - `design.md`** - add an entry for the settings screen (what it
  reuses, what's new) and update the two lines that currently say the title
  and logo "arrive with item 7" to say they're built.
- [x] **Step 6 - Repair F-88** - restore keyboard focus after picking a logo
  for the first time (currently falls to `<body>`, reintroducing F-76's
  already-fixed defect). *Done when:* picking a logo from "Choose logo"
  leaves focus on the "Change logo" button, matching `image-tool.client.ts`'s
  own fix for the same transition.
- [x] **Step 7 - Repair F-87** - add `e2e/manage-settings.spec.ts`, mirroring
  `manage-pages.spec.ts`'s shape. *Done when:* an admin can reach the form
  and save a title; an editor and an author each get 404 and see no
  "Settings" link in the sidebar; the suite passes.
- [x] **Step 8 - Repair F-89** - validate that `logoMediaId` refers to a real
  media row before saving, instead of letting a foreign-key violation reach
  the user as a 500. *Done when:* a crafted request with a non-existent
  media id gets the same friendly "That logo could not be saved" error the
  malformed-shape case already gets, not a crash.
- [x] **Step 9 - Repair F-90** - give the "Logo" field a real programmatic
  label (`<fieldset>`/`<legend>` or `aria-labelledby`), matching how `Field`
  already labels "Site title". *Done when:* the logo control's accessible
  name includes "Logo", verified via the rendered accessibility tree.
- [x] **Step 10 - Repair F-91** - stop querying `site_settings` twice on
  `/admin/settings` by reading the admin-shell layout's already-fetched
  settings instead of fetching them again in the route's own loader. *Done
  when:* the settings page still renders and saves correctly with one
  `getSiteSettings` call per request, not two.

## Files and areas

- New: `db/migrations/0005_site_settings.sql`, `app/features/settings/*`
  (`settings.tsx`, `settings.server.ts`, `settings-input.ts`,
  `logo-picker.client.ts`, plus module CSS), `e2e/manage-settings.spec.ts`,
  `e2e/helpers/site-settings.ts`
- Changed: `app/routes.ts`, `app/features/admin-shell/layout.tsx` (+ its
  module CSS for the logo), `app/features/public-site/layout.tsx` (+ module
  CSS), `blueprint/context/design.md`, `blueprint/context/needs-you.md`

## Data and contracts

- **`site_settings`** (new, singleton row): `site_title`, `logo_media_id` ->
  `media` (`on delete set null` - unlike a block's image reference, which is
  JSON with no foreign key and degrades silently at render per D61, this is a
  real column, so a real constraint keeps it always valid instead of needing
  the same degrade-silently handling), `navigation` (jsonb, default `'[]'`,
  **locked shape for 7b:** a list of `{label, pageId | url}` per the plan -
  reserved and unread by this item), `updated_at`.
- **`updateSiteIdentity`** touches only `site_title` and `logo_media_id`. 7b
  adds its own `updateNavigation`, not a wider `updateSiteSettings` - keeps
  each function to one job, matching `updateDraft`/`saveEntry`'s split
  (F-40's own lesson).
- No `version` column on this row (unlike `entries`) - the plan does not
  specify one, and at this project's scale (a handful of admins editing
  settings rarely) last-write-wins is an acceptable, explicit choice, not an
  oversight.

## Testing

- Unit: `settings-input.test.ts` for the title and logo-id schemas (Step 2's
  done-when).
- Browser: `e2e/manage-settings.spec.ts` (5 tests) - an admin sets a title
  and a logo and sees both reflected on the admin sidebar and the public home
  page; picking a logo for the first time keeps keyboard focus (F-88); a
  logo id for a media row that no longer exists gets a friendly error, not a
  crash (F-89); an editor and an author each get 404 from `/admin/settings`
  and see no "Settings" nav entry.

## Decisions

Carried into `dev-notes/decisions.md` as D75-D79.

- **Split item 7 into 7a (this) and 7b (navigation menu).** Title/logo and
  the nav list are independently reviewable and shippable, matching how
  items 4, 5 and 6 were each split. *Beat:* one large spec covering a new
  table, a new admin screen, a reused picker dialog, and a reorderable list
  editor in one review cycle.
- **`site_settings` migrated whole, including the `navigation` column, now.**
  *Beat:* two migrations on the same table (one per sub-item) versus one
  migration with a column 7a does not populate. The column is reserved, not
  used, until 7b.
- **`logo_media_id` gets a real foreign key (`on delete set null`)**, unlike
  a block's image reference. *Beat:* letting a deleted logo silently leave a
  dangling id, which would need its own D61-style "no matching row" handling
  in the chrome for no reason - a real column can just stay valid for free.
- **The logo picker duplicates the image block's dialog rather than sharing
  it.** *Beat:* extracting a shared component on its second use, against
  `fundamentals.md`'s "copy the second time, extract on the third."
- **The public footer shows the site title as plain text, not the logo
  again.** *Beat:* repeating the logo in both header and footer, which
  `design.md` does not ask for and no mockup shows.

## Notes

- Reuses `/admin/media/picker`'s existing JSON contract (already built for
  the image block) - no new endpoint for listing media.
- `requireRole(["admin"])` and its 404-not-403 shape are exactly item 6a's
  pattern (`require-role.server.ts`) - no new authorization mechanism.
- Both new loader calls (`admin-shell/layout.tsx`, `public-site/layout.tsx`)
  add one indexed primary-key read per request - cheap, and within the
  quality bar as noted in Steps 3-4's done-whens.
- Item 7a itself introduced one real bug (F-92, `env.PUBLIC_URL` used where
  `env.R2_PUBLIC_URL` was needed) only caught once a real Playwright test
  rendered the image, and one open follow-up (F-93, a silent fallback in the
  `useRouteLoaderData` reuse) - both below.

## Findings

- **07a/F-87** [P2] closed - Item 7a's spec required an `e2e/manage-settings.spec.ts`,
  and it was never written. Repaired: added the file (5 tests) plus
  `e2e/helpers/site-settings.ts`; writing it surfaced 07a/F-92. Closed after
  independent re-verification (75/75 full suite, clean database).
- **07a/F-88** [P2] closed - Picking a logo for the first time dropped keyboard
  focus to `<body>` - the same defect F-76 already fixed once on the image
  block, reintroduced by the duplicated picker. Repaired with a ref + effect
  that refocuses a button after every logo change; proven by watching the
  regression test fail with the fix removed, then pass restored.
- **07a/F-89** [P3] closed - A crafted or raced `logoMediaId` referencing a
  deleted media row crashed the settings save (unhandled `23503`) instead of
  failing gracefully. Repaired with an existence check via `findMediaByIds`
  before saving; proven the same way (crash reproduced with the check
  removed, friendly 400 with it restored).
- **07a/F-90** [P3] closed - The "Logo" field's label had no programmatic
  association with its controls (a bare `<span>`, not a `<label>` or
  `<fieldset>`/`<legend>`). Repaired by making it a real `<fieldset>`/
  `<legend>`; confirmed via a rendered accessibility snapshot showing
  `group "Logo"`.
- **07a/F-91** [P3] closed - `/admin/settings` read `site_settings` twice in
  one request (the admin-shell layout's loader and the route's own).
  Repaired by reading the parent layout's already-fetched settings via
  `useRouteLoaderData` instead of querying again. Confirmed via a temporary
  query counter (two calls before, one after). Re-examining this repair is
  what surfaced 07a/F-93, tracked separately rather than reopening this one.
- **07a/F-92** [P1] closed - The logo image resolved against the site's own
  URL (`env.PUBLIC_URL`) instead of the images bucket (`env.R2_PUBLIC_URL`)
  in all three loaders, so it 404'd for every real visitor - found by build
  while writing 07a/F-87's test, not by the original review pass. Repaired
  by correcting all three call sites and renaming `getSiteSettings`'s
  parameter to `r2PublicUrl`. Closed independently given its severity: no
  remaining `getSiteSettings(env.PUBLIC_URL)` call site, image visibly loads
  in the rendered test.

**07a/F-93** [P3] - not resolved, stays in the live ledger (see
`blueprint/context/findings.md`): the `useRouteLoaderData` fallback added by
F-91's repair silently masks a lookup failure (a future rename of
`admin-shell/layout.tsx`) instead of erroring, which would let an admin
silently overwrite a real custom title/logo back to the seeded default.
Confirmed reachable by temporarily pointing the hook at a wrong id. Not
urgent - the id string is correct today - but worth a look before 7b builds
further on this same pattern.
