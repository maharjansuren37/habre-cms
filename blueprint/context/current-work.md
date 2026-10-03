# Fix: Tidy the drag-and-drop backlog and stale comments

**Type:** Fix
**Verified:** not yet
**Reviewed:** not yet

## Goal

Repair twelve P3 findings from `blueprint/findings/backlog.md` in one batch,
before item 15 starts touching every data module. Eight are edge cases in the
newest code, drag and drop (items 14b and 14c2). Four are comments and counts
that now say something untrue. The tidy item was offered because the backlog
holds 46 open or unverified P3s. The owner chose it on 2026-10-04.

Findings: F-193, F-194, F-195, F-196, F-197, F-198, F-206, F-207 (drag) and
F-147, F-175, F-188, F-190 (stale text).

## In scope

- **Out-of-range slots are refused, not crashed on or misreported** (F-194,
  F-206). Today `drop()` reports a slot naming no column as the 200-block cap.
  An index past a column's children throws a `RangeError`. The top-level
  position is computed by two copies of the same loop, one clamped and one
  unclamped.
- **One narrowed drag source** (F-207). The section path and the block path
  in `startDrag` each hold a non-null source. The six casts go.
- **A point covered by something drawn over the writing area is no place**
  (F-193). This covers the sticky top bar and, below 1024px, the settings
  panel's bottom sheet. It applies to block drags and section-tile drags.
- **The click blocker cannot outlive the gesture** (F-195). It is also removed
  on `pointercancel`, with a 1-second fallback.
- **A touch on a palette tile is a tap, never a drag** (F-196). Touch drags
  only by the grip, as 14b's spec intended.
- **Settled announcements while auto-scrolling** (F-197). While the window
  auto-scrolls, a hover place is announced only once it has held for 300 ms.
- **The Image-tile drop test checks what is stored** (F-198).
- **Stale comments and counts reworded** (F-147, F-175, F-188, F-190).
  - Colour comments point at `design.md`'s contrast table instead of quoting
    old ratios.
  - `app.css`'s header no longer says public pages follow the system setting.
  - Three comments name the removed format bar. One says "logo picker's
    dialog".
  - The R2-only test counts in `AGENTS.md`, `ci.yml` and `needs-you.md` are
    replaced by wording that cannot go stale.

## Out of scope

- The other 34 open or unverified backlog findings. They stay in the backlog
  for a later tidy item, mostly editor (F-163, F-172, F-178, F-180, F-184,
  F-185, F-186, F-189, F-191, F-192), settings (F-138 to F-140) and lists
  (F-27, F-55, F-173).
- F-20 (root SSH login) is the "harden the deploy path" line in
  `needs-you.md`, for `host`.
- F-187 and F-83/F-63 need a screen reader. F-13 is an accepted residual.
- Real-device behaviour of F-196: this item proves it in Chromium only (see
  Notes).
- Any change to what a drag can do or where it can land, other than the
  covered-point rule.

## Build steps

- [x] **Step 1 - Out-of-range slots are refused (F-194, F-206)**
  - `block-drops.ts`: `DropResult` gains `"invalid"`. `drop()` returns it for
    a slot naming no column, or an index outside 0 to the column's child
    count, instead of `"full"` or a throw. `hoverAnnouncement` says
    "<Name>: release to cancel." for it.
  - `palette-insert.ts`: exports `topLevelPosition(doc, index): number | null`,
    which is null outside 0 to `doc.childCount`. `insertSection` returns null
    for an out-of-range `index`.
  - `block-drag.client.tsx`:
    - `sectionPos` is deleted and the gap uses `topLevelPosition`.
    - `slotPos` returns null for an index past the column's children instead
      of clamping.
    - `onUp` treats `"invalid"` as a cancel ("Drag cancelled.").
    - `dropSection` cancels the same way when `topLevelPosition` is null for
      its slot, so an out-of-range slot is never reported as a full page.

  *Done when:*
  - New unit tests pass, each seen failing first:
    - `drop()` returns `"invalid"` for `{section: 0, column: 5, index: 0}`,
      and for an index one past a column's child count.
    - `hoverAnnouncement` says "Image: release to cancel." for both.
    - `insertSection` returns null for `index: childCount + 1` and for
      `index: -1`.
    - `topLevelPosition(doc, doc.childCount)` equals `doc.content.size`.
  - `grep -n "doc.child(i).nodeSize" app/features/blocks/block-drag.client.tsx`
    finds no top-level loop.
  - `npm test` is green.

- [x] **Step 2 - One narrowed drag source (F-207)**
  - `startDrag` narrows `source` once, into a section path holding a non-null
    `SectionTemplate` and a block path holding a non-null `BlockSource`.
  - Each path's begin, update and release is either:
    - split into helpers, or
    - guarded by a discriminated value the compiler checks.
  - No behaviour changes.

  *Done when:*
  - `grep -nE "as (BlockSource|\{ ?kind)" app/features/blocks/block-drag.client.tsx`
    prints nothing.
  - `npm run verify` is green.
  - `npx playwright test e2e/block-drag.spec.ts e2e/section-drag.spec.ts`
    passes with no test edited.

