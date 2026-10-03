# Feature: Ready-made sections, added from the palette

**From build plan:** item 14c1
**Type:** Feature
**Verified:** 2026-10-03, 938e4a12b0f8, every behavioural done-when proven by Playwright against the production build during build (steps 3-5, `e2e/section-templates.spec.ts`, 16 tests; full `npm run test:e2e` 244 passed, real R2); steps 1-2 by unit tests (pure functions); not provable here: a screen reader (needs-you.md)
**Reviewed:** 2026-10-03, a24357d7f429, current (8b39d6c..938e4a1), every lens, reviewer subagent - 0 blocking; 5 new P3 (F-199-F-203), 2 unverified (F-204, F-205)

## Goal

Give the palette its Sections half: **Blank section, Hero, Image and text,
Call to action**, each adding an ordinary section of ordinary blocks after the
section being edited (D170), by click, Enter or the phone's Add. Nothing new
is stored: a hero is a two-column section like any other, so every block in it
takes the toolbar, moves, drags and settings already built. This also locks
the template shape item 18b's AI expands its section kinds with.

## In scope

- **`sectionTemplate(kind, options)`** - a pure function returning a v4
  `Section` (JSON, `document-nodes.ts` types), shared by the editor now and
  the server in 18b. Templates, as `prototypes/editor.html` draws them:
  - **Blank section** - one column, one empty paragraph;
  - **Hero** - two columns, `align: middle`: heading, text, space, button
    (Filled) | image. The heading is the **Main heading** on a page that has
    none, otherwise a Heading; on a post always a Heading;
  - **Image and text** - two columns: image | heading, text;
  - **Call to action** - one column, `background: band`: heading, text,
    button (Filled).
  Every text block is empty, the button has no text or link, the image no
  media - so an untouched template publishes nothing (public-site.5, .7).
- **Adding one:** the new section goes **directly after the section holding
  the selection**, as one undo step; the cursor lands in its first text block
  in reading order and the writing area is focused; announced in the editor's
  status: "Hero added: now section 3 of 5."
