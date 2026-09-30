# Feature: Columns

**From build plan:** item 11
**Type:** Feature
**Status:** done

## Goal

A page section can be split into 2 or 3 columns that sit side by side on wide
screens and stack on small ones. Editors pick the column count per section in the
page editor; the public page renders the same columns. This is the second piece
of the first-cut page builder (D113); item 12 adds ready-made sections.

## In scope

- `layout` widens from `"1"` to `"1" | "2" | "3"`; a section stores exactly that
  many columns (`children.length === Number(layout)`). Pages only; posts stay flat.
- Page editor: a per-section "Columns" control (1 / 2 / 3), one Editor.js per
  column, columns side by side in the section card at >= `48rem`, stacked below.
- Changing the count: growing adds empty columns on the right; **shrinking merges
  the removed columns' blocks onto the end of the last kept column, in column
  order, so nothing is ever discarded** (Decisions).
- Public render: columns in a grid at >= `48rem`, stacked in DOM order below it.
- Save path: the wire shape already carries `columns: [...]` per section; the
  server now accepts 1-3 and derives `layout` from the count.
- Keyboard and screen-reader behaviour of the control, following item 10's
  conventions (focus after a change, polite live announcement).
- `design.md` gains a *Columns* entry (new component; it is not in the mockups).

## Out of scope

- Unequal column widths, column gap/background/styling, vertical alignment -
  section styling is deferred (plan section 11).
- Dragging blocks between columns; moving a block across columns means cutting
  and pasting for now.
- More than 3 columns; columns inside columns (nesting stops at section ->
  column -> leaf, D114).
- Ready-made hero / CTA / image + text sections - **item 12**.
- Posts (stay `v2`, flat).

## Design reference

No mockups exist for sections (item 10 set the precedent: `design.md` *Sections*
entry, screenshots in `blueprint/reference/10-sections/`). Build against the
existing tokens and the one `48rem` breakpoint in `design.md`; the new pieces
are the Columns control and the column layout, recorded in Step 5. No new
colours, so no new contrast figures.

## Build steps

- [x] **Step 1 - Widen the schema and the save parser** - `sectionBlock`: `layout`
  is `z.enum(["1","2","3"])` and `children` is 1-3 columns with a refinement that
  the count equals `Number(layout)`. `fromEditorJsSections` accepts 1-3 columns
  per section, derives `layout` from the count (never from the client), and names
  the column in errors when a section has more than one ("Section 2, column 2").
  Add a pure, generic `resizeColumns<T>(columns: T[][], count): T[][]` to
  `sections.ts` (no Zod import there - see its header comment). *Done when:*
  `npm test` passes new tests: layouts 1-3 accepted with matching counts;
  `layout: "2"` with one column, `"4"`, and 0 or 4 columns on the wire all
  refused; `resizeColumns` grows with empty columns, shrinks by merging in order,
  is a no-op at equal counts and never changes the total item count; an existing
  item-10 section (`layout: "1"`, one column) still parses unchanged.
