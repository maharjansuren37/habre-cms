# Fix: public page titles name the site (F-116)

**Type:** Fix
**Status:** in progress

## Goal

Every public page's browser `<title>` shows the site title an admin set in
Settings (item 7a), not "Habre CMS". Visitors see the site's own name in tabs,
bookmarks and search results. Today production shows
`<title>Posts - Habre CMS</title>` on `/posts`, and a public 404 has **no
`<title>` at all**. Both were checked with `curl` against
`https://surenmaharjan.fyi` on 2026-09-29.

## In scope

- The `meta` functions of `home.tsx`, `post.tsx`, `page.tsx` and `posts.tsx`
  read `siteTitle` from the public layout's loader data (`matches`, id
  `features/public-site/layout`). "Habre CMS" is used only when that data is
  missing.
- The public layout gets a `meta` export, so error pages have a title.
  React Router cuts `matches` off at the error boundary, which is the layout
  (`getActiveMatches` in `Meta`, `lib/dom/ssr/components.js`). Neither root
  nor the layout has a `meta` today, which is why a 404 has no `<title>`.
- One pure helper that builds the title, with unit tests.
- One browser test proving it end to end.

## Out of scope

- **Admin titles.** "Habre CMS" is correct there, because the product is the
  CMS.
- **Moving to React 19's `<title>` element.** The installed docs recommend it
  over `meta` (`route-module.md` *meta*), but every route here uses `meta`.
  Switching is a refactor of its own, not part of this fix.
- **SEO fields** (description, Open Graph, canonical) are deferred in plan
  section 11.
- **F-103** (specs racing on the one `site_settings` row) stays open. See
  *Testing* for how this item avoids making it worse.

## Build steps

- [x] **Step 1 - Title helper** - add `app/features/public-site/public-title.ts`,
  exporting `publicTitle(matches, pageTitle?)`. It finds the match with id
  `features/public-site/layout` and reads `loaderData.settings.siteTitle`,
  falling back to `"Habre CMS"` when the match or its data is missing. It
  returns `"<pageTitle> - <siteTitle>"`, or just `siteTitle` when there is no
  page title. It has no runtime imports from `.tsx` or `.server.ts` files,
  so `node --test` can run it. Add `public-title.test.ts` beside it.
  *Done when:* `npm test` passes these cases: site title with no page title;
  page title + site title; layout match missing -> "Habre CMS"; layout match
  present with `loaderData` undefined -> "Habre CMS". Each case was seen
  failing before the helper existed.
- [x] **Step 2 - Route titles** - the four public `meta` functions call the
  helper: `home.tsx` gives the chosen page's title, or none for the
  placeholder. `post.tsx` gives the post title, `page.tsx` the page title and
  `posts.tsx` "Posts". The existing `?? "Post"` / `?? "Page"` fallbacks stay.
  *Done when:* `npm run verify` exits 0, and
  `npx playwright test e2e/home-page.spec.ts` passes. Its title assertions at
  lines 129 and 158 run with the default site title "Habre CMS", so they must
  hold unchanged.
- [x] **Step 3 - Error-page title** - `layout.tsx` exports `meta`. It returns
  `publicTitle(matches, "Page not found")` for a 404 and
  `publicTitle(matches, "Something went wrong")` for any other error, the same
  words `ErrorBoundary` shows. With no error it returns the site title alone.
  Child routes replace it, because the leaf's meta wins.
  *Done when:* `curl -s http://127.0.0.1:3000/no-such-slug` contains
  `<title>Page not found - <site title></title>`.
- [x] **Step 4 - Browser test** - add one test to
  `e2e/manage-settings.spec.ts`. This spec already changes the site title and
  already resets it in `afterEach`, so no new spec file writes
  `site_settings`. The test saves a unique site title through Settings, then
  checks `toHaveTitle` on: a published post (`<post> - <site>`), a published
  page (`<page> - <site>`), `/posts` (`Posts - <site>`), the placeholder `/`
  (`<site>`) and an unknown slug (`Page not found - <site>`). Then it
  restores the default.
  *Done when:* `npm run test:e2e` passes in full, the new test seen failing
  on `main`'s code first.

## Files and areas

- `app/features/public-site/public-title.ts` (new), `public-title.test.ts` (new)
- `app/features/public-site/home.tsx`, `post.tsx`, `page.tsx`, `posts.tsx` -
  `meta` only
- `app/features/public-site/layout.tsx` - new `meta` export only
- `e2e/manage-settings.spec.ts` - one test

## Data and contracts

None. No schema change. The layout loader's shape
(`{ settings: SiteSettings, navLinks }`) is read, not changed. The route id
`features/public-site/layout` is already used by `home.tsx`'s
`useRouteLoaderData`.

## Testing

- **Unit:** `npm test` (inside `npm run verify`, so CI runs it). This is the
  helper's logic, with no database.
- **Browser:** `npm run test:e2e`, run locally only, because it needs
  `docker compose up -d`. CI does not run it (F-17). This is the only proof
  that the real `<head>` carries the title.
- **F-103:** the new test goes in `manage-settings.spec.ts`, a file that
  already writes `site_settings`. `public-site.spec.ts` and `smoke.spec.ts`
  assert the default "Habre CMS" header link, and running alongside this test
  they could see the temporary title. That is the same race `manage-settings`
  already has, not a new one. If it flakes, the fix belongs to F-103.

## Decisions

- **The format is `<page title> - <site title>`**, the site title alone for
  `/`'s placeholder, and `<page title> - <site title>` for a chosen home page.
  This keeps today's separator and order and only changes the right-hand
  name. It beat "site title only on `/`", because a chosen home page already
  has its own title in the page's `<h1>`.
- **`meta` export over React 19's `<title>` element**: it matches every
  existing route and the admin side. It beat the docs' recommended element,
  which would be a project-wide refactor.
- **Error pages get a title from the layout's `meta`**, worded as the
  boundary's own body text.

## Production needs

None. No environment variables, migrations, or host changes. It takes effect
on the next `deploy`, alongside F-114 and F-115.

## Notes

- Imports: `#app/...` across directories, relative `./x.ts` within one, with
  the explicit extension. `import type` for the layout's `loader` type, so
  nothing runtime is pulled into the helper.
- `erasableSyntaxOnly`: no enums or namespaces.
- The layout's `ErrorBoundary` fallback settings already use `"Habre CMS"`.
  The helper's fallback should be the same literal, defined once in the
  helper.
