# Feature: Render the public site

**From build plan:** item 4b
**Type:** Feature
**Status:** built, verified, F-66/F-67/F-68 repaired and closed (F-69 found but left open, unrelated scope); shipped

## Goal

Make a published post actually visible to a visitor: a home page listing the
newest published posts, one page per post, and a public-themed 404 for
anything else - still on the single existing hostname (the split to
`surenmaharjan.fyi` is item 4c). This is what makes item 4a's Publish button
mean something outside the admin.

## In scope

- `GET /` - the newest published posts, title and date, newest first.
- `GET /posts/:slug` - one published post: title, date, author, and its
  blocks rendered as real HTML through JSX (never an HTML-building helper -
  D26/D28).
- A shared public site chrome (header with the site brand, footer) wrapping
  both, and its own themed 404 for a missing or draft post.
- A block renderer (`app/features/blocks/render.tsx`) for the three block
  types that exist today: text, heading (h2/h3), list (bullet/number) - with
  inline bold/italic/link runs rendered as real `<strong>`/`<em>`/`<a>`,
  never `dangerouslySetInnerHTML`.
- A real p95 measurement against the quality bar's own number (< 500 ms,
  server-side) for both routes, against the production build.

## Out of scope

- **`/:slug` for pages** - item 6. No page content exists yet to serve.
- **The hostname split, `PUBLIC_URL`/`ADMIN_URL`, Caddy/DNS** - item 4c. Both
  routes below ship on the single existing hostname, same as everything else
  today.
- **A real site title, logo or navigation menu** - item 7 (`site_settings`).
  See Decisions: the header/footer show fixed placeholder content until then.
- **Image blocks** - `blocks.ts` has no image block type yet (item 5); the
  renderer only has three block types to handle because that is all that
  exists.
- **Pagination, an RSS feed, or a sitemap on the public home** - nobody asked
  for them yet, and SEO/sitemap is already deferred (`project-plan.md`
  section 11).
- **Caching rendered pages** - `architect`'s own note names this as the first
  fix *if* the performance bar is missed, not a default to reach for now
  (`project-plan.md`, Scaling ceiling).

## Design reference

`prototypes/public-post.html` - a real, built mockup of the post page: header
(brand + nav), the article (meta line, title, body typography, a
`article-back` link), footer. Token classes throughout (`--measure`,
`--text-lg`, `--leading-reading`, `--text-3xl`) already exist in `app/app.css`
and are otherwise **unused in the real app today** - this item is their first
real consumer. **The home page and the 404 page have no mockup** - `design.md`
explicitly leaves the 404 "not mocked." Both are treated as low-risk
extensions of the same chrome (same header/footer, same tokens) rather than a
new visual pattern, and are specified directly below rather than invented
freely. Port the header/nav/article/footer CSS from the mockup's `<style>`
block into real CSS Modules as the first build step, the same way item 1
ported `theme.css`.

## Build steps

- [x] **Step 1 - Public queries and the block renderer** -
  `entries.server.ts` gets two new functions, `listPublishedPosts(limit)`
  (title, slug, `published_at`, ordered `published_at desc` - see Decisions)
  and `findPublishedPost(slug)` (title, blocks, `published_at`, author name,
  scoped to `type = 'post' and status = 'published'`). New
  `app/features/blocks/render.tsx` exports `renderBlocks(blocks)` and
  `renderRuns(runs)`: text -> `<p>`, heading -> `<h2>`/`<h3>` by `level`, list
  -> `<ul>`/`<ol>` by `style`; each run's marks nest as
  `<a><strong><em>{text}</em></strong></a>` (only the marks present). No
  route uses either yet.
  *Done when:* `npm run verify` passes; no visible behavior change (nothing
  calls the new code yet).

- [x] **Step 2 - The public chrome and the home page** -
  New `app/features/public-site/layout.tsx` (+ `layout.module.css`, ported
  from the mockup): header with a fixed "Habre CMS" brand link to `/`, no nav
  list yet (D-2, mirrors how the admin shell handled its own pre-nav gap);
  footer with the same fixed text. Wraps `index` and the new post route in
  `app/routes.ts`. `home.tsx` replaces its placeholder: lists the newest 10
  published posts (D-1) via `listPublishedPosts`, each title linking to
  `/posts/:slug` with its date (`<time>`, UTC-formatted - see Decisions); an
  empty state (plain text, no posts yet) when there are none.
  *Done when:* with two published posts and one draft seeded directly in the
  database, `/` shows only the two published ones, newest first, each title
  linking to its own `/posts/:slug`; with zero published posts, `/` shows the
  empty message instead of a blank page.

