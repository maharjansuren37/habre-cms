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
