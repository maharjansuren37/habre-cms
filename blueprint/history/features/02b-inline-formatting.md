# Feature: Inline formatting

**From build plan:** item 2b
**Type:** Feature
**Status:** built; all repairs approved - next is the independent re-review

## Resume here (handoff, 2026-09-21)

**Goal:** item 2b - bold, italic and links stored as structured runs
(`blocks_format` v2), never HTML. Steps 1-6 and repairs F-43..F-47 are ticked,
plus F-47's title residual; evidence is under each step below.

**State:** branch `feature/inline-formatting`, **nothing committed** (base `main`
`21e67f9`); all work is in the working tree, including untracked
`inline-runs.ts`, `blocks-format.ts`, `0003_blocks_v2.sql`,
`e2e/inline-formatting.spec.ts`, `blueprint/reference/2b-inline-toolbar/`.
Development database has `0003` applied and 0 entries. Production has neither
`0002` nor `0003`.

**In progress:** nothing. Every build step and repair is ticked; the owner
approved Repair F-47 and asked for its title residual, which is built, tested
and ticked (2026-09-21).

**Next:**
1. Run `review current` through the independent `reviewer` agent (the owner
   agreed to that for this item). Findings F-43..F-47 are `fixed` and only a
   review closes them; review fresh, not from the ledger.
2. Then `ship` (separate yeses for commit, merge, push). No P0/P1 is open or
   fixed, so nothing blocks it.

**Gotchas:**
- This shell's `grep` wrapper **skips untracked files** - use `command grep`.
- `npm run test:e2e` builds; after any break-and-restore test, rebuild before
  starting a server by hand, or it serves the broken build.
- Hand-run server: `PORT=3200 APP_URL=http://127.0.0.1:3200 npm start`; stop
  with `fuser -k 3200/tcp` (`pkill -f` matches its own shell).
- Dev DB psql: `docker compose exec -T db psql -U postgres -d habre_cms`.
  A non-`v2` test row needs `entries_blocks_format_check` dropped - re-add it
  and confirm in `pg_constraint` afterwards.
