# Feature: The document, text editing and the public render

**From build plan:** item 14a1
**Type:** Feature
**Verified:** 2026-10-02 - every done-when proven by browser tests against the served app; full suite 135 passed, `npm run verify` green (243 unit)
**Reviewed:** 2026-10-02, d95e1a83098a, current, every lens - 0 blocking

## Goal

Replace Editor.js with one TipTap document per page and post (D169):
sections of one to three columns holding text blocks, edited with one undo
history, validated by our own Zod schema and drawn by our own renderer. This
is the format every later editor item (14a2-14c, 18, 19, 20) builds on, so its
shape is locked here.

## In scope

- `blocks_format` `v4`: the document schema, its caps and its plain-words
  refusals; the stored document is the schema's output, never the submitted
  JSON.
- TipTap 3.31.4 on one document per entry, **pages and posts alike** (posts
  gain sections and columns, D165 supersedes D115).
- Blocks: Text (paragraph), Heading / Subheading / Small heading (levels
  2-4), bulleted and numbered lists (flat), quote. Marks: bold, italic, link
  (allowlisted, D30).
- An interim **format bar** under the editor's top bar: Text style (a native
  select: Text, Heading, Subheading, Small heading), Bulleted list, Numbered
  list, Quote, Bold, Italic, Link, Undo, Redo. Ctrl+B / Ctrl+I / Ctrl+Z /
  Ctrl+Shift+Z work.
- Sections: **Add a section** below the canvas (one empty column); the
  **section chip** on the section holding the cursor - "Section 2 of 5",
  Columns (1 / 2 / 3, shrinking merges per D119), Remove section. Drawn
  outside the editable area (D169).
- The canvas in the site scope (`data-surface="site"`), light inside dark
  Habre; columns stack below a 40rem container (design.md) - the same
  stylesheet on the canvas and the public site.
- The public renderer for v4: each node its semantic element; empty sections,
  paragraphs and headings render nothing; a page's level-1 heading, if any, is
  its only `h1`, otherwise the title is.
- Deleting every existing page and post: a destructive migration (its own
  production yes). This is a rebuild; nothing stored is kept (owner,
  2026-10-02).
- Removing Editor.js, its packages, its parsers, the v2/v3 renderer and the
  ready-made section code (12a-12c).
- Requirements carried from deferred findings: the writing area has an
  accessible name (F-29); a refused save never loses the draft (F-39).

## Out of scope

- Image, button, line and space blocks, the palette's keyboard path, the
  settings panel, the first image loading at once - **14a2**. F-79's
  requirement (a captioned image is not announced twice) moves to 14a2 with
  the image block.
- The selected block's ring and toolbar, Move up / Move down for blocks and
  sections, the Text style **menu** and **Main heading**, Delete - **14a3**.
  14a3 moves this item's format bar controls into that toolbar.
- Drag and drop, the drop gap, Duplicate - **14b**. Ready-made sections as
  templates - **14c**. Until 14a2 and 14c land, `main` has no images and no
  hero / call to action / image and text; nothing deploys before v1 (D163).
- Heading levels 5-6 and the Simple / Pro lock - item 20 (the schema already
  accepts them).
- Tightening the admin Content-Security-Policy now that Editor.js is gone
  (`'unsafe-inline'`, `data:`) - after 14a3, once the whole editor exists;
  noted in Notes.

## Design reference

- `prototypes/editor.html` (two states) for the canvas, section chip and
  section structure; `prototypes/components.css` *Sections and columns*
  (`.page-flow`, `.sec`, `.cols`, `.col`) and *Editor* (bar, canvas, section
  chip, Add a section).
- `blueprint/context/design.md` *Editor decisions*: page structure, section
  controls, the canvas is the customer's site.