- **Limits:** a tile is disabled when its template would not fit - 30
  sections, or 200 blocks counting the template's own (blank 1, hero 5, image
  and text 3, call to action 3) - with the existing sentence beside the group
  ("Thirty sections is the most there can be." or "You can have at most 200
  blocks.").
- **The palette:** a second group, `h2` "Sections", below "Blocks" in the side
  panel; four wide tiles with the mockup's icons. In the phone's Add dialog
  the title becomes "Add to the page", with "Blocks" and "Sections" as `h3`s;
  choosing a section tile closes the dialog first, as a block tile does.
- **Hints for empty text, editor only** - so a template's empty blocks can be
  seen and filled:
  - an empty heading always shows its style's name in `--color-text-muted`
    ("Main heading", "Heading", "Subheading", "Small heading");
  - an empty paragraph that shares its column with other blocks shows "Text"
    when the cursor is elsewhere, and keeps "Write your page…" /
    "Write your post…" when the cursor is in it;
  - an untouched column (one empty paragraph) is unchanged - the empty-column
    hint, or "Write your page…" with the cursor in it.
- **`design.md`** records the Sections group, the dialog's headings, the hint
  rule and the announcement (decisions the record does not cover).

## Out of scope

- **Dragging a section tile** between sections (a section drop slot, the gap
  between sections, its announcements) - **14c2**. In 14c1 a section tile is
  a click target only; its `onPointerDown` does not start a drag.
- **Dragging existing sections** - not in the design record; a section moves
  from its chip (14a3). Noted, not planned.
- **"Add a section"** at the foot of the page - unchanged: it still adds a
  blank section at the end.
- **Starter text in templates** - AI fills the slots in 18b, through the same
  function; nothing is invented for a manual insert.
- **Section `align` / `background` controls** - Simple shows Columns only
  (D170, already so in `settings-panel.client.tsx`); Pro may reveal them later.
- **The palette's rail of icons** - not built yet, not this item's.
- Backlog P3s on these files - not passengers.

## Design reference

- `prototypes/editor.html` lines 104-110 (the Sections tiles and their icons
  `i-section`, `i-hero`, `i-imgtext`, `i-cta` at lines 43-46), section 1 (the
  hero: heading, lede, space, button | photo, `cols--middle`) and section 5
  (the call to action, `sec--band`).
- `blueprint/context/design.md` *Editor decisions*: the palette list, "A
  hero's heading starts as the main heading".
- The mockup's hero heading is a `.display` and its text a `.lede`; v1 has no
  such text styles, so the template uses Main heading and Text.

## Build steps

- [x] **Step 1 - The templates** - `section-templates.ts`:
  `SECTION_TEMPLATES` (`blank`, `hero`, `image-text`, `cta`) and
  `sectionTemplate(kind, { mainHeading })` returning a v4 `Section`, with unit
  tests written first. *Done when:* `npm test` shows a test per template that
  wraps it in a document and parses it with the v4 schema in `document.ts`
  without errors, asserts its columns, blocks, `align` and `background`, and
  that the hero's heading is level 1 only with `mainHeading: true`; seen red
  against the stubbed function first. **And an image with no file chosen
  saves** (found building this step: the v4 schema required a media UUID, so
  a page holding a hero could not be saved until both images were chosen -
  against D170): `parseDocument` accepts `mediaId: ""` as "not chosen yet",
  still refusing any other non-UUID with "An image needs a file from Media.";
  `documentMediaIds` skips `""`, so the media lookup never sends it to
  PostgreSQL as a UUID. Unit tests for both, seen red first.
- [x] **Step 2 - The insert transaction** - in `palette-insert.ts`:
  `insertSection(state, kind, { allowMainHeading, maxSections, maxBlocks })`
  returning a transaction or null, plus `sectionAddedAnnouncement`, with unit
  tests first. *Done when:* `npm test` proves - the section lands directly
  after the one holding the selection (first, middle and last section; a node
  selection on an image); the selection is a text cursor in the first text
  block (hero: the heading; image and text: the heading in column 2); the
  hero's heading is level 1 only when `allowMainHeading` and the document has
  no level-1 heading; `closeHistory` makes it one undo step (undo restores the
  old document exactly); null at 30 sections, and when the template's blocks
  would pass 200 while a smaller template still fits; the announcement reads
  "Hero added: now section 3 of 5." Seen red first.
- [x] **Step 3 - The Sections group** - `palette.client.tsx`: the group in the
  side panel and the dialog, the tiles calling `insertSection` and announcing
  through the editor's status, disabled with the sentence when the template
  does not fit; the dialog's new title and `h3`s. *Done when:* a Playwright
  test (`e2e/section-templates.spec.ts`, written first and seen failing on
  the missing "Hero" button) adds each of the four by click with a heading
  selected in section 1 of 2, and finds it as section 2 of 3 with its blocks
  in order (by role and toolbar name), the status saying "… added: now
  section 2 of 3.", the cursor in its first text block (typing lands there);
  Enter on the focused Hero tile does the same; one Undo removes it; on a page
  with no main heading the hero's heading is the Main heading (Text style menu
  shows it), and a second hero's is a Heading; on a post it is a Heading; at
  390px, Add -> Hero closes the dialog and adds it; a document of 30 sections
  shows every section tile disabled with the sentence.
- [x] **Step 4 - Hints for empty text** - a pure `emptyTextHint(node, parent,
  hasAnchor, entryType)` in a `.ts` file (unit-tested first), wired as the
  `Placeholder` option's function with `showOnlyCurrent: false`, and the muted
  style for an empty heading. *Done when:* unit tests cover each rule in *In
  scope* (heading levels, a paragraph with and without the cursor, alone and
  with siblings, inside a list or quote - no hint without the cursor); and a
  Playwright test shows a fresh hero's heading reading "Main heading" and its
  text "Text" in the canvas, the hint gone once typed into, and an untouched
  one-column section still showing only "Write your page…" with the cursor
  in it, and an untouched column of a two-column section still showing only
  the empty-column hint (no second, empty hint drawn over it). Seen red first.
