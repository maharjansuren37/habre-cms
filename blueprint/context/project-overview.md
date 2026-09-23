# Project Overview

> **Generated file.** Written by the `context` skill from blueprint/project-plan.md
> and blueprint/build-plan.md. This is the AI-facing source of truth loaded every
> session - edit the two planning docs and regenerate, rather than editing this
> file directly.

Generated 2026-09-23 at `main` `ef5d4d5`. Decision
numbers (D1-D84) refer to `dev-notes/decisions.md` - read the entry before
changing anything it covers.

## What this is

**Habre CMS** - a website management system, like WordPress but **really easy to
use**. Non-technical editors write, manage and publish a site's content, and the
CMS serves the public website itself, so no developer is needed to put content
online (D1).

- **Editors and authors** at a small organisation manage **one website** (D2, D8).
- **Admins** set the site up and decide who can edit it.
- **Visitors** read the public site; they have no accounts.
- Scale: a handful of users per site.
- **Ease of use is the product.** Few screens, obvious next actions, no settings
  an editor does not need. Light and dark mode everywhere from the first screen.
- Intended to become a hosted service later; no billing or signup now.

## Scope

**First version (the 8 build items):** admin login with a 1-week session and no
public signup; posts and pages written in a block editor (text, heading, image,
list) with structured inline formatting (bold, italic, links); draft / publish /
unpublish; image upload and a reusable media library; a public site rendered
from published content with one built-in theme; site title, logo and navigation
menu; three roles; light and dark mode in admin and public site.

**Deliberately deferred - do not build:**

- *Soon after:* categories and tags; scheduled publishing and revision history;
  SEO fields and sitemap; password reset by email (an admin resets passwords for
  now); custom domains.
- *Likely next big step:* a **page builder** - content is stored as blocks so it
  can be added without a rewrite.
- *Later or never:* headless content API; multiple themes; many sites per
  installation, signup, billing; WordPress import; plugins, comments, forms,
  e-commerce, multiple languages.

## Stack

All versions are pinned and installed (read from the lockfile). **Minimal
dependencies is a constraint:** every new runtime dependency is a recorded
decision.

| Layer | Choice | Why (decision) |
|---|---|---|
| Language | TypeScript 7.0.2, strict, `erasableSyntaxOnly` (no `enum`, `namespace`, parameter properties) | Node runs `.ts` by stripping types |
| Runtime | Node.js 26 everywhere `engines` requires it - installed versions differ by machine: 26.8.1 on the dev machine, 26.8.2 in production; CI installs whatever is newest under the `26` major at each run, not pinned to a patch | Supported to 2029, LTS due Oct 2026 (D15) |
| Framework | React Router 8.3.1 framework mode, React 19.3.0, Vite 8.3.0, served by `node:http` - **no Express** | Small, low memory, forms work without JS (D10, D17) |
| Node server | `@remix-run/node-fetch-server` 0.14.1, used directly in `server/app.ts` with `trustProxy: true` | `@react-router/node`'s wrapper passes no options, and without `trustProxy` the app misreads its own origin behind Caddy (D23) |
| Database | PostgreSQL 16; `postgres` 3.4.9 driver, **raw SQL, no ORM**; numbered `.sql` migrations via `db/migrate.ts` | Four tables do not need an ORM (D11) |
| Styling | Plain CSS: custom properties for light/dark tokens, CSS Modules. **No Tailwind** | `prototype` tokens map straight to CSS variables (D12); look in `blueprint/context/design.md` |
| Auth | JWT with `jose` 6.2.12 (installed); passwords with `node:crypto` scrypt. **No auth library** | (D6) |
| Validation | Zod 4.6.5 at every trust boundary | |
| Editor | Editor.js 2.31.6 + header and list tools, with structured inline formatting (bold, italic, link) via an in-repo HTML scanner - never raw HTML | Saves the `{id, type, data}` block shape directly (D13); inline runs are D28-D30 |
| Media | Cloudflare R2 via `aws4fetch` 1.0.20; `image-size` 2.0.4 | Uploads through the app server (D7) |
| Lint / format | Biome 2.5.13 | (D19) |
| Tests | `node:test` unit tests; Playwright 1.63.0 (Chromium) browser tests | |
| Monitoring | UptimeRobot on `/healthz`, alerts by email; logs to the systemd journal | |

- **`aws4fetch` 1.0.20 and `image-size` 2.0.4 arrived with item 5a** (D20),
  pinned exactly, alongside the five `R2_*` variables in `env.server.ts`.
  Editor.js 2.31.6 with `@editorjs/header` 2.8.9 and `@editorjs/list` 2.0.9
  arrived with item 2a, pinned exactly; their shipped `.ts` types use `enum`,
  so `app/types/editorjs.d.ts` describes what this app uses.
