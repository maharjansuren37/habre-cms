# Fix: Tidy the findings backlog

**Type:** Fix
**Verified:** 2026-10-02, 286a5225515c - every behavioural done-when proven by browser tests against the served app; full suite 155 passed (real R2), earlier 127 passed + 26 skipped (E2E_SKIP_R2=1)
**Reviewed:** 2026-10-02, 286a5225515c, current (every lens at 4b0a0b8ec6a8; repair delta 57f120d..61595c8 re-reviewed, every lens), independent reviewer agent - 0 blocking

## Goal

Repair the 22 backlog findings that code or a record can close now, grouped by
area, so the backlog holds only what is genuinely waiting on something. Done
before 13b because several touch screens 13b restyles.

## In scope

| Step | Findings |
|---|---|
| 1 Auth and logging | F-26, F-58, F-71, F-84, F-101 |
| 2 Posts and pages lists | F-56, F-61, F-62 |
| 3 Settings | F-93, F-95, F-96, F-107, F-117 |
| 4 Public site data | F-108, F-111, F-118 |
| 5 Browser tests | F-23, F-78, F-86, F-102 |
| 6 Records | F-19, F-64 |

**F-26, F-56, F-61 and F-62 name the posts screens; the pages screens are
copies with the same gap** (`page-new.tsx`, `page-list.tsx`,
`page-delete.tsx`), so each is repaired in both.

## Out of scope

Left in the backlog, each with its reason:

- **F-55** (dates in the server's timezone) - needs your call on whose
  timezone a date is shown in; sites have no timezone setting yet.
- **F-59** (login's extra hop through `/admin`) - admin Home lands at
  `/admin` in items 15-18, which removes the hop; pointing login at
  `/admin/posts` now would be undone then.
- **F-27** (prefix lookup scans) - harmless at today's scale; 15a rebuilds the
  entries indexes around `site_id`, the place to fix it.
- **F-20** (root SSH login on `ocwebserver`) - a production server change:
  `host`, with its own yes.
- **Deferred to 14a** (F-31, F-38, F-39, F-50, F-51, F-52, F-79, F-104,
  F-127, F-128) - their code is replaced there.
- **Fixed, awaiting `review`** (F-07, F-98, F-99, F-120, F-121) and
  **unverified, awaiting a screen reader** (F-13, F-63, F-83).
- F-103 (P2, shared `site_settings` row in tests) is in the live index, not
  the backlog. Step 4 avoids adding another writer to that row.

## Build steps

- [x] **Step 1 - Auth and logging** -
      `post-new.tsx` and `page-new.tsx` get a loader returning `null`, so a
      client-side navigation runs the guard (F-26). `post-delete.tsx` drops
      its own `requireUser`, which the admin-shell layout already runs (F-58).
      The session cookie comment describes both cases: one host in
      development, host-only in production (F-71). `SecurityEvent`'s role
      refusal takes `role: Role` (F-84). `refuseCrossSiteRequests` and
      `requireRole` log `url.pathname` from the middleware arguments
      (F-101). *Done when:* a new test in `e2e/auth.spec.ts` (or the file
      that holds the guard tests) signs in, clears the cookies, follows the
      "New post" link client-side and ends on `/admin/login`, and the same for
      "New page"; `grep -n "new URL(request.url).pathname" app/root.tsx
      app/features/auth/require-role.server.ts` prints nothing; passing a
      string that is not a role to that event fails `npm run typecheck`
      (seen once, reverted); `npm run verify` passes.
- [x] **Step 2 - Posts and pages lists** -
      a page number past the last page redirects to the last page, as
      `media-list.tsx` already does (F-56). The search form gets a visible
      Search button (F-62). The delete confirmation carries the list's
      `status`, `q` and `page` to Cancel and to the redirect after delete,
      read through the list's own query parser so nothing but those three
      values reaches the URL (F-61). *Done when:* browser tests, for posts and
      for pages: `?page=99` with one page of entries lands on the last page's
      URL and shows its entries; `getByRole("button", { name: "Search" })`
      submits the search; deleting from the Drafts tab with a search active
      returns to that tab and search with the "deleted" banner, and Cancel
      does too; `npm run verify` passes.
- [x] **Step 3 - Settings** -
      the form throws instead of falling back to defaults when the layout's
      data is missing (F-93). A menu row whose page no longer exists shows
      "This page no longer exists - choose another page or remove this item."
      beside its select (F-95). Stored `navigation` is parsed with
      `navigationSchema` by a pure `parseStoredNavigation` in
      `navigation-input.ts`: a malformed value logs one error naming the
      column and reads as an empty menu (F-96). A save with no `homePageId`
      field is refused with 400 and "This form is out of date. Reload the page
      and try again.", changing nothing (F-107). The action checks
      `Content-Length` against 16 KB before reading the body and answers 413
      (F-117). *Done when:* unit tests: `parseStoredNavigation` returns the
      items for a valid value and `[]` for a jsonb string, an object and an
      item missing its label; `isSettingsFormBodyAllowed` in
      `settings-input.test.ts` accepts 16 KB, refuses 16 KB + 1, a missing
      and a non-numeric length. Browser tests: a menu row pointing at a
      deleted page shows the note; a POST without `homePageId` answers 400 and
      the saved home page is unchanged; a 17 KB POST answers 413. `npm run
      verify` passes.
- [x] **Step 4 - Public site data** -
      `page.tsx` and `post.tsx` return the entry without `id` and
      `isHomePage`; the public layout returns only the site title, logo URL
      and resolved links, not the whole settings row (F-108). The home
      placeholder throws when the layout's data is missing instead of
      falling back to a literal title, so a broken lookup fails the existing
      placeholder test (F-111) and the duplicate literal goes (F-118).
      *Done when:* a browser test fetches a published page and a published
      post as HTML and finds neither the entry's id nor the strings
      `"homePageId"` and `"navigation"` in the response; `grep -n "Habre CMS"
      app/features/public-site/home.tsx` prints nothing; pointing the
      placeholder's lookup at a wrong route id fails the placeholder test
      (seen once, reverted); the full browser suite passes. No test writes
      `site_settings` for this step (F-103).
- [x] **Step 5 - Browser tests** -
      the proxied and host-split ports live in one `e2e/helpers/ports.ts`,
      imported by `playwright.config.ts` and the specs (F-23). The "tabs'
      counts match" test asserts only what it created: the author's own
      counts as now, and for the editor, that the other author's post
      appears and "All" is at least 3 (F-78). `/posts` "newest first"
      asserts its two titles appear in that order and the draft does not,
      not the whole list (F-86). The jitless comment and the CSP test's name
      say which screens the walk visits (F-102). *Done when:* `grep -rn
      "310[12]" e2e` finds the numbers only in `ports.ts`; with one extra
      published post inserted by hand before running, both tests pass (seen
      once, then removed); the full browser suite passes twice in a row.
- [x] **Step 6 - Records** -
      delete `blueprint/reference/3-manage-posts/list-light.png` and
      `list-dark.png`, which show the list before its filters (F-64). F-19's
      policy is this spec's Decision below, recorded by `ship`. *Done when:*
      the two files are gone; `npm run verify` passes, and `npm run test:e2e`
      locally with real R2 reports every test passed (141 before this item,
      plus the new tests), and with `E2E_SKIP_R2=1` as CI runs it.

- [x] Repair F-136 - Deleting the only entry on the last page loses the "deleted" banner
- [x] Repair F-137 - The pages "past the last page" test races other specs' pages
- [x] Repair F-141 - The F-108 test's `not.toContain("navigation")` matches any visible text
- [x] Repair F-142 - The F-107 e2e test leaves a home page set until `afterEach`

## Files and areas

- Step 1: `app/features/content/post-new.tsx`, `page-new.tsx`,
  `post-delete.tsx`; `app/features/auth/session-cookie.server.ts`,
  `require-role.server.ts`; `app/lib/security-log.server.ts`; `app/root.tsx`;
  one e2e spec.
- Step 2: `app/features/content/post-list.tsx`, `page-list.tsx`,
  `post-delete.tsx`, `page-delete.tsx`, and the list query parser they share;
  `e2e/manage-posts.spec.ts`, the pages spec.
- Step 3: `app/features/settings/settings.tsx`, `settings.server.ts`,
  `settings-input.ts` (+ test), `navigation-input.ts` (+ test); an e2e
  settings spec.
- Step 4: `app/features/public-site/page.tsx`, `post.tsx`, `layout.tsx`,
  `home.tsx`, and whatever reads the layout's data (`public-title.ts`, the
  layout's `ErrorBoundary`); `app/features/content/entries.server.ts` only if
  the types need narrowing; an e2e spec.
- Step 5: `playwright.config.ts`, `e2e/helpers/ports.ts` (new),
  `e2e/forwarded-proto.spec.ts`, the host-split spec, `manage-posts.spec.ts`,
  `public-site.spec.ts`, `content-security-policy.spec.ts`,
  `app/lib/zod-jitless.client.ts`.
- Step 6: `blueprint/reference/3-manage-posts/`.

## Data and contracts

None stored. Narrowed: the public layout's loader data becomes
`{ settings: { siteTitle, logoUrl }, navLinks }`. Item 14a's renderer and
18a's brand read this layout, so they extend this shape rather than reaching
for the whole row again.

## Testing

- `npm run verify` (CI `verify` job) - the new unit tests for
  `parseStoredNavigation` and `isSettingsFormBodyAllowed` run here; neither
  needs a database.
- `npm run test:e2e` - the new browser tests need the development database
  and no R2, so CI's `e2e` job runs them too. The full suite with real R2
  runs locally (`needs-you.md`).

## Decisions

- **Migrations are forward only; a migration is reversed by restoring the
  backup taken before it** (F-19). Beat: down paths, which nobody runs until
  the day they matter and so are never proven. Item 14a's destructive
  migration is the first to rely on this, with its own yes.
- **A malformed stored menu reads as empty and logs an error** (F-96),
  matching D61's "degrade silently" for this table. Beat: failing loudly as
  `blocks_format` does, which would 500 the one screen that can repair it.
- **A settings save without `homePageId` is refused, not half-applied**
  (F-107). Beat: leaving the home page unchanged, which needs a third state
  in the update and hides a stale form instead of telling the person.
- **Settings bodies are capped at 16 KB** (F-117) - 20 menu rows and a title
  are well under it.

- **The list's return URL is built by one `entryListHref`/`entryListSearch` in
  `entry-list-query.ts`**, from the parsed query, omitting defaults (Step 2).
  The past-the-last-page redirect lands on the bare list URL when the last
  page is 1, and carries the "deleted" banner, parsed through `readBanner` and
  rebuilt by `bannerRedirect`, so no raw query value reaches the redirect
  (F-136).

## Production needs

None. No variables, no migrations. Production holds on `8d82ce4` until v1
(D163).

## Behaviour changes

- New capability `entry-lists`: a page number past the last page of the posts or pages list goes to the last page - Step 2
- Adds to `entry-lists`: deleting a post or page returns to the list's tab, search and page, with the "deleted" banner - Step 2
- Adds to `entry-lists`: the posts and pages search has a visible Search button - Step 2
- New capability `settings`: a menu item whose page was deleted says so in Settings - Step 3
- Adds to `settings`: a settings save from an out-of-date form is refused and changes nothing - Step 3
- New capability `public-site`: public pages carry no entry ids or settings beyond the title, logo and menu - Step 4

## Notes

- `build` marks each finding `fixed` with its evidence as its step lands; a
  later `review` closes them, except P3s whose test was seen failing first.
- Step 2's carried list state goes through the list's existing query
  parser: never echo a raw query string into a redirect.
- Words follow design.md's carried-over conventions: errors in a
  `role="alert"` banner, plain language.
- The 13b spec is parked at `blueprint/drafts/13b-the-new-look.md`; `spec
  13b` restores it after this ships.

## Findings

### tidy-findings-backlog/F-136 [P2] closed - Deleting the only entry on the last page loses the "deleted" banner
File: app/features/content/post-list.tsx:43; app/features/content/page-list.tsx:48

**Found:** 2026-10-02 by review (independent `reviewer` agent; scope: current, tidy-findings; lens: all)
**Why it matters:** Regression from F-56 meeting F-61: the delete redirects to `?page=2&deleted=X`, the new past-the-last-page clamp redirects again to the last real page with no banner param, so the person gets no confirmation the delete happened. Before this item the banner always showed.
**Suggested fix:** In the clamp, read the banner with `readBanner(url.searchParams)` and carry it into the redirect through `bannerRedirect` (parsed, never the raw param). Add an e2e test that deletes the only row on page 2.
**Resolution:** Fixed 2026-10-02: list loaders read the banner before the past-the-last-page clamp and redirect through bannerRedirect. e2e F-136 tests (posts, pages) red before (no deleted= in URL), red again with the fix reverted, green restored. Closed by build.

### tidy-findings-backlog/F-137 [P2] closed - The pages "past the last page" test races other specs' pages (F-78's race again)
File: e2e/manage-pages.spec.ts:132-143

**Found:** 2026-10-02 by review (independent `reviewer` agent; scope: current, tidy-findings; lens: all)
**Why it matters:** An editor's pages list is not scoped by author, so under `workers: 2` pages from site-navigation, home-page, public-site and page-* specs appear in it and the exact `toHaveText(["Only two","Only one"])` fails; past 20 pages the URL check fails too. The posts version is safe (author-scoped).
**Suggested fix:** Search for a unique term: `/admin/pages?q=<random>&page=99`, expect the URL with that `q` and no `page`, assert the two rows.
**Resolution:** Fixed 2026-10-02: the test searches a unique term, expects the list URL with that q and no page, and exactly its two rows; passed --repeat-each=3 and in the full suite at 2 workers. Test-only, no red run; awaiting review.
Closed 2026-10-02 by review (current, delta 57f120d..61595c8, independent reviewer agent): e2e/manage-pages.spec.ts:132-145 searches a unique tag so other specs' pages cannot appear; the exact URL regex and two-row assertion still fail on a regression. Full suite 155 passed locally with real R2.

### tidy-findings-backlog/F-141 [P3] closed - The F-108 test's `not.toContain("navigation")` matches any visible text
File: e2e/public-site.spec.ts:85

**Found:** 2026-10-02 by review (independent `reviewer` agent; scope: current, tidy-findings; lens: all)
**Why it matters:** A future skip link or label containing the word "navigation" would fail the test without any data leaking.
**Suggested fix:** Assert on the serialized key, `'"navigation"'`, as for `homePageId`.
**Resolution:** Fixed 2026-10-02: asserts not.toMatch(/\\?"navigation\\?"/) - the suggested '"navigation"' never matches because React Router escapes the quotes in its serialized data. Mutation leaking only navigation: old assertion passed, new one failed; reverted. Closed by build.

### tidy-findings-backlog/F-142 [P3] closed - The F-107 e2e test leaves a home page set until `afterEach`
File: e2e/home-page.spec.ts:204-225

**Found:** 2026-10-02 by review (independent `reviewer` agent; scope: current, tidy-findings; lens: all)
**Why it matters:** Its siblings call `resetSiteSettings()` inline to keep the F-103 shared-row window short; this one does not.
**Suggested fix:** Call `await resetSiteSettings()` at the end of the test.
**Resolution:** Fixed 2026-10-02: the test calls resetSiteSettings() at its end. Test-only; awaiting review.
Closed 2026-10-02 by review (current, delta 57f120d..61595c8, independent reviewer agent): e2e/home-page.spec.ts:226 calls resetSiteSettings() at the test's end like its siblings; afterEach still covers a failed assertion.