- [x] **Step 3 - A covered point is no place (F-193)**
  - In `update`, `onUp` and `sectionSlotUnder`, a point is no place unless
    the topmost element there (`document.elementFromPoint`) is inside the
    writing area (`view.dom`).
  - So the sticky top bar, the settings sheet below 1024px, and anything
    else drawn over the canvas count as outside every section. The hover
    says "<Name>: release to cancel." and a release says "Drag cancelled."
  - `design.md`'s *Ending* line gains the rule.

  *Done when:* new browser tests in `e2e/block-drag.spec.ts` and
  `e2e/section-drag.spec.ts` pass, and each fails with the step's code change
  reverted:
  - **Block under the top bar:** on a page scrolled so section 2 sits under
    the sticky top bar, drag a block, hover over the bar and release there.
    - The status shows "<Name>: release to cancel." then "Drag cancelled."
    - The canvas shape is unchanged.
    - After Save, the stored entry is unchanged.
  - **Section tile under the top bar:** the same release with a Hero tile
    adds no section, and the status shows "Drag cancelled."
  - **Settings sheet at 390px:** an image is selected, so its settings sheet
    is open. Its grip is dragged over the sheet and released there. The
    status shows "Drag cancelled." and nothing moves.
  - The existing drag tests still pass.

- [x] **Step 4 - The click blocker ends with the gesture; a touch on a tile is a tap (F-195, F-196)**
  - `swallowClick` also removes itself on a one-time `pointercancel`, and in
    any case after 1 second.
  - The palette's block and section tiles start a drag only for
    `pointerType` mouse or pen. For touch, `onPointerDown` does nothing and
    the tap's click adds the block.
  - `design.md`'s *Dragging* line says touch drags by the grip only.

  *Done when:* browser tests pass, and each fails without its part of the
  change:
  - **Click after a cancel:** a grip drag cancelled by Escape, whose
    gesture then ends in a dispatched `pointercancel` rather than
    `pointerup`. The next click, on the Line tile, made within 1 second so
    the fallback cannot be what removes the blocker, adds a line.
  - **Touch on a tile:** in a `hasTouch` context at 1280px, a touch pointer
    sequence on the Text tile moving 20px shows no ghost
    (`[data-drag-ghost]`) and no gap.
  - **Tap on a tile:** `tap()` on the Line tile adds one line after the
    selected block.

- [x] **Step 5 - Settled announcements while auto-scrolling (F-197)**
  - While `scrollSpeed` is not 0, a hover announcement is held until its
    place has stayed the same for 300 ms. This applies to block places and
    section places.
  - The gap and ghost still move every frame.
  - With no auto-scroll, announcements are immediate, as today.

  *Done when:* new browser tests pass for a block drag and for a Hero tile
  drag. They hold the pointer within 48px of the window's bottom on a page
  taller than the window, for 2 seconds.
  - A `MutationObserver` on the status region records each hover
    announcement with its time.
  - No two recorded announcements are under 300 ms apart.
  - After scrolling stops at the page's end, the place there is announced
    within 600 ms.
  - The existing auto-scroll tests, at lines 448 and 477, still pass.

- [ ] **Step 6 - The Image-tile drop test checks what is stored (F-198)**
  - The test at `e2e/block-drag.spec.ts:319` saves after the drop, before
    the Ctrl+Z part, or in a sibling test.
  - It asserts the stored document holds an image with an empty `mediaId`
    first in section 1, column 2.

  *Done when:*
  - The test passes.
  - Changing the asserted column to 1 makes it fail.

- [ ] **Step 7 - Stale comments and counts (F-147, F-175, F-188, F-190)**
  - Reword the comments at the files listed in those findings:
    - F-147: point the contrast comments at `design.md`'s table, and fix
      `app.css`'s header (public pages are light only, D168).
    - F-175: the media picker's dialog comment.
    - F-188: the three format-bar comments.
  - Replace the R2-only test counts with wording naming the mechanism: the
    tests that call `test.skip(skipWithoutStorage)`. This applies to:
    - the `AGENTS.md` ci row
    - the `.github/workflows/ci.yml` comment at line 56
    - the two `needs-you.md` lines
  - Replace `needs-you.md`'s "expect 255 passed" with "every test passes,
    none skipped". Comments only, no code.

  *Done when:*
  - `grep -rn "format bar" app/features/content/entry-form.tsx app/features/content/entry-form.module.css app/features/blocks/document-editor.module.css`
    prints nothing.
  - `grep -rn "logo picker's dialog" app` prints nothing.
  - `grep -nE "\b2[67] (browser )?tests\b|255 passed" AGENTS.md blueprint/context/needs-you.md .github/workflows/ci.yml`
    prints nothing.
  - None of the five CSS files named in F-147 quotes a contrast ratio.
  - `npm run verify` is green.

## Files and areas

- `app/features/blocks/block-drops.ts` and `block-drops.test.ts`: steps 1 and 3.
- `app/features/blocks/palette-insert.ts` and `palette-insert.test.ts`: step 1.
- `app/features/blocks/block-drag.client.tsx`: steps 1-5. This is the main
  file, so each step's diff stays inside its finding.