- [x] **Step 5 - Publish a template** - no new product code expected; the
  design record and the proof that templates render as the record says.
  *Done when:* a Playwright test publishes a page with a filled-in Hero
  (heading, text, button with a page link; image left empty, as CI has no R2)
  and an untouched Call to action, and the public page shows the hero as a
  `section` with `data-align="middle"`, its heading as the only `h1`, the
  button as a link - and no `section` at all for the untouched call to
  action; a filled call to action renders with `data-background="band"`.
  `design.md` carries the four recorded decisions. `npm run verify` green and
  the full `npm run test:e2e` green locally.
- [x] **Repair F-199** - no hint in an empty list or quote line, with or without the cursor (as before 14c1); design.md's cap sentence sits "under the group's heading".
- [x] **Repair F-200** - the Sections group shows the blocks sentence only when the Blocks group does not (196-199 blocks); the 200-block test expects one.
- [x] **Repair F-201** - the 30-sections test finds the sentence inside the palette only.
- [x] **Repair F-202** - one shared `sectionFits(doc, kind, maxSections, maxBlocks)` in `palette-insert.ts`, used by `insertSection` and the tiles, unit-tested at 196-199 blocks.
- [x] **Repair F-203** - `countBlocks` and `mainHeading` move to a leaf module, ending the circular import.
- [x] **Repair F-204** - the hints' generated text gets empty alt text (`content: attr(data-placeholder) / ""`), so screen readers skip it.

## Files and areas

- `app/features/blocks/section-templates.ts`, `section-templates.test.ts` - new
- `app/features/blocks/document.ts`, `document.test.ts` (an image's `mediaId`
  may be `""`); `app/features/public-site/document-media-ids.ts`, its test
- `app/features/blocks/palette-insert.ts`, `palette-insert.test.ts`
- `app/features/blocks/palette.client.tsx`, `palette.module.css`
- `app/features/blocks/empty-text-hint.ts`, `empty-text-hint.test.ts` - new
  (or beside an existing pure module, if it fits one)
- `app/features/blocks/document-editor.client.tsx` (the `Placeholder` option,
  passing `announce` and the entry type to the palette),
  `document-editor.module.css` or `content.module.css` (the hint style)
- `e2e/section-templates.spec.ts` - new; `e2e/helpers/documents.ts` if a
  builder is missing
- `blueprint/context/design.md`

## Data and contracts

**No migration.** One contract change to v4 (D169, 14a2): an image block's
`mediaId` is a UUID **or `""`** (no file chosen yet). Stored documents stay
valid - the change only widens what is accepted. `""` renders nothing
publicly (it is never in `mediaById`) and is never looked up.

Load-bearing, locked here for 14c2 and 18b:

- **`SECTION_TEMPLATES`** - `["blank", "hero", "image-text", "cta"] as const`;
  these names are the section kinds 18b's AI output uses (D170).
- **`sectionTemplate(kind, { mainHeading: boolean }): Section`** - pure, no
  ProseMirror import, runnable on the server. 18b adds an optional slot-text
  argument; it does not change the blocks or their order.
- **`insertSection(state, kind, options)`** - 14c2's section drop reuses it
  with an explicit target index in place of "after the selection's section".

## Testing

- **Unit** (`npm test`, inside `verify`, so in CI): `section-templates.test.ts`,
  `palette-insert.test.ts`, `empty-text-hint.test.ts` - pure functions and
  ProseMirror state from the v4 schema, as `block-moves.test.ts` builds it.
- **Browser** (`npm run test:e2e`, locally and in CI's `e2e` with the
  development database; **no R2** - template images have an empty `mediaId`):
  `section-templates.spec.ts`. Role-based locators: `button` (tiles),
  `toolbar` (block names), `status`, `heading`, `link`, `region`/`section`.
- **Journeys:** 2 (Edit and publish - step 5) and 4 (Choose the main heading -
  step 3's hero rule).
- **Quality bar:** nothing it names - no hot path, no auth, no personal data;
  saves are the same documents.
- **Not automatable:** what a screen reader says for the new tiles and the
  "added" announcement - folded into the existing admin screen-reader line in
  `needs-you.md`.

## Decisions

- **A section tile inserts after the section holding the selection**, not at
  the page's end - beat appending (what "Add a section" already does, so the
  tile would add nothing but a kind) and inserting before (reading order puts
  new things after the place you are).
