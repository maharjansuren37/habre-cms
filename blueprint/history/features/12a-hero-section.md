# Feature: Hero section and the typed-section foundation

**From build plan:** item 12a
**Type:** Feature
**Status:** done

## Goal

A page section can be a **ready-made kind with fixed slots** instead of free
columns of blocks. 12a builds the machinery - a second stored section type, its
public render, its editor form and an "add" choice - and proves it with the
first kind, **Hero**: a heading, a line of text and an optional button. 12b
(call to action) and 12c (image + text) then add kinds on top without touching
the foundation. This is the third piece of the first-cut page builder (D113).

## In scope

- A stored `hero` section, a sibling of the existing `section` (D114):
  `{ id, type: "hero", data: { heading, text, button? } }`. Pages only; posts
  stay flat.
- The page save path and the `v3` read path accept a list mixing both types;
  the server derives everything from the slots sent (never trusts the client).
- Public render: a hero is a `<section data-kind="hero">` with an `<h2>`, a
  paragraph and, when set, a link styled as a button; centred, larger type,
  built from existing tokens.
- Page editor: the add row offers **"Add blank section"** and **"Add hero
  section"**; a hero card shows the same bar (position heading, Move up / Move
  down / Remove with the inline confirm) plus a "Hero" label, **no Columns
  control**, and a plain form - Heading, Text, Button label, Button link - in
  place of Editor.js.