- "Saved" is on screen when a draft opens; wait for the POST response instead.
- Editor.js 2.31.6: a tool with its own `inlineToolbar` list gets "Convert to"
  prepended; `true` inherits the top level. Headings deliberately offer
  Italic + Link only (F-43, owner's choice).
- Tool calls containing a literal NUL escape are refused - put them in a script.

**Verify with:**

    npm run verify        # 138 unit tests, lint, typecheck, build
    npm run test:e2e      # 30 passed; needs docker compose up -d

## Goal

A writer can make words **bold** or *italic* and turn them into a link, in text,
heading and list blocks, and see that formatting again when the post is reopened.
It is stored as structured runs - never as HTML - so item 4's public renderer and
a later page builder read data rather than markup. This closes the gap D26 left
open, where a writer's `<b>` is kept as visible characters.

## In scope

- **Block format `v2`:** every piece of text (`text` block, `heading` block, each
  list item) becomes a list of runs: `{ text, bold?, italic?, href? }`.
- **A server-side parser** from the editor's HTML fragment to runs, and a
  serializer from runs back to escaped HTML for the editor. Pure, no dependency,
  bounded (D27).
- **Links limited to safe addresses:** `https:`, `http:`, `mailto:`, a
  site-relative path (`/about`) or a fragment (`#section`). Anything else -
  `javascript:`, `data:`, `vbscript:`, a protocol-relative `//host` - refuses the
  save with a message naming the block.
- **Migration `0003_blocks_v2.sql`:** converts every `v1` row to `v2` and
  changes the column default.
- **F-37:** the entries reader selects `blocks_format` and refuses a row whose
  format this build does not understand, loudly, instead of handing the editor a
  shape it misreads.
- **The editor:** Editor.js's built-in inline toolbar, offering exactly Bold,
  Italic and Link (and their shortcuts Ctrl/Cmd+B, I, K), in all three block
  tools.
- Browser tests for the round trip and the refusals; the save p95 re-measured.

## Out of scope

- **Rendering formatting on the public site** - item 4, which must render runs
  through JSX (D26) and decides the public link attributes (`rel`, new tab).
- Underline, strikethrough, inline code, highlight, text colour, and Editor.js's
  "Convert to" inline menu - not asked for; each would widen the run shape.
- **Line breaks inside a block** (Shift+Enter): still collapsed to a space, as in
  `v1`. A new block is a new paragraph.
- Links to a page by id (`pageId`, as navigation will have) - item 6/7 if wanted;
  a link here is an address.
- Client-side link validation in the editor's link field: the server refuses on
  save with a message, which is where the check has to live anyway. Worth a later
  fix if writers hit it.
- F-38 (duplicate block ids), F-39 (body cap vs block limits), F-31 (placeholder)
  - adjacent, not this item. F-39 gets slightly worse, see Notes.

## Design reference

- `prototypes/editor.html` and `design.md` *Editor* - the record **does not
  cover the inline toolbar or the link field**. This item uses Editor.js's own
  toolbar and adds only what the tokens need: in dark mode the toolbar, its
  buttons and the link input must meet the measured contrast (text >= 4.5:1,
  non-text >= 3:1) and show the 2px accent focus outline. Links inside the
  editor use `--color-accent` (6.0 / 8.4 on `--color-bg`, already measured).
- Step 6 adds an *Inline formatting* line to `design.md` *Components* saying the
  above, so `review` has something to measure against.

## Build steps

- [x] **Step 1 - Runs, parser and serializer** - new pure module
  `app/features/blocks/inline-runs.ts` with its test file. Exports the `Run` type
  and `runsSchema` (Zod), `parseInlineHtml(html)` returning
  `{ ok: true, runs } | { ok: false, reason: "unsafe_link" | "too_long" }`, and
  `runsToHtml(runs)`. Nothing imports it yet.
  Parser rules, in a single left-to-right scan with counters - **no recursion,
  no regex backtracking over the whole input**:
  - `<b>`/`<strong>` -> bold, `<i>`/`<em>` -> italic, `<a href>` -> link; open
    and close adjust a depth counter per mark, so nesting and unbalanced tags
    cannot throw. `<a>` inside `<a>`: the inner href wins until it closes.
  - `<br>` -> a space. Every other tag is dropped and its text kept.
  - Entities decoded once: `&amp; &lt; &gt; &quot; &#39; &nbsp;`, any decimal or
    hex numeric entity (out-of-range code points left as written); unknown named
    entities left as written.
  - Whitespace collapsed to single spaces across run boundaries; leading space
    trimmed from the first run, trailing from the last.
  - **Canonical output:** empty runs removed, adjacent runs with identical marks
    merged, a mark key present only when true (`bold: true`, never
    `bold: false`), `href` absent for unlinked text. So one piece of text has
    exactly one stored form.
  - `href` attribute read quoted or unquoted, entity-decoded, trimmed, then
    checked: after removing ASCII whitespace and control characters, the scheme
    (case-insensitive) must be `http:`, `https:` or `mailto:`, or the value must
    start with `/` but not `//`, or with `#`. Max 2,048 characters. An `<a>` with
    no `href` is plain text.
  - Bounds: over 20,000 characters of text, over 2,000 runs, or over 10,000
    tags -> `too_long`, checked as the scan goes so a huge input stops early.
    **Refused, never truncated** (D27).
  - `runsSchema` applies the same href rule and the canonical-form rules (via
    one shared `isSafeHref`), so a payload that skips the parser cannot store
    what the parser would refuse.
  - `runsToHtml`: escapes `& < >` in text and `& " < >` in `href`, nests as
    `<a href="…"><b><i>text</i></b></a>`, emits nothing for `[]`.
  *Done when:* `npm test` passes with tests that each state the result:
  `<b>a</b> <i>b</i>` -> two runs; nested and overlapping marks; adjacent
  same-mark runs merged; `&lt;img onerror&gt;` stays literal text and
  `runsToHtml` re-escapes it; `javascript:alert(1)`, `JaVaScRiPt:`,
  `java&#x09;script:`, ` javascript:`, `&#106;avascript:`, `data:text/html,…`
  and `//evil.example` all return `unsafe_link`; `https://`, `mailto:`, `/about`
  and `#top` accepted; a `"` in an href comes back escaped from `runsToHtml`;
  **for a set of canonical run lists, `parseInlineHtml(runsToHtml(runs))`
  deep-equals `runs`**; `runsSchema` refuses a `javascript:` href, an empty run
  and `bold: false`; 50,000 nested `<b>` and an unterminated `<a href="` return a result
  instead of throwing; 20,001 characters -> `too_long`. At least the
  `unsafe_link` and round-trip tests are **shown to fail** when their rule is
  removed, with the output pasted here.
  *Evidence (2026-09-17):* `node --test app/features/blocks/inline-runs.test.ts`
  -> 18 pass, 0 fail. `npm run verify` -> exit 0, 128 unit tests (110 + 18),
  build ok. Shown to fail, each mutation then reverted (file byte-identical after):
  scheme allowlist replaced by "any scheme" -> 2 fail (unsafe links; stored
  shape); `//`/`/\` check removed -> 1 fail (unsafe links); text escaping
  removed from `runsToHtml` -> 2 fail (escaping; round trip); link dropped from
  `runsToHtml` -> 2 fail (escaping; round trip).

- [x] **Step 2 - Migration `0003_blocks_v2.sql`** (run through `migrate`) - one
  transaction (the runner already wraps each file): for every row with
  `blocks_format = 'v1'`, rewrite `blocks` so each `data.text` and each
  `data.items[i]` string becomes `[{"text": <string>}]`, or `[]` when the string
  is empty; set `blocks_format = 'v2'`; change the column default to `'v2'`; add
  `check (blocks_format in ('v2'))` so a stray `v1` write fails at the database.
  `v1` text is already plain and whitespace-collapsed, so no reformatting is
  needed - wrapping is the whole conversion. Does not touch `version` or
  `updated_at`: nobody edited the post.
  **Between this step and step 3 the development app cannot open existing drafts**
  (v1 code meets v2 rows). Development holds no real data; steps 2 and 3 are
  built back to back.
  *Done when:* against the development database, with three seeded `v1` drafts -
  one text + heading, one list with an empty item, one with no blocks -
  `npm run db:migrate` prints `Applied 0003_blocks_v2.sql`; a `select` shows each
  converted exactly (pasted here); a second run prints `No pending migrations.`;
  `insert … blocks_format = 'v1'` is refused by the check.
  *Evidence (2026-09-17, development database, applied as the app's own
  non-superuser role):* three `v1` drafts seeded under a throwaway author.
  `npm run db:migrate` -> `Applied 0003_blocks_v2.sql`. Afterwards:
  `Empty` -> `[]`; `List` -> `items: [[{"text":"first"}], [], [{"text":"third"}]]`;
  `Text and heading` -> heading `[{"text":"A heading"}]` level 2 kept,
  `[{"text":"Tom & Jerry <b> stays literal"}]`, empty text -> `[]`; block order
  h1, p1, p2 kept; all `v2`, `version` still 1; column default `'v2'::text`.
  Second run -> `No pending migrations.` A stray write
  (`update … set blocks_format = 'v1'`) -> `violates check constraint
  "entries_blocks_format_check"`. Seed rows and author deleted (0 entries left).

- [x] **Step 3 - Switch the block format to `v2`** - in `blocks.ts`:
  `BLOCKS_FORMAT = "v2"`; `text`, heading `text` and list `items[]` use
  `runsSchema` (list items: 1-500, each a run list); `fromEditorJs` runs every
  text through `parseInlineHtml` and turns `unsafe_link` into
  `Block N has a link to an address that cannot be used. Links must start with https://, http://, mailto: or /.`
  and `too_long` into the existing length wording; `toEditorJs` uses
  `runsToHtml` in place of `escapeForEditor`. `toPlainText` and
  `escapeForEditor` are deleted (their tests move or go). List-item
  flattening keeps every D27 bound, now producing run lists; an empty item
  (`[]`) is dropped as the empty string was. The module doc comment and
  `0002`'s wording about `v2` updated to say it is done.
  `e2e/write-post.spec.ts` assertions and seeds move to `v2` shapes in this step,
  not later - they guard item 2a's P0 and both P1s.
  *Done when:* `npm run verify` passes **and `npm run test:e2e` passes** (the
  existing 25, count pasted); the existing `blocks.test.ts` cases are
  converted (not deleted) - including the F-32/F-33/F-41 hostile shapes, each
  still refused or bounded; a new test shows a list item's `<b>` survives as a
  bold run; `toEditorJs` of a run containing `<script>` yields escaped text.
  *Evidence (2026-09-17):* `npm run verify` -> exit 0, 132 unit tests (25 in
  `blocks.test.ts`, every earlier case converted, 4 added), build ok.
  `npm run test:e2e` -> `25 passed`, against the migrated development database
  (its `v2` check constraint would refuse any `v1` write). Shown to fail, then
  reverted byte-identical: paragraph text handed to the editor unescaped -> 2
  fail (markup-as-text, round trip); unsafe-link reason mapped to the length
  message -> 1 fail. Also converted: two `v1` fixtures in
  `app/features/content/entry-input.test.ts`, which failed at runtime rather
  than at typecheck because the schema parses `unknown`.

- [x] **Step 4 - Refuse an unknown format on read (F-37)** - `entries.server.ts`
  selects `blocks_format`; `findEntryForUser` and the `update … returning` path
  throw an error naming the entry id and the format when it is not
  `BLOCKS_FORMAT`, which the route's error boundary shows. The decision lives in a
  plain exported function (`assertKnownFormat`) in a `.ts` file so `node --test`
  covers it; the `Entry` type does not gain the field.
  *Done when:* unit test: `v2` passes, `v1` and `v3` throw with the id in the
  message; in the browser, a row hand-set to `v9` in the development database
  shows the error page at `/admin/posts/:id` rather than an empty editor
  (pasted), then is set back. F-37 marked `fixed` with that evidence.
  *Evidence (2026-09-17):* `npm run verify` -> exit 0, 134 unit tests, build ok.
  `blocks-format.test.ts` shown to fail (1 of 2) with the check replaced by a
  bare `return`, then restored byte-identical. Live, against the production build
  on port 3200 and the development database: a draft stored as `v2` -> `GET
  /admin/posts/:id` 200, post title in the page; the same row as `v9` -> 500,
  the error page ("Oops!"), and the server log reads `Error: Entry caf2ebdf-…
  is stored in block format "v9", but this build reads only "v2".`; back to
  `v2` -> 200. **The `v9` row needed `entries_blocks_format_check` dropped
  first** - step 2's constraint makes the case impossible otherwise, which the
  spec did not foresee. The constraint was re-added (confirmed in
  `pg_constraint`), the draft and throwaway user deleted (0 left).

- [x] **Step 5 - Turn on the inline toolbar** - `editor.client.tsx`:
  top-level `inlineToolbar: ["bold", "italic", "link"]`, and the same list on
  `header` and `list` (paragraph inherits the top level); replace the "No inline
  toolbar in v1" comment. Dark-mode and focus styles for `.ce-inline-toolbar`,
  `.ce-inline-tool`, `.ce-inline-tool-input` and links inside the editor, via
  `:global` in `post-form.module.css`, using existing tokens only.
  *Done when:* in Chromium, selecting a word in a text block shows a toolbar with
  exactly three buttons - Bold, Italic, Link - and no "Convert to"; the same in a
  heading and a list item; Ctrl+B on a selection wraps it in `<b>`; screenshots
  of the open toolbar and the link field in light and dark mode pasted here, with
  the contrast of the toolbar icon on its background measured from the rendered
  colours (>= 3:1) and the link input text (>= 4.5:1).
  *Evidence (2026-09-17), Chromium against the production build on port 3200:*
  toolbar items read from the DOM -> `["bold","italic","link"]` for a text
  block, a heading and a list item, in light and in dark. Ctrl+B on a
  keyboard-selected word -> `Paragraph words <b>here</b>`. Measured from rendered
  colours (light / dark): toolbar icon on its background 16.75 / 14.07; hovered
  icon 15.07 / 12.86; link field text 16.75 / 14.07, field focused with a solid
  accent outline; selected text 6.45 / 8.40; Editor.js's own tooltip (unchanged,
  dark in both schemes) title 10.66, shortcut line 4.73 (60% opacity blended).
  Screenshots: `blueprint/reference/2b-inline-toolbar/`. `npm run verify` ->
  exit 0, 134 tests; `npm run test:e2e` -> `25 passed`.
  **Three things only the browser showed, all repaired in this step:**
  (1) giving `header` and `list` their own inline tool list made Editor.js
  2.31.6 prepend a "Convert to" menu (`assignInlineToolsToBlockTool`); they now
  take `true`, which inherits the top-level list exactly. (2) Editor.js hardcodes
  a `#f8f8f8` hover on inline tool buttons, hiding the icon in dark mode; mapped to
  `--color-surface-hover`. (3) Editor.js injects
  `.codex-editor ::selection { background: #d4ecff }`, which made selected light
  text invisible in dark mode; selection inside the editor now uses the measured
  accent pair. *(Corrected by the F-44 repair: this first read the rule as
  page-wide and set selection app-wide in `app.css`.)* The + menu shares the popover component, so it
  follows the dark-mode tokens too.

