# Feature: Simple and Pro

**From build plan:** item 20
**Type:** Feature
**Verified:** 2026-10-12, 01112b99a66b, 9 of 9 proven (6 steps and 3 repairs; full browser suite 603 passed, 0 failed, 18 skipped for R2, dark site screenshots read); screen-reader pass of the new controls could not verify (needs-you)
**Reviewed:** 2026-10-12, 01112b99a66b, current, every lens - 0 blocking

## Goal

A site has an editing level, Simple (default) or Pro, that an admin switches in
Settings at no cost (D166, D172, D175), and a dark-mode choice for its public
pages. Simple shows only Level 1 screens; Pro adds Users and the H5-H6 text
styles. Switching down never breaks a page: Pro-made content keeps rendering and
its Pro-only values lock read-only while the text stays editable.

**Owner change at spec time (2026-10-12): dark mode is offered at every level,
not Pro only.** This supersedes D168's "Pro turns it on" and D172's "applies
only in Pro". Plan and design edits for it are in Notes, awaiting approval.
Because it is offered everywhere, v1 has no other "advanced settings" (every
shipped Settings field stays in Simple), so Pro in v1 is Users plus H5-H6.

## In scope

- `site_settings.level` (simple | pro, default simple) and `dark_mode`
  (boolean, default off), migration `0023`.
- Settings: an "Editing level" section (two radio cards, admin only, saved with
  the form) and a "Dark mode" checkbox, in both levels.
- Level gates: the Users nav link and `/admin/users*` are Pro only (404 in
  Simple, the same Not Found as a role refusal, D69).
- Text style menu: H5 and H6 are offered in Pro; in Simple a block already at
  H5 or H6 shows its style read-only, "Switch to Pro to change". The editor
  always accepts levels 1-6 so a Pro-made document loads unchanged.
