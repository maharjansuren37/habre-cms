# Feature: The palette and drag and drop

**From build plan:** item 14b
**Type:** Feature
**Verified:** not yet
**Reviewed:** not yet

## Goal

Let a person drag a block from the palette into any column, and drag the
selected block by its grip to anywhere a palette block can go - a gap opening
where it will land, a ghost following the pointer, the place announced - and
give the toolbar Duplicate. This is D165's Mailchimp-style editing; Move up /
Move down and Enter on a tile (14a2, 14a3) stay the non-drag path (WCAG 2.5.7).

## In scope

- **Dragging a palette tile** (side panel, 1024px and wider) into a column:
  between two blocks, or at a column's top or bottom. A press without
  movement still adds the block after the selected one (14a2).
- **Dragging the selected block** by the grip at the start of its toolbar, to
  any place a tile can go - across columns and sections, one transaction, one
  undo step.
- **The drop gap** - a `.drop-zone` labelled "Drop <kind> here" ("Drop image
  here") opening where the block will land; **the ghost** - the kind's icon
  and name, following the pointer; **the dragged tile** drawn dashed
  (`.tile.is-dragging`), **the dragged block** dimmed in place.
- **Announcements** in the existing polite `role="status"` (14a3), only when
  the place changes - wording in Notes.
- **Ending a drag:** release over a place drops; Escape, a release outside
  the page, `pointercancel` or a document change mid-drag cancels; release on
  the block's own place changes nothing.
- **Auto-scroll** while dragging near the top or bottom of the window, so a
  block can reach any section of a long page.
- **Duplicate** in the toolbar of every kind, named for it ("Duplicate
  heading"): a copy just after the block, selected, announced, one undo step.
- **The cap** (200 blocks): a drag or Duplicate that would add a block past
  it is refused with the palette's sentence.
- **Touch on the grip** - Pointer Events cover mouse, pen and touch alike;
  the grip sets `touch-action: none` so a drag does not scroll the page.

## Out of scope

- Dragging or dropping **sections**, and the palette's **Sections** tiles
  (Blank section, Hero, Image and text, Call to action) - **14c**. A section
  moves from its chip (14a3).
- Dragging from the **phone's Add dialog** - it is modal over the canvas;
  tapping a tile adds the block, as in 14a2. The grip still drags at any
  width.
- A grip on unselected blocks (hover handles) - not in the record; select,
  then drag.
- The palette collapsing to a rail of icons (design.md *Palette*) - not built
  yet and not this item's; noted for whichever item narrows the palette.
- ProseMirror's own drag and drop of selected **text**, and files or text
  dropped from outside the browser - unchanged.
- Keyboard drag (pick up, arrow, drop) - Move up / Move down are the keyboard
  path (14a3).
- Backlog P3s on these files (F-178, F-180, F-184-F-192) - not passengers.

## Design reference

- `prototypes/editor.html` (default state) - an Image tile mid-drag
  (`.tile.is-dragging`), the gap at the top of a column (`.drop-zone`,
  `.drop-zone__label` "Drop image here"), the ghost (`.drag-ghost`, icon and
  "Image"), and the selected button's toolbar with `.block-toolbar__grip`
  ("Drag to move, or use Move up and Move down") and Duplicate.
- `prototypes/components.css` - `.tile.is-dragging`, `.drop-zone`,
  `.drop-zone__label`, `.drag-ghost`, `.block-toolbar__grip`.
- `blueprint/context/design.md` *Editor decisions* (*Dragging*, *The selected
  block*), *Journeys* 2 and 3, *Accessibility bar* (2.5.7). Colours: the
  gap's label is `--color-selection` / `--color-on-selection` and the ghost
  surface / text - both pairs already measured; no new contrast pair.
- **Not in the record, decided here** (written into `design.md` in step 7):
  - **The announcement names positions, not columns.** The mockup's
    "Drop at the top of column 2, Portraits, in section 3." names a column by
    its content; columns have no names, and 14a3 locked `describePosition`'s
    wording for drops. Wording in Notes.
  - **The grip is pointer-only and out of the toolbar's arrow order**
    (`tabindex="-1"`): a `button` named as the mockup names it; a press
    without dragging announces its name. Move up and Move down sit right
    beside it. Keeps the toolbar's single tab stop landing on Move up (F-183).
  - **The block's own place is not a drop target** - no gap there, and
    releasing changes nothing.
  - **The gap is a decoration inside the writing area** (not focusable, not
    stored, `aria-hidden`) - the only way it can "open" and push the blocks
    below it down. Plan section 6 says drop gaps are drawn outside the
    editable area; see Decisions and the proposed plan edit.
  - **No dragging from the phone's Add dialog.**

## Build steps

- [x] **Step 1 - Drops and duplicates as pure functions** - new
  `app/features/blocks/block-drops.ts` (+ `block-drops.test.ts`), no React,
  `@tiptap/pm/*` only; `palette-insert.ts` exports `newBlock`. Contents:
  `DropSlot = { section, column, index }` (an insertion point before the
  column's child `index`, `0..childCount`); `slotAt(columns, x, y)` - pure
  geometry over measured rects (the midpoint rule, Notes) returning a slot or
  null; `drop(state, source, slot, maxBlocks)` where `source` is
  `{ kind: PaletteKind }` or `{ pos }`, returning `{ tr, pos }`, `"in-place"`
  or `"full"`; `duplicateBlock(state, maxBlocks)`; and the announcement
  builders (Notes). Every transaction is one undo step (`closeHistory`), keeps
  the placeholder rule both ends, and selects the landed block (a
  `NodeSelection` for an atom, the cursor at its start for text). *Done
  when:* `npm test` passes tests for: a tile dropped between two blocks, at a
  column's top and bottom, and into an untouched column (replacing its empty
  paragraph); a block dropped into another column and another section, its
  old column keeping a paragraph if it empties; the two slots beside the
  block itself return `"in-place"`; `"full"` at 200 for a tile and for a move
  that would leave a placeholder, while a pure reorder at 200 still drops; a
  list drops whole; a dropped main heading stays level 1 through
  `keepOneMainHeading`; Duplicate puts a copy after the block, selected, with a
  main heading's copy demoted to a Heading by `keepOneMainHeading`;
  Duplicate at 200 returns null; `slotAt` - above / below a block's midpoint,
  between two side-by-side columns (the nearer), stacked columns, in a
  section's padding (its column's top or bottom slot), outside every column
  (null); each announcement's wording with one and with three columns - and
  `npm run verify` is green.

- [x] **Step 2 - Duplicate** - a Duplicate button before Delete in every
  kind's toolbar, named for the kind, using step 1; announced; at 200 it is
  `aria-disabled` and pressing it announces the palette's sentence. *Done
  when:* `e2e/block-toolbar.spec.ts`, keyboard only: on a page `[A, B]`,
  cursor in A, Tab to the toolbar, arrow to "Duplicate text", Enter - the
  stored column is `[A, A, B]`, the status reads "Text duplicated: block 2 of
  3 in section 1.", the copy holds the selection; one Ctrl+Z restores
  `[A, B]`; duplicating a page's main heading stores one level-1 and one
  level-2 heading; duplicating a line selects the copy (its ring); the
  existing toolbar tests pass (F-183's "starts at Move up" included).

- [ ] **Step 3 - Dragging the selected block** - new
  `app/features/blocks/block-drag.client.tsx`: the drag controller, owned by
  `DocumentEditor` (not the toolbar, which re-renders as the selection
  moves); the grip (`button`, `tabindex="-1"`, `touch-action: none`,
  pointer capture); the gap as a widget decoration set by a plugin whose
  transactions change no document and add no history; the ghost placed with
  CSSOM; the block dimmed; the block toolbar and section chip hidden while
  dragging, so they cover no drop place; the status per Notes, only when the
  slot changes; the drop through step 1; Escape, a release outside the page
  and `pointercancel` cancel; the cap's sentence. A drag starts after 6px of
  movement. *Done when:* new `e2e/block-drag.spec.ts`, with Playwright's
  mouse, on a seeded page `[[A, B] | [C]]` + `[[D]]`: select A, drag the
  grip to below C - while held, a gap reads "Drop text here" below C, a ghost
  reads "Text", the status reads "Text: drop at block 2 of 2 in column 2 of
  section 1." (C's column then holding C and A); release - the stored
  document is `[[B] | [C, A]]` + `[[D]]`, the status reads "Text moved: block
  2 of 2 in column 2 of section 1.", A is selected with its toolbar; one
  Ctrl+Z restores the page; dragging B into section 2's top lands it first
  there and leaves column 1 an empty paragraph with its hint; hovering A's
  own place shows no gap and releasing there stores nothing new; Escape
  mid-drag stores nothing and the status reads "Drag cancelled."; releasing
  over the palette stores nothing; while dragging, no `toolbar` and no
  section chip is visible, and both return on release; dragging a page's
  main heading keeps it level 1; a press on the grip without moving
  announces "Drag to move, or use Move up and Move down." and moves nothing;
  after every drop or cancel no gap, ghost or dimmed block is left in the DOM;
  the writing area is still the only `textbox`; Save stores no gap.

- [ ] **Step 4 - Dragging a palette tile** - the tiles start the same
  controller with `{ kind }`; the tile is drawn dashed while it drags; a
  press without movement still adds after the selected block, and a drag
  never also fires the click. *Done when:* `block-drag.spec.ts`: drag the
  Image tile to the top of column 2 - the gap reads "Drop image here", the
  ghost "Image", the status "Image: drop at block 1 of 2 in column 2 of
  section 1."; release stores an image block first in column 2, selected, its
  settings panel open (14a2's rule); one Ctrl+Z removes it; dropping a Text
  tile into an untouched column replaces its paragraph; a click on the Line
  tile still adds one line after the selected block (14a2's test passes);
  **journey 2 end to end** - open the page (by a full page load, and through
  Admin -> Pages -> its title) -> drag a Text tile into section 1 -> type
  "Dragged in" -> Publish -> the URL is the pages list -> the public page
  shows "Dragged in" where it was dropped. (The record's "Home" and "View
  site" arrive with items 15-19; there is no View link yet.)

- [ ] **Step 5 - Long pages and the policy** - auto-scroll: within 48px of
  the window's bottom, or of the sticky top bar's lower edge, the window
  scrolls each animation frame, faster nearer the edge, and the slot is
  re-measured after it; a document change mid-drag cancels. The admin CSP
  test drags. *Done when:* on a seeded page of 12 sections taller than the
  viewport, dragging section 1's first block to the window's bottom edge
  scrolls until section 12 is reachable, and dropping there stores it in
  section 12; after typing in A, pressing Ctrl+Z while dragging B undoes the
  typing, cancels the drag ("Drag cancelled."), and the release stores
  nothing more; `content-security-policy.spec.ts`'s admin test also drags a
  tile and a block with no violation (the policy is unchanged: no
  `'unsafe-inline'`, no `data:`).

- [ ] **Step 6 - Narrow widths and touch** - the grip drags at every width;
  the gap and ghost fit a 390px canvas; the phone's Add dialog is unchanged.
  *Done when:* at 390px with `hasTouch`, pointer events of `pointerType:
  "touch"` dispatched on the grip move a block to another section (stored),
  the window does not scroll during it except by auto-scroll, and there is no
  horizontal scroll with the gap open; journey 3 (14a3's tests) and the Add
  dialog's tests pass unchanged.

- [ ] **Step 7 - The record** - `design.md` *Editor decisions*: a "Built in
  item 14b" block with the "decided here" lines and the announcement wording;
  the toolbar line's "The drag handle and Duplicate come with 14b" replaced;
  plan section 6's drop-gap line as approved at this gate. *Done when:* both
  files carry those lines, and `npm run verify` and the whole browser suite
  pass (`npm run test:e2e` locally with R2; CI's `e2e` with `E2E_SKIP_R2=1`).

## Files and areas

- `app/features/blocks/block-drops.ts` (+ `.test.ts`) - new, step 1.
- `app/features/blocks/palette-insert.ts` - export `newBlock` (step 1).
- `app/features/blocks/block-drag.client.tsx` (+ `.module.css`) - new: the
  controller, gap plugin, ghost (steps 3-6). The editor file is 1,186 lines.
- `app/features/blocks/block-toolbar.client.tsx` (+ CSS) - grip, Duplicate.
- `app/features/blocks/document-editor.client.tsx` - mounts the controller
  and the gap plugin; hands the grip and tiles their start function.
- `app/features/blocks/palette.client.tsx` (+ CSS) - tiles start a drag;
  their icons exported for the ghost.
- `e2e/block-drag.spec.ts` - new; `e2e/block-toolbar.spec.ts` (Duplicate);
  `e2e/content-security-policy.spec.ts`; `e2e/helpers/documents.ts` if a
  builder is missing.
- `blueprint/context/design.md`; `blueprint/project-plan.md` section 6
  (approved at this gate).

## Data and contracts

**None changes.** No migration; the v4 contract is untouched - the gap is a
decoration and never reaches `getJSON()`.

Locked here for 14c, which drops section tiles:

- **`DropSlot`** - `{ section, column, index }`, counted from 0, `index` an
  insertion point before that child. 14c adds a section slot (between
  sections) beside it rather than changing this one.
- **`drop(state, source, slot, maxBlocks)`** - `source` is `{ kind }` or
  `{ pos }`; 14c adds `{ template }`.
- **The drag controller's start function** - `startDrag(source, event)`, the
  one entry point for tiles and the grip.

## Testing

- **Unit** (`npm test`, inside `verify`, so in CI): `block-drops.test.ts` -
  step 1's list, pure ProseMirror state from the v4 schema as
  `block-moves.test.ts` builds it; `slotAt` over plain rect objects.
- **Browser** (`npm run test:e2e`, locally and in CI's `e2e` with the
  development database; **no R2** - images use an empty `mediaId`, as the
  palette inserts them): `block-drag.spec.ts` (steps 3-6) with
  `page.mouse.down/move/up`, which Chromium delivers as pointer events, moving
  in several steps so the 6px threshold is passed; step 6 dispatches touch
  pointer events. `block-toolbar.spec.ts` (step 2),
  `content-security-policy.spec.ts` (step 5). Role-based locators: `button`,
  `toolbar`, `status`, `textbox`; the gap and ghost are `aria-hidden`, so
  located by text inside the canvas.
- **Journeys:** 2 (step 4), 3 unchanged (step 6).
- **Quality bar:** nothing it names is touched - no hot path, no auth, no
  personal data, saves unchanged in size.
- **Not automatable** (`needs-you.md`): a drag on a real phone, and what a
  screen reader says while dragging.

## Decisions

- **Pointer Events, not HTML5 drag and drop, and no library.** Beats native
  drag and drop: touch support is uneven, the browser draws its own drag
  image rather than the design's ghost, and ProseMirror's drop handler would
  insert the drag's data as text when it lands in the writing area. Beats
  dnd-kit or Pragmatic drag and drop: a runtime dependency (each is a
  recorded decision) that knows DOM lists, not ProseMirror positions.
- **The gap is a widget decoration inside the writing area** - not focusable,
  not stored, `aria-hidden`, `contenteditable="false"`. Beats an overlay
  outside it (the plan's line): an overlay cannot open a gap, only draw a
  line over content. D169's rule - nothing interactive in the writing area -
  holds; the 14a3 empty-column hint set the precedent.
- **The midpoint rule** for where a drop lands: above a block's vertical
  middle is before it, below is after; hit-testing reads the live block
  rects, skipping the gap. Stable while the gap pushes blocks down, so the
  target does not flicker.
- **A drag starts after 6px of movement.** A shorter press is a click: a tile
  adds its block, the grip announces itself.
- **Only the grip drags a block**, and only the selected block has one.
  Beats dragging an atom by its body or text by its block (a press in text
  starts a text selection) and hover grips (not in the record).
- **The block's own place is no target**, and a release there makes no undo
  step.
- **Duplicate selects the copy**, after the original; a main heading's copy
  is a Heading (the 14a3 guard keeps the original by identity).
- **Drop announcements reuse `describePosition`**, describing where the block
  will be once dropped. Beats the mockup's column names: columns have none.
- **Any change to the document mid-drag cancels the drag** (a Ctrl+Z, say),
  so a stale position is never used.

## Production needs

None. No migration, environment variable, account or service.

## Behaviour changes

- Adds to `editor`: a palette block can be dragged into any column - between blocks or at either end - with a gap labelled "Drop <kind> here" where it will land, the place announced, and one Undo removing it - Step 4
- Adds to `editor`: the selected block can be dragged by its toolbar's grip to any place a palette block can go, as one undo step; Escape or a release outside the page cancels, and a release on its own place changes nothing - Step 3
- Adds to `editor`: Duplicate in the toolbar puts a copy after the selected block, selects it and says so, and Undo removes it; a page's main heading's copy is a Heading - Step 2

## Notes

- **Announcements** (the one polite `role="status"`, only when the text
  changes; `<Kind>` is `kindName` - Text, Heading, Main heading, Image...):
  - Over a place: `Image: drop at block 1 of 2 in column 2 of section 1.` -
    the block's position as it will be after the drop.
  - Over its own place: `Heading: drop here to leave it in place.`
  - Over no column: `Image: release to cancel.`
  - Dropped: `Image added: block 1 of 2 in column 2 of section 1.` /
    `Heading moved: block 2 of 2 in section 1.`
  - Cancelled: `Drag cancelled.`
  - Duplicate: `Heading duplicated: block 2 of 3 in section 1.`
  - The cap: the palette's `You can have at most 200 blocks.`
  - Grip pressed without a drag: `Drag to move, or use Move up and Move down.`
- **The gap's label** is "Drop <kind> here" in lower case ("Drop main heading
  here", "Drop text here").
- **Placement:** the ghost and the toolbar are positioned with CSSOM
  (`element.style.translate`), which `style-src 'self'` allows; never a
  `style` attribute in markup, or the CSP test fails (14a3 step 8).
- **The gap plugin's transactions** carry a meta, change no document and set
  `addToHistory: false`, so `onUpdate` does not fire and the form is not
  marked changed by a drag that is cancelled.
- **Hit-testing** runs at most once per animation frame; the document changes
  only on release.
- **Cleanup:** the controller removes its listeners, the ghost and the gap on
  drop, cancel and unmount; pointer capture is released.
- **Reduced motion:** the gap opens and the ghost moves without transitions.
- **TipTap 3.31.4** is newer than memory: read the installed types for
  `Decoration.widget`, plugin `state` and `view`, and `setMeta` before using
  them.
- `block-drops.ts` imports only `@tiptap/pm/*` and `palette-insert.ts`, so
  `node --test` runs it.
- **Backlog:** 37 open or unverified P3s sit in
  `blueprint/findings/backlog.md`. Offered as a tidy fix before this item;
  the owner chose 14b first (2026-10-03).
- **Delegation:** step 1's tests and step 7 suit `implementer`; steps 2-6 are
  design work for the main session; `reviewer` for `review`.
- Branch: `feature/14b-drag-and-drop`.