- [x] **Step 6 - Browser tests, the bar, and the records** -
  `e2e/inline-formatting.spec.ts`, seeding through the database as
  `write-post.spec.ts` does rather than driving the floating menus (status gotcha):
  1. A seeded `v2` draft with a bold run, an italic run, a link and a bold list
     item opens with `<b>`, `<i>` and `<a href="https://example.com/">` in the
     editor; saving it unchanged stores deep-equal runs.
  2. Selecting a typed word with the keyboard, pressing Ctrl+B and saving stores
     a bold run (keyboard, not the toolbar).
  3. A save whose `blocks` carries `<a href="javascript:alert(1)">` is refused
     with the block-numbered message, the stored post is unchanged, the editor
     keeps the writer's content.
  4. A seeded run whose text is `<img src=x onerror=window.__xss=1>` opens as
     visible text, `window.__xss` stays undefined (the F-33 test, kept for `v2`).
  Then update `design.md` *Components* with an *Inline formatting* line (see
  Design reference), and widen the open `needs-you.md` editor line to name the
  inline toolbar and link field.
  *Done when:* `npm run test:e2e` passes with the new file included (count
  pasted); test 3 and test 4 are **shown to fail** with, respectively, the
  scheme check and the text escaping removed; **20 consecutive saves of a post
  with formatted runs measure p95 under 1 s server-side** (`quality-bar.md`),
  numbers pasted; `npm run verify` passes.
  *Evidence (2026-09-17):* `npm run test:e2e` -> `29 passed` (25 + 4 new), on
  two consecutive runs; `npm run verify` -> exit 0, 134 unit tests. Shown to fail,
  source restored byte-identical and rebuilt afterwards: scheme allowlist
  replaced by "any scheme" -> test 3 fails because no refusal appears (the save
  was accepted); text escaping removed from `runsToHtml` -> test 4 fails because
  the bold run's visible text is empty (the markup became an element). **Save
  bar:** 20 consecutive saves of a 60-paragraph post, each with bold, italic
  and a link (26,142-byte body), against the production build - every save 200,
  median 40.6 ms, **p95 65.1 ms**, max 73.0 ms; timed at the client over
  loopback, so an upper bound on server time. Stored row afterwards: version 21,
  60 blocks, first block as canonical runs. `design.md` *Component conventions*
  has the *Inline formatting* line; `needs-you.md`'s editor line was widened at
  spec time.
  **Two things the tests surfaced:** (1) "Saved" is already on screen when a
  saved draft opens, so waiting for it read the database before the save
  finished; the spec's `save` helper waits for the POST response instead.
  (2) The first full run failed one login with `login_rate_limited`,
  `scope: "server"` - the login screen's two password-check slots
  (`passwordCheckSlots`) against Playwright's default 5 workers; four more
  logging-in tests made the overlap likely. `playwright.config.ts` now sets
  `workers: 2`, matching the slots, rather than retrying logins, which would hide
  the limit the auth tests exercise.

