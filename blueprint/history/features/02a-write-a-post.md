# Feature: Write a post

**From build plan:** item 2a
**Type:** Feature
**Status:** built, awaiting review

## Goal

A logged-in user can write a post in a block editor and save it as a draft, come
back later, and carry on. This is the first item that stores content, so it
settles the `entries` table and the block shape every later item builds on -
publishing (item 4), images (item 5), pages (item 6) and the page builder all
extend what this defines.

## In scope

- The `entries` table (posts **and** pages, D5), created by a migration.
- The block model for **text, heading and list** - types, Zod validation, and
  normalisation from what Editor.js hands back.
- Editor.js 2.31.6 with its header and list tools, wrapped as a browser-only
  component (D13, D20 - installed with this item).
- `/admin/posts/new` and `/admin/posts/:id`: title, "Web address", the editor,
  and **Save draft**.
- Slug generated from the title, unique per type.
- The stale-save conflict from `design.md`, using the `version` column.
- Author scoping: an author edits only their own posts; editors and admins edit
  any (plan section 6, Permissions).

## Out of scope

- **Publishing** - no Publish button, no `published_at`, nothing public. Item 4.
  `design.md`'s editor shows Publish beside Save draft; it arrives with item 4,
  and this item ships the top bar without it.
- **The posts list, and deleting** - item 3. Until then the editor's back link
  points at `/admin`.
- **Inline formatting** - bold, italic, links. Item 2b. In this item the server
  stores plain text and the editor is configured with its inline toolbar off, so
  nobody is offered formatting that would be stripped.
- **Images** - item 5. The block menu offers three types, not four.
- **Pages** - item 6. `type` exists on the table and is always `post` here.
- **Roles beyond author scoping** - item 8 owns the role screens; this item only
  enforces the rule that already exists.

## Design reference

`prototypes/editor.html` (the mockup, with its stale-save message) and
`blueprint/context/design.md` - *Editor*, *States*, *Component conventions*,
*Words*. Tokens are already in `app/app.css` from item 1; **this item ports no
tokens**, it uses them.

Specifics the record already settles: top bar with back link, status badge and
save state on the left, actions on the right; large borderless title; "Web
address" beneath with Change (never the word "slug"); blocks get a hover
background and a drag handle; a round + button opens the block menu, each type
with a one-line description; Draft badge is warning amber.

## Build steps

- [x] **Step 1 - The `entries` table** - `db/migrations/0002_entries.sql` with
  the columns from plan section 6: `id`, `type`, `title`, `slug`, `blocks`
  (jsonb), `blocks_format`, `status`, `published_at`, `author_id` -> `users`,
  `version`, `created_at`, `updated_at`; `check` constraints for `type` and
  `status`, `unique (type, slug)`, an index on `author_id`. Apply it through
  `migrate` (development only - production has no content yet and gets it at the
  next deploy).
  *Done when:* `npm run db:migrate` prints `Applied 0002_entries.sql`, a re-run
  prints `No pending migrations.`, `\d entries` shows every column and
  constraint, and inserting two posts with the same slug fails.

- [x] **Step 2 - Block model and slugs, as pure logic** - `app/features/blocks/`:
  the `Block` type and Zod schemas for `text`, `heading` (levels 2-3) and `list`
  (bullet/number); `fromEditorJs()` mapping Editor.js's `paragraph`/`header`/
  `list` output onto them and **stripping any HTML to plain text** (2b replaces
  this with structured runs); `toEditorJs()` for loading a saved post back.
  `app/features/content/slug.ts`: title -> slug, and a `nextFreeSlug()` helper
  that takes the taken list and appends `-2`, `-3`.
  *Done when:* `*.test.ts` beside each covers, and passes: every block type round
  trips; `<b>hi</b>` becomes `hi`; an unknown block type is rejected with a
  message naming it; a heading level outside 2-3 is rejected; an empty list is
  rejected; `"Hello, World!"` -> `hello-world`; a 300-character title is cut to
  80 without a trailing hyphen; a title of only punctuation falls back to
  `post`; `nextFreeSlug` returns `hello-world-2` when `hello-world` is taken.
  Each test was seen to fail before the code existed.