- **Templates hold empty blocks, never starter text** - beat placeholder copy
  ("Your headline here"), which publishes if left unedited. Editor-only hints
  make the empty blocks visible instead; AI fills them in 18b.
- **The hero includes a space before its button**, as the mockup draws it -
  D170 lists heading, text and button; the space is what separates them in
  the approved design.
- **An image with no file chosen is stored as `mediaId: ""`** - beat
  refusing the save (14a2's contract, which made every hero block its page's
  save) and dropping the block on save (the person's layout would silently
  change). D170 already says such an image shows only in the editor.
- **Empty-text hints are the editor's own decorations, not TipTap's
  `Placeholder`** (found building step 4) - `Placeholder` computes its hint
  while the editor still holds the previous document, so a hint that depends
  on the parent (the "Text" rule) went wrong once typing shifted positions.
  `blockDecorations` builds them from the new state. `Placeholder` is no
  longer used; `@tiptap/extensions` stays in `package.json` (StarterKit
  depends on it at the same pinned version). Side effect: "Write your page…"
  now draws in any empty one-column section holding the cursor, not only in
  an empty document.
- **Templates are JSON, not ProseMirror nodes** - beat building them with the
  editor's schema, which the server (18b) cannot import.

## Production needs

None - no variable, no migration, no service. (Rides the v1 deploy, D163.)

## Behaviour changes
- Adds to `editor`: a page or post holding an image with no file chosen saves; the image shows "No image chosen" in the editor and nothing on the public site (refused before, with "An image needs a file from Media.") - Step 1

- Adds to `editor`: the palette's Sections - Blank section, Hero, Image and text, Call to action - each add an ordinary section of blocks directly after the section being edited, by click, Enter or the phone's Add, announced and undone in one step - Step 3
- Adds to `editor`: a hero's heading is the page's Main heading when the page has none, otherwise a Heading; on a post always a Heading - Step 3
- Adds to `editor`: in the editor, an empty heading shows its style's name and an empty paragraph beside other blocks shows "Text" - Step 4
- Adds to `public-site`: a hero renders as a two-column section with its columns centred vertically, a call to action on a band background - Step 5

## Notes

- **Split of 14c (approved 2026-10-03):**
  - 14c1. **Ready-made sections, added from the palette** - this spec.
  - 14c2. **Dragging a section tile** - a section drop slot between sections
    beside 14b's `DropSlot`, the gap and ghost between sections, `drop`
    taking `{ template }`, its announcements.
  Why: 14b took seven steps for block drags alone; adding a second slot kind,
  between-section measuring and its announcements to these five steps makes a
  diff too large to read per step.
- Reuse, do not duplicate: `kindName` (`block-moves.ts`) for the heading
  hint's names, `mainHeading` for "has none", `countBlocks` and
  `MAX_DOCUMENT_BLOCKS`, the editor's one `announce`, `closeHistory` as
  `insertBlock` uses it.
- Semantic HTML: tiles are `button`s; group headings real headings; hints are
  decorations (CSS `::before` from `data-placeholder`), so not read as content
  and never saved.
- F-152 (keyboard selection sometimes not registered) may make Enter-on-tile
  tests flaky - select by click before pressing Enter, as 14a2's specs do.

## Prototypes kept

- `prototypes/editor.html` - the palette's rail of icons and the Contact form tile (item 19); section-tile dragging (14c2) has no mockup of its own and builds against `design.md`
- `prototypes/theme.css`, `components.css`, `components.html` - tokens and components still to build: sign-up and onboarding (15, 18), admin Home (15-19), brand and presets (18a)
- `prototypes/home.html` - the admin Home, items 15-19
- `prototypes/signup.html`, `start.html`, `start-brand.html` - sign-up and onboarding, items 15 and 18
- `prototypes/site-home.html` - brand colour, presets and wordmark on a site, item 18a
- `prototypes/fonts/` - the presets, item 18a
- `prototypes/checks/contrast.mjs` - the branded-site column, item 18a