- [x] **Repair F-43 - Bold in a heading cannot be saved** - confirm it in the
  running app, then stop offering a mark a heading cannot hold, and record the
  choice in `design.md` *Inline formatting*.
  *Done when:* reproduced (or disproved) at `/admin/posts/:id` with the stored
  row pasted; after the repair the heading toolbar offers only what saves; a
  browser test saves an italic or link run from a heading and reads it back from
  the database, **shown to fail** without the repair's half that it covers.
  *Evidence (2026-09-17), production build:* **reproduced in the app** - heading
  `font-weight` 700, `queryCommandState("bold")` true, clicking Bold gave
  `A section <span style="font-weight: normal;">heading</span>`, save 200, stored
  `[{"text": "A section heading"}]`. Owner chose: headings offer Italic and Link,
  accepting Editor.js's "Convert to" menu there. After: toolbar `text`
  `["bold","italic","link"]`, `heading` `["convert-to", separator, "italic",
  "link"]`, `list item` `["bold","italic","link"]`; Convert to offers only
  `Text`; Chromium's native Ctrl+B in a heading changes nothing. New browser test
  (Ctrl+I in a heading, stored `[{"text":"A section "},{"text":"heading","italic":true}]`)
  **shown to fail** with header back on `inlineToolbar: true` (bold item count
  expected 0, received 1), then restored byte-identical. `npm run verify` -> exit
  0, 134 tests; `npm run test:e2e` -> `30 passed`. `design.md` *Inline
  formatting* records the choice and why.

- [x] **Repair F-44 - Selection colour scoped to what Editor.js actually changes**
  - move the override from `app/app.css` to `.canvas ::selection` in
  `post-form.module.css`, and correct "page-wide" in this spec's Decisions and in
  `design.md`.
  *Done when:* in Chromium, selected text inside the editor measures >= 4.5:1 in
  light and dark, the login page's selection is the browser default again, and no
  record says "page-wide".
  *Evidence (2026-09-17), production build:* the rule removed from `app/app.css`
  and set as `.canvas :global(.codex-editor) ::selection` in
  `post-form.module.css` - one class more specific than Editor.js's
  `.codex-editor ::selection` (confirmed in the bundle), so it no longer depends on
  stylesheet order. Measured: editor selection light 6.45, dark 8.40; login page
  and editor top bar `::selection` background `rgba(0, 0, 0, 0)` (browser default)
  in both schemes. Dark screenshot checked. Records corrected: step 5 evidence,
  *Decisions*, *Files and areas*, `design.md` *Inline formatting* - "page-wide"
  now appears only in the notes explaining the correction. `npm run verify` ->
  exit 0.

- [x] **Repair F-45 - Refusal messages that say what actually happened** -
  `parseInlineHtml` distinguishes a too-long text from too much formatting, and
  `toRuns` words the link message to name `#` and exclude `//`.
  *Done when:* unit tests assert the exact message for `//example.com`, an
  over-long href, 2,001 runs and 20,001 characters; `npm run verify` passes.

  *Evidence (2026-09-17):* `parseInlineHtml` now refuses with one of four reasons
  (`Refusal`): `unsafe_link`, `link_too_long` (href over 2,048), `too_long` (text
  over 20,000), `too_much_formatting` (over 2,000 runs or 10,000 tags);
  `blocks.ts` maps each to its own sentence saying what happened and what to do.
  Unit tests assert the exact message for `//example.com`, a 2,068-character
  href, 2,002 runs and 20,001 characters, plus the reasons themselves - **shown
  to fail** (2 tests) with the run cap reporting `too_long` again, then restored
  byte-identical. `npm run verify` -> exit 0, 135 unit tests. The browser test
  for the unsafe link matches the message's unchanged first sentence.

- [x] **Repair F-46 - A save requires the row's current format** - add
  `and blocks_format = ${BLOCKS_FORMAT}` to `updateDraft`'s `where`.
  *Done when:* against the development database, a row whose format is not
  `v2` (constraint dropped and re-added, as step 4 did) is not written by a save
  and the save fails loudly without changing it; `npm run test:e2e` passes.

  *Evidence (2026-09-17), production build on port 3200, development database:*
  a draft stored as `v9` (check constraint dropped for the run, re-added and
  confirmed after each), then a save from a tab that loaded version 1.
  **Before the fix:** save 200, and the row became `Saved from an old tab|v2|2|`
  `[{"id":"p1",...,"text":[{"text":"old tab text"}]}]` - the newer content was
  silently replaced and downgraded, worse than the finding described. **After:**
  save 500, server log `Entry … is stored in block format "v9", but this build
  reads only "v2".`, row unchanged `Newer format|v9|1|[{"future": true}]`. Test
  rows and user deleted (0 entries). `npm run verify` -> exit 0, 135 tests;
  `npm run test:e2e` -> `30 passed`. No automated test: CI has no database (D24)
  and the case needs the constraint dropped.

- [x] **Repair F-47 - A NUL character is refused, not a 500** - strip U+0000
  in `parseInlineHtml` and refuse it in `runsSchema`.
  *Done when:* unit tests: a fragment containing U+0000 parses without it, and
  `runsSchema` refuses a run containing it - each **shown to fail** without its
  half; `npm run verify` passes.

  *Evidence (2026-09-17):* `parseInlineHtml` drops U+0000 from the fragment
  before reading it (text and link addresses); `runsSchema` refuses it in a run's
  text and `isSafeHref` refuses it in an address. `&#0;` is left as written, so
  entities cannot reintroduce it. Two unit tests, each guard **shown to fail**
  on its own (parser strip removed -> 1 fail; schema text refusal removed -> 1
  fail; href refusal removed -> 1 fail), file restored byte-identical.
  `npm run verify` -> exit 0, 137 tests. Approved by the owner 2026-09-21. The
  title half - out of scope here - is the next step, added on the owner's yes.

