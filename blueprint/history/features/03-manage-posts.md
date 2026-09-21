# Feature: Manage posts

**From build plan:** item 3
**Type:** Feature
**Status:** built, F-54 and F-60 repaired; ready to ship

## Goal

An editor, author or admin can see every post they have access to in one place -
filtered by status, searched by title, paginated - and delete one they no longer
want. Editing already exists (`/admin/posts/:id`, item 2a/2b); this item is what
makes that reachable without knowing a post's address by heart, and closes the
one destructive action the plan promises that nothing yet provides.

## In scope

- **`/admin/posts`** - a table of posts: title (links to the editor) with its
  web address underneath, status badge, author, last changed. Role-scoped:
  authors see only their own; editors and admins see every post (matches
  `entries.server.ts`'s existing `ownedBy` rule).
- **Filter tabs** - All / Drafts / Published, each with a count, matching
  `design.md`'s *Lists* convention and the `posts-list.html` mockup. Counts are
  scoped by role the same way the table is.
- **Search** - by title, case-insensitive substring, a `method="get"` form so it
  works without JavaScript and is bookmarkable.
- **Pagination** - 20 posts a page; needed at the quality bar's "a few thousand
  entries" scale, where an unpaginated table would grow without bound.
- **Delete** - a confirmation screen (`/admin/posts/:id/delete`), then a real
  delete; the list shows a success banner afterwards. Author-owned like edit.
- **`/admin` redirects to `/admin/posts`** - `admin-shell/home.tsx`'s own comment
  already says this is item 3's job ("A placeholder until managing posts (item 3)
  makes /admin the posts list").
- **The admin shell's nav list** - "Posts" is the first entry now that a real
  destination exists (`design.md`: "no nav list until the first admin section
  ships" - this is that section).
- **The editor's "← Posts" link** now points at `/admin/posts` instead of
  `/admin` - `post-form.tsx` carries a comment marking this as item 3's job too.

## Out of scope

- **Deleting from inside the editor screen.** Neither the mockup nor
  `design.md` shows it there; the list row is the only entry point for v1. A
  later item can add it if it turns out to be wanted.
- **Bulk select / bulk delete.** Not asked for, and doubles the confirmation
  design surface for a feature nobody requested.
- **Pages.** `type = 'post'` only, matching every existing query in
  `entries.server.ts`. Pages get their own list in item 6.
- **Publish / unpublish**, and therefore an unreachable "Published" tab (always
  zero) until item 4 ships it. The tab is built now because the schema and the
  permission model already assume both statuses, and item 4 should not have to
  add a UI surface for something item 3 already built.
- **Sorting.** The mockup and `design.md` show only "Last changed" as a column,
  never as a sortable control. One fixed order (newest changed first) is what
  ships.
- **An index for the search or filter queries.** At "a few thousand entries"
  (`quality-bar.md`), a sequential scan is inside budget - same call already
  made for the slug lookup (F-27, accepted, not now). `ilike '%…%'` cannot use a
  plain btree index anyway; adding one would mean a new extension
  (`pg_trgm`), which the minimal-dependencies constraint makes its own decision,
  not a passenger on this one.

## Design reference

`prototypes/posts-list.html` and `posts-empty.html`, plus `design.md`'s *Lists*
convention - covers the table, filter tabs, search and the big empty state
already. **Three things the record does not cover, decided here:**

- **The delete confirmation screen.** Neither the mockup nor `design.md` shows
  one. Built as a plain page inside the admin shell (not a modal, not a
  standalone screen like the editor - this is a short question, not a focused
  task): the post's title, one sentence saying this cannot be undone, "Cancel"
  (back to the list) and "Delete post" (danger-text default button, per the
  existing Buttons convention: "Destructive actions use the default button with
  danger text and must be confirmed").
- **Zero results for the current filter or search**, as opposed to zero posts at
  all. The mockup's big empty-state panel is for a genuinely empty list
  (`posts-empty.html`); a filtered view with no matches gets one muted line
  under the table instead - the big panel's primary button ("New post") would be
  actively wrong advice when posts exist but none match.
- **The nav list arrives one section at a time**, not all five at once.
  `design.md`'s *Admin shell* line lists Posts, Pages, Media, Settings, Users
  together because it describes the finished shell; today only Posts is real, so
  only Posts is shown. Each later item adds its own entry when it ships, the same
  way this item adds its own now.

Step 5 writes these three into `design.md`, under *Lists* and a new line for the
confirmation screen, with the measured contrast for the danger button text.

## Build steps

- [x] **Step 1 - List and delete queries** - `entries.server.ts` gains
  `listEntries(actor, query)` (status, search, page, role-scoped, matching
  `ownedBy`'s existing pattern) returning `{ entries, total, counts }`, and
  `deleteEntry(id, actor)` returning `"deleted" | "not_found"`. A new pure
  module, `post-list-query.ts`, exports `parsePostListQuery(url)`: `status`
  falls back to `"all"` on anything else, `q` is trimmed and capped at 200
  characters (matching the title's own cap), `page` is a positive integer
  clamped to `[1, 1000]`.
  *Done when:* unit tests for `parsePostListQuery` cover the default (no
  params), an invalid `status` value falling back to `"all"`, `q` trimmed and
  truncated at 200, `page` clamped at both ends (`0` and `-5` -> `1`, `100000`
  -> `1000`), and a non-numeric `page` falling back to `1`; `npm run verify`
  passes.

  *Evidence (2026-09-21):* 8 unit tests in `post-list-query.test.ts` cover
  every case listed. Two **shown to fail** on their own (status fallback
  removed, page's upper clamp removed), file restored byte-identical (md5
  `0ce4523fade6ef903f57aa4e21b87ff2` before and after). `listEntries` and
  `deleteEntry` are not unit-tested (D24, database-backed) - smoke-tested
  directly against the development database instead: status filter, search,
  tab counts, delete-once-then-not-found, and a cross-author delete correctly
  refused; test rows cleaned up. `npm run verify` -> exit 0, 148 unit tests.

- [x] **Step 2 - The list route, with the admin shell wired to it** -
  `post-list.tsx`: loader calls `listEntries`, renders the table (title + web
  address, status badge, author, last changed) or the big empty state
  (`posts-empty.html`) when there are zero posts at all. The status badge
  (pill, leading dot) gets its own amber/green rules in `post-list.module.css`
  - copied from `post-form.module.css`'s existing single-color version rather
  than extracted into a shared component: this is the pattern's second use,
  and `fundamentals.md` is explicit that the second use is copied, the third is
  what earns an abstraction. `app/routes.ts` adds `admin/posts` inside the
  admin-shell layout. `admin-shell/home.tsx` becomes a redirect to
  `/admin/posts` (its loader throws `redirect(...)`); its own placeholder
  markup and `home.module.css` are deleted. `layout.tsx` gets its first nav
  entry, "Posts". `post-form.tsx`'s "← Posts" link moves from `/admin` to
  `/admin/posts`, one line, and the comment marking it as item 3's job comes
  out with it.
  *Done when:* in the browser, with a handful of seeded posts across both
  roles: `/admin` redirects to `/admin/posts`; the table shows every post an
  admin can see, only the author's own for an author account; the sidebar shows
  "Posts" as the first nav entry; the editor's back link goes to `/admin/posts`;
  with zero posts, the big empty state renders instead of an empty table;
  `npm run verify` passes.

  *Evidence (2026-09-21), Chromium against the production build on port 3200:*
  every check above confirmed with real seeded data - `/admin` -> 302 ->
  `/admin/posts`; an admin sees both an admin's and an author's post, an
  author sees only their own; "Posts" nav entry carries `aria-current="page"`;
  editor back link -> `/admin/posts`; zero posts -> the empty state.
  Screenshots (light/dark): `blueprint/reference/3-manage-posts/list-*.png`.
  `home.tsx` became `home.ts` - loader-only, no component, matching the
  project's own resource-route convention (`logout.ts`) once its placeholder
  markup was gone. `npm run verify` -> exit 0, 148 unit tests, build ok.

  **What the build caught here that the spec did not foresee:** `PAGE_SIZE`
  (a server-only constant) was first read directly in the client component to
  compute a page count; React Router's build correctly refused it -
  server-only code cannot reach the browser bundle. Fixed by moving the
  division into `listEntries` itself (`PostList` gained `totalPages`), so the
  client only ever sees the derived number. `PostList`'s contract in *Data and
  contracts* below reflects this.

- [x] **Step 3 - Filter tabs, search, and pagination** - the loader reads
  `parsePostListQuery`, filters and paginates through `listEntries`; the tabs
  (All / Drafts / Published, with counts) and the search box are `<a>`/
  `method="get"` `<form>` so they work with JavaScript off; a page past the
  first shows next/previous links carrying the other params forward. A
  filtered or searched view with zero matches shows one muted line, not the
  big empty state.
  *Done when:* in the browser: each tab shows the right subset and count for
  the logged-in role; a search narrows the table to matching titles and clears
  cleanly; more than 20 posts shows a second page, and its link preserves the
  active tab and search term; a search with no matches shows the muted line,
  not the empty-state panel; every one of these works with JavaScript disabled
  in the browser's settings; `npm run verify` passes.

  *Evidence (2026-09-21), Chromium against the production build:* with 4
  drafts and 2 published seeded, tabs read `All 6`, `Drafts 4`, `Published 2`;
  clicking Drafts narrows the table and sets `?status=draft`; searching
  "Zebra" while on Drafts narrows further and keeps `status=draft&q=Zebra`; a
  search with no matches shows the muted line, not the empty-state panel;
  clearing the search restores the full Drafts list. With 25 posts: page 1
  shows 20, page 2 shows 5, "Page 2 of 2"; switching tabs from page 2 resets
  to page 1 while keeping the new status. The whole flow - tabs, search,
  pagination - re-checked with JavaScript disabled in the browser context,
  identical results. `npm run verify` -> exit 0, 148 unit tests, build ok.

- [x] **Step 4 - Delete, with confirmation** - `post-delete.tsx`:
  `GET /admin/posts/:id/delete` loads the post through the existing
  `findEntryForUser` (so ownership and the "not found" masking are already
  correct) and shows the confirmation screen; `POST` calls `deleteEntry` and
  redirects to `/admin/posts?deleted=<title>`, whose loader reads that param
  once and renders a success `Message` (`role="status"`), matching the
  mockup's own success-banner example. Both the loader and the action run the
  id through a `requirePostId`-shaped guard before it reaches the database -
  copied from `post-edit.tsx`, not extracted (its second use; see Step 2's
  note on the badge) - so a hand-typed, non-uuid id gets the same 404 a
  missing post gets, rather than the raw `invalid input syntax for type uuid`
  500 an unguarded query would answer (the exact failure `post-edit.tsx`'s own
  guard exists to prevent, F-28). The list gains a "Delete" link per row
  (quiet, danger-colored text, not color alone - the word is always there).
  `design.md` gains the confirmation screen and the `?deleted=` pattern, the
  latter flagged as reusable by item 4's publish/unpublish.
  *Done when:* in the browser: clicking Delete opens the confirmation screen
  naming the post; Cancel returns to the list with nothing changed; confirming
  deletes it, redirects to the list, and shows "'<title>' was deleted."; an
  author cannot reach another author's confirmation screen or delete their post
  (404, matching the edit route's own masking); a hand-typed non-uuid id at
  either route answers 404, not 500; the whole flow works with JavaScript
  disabled; `npm run verify` passes.

  *Evidence (2026-09-21), Chromium against the production build:* confirm
  screen names the post; Cancel returns to the list, row intact; confirming
  redirects with `?deleted=...`, shows `"<title>" was deleted.`, row actually
  gone from the database. Cross-author: another author's GET to the confirm
  screen -> 404; a same-origin POST -> 404, row untouched. A hand-typed
  non-uuid id -> 404 at POST (confirmed same-origin, since an unauthenticated
  cross-site POST is refused by the CSRF check first - 403 - before this
  route's own guard is ever reached, which is expected and separate). Whole
  flow re-run with JavaScript disabled: identical. Screenshots (light/dark):
  `blueprint/reference/3-manage-posts/confirm-*.png`. `npm run verify` ->
  exit 0, 148 unit tests, build ok.

  **Refinement made in this step:** `deleteEntry`'s return type (from Step 1)
  changed from `"deleted" | "not_found"` to `{ title: string } | null`, so the
  action gets the deleted title from the same `delete ... returning` query
  instead of a second read. Step 1's only consumer of the old shape was this
  step, so nothing built earlier depended on it.

- [x] **Step 5 - Browser tests, the bar, and the records** -
  `e2e/manage-posts.spec.ts`: the list shows role-scoped posts; the empty state
  on zero posts; each filter tab and its count; search narrowing and clearing;
  pagination past 20 posts; delete's cancel path, confirm path, and the
  cross-author 404; the success banner after delete. `e2e/helpers/users.ts`
  gets a `status` option on `createDraftFor` (default `"draft"`, so every
  existing call is unaffected) and an `entryExists(id)` helper for the delete
  tests. Then: seed roughly 2,000 rows directly by SQL and measure the list
  route's server time at p95 over repeated loads, against the quality bar's
  admin-save number (< 1 s) - the closest number the bar states for an admin
  operation, extended here to cover a read since nothing more specific exists.
  Do the same for one delete. `needs-you.md`'s existing keyboard/screen-reader
  line (from item 1) widens to name the posts list, its filter tabs and search,
  and the delete confirmation screen.
  *Done when:* `npm run test:e2e` passes with the new file included (count
  pasted); the cross-author 404 test is **shown to fail** with the ownership
  check removed from `deleteEntry`; p95 numbers for the list load and for a
  delete are pasted here against the 1 s bar; `npm run verify` passes.

  *Evidence (2026-09-21):* `npm run test:e2e` -> **39 passed** (31 existing +
  8 new). The cross-author 404 test **shown to fail** with `ownedBy(actor)`
  removed from `deleteEntry`'s query (200 instead of 404), file restored
  byte-identical (md5 `753372d90c647e2326c2e51c147609c7` before and after).
  Quality bar, 2,000 rows seeded directly by SQL, against the running
  production build: 25 list loads -> **p95 20.2 ms**, median 9.1 ms; 20
  deletes -> **p95 68.9 ms** - both far inside the 1 s admin bar. Test data
  cleaned up, 0 rows left. `npm run verify` -> exit 0, 148 unit tests.
  `needs-you.md`'s manual-pass line widened to name the nav, filter tabs,
  search and delete confirmation.

  **What this step's full-suite run caught that nothing earlier did:**
  running the *whole* `npm run test:e2e` suite (not just the new file) broke
  10 assertions in `e2e/auth.spec.ts` and the `logIn` helpers in
  `write-post.spec.ts` and `inline-formatting.spec.ts` - all expected `/admin`
  to be a real landing page, which Step 2's redirect changed. Not something
  the spec's build steps named, but a direct, unavoidable consequence of the
  `/admin -> /admin/posts` decision, and this step's own done-when ("`npm run
  test:e2e` passes") could not be satisfied without fixing it. Every affected
  assertion updated, including one url-encoded `redirectTo` value
  (`%2Fadmin` -> `%2Fadmin%2Fposts`) and the "Hello, {name}" heading check
  (replaced with the "Posts" heading, since the placeholder it asserted on no
  longer exists). All 31 pre-existing tests re-verified passing for the
  right reasons before the new file was added.

- [x] **Repair F-54 - Scope the table's CSS selectors under `.list`** - four
  bare element selectors (`table`, `th`, `td`, `tr:last-child td`,
  `tbody tr:hover`) in `post-list.module.css` leak into the global stylesheet
  instead of staying scoped to this component.
  *Done when:* the built CSS chunk for `post-list` contains no bare `table`,
  `th`, `td`, `tr` selectors - only `.list`-prefixed ones; the list still
  renders identically (screenshot); `npm run verify` passes.

  *Evidence (2026-09-21):* all five rules prefixed with `.list`. The built
  chunk (`build/client/assets/post-list-*.css`) now reads
  `._list_18e61_82 table{…}`, `._list_18e61_82 th{…}`, `._list_18e61_82 td{…}`,
  `._list_18e61_82 tr:last-child td{…}`, `._list_18e61_82 tbody tr:hover{…}` -
  no bare element selector anywhere in the chunk. Screenshot
  (`repair-f54-list.png`) shows the table rendering identically - borders,
  padding, both badge colors, hover unaffected. `npm run verify` -> exit 0,
  148 unit tests, build ok.

- [x] **Repair F-60 - Qualify the list's SQL fragments** - `ownedBy`,
  `statusFilter` and `searchFilter` emit unqualified `author_id`/`status`/
  `title`, safe today only because `users` (joined in `listEntries`) has no
  colliding column name.
  *Done when:* the three fragments read `e.author_id`/`e.status`/`e.title`;
  `findEntryForUser` and `updateDraft` alias `entries` as `e` too, so every
  caller is consistent; `listEntries` and `deleteEntry` still behave
  identically (smoke-tested against the dev database); `npm run verify` and
  `npm run test:e2e` pass.

  *Evidence (2026-09-21):* `ownedBy` now emits `e.author_id`; `statusFilter`/
  `searchFilter` emit `e.status`/`e.title`. Every one of the six call sites
  across `findEntryForUser`, `updateDraft`, `deleteEntry` and `listEntries`'s
  three internal queries now aliases its `entries` reference as `e`. **The
  fix caught a bug of its own making while landing:** `listEntries`'s tab-count
  query (`select status, count(*) … from entries where type = 'post'
  ${ownedBy(actor)} group by status`) had no `e` alias and would have thrown
  `missing FROM-clause entry for table "e"` the moment `ownedBy` started
  requiring one - caught by re-reading every call site before running
  anything, then confirmed by the smoke test below. Smoke-tested directly
  against the dev database: `listEntries` (all/status-filtered/searched),
  `findEntryForUser`, `updateDraft`, `deleteEntry`, and both cross-author
  checks (find and delete) all returned identical results to before the
  change; rows cleaned up. `npm run verify` -> exit 0, 148 unit tests;
  `npm run test:e2e` -> 39 passed.

## Files and areas

- `app/features/content/entries.server.ts` - `listEntries`, `deleteEntry`
- `app/features/content/post-list-query.ts`, `post-list-query.test.ts` - new
- `app/features/content/post-list.tsx`, `post-list.module.css` - new
- `app/features/content/post-delete.tsx`, `post-delete.module.css` - new
- `app/features/content/post-form.tsx` - back link target, one line
- `app/features/admin-shell/home.ts` (was `home.tsx`) - becomes a redirect,
  now a resource route (no UI, matching `logout.ts`); `home.module.css` deleted
- `app/features/admin-shell/layout.tsx`, `layout.module.css` - first nav entry
- `app/routes.ts` - `admin/posts`, `admin/posts/:id/delete`
- `e2e/helpers/users.ts` - `createDraftFor`'s `status` option, `entryExists`
- `e2e/manage-posts.spec.ts` - new
- `e2e/auth.spec.ts`, `e2e/write-post.spec.ts`, `e2e/inline-formatting.spec.ts` -
  post-login assertions updated for the `/admin` -> `/admin/posts` redirect
- `blueprint/context/design.md`, `blueprint/context/needs-you.md`
- `blueprint/reference/3-manage-posts/` - screenshots (list, confirm; light/dark)

## Data and contracts

**No schema change** - `listEntries` and `deleteEntry` read and write the
`entries` table exactly as `0002_entries.sql` already defines it.

```ts
type PostListQuery = { status: "all" | "draft" | "published"; q: string; page: number };

type PostSummary = {
  id: string; title: string; slug: string;
  status: "draft" | "published"; authorName: string; updatedAt: Date;
};

type PostList = {
  entries: PostSummary[];
  total: number;                                 // matching the current status + q
  totalPages: number;                            // PAGE_SIZE is server-only; this is the client's number
  counts: { all: number; draft: number; published: number };  // independent of q
};
```

`PAGE_SIZE = 20`, a constant in `entries.server.ts` beside `listEntries`.

**Load-bearing for item 4:** `listEntries` and the `?deleted=<title>` redirect
pattern - publish/unpublish will call the same function (perhaps with a new
`published_at`-aware sort later, not now) and should reuse the same query
param shape for its own success banner rather than inventing a second one.

## Testing

- **Unit (`npm test`, runs in CI):** `parsePostListQuery`'s bounds and
  fallbacks - the only pure logic this item adds.
- **Browser (`npm run test:e2e`, local only - F-17):** the full list -
  role scoping, tabs, search, pagination, empty states, delete's three
  outcomes (cancel, confirm, cross-author 404), the success banner, and the
  whole flow with JavaScript off. Seeded via the database (D24).
- **Manual (needs a person):** keyboard and screen-reader pass over the list,
  its filter tabs and search, and the delete confirmation screen - the
  existing `needs-you.md` line, widened.

## Decisions

- **`/admin` redirects to `/admin/posts`, rather than `/admin` itself becoming
  the list.** `project-plan.md`'s Routes table names `/admin/posts` explicitly
  as its own route, comma-separated from `/new` and `/:id`; `home.tsx`'s
  comment ("makes /admin the posts list") is read as satisfied by the redirect,
  not as requiring the list to render at the bare `/admin` path. This also
  gives every future admin section (`/admin/pages`, `/admin/media`, …) the same
  shape - a named index route, not an overloaded root.
- **The nav list grows one entry per shipped section**, not all five at once
  with the unbuilt ones hidden or disabled. A nav item pointing at a route that
  does not exist is a dead link; `design.md`'s full five-item description is the
  *finished* shell, and this item is the first of five steps toward it.
- **Delete is a two-screen confirmation (GET then POST), not a JS `confirm()`
  dialog or an inline row toggle.** Matches D10 - forms work without
  JavaScript - and reuses the exact GET-then-POST shape `post-edit.tsx` already
  has, rather than inventing a second pattern.
- **A successful delete's message reaches the list through
  `?deleted=<title>` on the redirect**, read once by the loader. The mockup
  already shows this exact banner after a redirect-producing action
  (`posts-list.html`'s "is published." example); item 4's publish/unpublish
  should reuse the same query param rather than inventing its own.
- **`PAGE_SIZE = 20`.** Comfortably below the quality bar's scale (a few
  thousand entries -> at most a few hundred pages) and matches the mockup's
  own row count.
- **No new database index.** A sequential scan over "a few thousand" rows,
  filtered by `type` and optionally `status` and `ilike`, is inside every
  stated budget - the same judgment already recorded for the slug lookup
  (F-27). `ilike` cannot use a plain index regardless; `pg_trgm` would be a new
  dependency for a query this small, decided on its own if it's ever needed.
- **`PAGE_SIZE` stays server-only; the client works from a derived
  `totalPages` instead.** Discovered by the build, not planned: computing the
  page count from `PAGE_SIZE` in the client component tried to import a
  server-only constant into the browser bundle, which React Router's build
  correctly refuses. `listEntries` now returns `totalPages` directly.
- **`home.tsx` became `home.ts`.** Once its placeholder markup was gone (it
  only ever throws a redirect now), it fit the project's own resource-route
  convention - no UI, `.ts` not `.tsx` - the same shape `logout.ts` already
  uses.

## Notes

- **Every entry in the database is `status = 'draft'` today** - publish ships
  in item 4. The "Published" tab is real code with a real, always-zero count
  until then; that is expected, not a gap in this item.
- `ilike '%…%'` does not escape a literal `%` or `_` the searcher types - it
  acts as their own wildcard within their own term. Minor, not defended
  against: nobody asked, and it only affects the searcher's own results.
- The delete confirmation screen sits inside the admin shell (sidebar
  present), not standalone like the editor - it is a short question, not a
  focused task the way writing is, so it does not need the editor's dropped
  sidebar.
- Author-owned delete reuses `ownedBy(actor)`, already in `entries.server.ts`
  from item 2a - no new authorization logic, just a new query built on it.
- **The `/admin` redirect broke 10 existing e2e assertions** that expected a
  real page there (item 1's own tests, plus the `logIn` helpers in two item
  2 spec files) - fixed in Step 5, once the full suite ran rather than just
  the new file. A worked example of why this project's `build` skill runs
  the whole verification command, not only what a step's own diff touches.

## Findings

None resolved with this item. F-54 and F-60 were repaired here and marked
`fixed` in the ledger; only a later `review` pass moves them to `closed`, so
they stay in the live ledger rather than being archived. The nine other
findings this item's review raised (F-55, F-56, F-57, F-58, F-59, F-61, F-62,
F-63, F-64) are `open` or `unverified` and stay in the ledger too.
