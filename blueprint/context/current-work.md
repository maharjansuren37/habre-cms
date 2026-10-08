# Feature: Preview and Publish website

**From build plan:** item 18b4b
**Type:** Feature
**Verified:** not yet
**Reviewed:** not yet

## Goal

Journey 1 gets its end. From Home's ready panel the person opens **Preview**:
their drafted site as visitors will see it - the site's look, its menu,
every page, drafts included - which nobody else can see. Then **Publish
website** publishes the draft's pages at once, and Home says the site is
live with a link to it.

## In scope

- **Preview** at `/admin/preview` (the home page) and `/admin/preview/:slug`
  (any page of the site, draft or published), on the platform host, admins
  only. The site's look (style, brand colour, language, logo, title), the
  site's header and footer, the menu resolved over draft and published
  pages, and a preview bar saying nobody else can see it. Links to the
  site's own pages stay inside the preview; any other site-relative link
  goes to the live site; external links are unchanged. `noindex`.
- **Publish website** - a POST on Home (`intent=publish`), only in the
  ready state (a draft used, nothing published): every draft **page** of the
  site becomes published in one statement. Posts are untouched. Then Home
  shows "Your website is published." with **View your site**.
- **The ready panel** becomes the mock's: primary **Publish website**,
  secondary **Preview** (new tab); Edit the home page moves to the top of
  the suggestion list.
- `design.md` records the preview and the panel as built.

## Out of scope

- **The ready panel's half-size live preview** (`home.html`'s
  `.ready__preview`) - cut (Decisions). The Preview link replaces it.
- Preview from the editor, for posts, or for editors and authors - not
  planned; the editor's Publish and View site are unchanged.
- Draft posts in the preview or in Publish website: pages only.
- Make it yours (step 3) - **18b5**.
- Unpublishing the whole site, or publishing again once something is
  published: Publish website is the one-time end of onboarding; afterwards
  each page is published from its editor, as today.

## Design reference

- **Ready panel:** `prototypes/home.html` `.ready` - badge, `h2`, the text
  "We drafted N pages from your description. Look them over, change
  anything, then publish - nobody sees it before that." (the "We drafted N
  pages" part only when N > 0, as 18b4a), then a `.cluster`: a `Button`
  **Publish website** (primary; busy "Publishing…", `aria-busy`, disabled)
  in a `Form method="post"` with `intent=publish`, and a link-button
  **Preview** (secondary) with `target="_blank"`, `rel="noopener"`,
  visually-hidden "(opens in a new tab)" and the ↗ glyph `aria-hidden`.
  The `.suggest-list` gains **Edit the home page** first (only with a home
  page set), then Add your logo, Change the menu. One primary in the view.
- **After publishing:** Home at `/admin?published=1` shows, above the cards,
  a `role="status"` `Message` (`success` tone) "Your website is published."
  with a link **View your site** (↗, new tab, as Preview) to the site's main
  address - the same address the sidebar's View site uses. The ready panel
  is gone (state `none`).
- **Preview** (not mocked; specified here, recorded in `design.md`): the
  public page exactly as `/` and `/:slug` render it, plus before the site's
  header an `aside aria-label="Preview"` bar: "Preview - nobody else can see
  this until you publish." and a link **Back to Home** (`/admin`). The bar
  is a full-width band in the site's scope (`--color-surface-2` or the
  nearest existing token, text `--color-text`), 44px link target, wraps at
  390px. Light whatever the device, as the public site (public-site.2).
- No horizontal scroll at 390px on Home or the preview.

## Build steps