- [x] **Repair F-47's residual - a NUL character in the title** - refuse U+0000
  in the post title at the trust boundary, so the same crafted save cannot reach
  the `text` column and answer 500.
  *Done when:* a unit test asserts the exact message for a title containing
  U+0000, **shown to fail** without the guard; `npm run verify` passes.

  *Evidence (2026-09-21):* `entry-input.ts`'s `title` gains
  `.refine((title) => !title.includes("\u0000"), …)` after the length checks,
  with the message "The title has a character that cannot be stored. Remove it
  and save again." - `parsePostForm` already renders the first issue's message as
  the 400 the writer reads, so nothing else changed. One unit test in
  `entry-input.test.ts` asserts that exact message; **shown to fail** with the
  `refine` removed (7 tests, 1 fail - "a title carrying a character the database
  cannot store"), file restored byte-identical (md5
  `f3620fedd7baf95fe1e1b95c0bd485bc` before and after). `npm run verify` ->
  exit 0, **138 unit tests**, build ok.

- [x] **Repair F-48 - A visible focus ring on the inline toolbar's buttons** -
  the spec's *Design reference* asked for the 2px accent outline on the toolbar's
  buttons and only the link input got one; Editor.js's sole focus affordance is a
  background swap, mapped here to the same token as hover (1.11:1 light /
  1.09:1 dark), so focused and hovered look identical.
  *Done when:* in Chromium, against the production build, keyboard focus on Bold,
  Italic and Link shows the 2px `--color-focus` outline in light and dark, is
  distinguishable from hover, and the outline's contrast against the toolbar
  surface is measured from the rendered colours (>= 3:1) and pasted here;
  `npm run verify` passes.

  *Evidence (2026-09-21), Chromium against the production build on port 3200:*
  one rule, `.canvas :global(.ce-popover-item--focused)`, 2px solid
  `--color-focus` inset. **What only the browser showed:** the buttons never
  take DOM focus - `document.activeElement` stays on the paragraph while
  Editor.js moves a `--focused` class along the items, and it puts that class
  directly on the `.ce-inline-tool` button for Italic and Link (which sit inside
  `.ce-popover-item-html`) and on the `.ce-popover-item` button for Bold. So a
  `:focus-visible` companion selector, written first, was dead and was removed.
  Measured from rendered colours, tabbing through all three: Bold, Italic and
  Link each `2px solid`, outline against the toolbar surface **6.45 light /
  7.76 dark** (bar: 3:1 non-text). Focus and hover are now distinct - hovering
  Bold while Link is focused gives the hovered one `3px none` and the focused one
  `2px solid`, where before both were the same 1.11 / 1.09 background.
  Screenshots: `blueprint/reference/2b-inline-toolbar/toolbar-focus-{light,dark}.png`.
  `npm run verify` -> exit 0, 138 tests at that point. **Guarded by a browser
  test** (`e2e/inline-formatting.spec.ts`, "keyboard focus on a toolbar button is
  visible, and differs from hover"): the focused item has a 2px solid outline and
  a hovered, unfocused one has none - **shown to fail** with the rule deleted
  (1 failed, 5 passed), file restored byte-identical (md5
  `bd41404b1a89b622207c11631a4afeff`). `npm run test:e2e` -> **31 passed**.

- [x] **Repair F-49 - Refuse every character jsonb cannot hold, not only U+0000** -
  widen F-47's two guards to lone surrogates, which pass today and make the same
  crafted save answer 500.
  *Done when:* one shared predicate covers `runSchema.text`, `isSafeHref` and
  `blockId`; unit tests show a lone surrogate refused in each, **shown to fail**
  without the guard; `npm run verify` passes.

  *Evidence (2026-09-21):* one exported predicate, `isStorableText` in
  `inline-runs.ts` - `!text.includes("\u0000") && text.isWellFormed()` - now used
  by `runSchema.text`, `isSafeHref` and `blocks.ts`'s `blockId`, the three things
  that reach the same `jsonb` column. U+0000 keeps its own `includes` because it
  *is* well-formed. The parser is unchanged: it strips U+0000 as before and lets
  the schema refuse a lone surrogate, because `toWellFormed()` would silently
  rewrite the writer's text to U+FFFD, against D27. Measured: `fromEditorJs` with
  a lone surrogate returns `{"ok":false,"message":"Block 1 could not be saved: a
  character that cannot be stored."}` instead of reaching the insert. Two tests
  added (lone surrogate in text and in an href, a real emoji pair still accepted,
  and a crafted block id refused), **both shown to fail** with `&&
  text.isWellFormed()` dropped (48 tests, 2 fail), file restored byte-identical
  (md5 `24f0918103a58349323135420008bd65` before and after). `npm run verify` ->
  exit 0, **140 unit tests**, build ok.

- [x] **Repair F-53 - Say what actually identifies the toolbar** - `design.md`'s
  *Inline formatting* credits a border measuring 1.29:1 light / 1.30:1 dark
  against its own surface.
  *Done when:* the line names only what carries the job, with the measured
  numbers; no record claims an unmeasured contrast.

  *Evidence (2026-09-21):* `design.md` *Inline formatting* now reads that the
  border is decorative at 1.29 / 1.30 against the toolbar's own background and
  that **the icons identify it** at 16.75 / 14.07 - every number in the sentence
  measured. The same paragraph gained the focus ring from F-48 and its 6.45 /
  7.76. Reworded rather than raising the border to `--color-border-control`
  (3.32 / 3.70, which would also have passed): the icons already carry WCAG 2.2
  1.4.11, so the cheaper fix is to stop claiming what is not true.

## Files and areas

- `app/features/blocks/inline-runs.ts`, `inline-runs.test.ts` - new
- `app/features/blocks/blocks.ts`, `blocks.test.ts` - v2 schema and mappers
- `app/features/blocks/editor.client.tsx` - inline toolbar on
- `app/features/content/entries.server.ts` - read `blocks_format` (F-37);
  `blocks-format.ts` and `blocks-format.test.ts` beside it hold the check
- `app/features/content/post-form.module.css` - toolbar and link styles
- `app/features/content/entry-input.ts`, `entry-input.test.ts` - v2 fixtures
  (step 3), and the title's U+0000 refusal (F-47's residual)
