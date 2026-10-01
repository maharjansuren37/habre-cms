# Feature: Image + text section

**From build plan:** item 12c
**Type:** Feature
**Status:** done

## Goal

The third and last ready-made section kind: **image + text** - one picture from
the media library beside a heading, a line of text and an optional button. It is
built on the 12a/12b foundation (D125-D136): a new stored `type`, a new wire
`kind`, the same plain-string slots. It is the first slot section with a **media
id slot**, so it also brings the picker into the sections form (D132 deferred
this here) and decides the add-button question D135 left open.

## In scope

- A stored `image-text` section, a sibling of `section`, `hero` and `cta`:
  `{ id, type: "image-text", data: { mediaId, heading, text, button? } }`.
  Pages only. The image is **required**; the button is optional, as on a hero.
- Save path and `v3` read path accept lists mixing all four types; the server
  builds everything stored from the slots sent.
- The shared field parser (`slotSectionFromFields`) gains the third type and the
  media id, so there is still one parser. **Hero and CTA behaviour and messages
  must not change** (their tests pass untouched).
- Public render: `<section data-kind="image-text">` with the image on the left
  and the text beside it from `48rem` up, stacked (image first) below; image
  from the existing media map, one query per page. A media id with no row (file
  deleted after placing) renders the text alone, as an image block drops
  silently.
- Page editor: a fourth add control, a card with an "Image and text" tag, the
  image slot (thumbnail + alt text shown, **Choose image** / **Change image**
  opening the existing media picker dialog) and the hero's four text fields.
- `collectImageMediaIds` includes an image-text section's id, so the loader's
  single query covers it (public page and page editor).
- `design.md` gains an *Image and text (item 12c)* entry; screenshots saved.

## Out of scope

- Image on the right, a side option, image sizing, cropping, captions, a
  separate alt text per use - alt stays the media row's own (D60).
- An image slot on hero or CTA (D132's "if wanted" stays unasked).
- Converting between kinds (D129 stands).
- Uploading from inside the form - the picker only picks what `/admin/media`
  holds, as the image block does.
- A popover menu for adding sections (decided below: not now).
- Formatting inside slots, second button, colours, section styling, saved
  sections, templates (plan section 11).
- Posts. No dependency, no migration.

## Design reference

No mockups; precedent is 12a's hero and 12b's CTA (`design.md` entries,
`blueprint/reference/12a-hero/`, `12b-cta/`). Public look, from existing tokens:
two equal columns with `--space-6` gap from `48rem`, image fills its column with
`--radius-md` and keeps its aspect ratio (`width`/`height` attributes set,
`max-width: 100%; height: auto`), text left-aligned and vertically centred beside
it; heading `--text-xl`; button is the hero's rule. Below `48rem` the image
stacks above the text. Editor card: the slot form's styles plus a thumbnail
(max 12rem wide) and the picker's existing dialog styles. **No new colour pair
is expected** (text on page background, primary-pair button already measured);
Step 5 confirms and records that.

## Build steps

- [x] **Step 1 - The stored shape and the save parser** - in `blocks.ts`: add
  `imageTextBlock` (`type: "image-text"`; `mediaId` `z.uuid()`; `heading` 1-120,
  `text` 0-400, optional `button` as on the hero; same `slot` rules), add it to
  the `sectionBlock` union, export `ImageTextSection`. Widen
  `slotSectionFromFields` to the third type, taking `mediaId` from the fields:
  a missing or non-uuid id is refused ("Section 2 (image and text): choose an
  image."). `fromEditorJsSections` accepts `{ id, kind: "image-text", fields: {
  mediaId, heading, text, buttonLabel, buttonHref } }`; other errors as the
  hero's with the new label. `collectImageMediaIds` adds an image-text section's
  `mediaId`; `nonEmptySections` keeps it (never empty); `isPlainSection` callers
  are checked. **Look at how an image block's media id is checked on save
  today (schema only, or against the database) and match it**; if only the
  schema, say so in the step's note. *Done when:* `npm test` passes new tests -
  an image-text parses; no image, a non-uuid id, empty heading, 121-char heading,
  401-char text, a newline collapsed to a space, label without link and link
  without label, `javascript:` and `//host` links, a duplicate id across kinds,
  and a 31st section are refused with the section named; a button-less one is
  accepted; `collectImageMediaIds` returns the id once for two sections using
  the same image; mixed hero/CTA/image-text/plain lists round-trip; **every
  existing hero and CTA test passes unchanged**; `npm run typecheck` is clean.
