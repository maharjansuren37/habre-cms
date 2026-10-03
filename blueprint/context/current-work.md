# Feature: Dragging a section tile

**From build plan:** item 14c2
**Type:** Feature
**Verified:** not yet
**Reviewed:** not yet

## Goal

Let a person drag one of the palette's four Sections tiles - Blank section,
Hero, Image and text, Call to action - to a place between sections: a gap
opens there, a ghost follows the pointer, the place is announced, and the
release adds the ready-made section there as one undo step. This finishes
item 14c: a section tile now does what a block tile does (D165, D170), and a
click, Enter or the phone's Add stay the non-drag path (WCAG 2.5.7).

## In scope

- **Dragging a section tile** (side panel, 1024px and wider) to a **section
  slot**: before the first section, between two sections, or after the last.
  A press without movement still adds the section after the selection's
  section (14c1). A disabled tile (the template does not fit) starts no drag.
- **Where it lands** - the midpoint rule over sections: above a section's
  vertical middle is before it, below is after. Anywhere over the writing
  area counts, including inside a section's columns; outside the writing
  area (the title, the palette, the settings panel, Add a section) is no
  place.
- **The gap** - the same `.dropZone` as 14b, a widget decoration between two
  sections (not stored, not focusable, `aria-hidden`), labelled "Drop
  <name> here" with the template's name in lower case ("Drop hero here",
  "Drop call to action here"). **The ghost** - the template's tile icon and
  name. **The dragged tile** - dashed (`.isDragging`), as a block tile is.
- **Dropping** reuses 14c1's `insertSection` with an explicit section index:
  the same template, the same main-heading rule (a hero's heading is the Main
  heading on a page with none), one undo step, the cursor in the new
  section's first text block, the writing area focused.
- **Announcements** in the editor's one polite `role="status"`, only when the
  text changes - wording in Notes.
- **Ending a drag** - everything 14b's controller already does: Escape, a
  release outside the writing area, `pointercancel` or a document change
  mid-drag cancels ("Drag cancelled."); auto-scroll near the window's bottom
  or the sticky bar's lower edge; the toolbar and chip hidden while dragging;
  the drag never also fires the tile's click.

## Out of scope

- **Dragging existing sections** - not in the design record; a section moves
  from its chip (14a3). Not planned.
- **Dragging from the phone's Add dialog** - modal over the canvas, as for
  blocks (14b); tapping a section tile adds it (14c1).
- **A section tile dropped into a column, or replacing an untouched page's
  one empty section** - a section lands only between sections, and never
  replaces one: a click (14c1) does not replace either.
- **Keyboard drag** - Enter on a tile is the keyboard path.
- The palette's rail of icons; backlog P3s on these files (F-193, F-195 and
  others in `blueprint/findings/backlog.md`) - not passengers.

## Design reference

- No mockup draws a section tile mid-drag (`prototypes/editor.html` draws an
  Image tile, 14b). This builds against `design.md` *Editor decisions* -
  *Dragging*, *Built in item 14b*, *Built in item 14c1* - and the 14b gap and
  ghost (`block-drag.module.css`), unchanged in look.
- **Not in the record, decided here** (written into `design.md` in step 4):
  - a section slot is chosen by the midpoint rule over whole sections, over
    the whole writing area;
  - the gap sits between sections and is the block gap's look and size;
  - the dashed line between two sections is not drawn beside the gap (the
    gap itself marks the boundary);
  - the announcement wording in Notes.

## Build steps