- `blueprint/reference/2b-inline-toolbar/` - step 5 screenshots
- `db/migrations/0003_blocks_v2.sql` - new; `0002_entries.sql` comment only if
  it misleads (a comment in an applied migration may be edited; its SQL may not)
- `e2e/inline-formatting.spec.ts` - new (step 6); `e2e/write-post.spec.ts` -
  seeds and stored-shape assertions moved to `v2` (step 3);
  `e2e/helpers/users.ts` - `storedEntry` (step 6); `playwright.config.ts` -
  `workers: 2` (step 6)
- `blueprint/context/design.md`, `blueprint/context/needs-you.md`,
  `blueprint/context/findings.md` (F-37)

## Data and contracts

**Load-bearing - item 4's renderer, item 5's image blocks and the page builder
all read this.**

```ts
// blocks_format "v2"
type Run = { text: string; bold?: true; italic?: true; href?: string };
type Runs = Run[];                     // [] is empty text

type Block =
  | { id: string; type: "text";    data: { text: Runs } }
  | { id: string; type: "heading"; data: { text: Runs; level: 2 | 3 } }
  | { id: string; type: "list";    data: { style: "bullet" | "number"; items: Runs[] } };
```

- A run's `text` is non-empty plain text; never markup, never entity-encoded.
- Runs are canonical: no empty runs, no two adjacent runs with identical marks,
  mark keys only when true. `runsSchema` rejects unknown keys (`z.strictObject`),
  so a later mark is a format change, not a silent extra field.
- `href` is one of `http:`/`https:`/`mailto:` URLs, a `/path` (not `//`), or a
  `#fragment`; at most 2,048 characters. The **schema** enforces this too, not
  only the parser, so nothing that bypasses the parser stores an unsafe link.
- Limits per piece of text: 20,000 characters summed over its runs, 2,000 runs.
  200 blocks, 500 list items and the 1 MB body are unchanged.
- Schema change: `0003_blocks_v2.sql` - data rewrite of `blocks`, default
  `'v2'`, check constraint. **Production has neither `0002` nor `0003` applied
  yet**; the next `deploy` runs both through `migrate`, in order, before the
  release.

## Testing

- **Unit (`npm test`, runs in CI):** parser, serializer and round trip; the link
  allowlist against obfuscated schemes; bounds; `fromEditorJs`/`toEditorJs` on
  `v2`, keeping every existing hostile case; the format check.
- **Browser (`npm run test:e2e`, local only - F-17):** round trip through the
  real editor, the Ctrl+B path, the unsafe-link refusal keeping the editor's
  content, the stored-XSS regression. Seeded via the database (D24).
- **Migration:** evidenced by hand against seeded `v1` rows in step 2 - the runner
  has no test harness and CI has no database.
- **Manual (needs a person):** the inline toolbar and link field by keyboard and
  screen reader - the existing `needs-you.md` editor line, widened.

## Decisions

- **Formatting is stored as flat runs with marks, not a nested tree and not
  text-plus-ranges.** A tree (`<b><i>`) has many shapes for one meaning; ranges
  break on every edit that shifts an offset. Flat canonical runs have one form
  per text, compare with a deep-equal, and render as a simple map in JSX.
- **Three marks only: bold, italic, link.** What the plan names. Each new mark is
  a `v3`, which `runsSchema`'s strict objects make explicit rather than silent.
- **The HTML is parsed by a small in-repo scanner, not a library** (no
  `parse5`/`htmlparser2`/DOMPurify). Input is Editor.js's already-sanitized
  output of four tags; the project's minimal-dependencies constraint makes a
  runtime dependency a decision, and the bounds D27 requires are easier to prove
  on 100 lines we own. Beat: `node-html-parser` (a dependency for a four-tag
  grammar).
- **An unsafe link refuses the save; it is not dropped.** Dropping keeps the text
  but silently loses what the writer did (D27: refuse rather than truncate). The
  editor's own link field accepts `javascript:` (`addProtocol` passes any
  `word:`), so the server is the only check.
- **The link allowlist is `http`, `https`, `mailto`, `/path`, `#fragment`.**
  Beat: allowing `tel:` (nobody asked), and allowing anything `new URL` parses
  (includes `javascript:`).
- **Line breaks within a block stay collapsed** in `v2`. Beat: a `break` run -
  not asked for, and it is another mark the renderer and page builder must know.
- **The format marker is enforced at both ends:** the database check refuses a
  stale write, the reader refuses an unknown row (F-37). Beat: trusting that
  every write goes through `BLOCKS_FORMAT`.
- **Text selection inside the editor uses the accent pair (`--color-accent` /
  `--color-on-accent`)** (step 5, scoped by the F-44 repair). Editor.js's own
  `.codex-editor ::selection` light blue hides selected text in dark mode; the
  rest of the app keeps the browser's default selection, which Editor.js never
  touched. Beat: `--color-accent-subtle`, barely distinguishable from the dark
  background; and an app-wide override, which rested on misreading the rule as
  page-wide (F-44).
- **Supersedes the "Cost" half of D26:** a writer's `<b>` now becomes formatting;
  typed text that merely looks like markup (`&lt;b&gt;` in the editor) is still
  kept as visible text. D26's escaping obligation moves into `runsToHtml`.

## Notes

- **Editor.js facts this relies on, read from the installed 2.31.6 bundle:**
  inline tools save `<b>`, `<i>` and `<a href target="_blank" rel="nofollow">`;
  the link tool's `validateURL` only rejects whitespace and `addProtocol` leaves
  any `scheme:` untouched, so `javascript:` reaches the server; a bare
  `example.com` becomes `http://example.com`. The `target` and `rel` attributes
  are ignored on parse and not stored.
- Editor.js still renders with `innerHTML` (D26) - `runsToHtml` is the only thing
  standing between stored text and that sink. Step 1's escape tests are the
  guard; keep them failing-first.
- **F-39 grows slightly:** run JSON is larger than a plain string, so the 1 MB body
  cap is reached a little sooner. Not fixed here; mention it at `review`.
- `erasableSyntaxOnly`: unions and `as const`, no `enum` (the reason for
  `app/types/editorjs.d.ts`); `InlineToolbar` config types come from there if
  the installed `.d.ts` needs extending.
- Deploying this later: `migrate` applies `0002` then `0003` to production; with
  no entries there yet, `0003` changes zero rows. A rollback past this release
  needs a restore, not a symlink (F-19).
