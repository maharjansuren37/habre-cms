# Feature: SEO basics

**From build plan:** item 17
**Type:** Feature
**Verified:** not yet
**Reviewed:** not yet

## Goal

Search engines and social sites see each site the way its owner means it: one
address per site, a title, description and image per page and post, a sitemap
and robots file, the site's language, and nothing indexed until the site has
published something (D173). It is what makes a Habre site findable, which is
most of why anyone publishes one.

## In scope

- **One main address per site** (D173): the earliest-verified own domain when
  the deployment serves sites over https (`SITES_URL` is `https:`), otherwise
  the subdomain. Any other host of the site answers GET and HEAD with a 301 to
  the same path and query there. Every public page carries
  `<link rel="canonical">` to its own path on the main address.
- **`robots.txt`**: on the platform host, disallow everything; on a site
  host, allow everything and name the sitemap on the main address.
- **`sitemap.xml`** per site: its published pages and posts at the main
  address - `/` only when a published home page is set (never also at
  `/<slug>`), `/posts` only when a post is published - with `lastmod`.
- **`noindex`** on the "This site is being set up" placeholder.
- **Settings:** Site description (up to 300 characters) and Language (a fixed
  list of left-to-right languages, English by default).
- **`<html lang>`** is the site's language on its public pages and its 404;
  the admin and the platform stay `en`.
- **The editor:** a closed-by-default *Search and sharing* disclosure under
  the Web address line: Title in search results (up to 200), Description (up
  to 300), Image when shared (chosen from Media). Saved with Save, Publish and
  Unpublish, like the title.
- **Head tags** on public pages: `<title>`, `meta description`, Open Graph
  (`og:title`, `og:description`, `og:url`, `og:site_name`, `og:type`,
  `og:image`) and `twitter:card`, from the entry's fields with the fallbacks
  in *Decisions*.

## Out of scope

- The 1200 px social-image JPEG and resized sizes - **item 17b**. Until then
  `og:image` is the original upload's URL.
- Adding or verifying an own domain - **item 21**. Here the main address only
  reads `site_domains`.
- `/_contact` and which host may post to it - **item 19**.
- AI-written titles and descriptions - **item 18b**.
- Right-to-left languages (they need `dir="rtl"` and a checked layout),
  `hreflang`, structured data (JSON-LD), a site-wide default social image,
  search-console verification tags. Not planned; ask before adding.
- A preview of how the page looks in search results or when shared.

## Design reference

No mockup covers these fields; `design.md` *Screens* lists "Social and search
metadata" for item 17 only. This item records the placement (owner,
2026-10-06) in `design.md` - see *Notes* - and builds from the kit's existing
pieces: field, textarea, select, the logo field's media picker, the error
`Message`.