- **The image block (item 5b) is a hand-written Editor.js tool, not a
  package** (D58) - `app/features/blocks/image-tool.client.ts` - so it added
  no new dependency and no new line to the table above.
- **React Router 8 is newer than an agent's training.** The installed docs in
  `node_modules/react-router/docs/` are the authority; React Router's agent skill
  is at `.claude/skills/react-router/`. This app is **Framework Mode**.
- **No new dependency arrived with item 7 (7a or 7b).** The logo picker and the
  navigation editor are both built from components and patterns already in the
  app - no new package, no new line above.

## Architecture

**One application, deployed once** (D4). No background jobs, no cache, no queue,
no multi-write transactions - the six system-design questions were all "no", and
nothing should be added to the design that they did not call for.

### Layout (D16)

- `app/routes.ts` lists every URL; route modules live inside
  `app/features/<feature>/` (`auth`, `admin-shell`, `users`, `content`, `blocks`,
  `media`, `settings`, `public-site`); cross-feature code in `app/lib/`
  (`db.server.ts`, `env.server.ts`, `same-origin.ts`, `security-log.server.ts`).
- `server.js` (+ `server/app.ts`): the Node entry - Vite middleware in dev; in
  production serves `build/client` itself and sets security headers (D18).
- `db/migrations/NNNN_name.sql` (`0001_users.sql`, `0002_entries.sql`,
  `0003_blocks_v2.sql`, `0004_media.sql`, `0005_site_settings.sql`),
  `db/migrate.ts`; `scripts/create-admin.ts`; `deploy/` - `setup-server.sh`,
  `habre-cms.service`, `caddy/habre-cms.caddy` (written by `host`);
  `e2e/*.spec.ts`.
- **Imports:** `#app/...` with explicit `.ts`/`.tsx` extensions. **Never a `~/`
  alias** - plain `node` cannot resolve it.
- **Boundary per file, not per directory:** `*.server.ts` = server only (the
  build fails if browser code imports it); `*.client.tsx` = browser only
  (Editor.js). Loaders and actions run on the server.
- Unit-testable logic goes in `.ts` files beside a `*.test.ts` - `node --test`
  cannot run `.tsx`.

### Hostnames (D22 - built and live, item 4c)

One app answers two hostnames; Caddy proxies both to the same process. Live in
production since the item 4c deploy (release `4165637`, 2026-09-21).

| Hostname | Serves |
|---|---|
| `surenmaharjan.fyi` | the public site: `/`, `/posts/:slug`, `/:slug` |
| `cms.surenmaharjan.fyi` | the admin: `/admin/*`; `/` redirects to `/admin` |
| `www.surenmaharjan.fyi` | redirects to the apex (in Caddy) |

- **Config:** `PUBLIC_URL` and `ADMIN_URL` replaced `APP_URL`, which no longer
  exists anywhere in the app, config, `.env.example` or the README. Equal in
  development (the app then acts as one host and redirects nothing); a third
  Playwright server (`127.0.0.1` / `localhost`) exercises the real split.
- **Routing by host, before any route runs** - a pure decision function,
  `app/lib/host-routing.ts`, wired into `app/root.tsx` as the `routeByHost`
  middleware: admin path on the public host -> same path on the admin host;
  public path on the admin host -> public host. GET/HEAD only, **temporary**
  redirects; any other method on the wrong host gets 404. `/healthz` answers
  on both. A host matching neither gets 404 - **and nothing logs it** (F-70,
  open P2).
- **Admin stays under `/admin`** - the prefix keeps admin and public routes from
  colliding and lets development run on one host. `/cms` was rejected.
- Admin "View site" link is absolute on `PUBLIC_URL`; public pages never link
  to the admin.
- **Verified live:** `https://surenmaharjan.fyi/` (public, reachable for the
  first time), `https://cms.surenmaharjan.fyi/admin/login`, and
  `https://www.surenmaharjan.fyi` redirecting to the apex, all confirmed
  serving after the deploy (`dev-notes/status.md`). **This is still the item 4c
  deploy only** - items 5a-7b below are merged to `main` but not yet deployed;
  see *Current state*.

### Routes

