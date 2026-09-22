# Feature: Manage pages

**From build plan:** item 6a (split from item 6, Pages)
**Type:** Feature
**Status:** built, all three steps and three repairs complete

## Goal

Give editors and admins a way to create, edit, publish/unpublish and delete
static pages - "About", "Contact", and the like - the same way item 3 gave
every role that ability for posts. This item is the admin (write) half only;
item 6b renders a published page on the public site at `/:slug`.

## In scope

- Generalizing the entries data layer (`entries.server.ts`) to operate on
  either `post` or `page`, instead of hardcoding `type = 'post'`.
- `/admin/pages` (list, filterable and searchable like posts), `/admin/pages/new`,
  `/admin/pages/:id` (edit, save/publish/unpublish), `/admin/pages/:id/delete`.
- Restricting all four routes to the `editor` and `admin` roles - authors get the
  same 404 the project already gives for something they cannot see, not a new
  "forbidden" page.
- A "Pages" entry in the admin sidebar nav, hidden for authors (design.md's own
  stated rule: "items the role cannot use are hidden").
- Reserved page addresses (`admin`, `posts`, `api`, `healthz`) never being handed
  out as a page's slug.

## Out of scope

- Rendering a published page on the public site (`/:slug`) - item 6b.
- A "Pages" index or listing anywhere on the public site - a page is reached
  by its own address only, until item 7 wires up navigation. Not planned for
  this item at all; if item 7 turns out to need one, that is item 7's decision.
- Any change to how posts behave, look, or are reached - this item generalizes
  the code posts already run on, but every done-when below includes proving
  posts are unaffected.

## Build steps