- Public dark mode: with `dark_mode` on, public pages (and the admin's preview)
  follow the visitor's device; off, they stay light. Brand shades are derived
  for the dark surface too, so contrast holds (WCAG AA, the existing derivation's
  rule).
- `design.md` and capability text brought in line (a step, below).

## Out of scope

- Developer level (Level 3) and the Level 2 layout tools (plan section 11).
- Billing: a tier is never called a level (D175, item 21).
- A per-member level (D172 rejected it for v1).
- Dark mode for the editor's canvas and Settings' preview: they stay light, as
  D168 says ("a site looks the way its owner saw it in the editor"); the
  published site and `/admin/preview` follow the setting.
- Any server-side refusal of H5-H6 in Simple: the lock is a control, not a
  validation (the schema already allows 1-6, D169).

## Design reference

`blueprint/context/design.md`: *Customer sites* (light only), *Navigation map*
(Users when Pro), journey 11 (Switch Pro -> Simple), *Editor decisions* (Text
style menu). No new mockup; Settings uses the existing form kit. The new
Settings controls and the locked-style state are **not** in the record yet; Step
6 adds them.

## Build steps

- [x] **Step 1 - Migration and settings data** - `0023_level_and_dark_mode.sql` adds
  `site_settings.level text not null default 'simple' check (level in ('simple','pro'))`
  and `dark_mode boolean not null default false`; `SiteSettings`, `getSiteSettings`,
  `getSiteBrand` (renamed or beside it: `getSiteLook`) and the settings save read
  and write them. Use `migrate`. *Done when:* `npm run db:migrate` applies it on the
  development database; a unit test shows the level parser reads an unknown stored
  value as `simple`; existing rows read as simple, light; `npm run verify` passes.
- [x] **Step 2 - Settings controls** - an "Editing level" fieldset (Simple, Pro; each
  card says what it adds) and a "Dark mode" checkbox in Settings, validated with Zod
  (`levelSchema`, boolean), saved through the existing version-checked action,
  within `MAX_SETTINGS_BODY_BYTES`. *Done when:* a browser test switches to Pro and
  back and reloads with each value kept; a forged `level=admin` is refused with a
  field error and changes nothing; Settings keeps every other field in both levels.
- [x] **Step 3 - Gate Users by level** - a `requireLevel("pro")` middleware beside
  `requireRole`, on `user-list`, `user-new`, `user-edit`; the shell loader passes
  `level` so the nav hides Users in Simple. *Done when:* a browser test: Simple admin
  sees no Users link and `/admin/users` is 404; after switching to Pro the link and
  screens work; `manage-users.spec.ts` sets Pro in its setup.
- [x] **Step 4 - H5-H6 and the lock** - the editor's heading extension accepts levels
  1-6 for pages (2-6 for posts); the Text style menu lists H5-H6 only in Pro (names in
  Decisions); in Simple, a block at H5/H6 shows its style with the hint "Switch to
  Pro to change" and no style choices, while Bold, Italic, Link, move, duplicate and
  delete still work; the editor outlet context carries `level`. *Done when:* unit
  tests for the menu's options by level and level-lock; a browser test: in Pro set a
  heading to H5, switch to Simple, the page still renders an `h5`, the toolbar shows
  it locked, typing in it still works, and moving it works.
- [x] **Step 5 - Public dark mode** - `data-dark="auto"` on `<html>` when the site look
  is on and `dark_mode` is set; `[data-surface="site"][data-dark="auto"]` in
  `app/app.css` sets `color-scheme: light dark` and the dark neutral roles; the brand
  `<style>` also carries a dark set under `@media (prefers-color-scheme: dark)`,
  from a dark `BrandSurface` passed to `deriveBrandShades`, which must lighten when a
  darker candidate cannot pass on a dark surface (closes F-313). The editor canvas
  and Settings' preview keep `LIGHT_SITE_SURFACE`. *Done when:* unit tests: for a
  sample of brand colours the dark set meets 4.5:1 on the dark bg, surface and
  sunken; a browser test under `colorScheme: "dark"`: dark off -> the page's computed
  background is light; on -> dark, in Simple and in Pro; the CSP test still passes.
- [x] **Step 6 - Records** - update `design.md` (light only line, Settings row, Users
  when Pro, the locked-style state, the new dark set and its measured contrast) and
  `needs-you.md`; plan and decisions edits happen only as approved (Notes). *Done
  when:* `design.md` no longer says dark mode is Pro only and its contrast table has
  the dark rows; `npm run verify` passes.
- [x] **Repair F-398** - on a Simple site, reject a transaction that raises the number of level 5-6 headings (Ctrl+Alt+5/6, a paste); undo and Duplicate stay allowed. *Done when:* a unit test of the count, and a browser test that Ctrl+Alt+5 in Simple makes no `h5`, seen failing first.
- [x] **Repair F-401** - on a Simple site, a paste is not refused by the Heading 5/6 guard, so a cut Heading 5 pastes back. *Done when:* a browser test that cuts a Heading 5 block in Simple and pastes it back, seen failing first.
- [x] **Repair F-403** - on a Simple site, Enter in the middle of a Heading 5 or 6 splits it. *Done when:* a unit case for a split, and a browser test that Enter inside a locked Heading 5 makes two Heading 5s, seen failing first.

## Files and areas

- `db/migrations/0023_level_and_dark_mode.sql`
- `app/features/settings/` (`settings.server.ts`, `settings-input.ts`, `settings.tsx`)
- `app/features/auth/` (`require-level.server.ts`, new)
- `app/features/admin-shell/layout.tsx`, `app/features/users/*`
- `app/features/blocks/block-toolbar.client.tsx`, `document-editor.client.tsx`
- `app/features/content/editor-layout.tsx`
- `app/root.tsx`, `app/app.css`, `app/features/brand/brand-colours.ts`,
  `app/features/public-site/layout.tsx`, `app/features/preview/preview-layout.tsx`
- `e2e/manage-settings.spec.ts`, `manage-users.spec.ts`, `contrast.spec.ts`,
  `document-editor.spec.ts`, a new `e2e/levels.spec.ts`

## Data and contracts

- `site_settings.level` `'simple' | 'pro'`, default `'simple'`;
  `site_settings.dark_mode` boolean, default `false`. Both under the existing
  `site_isolation` policy (a column on an existing table). **Load-bearing:** item 21
  must not add a third level value for a paid tier (D175).
- Migration is additive and reversible (drop the two columns); no backfill. Real
  data: production holds items 1-12 only until the v1 deploy (D163), so no data
  exposure now.
- `levelSchema = z.enum(["simple","pro"])`; the stored value is never trusted:
  anything else reads as `simple`.

## Testing

- Unit (`node --test`, inside `verify`): level parsing, menu options by level, the
  dark shade derivation's contrast, `requireLevel`'s refusal.
- Browser (`npm run test:e2e`, needs the dev database; CI's `e2e` job runs it,
  no R2 needed): new `e2e/levels.spec.ts` for switching, Users gating, H5 lock and
  dark mode under a dark device in both levels, plus the journey: Settings -> switch
  to Pro -> Users appears -> switch back -> Users 404 and pages still render.
- Quality bar: no hot path or new query beyond one column on the settings row.

## Decisions

- **Dark mode is available at every level (owner, 2026-10-12)** - beats D168's
  Pro-only: a plain on/off is no busier than the other Settings choices, and Simple
  owners with a dark brand asked for it. Cost: a dark logo can disappear on a dark
  page in Simple too (an existing D168 cost, now reachable without Pro).
- **The level is a column on `site_settings` (D172)**, read by the shell loader
  once per request, not copied into the JWT.
- **H5 and H6 are named "Heading 5" and "Heading 6"** in the menu - Simple's names
  are words, but two more words invented here would be a design decision with no
  mockup; the owner can rename them in review. Beats "Minor heading / Label".
- **The lock is UI only** - the document schema keeps allowing 1-6; beats refusing
  saves, which would break "switching down never breaks a page".
- **Users 404s in Simple** rather than redirecting - same refusal as a role (D69).

## Production needs

- Migration `0023` (additive) at the v1 deploy; no new variables, accounts or
  services. Record in `blueprint/production-pending.md` at `ship`.

## Behaviour changes

- New capability `levels`: a site is Simple or Pro, Simple by default, and an admin switches it in Settings at no cost - Step 2
- Adds to `levels`: in Simple the Users link is hidden and `/admin/users` is Not Found; in Pro they work - Step 3
- Adds to `levels`: Pro offers Heading 5 and Heading 6; in Simple a block already at H5 or H6 shows its style read-only with "Switch to Pro to change", its text, moves and delete still work - Step 4
- Adds to `levels`: switching from Pro to Simple keeps every page rendering and loses no stored value - Step 4
- Adds to `settings`: Settings sets the site's editing level and whether public pages follow the visitor's dark setting - Step 2
- Changes `public-site.2` from "public pages, the public 404 and the error page are light whatever the device's setting (D168; items 1-12 followed the device, never recorded as a claim)" to "public pages, the public 404 and the error page are light whatever the device's setting unless the site's dark mode is on, then they follow the device (D168, amended by item 20)" - Step 5
- Adds to `brand`: with dark mode on, a brand colour's shades meet 4.5:1 on the dark page as they do on the light one - Step 5

## Notes

- **Plan edits awaiting your approval** (not made): `build-plan.md` item 20 -
  replace "switching to Pro adds Users, advanced settings, the H5-H6 text styles and
  dark mode for the public site (D168)" with "switching to Pro adds Users and the
  H5-H6 text styles; dark mode for the public site is a Settings choice at every
  level (D168, amended)". `project-plan.md` lines ~84-86, ~583-588, ~862 and ~921-929
  and the `site_settings` line (~502, "applies only in Pro") get the same change.
  `dev-notes/decisions.md` gets one amending entry at `ship`.
- Findings touched: F-313 closes with Step 5's derivation fix (its `File:` line is
  `brand-colours.ts:138-149`).
