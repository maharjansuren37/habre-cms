# Feature: Sections on pages

**From build plan:** item 10
**Type:** Feature
**Status:** done

## Goal

A page becomes an ordered list of sections, each holding the existing blocks, so
editors can structure a page into parts (D113/D114). Posts stay flat. Pages
already stored as `v2` keep working: they load as one section and convert to `v3`
on their next save, so nothing is migrated destructively. This is the foundation
for columns (item 11) and ready-made sections (item 12).

## In scope

- Migration relaxing the `blocks_format` check to `v2` or `v3`.
- The `section` block and its schema, pages only: `plain` sections with
  `layout: "1"` and exactly one column of the existing leaf blocks.
- Reading: a `v2` page is presented as one implicit section everywhere it is
  read (editor, public `/:slug`, public `/`).
- Saving: pages are stored as `v3`; posts stay `v2`.
- Editor: one Editor.js per section; add a section, move up / move down,
  remove (with an inline confirmation). At least 1 and at most 30 sections.
- Public render: each non-empty section is a `<section>` in page order.
- `page-media.server.ts` and the editor loader find image blocks inside sections.

## Out of scope

- Columns / `layout` "2" and "3": item 11. The stored shape already has room
  (`children` is a list of columns); item 10's schema only accepts `"1"`.
- `hero`, `cta`, `image-text`: item 12.
- Sections on posts; drag-and-drop; section styling; saved/reusable sections.
- Rewriting stored pages to `v3` in SQL (D114: the one migration only relaxes the check).

## Design reference

No mockup exists for section controls. Build against `design.md`: the admin
button and message components, the `Move up / Move down / Remove` pattern from
the navigation editor (`app/features/settings/settings.tsx`), light and dark
mode, and the editor canvas's reading column. **New component, so `design.md`
gets a short *Sections* entry in step 7** (what the section card looks like,
the controls, focus and announcements).

## Build steps

- [x] **Step 1 - Migration 0007** - `db/migrations/0007_blocks_v3.sql` drops
      `entries_blocks_format_check` and adds `check (blocks_format in ('v2','v3'))`.
      Default stays `'v2'`. Follow `migrate` (development only; production is
      `deploy`'s). *Done when:* `npm run db:migrate` applies it on the dev
      database; in `psql`, updating a row to `blocks_format = 'v3'` succeeds and
      to `'v4'` fails with a check violation (output shown).
- [x] **Step 2 - Section schema and helpers (pure, unit-tested)** - in
      `app/features/blocks/blocks.ts` (or a new `sections.ts` beside it if it
      grows): `sectionSchema`, `sectionsSchema` (1-30 sections, at most 200 leaf
      blocks in total), `Section` type, `sectionsFromBlocks(blocks)` (v2 -> one
      section, id `"legacy"`), and `collectImageMediaIds` accepting sections as
      well as flat blocks. Nothing is wired in yet. *Done when:* `npm test`
      passes new tests: valid section parses; layout `"2"` refused; two columns
      refused; 0 and 31 sections refused; 201 blocks across sections refused; a
      nested section refused; `sectionsFromBlocks([])` gives one empty section;
      image ids are found inside sections.
- [x] **Step 3 - Read path: load pages as sections, render them** -
      `assertKnownFormat` takes the entry type (pages read `v2` or `v3`; posts
      still only `v2`, so a `v3` post is refused loudly). `entries.server.ts`
      returns `sections` for pages (v2 converted on load) and `blocks` for posts.
      New `renderSections` in `render.tsx`; `PageBody` uses it;
      `resolvePageMedia` walks sections. Empty sections render nothing.
      `saveEntry`'s stale-format guard is unchanged in this step, so saving
      still writes `v2`. *Done when:* `npm run verify` passes; unit tests cover
      `assertKnownFormat` (page v3 ok, post v3 throws) and `renderSections`
      behaviour where testable without JSX; `npm run test:e2e` specs
      `manage-pages`, `public-site`, `home-page` still pass, and a v2 page's
      public HTML now wraps its blocks in one `<section>`.
- [x] **Step 4 - Save path: pages are stored as v3** - `saveEntry` and
      `createDraft` write `v3` for pages and `v2` for posts; the update's
      format guard accepts `v2` or `v3` for pages and `v2` only for posts.
      `parseEntryForm` takes the entry type; for pages it still accepts the
      editor's current flat output and wraps it in one section (transitional,
      removed in step 5). `page-new` and `page-edit` actions pass `"page"`.
      *Done when:* `npm test` covers parse-for-page (flat wrapped into one
      section with a generated id; post unchanged); after saving a page in the
      running app, `select blocks_format from entries where type='page'` shows
      `v3` for that row and `v2` for a post (output shown); reopening and
      publishing it still renders; `manage-pages` e2e passes.