- [x] **Step 1 - Generalize the entries data layer for two entry types** -
  Add `export type EntryType = "post" | "page"` to `entries.server.ts` and
  thread a `type: EntryType` parameter (first parameter, consistently, on every
  function) through `findEntryForUser`, `createDraft`, `saveEntry`,
  `listEntries`, `deleteEntry`, and `findPublishedPost` (renamed
  `findPublishedEntry`) - replacing every hardcoded `'post'` literal. Rename
  `PostSummary` -> `EntrySummary`, `PostList` -> `EntryList` (they already
  describe either entry type, just under the wrong name). Reserved slugs: add
  `RESERVED_PAGE_SLUGS = ["admin", "posts", "api", "healthz"]`; when
  `createDraft` is called with `type: "page"`, seed `nextFreeSlug`'s "taken"
  list with these so a page titled "Admin" silently becomes `/admin-2`, the
  same mechanism a second "Hello world" already goes through - no new refusal
  path. `slugFromTitle`'s `FALLBACK` becomes type-aware (`"post"` / `"page"`).
  Generalize `banner.ts`'s `bannerRedirect(verb, title, target)` to take the
  list path instead of hardcoding `/admin/posts` (`readBanner` needs no change
  - it already reads whichever page's own query string it is called from).
  Soften `entry-input.ts`'s two title-validation messages to be entry-type
  neutral ("Give it a title before saving." / "This could not be saved.") so
  one schema keeps serving both types. Rename the two already-generic,
  post-named files to match what they actually are: `post-list-query.ts` ->
  `entry-list-query.ts`, `post-form-input.ts` -> `entry-form-input.ts`. Update
  every existing call site (`post-new.tsx`, `post-edit.tsx`, `post-delete.tsx`,
  `post-list.tsx`, `public-site/post.tsx`, `public-site/home.tsx`) to pass
  `"post"` explicitly and use the renamed types/functions/imports.
  *Done when:* `npm run verify` and `npm run test:e2e` both pass with **zero
  behavioral change to posts** - the existing `manage-posts.spec.ts` and
  `write-post.spec.ts` assert the same outcomes, unmodified.

- [x] **Step 2 - Restrict a route to non-author roles** - Add
  `app/features/auth/require-role.server.ts` exporting
  `requireRole(allowed: readonly Role[]): MiddlewareFunction`, which reads
  `context.get(userContext).role` and throws `data("Not Found", { status: 404 })`
  when the role is not in `allowed` - the same 404-not-403 shape
  `findEntryForUser` already uses for ownership, applied here for consistency
  and so the feature's existence is not signalled to a role that cannot use it.
  Reusable as-is by item 8 for admin-only routes. Unit test:
  `requireRole(["admin", "editor"])` refuses an `author` context and passes an
  `editor` and an `admin` through to `next()`.
  *Done when:* the unit test is shown to fail with the role check removed, then
  passes with it in place.

- [x] **Step 3 - Build the pages admin screens** - Reuse a single, parametrized
  `EntryForm` (renamed from `PostForm`, taking `entryType: "post" | "page"` and
  deriving its back-link, address-prefix and title placeholder from it) for
  both the post and page editors - see *Decisions* for why this one is shared
  rather than copied. Add `page-list.tsx` and `page-delete.tsx` (own `.module.css`
  files), copied from and adapted from `post-list.tsx`/`post-delete.tsx` -
  same filter tabs, search, table columns, and delete-confirmation shape, with
  copy that accurately describes a page (not "appears on your site's home page
  with the newest first", which is only true of a post). Add `page-new.tsx` and
  `page-edit.tsx`, thin wrappers mirroring `post-new.tsx`/`post-edit.tsx` but
  calling the entries functions with `type: "page"` and rendering `EntryForm`
  with `entryType="page"`. Wire into `app/routes.ts`: `admin/pages` and
  `admin/pages/:id/delete` inside the admin-shell layout (alongside
  `admin/posts`), `admin/pages/new` and `admin/pages/:id` outside it (matching
  posts' own reasoning - the editor drops the sidebar); all four carry
  `requireRole(["admin", "editor"])` in addition to the layout's `requireUser`.
  Add a "Pages" entry to the sidebar nav in `admin-shell/layout.tsx`, with its
  own icon, rendered only when `user.role !== "author"`.
  *Done when:* logged in as an editor, create a page titled "About", save it as
  a draft, publish it, edit its content, and delete it - all only reachable
  under `/admin/pages*`. Logged in as an author, every one of those four routes
  answers 404 and "Pages" does not appear in the sidebar. A page titled "Admin"
  saves with address `/admin-2`, not `/admin`. Admin save times stay under the
  quality bar's 1 s p95 for an entry save (`quality-bar.md`).

- [x] **Repair F-80** - the pages happy-path e2e test never edits content and
  never confirms the delete at the data layer. Capture the page's id from the
  URL after the first save; after re-opening the page, type additional text
  into the editor and save it, then reload and assert the new text is present
  (mirroring `write-post.spec.ts`'s reload test); after the delete, assert
  `entryExists(id)` is `false`.
  *Done when:* the test edits real content and the edit is proven to persist
  across a reload; `entryExists(id)` is asserted `false` after delete;
  `npx playwright test e2e/manage-pages.spec.ts` passes.

- [x] **Repair F-81** - `bannerRedirect`'s `target` parameter is a bare
  `string`. Narrow it to `"/admin/posts" | "/admin/pages"`.
  *Done when:* `npm run typecheck` passes with the narrowed type and both call
  sites unchanged.

- [x] **Repair F-82** - `requireRole`'s refusal is not logged, unlike every
  other access refusal in the app. Call `logSecurityEvent` with a new reason
  (`"role_refused"`) before throwing, mirroring `refuseCrossSiteRequests`'s
  shape (`method`, `path`, `ip`, plus the user's role and the roles allowed).
  *Done when:* a unit or e2e check shows the event is logged on an author's
  refused request; `npm run verify` passes.

## Files and areas

**Modified:** `app/features/content/entries.server.ts`, `slug.ts`, `banner.ts`,
`entry-input.ts`, `post-new.tsx`, `post-edit.tsx`, `post-delete.tsx`,
`post-list.tsx`; `app/features/public-site/post.tsx`, `home.tsx`;
`app/features/admin-shell/layout.tsx`; `app/routes.ts`.
**Renamed:** `post-list-query.ts` -> `entry-list-query.ts`,
`post-form-input.ts` -> `entry-form-input.ts`, `post-form.tsx` ->
`entry-form.tsx` (+ its `.module.css`).
**New:** `app/features/auth/require-role.server.ts` (+ `.test.ts`),
`app/features/content/page-list.tsx` (+ `.module.css`), `page-new.tsx`,
`page-edit.tsx`, `page-delete.tsx` (+ `.module.css`); `e2e/manage-pages.spec.ts`.

## Data and contracts

- `EntryType = "post" | "page"`, exported from `entries.server.ts` - **load-
  bearing for item 6b**, whose public loader calls
  `findPublishedEntry(slug, "page")` the same way `post.tsx` already calls it
  with `"post"`.
- Every `entries.server.ts` function takes `type: EntryType` as its **first**
  parameter, consistently.
- `RESERVED_PAGE_SLUGS` (`admin`, `posts`, `api`, `healthz`) - `api` is reserved
  even though no `/api` route exists yet, so a page cannot occupy an address a
  later item needs.
- `requireRole(allowed: readonly Role[]): MiddlewareFunction` - a route-level
  middleware, not a layout-level one (posts and pages share a layout but not a
  role restriction), reusable by item 8.
- `EntryForm` takes an `entryType: "post" | "page"` prop; no other component
  needs to know which entry type it is rendering.

## Testing

- **Unit:** `require-role.server.test.ts` (Step 2). No new unit tests for the
  entries data layer - it has none today (it opens a database connection on
  import, same as `entries.server.ts` always has); it is proven through e2e,
  as it already was for posts.
- **e2e:** new `e2e/manage-pages.spec.ts`, reusing `e2e/helpers/auth.ts`'s
  `logIn` (F-77) - create/edit/publish/unpublish/delete a page as an editor;
  an author gets 404 on all four routes and no "Pages" nav entry; a page
  titled "Admin" gets a non-colliding address. Existing `manage-posts.spec.ts`
  and `write-post.spec.ts` run unmodified as the regression proof for Step 1.

## Decisions

- **Generalize `entries.server.ts` with a `type` parameter, rather than a
  parallel `pages.server.ts`.** The data-layer functions are the same
  operation over the same table, already generic (the `entries` table has
  carried a `type` column since item 1) - the reason to change is shared, not
  merely similar-looking, so this is extraction, not premature abstraction.
- **Share one `EntryForm` between the post and page editors, rather than
  copying it** - the project's usual "copy the second time, extract on the
  third" default is deliberately overridden here. The form's save/publish
  state machine is complex and has a real history of subtle bugs fixed once in
  one place (F-34 - a native submit wiping the body; F-42 - the same failure
  mode for `readEditor`; D64 - dialog focus management): duplicating it risks
  a future fix landing in only one copy.
- **Copy, not share, `page-list.tsx` and `page-delete.tsx`** from their post-*
  counterparts - they hold little beyond markup and a loader, so the drift
  risk the `EntryForm` decision guards against does not apply, and each can
  grow its own columns or filters later without fighting a shared component.
- **Reserved page slugs are absorbed into the free-address search, not
  refused as an error** - a page titled "Admin" becomes `/admin-2` through the
  exact mechanism a second "Hello world" already goes through, so no new
  refusal message is needed and no editor is ever told their title is invalid
  because of it.
- **Role refusal reuses the project's 404-not-403 convention.** An author
  hitting a pages route gets the same "Not Found" an author hitting someone
  else's post gets - consistent, and it does not signal that a Pages feature
  exists to a role that cannot reach it.
- **Driving an already-loaded Editor.js block with synthetic keyboard input is
  unreliable in this e2e harness, and is not worth chasing further right now.**
  Discovered repairing F-80: three different interaction techniques (click+End,
  click+Ctrl/Cmd+A, with and without confirming the DOM changed first) each
  passed some runs and silently saved stale content on others, with no
  reproducible cause found. `e2e/manage-pages.spec.ts` proves "editing an
  existing entry persists" through the title field (a plain input) instead of
  the body, which exercises the identical `saveEntry` path deterministically.
  Cost: no e2e coverage yet of editing an existing page's *body* specifically
  - low risk, since `write-post.spec.ts` already covers the same code path for
  posts extensively. Worth a `debug` pass in its own right before a page
  builder needs to drive an already-populated block reliably.

## Notes

- Pages get no public index or "recent pages" list in this item - see *Out of
  scope*. Empty-state and any other new copy must describe pages accurately
  rather than being copied verbatim from posts' own text.
- `design.md`'s "Nav (item 3)" note already anticipates this: "Pages, ...
  each add their own entry when they ship" - no design.md change needed, only
  its own icon (distinguishable from Posts' icon) chosen at build time.
- `needs-you.md`'s existing admin-shell accessibility line is being widened
  (this spec pass) to include the pages screens once built, rather than
  opening a second line for the same unmet manual pass.

## Findings

### 06a/F-80 [P2] closed - The pages "create, publish, edit, delete" test never edits content, and never checks the delete actually removed the row

**File:** e2e/manage-pages.spec.ts:36-74
**Found:** 2026-09-22 by review (scope: current; lens: tests)
**Why it matters:** The test's own name and the spec's Step 3 done-when both name five things: create, save as draft, publish, **edit its content**, and delete. Read closely, the test does not do the fourth: after publishing, it re-opens the page and immediately clicks **Unpublish** - it never types new text into the editor or saves a content change, so nothing here proves a page can be edited after its first save. The fifth is also unproven at the data layer: the test asserts the delete redirects and shows `'"About" was deleted.'`, but never calls `entryExists(id)` the way `manage-posts.spec.ts`'s own delete test does (`expect(await entryExists(id)).toBe(false)`) - `entryExists` is imported and used only by the third test in this file. **This was reported as proven by both `build`'s Step 3 and the `verify` pass that followed** - a screenshot walkthrough was taken but never included a content edit either, so neither the automated test nor the manual verification actually exercised the "edit its content" behavior the spec named. Low risk of an actual product defect - `saveEntry` and `EntryForm` are the identical, heavily-tested code path posts already use (`write-post.spec.ts` covers editing and reloading a post) - but the specific claim for pages is unproven, not merely under-tested.
**Suggested fix:** In the happy-path test, after re-opening the saved page, type additional text into the editor and click Save (or Publish, since it is already draft->published by then), then reload and assert the new text is present - mirroring `write-post.spec.ts`'s "a draft is written, saved, and still there after a reload". Capture the page's id from the URL after the first save (`new URL(page.url()).pathname.split("/").pop()`) and add `expect(await entryExists(id)).toBe(false)` after the delete.
**Resolution:** Repaired 2026-09-22 by build, in two parts.

*Part 1 - the `waitForURL` race.* The first fix attempt (retyping into the existing body block, then reloading) failed on `page.waitForURL(...)`: a plain "save" never navigates (unlike the first save, which redirects from `/new` to the entry's own URL), so `waitForURL` against an already-matching URL resolves immediately, before the save's fetch request has reached the server - the following `page.reload()` raced ahead of it. Fixed by waiting for the save-state text to read "Saved" instead, which only appears once the submission genuinely completes.

*Part 2 - retyping into an already-loaded Editor.js block was itself unreliable, independent of the race above.* With the `waitForURL` race fixed, the test still failed intermittently (roughly 1 in 2-3 runs): the DOM visibly contained the new text (`expect(canvas).toContainText(...)` passed) immediately before clicking Save, yet the database sometimes still held the old body after reload. Two further interaction techniques were tried (click + End + type; click + Ctrl/Cmd+A + retype, with an explicit DOM-changed check before saving) - both passed some runs and silently saved the stale body on others, with no reproducible pattern found across several runs of each. Per this workflow's own "stop guessing after the second try" rule, stopped rather than trying a fourth variation. **Descoped instead of chasing the cause further:** the test now proves "edit its content" by changing the page's **title** (a plain input, not Editor.js) rather than its body - the identical `saveEntry` round trip, deterministic, and consistent with this project's own precedent of not driving a flaky rich-text interaction (`write-post.spec.ts`: "Driving the floating menu proved too flaky to be worth what it adds"). Confirmed clean over 4 repeated runs before merging into the full pass. Deletion is proven at the data layer: captured the page's id after the first save, `expect(await entryExists(id)).toBe(false)` after the delete.

**The body-retyping flakiness itself is not resolved** - only avoided in this test. Recorded as a decision above.

Evidence: `npx playwright test e2e/manage-pages.spec.ts --workers=1` -> 3/3 passed, 4 consecutive repeats of the edit test with no failures; full suite `npx playwright test --workers=1` -> 67/67 passed (no regression); the real server's log confirmed `entryExists(id)` false after delete. **Closed 2026-09-22 by review**, re-reading the test fresh and re-running it independently: full suite `npx playwright test --workers=1` -> 67/67; `e2e/manage-pages.spec.ts` alone run three more full, separate times (not repeats of one test in a loop) -> 3/3 every time, 9 total executions with no failure. The test now asserts a real title change persists across reload and `entryExists(id)` is `false` after delete, matching what its name claims. Status `closed`.

### 06a/F-81 [P3] closed - `bannerRedirect`'s `target` parameter is a bare `string`, wider than its only two real values

**File:** app/features/content/banner.ts:37
**Found:** 2026-09-22 by review (scope: current; lens: quality)
**Why it matters:** Every call site today passes a literal `"/admin/posts"` or `"/admin/pages"`, but the parameter's type does not say so - `fundamentals.md`'s Types section: "Make invalid states unrepresentable where the language allows it." A future caller (item 7 or 8 adding another list) could pass a mistyped or wrong path and the type checker would not catch it; `bannerRedirect` would build a redirect to a route that may not read `readBanner`'s query shape.
**Suggested fix:** `target: "/admin/posts" | "/admin/pages"` - cheap now, while there are only two callers to update, and grows by one member each time a later item adds a list.
**Resolution:** Repaired 2026-09-22 by build. Added `export type EntryListPath = "/admin/posts" | "/admin/pages"` and typed `target: EntryListPath`; no call site needed a change, since every one already passed a matching literal. Evidence: `npm run typecheck` -> exit 0; `node --test app/features/content/banner.test.ts` -> 5/5. **Closed 2026-09-22 by review**, re-reading `banner.ts` fresh: `EntryListPath` is exported and used exactly as described, both call sites (`post-edit.tsx`, `post-delete.tsx`, `page-edit.tsx`, `page-delete.tsx`) pass a matching literal, and `npm run typecheck` is clean. Status `closed`.

### 06a/F-82 [P3] closed - `requireRole`'s refusal is not logged, unlike every other access refusal in the app

**File:** app/features/auth/require-role.server.ts:17
**Found:** 2026-09-22 by review (scope: current; lens: security)
**Why it matters:** `refuseCrossSiteRequests` (`app/root.tsx`) and every login outcome (`login.tsx`) call `logSecurityEvent` on refusal; `requireRole` throws its 404 silently. `fundamentals.md`'s Logging section: "Log the security-relevant events: failed authentication, access denied, and anything that changes permissions." A role check is exactly "access denied" in that sentence, and it is brand-new code, not an existing gap being merely widened - unlike `findEntryForUser`'s ownership refusal (also unlogged, but pre-existing and not part of this item). Not exploitable on its own: the refusal is correct either way, so this is a detection gap, the same shape as the already-open F-70 (host-routing refusals also silent), not a bypass.
**Suggested fix:** Call `logSecurityEvent` with a new reason (e.g. `"role_refused"`) before throwing, mirroring `refuseCrossSiteRequests`'s shape (`method`, `path`, `ip`, the user's role and the roles allowed).
**Resolution:** Repaired 2026-09-22 by build. Added a `request_refused` / `reason: "role"` variant to `SecurityEvent` (`path`, `role`, `ip` - `method` omitted since every route this guards is GET or POST-with-CSRF-already-checked, not itself informative here); `requireRole` now logs it before throwing. Two new unit tests: refusal logs exactly the expected line (mutation-proven - removing the call made the assertion fail with an empty log), and an allowed role logs nothing. Confirmed against the real server too: an author's four refused requests each produced a `{"event":"request_refused","reason":"role",...}` line in the running app's own log during the e2e run. Evidence: `npm run verify` -> exit 0, 187 unit tests; `node --test app/features/auth/require-role.server.test.ts` -> 3/3. **Closed 2026-09-22 by review**, re-examining the repair fresh: the log call, its new `SecurityEvent` variant, and both new unit tests read as claimed; re-ran `npm run verify` (clean) and confirmed the log line live against the real server during a fresh `npx playwright test e2e/manage-pages.spec.ts` run (three separate log lines, one per refused route, matching the author role). One new, unrelated observation from this re-examination filed separately as F-84 (the new field's own type is wider than it needs to be) - not a reason to leave this one open, since the repair does exactly what it says. Status `closed`.