- Reads: `blueprint/context/design.md`'s journey 11 is the done-when for the
  switch-down walk in Step 4's browser test.
- Respect `coding-standards.md`: `#app/` imports with extensions, `.server.ts` for
  anything on the DB, semantic HTML (the level choice is a `fieldset` with
  `legend` and radios, not clickable divs), `getByRole` locators.

## Findings

### 20-simple-and-pro/F-398 [P1] closed - Ctrl+Alt+5 makes a Heading 5 on a Simple site, bypassing the lock
File: app/features/blocks/document-editor.client.tsx (`simpleHeadingGuard`); app/features/blocks/text-styles.ts

# 20-simple-and-pro/F-398 - Ctrl+Alt+5 makes a Heading 5 on a Simple site, bypassing the lock

**Found:** 2026-10-12 by review (scope: current; lens: quality)
**Why it matters:** Heading 5 and 6 are Pro's text styles (D166); the menu and the `##### ` shortcut are guarded, but TipTap's heading extension binds Mod-Alt-5 and Mod-Alt-6 for every level the schema accepts, and a paste of `<h5>` is accepted too. Reproduced: Simple site, click a paragraph, Ctrl+Alt+5 -> one `h5`.
**Suggested fix:** reject, on a Simple site, a non-history transaction that raises the count of level 5-6 headings (duplicate marks its own).
**Resolution:**
Fixed 2026-10-12 (build, autopilot): `simpleHeadingGuard` in `document-editor.client.tsx` now also has `filterTransaction`, refusing a non-history edit for which `changesProHeadings` (text-styles.ts) is true; Duplicate marks its transaction `keepsStyle`. Unit test: `text-styles.test.ts`; browser test: `levels.spec.ts` "Ctrl+Alt+5 and a pasted Heading 5". Seen red with the guard replaced by `true` (Expected 1, Received 2), green with it back. A paste is covered by the same count rule but only Ctrl+Alt+5/6/3 is driven by the test. Left `fixed` for a later review to close.
Re-examined by review 2026-10-12 (second pass): the shortcut and Ctrl+Alt cases are gone (probe and test), but the repair introduced F-401 (a paste of a Pro heading is dropped). Left `fixed`, not closed; close it with F-401.
Re-examined by review 2026-10-12 (third pass): Ctrl+Alt+5/6 on a paragraph and Ctrl+Alt+3/6/0 inside a Heading 5 are refused (browser test, unit cases incl. H5 to H6). Left `fixed`: the guard also refuses splitting a locked heading with Enter (F-403). Close both together.
F-403 (the Enter split) is repaired and closed; F-398 stays `fixed` until a review re-examines the guard as it now stands.
Closed by review 2026-10-12 (fourth pass): the guard as it stands (`filterTransaction` + `changesProHeadings`, document-editor.client.tsx / text-styles.ts) refuses Ctrl+Alt+5/6 on a paragraph and Ctrl+Alt+3/6/0 inside a Heading 5, and the `##### ` shortcut; it allows typing, moves, delete, undo, Duplicate, paste and Enter splits. Probed: Backspace merges, select-all and type, Enter at the end, all behave. No new defect except the dead export F-404.