- Every refusal message follows `design.md`: what happened, what to do.

## Findings

Resolved with this item; the ledger keeps the rest.

### 2b/F-43 [P2] closed - Bold in a heading un-bolds the text on screen, and the save silently drops it

**File:** app/features/blocks/editor.client.tsx:50-54 (`header: { inlineToolbar: true }`)
**Found:** 2026-09-17 by review (independent `reviewer` agent; scope: current; lens: correctness, accessibility)
**Why it matters:** Editor.js 2.31.6's Bold tool is `document.execCommand("bold")` (`node_modules/@editorjs/editorjs/dist/editorjs.mjs` ~9633). The editor's headings are `<h2 class="ce-header">`, bold by browser default - nothing in `app/**/*.css` or `@editorjs/header` changes their weight. Measured in Chromium on a contenteditable `<h2>`: `queryCommandState("bold")` is `true`, and `execCommand("bold")` yields `A <span style="font-weight: normal;">section</span> heading`, where a `<p>` yields `<b>`. That `<span>` is outside the save sanitizer's allowlist and `parseInlineHtml` drops it, so the run is stored plain and loads bold again. **Bold can never set `bold: true` in a heading**: the writer sees their words un-bold, saves, and gets them back bold - the "offer it, then quietly drop it on save" outcome this item set out to avoid. Step 5 checked only that the toolbar appears in a heading; no test saves formatting from one. **Reproduced in bare Chromium and from the Editor.js source, not yet by clicking Bold at `/admin/posts/:id`.**
**Suggested fix:** Confirm in the app, then stop offering Bold in headings. A per-tool list (`["italic", "link"]`) brings back Editor.js's "Convert to" menu (`assignInlineToolsToBlockTool`), so either hide that one item with CSS or accept it; or decide headings carry no bold and refuse `bold` on heading runs in the schema. Record the choice in `design.md` *Inline formatting*, and add a browser test that saves an italic or link run from a heading.
**Resolution:** Repaired 2026-09-17 by build. First **confirmed in the app** against the production build: clicking Bold in a heading produced `<span style="font-weight: normal;">`, the save answered 200 and stored the heading as a plain run. The owner chose Italic and Link for headings, accepting Editor.js's "Convert to" menu (which offers only Text) over hiding it with CSS. `editor.client.tsx` gives `header` `inlineToolbar: ["italic", "link"]`; text and list blocks keep all three. Chromium's native Ctrl+B in a heading was checked and changes nothing. Evidence: a browser test asserts the heading toolbar has no Bold and that Ctrl+I saves an italic run - **shown to fail** with the old config (bold count 1, expected 0); `npm run test:e2e` 30 passed. `design.md` *Inline formatting* records the choice. Status `fixed`.

**Closed 2026-09-21 by review (independent `reviewer` agent; scope: current).** Re-examined: `editor.client.tsx:52-58` gives `header` `inlineToolbar: ["italic", "link"]` while text and list keep all three, and `e2e/inline-formatting.spec.ts` asserts the heading toolbar has no Bold and that Ctrl+I stores `{text: "heading", italic: true}`; `npm run test:e2e` -> `30 passed` this pass. Nothing new in the repaired area. The one residual - that the "native Ctrl+B changes nothing" half rests on a single manual observation and is untested - is recorded separately as F-52, not as a reason to keep this open.

### 2b/F-44 [P3] closed - The selection-colour override rests on a misreading, and three records say "page-wide"

**File:** app/app.css:115-122; `blueprint/context/current-work.md` *Decisions*; `blueprint/context/design.md` *Inline formatting*
**Found:** 2026-09-17 by review (independent `reviewer` agent; scope: current; lens: quality)
**Why it matters:** The injected rule is `.codex-editor ::selection { background-color: #d4ecff }` - confirmed from the bundle - so it applies inside the editor only. The stated reason for an app-wide override ("overriding only inside the editor would leave the rest of the page broken") is false, and the login page and admin shell had their selection colour changed for no reason. The override works (equal specificity, and Editor.js prepends its `<style>` to `<head>`, so `app.css` wins on order), but only for as long as that injection order holds. A record that states a wrong reason is believed by the next reader.
**Suggested fix:** Scope it to `.canvas ::selection` in `post-form.module.css`, which also outranks on specificity; or keep it app-wide as a deliberate choice. Either way, correct the three records to "inside the editor".
**Resolution:** Repaired 2026-09-17 by build. The override moved from `app/app.css` to `.canvas :global(.codex-editor) ::selection` in `post-form.module.css`, one class more specific than Editor.js's own rule so it holds regardless of injection order. Measured against the production build: editor selection 6.45 (light) / 8.40 (dark); the login page and the editor's top bar are back to the browser default. The spec's step 5 evidence, *Decisions* and *Files and areas*, and `design.md`, now say "inside the editor". Status `fixed`.

**Closed 2026-09-21 by review (independent `reviewer` agent; scope: current).** Re-examined: no `::selection` rule remains in `app/app.css`, and `post-form.module.css:145-149` scopes it to `.canvas :global(.codex-editor) ::selection` - three classes plus a pseudo-element against Editor.js's one class, so it wins on specificity rather than injection order, which was the point of the repair. The three records say "inside the editor". Nothing new.

### 2b/F-45 [P3] closed - The refusal messages mislead in reachable cases

**File:** app/features/blocks/blocks.ts:98-111 (`toRuns`)
**Found:** 2026-09-17 by review (independent `reviewer` agent; scope: current; lens: quality)
**Why it matters:** `//example.com` is refused with "Links must start with https://, http://, mailto: or /" - it does start with `/`. `#top` is accepted but not named. Editor.js's `addProtocol` treats `localhost:3000/x` as already having a scheme and leaves it, so it gets the same unhelpful sentence. An href over 2,048 characters is called an unusable address, and more than 2,000 runs or 10,000 tags is reported as "longer than 20,000 characters", which the writer can see is untrue. `fundamentals.md` and `design.md` *Words*: a message says what happened and what to do.
**Suggested fix:** Name `#` and "not `//`" in the link message, and give the run and tag caps their own reason and wording ("has too much formatting").
**Resolution:** Repaired 2026-09-17 by build. The parser returns one of four refusal reasons - `unsafe_link`, `link_too_long`, `too_long`, `too_much_formatting` - and `blocks.ts` gives each its own sentence: the link message now names `#` and "a single /"; an over-long href says to shorten the link; the run and tag caps say "too much formatting" and how to fix it; the length message says to split the block. Evidence: unit tests assert all four exact messages (including `//example.com`) and fail when the run cap is mapped back to `too_long`; `npm run verify` 135 tests. Status `fixed`.