- [x] **Step 3 - The post page and its 404** -
  New `app/features/public-site/post.tsx` at `posts/:slug`
  (`post.module.css` for the article typography, ported from the mockup):
  renders the title as the page's one `<h1>`, a meta line (date + author),
  and the body via `renderBlocks`. A slug that matches no post, or matches a
  draft, throws a 404 - caught by the public layout's own `ErrorBoundary`
  (plain "Page not found" text, inside the same header/footer chrome), not
  root's generic one. A completely unmatched path (no `/:slug` route exists
  until item 6) still falls through to root's existing plain error boundary -
  unthemed, and out of scope until pages exist.
  *Done when:* visiting a published post's URL shows its title, date, author,
  and body with a heading, a list, and bold/italic/link formatting all
  correctly rendered as real elements (inspect the DOM, not the source text);
  visiting a draft's URL or a nonexistent slug returns 404 inside the public
  chrome, not root's bare "404" page.

- [x] **Step 4 - Prove it, including the quality bar** -
  New `e2e/public-site.spec.ts`: home lists only published posts, newest
  first; a post with `<script>`-laden text saved through the editor renders
  escaped, never executes (same shape as `write-post.spec.ts`'s existing XSS
  check); a draft's slug 404s inside the public chrome. Add a small timing
  measurement (20+ requests each) against the production build for `GET /`
  and `GET /posts/:slug`, computing p95 server-side and asserting it is under
  500 ms (`quality-bar.md`).
  *Done when:* `npm run test:e2e` passes including the new spec, and the
  measured p95 for both routes is printed and under 500 ms - or, if it is
  not, that is reported honestly rather than asserted away.

## Files and areas

- `app/features/content/entries.server.ts` - `listPublishedPosts`,
  `findPublishedPost`
- `app/features/blocks/render.tsx` - new
- `app/features/public-site/layout.tsx`, `layout.module.css` - new
- `app/features/public-site/home.tsx`, `home.module.css` - replaced/new
- `app/features/public-site/post.tsx`, `post.module.css` - new
- `app/routes.ts` - wraps `index` and the new `posts/:slug` in the public
  layout
- `e2e/public-site.spec.ts` - new

## Data and contracts

- No schema change - `status`, `published_at`, `slug` already exist.
- The renderer's block-type switch is exhaustive over today's three types
  (`text`, `heading`, `list`); adding a fourth (image, item 5) is a change to
  this file, not a new one - load-bearing for item 5.
- `findPublishedPost`/`listPublishedPosts` are the only public-facing reads;
  neither takes an `Actor` - there is no ownership scoping on the public
  site, only a `status = 'published'` filter.
- `renderBlocks`/`renderRuns` take a plain `Block[]`/`Run[]`, not an `Entry` -
  entry-type-agnostic on purpose, so item 6 (pages) reuses the same renderer
  rather than a second one.

## Testing