### 20-simple-and-pro/F-401 [P1] closed - On Simple, cutting a Heading 5 or 6 and pasting it back inserts nothing
File: app/features/blocks/document-editor.client.tsx (`simpleHeadingGuard`'s `filterTransaction`)

# 20-simple-and-pro/F-401 - On Simple, cutting a Heading 5 or 6 and pasting it back inserts nothing

**Found:** 2026-10-12 by review (scope: current; lens: quality)
**Why it matters:** F-398's guard refuses any edit that raises the Pro-heading count, and a paste is one. Reproduced on a Simple site: cut a Heading 5 block, paste -> the page is left without it and nothing says why (undo restores it). The same drops any paste that holds a Heading 5, e.g. from a Pro page.
**Suggested fix:** let a paste through (`tr.getMeta("uiEvent") === "paste"`) or rewrite the pasted levels; refuse only shortcuts and input rules. The spec's rule is "locked, movable, deletable".
**Resolution:**
Fixed 2026-10-12 (build): `filterTransaction` lets a paste through (`uiEvent` "paste"); shortcuts and input rules are still refused. Test: `levels.spec.ts` "a cut Heading 5 pastes back" - cuts the whole page and pastes it back; seen red with the exemption replaced by `false` (Body words missing), green with it. Consequence, accepted by this repair: a Heading 5 HTML-pasted from outside is no longer refused on Simple. Left `fixed` for review.
While testing this a second hole in F-398 showed: Ctrl+Alt+6 on a Heading 5 turned it into a Heading 6 (the count was unchanged). `changesProHeadings` now compares each level; unit test case added; browser test presses Ctrl+Alt+3, 6 and 0 inside a Heading 5.
Closed by review 2026-10-12 (second pass): the paste exemption is in `document-editor.client.tsx`, `levels.spec.ts` "a cut Heading 5 pastes back" drives cut-all and paste and was seen red with the exemption off; no new defect from this repair itself (the Enter split is F-403, from F-398's guard).

### 20-simple-and-pro/F-402 [P3] closed - Duplicate's transaction meta name is a string literal beside an exported constant
File: app/features/blocks/block-drops.ts:144; app/features/blocks/text-styles.ts (`KEEPS_STYLE`)

# 20-simple-and-pro/F-402 - Duplicate's transaction meta name is a string literal beside an exported constant

**Found:** 2026-10-12 by review (scope: current; lens: quality)
**Why it matters:** `KEEPS_STYLE` is exported from `text-styles.ts` and read by the guard, but `block-drops.ts` sets `"keepsStyle"` by hand, so renaming either silently stops Duplicate working on Simple's Heading 5 (the test would catch it, but late).
**Suggested fix:** import the constant in `block-drops.ts`.
**Resolution:**
Fixed 2026-10-12 (build): `block-drops.ts` imports `KEEPS_STYLE`. Not closed by build: a rename guard has no test of its own; the Duplicate step of `levels.spec.ts` would fail if the two names drifted. Left `fixed` for review.
Closed by review 2026-10-12 (second pass): `block-drops.ts` imports `KEEPS_STYLE`; Duplicate still passes in `levels.spec.ts`.

### 20-simple-and-pro/F-403 [P2] closed - On Simple, pressing Enter in the middle of a Heading 5 or 6 does nothing
File: app/features/blocks/text-styles.ts (`changesProHeadings`); app/features/blocks/document-editor.client.tsx (`simpleHeadingGuard`)

# 20-simple-and-pro/F-403 - On Simple, pressing Enter in the middle of a Heading 5 or 6 does nothing

**Found:** 2026-10-12 by review (scope: current; lens: quality)
**Why it matters:** F-398's guard refuses any edit that raises the Pro-heading count, and splitting a heading makes a second one. Reproduced: Simple site, caret inside "Fineprint" (H5), Enter -> unchanged (at the end of the heading Enter works). The spec says a locked block's text stays editable.
**Suggested fix:** in `changesProHeadings`, allow a rise that is matched by the same rise in text blocks (a split); a Ctrl+Alt conversion leaves the text-block count alone, so it stays refused.
**Resolution:**
Fixed and closed by build 2026-10-12: `changesProHeadings` now allows a rise in Pro headings that a new text block pays for (a split); a Ctrl+Alt conversion adds no block, so it stays refused. Test: `levels.spec.ts` "Enter in the middle of a Heading 5 splits it" (the Enter is preceded by a typed character, so the editor has the caret where the keys put it) and a unit case; seen red with the rule replaced by `return true` (Expected 2, Received 1), green with it. closed by build.
