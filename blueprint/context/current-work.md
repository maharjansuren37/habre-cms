# Feature: Choose the home page

**From build plan:** item 9
**Type:** Feature
**Status:** in progress

## Goal

Today `/` on the public site always shows the latest posts, so a site cannot open
on a real landing page. An admin can now choose, in Settings, what `/` shows:
the latest posts (the default, unchanged) or one page. The post list gets its
own permanent address, `/posts`, so it stays reachable when a page takes `/`.

## In scope

- A nullable `site_settings.home_page_id` column (migration).
- A **Home page** control on `/admin/settings` (admin only, like the rest of
  the screen): "Latest posts" or any page.
- `/` renders the chosen page when it is set **and published**; otherwise the
  latest-posts list, exactly as today.
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
  Deleting it is already safe (D-1 falls back to the list); flagging it is
  polish.

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

- [ ] **Step 4 - `/posts` lists posts** - `route("posts",
  "features/public-site/posts.tsx")` in `app/routes.ts`, before `:slug`. Move
  today's list markup and `formatDate` out of `home.tsx` into a shared
  component in `public-site/` so `/` and `/posts` render the same list from one
  place. `posts` is already a reserved page slug (D68), so no page can be
  shadowed. Check `app/lib/host-routing.ts` treats `/posts` as a public path.
  *Done when:* `/posts` shows the 10 newest published posts (the empty state
  when there are none), `/posts/<slug>` still opens a post, and `/` is
  unchanged.

- [ ] **Step 5 - `/` renders the chosen page** - a
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

- [ ] **Step 6 - The home page's own address redirects to `/`** - in
  `page.tsx`'s loader, when the published page found is the current home page,
  `throw redirect("/")` (302). The redirect is temporary on purpose: the setting
  can change, and browsers cache permanent redirects indefinitely (the same
  reasoning as D22's host redirects). `findPublishedEntry` needs to return the
  id for the comparison. *Done when:* `curl -sI http://127.0.0.1:3000/<home-slug>`
  answers `302` with `Location: /`; any other page slug still answers 200; with
  the home page unpublished, its slug answers 404 as any draft does.

- [ ] **Step 7 - Browser test and the performance bar** - add
  `e2e/home-page.spec.ts`, covering the default list at `/`; choosing a page in
  Settings -> `/` shows it and `/posts` shows the list; `/<slug>` lands on `/`;
  unpublishing the page -> `/` shows the list again. Leave the setting back at
  "Latest posts" at the end so other specs see today's `/`. *Done when:*
  `npm run test:e2e` passes locally with the development database running,
  including the existing specs; and `/` with a home page set answers in under
  500 ms server-side (the quality bar's public-page number), measured with
  `curl -w '%{time_starttransfer}'` against `npm start` and recorded in
  `verify`'s report.

## Files and areas

- `db/migrations/<next>_site_settings_home_page.sql` - new
- `app/features/settings/settings.server.ts` - `homePageId` in `getSiteSettings`, `updateHomePage`
- `app/features/settings/settings-input.ts` (+ `.test.ts`) - `homePageIdSchema`
- `app/features/settings/settings.tsx` - the select, validation, round-trip
- `app/features/content/entries.server.ts` - `findHomePage`, `id` on `findPublishedEntry`'s result
- `app/features/public-site/home.tsx`, `page.tsx`, new `posts.tsx`, plus the shared post-list and page-body components they extract
- `app/features/public-site/layout.tsx` - fallback literal only
- `app/routes.ts` - `/posts`
- `e2e/home-page.spec.ts` - new

## Data and contracts

- **`site_settings.home_page_id`** - nullable, foreign key to `entries(id)`,
  `ON DELETE SET NULL`. **Load-bearing:** `null` means "latest posts", and
  that is the only encoding of the default. Always points at a `type = 'page'`
  row (enforced by the settings action, since a foreign key cannot check type).
- **`SiteSettings`** gains `homePageId: string | null`.
- **`/posts`** is now a real public URL, part of the public contract for
  links and nav items.
- **Home loader result:** `{ kind: "page"; page; mediaById } | { kind: "posts"; posts }`.

## Testing

- **Unit** (`npm test`, inside `verify`, runs in CI with no database):
  `homePageIdSchema` only. Nothing database-backed goes in `*.test.ts`.
- **Browser** (`npm run test:e2e`, **local only**, needs the development
  database; CI does not run it - that gap is F-17): `e2e/home-page.spec.ts`
  as in Step 7, plus the existing specs, which must still pass with the default.
- **Manual:** the curl checks in Steps 6 and 7.

## Decisions

- **D-1 One nullable column, `null` = latest posts.** It beat a separate
  `home_mode` column plus an id, which can disagree with each other, and storing
  a slug, which breaks when a page is renamed. `ON DELETE SET NULL` makes
  deleting the page a safe fallback with no extra code.
- **D-2 An unpublished home page falls back to the post list, never a 404.**
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

## Production needs

- **Migration:** `<next>_site_settings_home_page.sql`. Additive and nullable:
  the previous release never reads the column, so rolling back by symlink
  still works after it is applied.
- No new environment variables, services or host settings.

## Notes

- Raw SQL, no ORM; imports `#app/...` with extensions; `*.server.ts` for
  anything touching the database (coding-standards.md).
- Keep `/` working without JavaScript: all server-rendered, as today.
- Don't add a second settings query to public requests if avoidable:
  `findHomePage` is one joined query, and the layout already reads the settings
  row for the header.
- Screen-reader pass for the new select is added to the existing admin-shell
  line in `needs-you.md`, not a new line.