- [x] **Step 2 - Render it on the public site** - `renderSections` renders
  `<section data-kind="image-text">` with a `<figure>`-less
  `<img src alt width height loading="lazy">` in a wrapper, then a text wrapper
  with `<h2>`, `<p>` (omitted when empty) and the optional button link
  (`data-hero-button` rule reused). All React text nodes; a missing media entry
  drops the image and the text still renders full width. CSS in
  `page-body.module.css` per the Design reference; 375 px has no horizontal
  scroll. *Done when:* a page seeded via `psql` (local dev DB) with an
  image-text section between a hero and a plain section returns the `<img>`
  (its `alt` equal to the media row's), `<h2>`, text and `<a>` in order (`curl |
  grep`); the same page with the media row removed returns the text and no
  `<img>`; a stored heading like `<b>x</b>` appears escaped; a Playwright check
  at 1280 px shows image and text side by side and at 375 px stacked, image
  first, no horizontal scroll.
- [x] **Step 3 - Open and save one in the page editor, with the picker** - in
  `image-tool.client.ts` export `openImagePickerDialog` (and its picked-media
  registry already exported) unchanged otherwise. In
  `sections-editor.client.tsx` the slot entry widens: `kind` gains
  `"image-text"` and its fields gain `mediaId`; `SectionsEditor` receives the
  loader's `mediaById` so a saved image shows its thumbnail and alt text. An
  image-text card shows "Section N of M", a muted "Image and text" tag, Move
  up / Move down / Remove with the inline confirm, no Columns radios, the image
  slot (thumbnail + alt, a "Choose image" button that reads "Change image" once
  set; a missing file shows "This image is no longer in the library. Choose
  another." and keeps saving blocked until chosen), then Heading (required),
  Text, Button label and Button link (optional pair, same hint as the hero).
  Controls carry `data-control="image-text-*"`. `contentRef` returns `{ id,
  kind: "image-text", fields }`; `isReadableSectionsContent` (`editor-content.ts`)
  accepts it with its tests. After the dialog closes, focus returns to the
  Choose/Change button. A refused save shows the server's message and keeps the
  typed values and the chosen image. *Done when:* a hand-seeded section opens
  with thumbnail, alt and fields filled; picking a different image, editing and
  saving reloads with the new image; Move/Remove (with confirm) work; saving
  with no image shows "Section N (image and text): choose an image." with typed
  values kept; `page-hero.spec.ts`, `page-cta.spec.ts`, `page-sections.spec.ts`,
  `page-columns.spec.ts` and `image-block.spec.ts` pass unchanged.
- [x] **Step 4 - Add one from the editor** - the add row gets **"Add image and
  text"** as a fourth button beside blank, hero and call to action (the menu
  decision is below); all four are disabled at 30 sections with the existing
  hint and wrap on a narrow screen. A new one gets a generated id, empty fields,
  no image, and **focus on Choose image**; polite "Image and text section added.
  Now N sections." *Done when:* from a fresh page the button adds a card with
  focus on Choose image; choosing an image, filling the heading and saving shows
  it publicly; the flow, including the dialog, works by keyboard alone; at 30
  sections all four buttons are disabled; the blank, hero and CTA announcements
  and focus are unchanged.
- [x] **Step 5 - Record the design** - add *Image and text (item 12c, not in the
  mockups)* to `blueprint/context/design.md`: the fourth add button, the card and
  its image slot (states: empty, chosen, missing file), the public two-column
  layout and its stack point, how it differs from hero and CTA. Confirm no new
  colour pair, or measure and record one. Save editor and public screenshots,
  light and dark, to `blueprint/reference/12c-image-text/`. *Done when:* the
  entry matches what Steps 2-4 built (re-read against the code).
- [x] **Step 6 - Browser tests and the bar** - add `e2e/page-image-text.spec.ts`
  (role-based locators; uploads two fixture images through `/admin/media` or
  seeds media rows the way `image-block.spec.ts` does): add one, choose an image,
  fill the slots, save, reload - values and image intact; the public page shows
  image, heading, text and a working link; change the image and save; a section
  with no image, and one with a label but no link, are refused with the message
  and typed values kept; a `javascript:` link is refused; move and remove work
  among hero and plain sections. Bar: a seeded **30-section page mixing plain,
  hero, CTA and image-text sections** (several sharing images) saves in **under
  1 s** server-side and its public page responds in **under 500 ms**
  (`quality-bar.md`), with the page loader resolving every image in **one**
  media query. *Done when:* `npm run test:e2e` passes (needs the dev database;
  local only, not in `npm run verify` or CI - F-17) and both timings are in the
  step's commit note.

## Files and areas

- `app/features/blocks/blocks.ts` (+ `blocks.test.ts`), `sections.ts` (+ test)
- `app/features/blocks/render.tsx`
- `app/features/blocks/image-tool.client.ts` (export only)
- `app/features/blocks/sections-editor.client.tsx`, `sections-editor.module.css`
- `app/features/content/editor-content.ts` (+ test); `page-edit.tsx` (passes
  `mediaById` to the editor)
- `app/features/public-site/page-body.module.css`
- `blueprint/context/design.md`, `blueprint/reference/12c-image-text/`
- `e2e/page-image-text.spec.ts`

## Data and contracts

**No migration.** `blocks_format` stays `v3`; another JSON shape in the same
jsonb column. Load-bearing for everything after 12:

    Section = PlainSection | HeroSection | CtaSection | ImageTextSection   // discriminated on `type`
    ImageTextSection = { id, type: "image-text",
                         data: { mediaId: uuid, heading: string(1-120),
                                 text: string(0-400),
                                 button?: { label: string(1-40), href: safe link } } }
    other invariants unchanged (D125-D136): unique ids, 1-30 sections,
    plain sections' blocks <= 200, no newlines in any slot

Wire, per section, exactly one of `{ id, columns }`, `{ id, kind: "hero" | "cta",
fields }` or `{ id, kind: "image-text", fields }`, where an image-text's `fields`
adds `mediaId` to `{ heading, text, buttonLabel, buttonHref }`. The server never
accepts a stored `type` from the client. The stored section holds the **media
id only** - url, alt and size are resolved at render from the media table (D60),
never stored.

## Testing

- **Unit (`npm test`, in `verify`, no database):** Step 1's cases;
  `collectImageMediaIds`/`nonEmptySections` with an image-text;
  `isReadableSectionsContent` with `image-text`.
- **Browser (`npm run test:e2e`, local only, needs the dev database, not in
  `verify`/CI):** Steps 2-4 checks and Step 6.
- **Manual:** keyboard-only add, choose (dialog focus in and out), fill, move,
  remove; screen-reader announcements and the picker dialog - added to the
  existing section-controls line in `needs-you.md`.

## Decisions

- **Image + text is its own `type` (`image-text`) and wire kind; the image is a
  media id, required.** Beats: an optional image (then it is a hero by another
  name, as with the CTA's button) and storing a url (D60 already ruled it out).
  Continues D125, D126, D130.
- **One shared field parser, widened again.** Beats: a fourth near-copy. Cost:
  the hero-named identifiers keep serving every kind (F-128 still open).
- **Alt text comes from the media row, no figcaption, no per-section alt.**
  Beats: a second alt field (drift from the library's, more for the editor to
  fill) and a visible caption repeating the alt text beside an image that is
  already next to its own text.
- **The image is always on the left, stacked above below `48rem`; no side
  option.** Beats: a left/right choice (a setting no editor asked for, the
  product's ease-of-use rule).
- **Four add buttons stay buttons; a menu is revisited at a fifth kind.**
  Closes D135's open question. Beats: a popover (more to make keyboard- and
  screen-reader-accessible for no gain at four short buttons that wrap; the
  accessibility pass on the section controls is itself still unverified).
- **The picker is the existing dialog, exported, not rebuilt.** Beats: a React
  copy of it (two pickers to keep in step). Cost: the form calls into vanilla DOM
  code, as the image block does.
- **A deleted image drops silently in public, and blocks saving in the editor
  until another is chosen.** Beats: failing the public page (the plan's stance on
  missing images) and silently saving a section with a dead id.

## Production needs

- No new environment variables, no migration, no external service. Images are
  served from the existing `R2_PUBLIC_URL`, already allowed by the content
  security policy for image blocks (Step 2 confirms with
  `content-security-policy.spec.ts`).
- **Rollback caveat as 12a/12b:** once a page is saved with a hero, CTA or
  image-text section, code from before 12a cannot render it. **Deploy 12a-12c
  together** (see `production-pending.md`); 12c is the last piece.

## Notes

- `sections.ts` and anything the public renderer imports at runtime stay free of
  Zod (`import type` only).
- Slots are plain text rendered as React text nodes - never HTML.
- Section ids stay `[A-Za-z0-9_-]`; controls are found by `data-section-id`
  (F-119).
- Keep focus and live-announcement rules consistent with items 10-12b.
- `AGENTS.md` rules hold: `build` branches off `main`, nothing committed unseen,
  no push or deploy without a separate yes.

## Findings

_None resolved with this item. No findings were raised by its review._
