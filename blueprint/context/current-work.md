# Feature: The block toolbar

**From build plan:** item 14a3
**Type:** Feature
**Verified:** not yet
**Reviewed:** not yet

## Goal

Give the selected block its rust ring and its own toolbar - Move up / Move
down, the Text style menu with Main heading, Bold, Italic, Link and Delete -
and give the section chip Move section up / down, every move announced. This
is the non-drag path WCAG 2.5.7 needs before 14b adds dragging, and it is how
a page gets its one main heading (D166). The interim format bar goes.

## In scope

- **The selected block** - the column's direct child holding the selection
  (the whole list or quote, never a part of it; `palette-insert.ts`'s rule):
  a 2px `--color-selection` ring, drawn by a decoration (nothing interactive
  inside the writing area, D169).
- **The block toolbar** - `role="toolbar"` named for the block's kind
  ("Heading", "Button"), drawn outside the writing area above the block and
  placed by script as the chip is; it wraps on a phone. Contents by kind:
  - Text and heading: Move up, Move down | Text style, Bold, Italic, Link |
    Delete.
  - List: Move up, Move down | Bulleted list, Numbered list, Bold, Italic,
    Link | Delete.
  - Quote: Move up, Move down | Bold, Italic, Link | Delete.
  - Image, button, line, space: Move up, Move down | Delete.
- **Move up / Move down** in reading order across columns and sections
  (Decisions), one transaction each, the new position announced.
- **Delete** - named for the kind ("Delete heading"), one transaction,
  announced, Undo restores it.
- **The Text style menu** - a menu button showing the current style, a
  `role="menu"` of `menuitemradio`s each drawn at its own size: Text, Main
  heading (pages only, for one selected block - never a range - with the hint "One per page. Now: "…""), Heading,
  Subheading, Small heading.
- **Main heading** - level 1 on pages: choosing it makes the previous main
  heading a Heading in the same transaction and announces that; a guard keeps
  a paste or a typed `# ` from making a second one.
- **The section chip's final shape** - label, Move section up, Move section
  down, Section settings, Remove section; moves announced.
- **The format bar is removed**; Undo and Redo move into the editor's top bar
  at every width.
- **The admin Content-Security-Policy drops `'unsafe-inline'` styles and
  `data:` images** - the re-check the plan (section 6) parked until after
  14a3.
- F-165 (the Text style select's hidden label) closes by construction: the
  select is replaced by a menu button that shows its value.

## Out of scope

- The drag handle, dragging, the drop gap, the ghost, Duplicate - **14b**.
  The toolbar leaves their places empty rather than drawing dead buttons.
- Ready-made sections and a hero's heading starting as the main heading -
  **14c**.
- H5-H6 in the menu - **item 20** (Pro).
- Keyboard shortcuts for moving a block (e.g. Alt+Shift+Up) - not in the
  record; Move up / Move down are the keyboard path.
- A Settings button in the toolbar - the panel still opens on selecting an
  image or button (14a2).
- F-152 (a keyboard selection sometimes not registered, Bold applies to
  nothing) - its test moves with Bold to the toolbar unchanged; the repair is
  its own fix. F-178 (gear, then clicking the selected image keeps the
  section panel) - backlog. Neither is a passenger.

## Design reference

- `prototypes/editor.html#heading` - the selected heading, its
  `.block-toolbar` (`role="toolbar"`, `aria-label="Heading"`), the open Text
  style menu (`.menu.block-menu`, `menuitemradio`, `.style-main` /
  `.style-heading` / `.style-subheading` / `.style-small`, the Main heading
  hint). `editor.html` (default) - a selected button's toolbar; the section
  chip with Move section up / down and Section settings; Undo / Redo in
  `.editor__bar`.
- `prototypes/components.css` - `.blk`, `.blk.is-selected`, `.block-toolbar`,
  `.block-toolbar__sep`, `.block-menu`, `.section-chip`.
- `blueprint/context/design.md` *Editor decisions* (selected block, Text style
  menu, Section controls), *Journeys* 3 and 4, *Accessibility bar* (36px
  toolbar and chip buttons; "bg on text-muted" for a pressed toolbar button,
  already measured - no new contrast pair).
- **Not in the record, decided here** (written into `design.md` in step 9):
  - A list's toolbar offers Bulleted list / Numbered list in place of Text
    style; a quote's has no style control. Without this, removing the format
    bar would leave numbered lists unreachable but by typing `1. `.
  - Undo and Redo stay visible at every width - the mockup hides them below
    1024px, which leaves a phone with no undo at all. **The record is wrong
    here**, not inconvenient.
  - Move up / Move down at the first / last position are `aria-disabled`, not
    `disabled`, so focus stays on the button; pressing does nothing.
  - The toolbar is one tab stop (arrow keys, Home, End move within it, the
    ARIA toolbar pattern); Escape returns focus to the writing area with the
    selection kept.
  - The chip keeps Remove section (the mockup has none; nothing else removes
    a section).
  - Announcement wording (Notes).
  - **The empty-column hint:** in a section of two or three columns, an
    untouched column (one empty paragraph) shows "Empty column - add a block
    or change Columns in Section settings." in `--color-text-muted`, whether
    or not the cursor is in it. Editor only; the public site draws nothing.
    A one-column section keeps the page's "Write your page…" placeholder.

## Build steps

- [x] **Step 1 - Moves and deletes as pure functions** - new
  `app/features/blocks/block-moves.ts` (+ `block-moves.test.ts`), no React:
  `selectedBlock(state)` (position, kind, section / column / index, or none
  for a gap cursor); `moveBlock(state, "up" | "down")` and
  `moveSection(state, index, "up" | "down")` returning a transaction or null
  at an end; `deleteBlock(state)`; `describePosition(doc, pos)` building the
  announcement; `keepOneMainHeading(oldState, newState, entryType)` (the
  guard, Decisions). Every transaction is one undo step (`closeHistory`) and
  keeps the selection inside the moved block at the same offset. *Done when:*
  `npm test` passes tests for: up/down within a column; down from a column's
  last block lands first in the next column, and from a section's last column
  first in the next section; up mirrors it; null at the document's first and
  last positions; a move into an untouched column replaces its empty
  paragraph and a move out of a column's only block leaves one; a move that
  would pass 200 blocks returns null (the status then reads the palette's
  200-block sentence); delete of a column's only block leaves
  an empty paragraph; a list moves whole; a NodeSelection atom moves and stays
  selected; section moves keep content and selection; `describePosition`'s
  wording with one and with three columns; the guard keeps the earlier main
  heading when a second arrives, keeps the new one when the menu demoted the
  old in the same transaction, and demotes every level-1 heading in a post -
  and `npm run verify` is green.

- [x] **Step 2 - The ring, the toolbar, Move and Delete** - the selection
  decoration (ring), `BlockToolbar` in a new `block-toolbar.client.tsx` (+
  `.module.css`, the editor file is 39 KB), placed over the selected block,
  after the writing area and before the chip in the DOM; Move up, Move down,
  Delete for every kind; a polite `role="status"` region outside the writing
  area for the announcements; one tab stop with arrow keys; Escape back to the
  writing area. Nothing for text formatting yet - the format bar still does
  that. *Done when:* new `e2e/block-toolbar.spec.ts`, keyboard only, on a
  seeded page `[[A, B] | [C]]` + `[[D]]`: cursor in A, Tab reaches a toolbar
  named "Text", Move down twice - the stored order is column 1 `[B]`, column 2
  `[A, C]` - and the status reads the step-1 wording; focus is still on Move
  down; Move up at the document's first position has `aria-disabled="true"`
  and changes nothing; one Ctrl+Z undoes one move; clicking a line shows a
  toolbar named "Line" and its ring (a computed 2px outline); Delete line
  removes it, the status says so, focus is in the writing area at the block
  that took its place, Ctrl+Z restores it; Escape from the toolbar
  puts focus in the writing area with the cursor where it was; the writing
  area is still the only `textbox`. **The empty-column hint** (Design
  reference), drawn by a decoration, not a control: moving column 2's only
  block of a two-column section into column 1 leaves column 2 showing the
  hint with the cursor elsewhere; moving a block back in removes it; the
  published page has no hint text; a one-column empty section shows "Write
  your page…", not the hint.

- [x] **Step 3 - The Text style menu** - in the toolbar of text and
  headings: a menu button showing the current style; Enter, Space or Down
  opens it with focus on the checked item, arrows move, Enter chooses and
  returns focus to the writing area, Escape closes back to the button; items
  Text, Heading, Subheading, Small heading, each at its own size. The format
  bar's select is removed; the rest of the bar stays until step 4. *Done
  when:* keyboard only, the menu turns a paragraph into a Subheading (stored
  level 3) and back to Text; the checked item matches the block; the
  existing text-style tests pass against the menu; an image's toolbar has no
  Text style.

- [x] **Step 4 - Bold, Italic, Link and lists move; the format bar goes** -
  Bold, Italic, Link (the link dialog unchanged) for text, heading, list and
  quote; Bulleted / Numbered list for a list. `FormatBar` and the entry
  form's bar slot are removed; Undo / Redo render in the editor's top bar.
  *Done when:* the existing editor tests that used the format bar pass
  against the toolbar (Bold, Italic, links, lists, quote, undo / redo,
  F-152's test unchanged in what it asserts); a list's toolbar switches it to
  numbered; an image's toolbar has no Bold;
  `getByRole("toolbar", { name: "Formatting" })` finds nothing; Undo and Redo
  are visible at 1280 and 390 with no horizontal scroll.

- [x] **Step 5 - Main heading** - pages' editor allows level 1 (posts' keep
  2-4); the menu's Main heading with its hint naming the current one
  (truncated, Notes); choosing it demotes the previous one in the same
  transaction and announces it; the step-1 guard runs as an
  `appendTransaction` plugin. *Done when:* journey 4 end to end on a page with
  a main heading "Welcome" and a Heading "Our work": select "Our work", Text
  style, Main heading - the status says "Welcome" is now a Heading, one
  Ctrl+Z restores both, Save stores one level-1 heading, and the public page
  shows "Our work" as its only `h1` with the title absent; a page with no main
  heading shows its title as the `h1` (public-site.4, unchanged); pasting
  `<h1>Pasted</h1>` into a page that has one stores it as level 2 and Save
  succeeds; a post's menu has no Main heading and typing `# ` never makes
  level 1.

- [ ] **Step 6 - Section moves** - the chip gains Move section up / Move
  section down (`aria-disabled` at the ends), using step 1's `moveSection`,
  announced; focus stays on the pressed button; the chip follows its section.
  *Done when:* on a three-section page, the chip's Move section down on
  section 1 makes it section 2 in the stored document, the status reads
  "Section moved down: now section 2 of 3.", the chip's legend reads
  "Section 2 of 3", focus is on Move section down; one Ctrl+Z restores the
  order; Section settings and Remove section still work (14a2's tests pass).

- [ ] **Step 7 - Phone and the journeys** - the toolbar wraps below its
  block at narrow widths, and sits clear of the settings bottom sheet.
  *Done when:* at 390px a selected heading's toolbar is fully inside the
  viewport with no horizontal scroll, and with an image selected the bottom
  sheet does not cover its toolbar; journey 3 end to end, keyboard only:
  select a block -> Move up -> the new position announced, then focus a
  palette tile -> Enter -> the block lands after the selected one (14a2's
  half, re-run in the new spec); journey 2 as far as this item reaches: Pages
  -> open a page -> move a block -> Publish -> the public page shows the new
  order, as a full page load and through the app's links.

- [ ] **Step 8 - The admin policy tightens** - `content-security-policy.ts`
  drops `'unsafe-inline'` from the admin's `style-src` and `data:` from its
  `img-src`; its header comment and plan section 6's line say why they went.
  *Done when:* `content-security-policy.spec.ts`'s admin test, in the
  editor, moves a block, opens the Text style menu, the link dialog, the
  media picker and the settings panel, then visits settings, users and media,
  with no violation; the policy test asserts the
  admin header has neither token; the whole browser suite passes. **If a
  violation appears that is not ours to fix** (TipTap or React writing a
  style attribute), stop and report it - the step becomes a recorded
  decision, not a workaround.

- [ ] **Step 9 - The record** - `design.md` *Editor decisions* gains the
  "decided here" lines and the toolbar is marked built; the mockup's
  Undo / Redo line is corrected; `needs-you.md`'s admin screen-reader line
  adds the block toolbar, the Text style menu, the move and delete
  announcements and the chip's moves. *Done when:* both files carry those
  lines, and `npm run verify` and the whole browser suite pass
  (`npm run test:e2e` locally with R2; CI's `e2e` with `E2E_SKIP_R2=1`).

## Files and areas

- `app/features/blocks/block-moves.ts` (+ `.test.ts`) - new, step 1.
- `app/features/blocks/block-toolbar.client.tsx` (+ `.module.css`) - new: the
  toolbar, the Text style menu, the announcer.
- `app/features/blocks/document-editor.client.tsx` - ring decoration, heading
  levels per entry type, the guard plugin, `FormatBar` removed, the chip's
  moves, Undo / Redo exported for the top bar; `document-editor.module.css`.
- `app/features/content/entry-form.tsx` (+ CSS) - the bar slot goes, an
  Undo / Redo slot in the top bar.
- `app/lib/content-security-policy.ts` - step 8.
- `e2e/block-toolbar.spec.ts` - new; `e2e/document-editor.spec.ts` - format
  bar locators move to the toolbar; `e2e/content-security-policy.spec.ts`;
  `e2e/helpers/documents.ts` if a builder is missing.
- `blueprint/context/design.md`, `blueprint/context/needs-you.md`,
  `blueprint/project-plan.md` section 6's CSP line (step 8 - shown for
  approval before editing).

## Data and contracts

**None changes.** No migration: the v4 contract already allows heading level
1 and refuses a second one on a page and any on a post (`parseDocument`), and
the renderer already draws the main heading as the only `h1` (14a1).

Locked here for 14b, which reuses them:

- **`selectedBlock(state)`** - `{ pos, node, kind, section, column, index } |
  null`, `kind` the toolbar's names: `text | heading | list | quote | image |
  button | line | space`.
- **Reading order** - sections top to bottom, columns left to right, blocks
  top to bottom. A move's target is the next slot in that order; 14b's drop
  announcements use `describePosition` for the same wording.
- **The placeholder rule** - a column never empties: removing its last block
  leaves an empty paragraph, and a block arriving in an untouched column
  replaces it.

## Testing

- **Unit** (`npm test`, inside `verify`, so in CI): `block-moves.test.ts` -
  step 1's list. Pure ProseMirror state built from the v4 schema, as
  `palette-insert.test.ts` does.
- **Browser** (`npm run test:e2e`, locally and in CI's `e2e` with the
  development database; no R2 needed): `block-toolbar.spec.ts` (steps 2-7),
  `document-editor.spec.ts` (steps 3-4: moved locators),
  `content-security-policy.spec.ts` (step 8; its R2 image test stays skipped
  in CI as today). Role-based locators: `toolbar`, `button`, `menu`,
  `menuitemradio`, `status`, `heading` with `level`.
- **Journeys:** 2 as far as this item reaches (step 7), 3 both halves (step
  7), 4 (step 5).
- **Quality bar:** nothing it names is touched - no hot path, no auth, no
  personal data; saves are unchanged in size.

## Decisions

- **Move crosses columns and sections in reading order.** Down from a
  column's last block goes to the top of the next column, then the next
  section. Beats stopping at the column's edge: Move is dragging's
  single-pointer alternative (WCAG 2.5.7), so it must reach every place a
  drag can.
- **A column never empties** (the placeholder rule, Data and contracts).
  Beats removing the column (changes the section's layout behind the user's
  back) and refusing the move (a block could never leave a one-block column).
  The empty column says what it is and how to remove it (the hint, Design
  reference), so the blank space is never a mystery.
- **One main heading, kept by the editor, not only refused at Save.** A
  guard demotes a second level-1 heading from a paste or `# ` to a Heading,
  keeping the one that was there; the menu demotes the old one itself. Beats
  leaving it to `parseDocument`, whose refusal comes only at Save, after the
  work.
- **A list's toolbar has Bulleted / Numbered; a quote's has no style.** Beats
  dropping them with the format bar (numbered lists become unreachable) and
  putting lists in the Text style menu (a list is not a text style, and the
  menu would then convert multi-paragraph quotes ambiguously).
- **Undo and Redo in the top bar at every width.** Beats the mockup's
  desktop-only (a phone has no keyboard undo).
- **The toolbar is one tab stop with arrow keys** (the ARIA toolbar pattern).
  Beats a tab stop per button, the format bar's way: the toolbar sits between
  the writing area and the chip, and eight more Tab presses on every pass
  through the page is the cost.
- **End-of-range moves use `aria-disabled`**, so focus never falls to the
  page body.
- **The chip is label, Move section up / down, Section settings, Remove
  section.**
- **The admin CSP loses `'unsafe-inline'` styles and `data:` images.** Beats
  keeping them for 14b: Editor.js, which needed them, is gone, and the CSP
  test then keeps 14b from bringing them back unnoticed.
- **The guard keeps the heading that was already main, by node identity**
  (step 1). ProseMirror shares unchanged nodes between states, so a level-1
  heading that is the same object as one in the old document is the old main
  heading; the others become level 2. With none such, the first in reading
  order stays. Beats "the first in reading order" alone, which lets a paste
  above the main heading displace it. Known gap: one transaction that both
  changes the old main heading and adds another falls to reading order.
- **The block cap refuses only a move that adds a block** (step 1) - a move
  out of a one-block column, which leaves a placeholder, when the document is
  at 200. A pure reorder is never refused.

## Production needs

None. No migration, environment variable, account or service. The CSP change
ships in code.

## Behaviour changes

- Changes `editor.2` from "text can be Text, Heading, Subheading or Small heading, a bulleted or numbered list, or a quote, with bold, italic and links" to "text can be Text, Heading, Subheading or Small heading - and on a page, its one Main heading - a bulleted or numbered list, or a quote, with bold, italic and links" - Step 5
- Adds to `editor`: the selected block has a ring and a toolbar; Move up and Move down move it through every column and section in reading order, and the new position is announced - Step 2
- Adds to `editor`: Delete in the toolbar removes the selected block, says so, and Undo restores it - Step 2
- Adds to `editor`: an empty column in a section of two or three columns shows "Empty column - add a block or change Columns in Section settings." in the editor only - Step 2
- Adds to `editor`: choosing Main heading on a page makes the previous main heading a Heading and announces it; a page never holds two, and a post offers none - Step 5
- Adds to `editor`: a section moves up or down from its chip, and its new position is announced - Step 6

## Notes

- **Announcements** (one `role="status"`, polite, outside the writing area):
  - Block: `Heading moved down: block 1 of 2 in column 2 of section 1.` -
    "column N of" left out when the section has one column.
  - Section: `Section moved down: now section 2 of 3.`
  - Delete: `Heading deleted.`
  - Main heading: `"Welcome" is now a Heading.` - the text cut to 40
    characters with `…`, the same cut as the menu's hint.
  - Kind names: Text, Heading, Main heading, Subheading, Small heading, List,
    Quote, Image, Button, Line, Space.
- **The hint is a widget or node decoration, never real content**, so it is
  never saved, typed into or counted as a block; TipTap's `Placeholder`
  shows text only on the current node by default, so it does not cover this.
  Its muted text on the canvas is the measured "text-muted" pair.
- **Placement:** the toolbar and chip are positioned with CSSOM
  (`element.style.top`), which `style-src 'self'` allows; never a `style`
  attribute in markup, or step 8 fails.
- **The selection decides the toolbar.** A gap cursor has no selected block,
  so no toolbar; a text range spanning blocks uses the block holding its head.
- **TipTap 3.31.4** is newer than memory: read the installed types for
  `Decoration`, `appendTransaction`, `NodeSelection` and the heading
  extension's `levels` and input rules before using them.
- `block-moves.ts` imports only `@tiptap/pm/*`, so `node --test` runs it.
- **Backlog:** 25 open or unverified P3s sit in `blueprint/findings/backlog.md`
  (F-138-F-180). Offered as a tidy fix before this item; not a passenger.
- **Delegation:** step 1's tests and step 9 suit `implementer`; steps 2-8 are
  design work for the main session; `reviewer` for `review`.
- Branch: `feature/14a3-block-toolbar`.