- [x] **Step 5 - Sections wire format, one section in the editor** - the page
      editor submits `{ sections: [{ id, columns: [{ blocks: <Editor.js blocks> }] }] }`.
      New `fromEditorJsSections` in `blocks.ts` reuses `fromEditorJs` per column
      and names failures "Section N, block M ...". The transitional flat branch
      from step 4 is deleted. New `SectionsEditor` component (client) holding
      the section list in React, rendering the existing `BlockEditor` inside a
      section card (labelled "Section 1 content"); with one section and no
      controls yet. `BlockEditor` gets `label` and `placeholder` props (posts
      keep "Post content" / "Write your post…"). `page-edit` loader hands the
      editor sections and resolves images inside them. *Done when:* `npm test`
      covers `fromEditorJsSections` (valid; a bad link names the section and
      block; wrong shape refused; flat shape refused for pages); a v2 page
      opens in the editor as one section with its content intact, saves, and
      reopens identically; a post editor is unchanged (`manage-posts`,
      `write-post`, `image-block`, `inline-formatting` e2e pass).
- [x] **Step 6 - Add, move and remove sections** - in `SectionsEditor`:
      "Add section" (appends an empty section, focuses its editor), Move up /
      Move down (disabled at the ends), Remove with an inline "Remove this
      section? Remove / Keep" confirmation; Remove is unavailable when it is the
      only section; Add is disabled at 30 with a one-line reason. Each section
      card is named by position ("Section 2 of 4") and each editor by
      `aria-label="Section 2 content"`; moves and removals are announced in an
      `aria-live="polite"` region ("Section moved to position 2 of 4"). Section
      ids are `crypto.randomUUID()`. Every change marks the form unsaved.
      Moving must not lose what was typed in either section. *Done when:* in
      the running app, add two sections, type in each, move one up, save,
      reload: order and text are as left; remove asks before acting; the last
      section has no Remove; the 31st cannot be added. Verify also checks, with
      30 sections mounted, that typing and Save still feel immediate (D114's
      named risk) and notes the result.
- [x] **Step 7 - Design record** - add a *Sections* entry to
      `blueprint/context/design.md`: card, controls, states (only section,
      at the cap, confirm-remove), announcements, and that public sections
      add no visual chrome of their own. *Done when:* the entry is there and
      matches what step 6 built (a screenshot of light and dark saved under
      `blueprint/reference/10-sections/` and linked).
- [x] **Step 8 - Browser tests and the quality bar** - `e2e/page-sections.spec.ts`:
      (a) a page saved with two sections in a chosen order renders them in that
      order at `/:slug`; (b) a pre-existing v2 page (inserted by SQL in the
      test) opens as one section, and saving it stores `v3`; (c) remove
      confirmation and add/move via role-based locators; (d) an image inside a
      second section renders publicly. *Done when:* `npm run test:e2e` passes
      (needs the dev database; not part of `npm run verify`, and CI does not
      run it - F-17). Also measured once against the dev server and pasted
      into the review: a page of 30 sections / 200 blocks saves in under 1 s
      and its public GET is under 500 ms (quality-bar numbers), via
      `curl -w '%{time_total}'`; not a CI gate.

## Files and areas

- `db/migrations/0007_blocks_v3.sql` (new)
- `app/features/blocks/blocks.ts` (+ `blocks.test.ts`), `render.tsx`,
  `editor.client.tsx`, new `sections-editor.client.tsx` (+ CSS module)
- `app/features/content/`: `blocks-format.ts` (+ test), `entries.server.ts`,
  `entry-form-input.ts`, `entry-input.ts`, `entry-form.tsx`, `page-edit.tsx`,
  `page-new.tsx`