- **Not in the record, decided here:** the interim format bar (a row of the
  kit's sm ghost icon buttons and a native select under the top bar) and the
  link dialog (the kit's native `<dialog>` with one "Web address" field, as
  the image picker uses). Both are replaced by 14a3's toolbar; `design.md` is
  not changed for an interim control.

## Build steps

- [x] **Step 1 - Dependencies and the v4 schema** - install `@tiptap/core`,
  `@tiptap/pm`, `@tiptap/react`, `@tiptap/starter-kit` and
  `@tiptap/extensions` at exactly 3.31.4. Add `app/features/blocks/document.ts`:
  the Zod schema for the contract below, the page and post rules, the caps,
  canonical output, and a `parseDocument(input, type)` returning the document
  or one plain sentence. Pure `.ts`, no wiring. *Done when:*
  `app/features/blocks/document.test.ts` has a passing test for each rule -
  every node and mark accepted; unknown node, unknown mark, nested list,
  hard break refused; 31 sections, 4 columns, 201 blocks, an empty column,
  text over 20,000 characters, an unsafe link, a link over 2,048 characters, a
  NUL character each refused with its sentence; a level-1 heading refused in a
  post and a second one refused in a page; unknown keys and extra attrs
  (`orderedList.start`, `link.target`) absent from the output - and
  `npm run verify` is green.

- [x] **Step 2 - Read and render v4** - migration `0008_blocks_v4.sql`
  widens the check to `('v2','v3','v4')` (nothing rewritten; built with
  `migrate`). `entries.server.ts` loads a `v4` row as a `document`; the
  public post, page and chosen home page render it with a new
  `renderDocument` in `render.tsx`, through one content stylesheet shared
  with the canvas (container query at 40rem). `readableFormats` gains `v4`
  for both types, so F-46's stale-tab guard keeps working. v2/v3 rows still
  render as today. *Done when:* a new `e2e/document-render.spec.ts` seeds a published
  v4 page and post and finds, by role, the `h1`, headings at levels 2-4,
  `list` / `listitem` for both list kinds, a `blockquote`, `strong`, `em`
  and a `link` with its address; an empty section and an empty paragraph add
  no element; a page with a level-1 heading has exactly one `h1` (the
  heading) and a post's `h1` is its title; a 2-column section sits side by
  side at 1280px and stacks at 390px; the whole existing suite still passes.

- [x] **Step 3 - The editor on v4 entries** - `document-editor.client.tsx`:
  TipTap with our `section` and `column` nodes (`isolating`), the text
  blocks and marks above and nothing else from StarterKit, `injectCSS:
  false`, an accessible name ("Page content" / "Post content"), a
  placeholder in an empty first paragraph; the format bar; the link dialog,
  which checks the address with `isSafeHref` and shows the error beside the
  field. The form submits `editor.getJSON()` and the action saves through
  `parseDocument` as `v4`. `EntryForm` uses it for a v4 entry; v2/v3 entries
  still open in the old editors. *Done when:* `e2e/document-editor.spec.ts`,
  on a seeded v4 page and post: typing, each Text style, both lists, quote,
  Bold / Italic by button and by Ctrl+B / Ctrl+I, a link added through the
  dialog, an unsafe link refused beside the field, Undo and Redo by button
  and keyboard all survive Save and a reload; the writing area is found by
  `getByRole("textbox", { name: "Page content" })`; in dark mode the canvas
  background is the site's light `--color-bg`; the stored row is
  `blocks_format = 'v4'` with no attr outside the contract; pasting HTML
  holding an image, a table, a nested list and a `javascript:` link saves
  only contract nodes - the text kept, the image and table dropped, the list
  flat, the link gone.

- [x] **Step 4 - Sections and columns** - Add a section; the section chip,
  positioned by our code at the section holding the cursor, after the
  writing area in tab order; Columns 1 / 2 / 3 (shrinking moves the removed
  columns' blocks to the end of the last kept column, D119); Remove section,
  immediate and undoable, absent when only one section is left. Every chip
  action is one transaction. *Done when:* the editor spec adds: Add a section
  then type in it; the chip reads "Section 2 of 2" with the cursor there;
  3 columns -> 2 keeps every block; Remove section then Ctrl+Z restores it,
  text intact; Backspace at the start of a column and Delete at the end of a
  section change nothing outside them; Tab from the writing area reaches the
  chip's Columns control; a page saved with 2 sections of 2 columns renders
  them on the public page.

- [x] **Step 5 - Browser tests seed v4** - `createDraftFor` takes a v4
  document and defaults to `v4`; `e2e/helpers/documents.ts` builds one from
  paragraphs (`textDocument("a", "b")`). Every spec that only seeds content
  (`public-site`, `manage-posts`, `manage-pages`, `home-page`, `theme`,
  `site-navigation`, `manage-settings`, `content-security-policy`,
  `contrast`) seeds v4. Mechanical. *Done when:* `grep -rn "blocksFormat:
  \"v[23]\"\|type: \"text\", data" e2e/` finds nothing in those files and the
  whole suite passes.

- [x] **Step 6 - Delete old content and remove Editor.js** - migration
  `0009_entries_v4_only.sql` (destructive; built with `migrate`): deletes
  every entry (settings' home page clears itself, `on delete set null`),
  resets the menu to empty (its page links are JSON, no foreign key), sets
  the check to `= 'v4'` and the default to `'v4'`. New entries are created as v4; the editor is
  always the TipTap one. Removed: the Editor.js packages and `editor.client.tsx`,
  `sections-editor.client.tsx` (+ css), `image-tool.client.ts` (+ css),
  `types/editorjs.d.ts`, `sections.ts`, the v2/v3 parsers and schema in
  `blocks.ts`, `parseInlineHtml` / `runsToHtml` / `runsSchema` in
  `inline-runs.ts` (`isSafeHref` and `isStorableText` stay), the v2/v3
  renderer, `editor-content.ts`'s Editor.js checks, `blocks-format.ts`'s
  branching, `post.tsx`'s own image lookup. Specs that drive Editor.js are
  removed (`write-post`, `inline-formatting`, `page-sections`,
  `page-columns`, `page-hero`, `page-cta`, `page-image-text`, `image-block`)
  - steps 2-4's specs cover what they covered that still exists. *Done
  when:* after `npm run db:migrate` on a development database holding v2 and
  v3 rows, `entries` is empty, the home page and menu are empty, and an
  insert of `v2` is refused by the check; a new post and a new page open in the TipTap
  editor and save; `grep -rn "editorjs\|EditorJS" app package.json` finds
  nothing; `npm run verify` and the whole browser suite pass.

- [x] **Step 6b - The canvas is as wide as the published content** -
  for a v4 entry the editor canvas gives the document the same width the
  public page gives it, so the 40rem container query stacks or places columns
  in the editor exactly as it will publish (design.md, *Page structure*:
  "the canvas and the published site behave identically"). The entry form
  widens (every entry is v4 after step 6). *Done when:* the editor spec finds a 2-column
  section side by side in the canvas at 1280px and stacked at 390px, matching
  `document-render.spec.ts`; the whole suite passes. (Owner, 2026-10-02.)

- [x] **Step 7 - A refused save keeps the draft, and the bar's numbers** -
  the browser checks the body size before submitting and shows "This is too
  long to save. Remove some text and save again." without submitting; the
  action answers an oversized body with that banner (`data(..., 413)`), not a
  thrown error, so the editor stays mounted. *Done when:* the editor spec
  pastes text past 1 MB, presses Save, sees the banner and the text still in
  the writing area (F-39); a document at the caps (30 sections, 200 blocks)
  saves in **under 1 s** and its published page answers in **under 500 ms**,
  each measured from the browser test on the dev machine
  (`quality-bar.md`); both browser tests run in `npm run test:e2e` and in
  CI's `e2e` job (neither needs R2).

- [x] **Repair F-153 - The Text style select moves focus into the writing
  area on every change** - the select applies its style without moving focus.
  *Done when:* a browser test focuses the Text style select and presses
  ArrowDown with the keyboard: focus stays on the select and the block takes
  each style in turn; the test fails with the repair reverted.

- [x] **Repair F-154 - A stored document the editor cannot read opens empty
  and Save overwrites it** - the editor checks its content and, when it cannot
  read it, the form refuses to save. *Done when:* a browser test seeds a v4
  row holding a node the editor does not know, opens it, presses Save, sees
  the refusal and finds the stored row unchanged; the test fails with the
  repair reverted.

## Files and areas

- `package.json`, `package-lock.json` - TipTap in, Editor.js out.
- `db/migrations/0008_blocks_v4.sql`, `0009_entries_v4_only.sql`.
- `app/features/blocks/document.ts` (+ test) - new: schema, rules, caps.
- `app/features/blocks/document-editor.client.tsx` (+ `.module.css`) - new:
  TipTap, nodes, format bar, link dialog, section chip, Add a section.
- `app/features/blocks/content.module.css` - new: sections, columns and
  blocks, shared by canvas and site (replaces the column rules in
  `page-body.module.css`).
- `app/features/blocks/render.tsx` - `renderDocument`; old renderer removed.
- `app/features/blocks/blocks.ts`, `inline-runs.ts`, `sections.ts` - cut down
  or removed (step 6).
- `app/features/content/` - `entries.server.ts`, `entry-form.tsx`,
  `entry-form-input.ts`, `entry-input.ts`, `editor-content.ts`,
  `blocks-format.ts`, `post-edit.tsx`, `page-edit.tsx`, `post-new.tsx`,
  `page-new.tsx`.
- `app/features/public-site/` - `post.tsx`, `page.tsx`, `home.tsx`,
  `page-body.tsx`, `page-media.server.ts`, `post.module.css`,
  `page-body.module.css`.
- `e2e/` - `helpers/users.ts`, new `helpers/documents.ts`,
  `document-render.spec.ts`, `document-editor.spec.ts`; seeding changes and
  removals per steps 5-6.

## Data and contracts

**Load-bearing: the v4 document** (`entries.blocks`, `blocks_format = 'v4'`).
Every later item and every Level widening builds on it. ProseMirror JSON, as
TipTap's `getJSON()` emits it, narrowed:

    doc        { type: "doc", content: section[1..30] }
    section    { type: "section", attrs: { align: "top"|"middle",
                 background: "none"|"band" }, content: column[1..3] }
    column     { type: "column", content: block[1..] }
    paragraph  { type: "paragraph", content?: text[] }
    heading    { type: "heading", attrs: { level: 1..6 }, content?: text[] }
    bulletList / orderedList  { type, content: listItem[1..500] }
    listItem   { type: "listItem", content: [paragraph] }      flat in v1
    blockquote { type: "blockquote", content: paragraph[1..] }
    text       { type: "text", text: string(1..), marks?: mark[] }
    mark       { type: "bold" } | { type: "italic" }
               | { type: "link", attrs: { href } }             isSafeHref, <= 2,048

- **Reserved for later items, not accepted yet:** `image` { mediaId },
  `button` { label, href }, `horizontalRule` (Line), `space` (attrs decided
  by 14a2) - 14a2; `contactForm` - item 19. Each widens the block union.
- **Caps:** 200 blocks per document (a paragraph, heading, list or quote is
  one block, D116), 20,000 characters and 2,000 text nodes per block, 1 MB
  per save body. `align` / `background` default `top` / `none`; no v1 control
  sets them (templates do, 14c).
- **Rules:** a post holds no level-1 heading ("A post's title is its main
  heading - use Heading or smaller."); a page holds at most one. A page's
  level-1 heading with text is its `h1` and the title is not drawn;
  otherwise the title is the `h1`.
- **Canonical:** what is stored is the schema's output. Keys and attrs outside
  the contract (TipTap's `orderedList.start` / `type`, `link.target` / `rel` /
  `class`) are dropped, not refused; a node or mark outside it is refused.
- **Empty document:** one section (`top`, `none`) of one column holding one
  empty paragraph - what a new entry starts with.
- **Form field:** the editor still posts the document as the `blocks` field
  (F-34's "field absent means the editor never loaded" holds).
- **Migrations:** `0008` widens the check (reversible). `0009` deletes every
  entry, resets the menu and sets the check to `= 'v4'` - **destructive and
  not reversible**; no release before it can read a v4 row.

## Testing

- **Unit** (`npm test`, inside `verify`, runs in CI): `document.test.ts` -
  every schema rule, cap and refusal sentence; the main-heading and
  empty-node helpers the renderer uses live in `document.ts` so they are unit
  tested, not only through JSX.
- **Browser** (`npm run test:e2e`, locally and in CI's `e2e` job; needs the
  development database, no R2): `document-render.spec.ts` (step 2),
  `document-editor.spec.ts` (steps 3, 4, 7); every existing spec reseeded
  (step 5) or removed (step 6). Role-based locators throughout
  (coding-standards.md).
- **Migration 0009** proved on a development database seeded with v2 and v3
  rows and a home page and menu pointing at them (step 6).
- **Journey 2** (design.md, *Edit and publish*), the part this item has:
  Pages -> open a page -> change its text -> Publish -> the public page shows
  it, once as a full page load and once through the app's own links - in
  `document-editor.spec.ts`, step 4. The drag in it is 14b's.

## Decisions

- **The editor canvas matches the published content width** (owner,
  2026-10-02), so columns behave the same in the editor and on the site. Beats
  keeping the 42rem form (columns always stacked in the editor) and widening
  both to the prototype's 64rem (changes the public reading width too).
- **Existing content is deleted, not kept** (owner, 2026-10-02: "this is a
  rebuild") - every entry is deleted and the menu reset. Beats keeping rows
  with emptied bodies (keeps addresses nobody needs, and pages that show only
  a title) and converting (D169 chose discard). Cost: the owner's site starts
  empty at the v1 deploy.
- **Lists are flat in v1** - a list item holds one paragraph; Tab does not
  nest. Beats nesting: items 1-12 had none, and it is a Level 2 widening
  (D165) with no migration.
- **The stored document is the schema's output** - unknown keys and TipTap's
  extra attrs dropped, unknown nodes and marks refused. Beats storing the
  submitted JSON as validated (F-50: a less canonical stored shape).
- **No hard breaks and no node ids in v1.** Shift+Enter starts a new
  paragraph; ProseMirror addresses nodes by position. Beats D117's section
  ids, which existed for one editor per column.
- **Removing a section is immediate and undoable**, with no question.
  Supersedes D118's inline question, which existed because there was no
  undo; D118's "an empty section renders nothing publicly" holds.
- **TipTap pinned at exactly 3.31.4** (`@tiptap/core`, `pm`, `react`,
  `starter-kit`, `extensions`), with `injectCSS: false` - its few required
  rules live in our stylesheet, so the admin can later drop
  `'unsafe-inline'`. Five runtime packages replace Editor.js's three.

## Production needs

- **Migrations `0008` and `0009`** - `0009` deletes every page and post and
  empties the menu. Nothing in production is worth keeping - items 1-12's
  entries are test data (owner, 2026-10-02) - so no backup is taken for it.
  It still runs only with the v1 deploy's yes. After it, no release before
  14a1 can read the database: rollback by symlink is impossible.
- No new environment variables, accounts or services.

## Behaviour changes

No `editor` capability file exists yet; `public-site` has two claims, neither
contradicted.

- New capability `editor`: a page or post is one document of 1-30 sections,
  each of 1-3 columns of blocks - Step 4
- Adds to `editor`: text can be Text, Heading, Subheading or Small heading, a
  bulleted or numbered list, or a quote, with bold, italic and links - Step 3
- Adds to `editor`: Undo and Redo cover every change, including adding,
  removing and re-columning sections - Step 4
- Adds to `editor`: typing or deleting never merges or crosses sections and
  columns - Step 4
- Adds to `editor`: a link outside the allowlist is refused beside the Web
  address field - Step 3
- Adds to `editor`: a save over the size limit is refused with a message and
  the text stays in the editor - Step 7
- Adds to `public-site`: pages and posts render as sections of columns, which
  stack when their container is narrower than 40rem - Step 2
- Adds to `public-site`: a page's main heading is its only `h1`, else its
  title is; a post's title is always its `h1` - Step 2
- Adds to `public-site`: an empty section, paragraph or heading renders no
  element - Step 2
- Removes (no recorded claim): image blocks and ready-made sections, until
  14a2 and 14c; every existing page and post, and the menu, by migration
  0009.

## Notes

- **React Router 8.4.0** - check route and action patterns against
  `node_modules/react-router/docs/`; actions return `data(..., { status })`
  for a refusal (coding-standards.md).
- **TipTap 3** is newer than memory can be trusted on: read the installed
  package's types and README for `useEditor` (`immediatelyRender: false` for
  SSR), `Node.create`, `isolating`, and StarterKit's per-extension `false`
  options.
- `*.client.tsx` for everything TipTap; schema and helpers in `.ts` so
  `node --test` runs them. Imports `#app/...` with extensions.
- The section chip and any later toolbar are **outside the contenteditable**
  (D169): no interactive control inside the `textbox`.
- `isSafeHref` and `isStorableText` stay in `inline-runs.ts`; settings and
  media import them. Moving them is a refactor, not this item.
- Step 5's mechanical edits suit `implementer`; steps 1-4 and 6 are design
  work.
- **Findings this item closes by deleting their code** (14a's review closes
  them): F-29 (requirement: step 3), F-31, F-38, F-39 (requirement: step 7),
  F-50, F-51, F-52, F-104, F-127, F-128. **F-79** stays deferred: its
  requirement moves to 14a2's spec with the image block.
- **For 14a2's spec** (step 5 removed them with the old image block): a
  published captioned image renders (`public-site`), and an image loads under
  the public CSP (`content-security-policy`) - restore both with the image
  block.
- **After 14a3:** the admin CSP's `'unsafe-inline'` and `data:` exist only for
  Editor.js (`content-security-policy.ts`); once the whole editor is in,
  check whether TipTap needs either and tighten it - a fix spec.
- The format bar and link dialog are interim (Design reference); build them
  from the kit's components so 14a3 can move them rather than rewrite them.
