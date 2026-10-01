# Feature: Call-to-action section

**From build plan:** item 12b
**Type:** Feature
**Status:** done

## Goal

The second ready-made section kind: a **call to action** - a heading, a line of
text and one button that is always there - set apart on the page as a panel so it
reads as "do this next". It is built on the 12a foundation (D125-D132): a new
stored `type`, a new wire `kind`, the same plain-string slots and the same form.
It differs from a hero in two ways only: the **button is required** and the
public look is a **bordered panel**, not a bare centred banner.

## In scope

- A stored `cta` section, a sibling of `section` and `hero`:
  `{ id, type: "cta", data: { heading, text, button } }`. Pages only.
- Save path and `v3` read path accept lists mixing all three types; the server
  builds everything stored from the slots sent.
- To avoid a copy of the hero parser, the hero's field parsing becomes one shared
  helper that both kinds call, differing only in the type name, the section's
  label in messages ("Section 2 (call to action)") and whether the button is
  required. **Hero behaviour and messages must not change** (its tests pass
  untouched).
- Public render: `<section data-kind="cta">` with `<h2>`, a paragraph when text
  is set, and the button link (always present), inside a bordered, padded,
  centred panel, built from existing tokens.
- Page editor: a third add button, **"Add call to action"**; a CTA card has the
  usual bar plus a "Call to action" tag, no Columns control, and the same four
  fields as a hero with the button's label and link both **required**.
- `design.md` gains a *Call to action (item 12b)* entry; screenshots saved.

## Out of scope

- Image + text and the image picker - **12c**.
- Converting between kinds (D129 stands).
- Replacing the add buttons with a menu: three buttons still fit one row that
  wraps. D128 said to revisit at three; this item keeps buttons and **12c (four)
  is where a menu gets decided** - recorded below.
- A second button, colours or background choices, alignment, formatting inside
  slots, section styling, saved sections, templates (plan section 11).
- Posts. No dependency, no migration.

## Design reference

No mockups; precedent is 12a's hero (`design.md` *Hero* entry,
`blueprint/reference/12a-hero/`). Panel: `--color-surface` fill,
`--color-border` 1px border, `--radius-md`, `--space-6` padding, centred text,
heading at `--text-xl`; the button is the same primary-pair link as the hero's.
Text on `--color-surface` is already measured (16.75 / 14.07). **New and to be
measured in Step 5:** the accent button fill against the surface panel (non-text
contrast, needs >= 3:1), and the panel border (decorative, as every card border).

## Build steps