**Closed 2026-09-21 by review (independent `reviewer` agent; scope: current).** Re-examined: four distinct reasons in `inline-runs.ts:84`, four sentences in `blocks.ts:99-108`, and `blocks.test.ts` asserts all four exact strings including the one for `//example.com`. Nothing new.

### 2b/F-46 [P3] closed - `updateDraft` does not require the row's current format

**File:** app/features/content/entries.server.ts:100-110
**Found:** 2026-09-17 by review (independent `reviewer` agent; scope: current; lens: correctness)
**Why it matters:** The update writes `blocks_format = 'v2'` and filters on id, version, type and owner, never on the row's current format. Unreachable today, because the check constraint allows only `v2`. **At the next format change it is reachable:** `0003` leaves `version` untouched, so an editor tab opened before a `v3` deploy saves `v2` blocks over a `v3` row with a matching version; the new constraint refuses it with an unhandled `23514`, the error boundary replaces the editor, and the writer's text is lost - F-39's failure. `assertKnownFormat` on this `returning` is also dead code, since the row was just written as `v2`.
**Suggested fix:** Add `and blocks_format = ${BLOCKS_FORMAT}` to the update's `where`, so a mismatched row falls through to `findEntryForUser`, which fails loudly without writing. Or record it as an obligation on the `v3` migration.
**Resolution:** Repaired 2026-09-17 by build: `updateDraft`'s `where` adds `and blocks_format = ${BLOCKS_FORMAT}`. Evidence against the production build, with a row stored as `v9` (constraint dropped for the run, then re-added): **before**, a save from a version-1 tab answered 200 and overwrote the row as `v2` with the old tab's text - silent loss of the newer content, worse than described; **after**, the save answers 500 through `findEntryForUser`'s format check and the row is unchanged. `npm run test:e2e` 30 passed. Not covered by an automated test (needs a dropped constraint and a database; D24). Status `fixed`.

**Closed 2026-09-21 by review (independent `reviewer` agent; scope: current).** Re-examined: `entries.server.ts:108` carries `and blocks_format = ${BLOCKS_FORMAT}`, the same constant used in the `set`, so the two cannot drift. Every read path was re-checked at the same time (F-37): `command grep` over `app/` for `from entries|into entries|update entries` finds no path around `toEntry` -> `assertKnownFormat`. Nothing new.

### 2b/F-47 [P3] closed - A NUL character in text passes validation and fails at the database

**File:** app/features/blocks/inline-runs.ts (`parseInlineHtml`, `runsSchema`)
**Found:** 2026-09-17 by review (independent `reviewer` agent; scope: current; lens: security)
**Why it matters:** The reviewer measured that text containing U+0000 passes the parser and the schema. Checked against the development database: `'[{"text":"a\u0000b"}]'::jsonb` fails with `\u0000 cannot be converted to text`. So an authenticated, hand-crafted save carrying one would throw from the update and answer 500 through the error boundary. **Not caused by 2b** - v1's `toPlainText` had the same gap - and the editor is unlikely to produce the character. The full request path was not driven end to end. OWASP Top 10:2025 A10, Mishandling of Exceptional Conditions.
**Suggested fix:** Strip U+0000 in `parseInlineHtml`, or refuse it in `runsSchema`, with a unit test.
**Resolution:** Repaired 2026-09-17 by build: `parseInlineHtml` drops U+0000 before reading a fragment, `runsSchema` refuses it in text, and `isSafeHref` refuses it in an address. Unit tests cover both halves, each guard shown to fail on its own; `npm run verify` 137 tests. **The residual is now repaired too** (2026-09-21, on the owner's yes): `entry-input.ts`'s `title` refuses U+0000 after its length checks, with the message "The title has a character that cannot be stored. Remove it and save again.", which `parsePostForm` already renders as the writer's 400. A unit test asserts that exact message and was **shown to fail** with the `refine` removed; the file was restored byte-identical. `npm run verify` -> exit 0, 138 tests. Status `fixed`.

**Closed 2026-09-21 by review (independent `reviewer` agent; scope: current).** Re-examined both halves plus the title residual: the parser strip (`inline-runs.ts:144`), the `runsSchema` refusal (`:46`), `isSafeHref` (`:29`) and `entry-input.ts:21-23`, each covered by a unit test asserting a value; `npm run verify` -> exit 0, 138 tests this pass. U+0000 as filed is gone. **The class is wider than the fix** - a lone surrogate passes the same guards and PostgreSQL refuses the jsonb the same way - and that is recorded as its own entry, F-49, rather than keeping this one open.

### 2b/F-37 [P3] closed - `blocks_format` is written but never read

**File:** app/features/content/entries.server.ts:22-27
**Found:** 2026-09-16 by review (independent `reviewer` agent; scope: current; lens: quality)
**Why it matters:** The column is set on every write and left out of `entryColumns`, so nothing reads it. When item 2b introduces `v2`, code loading a `v1` row has nothing to branch on and no loud failure - the version marker exists precisely to prevent that, and unread it prevents nothing. The reviewer judged this the one aspect of the otherwise sound block shape most likely to force an avoidable migration.
**Suggested fix:** Select it and refuse a row whose format this build does not understand.
**Resolution:** Repaired 2026-09-17 by build (item 2b, step 4). `entryColumns` selects `blocks_format`, and every read path in `entries.server.ts` - `findEntryForUser`, `createDraft`'s and `updateDraft`'s `returning` - passes the row through `assertKnownFormat` (`app/features/content/blocks-format.ts`), which throws naming the entry id and both formats; the field is then dropped, so `Entry` and the loader's data are unchanged. Writes are guarded at the other end by `0003_blocks_v2.sql`'s check constraint. Evidence: unit test shown to fail with the check removed; against the production build, a row set to `v9` answered 500 with the error page and the server logged `Entry … is stored in block format "v9", but this build reads only "v2".`, and the same row as `v2` answered 200. Status `fixed`.
**Closed 2026-09-17 by review (independent `reviewer` agent; scope: current, item 2b).** Re-examined: `entryColumns` selects the column, all three return paths pass through `assertKnownFormat`, and writes are bounded by `entries_blocks_format_check`; the recorded unit-test mutation and the live `v9` -> 500 evidence stand. The write path's own residual - `updateDraft` does not require the row's current format - is recorded separately as F-46, not as a reason to keep this open.