## Findings

### 14c1-ready-made-sections/F-199 [P3] closed - Lists and quotes show the entry's placeholder in every empty line holding the cursor; neither the spec nor design.md decides it
File: app/features/blocks/empty-text-hint.ts:22

**Found:** 2026-10-03 by review (independent `reviewer` agent; scope: current, item 14c1, 8b39d6c..938e4a1; lens: all)
**Why it matters:** `if (hasAnchor) return PLACEHOLDERS[entryType]` applies to any empty paragraph, so each new bullet or quote line says "Write your page…". The unit test locks it in; design.md's hint rule and Behaviour changes do not record it. design.md:376 also says the cap sentence sits "under the group" - it renders under the heading, above the tiles.
**Suggested fix:** Return `""` when the parent is not a column (or record the list/quote rule in design.md); reword "under the group" to "under the group's heading".
**Resolution:** fixed 2026-10-03 by build - `emptyTextHint` returns "" for a paragraph whose parent is not a column (empty-text-hint.ts); design.md 14c1 group corrected. Test: empty-text-hint.test.ts list/quote case - red with the parent check removed (`actual: 'Write your page…', expected: ''`), green restored (10/10). closed by build.

### 14c1-ready-made-sections/F-200 [P3] closed - At 200 blocks the side panel says "You can have at most 200 blocks." twice
File: app/features/blocks/palette.client.tsx (`SectionTiles`); e2e/document-editor.spec.ts:1250

**Found:** 2026-10-03 by review (independent `reviewer` agent; scope: current, item 14c1, 8b39d6c..938e4a1; lens: all)
**Why it matters:** The Blocks and Sections groups both render the sentence, so a screen reader reads it twice in one landmark; the existing test was changed to expect two rather than question it.
**Suggested fix:** In `SectionTiles`, show the blocks sentence only when `blocksUsed < MAX_DOCUMENT_BLOCKS` (196-199 blocks); set the test back to one.
**Resolution:** fixed 2026-10-03 by build - `SectionTiles` shows the blocks sentence only while the Blocks group does not (palette.client.tsx). Test: e2e/document-editor.spec.ts "200 blocks disables" back to one - red with the condition neutralised (`Expected: 1, Received: 2`), green restored. closed by build.

### 14c1-ready-made-sections/F-201 [P3] closed - The 30-sections browser test's sentence check passes without the new note
File: e2e/section-templates.spec.ts:202

**Found:** 2026-10-03 by review (independent `reviewer` agent; scope: current, item 14c1, 8b39d6c..938e4a1; lens: all)
**Why it matters:** `getByText("Thirty sections is the most there can be.").first()` also matches the existing note under Add a section, so it would pass if `SectionTiles` drew no note.
**Suggested fix:** Scope it to the palette: `getByRole("complementary", { name: "Add to the page" }).getByText(...)`.
**Resolution:** fixed 2026-10-03 by build - the sentence check is scoped to the palette (`complementary` "Add to the page"). Red with `SectionTiles` drawing no note (element not found), green restored. closed by build.

### 14c1-ready-made-sections/F-202 [P3] closed - Nothing tests a part-full page, where some section tiles fit and some do not
File: app/features/blocks/palette.client.tsx (`fits`)

**Found:** 2026-10-03 by review (independent `reviewer` agent; scope: current, item 14c1, 8b39d6c..938e4a1; lens: all)
**Why it matters:** `fits()` repeats `insertSection`'s cap check instead of sharing it, and no test covers it: at 196-199 blocks Hero, Image and text and Call to action should be disabled while Blank stays enabled.
**Suggested fix:** Move the predicate into `palette-insert.ts`, share it with `insertSection` and unit-test it; or one browser test at 196 blocks.
**Resolution:** fixed 2026-10-03 by build - `sectionFits` in palette-insert.ts, used by `insertSection` and the tiles. Test: palette-insert.test.ts `sectionFits` (two blocks left: only Blank; section cap: none; room: all) - red with the template count ignored (`hero, actual: true, expected: false`), green restored. closed by build.