- `app/features/public-site/`: `page-body.tsx`, `page-media.server.ts`, `page.tsx`, `home.tsx`
- `e2e/page-sections.spec.ts` (new); `blueprint/context/design.md`

## Data and contracts

**Stored (load-bearing - items 11 and 12 build on it; D114):** a page's
`blocks` jsonb is a list of

    { id, type: "section", data: { layout: "1", children: [ [leafBlock, ...] ] } }

`children` is a list of columns, each a list of the existing leaf blocks
(`text`, `heading`, `list`, `image`). Item 10 accepts `layout: "1"` with exactly
one column; item 11 widens `layout` to `"1" | "2" | "3"` with a matching column
count, and item 12 adds typed `hero`, `cta`, `image-text` blocks beside `section`.
`blocks_format`: `v2` (flat, posts and not-yet-resaved pages) or `v3` (pages).

**Editor -> server wire (pages):** form field `blocks` holds
`{ sections: [{ id, columns: [{ blocks: [...Editor.js blocks] }] }] }`; posts
keep `{ blocks: [...] }`. The server never trusts the client's layout: it
derives `layout` from the column count and validates with `sectionsSchema`.

**Types:** pages expose `sections: Section[]`, posts `blocks: Block[]`. No
`Block[]` for a page outside the conversion helper.

**Schema change:** the `entries_blocks_format_check` constraint only (step 1).
No data is rewritten.

## Testing

- Unit (`npm test`, no database): schema, conversion, id collection, format
  assertion, wire parsing - listed per step.
- Browser (`npm run test:e2e`, local, needs the dev database): step 8. Not in
  `verify`, not run by CI.
- Migration proven by hand against the dev database (step 1).
- Manual: keyboard and screen-reader pass over the section controls (recorded
  in `needs-you.md`).

## Decisions

- **Posts stay `v2`; only pages become `v3`** - format is per entry type, and a
  `v3` post is refused on read. Beats: one format for everything (posts have no
  use for sections).
- **A v2 page's implicit section has the fixed id `"legacy"`** - it is replaced
  by a generated id on its first save. Beats: deriving an id from the entry id
  (longer, no benefit).
- **A page holds 1-30 sections and at most 200 leaf blocks in total** - the same
  200 as posts keeps the 1 MB save limit (`MAX_ENTRY_BODY_BYTES`) and the
  1 s save target safe. Beats: 200 per section (30 x 200 = 6,000 blocks).
- **Item 10 accepts only `layout: "1"`** - widened by item 11 rather than
  pre-built here. Beats: accepting 2-3 columns the editor cannot produce yet.
- **An empty section renders nothing publicly** - no empty `<section>` element.
- **Removing a section asks first, inline** - the only way to lose a section's
  content in one click otherwise. Beats: no confirmation (nav rows have none,
  but they hold one line each), and a modal dialog (heavier, more to make accessible).
- **Section ids come from `crypto.randomUUID()` in the browser** - the server
  validates shape (1-64 chars), not uniqueness, as it does for block ids.

## Production needs

- **Migration `0007_blocks_v3.sql`** - must run before any release that saves a page as `v3`.
- No new environment variables, services or accounts.
- **Not symlink-rollbackable:** once one page is saved as `v3`, older code
  throws on that page (`assertKnownFormat`), and the check change cannot be
  undone by flipping `current`. Rolling back this release after a page is
  saved needs a database restore or converting `v3` pages to `v2` by hand.
  (Same shape as F-72's caution.)

## Notes

- Branch first: `main` still holds the uncommitted D113/D114 plan edits
  (`build-plan.md`, `project-plan.md`, `decisions.md`, `project-overview.md`);
  `build` should carry or commit them deliberately, not lose them.
- `project-overview.md` says to run `architect` first - it has: D114 records the
  shape. Regenerate the overview (`context`) after this item.
- Imports `#app/...` with extensions; `.server.ts` for database code; logic
  worth testing in plain `.ts` (JSX is not testable under `node --test`).
- Zod 4; `erasableSyntaxOnly` (no enums). Minimal dependencies: none added.
- Editor.js 2.31.6 owns its DOM; React must not re-render inside a section's
  editor. Reordering moves the section card; if a DOM move detaches an
  Editor.js instance, re-mounting from saved content is the fallback and must
  not lose unsaved typing (step 6's done-when).
