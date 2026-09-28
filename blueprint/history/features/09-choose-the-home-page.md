# Feature: Choose the home page

**From build plan:** item 9
**Type:** Feature
**Status:** in progress

## Goal

Today `/` on the public site always shows the latest posts, so a site cannot open
on a real landing page. **`/` is now always a landing page** (D-12): the page an
admin chooses in Settings, or a welcome placeholder until one is chosen and
published. Posts are an add-on with their own permanent address, `/posts`.

## In scope

- A nullable `site_settings.home_page_id` column (migration).
- A **Home page** control on `/admin/settings` (admin only, like the rest of
  the screen): "No home page" or any page.
- `/` renders the chosen page when it is set **and published**; otherwise a
  welcome placeholder, never the post list.
- A new public route `/posts`: the latest-posts list, always.
- The chosen page's own address (`/<slug>`) redirects to `/` (302).

## Out of scope

- Choosing a **post** as the home page - pages only.
- Pointing a nav item at the home page renders `/<slug>`, which then redirects;
  resolving it straight to `/` is a later polish, not needed for correctness.
- Pagination on `/posts` (still the 10 newest, item 4b's D-1).
- SEO: canonical tags, sitemap - deferred with SEO fields (plan section 11).
- The admin's own `/admin` -> `/admin/posts` redirect - unrelated.
- A warning on the page list or delete screen that a page is the home page.
  Deleting it is already safe (D-1 falls back to the placeholder); flagging it
  is polish.
- Switching posts off entirely (no Posts in admin, `/posts` a 404) - a later
  item if wanted, not this one.
- Creating a "Home" page automatically on install - the placeholder covers a
  site with no page yet, with no write to real data.

## Design reference

No new component and no new state. The control is a `<select>` with the same
markup and classes as a navigation row's "Existing page" select
(`settings.tsx:240-256`, `settings.module.css` `.selectField` / `.select` /
`.navHint`), with the same "Not published" hint. The public side reuses the
existing page and post-list rendering unchanged. `design.md` was not re-read
for this spec: Step 3 checks it names nothing that contradicts reusing these
controls.

## Build steps

- [x] **Step 1 - Migration: `site_settings.home_page_id`** - the next numbered
  file in `db/migrations/`: `alter table site_settings add column home_page_id
  <entries.id's type> references entries(id) on delete set null;` (nullable, no
  default, so every existing install keeps today's behaviour). Built with
  `migrate`. *Done when:* `npm run db:migrate` applies it on the development
  database, `\d site_settings` shows the column and its foreign key with
  `ON DELETE SET NULL`, the existing row reads `null`, and running the migrator
  a second time applies nothing.

- [x] **Step 2 - Read and write the setting** - `getSiteSettings` returns
  `homePageId: string | null`. A new `updateHomePage(pageId: string | null)` in
  `settings.server.ts`, a sibling of `updateSiteIdentity` / `updateNavigation`
  (F-40's split - it touches only its own column). A `homePageIdSchema` in
  `settings-input.ts` (the form's `""` means `null`, anything else must be a
  well-formed id), unit-tested in `settings-input.test.ts`. Update the two
  fallback literals that spell out a `SiteSettings` (`settings.tsx:113`,
  `public-site/layout.tsx:103`). *Done when:* `npm run verify` passes, including
  new tests that `""` parses to `null`, a valid id passes through, and a
  malformed id is refused.

- [x] **Step 3 - The Home page control on Settings** - a "Home page" select
  above Navigation: first option "Latest posts" (value `""`), then every page
  from `listPagesForNav()` (already loaded). A chosen page that is not
  published shows the hint "Not published - visitors see the latest posts until
  it is." The Save action validates it with `homePageIdSchema`, then checks the
  id is in the loaded page list, **not just well-formed**: the foreign key
  cannot tell a page from a post, and a deleted id would otherwise reach the
  database as an unhandled 23503 (F-89's pattern). On failure it returns 400
  with "That home page could not be saved. Choose it again.", keeping the
  typed title and nav rows. Add/remove/move nav round trips must keep the
  selected value (carry it in `ActionResult` like `siteTitle`). *Done when:* as
  an admin, choosing a page and saving shows "Settings updated." and the select
  shows that page after reload; choosing "Latest posts" saves `null`; a forged
  post id or random UUID gets the 400 message and nothing is saved; an editor
  requesting `/admin/settings` still gets 404.

- [x] **Step 4 - `/posts` lists posts** - `route("posts",
  "features/public-site/posts.tsx")` in `app/routes.ts`, before `:slug`. Move
  today's list markup and `formatDate` out of `home.tsx` into a shared
  component in `public-site/` so `/` and `/posts` render the same list from one
  place. `posts` is already a reserved page slug (D68), so no page can be
  shadowed. Check `app/lib/host-routing.ts` treats `/posts` as a public path.
  *Done when:* `/posts` shows the 10 newest published posts (the empty state
  when there are none), `/posts/<slug>` still opens a post, and `/` is
  unchanged.

- [x] **Step 5 - `/` renders the chosen page** - a
  `findHomePage()` in `entries.server.ts`: **one query** joining `site_settings`
  to `entries` on `home_page_id`, returning the entry only when it is a
  published page. `home.tsx`'s loader returns either `{ kind: "page", ... }`
  (the page plus its resolved images, the same media lookup `page.tsx` does)
  or `{ kind: "posts", posts }`. Extract the page body rendering `page.tsx`
  uses so both routes share it rather than copying it. `meta` uses the page's
  title when a page is shown, as `page.tsx` does, and today's title otherwise.
  *Done when:* with no home page set, `/` renders the same list and title as
  today; with a published page set, `/` shows that page's title and blocks,
  including images, and the tab title is the page's; with the
  chosen page unpublished, `/` falls back to the list, not a 404; after that
  page is deleted, the setting reads `null` and `/` shows the list.

- [x] **Step 6 - The home page's own address redirects to `/`** - in
  `page.tsx`'s loader, when the published page found is the current home page,
  `throw redirect("/")` (302). The redirect is temporary on purpose: the setting
  can change, and browsers cache permanent redirects indefinitely (the same
  reasoning as D22's host redirects). `findPublishedEntry` needs to return the
  id for the comparison. *Done when:* `curl -sI http://127.0.0.1:3000/<home-slug>`
  answers `302` with `Location: /`; any other page slug still answers 200; with
  the home page unpublished, its slug answers 404 as any draft does.

- [x] **Step 7 - Browser test and the performance bar** - add
  `e2e/home-page.spec.ts`, covering the default list at `/`; choosing a page in
  Settings -> `/` shows it and `/posts` shows the list; `/<slug>` lands on `/`;
  unpublishing the page -> `/` shows the list again. Leave the setting back at
  "Latest posts" at the end so other specs see today's `/`. *Done when:*
  `npm run test:e2e` passes locally with the development database running,
  including the existing specs; and `/` with a home page set answers in under
  500 ms server-side (the quality bar's public-page number), measured with
  `curl -w '%{time_starttransfer}'` against `npm start` and recorded in
  `verify`'s report.

- [x] **Repair F-105 - A post's "All posts" link goes to `/`, which is no
  longer the post list once a home page is set** -
  `post.tsx`'s back link points at `/posts` (D-3: always the list). *Done
  when:* a browser test that sets a home page, opens a post and clicks "All
  posts" lands on `/posts` showing the list; it fails with the link at `/`.

- [x] **Repair F-106 and F-109 - the home page is written first, and a refused
  save is shown to change nothing** -
  `updateHomePage` runs before the other two writes and returns `false` on the
  foreign key's 23503 (the page was deleted after the check). The action turns
  that into the existing 400 with nothing written. The "friendly 400" browser
  test also asserts the site title is unchanged. *Done when:* `updateHomePage`
  with a deleted id returns `false` instead of throwing, and the browser test
  fails when the title write is moved above the home-page check.

- [x] **Repair F-110 (and finish F-106) - Save is all or nothing** - the three settings writes run in one transaction
  (`saveSiteSettings`, D-11). A logo or home page deleted between the action's
  checks and the write rolls the whole save back and returns that check's
  existing 400. The false comment goes. *Done when:* a probe with a deleted
  logo, and one with a deleted home page, each leaves the row exactly as it was
  and reports which one went, where the previous code saved part of it.

- [x] **Step 8 - `/` shows a welcome placeholder, never the post list** (D-12) -
  when `findHomePage()` returns nothing, `home.tsx`'s loader returns
  `{ kind: "placeholder", hasPosts }` instead of the post list. `hasPosts` is a
  new `hasPublishedPosts()` in `entries.server.ts`: one `select exists(...)`
  query, run only on this fallback, so a page at `/` costs no extra query. The
  placeholder is a `<main>` with the site title as its `h1` (the layout's
  settings, via `useRouteLoaderData` - no second settings read), the line
  "This site is being set up.", and, only when `hasPosts`, a "Read the posts"
  link to `/posts`. It reuses `PostList`'s `.home` / `.empty` classes rather
  than adding a new look. `meta` stays "Habre CMS" for the placeholder.
  *Done when:* with no home page, with the chosen page unpublished, and after
  it is deleted, `/` answers 200 with the placeholder and no post list; the
  "Read the posts" link appears only when a post is published; a published
  home page still renders as in Step 5; and `/` still works without
  JavaScript.

- [x] **Step 9 - Settings says what the default now is** - the select's first
  option "Latest posts" becomes "No home page" (value still `""`); the hint
  becomes "Not published - visitors see a placeholder until it is."
  `PostList`'s comment stops saying `/` uses it. *Done when:* `npm run verify`
  passes and the Settings screen shows the new option and hint.

- [x] **Step 10 - The browser tests follow the new default** -
  `home-page.spec.ts`: the default and unpublished cases expect the
  placeholder at `/` and the list at `/posts`, and "switch back" selects
  "No home page". `public-site.spec.ts`: its two `/` list tests (ordering and
  "Nothing has been published yet.") move to `/posts`, plus one test that `/`
  shows the placeholder. Check every other spec that visits `/`
  (`smoke`, `manage-settings`, `site-navigation`, `content-security-policy`,
  `image-block`, `manage-pages`) for anything that assumed the list is there.
  *Done when:* `npm run test:e2e` passes locally with the development
  database running.

## Files and areas

- `db/migrations/<next>_site_settings_home_page.sql` - new
- `app/features/settings/settings.server.ts` - `homePageId` in `getSiteSettings`, `updateHomePage`
- `app/features/settings/settings-input.ts` (+ `.test.ts`) - `homePageIdSchema`
- `app/features/settings/settings.tsx` - the select, validation, round-trip
- `app/features/content/entries.server.ts` - `findHomePage`, `id` on `findPublishedEntry`'s result, `hasPublishedPosts` (Step 8)
- `app/features/public-site/home.tsx`, `page.tsx`, new `posts.tsx`, plus the shared post-list and page-body components they extract; the placeholder (Step 8)
- `app/features/public-site/layout.tsx` - fallback literal only
- `app/routes.ts` - `/posts`
- `e2e/home-page.spec.ts` - new; `e2e/public-site.spec.ts` and any other spec that assumed the list at `/` (Step 10)

## Data and contracts

- **`site_settings.home_page_id`** - nullable, foreign key to `entries(id)`,
  `ON DELETE SET NULL`. **Load-bearing:** `null` means "no home page chosen"
  (the placeholder at `/`), and that is the only encoding of the default. Always points at a `type = 'page'`
  row (enforced by the settings action, since a foreign key cannot check type).
- **`SiteSettings`** gains `homePageId: string | null`.
- **`/posts`** is now a real public URL, part of the public contract for
  links and nav items.
- **Home loader result:** `{ kind: "page"; page; mediaById } | { kind: "placeholder"; hasPosts }`
  (was `{ kind: "posts"; posts }` before D-12).

## Testing

- **Unit** (`npm test`, inside `verify`, runs in CI with no database):
  `homePageIdSchema` only. Nothing database-backed goes in `*.test.ts`.
- **Browser** (`npm run test:e2e`, **local only**, needs the development
  database; CI does not run it - that gap is F-17): `e2e/home-page.spec.ts`
  as in Step 7, plus the existing specs, which must still pass with the default.
- **Manual:** the curl checks in Steps 6 and 7.

## Decisions

- **D-1 One nullable column, `null` = no home page chosen** (revised by D-12;
  it first meant "latest posts"). It beat a separate
  `home_mode` column plus an id, which can disagree with each other, and storing
  a slug, which breaks when a page is renamed. `ON DELETE SET NULL` makes
  deleting the page a safe fallback with no extra code.
- **D-2 An unpublished home page falls back to the placeholder, never a 404**
  (revised by D-12; it first fell back to the post list).
  The site's front door never breaks because someone unpublished a page. It
  beat 404ing, which is correct for a URL but wrong for the root of the site.
- **D-3 `/posts` always lists posts, whatever the setting.** One stable address
  for the list. It beat creating `/posts` only when a page is chosen, which
  makes links to it break the moment an admin switches back.
- **D-4 The home page's own slug redirects to `/`, temporarily (302).** One
  address per page. Temporary because the setting can change.
- **D-5 A draft page can be chosen, with a hint.** This matches the navigation
  editor (item 7b): an admin can set things up before publishing, and D-2
  keeps visitors safe meanwhile.
- **D-6 Pages only, checked in the action.** A post has a date and byline and
  belongs in the list. The foreign key cannot enforce the type, so the save
  validates against the page list.

- **D-7 `isHomePage` rides on `findPublishedEntry`'s own query** (a subquery
  on `site_settings`), not a second settings read in `page.tsx`. That keeps
  `/:slug` at one entry query, as the Notes ask. It returns `id` as well, as
  Step 6 said.
- **D-8 The image lookup moved into `public-site/page-media.server.ts`**
  (`resolvePageMedia`), shared by `/` and `/:slug`. `post.tsx` was outside
  this spec's files and keeps its own copy (F-104).
- **D-9 `/posts` is titled "Posts - Habre CMS"**, following the
  "<name> - Habre CMS" pattern the other public routes use.
- **D-10 The "Not published" hint is tied to the select with
  `aria-describedby`**, so a screen reader announces it with the control. The
  nav rows' hint is not tied this way; this one is new, so it gets it.
- **D-11 The settings Save is one transaction** (`saveSiteSettings`). The
  three writes all touch the one `site_settings` row, but a logo or home page
  deleted mid-save made the save half-apply (F-106, F-110), and no order of
  writes avoids that for both. It is the app's first transaction outside the
  migrator. It is still a single-row change, so the plan's "every v1 action is
  a single-row write" holds. The three single-column functions stay separate
  (F-40) and take the transaction.
- **D-12 Page-first: `/` never lists posts** (owner's call, 2026-09-29). The
  landing page is always `/`; posts are an add-on at `/posts`. With no
  published home page, `/` shows a welcome placeholder (site title, "This site
  is being set up.", a link to `/posts` when posts exist). It beat keeping the
  post list as the default (WordPress's model), which makes posts what a
  visitor sees until someone changes a setting, and auto-creating a "Home"
  page, which needs a write to production's real data. Cost: production's `/`
  changes from the post list to the placeholder at deploy, until the owner
  chooses a page (`needs-you.md`).

## Production needs

- **Migration:** `<next>_site_settings_home_page.sql`. Additive and nullable:
  the previous release never reads the column, so rolling back by symlink
  still works after it is applied.
- No new environment variables, services or host settings.
- **Visible change at deploy (D-12):** production's `/` switches from the post
  list to the placeholder until the owner chooses a home page in Settings -
  recorded in `needs-you.md`.

## Notes

- Raw SQL, no ORM; imports `#app/...` with extensions; `*.server.ts` for
  anything touching the database (coding-standards.md).
- Keep `/` working without JavaScript: all server-rendered, as today.
- Don't add a second settings query to public requests if avoidable:
  `findHomePage` is one joined query, and the layout already reads the settings
  row for the header.
- Screen-reader pass for the new select is added to the existing admin-shell
  line in `needs-you.md`, not a new line.

## Verification at ship

Run 2026-09-29 by `ship`, because no separate `verify` report existed for this item:

- `npm run verify`: passed. `npm run test:e2e`: 99 passed (1.1 min), with the development database running.
- Production build (`npm start`), curl, no JavaScript, and throwaway entries removed afterwards:
  - No home page, no posts: `/` 200, placeholder shown, no "Read the posts" link.
  - No home page, one published post: `/` 200, placeholder shown with `<a href="/posts">Read the posts</a>`, no post list.
  - Published home page set: `<title>Ship Probe Home - Habre CMS</title>`. Time to first byte on `/` was 2.9-4.8 ms over 5 runs (bar: 500 ms). `/<home-slug>` returned `302` with `location: /`. Another page's slug returned 200. `/posts` and `/posts/<slug>` both returned 200.
  - Home page unpublished: `/` showed the placeholder, and its slug returned 404.
  - Home page deleted: `home_page_id` read `null`, and `/` returned 200 with the placeholder.

## Findings

### 9/F-105 [P1] closed - A post's "All posts" link goes to `/`, which is no longer the post list once a home page is set


**File:** app/features/public-site/post.tsx:51 (`<Link className={styles.back} to="/">`)
**Found:** 2026-09-28 by review (scope: current; lens: quality; independent reviewer)
**Why it matters:** The item's goal is that the post list "stays reachable when a page takes `/`". With a home page chosen, a post's "All posts" link, the only in-page way back to the list, lands on the landing page instead, and the link's text no longer describes where it goes. Path: set a home page, open any `/posts/<slug>`, click "All posts", and you are on the page, not the list.
**Suggested fix:** Change it to `to="/posts"` (D-3: always the list). Add an assertion in `e2e/home-page.spec.ts` that clicks it while a home page is set, and see it fail against `to="/"` first.
**Resolution:** Repaired by build, 2026-09-28: `post.tsx`'s back link now points at `/posts`. Test: `e2e/home-page.spec.ts` "with a home page set, a post's All posts link still leads to the post list (F-105)". It failed with the link at `/` (received `http://127.0.0.1:3100/`) and passed with the repair; full `npm run test:e2e` gave 98/98. `fixed`, awaiting re-review. Re-reviewed 2026-09-28 by review (independent reviewer): closed. `post.tsx:51` now points at `/posts`, and no other spec depended on the old target. The test goes down the failing path: `to="/"` lands on `/` and fails `toHaveURL(/\/posts$/)`. Setting the home page through SQL is acceptable, since the defect is in the post's link and the Save path has its own tests. No state is left behind.

### 9/F-106 [P3] closed - The Save writes the title before the home page, so a home page deleted mid-save gives a 500 and a half-applied save


**File:** app/features/settings/settings.tsx:132-134
**Found:** 2026-09-28 by review (scope: current; lens: quality; independent reviewer)
**Why it matters:** The id is checked against `listPagesForNav()` and then saved in a separate update. If the page is deleted between the check and the write, the foreign key raises an unhandled 23503: the user sees a 500, the title and logo are already saved, and navigation is not. The window is narrow, and the logo already has the same race. (OWASP Top 10:2025 A10.)
**Suggested fix:** Call `updateHomePage` first, so a 23503 leaves nothing written. Catch 23503 there and return the existing 400 "That home page could not be saved" response.
**Resolution:** Repaired by build, 2026-09-28. `updateHomePage` now runs before `updateSiteIdentity` and `updateNavigation`, and returns `false` on `23503` from `site_settings_home_page_id_fkey`. The action turns that into the existing 400 with nothing written. Evidence: a throwaway probe calling `updateHomePage` with an id no entry has (the same database error as a page deleted mid-save). Before the repair it threw `23503 site_settings_home_page_id_fkey`; after, it returned `false`. The stored value was `null` both times. No committed test covers the race window itself, so this stays `fixed` for `review`. Re-reviewed 2026-09-28 by review (independent reviewer): kept `fixed`, not closed. The 23503 catch is correct (it filters on code and constraint name, and matches `users.server.ts`'s precedent), and returning a success flag from a command is acceptable under fundamentals.md:45. But the reorder moves the half-applied save onto the logo foreign key's race; see F-110. Close both on the same pass once F-110 is repaired. Superseded 2026-09-28 by F-110's repair (D-11): the save is now one transaction, so the write order no longer matters; `updateHomePage` returns nothing again, and the 23503 handling lives in `saveSiteSettings`.
Re-examined 2026-09-29 by review (scope: current; all lenses): **closed**, with F-110. The Save now runs as one transaction (`saveSiteSettings`, settings.server.ts:91-110), so a home page deleted mid-save rolls every write back and the action returns the existing 400 (settings.tsx:132-153). Write order no longer matters. `npm run verify` passed; `npm run test:e2e` 99 passed.

### 9/F-109 [P3] closed - The "nothing is saved" browser test checks only `home_page_id`


**File:** e2e/home-page.spec.ts:89-106
**Found:** 2026-09-28 by review (scope: current; lens: tests; independent reviewer)
**Why it matters:** The test posts `siteTitle: "Doesn't matter"` with a bad home page id. If a regression moved the writes above the home-page check, the title would be saved and the test would still pass, although Step 3's done-when says "nothing is saved". Relevant to F-106's fix, which reorders exactly those writes.
**Suggested fix:** After the loop, also assert that `site_title` is unchanged.
**Resolution:** Repaired by build, 2026-09-28. The "friendly 400" test in `e2e/home-page.spec.ts` now also asserts that `site_title` is unchanged. Seen failing: with `updateSiteIdentity` moved above the home-page check, the new test failed (expected "Habre CMS", received "Doesn't matter") while the old version passed. With the code restored, 6/6 passed. Full `npm run test:e2e` gave 98/98. Closed by build. Re-examined 2026-09-28 by review (independent reviewer): the close is sound. The new `site_title` assertion also reads a column `manage-settings.spec` writes, which adds to F-103's reach.

### 9/F-110 [P3] closed - Writing the home page first moves the half-applied save onto the logo race, and the new comment says that race doesn't exist


**File:** app/features/settings/settings.tsx:132-133 (comment), :145 (`await updateSiteIdentity(...)`)
**Found:** 2026-09-28 by review (scope: current, re-review of the F-105/F-106/F-109 repairs; lens: quality; independent reviewer)
**Why it matters:** `logo_media_id` is also a foreign key (`0005_site_settings.sql:11`), and `updateSiteIdentity` does not catch `23503`. A logo deleted between F-89's check and the write used to give a 500 with nothing saved. After F-106's reorder it gives a 500 with the new home page saved but not the title or navigation. The comment "the other two writes have no such race left to lose" is false. (OWASP Top 10:2025 A10.)
**Suggested fix:** Have `updateSiteIdentity` catch `23503` on `site_settings_logo_media_id_fkey` and return `false`, and have the action return the existing "That logo could not be saved" 400. Order the writes identity, then home page, then navigation, so either catch leaves nothing written; navigation has no foreign key. Correct the comment. A transaction would go against D4 and F-40's split.
**Resolution:** Repaired by build, 2026-09-28 (D-11): the settings Save runs as one transaction (`saveSiteSettings`), so either foreign key's refusal rolls the whole save back and returns that check's existing 400. The false comment is gone. Evidence, from a throwaway probe against the dev database: F-106's code with a deleted logo threw `23503` and left `home_page_id` set while the title was not. `saveSiteSettings` returned `logo-gone` for a deleted logo and `home-page-gone` for a deleted page, and left the row unchanged both times. `npm run verify` exit 0; `npm run test:e2e` 98/98. No committed test covers the race itself, so this stays `fixed` for `review`.
Re-examined 2026-09-29 by review (scope: current; all lenses): **closed**. `sql.begin` wraps all three writes; a 23503 on either `site_settings_logo_media_id_fkey` or `site_settings_home_page_id_fkey` rejects the transaction, and `saveSiteSettings` maps it to `logo-gone` / `home-page-gone`. Anything else is rethrown. The action answers with the same 400 message and shape as its own pre-checks. The false comment is gone. Nothing new introduced: the transaction is recorded as D-11, and `isForeignKeyViolation` copies `users.server.ts:137-145`, which is two call sites (the project's own line for copying rather than extracting). The race itself still has no committed test, because the project keeps database-backed code out of `*.test.ts`. The build's probe is the evidence.
