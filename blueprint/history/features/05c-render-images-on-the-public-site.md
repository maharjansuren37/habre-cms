# Feature: Render images on the public site

**From build plan:** item 5c
**Type:** Feature
**Status:** shipped 2026-09-22

## Goal

Close the one gap item 5b explicitly left open: `design.md`'s "Public site" line
has always said images show "full column width with 12px radius **and muted
caption**", and there has never been anything to fill that caption with. Give a
published image block a visible caption on `/posts/:slug`.

## In scope

- A visible caption under every rendered image block on the public site, styled
  muted per `design.md`.
- The CSS and markup change only - `render.tsx`'s image case, wrapped in a
  `<figure>`/`<figcaption>` instead of a bare `<img>`.

## Out of scope

- **A caption data field.** There is no caption column on `media` (5a's own
  contract) and this item does not add one - see Decisions for what fills the
  caption instead.
- **Resizing, `srcset`, or any server-side responsive image handling.**
  `quality-bar.md` names this the known first bottleneck and explicitly scopes
  it out of v1: "Image size on public pages: not measured, no target in v1 (no
  resizing)." **Nothing here changes that.** CSS-level responsive *display*
  (the image never overflows or exceeds its own intrinsic size) already shipped
  with item 5b (`post.module.css:53-58`: `max-width: 100%; height: auto;`,
  `border-radius: var(--radius-lg)` - 12px at the default root size, matching
  design.md's "12px radius"). This item does not touch that CSS beyond wrapping
  it in a `<figure>`; Testing below just confirms it still holds.
- **Editing alt text, or a per-placement caption override, from the post
  editor.** Unchanged from 5b's own scope cut - alt text stays one value per
  file (D55).
- **Page rendering.** `render.tsx` is entry-type-agnostic on purpose (item 4b's
  own contract), so this change reaches item 6's pages for free the moment they
  exist - nothing here builds against pages, which do not exist yet.

## Design reference

`blueprint/context/design.md`, *Public site* (line 238-240): "images full
column width with 12px radius and muted caption." The muted-text pairing this
needs is already measured and tabled for the public site specifically:
`--color-text-muted` on `--color-bg` - **5.9:1 light / 7.8:1 dark** (design.md
line 61, captured for "public site: dates, footer, empty state - item 4b").
The caption reuses that existing token and that existing measurement; nothing
new to measure. No new mockup - this is a small addition to an already-shipped
screen, not a fresh design pass.

## Build steps

- [x] **Step 1 - Caption every rendered image** - in `render.tsx`'s `image`
  case, wrap the `<img>` in a `<figure>`, with a `<figcaption>` holding the
  resolved media's `altText`. Add `.body figure` (reset the browser's default
  figure margin so it matches the existing `.body > * + *` block spacing) and
  `.body figcaption` (muted, small text, matching `.meta`'s existing
  `--text-sm`/`--color-text-muted` pattern) to `post.module.css`. A block whose
  media no longer resolves keeps rendering nothing, exactly as today - there is
  no image to caption. *Done when:* a Playwright test publishes a post with an
  image block, visits `/posts/:slug`, and finds a `<figcaption>` under the
  image whose text equals the media's alt text; `npm run verify` passes;
  `npm run test:e2e` passes including the new test.

## Files and areas

- `app/features/blocks/render.tsx` - the image case
- `app/features/public-site/post.module.css` - `figure`/`figcaption` rules
- `e2e/public-site.spec.ts` - new test, using the existing `uploadTestMedia`
  helper (`e2e/helpers/media.ts`) to create a real media row and
  `createDraftFor` to place it in a published post

## Data and contracts

None. `ImageMediaSummary.altText` already carries exactly what the caption
needs (`app/features/blocks/blocks.ts:75`) - resolved once per entry by the
existing `mediaById` lookup, unchanged.

## Testing

- New Playwright test in `e2e/public-site.spec.ts`: publish a post with an
  image block, visit the page, assert the `<figcaption>` text matches the
  uploaded alt text and sits inside the same `<figure>` as the `<img>`. Shown
  to fail before the fix (element not found), passes after.
- `npm run verify` - exit 0 (typecheck, lint, 183 unit tests, build).
  `npx playwright test` (full suite) - 64 passed.
- Manual, done in `verify`: a real (non-1x1) image uploaded and published,
  screenshotted in light and dark at desktop width and in light at a 375px
  mobile width - `blueprint/reference/5c-image-captions/`. Confirms the image
  still scales down responsively with the caption underneath, and caught a
  real gap in the *verification method itself*: the first screenshot attempt
  came back blank because it was taken before the browser finished loading the
  externally-hosted R2 image, even though the DOM (src, dimensions, caption
  text) was already correct - exactly the "a served response is not a
  rendered page" trap `verify` exists to catch. Fixed by waiting for the
  image's `load` event before capturing; not a product defect.
- Covered by the existing, already-open `needs-you.md` line for a
  screen-reader/keyboard pass over the public site (spec, 2026-09-21) - this
  item adds a second visible text node next to the image, so note that in the
  same pass rather than opening a new line for it.

## Decisions

- **The caption is the media's existing alt text, not a new field.** `design.md`
  has said "muted caption" since before there was any data to put in it; 5a
  already settled that alt text is one value per file, captured once at upload
  (D55), and 5b's own post editor already displays that same value as "a
  read-only line beneath the image" in the admin preview. Reusing it publicly
  is the same choice made a second time, not a new one - a separate caption
  field would be a second piece of text an editor has to keep in sync with the
  first, for a project whose whole design bar is "few screens, obvious next
  actions." **Residual, worth naming rather than hiding:** the image's `alt`
  attribute keeps the same text the visible `<figcaption>` shows, so a screen
  reader announces it twice in a row (once as the image's accessible name, once
  as the caption). Accepted rather than fixed, because it repeats a duplication
  this project already chose for the editor's own preview, and because the
  alternative - emptying `alt` and leaning on the figure/figcaption
  relationship alone - is not a reliable substitute: browsers do not treat
  `<figcaption>` as an image's accessible name. Worth a second look only if the
  upcoming screen-reader pass (`needs-you.md`) finds it actually confusing in
  practice, not preemptively. Recorded as `dev-notes/decisions.md` D65, and
  tracked live as F-79 (unverified) until that pass happens.

## Notes

- `render.tsx`'s own exhaustive `switch` and its comment ("a fifth block type
  fails here at compile time, not silently at render time") stay as they are -
  this item does not add a block type, so nothing about that contract changes.
- Follow `coding-standards.md`: `.tsx` change with no new unit-testable logic
  (render.tsx cannot run under `node --test`, same reason 4b and 5b's renderer
  work was proven by browser tests, not unit tests).
- **`design.md`'s *Public site* entry still has no `Screenshots:` line**, unlike
  every other visual entry in that file (2b, 5a, 5b all point at
  `blueprint/reference/`). The evidence now exists at
  `blueprint/reference/5c-image-captions/` - adding the pointer is a one-line
  edit for whoever next touches that file (a `docs` pass or the next UI item),
  left undone here because neither `verify` nor `ship` write `design.md`.
- **Item 5 (Images) is now fully shipped** - 5a, 5b and 5c all checked off, so
  the parent line in `blueprint/build-plan.md` is checked too with this item.

## Findings

None of this item's own findings resolved to a closed status during review -
F-79 (P3, unverified) stays in the live ledger rather than archiving here,
pending the screen-reader pass named above.
