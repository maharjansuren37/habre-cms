# Feature: Render pages on the public site

**From build plan:** item 6b
**Type:** Feature
**Status:** built, verified, reviewed (F-85 repaired and closed); shipped

## Goal

Make a published page actually visible to a visitor. `/:slug` resolves a
published page and renders it in the built-in theme, the same as a post -
closing out item 6 (Pages) entirely. Item 6a already built the admin half; a
page created and published today is invisible until this ships.

## In scope

- `GET /:slug` - one published page: title and its blocks rendered through
  `renderBlocks`, same as `/posts/:slug`.
- A public-themed 404 for a missing or draft page, inside the existing
  `Chrome` (the public layout's `ErrorBoundary` already handles this for any
  route nested under it - no new error-handling code, just nesting the new
  route the same way).
- Reusing the type-agnostic contracts item 6a and earlier items already
  proved out: `findPublishedEntry("page", slug)`, `collectImageMediaIds` ->
  `findMediaByIds` -> `mediaById`, `renderBlocks`.
- A p95 measurement against the quality bar (< 500 ms, server-side),
  extending the existing timing test rather than writing a new one.

## Out of scope

- **A public index or listing of pages.** Nobody asked for one, and the plan
  names no such route - a page is reached only by its own address (or,
  later, item 7's navigation menu).
- **The navigation menu, site title or logo** - item 7 (`site_settings`).
  The header/footer stay the same fixed placeholder content pages already
  see on posts and the home page.
- **A byline (date + author).** See Decisions - this item deliberately does
  not reuse `post.tsx`'s meta line.
- **Anything about how a page is created, edited or its address chosen** -
  item 6a's own scope, already shipped.
- **Reserved-slug enforcement** - already done, at creation time (D68, item
  6a's `RESERVED_PAGE_SLUGS`). This item only has to trust that a page can
  never collide with `/admin`, `/posts`, `/healthz`, or a future `/api`.

## Design reference

No mockup exists for a page, and none is needed - `design.md`'s *Public
site* line ("article with date and author above the title; images full
column width with 12px radius and muted caption") already described the
typography, spacing and image treatment this item reuses verbatim from
`post.module.css`. The one place it did not apply is the byline, which was
written describing a post specifically (item 4b) - see Decisions; the line
was reworded as part of this item to say so. Treated as a low-risk extension
of an already-built screen, same framing item 5c used for the last
public-site addition.

## Build steps

- [x] **Step 1 - The page route, loader and component** - new
  `app/features/public-site/page.tsx` at `app/routes.ts`'s `:slug`, nested
  inside the existing public `layout(...)` array alongside `index` and
  `posts/:slug` (path depth keeps it from ever matching `/posts/...`,
  `/admin/...` or `/healthz` - those are registered as their own routes).
  Loader: `findPublishedEntry("page", params.slug)`, 404 via
  `data("Not Found", { status: 404 })` when there is none (draft and missing
  get the same answer, matching `post.tsx`); resolves any image blocks the
  same way `post.tsx` does (`collectImageMediaIds` -> `findMediaByIds` ->
  `mediaById`). Component: `<h1>` title, then `renderBlocks(page.blocks,
  mediaById)` - no meta line, no back link (Decisions). New
  `page.module.css`: the article/title/body/image/figure/figcaption rules
  copied from `post.module.css`, omitting `.meta` and `.back`. `meta()` sets
  the page `<title>` to `${page.title} - Habre CMS`.
  *Done when:* visiting a published page's URL shows its title and body with
  a heading, a list, and an image block (with caption) all rendered as real
  elements; visiting a draft page's URL or a slug matching no entry returns
  404 inside the public chrome ("Page not found.", not root's bare error
  page); `npm run verify` passes.

- [x] **Step 2 - Prove it, including the quality bar** - extend
  `e2e/public-site.spec.ts` (pages are public-site content, not a separate
  area): a published page with a heading, a list and an image block renders
  all three as real elements at `/:slug`; a draft page's slug and a
  nonexistent slug both 404 inside the public chrome; a page's title/body
  text saved with `<script>`-laden content renders escaped, never executes
  (same shape as the existing post XSS test). Add `/:slug` to the existing
  `measureP95` timing test alongside `/` and `/posts/:slug`.
  *Done when:* `npm run test:e2e` passes including the new tests, and the
  printed p95 for `GET /:slug` is under 500 ms - or, if it is not, that is
  reported honestly rather than asserted away.

- [x] **Step 3 - Repair F-85** - `design.md`'s *Public site* line still read
  as a blanket rule ("article with date and author above the title"), though
  this item's own Decisions committed to scoping it to posts specifically.
  Edited that one line to say the byline is posts-only and a page has none.
  *Done when:* the line names the distinction; nothing else in `design.md`
  changes.

## Files and areas

- `app/features/public-site/page.tsx` - new route (loader + component)
- `app/features/public-site/page.module.css` - new (copied from
  `post.module.css`, minus `.meta`/`.back`)
- `app/routes.ts` - add `route(":slug", "features/public-site/page.tsx")`
  inside the existing public layout array
- `e2e/public-site.spec.ts` - new page tests, extended timing test
- `blueprint/context/design.md` - one line reworded (F-85's repair)

## Data and contracts

None new. `findPublishedEntry(type, slug)` (D66) is already generic across
`EntryType`; `collectImageMediaIds`/`findMediaByIds`/`mediaById` and
`renderBlocks` (D60, D28) are already entry-type-agnostic. Reserved slugs
(D68) are enforced where pages are created, not here.

## Testing

- New Playwright tests in `e2e/public-site.spec.ts`, using the existing
  `createDraftFor(..., { type: "page" })` helper (already supports `"page"`,
  added for item 6a's own tests) - a published page renders its blocks
  including an image with caption; a draft/missing page 404s in the public
  chrome; script-laden text renders escaped. Extended the existing
  `measureP95` calls to cover `/:slug`.
- `npm run verify` - exit 0 (typecheck, Biome, 187 unit tests, build).
- `npm run test:e2e` - every page-related test passed in two independent
  full-suite runs (70/70 clean on one run; a second run hit the pre-existing
  F-78/F-86-class parallel-worker flake on two unrelated tests, not this
  item's own). `npx playwright test e2e/public-site.spec.ts
  e2e/manage-posts.spec.ts --workers=1` - 23/23 passed.
- Manual, done in `verify`: dev server seeded directly against the database -
  a published page screenshotted (title, h2, paragraph, bullet list, inside
  the real chrome, no byline, no back link) and a draft page's URL
  screenshotted (404, "Page not found.", inside the same chrome, not root's
  bare error page). Measured `GET /:slug` p95 across three separate runs:
  4.3ms, 3.5ms, 3.7ms - well under the quality bar's 500ms.
- No new unit-testable logic - `page.tsx` is a route module (`.tsx`,
  `node --test` cannot run it), same reason `post.tsx` and `render.tsx` are
  proven by browser tests only.
- Live keyboard/screen-reader verification of the public site (including
  this page) is still the pre-existing open `needs-you.md` line, widened by
  this item's own `spec` to name pages explicitly.

## Decisions

Recorded as D72, D73, D74 in `dev-notes/decisions.md`:

- **No byline (date/author) on a public page, unlike a post.** `design.md`'s
  "article with date and author above the title" was written for item 4b's
  post page specifically; it is not a rule this item is bound to repeat. A
  page (About, Contact) is static reference content, not a dated article -
  showing "12 March 2026 · Jane" under a page like "About" would be
  misleading, not helpful, and `ai-interaction.md`'s scope rule ("if the
  spec is wrong... fix the spec") is exactly why this was decided here
  rather than silently copied. `design.md`'s *Public site* line was reworded
  to say the byline applies to posts, not entries generally - part of this
  item's own diff (F-85's repair), not deferred.
- **The article CSS is copied into `page.module.css`, not extracted into a
  shared module.** `fundamentals.md`: "copy the second time, extract on the
  third." This is the second near-identical consumer of that typography
  (post.tsx was the first); if a third one shows up (a page builder's own
  content area is the likely candidate, per `project-overview.md`'s "the
  probable next big step"), that is when a shared `article.module.css` earns
  its place, not before.
- **No back link.** `post.tsx`'s "← All posts" makes sense because `/` is a
  list a reader came from. There is no equivalent list for pages (Out of
  scope), so there is nothing to link back to yet - revisit once item 7 adds
  a navigation menu.

## Notes

- Widened `needs-you.md`'s existing public-site screen-reader line to name
  pages explicitly, the same way item 6a widened the admin-side line.
- `render.tsx`'s exhaustive block-type `switch` is unchanged - this item
  added no new block type.
- Matches `coding-standards.md`: `#app/...` imports with extensions, no `~/`
  alias, route module named for what it shows.
- **Local `.env` blocker found and cleared during `build`:** the dev server
  and `npm run test:e2e` both refused to start because `.env` still carried
  the pre-item-4c `APP_URL` instead of `PUBLIC_URL`/`ADMIN_URL` - the open
  `needs-you.md` line for this had never actually been done locally, despite
  items 5a-6a's own archives claiming a passing `npm run test:e2e`. Fixed
  with the user's explicit go-ahead (both set to `http://127.0.0.1:3000`,
  `APP_URL` dropped); the `needs-you.md` line is now genuinely satisfied.
- **Item 6 (Pages) is now fully shipped** - 6a and 6b both checked off, so
  the parent line in `blueprint/build-plan.md` is checked too with this item.

## Findings

- **06b/F-85** [P2] closed - Item 6b's spec committed to updating
  `design.md`'s byline line "as part of this item's own diff" - the diff did
  not include it. Repaired by `build` (Step 3 above): `design.md`'s *Public
  site* line now scopes the byline to posts and names why a page has none.
  Closed by `review`, re-checked directly against the diff: only those three
  lines changed, nothing else in the file touched.