- **Settings:** two fields in the existing form, after the Logo field and
  before Home page: **Site description** (textarea, hint "Shown in search
  results and when your site is shared. Up to 300 characters.") and
  **Language** (select, hint "The language your pages are written in.").
- **Editor:** a native `<details>`, its `<summary>` "Search and sharing",
  directly after the Web address line, closed when the editor opens. Inside,
  in order: **Title in search results** (input, placeholder the entry's
  title, hint "Leave empty to use the title."), **Description** (textarea,
  hint "Shown under the title in search results and when shared. Up to 300
  characters."), **Image when shared** - the Logo field's shape: a thumbnail
  and **Remove image** when set, **Choose image** opening the media picker
  dialog ("Choose an image to share").

## Build steps

- [x] **Step 1 - Migration `0016_seo.sql`** (run through `migrate`):
  - `entries`: `seo_title text not null default ''` (check length <= 200),
    `seo_description text not null default ''` (<= 300),
    `social_image_media_id uuid`, with
    `foreign key (site_id, social_image_media_id) references media (site_id, id) on delete set null (social_image_media_id)`
    - `0010`'s logo pattern, so another site's image cannot be referenced and
    deleting the image clears it.
  - `site_settings`: `site_description text not null default ''` (<= 300),
    `language text not null default 'en'` with a format check
    (`^[a-z]{2,3}(-[A-Z]{2})?$`; the allowlist itself is the app's).
  - Additive and reversible; the header carries the down statements, as
    `0015` does.
  - *Done when:* `npm run db:migrate` applies it to the development database;
    every existing entry reads `''`/`''`/null and every `site_settings` row
    `''`/`en`; the header's down statements, run by hand on a scratch copy,
    remove exactly these columns; and `e2e/seo.spec.ts` "an entry cannot use
    another site's image" shows the owner-role update pointing an entry at
    another site's media row is refused by the foreign key, and deleting the
    entry's own social image sets the column null. (Browser test; needs the
    development database; runs in CI's `e2e` job.)

- [x] **Step 2 - The main address and the canonical link**:
  - `findSiteBySubdomain` / `findSiteByDomain` also return the site's
    earliest-verified own domain (ties by name), still one indexed query
    each.
  - A pure `mainHost(site, sitesUrl)` beside `siteOrigin` in
    `app/lib/site-origin.ts`: the own domain when `SITES_URL` is `https:`
    and the site has one, else `<subdomain>.<sites host>`; and
    `mainOrigin` with the scheme from `SITES_URL`.
  - Root middleware, after the site is found: a GET or HEAD whose host is not
    the main host answers `301` to `<main origin><path><search>`. Other
    methods are served where they arrive. Hosts compare without the scheme -
    the scheme is Caddy's to fix.
  - `siteContext` carries the main origin; the public layout's loader returns
    it; one helper builds every public route's `meta` so each leaf adds
    `{ tagName: "link", rel: "canonical", href }` for its own path (`/` for
    the home page). Error pages carry none.
  - *Done when:* unit tests for `mainHost` (http sites with a domain -> the
    subdomain; https with one -> the domain; https with none -> the
    subdomain); and in `e2e/seo.spec.ts`, against the **proxied (https) test
    server**: a test site with a verified own domain answers
    `GET <address>.localhost:<proxied>/posts?x=1` with `301` and
    `Location: https://<domain>/posts?x=1`, and the domain (by
    `X-Forwarded-Host`) answers `200` with canonical `https://<domain>/posts`;
    a site with no domain is not redirected; against the **primary (http)
    server**: site 1 still answers `200` at `surenmaharjan.localhost:3100`
    with canonical `http://surenmaharjan.localhost:3100/`, and a published
    page's canonical is its own path. The existing `host-routing` and `sites`
    browser specs still pass.

- [ ] **Step 3 - `robots.txt`, `sitemap.xml` and `noindex`**:
  - Resource routes in `app/features/seo/`, listed in `app/routes.ts`;
    `classifyHost` allows `/robots.txt` on the platform host (and nothing
    else new there).
  - Platform: `User-agent: *` / `Disallow: /`. Site:
    `User-agent: *` / `Allow: /` / `Sitemap: <main origin>/sitemap.xml`.
    Both `text/plain; charset=utf-8`.
  - Sitemap: a pure builder (`sitemap-xml.ts`, unit-tested: escaping, order,
    the 50,000-URL cap) fed by one query in `inSite` naming `site_id`;
    `application/xml; charset=utf-8`; `lastmod` is `updated_at` as a date.
  - The home placeholder adds `<meta name="robots" content="noindex">`.
  - A unit test proves no page slug can be `robots.txt` or `sitemap.xml`
    (slugs never keep a dot).
  - *Done when:* in `e2e/seo.spec.ts`: the platform host's `/robots.txt`
    disallows everything; a site's names its sitemap on the main address; a
    site with one published page, one draft page, one published post and a
    published home page lists exactly `/`, `/<page>`, `/posts`,
    `/posts/<post>` - never the draft, never the home page's own slug; a site
    with nothing published has an empty `urlset` and its `/` carries
    `noindex`, while a site with a published home page carries none; and a
    site with 1,000 published posts (inserted as the owner) answers
    `/sitemap.xml` in **under 500 ms** (quality-bar, public pages), measured
    from the test.

- [ ] **Step 4 - Site description and language in Settings, and
  `<html lang>`**:
  - `settings-input.ts`: `siteDescriptionSchema` (trimmed, <= 300, storable
    text) and `languageSchema` (one of the list); the list lives in one
    module, names from `Intl.DisplayNames(["en"])`, sorted by name.
  - `getSiteSettings` / `saveSiteSettings` read and write both, inside the
    existing all-or-nothing save (an `updateSeoDefaults` sibling, F-40).
  - Root `Layout` sets `lang` from the public layout's data on a public page
    or the public 404; everything else stays `en`.
  - *Done when:* in `e2e/manage-settings.spec.ts`: choosing Nepali and a
    description, then Save, shows the saved banner and both values on
    reload; the site's `/` and a missing path both have `<html lang="ne">`
    while `/admin/settings` keeps `lang="en"`; a crafted `language=xx-evil`
    and a 301-character description are each refused beside the field with
    the input kept and nothing saved; a save from an out-of-date form is
    still refused (`settings.2`). Settings saves stay under 1 s (quality-bar).

- [ ] **Step 5 - Search title and description in the editor**:
  - The *Search and sharing* disclosure with its first two fields, inside the
    editor's `Form`, so Save, Publish and Unpublish send them; typing marks
    the entry "Not saved yet".
  - `parseDocumentForm` validates both (`entry-input.ts` schemas, unit
    tested); `saveEntry` writes them; `findEntryForUser` reads them back.
    An invalid value is the existing "Your changes were not saved." message
    naming the field.
  - *Done when:* in `e2e/seo.spec.ts`: on a page and on a post, opening the
    disclosure by keyboard, filling both fields and pressing Save keeps them
    after a reload; a 301-character description is refused and the entry's
    version is unchanged; an author can set them on their own post.

- [ ] **Step 6 - Image when shared**:
  - In the disclosure: the Logo field's picker and states, a hidden
    `socialImageMediaId`; the action checks the id is this site's media
    (`inSite`, `site_id` named) before saving, the logo's rule.
  - *Done when:* in `e2e/seo.spec.ts` (media row from `insertTestMediaRow`,
    so it runs in CI): choosing an image, saving and reloading shows its
    thumbnail; Remove image and Save clears it; a crafted
    `socialImageMediaId` of another site's image is refused and nothing is
    saved; deleting the image from Media leaves the entry with none.

- [ ] **Step 7 - Head tags on public pages**:
  - The Step 2 helper also emits the tags in *In scope*, with the fallbacks
    in *Decisions*; `og:url` is the canonical; `og:image` is the image's
    absolute media URL; `twitter:card` is `summary_large_image` with an
    image, else `summary`.
  - Public loaders return only these fields (`public-site.1`, F-108).
  - *Done when:* in `e2e/seo.spec.ts`: a published post with all three
    fields set has `<title>` equal to its search title, and exactly the
    expected `description`, `og:*` and `twitter:card` values, `og:type`
    `article`; a page with none set has `<title>` "<title> - <site>", no
    `description`, no `og:image`, `twitter:card` `summary`, `og:type`
    `website`; `/` and `/posts` fall back to the site description; a
    description holding `"<>&` comes back unchanged as an attribute value;
    and the loader data of a public page holds no entry id or media id.

## Files and areas

- `db/migrations/0016_seo.sql` (new)
- `app/lib/site-origin.ts` (+ test), `app/lib/host-routing.ts` (+ test),
  `app/root.tsx`
- `app/features/sites/find-site.server.ts`, `site-context.ts`
- `app/features/seo/` (new): `robots.ts`, `sitemap.ts`, `sitemap-xml.ts`
  (+ test), the head-tags helper (+ test); `app/routes.ts`
- `app/features/public-site/`: `layout.tsx`, `home.tsx`, `page.tsx`,
  `post.tsx`, `posts.tsx`, `public-title.ts`
- `app/features/settings/`: `settings.tsx`, `settings-input.ts` (+ test),
  `settings.server.ts`, a languages module (+ test)
- `app/features/content/`: `entry-form.tsx`, `entry-form.module.css`,
  `entry-form-input.ts`, `entry-input.ts` (+ tests), `entries.server.ts`,
  `post-edit.tsx`, `page-edit.tsx` (actions)
- `e2e/seo.spec.ts` (new), `e2e/manage-settings.spec.ts`

## Data and contracts

- **`entries`** + `seo_title`, `seo_description` (`''` = not set),
  `social_image_media_id` (null = none). **Load-bearing**: item 18b's AI
  draft writes the first two; item 17b's social JPEG is found through the
  third.
- **`site_settings`** + `site_description` (`''` = none), `language` (a tag
  from the app's list, default `en`). **Load-bearing**: item 18b writes the
  description; item 20 reads nothing new.
- **`PublicSite`** (`siteContext`) gains the main origin; still never in
  loader data except as the canonical/sitemap address.
- **Form fields:** editor `seoTitle`, `seoDescription`, `socialImageMediaId`;
  settings `siteDescription`, `language`.
- **Main address rule** - see *Decisions*; item 21 relies on it.

## Testing

- Unit (`npm test`, inside `verify`, no database): `mainHost`,
  `classifyHost`'s robots case, the sitemap builder, the head-tags helper,
  the language list and schemas, the entry and settings input schemas, slugs.
- Browser (`npm run test:e2e`, locally and in CI's `e2e` job, needs the
  database): `e2e/seo.spec.ts` and the additions to
  `e2e/manage-settings.spec.ts`. The main-address redirect runs on the
  proxied https server; nothing new needs R2.
- `npm run verify` green; full `npm run test:e2e` green before `ship`.

## Decisions

- **An own domain is the main address only where `SITES_URL` is `https:`**
  (owner, 2026-10-06). Own domains are served only over HTTPS, and `0015`
  seeds `surenmaharjan.fyi` into every database, so the pure rule would send
  development and the browser tests' site 1 to the live site. Beat: clearing
  the seed outside production (dev's site 1 redirects until someone runs a
  command), and an explicit main-domain column (more schema and a deploy
  step for one row).
- **Several verified domains: the earliest verified wins, then by name.**
  Item 21 may make it a choice; until then there is one.
- **The redirect is 301, GET and HEAD only, comparing hosts, not schemes.**
  Other methods are served where they arrive until item 19 decides
  `/_contact`; the http-to-https hop is Caddy's. 301 beat 302 because the
  main address changes only when a domain is verified (item 21).
- **Language is a fixed list of left-to-right languages**, named by
  `Intl.DisplayNames`, stored as its tag. Beat a free-text tag (jargon, and
  unvalidatable) and including right-to-left ones (needs `dir` and a layout
  check).
- **Fallbacks:** `<title>` is the search title alone when set, else
  "<title> - <site>" (F-116's form); the description is the entry's own,
  and only `/` and `/posts` fall back to the site description (one
  description repeated on every page reads as duplicate to search engines);
  no image falls back - the logo is the wrong shape for a share card.
- **The search fields sit in a closed `<details>` under the title** (owner,
  2026-10-06) - native, no script, out of the way of writing. Beat the
  block settings panel, which is block-only and script-driven.
- **`og:image` is the original upload until item 17b.**

## Production needs

- Migration `0016_seo.sql` (additive).
- No new environment variables. The v1 deploy's `SITES_URL` is
  `https://<sites domain>` (`host`, once the domain is bought); with it,
  **site 1's subdomain redirects to `surenmaharjan.fyi`** - expected, not a
  fault.
- No host or Caddy change.

## Behaviour changes

- Changes `sites.6` from "a site's public pages are served at `<address>.<sites domain>` and show only that site's content" to "a site's public pages are served at its main address - its earliest-verified own domain where `SITES_URL` is https, else `<address>.<sites domain>` - and show only that site's content" - Step 2
- Adds to `sites`: a GET or HEAD on any host of a site other than its main address answers a 301 to the same path and query on the main address - Step 2
- New capability `seo`: every public page carries a canonical link to its own path on the site's main address, `/` for the home page - Step 2
- Adds to `seo`: the platform host's `/robots.txt` disallows everything; a site's allows everything and names its sitemap on the main address - Step 3
- Adds to `seo`: a site's `/sitemap.xml` lists its published pages and posts at the main address, `/` only when a published home page is set and never that page's own slug, and no draft - Step 3
- Adds to `seo`: the "This site is being set up" placeholder carries `noindex` - Step 3
- Adds to `settings`: Settings sets a site description of up to 300 characters and the site's language from a fixed list, English by default - Step 4
- Adds to `seo`: a site's public pages and its 404 carry the site's language on `<html lang>`; the admin stays `en` - Step 4
- Adds to `editor`: a page or post has a title in search results and a description under Search and sharing, saved with the entry - Step 5
- Adds to `editor`: a page or post can have an image when shared, chosen from this site's Media; another site's image is refused - Step 6
- Adds to `seo`: a public page's title, description, Open Graph and Twitter tags come from its search title, description and image, else its title, the site description on `/` and `/posts` only, and no image - Step 7
- Changes `public-site.1` from "public pages carry no entry ids or settings beyond the title, logo and menu" to "public pages carry no entry ids or media ids, and no settings beyond the title, logo, menu, language, site description and main address" - Step 7

## Notes

- `design.md` is updated by this spec (*Screens*: Settings and Social and
  search metadata rows) with the placement above.
- Every site-owned query: `inSite(siteId, ...)` **and** `site_id` in the
  `where` (coding-standards, D151). The sitemap query is the only new public
  read; it is bounded at 50,000 rows.
- Public meta goes through React Router's `meta` export; the installed docs
  (`node_modules/react-router/docs/`) decide its `tagName: "link"` form.
- Error pages (404, 500) carry no canonical and no `og:*`.
- Words, per `design.md`: "Search and sharing", "Title in search results",
  "Image when shared" - no "SEO", "meta" or "Open Graph" in the admin.
- **F-103:** the Settings and head-tag browser tests use a site of their own
  (`e2e/helpers/sites.ts`, `users.ts`), never site 1's shared
  `site_settings` row - a language changed mid-run would fail other specs.
- Manual checks added to `needs-you.md`: the new fields in the
  screen-reader pass; a real share-preview check after the v1 deploy.