- [x] **Step 3 - Saving and loading entries** -
  `app/features/content/entries.server.ts`: `createDraft`, `updateDraft`,
  `findEntryForUser`. Validation at the boundary with Zod: title trimmed, 1-200
  characters; at most 200 blocks; at most 20,000 characters per block.
  `updateDraft` takes the client's `version` and updates **only** when it still
  matches, returning a `stale` result otherwise; a successful update bumps
  `version` and `updated_at`. `findEntryForUser` returns nothing when an author
  asks for someone else's post (editor and admin see all).
  *Done when:* `npm run verify` passes, and the pure parts (input validation,
  the slug choice) are covered by unit tests. **The ownership rule and the
  version check are proven in step 7's browser tests, not here** - see Decisions:
  `npm test` is part of `npm run verify`, which CI runs with no database.

- [x] **Step 4 - The editor component** - install `@editorjs/editorjs` 2.31.6
  with its header and list tools, pinned exactly (record the resolved versions in
  the plan's Tech section and `AGENTS.md`). `app/features/blocks/editor.client.tsx`
  mounts Editor.js on the client only, with the three tools, the inline toolbar
  off, and the block menu labels from `design.md`.
  *Done when:* `npm run build` succeeds with no server bundle importing it (the
  build fails loudly if it does), and `/admin/posts/new` renders the editor with
  a working + menu offering exactly Text, Heading and List.

- [x] **Step 5 - The new-post and edit routes** - `app/features/content/post-editor.tsx`
  serving `/admin/posts/new` and `/admin/posts/:id`, listed in `app/routes.ts`,
  behind the existing `requireUser` middleware. Title field, "Web address" line,
  editor, **Save draft**; the top bar, Draft badge and save states from
  `design.md`. First save creates and redirects to `/admin/posts/:id`; later
  saves update in place. Validation errors render from `actionData` with the
  field message, not a code. A body over 1 MB is refused with 413, the way
  `login.tsx:35` already does.
  *Done when:* a draft written at `/admin/posts/new` is saved, the URL becomes
  `/admin/posts/:id`, a reload shows the same title and blocks; an empty title
  is refused with a message naming the field and nothing is written; **20
  consecutive saves measure p95 under 1 s server-side** (`quality-bar.md`), with
  the numbers pasted into the step.

- [x] **Step 6 - Stale saves and the no-JavaScript case** - when `updateDraft`
  reports `stale`, render the conflict message from `prototypes/editor.html`
  ("Your changes were not saved. Copy anything you want to keep, then reload to
  see the latest version.") and leave the editor's content untouched so nothing
  is lost. With JavaScript off, the page shows a plain message saying the editor
  needs JavaScript, rather than an empty canvas.
  *Done when:* two browser contexts open the same draft, both save, the second
  gets the conflict message with its text intact and the database shows one
  change; loading the page with JavaScript disabled shows the message.

- [x] **Step 7 - Browser tests** - `e2e/write-post.spec.ts`: write and save a
  draft; reload and see it; an author cannot open another author's post (404);
  an editor can; the stale-save conflict leaves one change in the database. Each
  seen to fail against a deliberately broken version. **This is where the
  database-backed rules from step 3 are proven.**
  *Done when:* `npm run test:e2e` passes, including the existing 15.

- [x] **Repair F-28 - a mistyped post address answers 500** - check the shape of
  `params.id` before it reaches a uuid comparison, in both the loader and the
  action, throwing the same 404 a missing post gets.
  *Done when:* `GET /admin/posts/not-a-uuid` returns 404, covered by a browser
  test that was seen to fail without the guard.

- [x] **Repair F-29 and F-30 - the writing area has no accessible name, and
  carries a class nothing defines** - name the region for screen readers, and
  drop the orphan global class.
  *Done when:* the editor container exposes an accessible name, `npm run verify`
  passes, and no stylesheet is left referencing a class that does not exist.

- [x] **Repair F-32 - list blocks are stored as `[object Object]`** - read
  `item.content` from `@editorjs/list`'s real `ListItem` shape, keeping a string
  fallback for hand-written input, and decide nesting explicitly rather than
  dropping it silently. Reject a `style` this version cannot store (checklist)
  with a message naming it, instead of quietly calling it a bullet list.
  *Done when:* the unit tests use the library's real shape; a browser test
  writes a list, saves, reloads and reads the text back; both were seen to fail
  against the old mapping.

- [x] **Repair F-33 - stored text is decoded into live HTML and injected** -
  escape `<`, `>` and `&` in `toEditorJs`, which is the `innerHTML` sink, so a
  writer's literal `<img …>` stays text. Do not change the decode order in
  `toPlainText`: that would delete text a writer meant to keep.
  *Done when:* the payload from the review is stored and reloaded without
  executing and without vanishing, proved in a browser test; `use <div> here`
  survives a save-reload-save round trip unchanged.

- [x] **Repair F-34 - saving without JavaScript wipes the body** - do not render
  Save draft until the editor has mounted, beside the notice that already
  explains why.
  *Done when:* with JavaScript disabled, an existing post with a body shows the
  notice and no Save button, and its blocks are still there afterwards - proved
  by a browser test that was seen to fail without the change.

- [x] **Repair F-35 and F-36 - the menu offers five types, and the mapping tests
  cannot fail** - give the list tool one toolbox entry with nesting off, and
  rewrite the mapping tests against the library's real output.
  *Done when:* the + menu offers exactly Text, Heading and List; one browser
  test writes a heading and a list end to end.

- [x] **Repair F-34 properly - the wipe is at the trust boundary, not the button** -
  `parsePostForm` treats an absent `blocks` field as an empty post. Distinguish
  absent from empty and refuse the save, keeping the hidden button as the UI
  half. An empty post stays legal when the field is present.
  *Done when:* with JavaScript off, pressing Enter in the title of a post that
  has a body leaves the body intact and says why nothing was saved - proved by a
  browser test seen to fail against the current code.

- [x] **Repair F-35 - the block settings menu still offers Checklist** - the tool
  builds that entry unconditionally, so either stop offering it or make the
  refusal tell the writer what to do.
  *Done when:* a writer who reaches a checklist can save again by following the
  message, and the browser test asserts on the settings popover rather than the
  toolbox.

- [x] **Repair F-41 - bound the list flattening** - the recursion added by F-32
  has no depth limit, so a crafted body throws RangeError and answers 500.
  *Done when:* a deeply nested payload is refused cleanly, covered by a unit test.

## Decisions

Settled while building; `ship` carries these into `dev-notes/decisions.md`.

- **Database-backed tests live in the Playwright suite, not `node --test`**
  (2026-09-16, with the owner's agreement at the step 3 gate). `npm test` runs
  inside `npm run verify`, which CI runs **with no database**, so a
  database-dependent unit test would turn CI red on the next push. Skipping it
  when `DATABASE_URL` is absent was rejected: a test that silently skips in the
  one place that runs automatically reports safety nobody has. The real fix is a
  PostgreSQL service in CI - that is F-17's, and its own change.
- **A post's web address is chosen once, at creation, and does not follow later
  title edits.** Changing it afterwards is the "Change" control in `design.md`,
  which no item has built yet. Keeping it stable means a saved draft's address
  never moves under a link someone shared, and every save avoids re-checking
  uniqueness.

## Files and areas

- `db/migrations/0002_entries.sql` - new.
- `app/features/blocks/` - `blocks.ts` (types, Zod, Editor.js mapping),
  `blocks.test.ts`, `editor.client.tsx`.
- `app/features/content/` - `slug.ts`, `slug.test.ts`, `entries.server.ts`,
  `entries.server.test.ts`, `post-editor.tsx`.
- `app/routes.ts` - two new routes.
- `package.json`, `package-lock.json` - the three editor packages.
- `blueprint/project-plan.md`, `AGENTS.md` - the resolved editor versions.
- `e2e/write-post.spec.ts` - new.

## Data and contracts

**Load-bearing: every later item reads this shape.**

`entries`, exactly as plan section 6 lists it. `type` is `post` here; `page`
arrives in item 6. `status` is always `draft` in this item.

Blocks are stored as a JSON array, `blocks_format` = `'v1'`:

    { "id": "u1x…", "type": "text",    "data": { "text": "plain text" } }
    { "id": "u2y…", "type": "heading", "data": { "text": "plain text", "level": 2 } }
    { "id": "u3z…", "type": "list",    "data": { "style": "bullet" | "number",
                                                  "items": ["plain text", …] } }

- **`data.text` is plain text in v1** - item 2b changes it to structured runs and
  moves `blocks_format` to `'v2'`, migrating existing rows.
- **Image blocks (item 5) store a media id, never a URL** - reserved here so the
  renderer's shape does not change later.
- `version` starts at 1 and increments on every successful save; the client
  always sends the version it loaded.

## Testing

- **Unit** (`node:test`): the block model, the Editor.js mapping, slug
  generation and uniqueness, the ownership rule, the version check.
- **Browser** (Playwright): step 7's four flows. The editor needs JavaScript, so
  these are the only tests that exercise it.
- **Not covered:** how Editor.js itself behaves - that is the library's job.
- **Manual:** keyboard and screen-reader behaviour of the editor and its block
  menu, which no automated check can hear. Recorded in `needs-you.md`.

## Notes

- **Quality bar:** admin saves under 1 s at p95, measured server-side - step 5's
  done-when is that number.
- **Security:** the author id comes from the session, never from the form
  (`fundamentals.md`: never trust a client-supplied identifier for ownership).
  Blocks are validated at the trust boundary before they are stored, and
  rendering escapes them (item 4 renders; nothing renders blocks publicly yet).
- **Words from `design.md`:** "Web address", never "slug"; "Last changed", never
  "Modified".
- **React Router 8.3.1 is newer than training data** - the installed docs in
  `node_modules/react-router/docs/` decide route module and `clientLoader`
  questions, not recollection.
- `migrate` applies step 1 in development. **Production gets this migration at
  the next deploy, before the code that needs it** - it holds no entries yet, so
  nothing is at risk, but the order still matters.

## Findings

### 02a/F-42 [P2] closed - The editor's own save failure was turned into an empty post

**File:** app/features/content/post-form.tsx:50-51 (`content ?? { blocks: [] }`)
**Found:** 2026-09-16 by review (independent `reviewer` agent, third pass; scope: current; lens: correctness)
**Why it matters:** The F-34 guard rests on "a submission without the field never came from the editor" - true, but the field being present was never evidence that the *content* is real. Editor.js's `save()` resolves to **`undefined`** when a tool throws inside it: `Saver.save()` (`node_modules/@editorjs/editorjs/dist/editorjs.mjs:9389-9402`) catches, logs, and falls through with no return. This line converted that - and a null ref before mount - into `{"blocks":[]}`, a legal empty post that passes every server check and saves over a real body. The consequence is proven (an empty-blocks payload replaces a saved body, by design, with no message); the trigger is library-internal and was not fired on demand, so this is a code-chain finding. `fundamentals.md`: a default substituted for a failed call hides the failure until it matters.
**Suggested fix:** Refuse rather than default - if `save()` gives nothing usable, say so and do not submit.
**Resolution:** Repaired 2026-09-16 by build: `handleSubmit` checks the result is an object with a `blocks` array, and otherwise shows "The editor's content could not be read. Copy anything you want to keep, then reload." without submitting; the save state reads "Not saved - see message below". `npm run verify` 106 unit tests green, `npm run test:e2e` 25 passed. **Not covered by a test:** forcing Editor.js's internal save to fail would mean stubbing the library, and the reviewer could not trigger it on demand either - the guard is reasoned from the library's source, not from a reproduction. Status `fixed`.
**Extended and closed 2026-09-16.** The fourth review pass confirmed three of the four states were covered and named the fourth, which I had suspected: **`editor.isReady` rejects** when Editor.js never initialises, and the Save button is rendered by a separate effect that does not wait for it - so the click rejected out of `handleSubmit`, nothing submitted, no message rendered, and the button was silently dead (no data lost, but a worse symptom than the guard's message). Repaired by wrapping the read in `try/catch`, which collapses all four states into the one message. **The predicate is now tested rather than reasoned about:** `isReadableEditorContent` lives in `app/features/content/editor-content.ts` - a plain module, the same split as `post-form-input.ts`, because `node --test` cannot run JSX - with tests for `undefined`, `null`, `{}`, `{blocks: "x"}` and the legal empty post, **shown to fail** when the predicate is made permissive (2 failed). Editor.js's own failure modes stay reasoned from its source, which is the right place for them. Also fixed here: `problem` and the client-side guard could render two boxes both titled "Your changes were not saved."; they are now one chain, with the client guard winning because it describes the save just refused. Closed by review (independent `reviewer` agent, fourth pass): *"These hold. Ship it."*

### 02a/F-32 [P0] closed - Every list block is stored as the literal text `[object Object]`

**File:** app/features/blocks/blocks.ts:107-109
**Found:** 2026-09-16 by review (independent `reviewer` agent, fresh context; scope: current; lens: correctness)
**Why it matters:** `items: (list.items ?? []).map((item) => toPlainText(String(item)))` assumes `@editorjs/list` saves `items: string[]`. The pinned 2.0.9 does not: `ListData.items` is `ListItem[]`, where `ListItem = { content, meta, items }` (`node_modules/@editorjs/list/dist/types/ListParams.d.ts:56-70`), so `String(item)` is `"[object Object]"`. **Measured in a real browser against the production build:** a list written through the + menu, saved and reloaded, comes back as `"[object Object]\n[object Object]"`. One of the three block types this item exists to ship **destroys the writer's content on every save**, silently and unrecoverably - the typed text never existed anywhere else. The unit test at `blocks.test.ts:41-52` passes because it feeds the mapper the implementation's own assumption (`items: ["one","two"]`) rather than the library's real output, so code and test agree with each other and both disagree with the dependency.
**Suggested fix:** Read `item.content` with a string fallback, and decide explicitly what happens to nesting (`item.items`) and checklist state (`item.meta.checked`) rather than dropping them silently. Add a browser test that writes a list and asserts the text comes back - no unit test can see this.
**Resolution:** Repaired 2026-09-16 by build. `flattenListItems` reads `item.content` from the real `ListItem` shape, keeps a string fallback for hand-written payloads, and flattens nested items rather than dropping the words; `toEditorJs` emits the same `{content, meta, items}` shape, without which a saved list loaded back empty. A style other than ordered/unordered - checklist - is now refused by name instead of being stored as a bullet list. Evidence: the unit tests use the library shape (15 pass), and a browser test loads a seeded heading and list into the editor, saves, reloads and reads the text back. **Shown to fail** with the old `String(item)` mapping restored: 1 failed / 9 passed. Status `fixed`.
Closed 2026-09-16 by review (independent `reviewer` agent, which raised it), on evidence beyond what the repair's own test covers: a seeded **ordered** list (the browser test only covers a bullet list) loaded, saved and reloaded twice, with the row read from the database each time - byte-identical, one `<ol>` rendered, no injected elements. The new `toEditorJs` shape omits a top-level `meta`, and the tool's `normalizeData` fills it in (`editorjs-list.mjs:1755-1789`), so ordered lists render and their settings open without throwing. With `maxLevel: 1` the flattening is defensive only and could not be reached through the UI.

### 02a/F-33 [P1] closed - Stored cross-site scripting in the editor: text is decoded into live HTML and injected

**File:** app/features/blocks/blocks.ts:66-73 (`toPlainText`), app/features/blocks/blocks.ts:138-160 (`toEditorJs`)
**Found:** 2026-09-16 by review (independent `reviewer` agent; scope: current; lens: security)
**Why it matters:** `toPlainText` strips tags **then** decodes entities, so `&lt;img …&gt;` becomes a real `<img …>` in the stored row. Editor.js sanitizes on save and paste but **never on render** - its paragraph tool does `e.innerHTML = this._data.text` (`node_modules/@editorjs/editorjs/dist/editorjs.mjs:9512`) - so `toEditorJs` hands that text straight into an HTML sink on the next load. **Measured:** a writer typing an `<img src=x onerror=…>` payload got it stored, and on reload the script ran (`document.title = XSS-FIRED`, one `<img>` injected). This is live **now**, not a trap for item 4: the editor is itself a render surface, which is the assumption the code and my own reviews shared and got wrong. The lowest-privileged role (author) can plant script that runs in an editor's or admin's authenticated same-origin session; `httpOnly` stops cookie theft, not authenticated requests, and item 8 turns that into author -> admin escalation. No CSP yet (deliberate until item 5), so nothing blunts it. OWASP Top 10:2025 A05; `quality-bar.md` promises structured content escaped on render.
**Suggested fix:** Escape `<`, `>` and `&` in `toEditorJs` for `data.text` and list items, because that is the sink. **Do not** instead decode entities before stripping tags - that silently deletes text a writer meant to keep. Add a round-trip test with `<b>` as literal content, and record for item 4 that its renderer escapes and never uses `dangerouslySetInnerHTML`. The same bug has a non-security twin: type `use <div> here`, save, reload, and the text vanishes from view, then is stripped for good on the next save.
**Resolution:** Repaired 2026-09-16 by build. `escapeForEditor` escapes `&`, `<` and `>` in `toEditorJs` for text and list items - the `innerHTML` sink - leaving `toPlainText` alone, since decoding before stripping would delete words a writer meant to keep. Evidence: a browser test types the review`s `<img src=x onerror=…>` payload, saves, reloads and asserts the title is unchanged, no `img` was injected, and the text is visible as text. **Shown to fail** with the escaping removed: 1 failed / 9 passed. Item 4`s renderer must escape too - recorded in the spec. Status `fixed`.
Closed 2026-09-16 by review (independent `reviewer` agent, which raised it). It searched for a second sink and found none: `dangerouslySetInnerHTML` appears nowhere in `app/`; the meta title renders through React Router's `<title>{String(...)}</title>`, which React escapes; the title field is a `defaultValue` attribute; the error boundary renders text. Escaping does **not** double - `&`, `&amp;`, `<b>`, `<i>` and `"` round-tripped twice with a byte-identical row, because decoding in `toPlainText` and escaping in `toEditorJs` are exact inverses over that entity set. **Carried forward for item 4:** the `title` column is stored raw and never passes through `toPlainText`, so the public renderer must render it through JSX rather than any HTML-building helper - that is the one place left where a naive renderer would reintroduce this.

### 02a/F-34 [P1] closed - Saving without JavaScript wipes the post body

**File:** app/features/content/post-form.tsx:70-72, app/features/content/post-form-input.ts:30
**Found:** 2026-09-16 by review (independent `reviewer` agent; scope: current; lens: correctness)
**Why it matters:** The Save draft button is rendered unconditionally, so with JavaScript off - or in the window before React hydrates - `<Form method="post">` submits natively. The `blocks` field exists only because `handleSubmit` adds it, so the action receives a title and a version and **no blocks**, which parses as a valid empty post. The version matches, so the stale check cannot save it. **Measured** against the production build with `javaScriptEnabled: false`: an existing post with a body came back with 0 blocks after one click. Step 6's done-when was met literally (the "needs JavaScript" notice shows) while the Save button beside that notice was never considered, and the browser test only checks `/admin/posts/new`, where there is nothing to lose.
**Suggested fix:** Render the button only when the editor has mounted (`isEditorReady`), or carry the loaded blocks in a hidden field so a native submit means "unchanged" rather than "empty". Extend the no-JavaScript browser test to open an existing post and assert the body survives.
**Resolution:** Repaired 2026-09-16 by build. Save draft renders only once the editor has mounted, beside the notice that already explains why, so a native submit carrying no blocks is impossible. Evidence: a browser test writes a post with a body, opens it with JavaScript disabled, asserts the notice shows and no Save button exists, then reloads with JavaScript on and finds the body intact. **Shown to fail** with the button rendered unconditionally: 1 failed / 9 passed. Status `fixed`.
**Re-opened 2026-09-16 by review (independent `reviewer` agent), with proof - the repair removed the symptom and left the defect.** Hiding the button removes the button, not the native submit: the form still has exactly one field that blocks implicit submission (the title; the hidden `version` input does not count), so **Enter in the title field submits natively** with no `blocks` part, and `post-form-input.ts:30` reads that as an empty post. Measured on a seeded draft with JavaScript off: Save button present = 0, stored blocks after pressing Enter = `[]` - the same wipe as before. The new browser test asserts the button is hidden and the body survives **when nothing was submitted**, so it tests the fix rather than the failure. Anything reaching the action without a `blocks` part still destroys the body: the Enter key today, a pre-hydration keypress, a truncated body, a later route reusing `parsePostForm`.
**Correct fix (server side):** in `parsePostForm`, distinguish *absent* from *empty* - `if (!form.has("blocks")) return { ok: false, message: "The editor had not finished loading, so nothing was saved. Reload and try again." }`. An empty post stays legal (`entry-input.test.ts:34` allows one deliberately); the discriminator is the field's presence. Keep the hidden button as the UI half. The test to write: JavaScript off, Enter in the title, reload, body still there.
**Resolution (second attempt, at the right layer):** Repaired 2026-09-16 by build. `parsePostForm` now refuses a submission with **no `blocks` field at all**, which is what a native submit sends - an empty post stays legal when the editor actually sent an empty list, so the discriminator is the field's presence, not its contents. The hidden button stays as the UI half. Evidence: a browser test with JavaScript off presses **Enter in the title** of a post that has a body, sees "The editor had not finished loading, so nothing was saved", and the body is still there on reload; a unit test covers both halves (absent field refused, empty list accepted). **Shown to fail** with the guard removed: 1 failed / 9 passed. The first attempt hid the button and left the defect reachable, which is why this one is at the trust boundary. Status `fixed`.
Closed 2026-09-16 by review (independent `reviewer` agent, third pass), which opened every door it could name and found the guard holds: with JavaScript off, Enter in the title returns 400 with the message rendered by the server and the row untouched at version 1; a `blocks` part that is present but empty, `null`, or `{}` is refused by name; `{"blocks":[]}` is allowed, which is the deliberate empty post; `post-new.tsx` under the same guard creates no stray empty row; no `useFetcher` or other programmatic submit exists; and the message is unreachable once hydrated, so it cannot appear confusingly. The client-side twin of this defect was found in the same pass and is F-42.

### 02a/F-35 [P2] closed - The block menu offers five types, two of which cannot be stored properly

**File:** app/features/blocks/editor.client.tsx:46-49
**Found:** 2026-09-16 by review (independent `reviewer` agent; scope: current; lens: quality)
**Why it matters:** The list tool registers three toolbox entries, so the menu measured as `["Text","Heading","Unordered List","Ordered List","Checklist"]`. Step 4's done-when claims "exactly Text, Heading and List" and `design.md:137-139` asks for each type to carry a one-line description; neither is true. Checklist saves `style: "checklist"`, which `blocks.ts:105` quietly maps to `"bullet"`, dropping every checkbox state without telling the writer - the same "offering what we cannot keep" failure the spec avoided by turning the inline toolbar off.
**Suggested fix:** Give the list tool a single toolbox entry and constrain it (`toolbox: { title: "List" }`, `config: { defaultStyle: "unordered", maxLevel: 1 }`), or reject `style: "checklist"` in `fromEditorJs` with a named message. If the per-type descriptions are deferred, say so in the item instead of leaving the done-when claiming otherwise.
**Resolution:** Repaired 2026-09-16 by build: the list tool gets one toolbox entry (`toolbox: { title: "List" }`) with `maxLevel: 1` and `defaultStyle: "unordered"`, so Checklist and Ordered List no longer appear, and a checklist style is refused by name in the mapper if one arrives anyway. A browser test asserts the menu lists exactly Text, Heading and List. **Honest limit:** Editor.js keeps the menu in the DOM whether open or not, so that test asserts the menu`s contents, not that opening it works; driving the floating menu was too flaky to keep. The per-type descriptions `design.md` asks for are still not implemented. Status `fixed`.
**Re-opened 2026-09-16 by review (independent `reviewer` agent): the toolbox was fixed, the block settings menu was not.** `@editorjs/list` builds Unordered / Ordered / Checklist unconditionally in `renderSettings()` (`node_modules/@editorjs/list/dist/editorjs-list.mjs:1929-1958`), ignoring the toolbox config, so a writer can still turn a saved list into a checklist from the block's own ⋮ menu. Measured: the settings menu offers `["Unordered","Ordered","Checklist", …]`; choosing Checklist then saving gives `Block 1 is a "checklist" list, which cannot be saved yet.` and the stored row is untouched. **The refusal is safe** - nothing is corrupted and no ticks are silently dropped - **but the writer is stuck**: no save of the whole post succeeds until they work out that a menu they opened minutes ago is the cause, and their work exists only in the browser tab. The message names the block and the type but not what to do, which `design.md` (*Words*) and `fundamentals.md` ("an error a user sees says what happened and what to do about it") both ask for.
**Smallest fix:** make the message actionable - *Block 1 is a checklist. Open that block's settings and choose Unordered or Ordered, then save.* **Better:** filter the tune as well as the toolbox, by subclassing the tool and dropping the Checklist entry from `renderSettings()` (label matching is locale-bound; this app is English-only). Either way the browser test must assert on the **settings** popover - as written it cannot see this.
**Resolution (second attempt):** Repaired 2026-09-16 by build - the message, not the menu. A checklist now returns *"Block N is a checklist, which cannot be saved yet. Open that block's settings and choose Unordered or Ordered, then save."*, so a writer who reaches one from the block settings menu can get unstuck without guessing. **Filtering the tune menu was considered and rejected:** it needs subclassing the tool and matching menu entries by their English label (`renderSettings()` builds all three unconditionally), which is locale-bound and reaches into the library's internals - a bigger and more fragile change than the message. The stored row is never corrupted either way. Covered by a unit test asserting the message tells the writer what to do, **shown to fail** against the old wording. **Still true:** the settings menu offers a type this version refuses, and `design.md`'s per-type descriptions are unimplemented. Status `fixed`.
Closed 2026-09-16 by review (independent `reviewer` agent), **which withdrew its own preferred fix**: filtering the tune menu identifies entries by a label built through `api.i18n.t(...)`, and Editor.js's dictionary is caller-overridable, so a label filter breaks silently on any future i18n config - the menu would quietly start offering Checklist again with nothing to notice. The actionable message was verified end to end instead: refusal -> the block's settings are still reachable -> switch to Unordered -> save succeeds at version 2 with the items intact. **Recorded residual:** the settings menu still offers a type the server refuses, the writer loses the checklist intent, and anything typed since the last successful save lives only in the tab until they undo it - visible and recoverable, which is the accepted trade for a v1 format with nowhere to put a tick. `design.md`'s per-type menu descriptions remain unimplemented.

### 02a/F-36 [P2] closed - The editor-mapping unit tests cannot fail when the mapping is wrong

**File:** app/features/blocks/blocks.test.ts:41-52, 81-104
**Found:** 2026-09-16 by review (independent `reviewer` agent; scope: current; lens: tests)
**Why it matters:** Every `fromEditorJs` assertion feeds hand-written input in the shape the implementation expects, and that shape never occurs against the real library (F-32). The suite therefore reports coverage of a contract it does not test - the mutation checks run during the build passed for the same reason. **No test of any kind exercises a heading or a list end to end**: the browser test types a paragraph only (`e2e/write-post.spec.ts:38-45`). The slug and entry-input tests are genuinely value-asserting and are fine.
**Suggested fix:** One browser test that writes a heading and a list, saves, reloads and asserts the text. That single test would have caught F-32, F-33 and F-35.
**Resolution:** Repaired 2026-09-16 by build. The mapping tests now use `@editorjs/list`s real `{content, meta, items}` shape, and cover the nested-list flattening and the checklist refusal; the end-to-end gap is closed by the seeded round-trip browser test, which exercises a heading and a list through the real tools in both directions. Status `fixed`.
Closed 2026-09-16 by review (independent `reviewer` agent): the seeded round-trip test drives the real tools in both directions and would catch an F-32 or F-33 regression, and the unit tests now assert the library's real `{content, meta, items}` shape instead of the implementation's assumption. **Named gaps, all cheap and none blocking:** no ordered list in any committed test, no stored text containing `&` or `<` in the unit round trip, the F-35 test cannot see the settings menu, and the F-34 test cannot see the Enter path.

### 02a/F-28 [P2] closed - A mistyped post address answers 500 instead of 404

**File:** app/features/content/post-edit.tsx:16 (`findEntryForUser(params.id, …)`), app/features/content/entries.server.ts:36
**Found:** 2026-09-16 by review (scope: current; lens: correctness)
**Why it matters:** `params.id` goes straight into a `uuid` comparison, so anything that is not a UUID makes PostgreSQL raise `invalid input syntax for type uuid` before the query can return nothing. **Measured:** logged in, `GET /admin/posts/not-a-uuid` returns **500** with "Oops! An unexpected error occurred." The same URL shaped like a UUID correctly returns 404. No data is at risk and it is behind the login, which is why this is not a P1 - but a mistyped or stale link is an ordinary thing to do, and the answer should be the same 404 a missing post gets. OWASP Top 10:2025 A10, mishandling of exceptional conditions.
**Suggested fix:** Check the shape before querying - a `z.uuid()` parse of `params.id` in the loader and action, throwing the same `data("Not Found", { status: 404 })`. A browser test alongside the existing ownership one.
**Resolution:** Repaired 2026-09-16 by build. `requirePostId()` in `post-edit.tsx` parses the id with `z.uuid()` and throws the same 404 a missing post gets; both the loader and the action go through it. Evidence: `GET /admin/posts/not-a-uuid` now returns **404** with no error page, covered by `e2e/write-post.spec.ts` ("a mistyped post address is not found"), **which was shown to fail with the guard removed** (1 failed / 5 passed) and pass with it (6 passed). `npm run verify` green, `npm run test:e2e` 21 passed. Status `fixed` for `review` to re-examine.
Closed 2026-09-16 by review (scope: current). Re-read the repaired code rather than the repair`s account of it: `requirePostId` is applied in **both** entry points - the loader (`post-edit.tsx:27`) and the action (`post-edit.tsx:35`, whose result is what `updateDraft` receives) - so no path reaches a uuid comparison unchecked, and it throws the same 404 as a missing post rather than a distinguishable error. Re-ran the suite: 21 browser tests pass, `npm run verify` green. Nothing new introduced in that file.

### 02a/F-30 [P3] closed - The editor container carries a class name nothing defines

**File:** app/features/blocks/editor.client.tsx:68 (`className="editor-canvas"`)
**Found:** 2026-09-16 by review (scope: current; lens: quality)
**Why it matters:** This project styles components with CSS Modules (`coding-standards.md`, and every other component here uses `styles.x`). `editor-canvas` is a global class that no stylesheet defines, so it reads as intent that was never finished: a maintainer looking for it finds nothing, and a later global rule could match it by accident.
**Suggested fix:** Either drop the attribute, or add the class to a module and reference it as `styles.canvas` like the rest of the form.
**Resolution:** Repaired 2026-09-16 by build: the orphan `editor-canvas` class is gone, and the element carries no class at all - Editor.js styles its own canvas. Status `fixed`.
Closed 2026-09-16 by review: `grep -rn editor-canvas app e2e` returns nothing, and the element carries no class attribute at all.