- No unit test for the new server functions (DB-backed, matches every
  sibling in `entries.server.ts`) or for `render.tsx` (JSX - `node --test`
  cannot run `.tsx`, matches `editor.client.tsx`'s own precedent). Both are
  covered by `e2e/public-site.spec.ts`.
- `npm run verify` for everything else.
- F-17 still applies (unchanged by this item): these browser tests do not
  run in CI yet, only locally.

## Decisions

- **D-1: the home page shows the newest 10 published posts, no pagination.**
  Beats matching the admin list's `PAGE_SIZE` (20) - a different concern with
  no reason to be coupled to it - and beats building pagination nobody asked
  for at this scale (`quality-bar.md`: a few thousand entries, not a few
  thousand *published and read every day*).
- **D-2: the public header and footer show fixed text ("Habre CMS"), no nav,
  until item 7 wires up `site_settings`.** Mirrors the admin shell's own
  precedent (`design.md`: "before navigation exists... shows 'Habre CMS'...
  no nav list until the first admin section ships"). Beats inventing a
  placeholder nav or a fake site title now.
- **D-3: posts are ordered by `published_at desc`, not `updated_at desc`.**
  Beats reusing `listEntries`'s admin ordering, which would let an unrelated
  copy-edit silently reorder the public home - the public list should reflect
  when something became public, not when it was last touched.
- **D-4: public dates are formatted with an explicit `timeZone: "UTC"`.**
  `post-list.tsx`'s admin date formatter has no explicit zone and is on
  record as a bug (F-55: server/client locale mismatch, a hydration
  mismatch waiting to happen). This is new code doing the same kind of
  formatting - it does not repeat a defect already in the ledger.
- **D-5: a missing or draft post 404s inside the public layout's own
  `ErrorBoundary`, not root's.** Beats extending root's error boundary
  (shared with the admin, and out of scope to reshape here) or leaving the
  public 404 unthemed, which is what `design.md` explicitly asked this item
  to decide.
- **D-6: the layout's header/footer live in a shared `Chrome` component, used
  by both the normal layout and its `ErrorBoundary`.** Not in the original
  spec - discovered while building Step 2: React Router's error boundary
  *replaces* its route's own component entirely rather than nesting inside
  it (confirmed against the installed docs), so without this a themed 404
  would have lost the header/footer it was meant to sit inside. Any future
  public route that adds its own `ErrorBoundary` should follow the same
  shape. Beats duplicating the header/footer markup in both places.
- **D-7: `e2e/helpers/users.ts`'s `createDraftFor` now sets `published_at`
  when seeding a "published" test row** (defaulting to `now()`, or an
  explicit `Date` for deterministic ordering). Not in the original spec -
  the helper never set it before item 4b, because nothing before this item
  ordered by it. Every future test seeding published posts should pass an
  explicit `publishedAt` when order matters, rather than relying on
  insertion order.

## Notes

- `prototypes/public-post.html`'s tokens (`--measure`, `--text-lg`,
  `--leading-reading`) already exist in `app/app.css` - this item consumes
  them, it does not invent new ones.
- No authorization logic anywhere in this item - public routes need none
  (`project-plan.md`, Auth boundary: "Public routes need no auth; drafts are
  never served publicly").
- Once this ships, `ship` should re-check whether `prototypes/` can finally
  be deleted in full - `public-post.html` was the last unconsumed mockup.
- `design.md`'s public site is currently prose only ("header with logo, site
  title and the navigation menu..."), and its 404 line says "not mocked -
  to be decided in item 4." Once this ships, update `design.md` with what
  actually got decided: the fixed-text header/footer until item 7 (D-2), the
  404's real shape (D-5), and the measured p95 from Step 4 - so the record
  matches the code rather than still describing a screen nobody built.
- Recorded in `blueprint/context/needs-you.md`: a screen-reader and keyboard
  pass over the new public pages (home, one post, 404) has never been done -
  nobody has looked at these screens yet, unlike the admin screens already
  tracked there. Blocks nothing now; `preflight` needs it later.

## Findings

Three findings this item's own review raised were repaired and closed within it:

### 04b/F-66 [P3] closed - The public layout's `ErrorBoundary` loses the dev-mode stack trace root's own boundary shows

**File:** app/features/public-site/layout.tsx:41-50
**Found:** 2026-09-21 by review (scope: current; lens: quality)
**Why it matters:** `app/root.tsx`'s `ErrorBoundary` shows the real error message and stack trace in development (`import.meta.env.DEV`) for anything that is not a handled `RouteErrorResponse`. Because "closest boundary renders" (React Router's error-boundary docs), an unexpected bug thrown from `home.tsx`'s or `post.tsx`'s loader now hits the public layout's own `ErrorBoundary` first, which renders a flat "Something went wrong." with no detail - root's boundary never gets a chance. In production this is a wash (root's own production behaviour is generic too), but in development it is a real loss: debugging a genuine bug in either public loader now shows less than every other route in the app does.
**Suggested fix:** Match root's pattern - in `import.meta.env.DEV`, render the error's message (and stack, if it is an `Error`) instead of the flat sentence, keeping the plain "Page not found." only for the real 404 case.

**Resolution:** Repaired 2026-09-21 by build. `layout.tsx`'s `ErrorBoundary` now mirrors `root.tsx`'s pattern exactly: in `import.meta.env.DEV`, a non-404 error shows `error.message` and, if present, `error.stack` in a `<pre>` (new `.stack` style in `layout.module.css`); production and the 404 case are unchanged. **A separate, larger discovery while verifying this fix, filed as F-69**: `server/app.ts` never passes a `mode` to `createRequestHandler`, so React Router treats every request as production and sanitizes every error - meaning this fix (and root's own identical pattern) will not show a real message or stack until F-69 is also fixed. The fix here is still correct and forward-compatible with that repair; left open rather than folded in, since it touches unrelated shared server-entry code outside this item's scope, and the user chose to leave F-69 for later. Status `fixed`.

**Closed 2026-09-21 by review (scope: current; lens: quality).** Re-read the fix: `devDetail` is correctly gated on `!isNotFound && import.meta.env.DEV && error instanceof Error`, matching root's branch exactly, and a fresh screenshot of the 404 path (unaffected, since it never reaches the new branch) confirms no visual regression - `verify-f66-404.png` is pixel-identical to before this change. `npm run verify` and the full `test:e2e` suite (50 passed) both clean. F-69 correctly stays separate and open.

### 04b/F-67 [P3] closed - Two of the six new public-site tests were never shown to fail

**File:** e2e/public-site.spec.ts:37-42 ("with nothing published..."), :44-85 ("a published post renders its blocks...")
**Found:** 2026-09-21 by review (scope: current; lens: tests)
**Why it matters:** `fundamentals.md`: "A test that cannot fail is worse than no test... If you have not seen it fail, you have not tested it." Four of this item's six new tests were deliberately broken and shown red during `build` (the ordering/filter test, the draft-404 test, the XSS test, and the p95 test - each has a recorded mutation-and-revert). The other two - the empty-state message and the full block/heading/list/formatting render - were written and trusted without that step. Read closely, both look sound (they assert exact visible text and structure, not vague presence), so this is a process gap rather than a suspected false pass - but it is exactly the gap the rule exists to catch before it becomes one.
**Suggested fix:** Before the next `ship`, break each on purpose and confirm it goes red for the right reason - e.g. comment out the `posts.length === 0` branch for the empty-state test, and swap `renderBlocks`'s heading or list case for a no-op for the formatting test - then restore.

**Resolution:** Repaired 2026-09-21 by build - no code changed, only the missing proof was done. Forcing `home.tsx`'s empty-state branch to `false` failed the empty-state test as expected (element not found); replacing `renderBlocks`'s `heading` and `list` cases with `return null` failed the formatting test on the heading assertion. Both mutations reverted, file diffs confirmed byte-identical to before. All 6 tests in `e2e/public-site.spec.ts` now have recorded mutation-and-revert evidence; `npx playwright test e2e/public-site.spec.ts` -> 6 passed. Status `fixed`.

**Closed 2026-09-21 by review (scope: current; lens: tests).** Confirmed `home.tsx` and `render.tsx` are byte-identical to their pre-mutation state (`git diff` shows only the intended, unrelated changes); re-ran `e2e/public-site.spec.ts` fresh - 6 passed. All six tests now have their shown-to-fail evidence on record, four from `build`'s original pass and two from this repair.

### 04b/F-68 [P3] closed - `design.md`'s contrast table has no row for the public pages' actual background

**File:** blueprint/context/design.md (contrast table); app/features/public-site/home.module.css, post.module.css, layout.module.css (all render on `--color-bg`, not `--color-surface`)
**Found:** 2026-09-21 by review (scope: current; lens: accessibility)
**Why it matters:** Every public page (`home`, `post`, the 404) sets its text - dates, the empty-state message, the meta line, the footer - in `--color-text-muted` directly on `--color-bg` (the body background, `#f6f7f9` / `#101317`). `design.md`'s table only measured `--color-text-muted` against `--color-surface` (`#ffffff` / `#171b20`) and `--color-surface-sunken` - a different, brighter pairing. Computed from the tokens for the pairing this item actually introduced: **5.86:1 light / 7.83:1 dark** - both comfortably clear the 4.5:1 bar (WCAG 2.2 AA), so this is not a contrast failure, only an unmeasured pairing in the record `preflight` and `review` are meant to check against.
**Suggested fix:** Add the row to `design.md`'s table with the numbers above. The spec's own Notes already flag that `design.md` needs a general update once this item ships (the fixed header/footer, the 404's shape, the measured p95) - fold this into the same pass.

**Resolution:** Repaired 2026-09-21 by build. Added `| \`--color-text-muted\` on \`--color-bg\` (public site: dates, footer, empty state - item 4b) | 5.9 | 7.8 |` to `design.md`'s Measured contrast table, rounded to the table's own one-decimal convention. The rest of the Public site section's broader update (fixed header/footer, the 404's shape, the p95 number) stays as a `ship`-time follow-up per the spec's own Notes - this resolves only the contrast-table gap F-68 named. Status `fixed`.

**Closed 2026-09-21 by review (scope: current; lens: accessibility).** Independently recomputed both numbers from the raw hex tokens (WCAG relative-luminance formula, not re-trusting the earlier arithmetic): 5.87:1 light, 7.83:1 dark - both round to the 5.9 / 7.8 the table now shows. Row placed correctly among the other `--color-text-muted` pairings.


F-69 (the `createRequestHandler` mode gap discovered while verifying F-66) was
found here but is unrelated to this item's own scope - it stays `open` at P2
in the live ledger, by the user's choice, for a future item to fix.