- [x] **Step 1 - Section slots as pure functions** - in
  `palette-insert.ts`: `insertSection` takes an optional `index` (the new
  section's index, `0..childCount`; absent: after the selection's section, as
  now). In `block-drops.ts`: `SectionSlot = { index }`, `DropSource` gains
  `{ template: SectionTemplate }`, `sectionSlotAt(sections, area, x, y)` -
  pure geometry over the sections' measured rects and the writing area's rect
  - and the announcement builders (Notes): `sectionHoverAnnouncement`,
  `sectionDropZoneLabel`; the dropped announcement is 14c1's
  `sectionAddedAnnouncement`. Unit tests first. *Done when:* `npm test`
  proves - `insertSection` with `index` 0, a middle index and `childCount`
  puts the section there, cursor in its first text block, one undo step
  (undo restores the document exactly), the hero's heading level 1 only with
  `allowMainHeading` and no main heading, null at 30 sections or past 200
  blocks; without `index` the 14c1 tests pass unchanged; `sectionSlotAt` -
  above / below a section's middle in a three-section page, inside a section's
  column, in the space between two sections, above the first section's top
  inside the area (0), below the last (`count`), outside the area (null); each
  announcement and label's wording; seen red against stubs first; `npm run
  verify` green.

- [x] **Step 2 - Dragging a section tile** - `block-drag.client.tsx`: the
  controller takes `{ template }` through the same `startDrag`; for it,
  `measure` reads the sections and the writing area, the gap plugin places a
  widget at the slot's top-level position, the ghost shows the template's icon
  (exported from `palette.client.tsx` beside `KIND_ICONS`), and the release
  dispatches `insertSection` with the slot's index and announces. Section
  tiles in the side panel get `onPointerDown` and the dashed state;
  `draggingTile` widens to a block kind or a template. A disabled tile never
  calls `startDrag` (Chromium sends pointer events to a disabled `button`).
  *Done when:* new
  `e2e/section-drag.spec.ts`, Playwright's mouse in several moves, on a seeded
  page of sections `[A]`, `[B]`, `[C]` - written first and seen failing on the
  missing gap: drag the Hero tile to between A and B - while held, a gap reads
  "Drop hero here" between them (a direct child of the writing area, not in a
  column), a ghost reads "Hero", the Hero tile is dashed, the status reads
  "Hero: drop as section 2 of 4."; release - the stored document is A, a hero
  section (two columns, heading, text, space, button | image), B, C; the
  status reads "Hero added: now section 2 of 4."; typing lands in the hero's
  heading; the hero's heading is the Main heading (Text style menu) on this
  page with none; one Ctrl+Z restores A, B, C; dragging Call to action above
  A lands it first, below C lands it last; over the palette the status reads
  "Hero: release to cancel." and a release there stores nothing and says
  "Drag cancelled."; Escape mid-drag stores nothing; while dragging, no
  `toolbar` and no section chip is visible; after every drop or cancel no
  gap, ghost or dashed tile is left; a click on the Hero tile without moving
  still adds it after the selection's section (14c1's tests pass); the
  writing area is still the only `textbox`; Save stores no gap.

- [x] **Step 3 - Long pages, the policy, the journey** - no new product code
  expected. *Done when:* `section-drag.spec.ts` - on a seeded page of 12
  sections taller than the viewport, dragging the Blank section tile to the
  window's bottom edge scrolls until the last section is reachable, and the
  release below it stores a blank section as section 13; after typing in A,
  Ctrl+Z while dragging a tile undoes the typing, cancels ("Drag
  cancelled.") and the release stores nothing; at 30 sections every section
  tile is disabled and a press-and-move on one shows no ghost and no gap;
  `content-security-policy.spec.ts`'s admin test also drags a section tile
  with no violation (policy unchanged); **journey 2 end to end** - open the
  page (by a full page load, and through Admin -> Pages -> its title) -> drag
  a Call to action tile below the last section -> type its heading "Join us"
  -> Publish -> the URL is the pages list -> the public page shows a
  `section` with `data-background="band"` holding "Join us", last on the page.

- [ ] **Step 4 - The record** - `design.md` *Editor decisions*: a "Built in
  item 14c2" block with the decided-here lines and the wording; the
  "(dragging one is 14c2)", "sections do not drag (14c2)" and "Section tiles
  do not drag yet (14c2)" phrases replaced. *Done when:* `design.md` carries
  them, `npm run verify` is green, and the whole browser suite passes
  (`npm run test:e2e` locally with R2; CI's `e2e` with `E2E_SKIP_R2=1`).

## Files and areas

- `app/features/blocks/palette-insert.ts` (+ `.test.ts`) - `insertSection`'s
  `index` (step 1).
- `app/features/blocks/block-drops.ts` (+ `.test.ts`) - `SectionSlot`,
  `{ template }`, `sectionSlotAt`, wording (step 1).
- `app/features/blocks/block-drag.client.tsx` (435 lines),
  `block-drag.module.css` - the controller's section branch, the gap between
  sections, the ghost (step 2).
- `app/features/blocks/palette.client.tsx` - section tiles drag; their icons
  exported (step 2).
- `e2e/section-drag.spec.ts` - new; `e2e/content-security-policy.spec.ts`;
  `e2e/helpers/documents.ts` if a several-section builder is missing.
- `blueprint/context/design.md` (step 4).

## Data and contracts

**None changes.** No migration; the v4 document is untouched - the gap is a
decoration and never reaches `getJSON()`.

Extended, load-bearing (14b and 14c1 locked them for this item):

- **`DropSource`** - `{ kind } | { pos } | { template: SectionTemplate }`;
  `startDrag(source, event)` stays the one entry point.
- **`SectionSlot`** - `{ index }`, from 0, an insertion point before
  top-level section `index` (`0..childCount`). Beside `DropSlot`, which is
  unchanged.
- **`insertSection(state, kind, { allowMainHeading, maxSections, maxBlocks,
  index? })`** - `index` absent keeps 14c1's "after the selection's section".
  `drop()` does **not** take `{ template }`: a section's slot is a different
  shape, and 14c1 locked `insertSection` as what a section drop reuses (see
  Decisions).

## Testing

- **Unit** (`npm test`, inside `verify`, so in CI): `palette-insert.test.ts`,
  `block-drops.test.ts` - ProseMirror state from the v4 schema as
  `block-moves.test.ts` builds it; `sectionSlotAt` over plain rects.
- **Browser** (`npm run test:e2e`, locally and in CI's `e2e` with the
  development database; **no R2** - template images have an empty
  `mediaId`): `section-drag.spec.ts` (steps 2-3) with `page.mouse.down /
  move / up` in several steps past the 6px threshold;
  `content-security-policy.spec.ts` (step 3). Role-based locators: `button`
  (tiles), `status`, `textbox`, `toolbar`, `heading`; the gap and ghost are
  `aria-hidden`, so located by `[data-drop-zone]` / `[data-drag-ghost]`.
- **Journeys:** 2 (step 3); 4 (choose the main heading) through the hero
  rule (step 2).
- **Quality bar:** nothing it names - no hot path, no auth, no personal data;
  saves are the same documents.
- **Not automatable:** what a screen reader says while a section tile drags -
  added to the admin screen-reader line in `needs-you.md`.

## Decisions

- **A section drop reuses `insertSection` with an index, not `drop()`** -
  beat widening `drop()` to `{ template }` as 14b's note suggested: `drop()`
  works on a `DropSlot` in a column, and a section slot has no column; two
  functions over two slot shapes beat one with a type switch inside.
  `DropSource` still gains `{ template }`, since the controller's one entry
  point is what 14b locked.
- **A section slot is chosen by the midpoint rule over whole sections,
  anywhere over the writing area** - beat a thin strip between sections
  (hard to hit with a finger or at 200% zoom) and the block slots' "inside a
  section only" (a section tile cannot land inside one). Stable while the gap
  opens, as 14b's rule is.
- **A dropped section never replaces an untouched one** - a click does not
  (14c1), and replacing would make a drop on a new page lose the section the
  cursor was in.
- **The gap is the block gap's look**, labelled with the template's name in
  lower case - beat a taller, section-sized gap: the tile is already named in
  the ghost and the status, and one look for "something lands here" is the
  record's intent.

- **`useBlockDrag` takes `{ entryType, maxSections }`** (found building step
  2) - the controller now drops sections itself, so it needs the page/post
  rule and the cap; beat routing the drop back through the palette's
  `addSectionFrom`, which would split one drag across two components.
- **Typing straight after a drop joins its undo step** (observed building
  step 2) - ProseMirror groups changes within 500ms, so a Ctrl+Z after
  typing at once removes the section and the typing together. The same holds
  for 14c1's click and 14b's drops; not changed here. The Undo test drops
  without typing.

## Production needs

None - no variable, no migration, no service. (Rides the v1 deploy, D163.)

## Behaviour changes

- Adds to `editor`: a palette section tile can be dragged to before, between or after sections, with a gap labelled "Drop <name> here" where it will land, the place announced, the section added there and one Undo removing it - Step 2

## Notes

- **Announcements** (`<Name>` is `SECTION_TEMPLATE_NAMES`: Blank section,
  Hero, Image and text, Call to action; positions count after the drop):
  - Over a place: `Hero: drop as section 2 of 4.`
  - Over no place: `Hero: release to cancel.`
  - Dropped: `Hero added: now section 2 of 4.` (14c1's wording)
  - Cancelled: `Drag cancelled.`
  - The cap, should a drop find no room: the palette's sentence -
    `Thirty sections is the most there can be.` or
    `You can have at most 200 blocks.`
- **The gap's label:** "Drop blank section here", "Drop hero here", "Drop
  image and text here", "Drop call to action here".
- **The gap between sections** is a widget at a top-level position
  (`side: -1`), a direct child of the writing area. It breaks the
  `section + section` selector that draws the dashed line between sections,
  so the line is absent beside the gap with no CSS change - which is what is
  wanted.
- Reuse, do not duplicate: 14b's controller, threshold, auto-scroll, click
  swallowing and cancel paths; 14c1's `sectionFits`, `SECTION_TEMPLATE_NAMES`,
  `sectionAddedAnnouncement`, `SECTIONS_FULL_NOTE`, `CAP_SENTENCE`.
- Placement stays CSSOM (`element.style.translate`); no `style` attribute in
  markup, or the CSP test fails.
- F-152 (keyboard selection sometimes unregistered) - select by click before
  dragging, as 14b's specs do.
- `block-drag.client.tsx` grows; if the section branch passes ~100 lines,
  split the measuring into a sibling `.ts` rather than growing the controller.