- **Public** (server-rendered HTML, no login, works without JS): `/` latest
  published posts, newest 10, no pagination (D47) · `/posts/:slug` one post,
  its blocks rendered through JSX only, never an HTML-building helper
  (`render.tsx`, D26/D28), including a resolved image with a visible muted
  caption beneath it (item 5c, D65) - both live at `surenmaharjan.fyi` since
  item 4c split the hostnames · `/:slug` one page (item 6b): resolves a
  published page through the same `findPublishedEntry` contract as a post,
  renders through the identical `renderBlocks`, but with no byline and no
  back link, since a page is static reference content, not a dated article
  (D72-D74; `design.md`'s *Public site* line says so) · `/healthz` (exists,
  reports database reachability). A draft or missing post or page 404s inside
  the public site's own header/footer chrome, not root's bare error page
  (D51). Reserved page slugs: `admin`, `posts`, `api`, `healthz` - enforced
  since item 6a by folding them into the same free-address search a slug
  collision already goes through (D68), not a separate refusal. **The header
  now also carries a `<nav aria-label="Site">` of the saved navigation menu**
  (item 7b) - each item either a resolved published-page link or a plain web
  address, in order, next to the site title; an unpublished or deleted page
  drops silently from the menu at render (D61's precedent), and an empty menu
  renders no `<nav>` at all.
- **Admin** (login required): `/admin/login`, `/admin/logout` (exist since item
  1) · `/admin` redirects to `/admin/posts` rather than rendering anything
  itself (D34, item 3; `home.ts`, no longer `home.tsx` - it only throws a
  redirect, so it moved to the project's resource-route shape) ·
  `/admin/posts` - the list: role-scoped table (authors see only their own),
  filter tabs **All / Drafts / Published** with counts, title search, 20 posts
  a page (D38, no new index - D39) · `/admin/posts/new`, `/admin/posts/:id` -
  edit (all roles; authors only their own, with inline bold/italic/link
  formatting since item 2b), **and publish/unpublish** (item 4a): the same
  action, keyed by an `intent` field, saves content and flips `status` in one
  atomic update (D42) and redirects to the list with a banner (D44) ·
  `/admin/posts/:id/delete` - a GET confirmation screen then a POST delete,
  same shape as edit's ownership check (D36); the list redirects to
  `/admin/posts?deleted=<title>` afterwards (D37), the same mechanism
  publish/unpublish now share (`banner.ts`) ·
  `/admin/pages`, `/admin/pages/new`, `/admin/pages/:id`,
  `/admin/pages/:id/delete` - item 6a: the identical
  list/create/edit/publish/unpublish/delete shape as posts, restricted to
  `editor` and `admin` (D69) - an author gets the same 404-not-403 an
  ownership refusal already gives, and the "Pages" nav entry is hidden for
  them too, so there is no dead link to a screen they cannot reach ·
  `/admin/media` (all roles - every signed-in role sees every upload, D54),
  `/admin/media/:id/delete` (ownership-scoped for authors, the same
  404-not-403 pattern as posts) - item 5a - and `/admin/media/picker` (`GET`,
  JSON, admin-guarded via the layout, no write capability) - item 5b, feeding
  the post editor's image-picker dialog · the post editor itself can now
  place an image block, and `/posts/:slug` renders it as a real, captioned
  `<img>` - item 5b built the block and the picker, item 5c added the public
  caption (D65), so image support (item 5) is fully built across upload,
  placement and rendering ·
  `/admin/settings` - **item 7, now fully built (7a + 7b)**: title, logo and
  the navigation menu editor, admin only (`requireRole(["admin"])`, same
  404-not-403 shape as pages). One `<Form>` saves all three together
  (`updateSiteIdentity` and `updateNavigation`, still two functions - matches
  `saveEntry`'s own split from `updateDraft`, F-40). The navigation section
  (item 7b): a row per item (label, then either a page dropdown or a web
  address - exactly one, checked at save), "Add item", per-row "Remove",
  "Move up"/"Move down" (disabled at the ends) as separate `intent`-keyed
  submit buttons on the same form (D42's pattern) - add/remove/move only
  reshape the draft, never write to the database; `intent=save` validates
  with `navigationSchema` and persists both `updateSiteIdentity` and
  `updateNavigation`. A hidden default submit button (`intent=save`,
  visually hidden, unreachable by Tab) makes plain Enter save regardless of
  how many other submit buttons the form has grown (F-94, closed) ·
  `/admin/users[/:id]` - add, change role, reset password, deactivate (admin,
  item 8 - not yet built, the last unchecked item).
- **The admin shell's nav list grows one entry per shipped section** (D35) -
  "Posts", "Media" (item 5a), "Pages" (item 6a), "Settings" (item 7a), each
  with its own icon; "Pages" is hidden from authors and "Settings" is admin
  only - a nav item for a route that does not exist yet is a dead link, so
  each remaining item adds its own entry when it ships. Item 7b added no new
  nav entry - the navigation editor lives inside the existing "Settings"
  screen.
- **The first admin is created by a server command (`npm run create-admin`),
  never a web setup page.**

### Data model (no site id on any table - D8)

- **users** - `id`, `email` (unique, case-insensitive), `name`, `password_hash`,
  `role` (admin | editor | author), `token_version`, `deactivated_at`,
  `created_at`, `updated_at` (exists: `0001_users.sql`)
- **entries** - posts **and** pages in one table (D5): `id`, `type` (post |
  page), `title`, `slug` (unique per type), `blocks` (JSON), `blocks_format`
  (**`v2`** - structured inline runs, D28), `status` (draft | published),
  `published_at`, `author_id` -> users, `version`, `created_at`, `updated_at`.
  **Every read/write function in `entries.server.ts` takes `type` as its
  first parameter** (D66, item 6a) - `findEntryForUser`, `createDraft`,
  `saveEntry`, `listEntries`, `deleteEntry`, `findPublishedEntry` - so posts
  and pages share one data layer rather than a parallel one. Item 7b added
  two more read-only functions on the same layer: `listPagesForNav()` (every
  page, any status - feeds the admin dropdown and the save-time existence
  check) and `findPublishedPageSlugs(ids)` (published only - feeds the
  public menu render).
- **media** - `id`, `storage_key`, `filename`, `mime_type`, `byte_size`, `width`,
  `height`, `alt_text`, `uploaded_by` -> users, `created_at` (exists:
  `0004_media.sql`, item 5a). Every signed-in role sees every upload; only
  deletion is ownership-scoped for authors (D54). Alt text is required at
  upload, stored once on the row, and not yet editable afterward (D55).
  `storage_key` is a generated `randomUUID` plus the detected extension,
  never derived from the client's filename (D56); the real bytes, not the
  browser's declared `Content-Type`, decide the image type via `image-size`
  (D57). Still no caption column - the public caption (post or page) reuses
  this same `alt_text` value (D65).
- **site_settings** - single row: `site_title`, `logo_media_id` -> media,
  `navigation` (JSON list of `{label, pageId | url}`), `updated_at` (exists:
  `0005_site_settings.sql`, item 7a - singleton via `id smallint primary key
  default 1 check (id = 1)`). **`navigation` is now read and written**
  (item 7b, `getSiteSettings`/`updateNavigation` in `settings.server.ts`) -
  reserved and unused through 7a, this is the column's first real consumer.
  `NavItem` is `{ label } & ({ pageId } | { url })`, validated by
  `navigationSchema` (`app/features/settings/navigation-input.ts`): label
  1-100 chars, `pageId` a UUID checked to exist (any status) at save time,
  `url` checked with the same `isSafeHref` allowlist inline links use (D30) -
  capped at 20 items. `pageId` is **not** a foreign key, unlike
  `logo_media_id` (D77) - a deleted page degrades silently at render like an
  image block's `mediaId` does (D60/D61), rather than being a database
  constraint.
- **schema_migrations** - owned by the migration runner: `filename`,
  `applied_at`. No library owns any other table.

**Blocks:** an ordered list of `{id, type, data}`. A page builder later adds
container blocks with `children`.

- **Text is a list of runs**, never raw HTML: `{ text, bold?, italic?, href? }`
  (`blocks_format` `v2`, D28). Runs are canonical - one stored form per text -
  and are parsed from and serialized back to Editor.js's HTML fragment by an
  in-repo scanner, not a library (D29). Escaped on render either way.
- **Links are checked against an allowlist** - `http:`, `https:`, `mailto:`, a
  site-relative `/path`, or a `#fragment` - enforced by both the parser and the
  stored schema, because Editor.js's own link field accepts any `scheme:`
  including `javascript:` (D30). Item 7b's navigation `url` field reuses this
  exact allowlist (`isSafeHref`) rather than a second one.
- **Image blocks store a media id, not a URL** (`{ id, type: "image", data: {
  mediaId } }`, nothing else) - built in item 5b. The URL is resolved at read
  time through one `buildMediaUrl(publicUrl, storageKey)` helper, called from
  a `mediaById` lookup (`collectImageMediaIds` -> one `findMediaByIds` query,
  never one per image, D60) that every entry's editor loader and the public
  post/page loader build the same way - item 6b's pages loader reuses the
  identical contract verbatim. A `mediaId` with no matching row (the file was
  deleted from the library after being placed) degrades silently rather than
  being prevented (D61): the editor shows "no longer available", the public
  page drops the block and serves the rest of the entry. On the public site
  the image renders inside a `<figure>`, with a `<figcaption>` showing the
  media's `alt_text` (item 5c, D65) - on both posts and pages. The image's
  own `alt` attribute keeps the same text, so a screen reader announces it
  twice in a row; accepted rather than fixed, tracked live as F-79 pending
  the project's screen-reader pass. **This same silent-degrade rule was
  reused a third time by item 7b's own navigation `pageId`** (D83) - the
  pattern now has three independent consumers (image blocks, and since 7a
  the logo, though that one is a real foreign key by contrast - D77 - and
  now navigation items).
- **The format marker is enforced at both ends** (D31): the database refuses a
  write whose `blocks_format` is not the current one, the reader refuses a row
  whose format this build does not understand, and a save requires the row's
  own current format so a stale tab cannot silently downgrade newer content.
- **Values PostgreSQL cannot hold in `jsonb`** - U+0000, lone surrogates - are
  refused at the trust boundary (parser, schema, and the entry title) rather
  than reaching the database as a 500 (D32). **`site_settings.navigation` has
  no equivalent format guard on read** - it is trusted as `NavItem[]` with no
  runtime check, unlike `blocks_format`'s explicit marker; not reachable
  through the app's own request surface today since the only writer always
  validates first, but tracked as **F-96 (P3, open)** as a latent gap.

**Data rules:**

- Saving a published entry updates the live page (no revisions yet).
- Every save sends `version`; a stale save is rejected ("changed by someone else,
  reload").
- Upload: R2 object first, then the media row. Delete media: row first, then the
  object.
- **Users are deactivated, never deleted.**
- **The server's disk holds no state but the database** (D9).

### Where logic lives, and the auth boundary

- **All authorization, validation and rendering happen on the server.** The
  browser only runs the editor and uploads.
- Login -> JWT (7 days) in an **httpOnly, Secure, SameSite=Lax cookie**,
  host-only on the admin hostname (no `Domain`) - since D22's split is live,
  it never reaches the public site at all (F-71's comment describing the old
  single-origin behaviour is stale, open).
- **Every admin request loads the user from the database**, rejects a
  deactivated user or a `token_version` mismatch, and **reads the role from the
  database, never the token** - removals and role changes take effect at once
  (D6).
- **A role restriction beyond login is a separate, reusable middleware**
  (`requireRole`, D69, item 6a) - `app/features/auth/require-role.server.ts`,
  route-level rather than layout-level since posts and pages share a layout
  but not a role restriction. Refuses with the same 404-not-403 shape
  `findEntryForUser` uses for ownership, and logs the refusal (D70). Used by
  `/admin/pages*` (editor, admin only) and `/admin/settings*` (admin only,
  since item 7a); reusable as-is by item 8's admin-only user routes.
  - **Known residual (F-84, P3, open):** the log event's own `role` field is
    typed `string` rather than the real `Role` union - a one-line tightening,
    not a behavioral gap.
- Login rate-limited per IP and per email (IP from the rightmost
  `X-Forwarded-For` entry, which Caddy sets; IPv6 keyed per /64). Logged: failed
  logins, role changes, deactivations, password resets, and a role-based access
  refusal.
- **CSRF:** SameSite cookie plus an origin check in root middleware
  (`app/root.tsx`), scoped to `ADMIN_URL` only (item 4c) - the public site has
  no forms in v1, so a state-changing request there is refused by Origin
  mismatch alone, with no separate host check. **Item 7b did not change
  this** - the public header only renders links, no new public-facing form -
  so this scoping is still worth revisiting the moment one is added, and
  none is currently planned.
- Permissions: **author** - own posts (create, edit, publish, delete), upload
  media, delete own media; **editor** - all posts, pages and media; **admin** -
  everything plus settings and users. **Pages are editor/admin only, unlike
  posts** - an author never sees the "Pages" nav entry and gets 404 on every
  `/admin/pages*` route.
- **Uploads:** 10 MB cap; JPEG, PNG, WebP, GIF only - **no SVG**.
- **Content-Security-Policy is deliberately unset "until item 5 lands"**
  (`server.js:14`'s own comment) - item 5 has been fully shipped since item
  5c, so that trigger fired some time ago and this is still due, not merely
  deferred.
- **Editor.js's own injected CSS is overridden only inside the editor**
  (`.canvas`-scoped, one class more specific than the library's rule, so it wins
  on specificity rather than injection order) - D33.

### Quality bar (`blueprint/context/quality-bar.md`)

Public pages < 500 ms p95 server-side; admin saves < 1 s p95 (measured for
formatted posts: p95 65.1 ms; pages in item 6a: p95 51.7 ms). A page's public
route (item 6b) measured p95 3.5-4.3ms across three separate runs -
comfortably under the bar, expected since it reuses the identical query and
rendering path posts already measured at well under the target. The settings
save and both new chrome reads (item 7a) were checked against the same bars
during build and review - single-digit milliseconds each, not a formal
repeated-run p95 - comfortably under either bar. **Item 7b's own save
(title, logo and navigation together) and the header's new `<nav>` read on
every public page load were checked against the same two bars during build
and review and satisfied their done-when criteria**, but - unlike item 6b's
formal repeated-run measurement - no specific p95 number was recorded for
either; worth a formal measurement if this ever becomes the item under
suspicion for a regression. Up to ~10
admin users, a few thousand entries, media files and daily page views. Down
until noticed, but an uptime alert; at most 24 h of data loss (nightly
off-server backup); rebuild on a fresh server in under 1 hour. Security
standard: OWASP Top 10:2025. Accessibility standard: WCAG 2.2 AA, recorded
in `design.md`. Image resizing is explicitly out of v1
(`quality-bar.md`: "Image size on public pages: not measured, no target in
v1").

## Constraints

- **Server:** `ocwebserver` - Oracle Cloud VPS, Ubuntu 24.04, 2 vCPU, **954 MB
  RAM**. **Runs only this app** since 2026-09-16 (the test static site, `shelf`
  and hone leftovers were removed). Nothing memory-heavy; **never build on the
  server** (D14). A second web app likely needs a bigger VPS.
- **Environments (D21):** `development` (local, Docker PostgreSQL), `ci` (GitHub
  Actions, `npm run verify`), **`production` only** - no staging.
- **Production is live** (`deploy/setup-server.sh`, 2026-09-16): Node 26.8.2 at
  `/usr/local/bin/node`; PostgreSQL 16.15 on localhost, database and role
  `habre_cms`; systemd `habre-cms.service` as user `habre_cms` from
  `/srv/habre-cms/current` on `127.0.0.1:3000`; secrets in
  `/etc/habre-cms/production.env` (mode 600, generated on the server, never
  printed), backup credentials separately in root-only
  `/etc/habre-cms/backup.env`. Non-secret settings (`NODE_ENV`, `PORT`,
  `PUBLIC_URL`, `ADMIN_URL`) live in the unit - `APP_URL` no longer exists
  (item 4c).
- **Backups:** nightly `pg_dump` at 02:30 UTC to a private R2 bucket
  (`deploy/backup-db.sh`), dump checked before upload and its stored size
  re-read after. **Restore proven** by running the app against a restored copy.
  **Nothing alerts if a backup fails** - F-15, accepted by the owner until
  `monitor` runs.
- **Deploying:** files go over **`rsync` via SSH** (the server has no `git`).
  Releases in `/srv/habre-cms/releases/`, the `current` symlink picks one;
  rollback repoints it. Build locally or in CI; the server runs the artifact.
  **Rollback proven** 2026-09-16: back in 5 s, forward in 3 s, each confirmed by
  the behaviour only that release has. **A release with a migration cannot be
  rolled back this way** - reversing code does not reverse a schema (F-19).
  **Nor can a release that changes the systemd unit's env vars, by symlink
  alone** - discovered by item 4c's `APP_URL` -> `PUBLIC_URL`/`ADMIN_URL`
  rename (F-72, closed): the pre-4c unit file is saved at
  `/etc/habre-cms/habre-cms.service.pre-4c` so a rollback to `0ad8300`
  restores the unit alongside the symlink, not just the symlink.
- **Caddy** handles HTTPS and renews certificates. The repository owns only
  `deploy/caddy/habre-cms.caddy` - three site blocks (`cms.`, the public
  apex, and a `www` redirect, since item 4c) - imported by the server's main
  Caddyfile - **never replace the main Caddyfile** (D17, amended). The app
  listens on `127.0.0.1`; ports 3000 and 5432 are closed in both firewalls.
- **IPv4 only:** no IPv6 on the VM, no AAAA record; no `bind` in the site file.
  If IPv6 appears, re-check F-13 (an AAAA on the apex affects both hostnames).
- **No Docker on the server;** Docker is used only for the development database.
- **Portable:** everything rebuildable from the repository, a backup and fresh
  secrets (a rebuild generates new ones).
- **Env vars read today:** `DATABASE_URL`, `PUBLIC_URL`, `ADMIN_URL`,
  `JWT_SECRET`, `PORT`, `NODE_ENV`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
  `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL` - the app refuses to
  start without any of them (`env.server.ts`). `APP_URL` no longer exists
  (item 4c). **`.env.example`'s own comment still files the five `R2_*`
  variables under "needed by later items (not read yet)"** - stale since item
  5a started reading them; a small tidy for `docs` or the next touch of that
  file, not tracked as a findings-ledger entry since it is a comment, not
  behavior.
- **Rules from `AGENTS.md`:** never build on `main`; nothing committed without
  approval; never push or deploy without a separate yes.

## Current state

- **Build plan: items 1-7 are done.** Items 1, 2 (2a, 2b), 3, 4 (4a, 4b, 4c),
  5 (5a, 5b, 5c), 6 (6a, 6b) and **7 (7a Site title and logo, 7b Navigation
  menu)** are all checked off and archived under `blueprint/history/features/`.
  **Item 8 (Users and roles) is the only unchecked item left on the build
  plan.** `prototype` has run and its mockups are fully consumed and deleted;
  `design.md` stays as the permanent record of what they decided.
- **The public site now serves posts, pages, and a navigation menu, all from
  the same live `site_settings` row.** `/` lists the newest 10 published
  posts, newest first (D47), each linking to its own `/posts/:slug`. `/:slug`
  (item 6b) resolves a published page the same way - `findPublishedEntry`,
  `renderBlocks` - text, headings, lists, inline bold/italic/link formatting,
  a captioned image, all through JSX only, never an HTML-building helper
  (D26/D28). A page deliberately has no byline and no back link, unlike a
  post (D72-D74). A draft or missing post or page 404s inside the site's own
  header/footer chrome (D51), not root's bare error page. The header/footer
  read the live `site_settings` row (item 7a, D48) - title and logo in the
  header, title in the footer - and, **as of item 7b, the header also
  renders the saved navigation menu** as a `<nav aria-label="Site">` next to
  the title; an empty menu renders no `<nav>` at all.
- **Writing, managing, publishing and reading posts and pages all work**, in
  production as well as development, admin-side; pages, media, and now the
  site's navigation are all live on the public site, though **none of this
  is in production yet** (see below). `/admin/posts` and `/admin/pages`
  mirror each other exactly - `/admin/pages*` restricted to `editor` and
  `admin` (D69); an author gets the same 404 an ownership refusal already
  gives, and never sees the "Pages" nav entry.
- **What item 7a built and settled, item 7b built cleanly on top of, with no
  rework:** `site_settings` as a real singleton table, `getSiteSettings`/
  `updateSiteIdentity` touching only `site_title`/`logo_media_id`, and
  `requireRole` guarding `/admin/settings*` admin-only. 7b added its own
  `updateNavigation` (a sibling function, not a widened one - matches
  `saveEntry`'s own split from `updateDraft`, F-40) and two new read
  functions on `entries.server.ts`'s existing generic layer
  (`listPagesForNav`, `findPublishedPageSlugs`) - **no schema change, no new
  route, no new admin-shell nav entry.** The one carried-forward residual:
  **F-93 (P3, open)** - the settings screen's `useRouteLoaderData` fallback
  to a hardcoded id, unreachable today but a silent-data-loss risk if
  `admin-shell/layout.tsx` is ever renamed.
- **What item 7b itself built and settled:** reorder is move-up/move-down,
  not drag-and-drop (D80, no-JS-first, matching D10); add/remove/move are
  re-render-only intents on the same form Save persists, no separate draft
  storage (D81); a row needs exactly one of a page or a URL, checked at save
  rather than a type-toggle field (D82); `pageId` existence is checked at
  save time, publish status at render time - mirroring the image block's own
  split (D83); every rendered nav link is a plain `<a>`, not React Router's
  `<Link>`, since the resolved list mixes internal and external hrefs with
  no distinction kept around by render time (D84). **One regression was
  found and fixed in the same pass:** F-94 (P2) - adding several
  `type="submit"` buttons ahead of Save broke plain-Enter form submission
  (it either did nothing or added a blank row) - fixed with a hidden default
  submit button, verified with a real screen re-drive, and closed by review
  before shipping. **Two residuals recorded, not fixed:** F-95 (P3) - a page
  deleted after being linked reverts its row to "No page" with no visible
  warning and blocks Save on an untouched row; F-96 (P3) - `navigation` is
  trusted as `NavItem[]` on read with no runtime format guard, unlike
  `blocks_format`'s explicit marker, though not reachable through the app's
  own request surface today.
- **Production is behind `main` by seven sub-items.** Release `4165637`
  (deployed 2026-09-21) carries everything through item 4c. None of item 5's
  three sub-items (5a `d4950b6`, 5b `984b756`, 5c `d74822e`), item 6a
  (`e2f7f36`), item 6b (`8408f53`), item 7a (`bf055b0`), or **item 7b
  (`ef5d4d5`)** has been deployed: production has no `media` or
  `site_settings` table, no R2 credentials in
  `/etc/habre-cms/production.env`, and none of `/admin/media`, the picker, a
  captioned public image, `/admin/pages`, a public `/:slug`, `/admin/settings`,
  or the public navigation menu exist there yet - visitors still see the
  hardcoded "Habre CMS" chrome with no menu. Nothing urgent on its own, since
  a writer cannot reach any of it until then, but `deploy` now has items 5,
  6a, 6b, 7a and 7b queued as accumulated work, including the still-open
  production R2 token and bucket (`needs-you.md`).
- **Also done outside the build loop:** `preflight` (no-go for real users at
  first release, its findings now closed or accepted; a second milestone
  audit before the item-4 deploy raised F-72, closed), `host` (server,
  backups, restore, rollback), three `deploy` runs, and `docs` (real README,
  proven by running its commands).
- **`main` is pushed and in sync.** Item 2a went in through pull request #3,
  2b through #4, item 3 through #5, 4a through #6, 4b through #7, 4c through
  #8, 5a through #9, 5b through #10, 5c through #11, item 6a through pull
  request #12, item 6b through pull request #13, item 7a through pull
  request #14, and **item 7b through pull request #15**, all with CI green
  before merge. CI runs `verify` only, so the browser tests covering the
  worst defects in every item still gate nothing (F-17) - item 7a's own
  review remains the sharpest example of that gap: F-92 (P1 - the logo image
  resolving against the wrong URL and 404ing for every real visitor) was
  found only once a real Playwright test rendered the page.
- **Findings ledger: 45 entries live, none above P2.** P2: F-48, F-72 fixed ·
  F-17, F-25, F-29, F-69, F-70 open · F-22 unverified. P3: F-07, F-40, F-41,
  F-49, F-53, F-54, F-60 fixed · F-13, F-31, F-52, F-63, F-79, F-83
  unverified · F-19, F-20, F-23, F-24, F-26, F-27, F-38, F-39, F-50, F-51,
  F-55, F-56, F-58, F-59, F-61, F-62, F-64, F-71, F-78, F-84, F-86, F-93,
  **F-95, F-96** open. Every item's own findings are archived with that item
  under `blueprint/history/features/`, most recently **07b** (three entries:
  F-94 closed - found and fixed in the same review pass, then independently
  re-verified closed, not left `fixed`; F-16 and F-18 also swept out of the
  ledger into this archive per `ship`'s process, both unrelated to
  navigation - F-16 the backup-restore proof from item 4's preflight,
  F-18 the still-open accessibility-pass acceptance).
- **Next:** this `context` regeneration is done; `spec` item 8 (Users and
  roles) is the only remaining unchecked build item - the last one on the
  MVP plan. The Content-Security-Policy decision is still due (unchanged
  from the last regeneration), and `deploy` has items 5, 6a, 6b, 7a and 7b
  queued as accumulated work once the production R2 token and bucket exist
  (`needs-you.md`).
- **Remaining items, in order:** 8 Users and roles - the last item on the
  build plan. Once it ships, this project reaches the end of its planned
  first version; what comes after (a page builder is the recorded likely
  direction - section 11) is a decision for `ideate --rescope` or a fresh
  `spec`, not an existing queued item.
- **Waiting on the user** (`needs-you.md`): a custom domain for the R2 images
  bucket, and a production R2 token and bucket, both before item 5 reaches
  production; an UptimeRobot account (`monitor`, F-15); a screen-reader and
  keyboard pass over login, the admin shell, the posts list, the pages list
  (its editor and delete confirmation), the settings form and its logo
  picker dialog, and - now widened by item 7b - the navigation editor's
  add/remove/move-up/move-down buttons and page/URL fields; a screen-reader
  and keyboard pass over the public site, including a page and - now
  widened by item 7b - the header's navigation menu; deleting the old
  `hone.surenmaharjan.fyi` DNS record. The dev images bucket, backup bucket,
  and server software lines are recorded as **done**. **The local `.env`
  line (`PUBLIC_URL`/`ADMIN_URL`/`JWT_SECRET`) is still open in
  `needs-you.md`** despite being satisfied since item 6b's `build` - the
  same one-line tidy the last two regenerations both noted and neither
  closed. Worth closing explicitly this time rather than carrying it to a
  fourth regeneration.