- Validation with messages that name the section ("Section 2 (hero): the
  heading is required."), and a button link held to the existing link allowlist.
- `design.md` gains a *Hero (item 12a)* entry; screenshots saved.

## Out of scope

- Call to action - **12b**; image + text and any image slot or picker - **12c**.
  A hero has no image in 12a.
- Converting a section between kinds (blank <-> hero): remove it and add the
  other. Revisit if editors ask.
- Bold/italic/links inside hero text (slots are plain text - Decisions), colour
  or background choices, alignment options, section styling (plan section 11).
- Reusable saved sections and page templates (plan section 11).
- Posts. No new dependency, no migration.

## Design reference

No mockups exist for sections; precedent is items 10-11 (`design.md` *Sections*
and *Columns* entries, screenshots in `blueprint/reference/10-sections/` and
`11-columns/`). Build against the existing tokens and the one `48rem`
breakpoint. The hero's button link reuses the default `Button`'s tokens, so no
new colour pair and no new contrast figure; if a pair does turn out to be new,
measure it and record it in Step 5. New pieces, to be recorded in Step 5: the
hero card and form in the editor, the add row's second button, the public hero.

## Build steps

- [x] **Step 1 - The stored shape and the save parser** - in `blocks.ts`: rename
  today's section schema to `plainSectionBlock` (type `"section"`, unchanged),
  add `heroBlock` (`heading` 1-120 chars, `text` 0-400 chars, `button` optional
  `{ label 1-40 chars, href }` with `href` passing `isSafeHref`; every string
  passes `isStorableText`; no newlines), make `Section` the union of the two and
  `sectionsSchema` an array of it. Section ids stay unique across both types; the
  200-block total counts plain sections' blocks only; 30 sections total. Export
  `PlainSection` and a `isPlainSection` guard (in `sections.ts`, which the public bundle imports, so no Zod). `fromEditorJsSections` accepts
  per-section `{ id, kind: "hero", fields: { heading, text, buttonLabel,
  buttonHref } }` alongside `{ id, columns }`: it trims and collapses line breaks and runs of spaces to one space (the schema still refuses a stored newline), treats an empty label
  **and** empty link as "no button", refuses exactly one of the two, and names
  the section in every error. `collectImageMediaIds`, `nonEmptySections`
  (`sections.ts`, no Zod import there) and every other caller that reads
  `data.children` narrow with the guard; a hero is never "empty". The editor
  typechecks by treating a hero entry as unsupported until Step 3 (hero rows are
  reachable only by hand until Step 4). *Done when:* `npm test` passes new
  tests: a hero with and without a button parses; empty heading, a 121-char
  heading, a 401-char text, a newline in any slot, a label without a link, a link
  without a label, `javascript:` and `//host` links, and a duplicate id across a
  hero and a plain section are all refused with a message naming the section;
  mixed lists round-trip; existing item 10-11 tests pass unchanged; `npm run
  typecheck` is clean.
- [x] **Step 2 - Render a hero on the public site** - `renderSections` renders
  a hero as `<section data-kind="hero">` holding `<h2>`, `<p>` (omitted when the
  text is empty) and, with a button, `<a href>` with the label as its text; all
  React text nodes, never `dangerouslySetInnerHTML`. CSS in `page-body.module.css`:
  centred text, heading at `--text-2xl`, the link styled with the default
  Button's tokens, `--space-7` between sections as today, no horizontal scroll at
  375 px. *Done when:* a page seeded via `psql` (local dev DB) with a hero and a
  plain section returns HTML with the hero's `<h2>`, text and `<a>` in order
  (`curl | grep`), a hero with no button has no `<a>`, a stored label like
  `<b>x</b>` appears escaped, and a Playwright check at 375 px and 1280 px shows
  it centred with no horizontal scroll.
- [x] **Step 3 - Open and save a hero in the page editor** - in
  `sections-editor.client.tsx`, `Entry` becomes a union (`plain` with columns and
  `rev`, `hero` with its four field values). A hero entry renders the card bar
  (heading "Section 2 of 4", a muted "Hero" tag, Move up / Move down / Remove
  with the inline confirm and the same focus rules - **no Columns radios**) and
  a form of labelled controls: Heading (required), Text (textarea), Button
  label, Button link (hint: "Starts with https://, mailto:, / or #"). Typing
  calls `onChange`. `contentRef` returns `{ id, kind: "hero", fields }` for a
  hero and `{ id, columns }` for a plain section; `isReadableSectionsContent`
  (`editor-content.ts`) accepts both and its tests cover both. A refused save
  shows the server's message through the existing page-form error. *Done when:*
  a page holding a hand-seeded hero opens with the form filled in, an edit saves
  and reloads with the new value, Move up/down and Remove (with confirm) work on
  it, a page with a plain section still behaves exactly as before
  (`e2e/page-sections.spec.ts` and `page-columns.spec.ts` pass unchanged), and
  saving a hero with an empty heading shows the "Section N (hero)" message and
  keeps the typed values.
- [x] **Step 4 - Add a hero from the editor** - the add row gets two default
  buttons, "Add blank section" (today's "Add section", behaviour unchanged) and
  "Add hero section". Both are disabled at 30 sections with the existing hint.
  A new hero gets a generated id, empty fields, focus on its Heading field, and a
  polite announcement ("Hero section added. Now 3 sections."). *Done when:* from a
  fresh page, "Add hero section" adds a card with focus in Heading; filling it
  and saving shows the hero on the public page; the whole flow works by keyboard
  alone; at 30 sections both add buttons are disabled; the plain-section
  announcement is unchanged ("Section added. Now N sections.").
- [x] **Step 5 - Record the design** - add a *Hero (item 12a, not in the
  mockups)* entry to `blueprint/context/design.md`: the add row, the hero card
  and form (labels, hint, required marking, error placement), the public hero
  (type size, centring, button tokens, spacing), why Columns is absent, that
  kinds are not convertible. Re-measure and record contrast only if a new colour
  pair was introduced. Save editor and public screenshots, light and dark, to
  `blueprint/reference/12a-hero/`. *Done when:* the entry matches what Steps 2-4
  built (re-read against the code, not the spec).
- [x] **Step 6 - Browser tests and the bar** - add `e2e/page-hero.spec.ts`
  (role-based locators): add a hero, fill all four slots, save, reload - values
  intact; the public page shows heading, text and a working button link; a hero
  without a button shows none; a label without a link is refused with the
  message and the typed values stay; a `javascript:` link is refused; move and
  remove work on a hero among plain sections. Then the bar: a seeded page of 30
  sections (a mix of heroes and 3-column sections) saves in **under 1 s**
  server-side and its public page responds in **under 500 ms** (quality bar).
  *Done when:* `npm run test:e2e` passes (needs the dev database; local only,
  not in `npm run verify` or CI - F-17) and both timings are recorded in the
  step's commit note.

## Files and areas

- `app/features/blocks/blocks.ts` (+ `blocks.test.ts`) - schemas, union,
  `fromEditorJsSections`, `collectImageMediaIds`
- `app/features/blocks/sections.ts` (+ `sections.test.ts`) - `nonEmptySections`
- `app/features/blocks/render.tsx` - `renderSections`
- `app/features/blocks/sections-editor.client.tsx`, `sections-editor.module.css`
- `app/features/content/editor-content.ts` (+ test), `entry-form-input.ts`,
  `entry-input.ts` - readability and parsing of the mixed wire shape
- `app/features/public-site/page-body.module.css`
- `blueprint/context/design.md`, `blueprint/reference/12a-hero/`
- `e2e/page-hero.spec.ts`

## Data and contracts

**No migration.** `blocks_format` stays `v3` and the `entries` check is
untouched: a hero is another JSON shape inside the same jsonb column.

Load-bearing (12b and 12c add kinds the same way):

    Section = PlainSection | HeroSection            // discriminated on `type`
    PlainSection = { id, type: "section",
                     data: { layout: "1"|"2"|"3", children: Block[][] } }   // unchanged
    HeroSection  = { id, type: "hero",
                     data: { heading: string(1-120), text: string(0-400),
                             button?: { label: string(1-40), href: safe link } } }
    invariants: ids unique across the page (1-64 chars, [A-Za-z0-9_-]);
                1-30 sections; plain sections' blocks total <= 200;
                no newlines or unstorable characters in any slot

Wire (client -> server), per section, exactly one of:

    { id, columns: [ <Editor.js output> x 1..3 ] }                       // plain
    { id, kind: "hero", fields: { heading, text, buttonLabel, buttonHref } }

A new kind in 12b/12c is a new `kind` string here and a new `type` in storage.
The server never accepts a stored `type` from the client.

## Testing

- **Unit (`npm test`, inside `verify`, no database):** Step 1's schema and parser
  cases, `nonEmptySections` and `collectImageMediaIds` with heroes,
  `isReadableSectionsContent` with both shapes.
- **Browser (`npm run test:e2e`, local only, needs the dev database, not in
  `verify`/CI):** Steps 2-4 checks and Step 6.
- **Manual:** keyboard-only add, fill, move and remove of a hero; the form's
  announcements and focus with a screen reader. Added to the existing
  section-controls line in `needs-you.md`.

## Decisions

- **A hero is its own section `type`, not a `kind` field on `section`.** Beats: a
  variant on today's section (it would make `children`/`layout` optional and
  weaken the invariant item 11 locked). Cost: callers that read `children` must
  narrow.
- **Slots are plain strings, not runs.** Beats: storing runs as plan section 6
  worded it (the slot is a form field with no toolbar, so marks could never be
  made and the shape would only promise formatting that cannot exist). Cost:
  adding formatting later is a new shape for that slot. **Plan section 6's
  wording ("runs, an allowlisted link, a media id") is amended by this.**
- **Limits: heading 120, text 400, button label 40 characters; no newlines stored.** The save parser collapses typed line breaks to a space rather than refusing them (Enter in the text box must not break a save).
  Beats: the 20,000-character run cap (a hero is a banner, not an article) and
  allowing line breaks (one paragraph keeps the layout predictable).
- **Adding is two buttons, not a menu.** Beats: a popover menu (more to make
  keyboard- and screen-reader-accessible for two options). Revisit when 12c
  makes it three.
- **Kinds are not convertible.** Beats: converting with a slot-to-block mapping
  (content-loss rules for no stated need).
- **The wire names the kind (`kind: "hero"`); layout and type are derived on the
  server.** Continues D116/D120: the client's structure is never trusted.
- **The button link box is a plain text input with a URL keyboard, not `type=url`.** Beats: `type=url` (the browser's own check refuses a relative link such as `/about` and silently blocks the save, found by the 30-section test; the server's allowlist is the real check). Cost: no native format hint.
- **A hero has no image in 12a.** Beats: building the picker here (it belongs to
  12c, which needs it for image + text).

## Production needs

- No new environment variables, no migration, no external service.
- **Rollback caveat:** once a page is saved with a hero, code from before this
  item cannot render it (it reads `data.children` on every section). Symlink
  rollback to the items 10-11 release is unsafe after such a save. Deploy 12a-12c
  together, or accept that rollback boundary knowingly.

## Notes

- `sections.ts` and anything the public renderer imports at runtime must stay
  free of Zod (CSP, see its header comment): `import type` only.
- Editor.js tools assign `innerHTML` - but the hero form uses plain controls, so
  its values are only ever text: render through React text nodes, never HTML.
- Section ids: keep `[A-Za-z0-9_-]`; the editor builds a selector from them
  (F-119). A hero's controls are found by `data-section-id`, not by an index.
- Keep the focus rules and live announcements consistent with item 10's: after a
  change, focus goes somewhere sensible and the change is announced politely.
- `AGENTS.md` rules hold: branch off `main` (`build` creates it), nothing
  committed unseen, no push or deploy without a separate yes.

## Findings

_None resolved with this item. F-127 [P3] (the hero parser's unstorable-character refusal has no test) was open at ship and moved to `blueprint/findings/backlog.md`._