- [x] **Step 2 - Render columns on the public site** - `renderSections` renders a
  section with more than one column as a wrapper of one `<div>` per column (each
  holding its blocks), in column order; a one-column section renders exactly as
  today. An empty column is still rendered (so column 3 does not slide into
  column 2's cell) but is hidden when stacked. CSS Modules or the public site's
  existing stylesheet: grid of equal columns at `min-width: 48rem`, single column
  (DOM order) below; gap from existing spacing tokens. *Done when:* a page seeded
  with a 2-column and a 3-column section (via `psql`, local dev DB) returns HTML
  with those column `<div>`s in order (`curl | grep`), and at 1024 px wide the
  columns sit side by side and at 375 px stacked in column order with no
  horizontal scroll (Playwright screenshot or `boundingBox` check).
- [x] **Step 3 - Mount one editor per column in the page editor** -
  `sections-editor.client.tsx` keeps each entry's columns (`Block[][]`) instead of
  `blocks`; mounts one `BlockEditor` per column with its own reader, labelled
  "Section 2, column 1 content" (single-column sections keep "Section 2
  content"); `contentRef` returns `columns` with every column's output, and a
  column that reads nothing still fails the whole save (F-42's rule). Admin CSS:
  columns side by side at >= `48rem` inside the card, stacked below, `min-width:
  0` so Editor.js does not widen the card. The control is not built yet: this step
  loads and saves whatever layout is stored. *Done when:* a page seeded with a
  2-column section opens with two editors holding the right blocks, an edit in
  column 2 saves and reloads in column 2, and an existing 1-column page behaves
  exactly as before (`e2e/page-sections.spec.ts` still passes unchanged).
- [x] **Step 4 - The Columns control: grow and merge** - a native radio group
  (fieldset, legend "Columns", options "1 column" / "2 columns" / "3 columns"; the
  legend's accessible name includes the section position like the Move buttons do)
  in each section's bar. Changing it reads every column, applies `resizeColumns`,
  remounts only that section's editors, calls `onChange`, announces "Section 2 now
  has 2 columns." (or "...columns merged into column N"), and keeps focus on the
  radio chosen. If any column cannot be read, the layout does **not** change and a
  message says why - content is never dropped to make a change succeed. *Done
  when:* 1 -> 3 adds two empty editors; typing in columns 1-3 then choosing 1
  column leaves one editor with all three columns' blocks in order; choosing 2
  from 3 merges column 3 into column 2; it works by keyboard alone; saving after
  any of these and reloading shows the same content.
- [x] **Step 5 - Record the design** - add a *Columns (item 11, not in the
  mockups)* entry to `blueprint/context/design.md`: the control, the side-by-side
  / stacked rule at `48rem`, empty-column behaviour, stacking order = column
  order, and that shrinking merges without a prompt (nothing is lost, unlike
  Remove). Save light and dark screenshots to `blueprint/reference/11-columns/`.
  *Done when:* the entry matches what Steps 2-4 built (re-read against the code,
  not the spec).
- [x] **Step 6 - Browser tests and the size check** - add `e2e/page-columns.spec.ts`
  (role-based locators): choose 2 columns, write in each, save, reload - content
  is in the right columns; choose 1 - merged in order; the public page shows the
  columns side by side at desktop width and stacked in order at phone width; a
  3-column section with an empty middle column keeps its last column's position.
  Then the size check: a page of 30 sections x 3 columns (seeded) opens in the
  editor, every editor mounted, in **under 10 s** on the dev machine, and saves
  in under 1 s server-side (quality bar). *Done when:* `npm run test:e2e` passes
  (needs the dev database, **not** part of `npm run verify` or CI - F-17) and the
  two timings are recorded in the step's commit note; if the 10 s is missed,
  record a finding and propose a total-column cap rather than shipping it silently.

## Files and areas

- `app/features/blocks/blocks.ts` - `sectionBlock`, `fromEditorJsSections`
- `app/features/blocks/sections.ts` (+ `sections.test.ts`) - `resizeColumns`
- `app/features/blocks/render.tsx` - `renderSections`; its CSS
- `app/features/blocks/sections-editor.client.tsx`, `sections-editor.module.css`
- `app/features/content/editor-content.ts` - readability check already walks
  `columns`; confirm only
- `app/features/blocks/collectImageMediaIds` / `page-media.server.ts` - already
  walk every column (D114); a test with an image in column 3 confirms it
- `blueprint/context/design.md`, `blueprint/reference/11-columns/`
- `e2e/page-columns.spec.ts`

## Data and contracts

**No migration.** `blocks_format` stays `v3`; item 10's `layout: "1"` sections
are valid under the widened schema, so nothing is rewritten.

Load-bearing (item 12 and later build on it):

    Section = { id, type: "section",
                data: { layout: "1"|"2"|"3", children: Block[][] } }
    invariant: children.length === Number(layout); 1-200 blocks per page in total

Wire shape (client -> server) is unchanged in form:
`{ sections: [{ id, columns: [ <Editor.js output> x 1..3 ] }] }`. The server
derives `layout` from `columns.length`.

## Testing

- **Unit (`npm test`, inside `verify`, no database):** Step 1's schema, parser
  and `resizeColumns` tests; an image-id collection test across columns.
- **Browser (`npm run test:e2e`, local only, needs the dev database, not in
  `verify`/CI):** Step 6.
- **Manual:** keyboard-only use of the control; the inline toolbar and block menu
  in a narrow (1/3-width) column (Editor.js popovers near a column edge); add to
  the existing section-controls line in `needs-you.md`.

## Decisions

- **Shrinking merges, without a prompt.** Extra columns' blocks are appended to
  the last kept column in order. Beats: refusing to shrink until columns are
  empty (an extra step for the editor), discarding (loses content), a confirm
  dialog (nothing is lost, so nothing to confirm). Cost: growing again does not
  un-merge.
- **Layout is derived from the column count on the server**, never trusted from
  the client (continues item 10's rule). Beats: sending `layout` and validating
  it against the columns (two fields that can disagree).
- **Equal-width columns, one breakpoint (`48rem`, the app's only one).** Beats:
  a per-section width choice (section styling is deferred) and a new breakpoint.
- **Empty columns still take their cell; hidden only when stacked.** Beats:
  dropping them (the next column slides left, changing the layout the editor chose).
- **Images picked this session are remembered for re-mounts** (`pickedMedia` in
  `image-tool.client.ts`). Beats: re-fetching media on a count change (a round
  trip for data the picker already had) and letting the image come back as
  "missing".
- **Column caps stay D114's (30 sections x 3 columns = up to 90 editors);**
  Step 6 measures it. A total-column cap is the fallback if it is too slow.

## Production needs

- No new environment variables, no migration, no external service.
- **Rollback caveat:** once a page is saved with a 2- or 3-column section, code
  from before this item (item 10's `layout: z.literal("1")`) can no longer read
  that page. Symlink rollback to item 10 is unsafe after such a save. Items 10
  and 11 should be deployed together; item 10's migration `0007` is still pending
  (`blueprint/production-pending.md`).

## Notes

- Editor.js tools assign `innerHTML`: any content moved between columns goes
  through the existing read path (`fromEditorJs`, `runsToHtml`), never a raw copy
  of the DOM (F-33).
- `sections.ts` must stay free of Zod imports (CSP comment in its header); keep
  `resizeColumns` generic and dependency-free.
- Section ids and selectors: columns are addressed as `sectionId + column index`;
  keep ids within `[A-Za-z0-9_-]` (F-119) - don't put the index in the section id.
- `AGENTS.md` rules hold: branch off `main`, nothing committed unseen, no push or
  deploy without a separate yes.

## Findings

### 11-columns/F-122 [P2] closed - A column count change that cannot read a column is untested, and unverified in a browser
File: app/features/blocks/sections-editor.client.tsx:166-200 (`setColumns`)

# 11-columns/F-122 - A column count change that cannot read a column is untested, and unverified in a browser

**Found:** 2026-10-01 by review (scope: current; lens: tests)
**Why it matters:** The spec's Step 4 done-when says that when a column cannot be read the layout does not change and a message says why. `setColumns`'s failure branch (Message banner, early return) has no test and was never run against the real app - e.g. a checklist block in a column, which `fromEditorJs` refuses. The merge path is tested; the safety net that stops content loss is not.
**Suggested fix:** Add an e2e that puts a checklist (or another refused block) in column 2, picks "1 column", and expects the banner, the same radio still checked and both editors still present. Revert the early return to see it fail.
**Resolution:** fixed 2026-10-01. Added e2e `a column that cannot be saved stops the count change, with a message and nothing lost` (checklist in column 2, choose 1 column: banner, radio and both columns unchanged). Seen failing with the early return in `setColumns` replaced by a continue, passing with it restored. Closed by build.

### 11-columns/F-123 [P3] closed - Column-change failure feedback has gaps: a rejected read is silent, the error banner never clears, one comment is stale
File: app/features/blocks/sections-editor.client.tsx:166-200; app/features/content/editor-content.ts:20

# 11-columns/F-123 - Column-change failure feedback has gaps

**Found:** 2026-10-01 by review (scope: current; lens: quality)
**Why it matters:** `setColumns` is called as `void setColumns(...)`: if an editor's `save()` rejects, nothing is shown and the radio silently stays put. The "columns were not changed" banner is cleared only by a later successful change, so it lingers after the writer fixes the block. `isReadableSectionsContent`'s comment still says "one readable column per section".
**Suggested fix:** Wrap the reads in try/catch and show the same banner; clear `layoutError` in `changed()`/on the next edit; reword the comment to "one or more".
**Resolution:** fixed 2026-10-01. `setColumns` now catches a rejected read and shows the banner; typing in any column clears it (`edited()`); the comment in `editor-content.ts` reworded. The clear-on-edit part is covered by the same e2e, seen failing with the clear removed. The rejected-read branch and the comment have no test of their own (a rejecting `save()` cannot be produced from the UI), so this stays `fixed` for `review`. Re-examined by review 2026-10-01 (current): catch branch, `edited()` clear and comment read correctly, nothing new introduced; `npm run verify` passes. Closed by review.

### 11-columns/F-124 [P2] closed - A heading at the top of a column pushes that column's text 3rem below its neighbours
File: app/features/public-site/page-body.module.css:38-76 (`.body h2` / `.body h3` margin-top vs `[data-column]`)

# 11-columns/F-124 - A heading at the top of a column pushes that column's text 3rem below its neighbours

**Found:** 2026-10-01 by review (scope: current; lens: quality/design)
**Why it matters:** `.body h2` sets `margin-top: var(--space-7)` (h3: `--space-6`). A grid item is its own formatting context, so a heading that opens a column keeps that margin inside the cell: its text starts 3rem lower than a paragraph opening the next column. Found by reading the cascade; not measured in a browser. The e2e layout test uses only text blocks.
**Suggested fix:** `.body [data-column] > :first-child { margin-top: 0 }` (after the heading rules, or with enough specificity), plus a check in `page-columns.spec.ts` that a heading-first column and a text-first column start at the same y.
**Resolution:** fixed 2026-10-01. `.body [data-column] > :first-child { margin-top: 0 }`; new e2e `a column that opens with a heading starts level with one that opens with text`. Seen failing before the repair (heading 29 px below the text column, limit 4) and passing after. Closed by build.