- `app/features/blocks/palette.client.tsx`: step 4, the tiles'
  `onPointerDown`.
- `e2e/block-drag.spec.ts` and `e2e/section-drag.spec.ts`: steps 3-6.
- `blueprint/context/design.md`: steps 3 and 4, one line each.
- Step 7, comments and docs only:
  - `app/app.css`
  - `app/features/content/entry-list.module.css`
  - `app/features/users/user-list.module.css`
  - `app/features/content/entry-delete.module.css`
  - `app/features/media/media-delete.module.css`
  - `app/features/media/media-picker-dialog.module.css`
  - `app/features/content/entry-form.tsx`
  - `app/features/content/entry-form.module.css`
  - `app/features/blocks/document-editor.module.css`
  - `AGENTS.md`
  - `.github/workflows/ci.yml` (comment)
  - `blueprint/context/needs-you.md`

## Data and contracts

- **`DropResult`** becomes
  `{ tr; pos } | "in-place" | "full" | "invalid"`. Load-bearing: 14c2's
  section slots and any later drop target build on it. `"full"` now means
  only the block cap.
- **`topLevelPosition(doc, index): number | null`**, exported from
  `palette-insert.ts`. It is the one place a top-level index becomes a
  position.
- No stored data, schema, route or environment variable changes.

## Testing

- **Unit** (`npm test`, inside `npm run verify`, runs in CI's `verify` job):
  step 1's tests in `block-drops.test.ts` and `palette-insert.test.ts`.
- **Browser** (`npm run test:e2e`, locally with the development database,
  and in CI's `e2e` job): steps 2-6.
  - None of them upload to R2. The image in step 6 has no file chosen. So
    they all run in CI.
  - Step 4's touch tests use a `hasTouch` Chromium context, which is the
    existing pattern from the "at 390px by touch" describe.
- Each new test is seen failing against the code before its step, or with
  the step's change reverted, before it counts.
- `npm run verify` and the full `npm run test:e2e` once at the end.

## Decisions

- **An out-of-range drop slot is refused, not clamped.** `drop()` says
  `"invalid"` and `insertSection` returns null. Both are announced as a
  cancel. This beat clamping to the nearest valid place, which F-206
  suggested: a bad slot means hit-testing is wrong, and silently landing
  somewhere else hides that.
- **"Outside every section" includes any point covered by something drawn
  over the writing area**, tested with `elementFromPoint`. This beat
  clipping section rects to the sticky bar's and sheet's rects (F-193's
  suggestion): one rule covers every overlay, present and future, rather than
  a list that has to be kept up to date.
- **Touch drags by the grip only. A touch on a palette tile is a tap.** This
  beat `touch-action: none` on the tiles, which would stop a swipe from
  scrolling the side panel.
- **While auto-scrolling, a hover place is announced only once it has held
  for 300 ms.** This beat a fixed rate limit, which would still announce
  places the pointer is only passing.
- **Docs name the R2 skip mechanism, not a count of tests.** The count was
  wrong three times in a row (26, 27, really 5 calls), because every item that
  adds a test changes it.

## Production needs

None. This is editor client code, tests and comments, with no variable,
migration or service.

## Behaviour changes

- Adds to `editor`: a drag released over anything drawn over the writing area - the sticky top bar, or the settings sheet below 1024px - cancels, announced "Drag cancelled.", and changes nothing - Step 3
- Adds to `editor`: a touch on a palette tile never starts a drag; a tap on it adds its block after the selected one - Step 4
- Adds to `editor`: after a drag is cancelled, the next click anywhere acts normally, even when the gesture ended in pointercancel - Step 4
- Adds to `editor`: while the window auto-scrolls under a drag, a place is announced only once it has held for 300 ms, so no two announcements come under 300 ms apart - Step 5

## Notes

- **The findings live in `blueprint/findings/backlog.md`, not the index.**
  `build` marks each repaired one `fixed` there, with its evidence in the
  entry's **Resolution**. It closes a P3 itself when it saw the test fail
  without the fix, per the ledger's rule. F-196 and F-195 are `unverified` or
  `open` today, and their tests in step 4 are what moves them.
- **F-196 on a real tablet is not proven here.** Chromium's dispatched touch
  events are not a finger, and the browser's own panning never fires in a
  test. The real-phone line in `needs-you.md` is widened to include it.
- **Step 3's rule must not catch the gap or the ghost.** The drop zone is
  inside `view.dom`. The ghost has `pointer-events: none` and sits 12px off
  the pointer. The toolbar and chip are hidden while dragging (design.md).
  If any of that is not true when built, stop: the rule would cancel drops
  it should not.
- `palette.client.tsx` stays a `.client.tsx`. Step 1's logic stays in the
  pure `.ts` files so `node --test` reaches it (coding standards).
- Steps 2-5 all edit `block-drag.client.tsx`. Keep each diff to its own
  finding. Step 2 is a refactor, so it runs before the behaviour fixes, which
  then land on the narrowed structure.
- No design record is wrong here. Steps 3 and 4 add a rule each, where
  `design.md` is silent.