- [x] **Step 1 - preview links, pure** - new
  `app/features/preview/preview-href.ts`: `previewHref(href, { pageSlugs,
  homeSlug, siteOrigin })` - `/` and `/<homeSlug>` -> `/admin/preview`;
  `/<slug>` for a slug in `pageSlugs` -> `/admin/preview/<slug>` (query
  and fragment kept); any other value starting with a single `/` ->
  `siteOrigin + href`; anything else (`https:`, `mailto:`, `#…`, `//…`)
  unchanged. `renderDocument` gains an optional fourth parameter
  `hrefFor: (href: string) => string` (default identity) applied to a
  button's and an inline link's `href`; `PageBody` passes it through. The
  public routes pass nothing. *Done when:* `node --test
  app/features/preview/preview-href.test.ts` passes, each case seen failing
  first: `/` and the home slug; a draft page's slug; `/about?x=1#team`; an
  unknown slug and `/posts/hello` to the site origin; `https://…`,
  `mailto:`, `#top` and `//evil.example` unchanged. `npm run verify`
  passes (the public pages' browser tests stay green in Step 2's run).
- [x] **Step 2 - the preview of the home page** - `content-security-policy.ts`:
  `PolicyArea` gains `"preview"`, which `areaForPath` returns for
  `/admin/preview` and under; its policy is the public one (style nonce, no
  `blob:`). `app/root.tsx`: the site look (`data-surface="site"`,
  `data-style`, `lang`, the nonce'd brand `<style>`) applies to the preview
  area too, from the preview layout's data. `public-site/layout.tsx`
  exports its `Chrome` with a `homeHref` prop (default `/`). New
  `app/features/preview/preview-layout.tsx` (middleware `requireUser`,
  `requireRole(["admin"])`; loader: the settings the public layout reads,
  the site's page slugs, the home page's slug, the main origin, and the
  menu resolved over the site's pages **whatever their status**, through
  `previewHref`), rendering the preview bar then `Chrome`; its
  `ErrorBoundary` the public one's "Page not found." inside the chrome.
  New `preview-home.tsx` at `admin/preview`: the home page whatever its
  status, else the "being set up" placeholder; `meta` `robots noindex` and
  the title "Preview - <site title>". `entries.server.ts` gains
  `findPreviewHomePage(siteId)` and `listPageSlugs(siteId)` (status
  ignored). *Done when:* new `e2e/preview.spec.ts`, as an admin of a site
  with a used draft (seeded through the owner connection): `/admin/preview`
  shows the home page's main heading as its one `h1`, the `aside` named
  Preview with its text, the menu listing the draft's pages, the site's
  title in the header, `html[data-surface="site"]` with the site's style,
  the brand colour's custom property from a nonce'd `style`, and
  `meta[name=robots]` `noindex`; the site host's `/` still shows "This
  site is being set up."; with the home page unset, `/admin/preview` shows
  that placeholder in the preview chrome; an editor and an author get Not Found, a
  signed-out visitor is sent to sign in; `e2e/content-security-policy.spec.ts`
  covers `/admin/preview` with no CSP violation; no horizontal scroll at
  390px; the existing public-site browser tests pass.
- [ ] **Step 3 - every page in the preview** - new `preview-page.tsx` at
  `admin/preview/:slug`: the site's page by slug whatever its status
  (`findPreviewPage(siteId, slug)`), the home page's slug redirecting to
  `/admin/preview`, a missing slug Not Found inside the preview chrome;
  documents rendered with `hrefFor` from the layout's data. *Done when:* in
  `e2e/preview.spec.ts`: following the menu from `/admin/preview` opens
  each draft page at `/admin/preview/<slug>` with its title or main
  heading; the hero's button (seeded to point at a drafted page) leads to
  that page's preview address; the logo link leads to `/admin/preview`;
  `/admin/preview/<home slug>` lands on `/admin/preview`; a slug of another
  site's page is Not Found (two sites, D151); the draft page's address on
  the site host is still Not Found.
- [ ] **Step 4 - Publish website** - `entries.server.ts` gains
  `publishDraftPages(siteId): Promise<number>` - one `inSite` update:
  `status = 'published'`, `published_at = coalesce(published_at, now())`,
  `version + 1`, `updated_at = now()`, where `site_id`, `type = 'page'`,
  `status = 'draft'` and a readable `blocks_format`; returns the count.
  `home.tsx` gains an action: a non-admin gets Not Found; `intent=publish`
  outside the ready state (anything published, or no draft used) redirects
  to `/admin` and changes nothing; in it, publishes, logs `site_published`
  (siteId, userId, page count) and redirects to `/admin?published=1`. The
  loader reads `published=1` (a flag, nothing echoed) and the site's main
  origin; the ready panel and the banner as in *Design reference*. *Done
  when:* in `e2e/home.spec.ts`: after a seeded used draft, Home shows
  Publish website and Preview (Preview opens `/admin/preview` in a new
  page); pressing Publish website lands on `/admin` with "Your website is
  published." in a `role="status"` element and View your site pointing at
  the site's address; the owner connection shows every one of the site's
  draft pages `published` with `published_at` set and a seeded draft post
  still `draft`; the site host's `/` shows the home page and its menu lists
  every drafted page; the ready panel is gone; an `intent=publish` POST from
  an editor is Not Found, and one on a site that already has a published
  page leaves its other draft pages draft; the publish POST answers in
  **under 1 s** (quality-bar *Admin saves*), timed in the test, one local
  sample recorded in verify's evidence; no horizontal scroll at 390px.
- [ ] **Step 5 - journey 1 to the end** - `design.md`: the Home row (the
  ready panel's Publish website and Preview, the published banner, the
  half-size preview cut with its reason), a new Preview row, the First run
  row and journey 1 marked built. *Done when:* `e2e/onboarding.spec.ts`'s
  journey continues from Home, as full page loads and through the app's own
  links: Preview (new page) -> the preview's home page with the fake
  proposal's first page and its menu -> Back to Home -> Publish website ->
  "Your website is published." -> View your site -> the site host's `/`
  showing the fake's first page, final URL the site's address. `npm run
  verify` and the full `npm run test:e2e` pass locally.

## Files and areas

- new `app/features/preview/` - `preview-href.ts` (+ test),
  `preview-layout.tsx`, `preview-home.tsx`, `preview-page.tsx`,
  `preview.module.css`
- `app/features/blocks/render.tsx` (`hrefFor`),
  `app/features/public-site/page-body.tsx`, `public-site/layout.tsx`
  (export `Chrome`, `homeHref`)
- `app/lib/content-security-policy.ts` (+ test), `app/root.tsx`
- `app/features/content/entries.server.ts` - `findPreviewHomePage`,
  `findPreviewPage`, `listPageSlugs`, `publishDraftPages`
- `app/features/admin-shell/home.tsx`, `home.module.css`
- `app/routes.ts`
- `e2e/preview.spec.ts` (new), `e2e/home.spec.ts`,
  `e2e/onboarding.spec.ts`, `e2e/content-security-policy.spec.ts`
- `blueprint/context/design.md`

## Data and contracts

- **No migration.** No stored shape changes.
- **`PolicyArea = "public" | "admin" | "preview"`** - `/admin/preview*` is
  still a platform path (`isPlatformPath` unchanged), so a site host
  redirects it to the platform, and the cookie (host-only on the platform)
  reaches it.
- **`renderDocument(document, kind, mediaById, hrefFor?)`** - the one place
  a rendered link's `href` can be rewritten; default identity, so public
  output is byte-for-byte unchanged.
- **`publishDraftPages(siteId): Promise<number>`** - pages only.
- **Preview addresses:** `/admin/preview` and `/admin/preview/:slug`.

## Testing

- **Unit (`npm test`, inside `verify`, CI):** `preview-href.test.ts`,
  `content-security-policy.test.ts` (the `preview` area and its policy).
  `render.tsx` is JSX, so `hrefFor` is proven in the browser.
- **Browser (`npm run test:e2e`, locally and in CI's `e2e` job):**
  `e2e/preview.spec.ts` (new), `home.spec.ts`, `onboarding.spec.ts`,
  `content-security-policy.spec.ts`, on the primary server; seeding drafts
  and runs through the owner connection (`DATABASE_OWNER_URL`); the site host
  checked at the test server's sites address, as `sites.spec.ts` does. No
  R2 upload, so nothing is skipped in CI. The journey stays in 18b3's
  `serial` block.
- The 1-second publish timing is one local sample, not a p95.

## Decisions

- **Preview lives on the platform host, under `/admin/preview`, admins
  only.** Beat: a signed preview token on the site host (a second auth
  path, and a draft reachable by anyone holding the link); the site host
  reading the admin cookie (it is host-only by design, D6).
- **A third CSP area, `preview`, with the public policy** - the brand
  `<style>` needs the nonce the admin policy refuses. Beat: setting the
  brand through the CSSOM on the preview (a second way to apply the brand,
  and a flash before hydration).
- **Links in the preview:** site pages stay in the preview, other
  site-relative links go to the live site, external links unchanged - one
  pure function. Beat: leaving links as-is (every click a platform 404).
- **Publish website publishes every draft page of the site, never posts, and
  only while nothing is published and a draft was used.** Changes 18b4a's
  note that it would publish "the menu's pages": a page the person took out
  of the menu would otherwise stay a draft with no word about it. Beat:
  the menu's pages; a site-wide publish available any time, which could
  make an editor's unfinished pages public.
- **The half-size preview in the ready panel is cut.** It needs either an
  iframe (`frame-ancestors 'self'` on the preview and a second full page
  load on every Home visit) or rendering the document inside the admin with
  the brand applied through the CSSOM. Beat: building it; the Preview link
  shows the real thing.
- **The preview's links to the live site use the site's subdomain origin**
  (`siteOrigin`, the address the sidebar's View site uses), not
  `mainOrigin`: the platform has no own-domain lookup for a member's site,
  and the subdomain redirects to the main address (D173). (build, Step 2)
- **The preview bar is `--color-surface-sunken`** - `--color-surface-2`
  does not exist; inside the site scope it is `--neutral-100`, light on
  every device. (build, Step 2)
- **A refused preview (editor, author) shows only "Page not found."**, no
  bar or site chrome: the layout's loader never ran, so there is no site
  to draw. (build, Step 2)
- **The published banner is a `?published=1` flag** read as a boolean.
  Beat: a session flash (no flash store exists).

## Production needs

None. No migration, no new variable.

## Behaviour changes

- New capability `preview`: an admin's `/admin/preview` shows the site's home page in the site's look with a menu of its pages, drafts included, marked as a preview nobody else can see, and not indexed - Step 2
- New capability `preview`: editors and authors get Not Found at `/admin/preview`, and a signed-out visitor is sent to sign in - Step 2
- New capability `preview`: every page of the site, draft or published, has a preview at `/admin/preview/<its address>`, and another site's page is Not Found there - Step 3
- New capability `preview`: in the preview, links to the site's pages stay in the preview and other links to the site go to the live site - Step 3
- Adds to `home`: while the website is ready, Home offers Publish website and a Preview that opens in a new tab - Step 4
- Adds to `home`: Publish website publishes every draft page of the site at once, no post, and Home then says the website is published with a link to it - Step 4
- Adds to `home`: Publish website changes nothing once anything on the site is published - Step 4

## Notes

- `inSite` + `site_id` in every new query (D151); the preview's page reads
  ignore status but never site.
- The preview must never be served on a site host: it is a platform path,
  and Step 2's test proves the site host's `/` is unchanged.
- Drafts are rendered by the same escaping renderer as published pages -
  no new rendering path for AI-written text.
- `publishDraftPages` bumps `version`, so an editor open on one of those
  pages gets the existing "stale" answer on its next save - intended.
- Home's action must check the role itself: the loader's redirect does not
  run for a POST. Root's `refuseCrossSiteRequests` covers the POST.
- Suspended sites: Publish website still works (as the editor's Publish
  does); the suspension keeps the pages off.
- F-371 (a page published between the gate and the apply) is unrelated and
  stays open.
- `findLatestFinishedRun` / `homeState` are unchanged: publishing makes
  `published` true, which already gives state `none`.
- React Router 8's installed docs decide route-module patterns
  (`node_modules/react-router/docs/`).
- Semantic HTML: the preview bar is an `aside` with a label; the page keeps
  one `header`, `main`, `footer` and one `h1`.
- Branch: `feature/18b4b-preview-publish`.