- [x] **Step 1 - The stored shape and the save parser** - in `blocks.ts`: add
  `ctaBlock` (`type: "cta"`; `heading` 1-120, `text` 0-400, `button` **required**
  `{ label 1-40, href passing isSafeHref }`; same `slot` rules, so no newlines or
  unstorable characters), add it to the `sectionBlock` union, export `CtaSection`.
  Extract the hero's field parsing into one helper used by both kinds, taking the
  type, the message label and `buttonRequired`. `fromEditorJsSections` accepts
  `{ id, kind: "cta", fields: { heading, text, buttonLabel, buttonHref } }`; a
  missing label or link on a CTA is refused ("Section 2 (call to action): the
  button needs a label and a link."), other errors as the hero's with the new
  label. Anything reading `type`/`children` (`collectImageMediaIds`,
  `nonEmptySections`, `isPlainSection` callers) is checked: a CTA is never empty
  and holds no images. *Done when:* `npm test` passes new tests - a CTA parses;
  empty heading, 121-char heading, 401-char text, a newline collapsed to a space,
  no button, label only, link only, `javascript:` and `//host` links, a
  duplicate id across a CTA and a hero, and a 31st section are refused with the
  section named; mixed hero/CTA/plain lists round-trip; **every existing hero
  test passes unchanged**; `npm run typecheck` is clean.
- [x] **Step 2 - Render a CTA on the public site** - `renderSections` renders
  `<section data-kind="cta">` with `<h2>`, `<p>` (omitted when text is empty) and
  `<p><a href data-cta-button="">label</a></p>`, all React text nodes. CSS in
  `page-body.module.css` per the Design reference; the link reuses the hero
  button's rule rather than a copy where the module allows it; 375 px has no
  horizontal scroll. *Done when:* a page seeded via `psql` (local dev DB) with a
  CTA between a hero and a plain section returns the CTA's `<h2>`, text and `<a>`
  in order (`curl | grep`), a stored label like `<b>x</b>` appears escaped, and a
  Playwright check at 375 px and 1280 px shows the panel centred, bordered, no
  horizontal scroll.
- [x] **Step 3 - Open and save a CTA in the page editor** - in
  `sections-editor.client.tsx` the hero entry type widens to a slot entry with
  `kind: "hero" | "cta"` (same four fields); a CTA card shows "Section N of M",
  a muted "Call to action" tag, Move up / Move down / Remove with the inline
  confirm, no Columns radios, and the form with Heading (required), Text, Button
  label (required) and Button link (required, same URL hint). Controls carry
  `data-control="cta-*"`. `contentRef` returns `{ id, kind: "cta", fields }`;
  `isReadableSectionsContent` (`editor-content.ts`) accepts `cta` with its tests.
  A refused save shows the server's message and keeps the typed values.
  *Done when:* a hand-seeded CTA opens with the form filled in, an edit saves and
  reloads, Move/Remove (with confirm) work, saving with a missing button shows
  the "Section N (call to action)" message with typed values kept, and
  `page-hero.spec.ts`, `page-sections.spec.ts` and `page-columns.spec.ts` pass
  unchanged.
- [x] **Step 4 - Add a CTA from the editor** - the add row gets "Add call to
  action" beside "Add blank section" and "Add hero section"; all three are
  disabled at 30 sections with the existing hint and wrap on a narrow screen.
  A new CTA gets a generated id, empty fields, focus in Heading and a polite
  "Call to action section added. Now N sections." *Done when:* from a fresh page
  the button adds a card with focus in Heading; filling and saving shows the CTA
  publicly; the flow works by keyboard alone; at 30 sections all three buttons
  are disabled; the blank and hero announcements are unchanged.
- [x] **Step 5 - Record the design** - add *Call to action (item 12b, not in the
  mockups)* to `blueprint/context/design.md`: the third add button, the card and
  its required button fields, the public panel, how it differs from a hero.
  Measure and record the button-on-panel and any other new colour pair. Save
  editor and public screenshots, light and dark, to
  `blueprint/reference/12b-cta/`. *Done when:* the entry matches what Steps 2-4
  built (re-read against the code) and the new contrast figures are in the
  table.
- [x] **Step 6 - Browser tests and the bar** - add `e2e/page-cta.spec.ts`
  (role-based locators): add a CTA, fill the four slots, save, reload - values
  intact; the public page shows heading, text and a working link; a CTA with a
  label and no link, and with a link and no label, is refused with the message
  and typed values kept; a `javascript:` link is refused; move and remove work
  among hero and plain sections. Bar: a seeded **30-section page mixing plain,
  hero and CTA sections** saves in **under 1 s** server-side and its public page
  responds in **under 500 ms** (quality bar). *Done when:* `npm run test:e2e`
  passes (needs the dev database; local only, not in `npm run verify` or CI -
  F-17) and both timings are in the step's commit note.

## Files and areas

- `app/features/blocks/blocks.ts` (+ `blocks.test.ts`), `sections.ts` (+ test)
- `app/features/blocks/render.tsx`
- `app/features/blocks/sections-editor.client.tsx`, `sections-editor.module.css`
- `app/features/content/editor-content.ts` (+ test)
- `app/features/public-site/page-body.module.css`
- `blueprint/context/design.md`, `blueprint/reference/12b-cta/`
- `e2e/page-cta.spec.ts`

## Data and contracts

**No migration.** `blocks_format` stays `v3`; a CTA is another JSON shape in the
same jsonb column. Load-bearing for 12c:

    Section = PlainSection | HeroSection | CtaSection        // discriminated on `type`
    CtaSection = { id, type: "cta",
                   data: { heading: string(1-120), text: string(0-400),
                           button: { label: string(1-40), href: safe link } } }   // button required
    other invariants unchanged (D125-D132): unique ids, 1-30 sections,
    plain sections' blocks <= 200, no newlines in any slot

Wire, per section, exactly one of `{ id, columns }`,
`{ id, kind: "hero", fields }`, `{ id, kind: "cta", fields }` with
`fields = { heading, text, buttonLabel, buttonHref }`. The server never accepts a
stored `type` from the client.

## Testing

- **Unit (`npm test`, in `verify`, no database):** Step 1's cases;
  `nonEmptySections`/`collectImageMediaIds` with a CTA; `isReadableSectionsContent`
  with `cta`.
- **Browser (`npm run test:e2e`, local only, needs the dev database, not in
  `verify`/CI):** Steps 2-4 checks and Step 6.
- **Manual:** keyboard-only add, fill, move, remove of a CTA; announcements and
  focus with a screen reader - added to the existing section-controls line in
  `needs-you.md`.

## Decisions

- **The button is required on a CTA, optional on a hero.** Beats: one shared
  "optional button" rule (a call to action with nothing to click is a hero by
  another name; the difference is the whole point of the kind).
- **Hero and CTA share one field parser, parameterised.** Beats: a copy per kind
  (12c would make three near-identical parsers). Cost: a small change to hero
  code, guarded by its unchanged tests.
- **A CTA is its own `type` (`cta`) and wire `kind`.** Beats: a hero with a
  "button required" flag (it would blur two kinds the editor labels differently
  and make later per-kind slots awkward). Continues D125, D130.
- **Three add buttons, menu decision moved to 12c.** Beats: building a menu now
  (three buttons still fit and wrap). D128's "revisit at three" becomes "revisit
  at four".
- **A CTA's look is a bordered panel on `--color-surface`.** Beats: a bare
  banner like the hero (indistinguishable on the page) and an accent-filled band
  (a new colour pair across the whole width, with contrast to measure).

## Production needs

- No new environment variables, no migration, no external service.
- **Rollback caveat as 12a:** once a page is saved with a hero or CTA, code from
  before 12a cannot render it. Deploy 12a-12c together.

## Notes

- `sections.ts` and anything the public renderer imports at runtime stay free of
  Zod (`import type` only).
- Slots are plain text rendered as React text nodes - never HTML.
- Section ids stay `[A-Za-z0-9_-]`; controls are found by `data-section-id`
  (F-119).
- Keep focus and live-announcement rules consistent with items 10-12a.
- `AGENTS.md` rules hold: `build` branches off `main`, nothing committed unseen,
  no push or deploy without a separate yes.

## Findings

_None resolved with this item. F-128 [P3] (hero-named identifiers serve both kinds) and F-129 [P3] (unused import in `render.tsx`) were open at ship and moved to `blueprint/findings/backlog.md`._
