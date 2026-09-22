# Project Overview

> **Generated file.** Written by the `context` skill from blueprint/project-plan.md
> and blueprint/build-plan.md. This is the AI-facing source of truth loaded every
> session - edit the two planning docs and regenerate, rather than editing this
> file directly.

Generated 2026-09-22 at `main` `d4950b6`. Decision
numbers (D1-D57) refer to `dev-notes/decisions.md` - read the entry before
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
| Runtime | Node.js 26 (dev 26.8.1, CI and production 26.8.2) | Supported to 2029, LTS due Oct 2026 (D15) |
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
- **React Router 8 is newer than an agent's training.** The installed docs in
  `node_modules/react-router/docs/` are the authority; React Router's agent skill
  is at `.claude/skills/react-router/`. This app is **Framework Mode**.

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
  `0003_blocks_v2.sql`), `db/migrate.ts`; `scripts/create-admin.ts`; `deploy/` -
  `setup-server.sh`, `habre-cms.service`, `caddy/habre-cms.caddy` (written by
  `host`); `e2e/*.spec.ts`.
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
  serving after the deploy (`dev-notes/status.md`).

### Routes

- **Public** (server-rendered HTML, no login, works without JS): `/` latest
  published posts, newest 10, no pagination (D47) · `/posts/:slug` one post,
  its blocks rendered through JSX only, never an HTML-building helper
  (`render.tsx`, D26/D28) - both live at `surenmaharjan.fyi` since item 4c
  split the hostnames · `/:slug` one page (item 6 - not yet
  built) · `/healthz` (exists, reports database reachability). A draft or
  missing post 404s inside the public site's own header/footer chrome, not
  root's bare error page (D51). Reserved page slugs: `admin`, `posts`, `api`,
  `healthz`.
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
  `/admin/pages[/new|/:id]` (editor, admin, item 6 - not yet built) ·
  `/admin/media` (all roles - every signed-in role sees every upload, D54) and
  `/admin/media/:id/delete` (ownership-scoped for authors, the same
  404-not-403 pattern as posts) - item 5a, built; inserting an image into a
  post (5b) and rendering one on the public site (5c) are not yet built ·
  `/admin/settings` (admin, item 7 - not yet built) · `/admin/users[/:id]` -
  add, change role, reset password, deactivate (admin, item 8 - not yet
  built).
- **The admin shell's nav list grows one entry per shipped section** (D35) -
  "Posts" and, since item 5a, "Media"; a nav item for a route that does not
  exist yet is a dead link, so each remaining item adds its own entry when it
  ships.
- **The first admin is created by a server command (`npm run create-admin`),
  never a web setup page.**

### Data model (no site id on any table - D8)

- **users** - `id`, `email` (unique, case-insensitive), `name`, `password_hash`,
  `role` (admin | editor | author), `token_version`, `deactivated_at`,
  `created_at`, `updated_at` (exists: `0001_users.sql`)
- **entries** - posts **and** pages in one table (D5): `id`, `type` (post |
  page), `title`, `slug` (unique per type), `blocks` (JSON), `blocks_format`
  (**`v2`** - structured inline runs, D28), `status` (draft | published),
  `published_at`, `author_id` -> users, `version`, `created_at`, `updated_at`
- **media** - `id`, `storage_key`, `filename`, `mime_type`, `byte_size`, `width`,
  `height`, `alt_text`, `uploaded_by` -> users, `created_at` (exists:
  `0004_media.sql`, item 5a). Every signed-in role sees every upload; only
  deletion is ownership-scoped for authors (D54). Alt text is required at
  upload, stored once on the row, and not yet editable afterward (D55).
  `storage_key` is a generated `randomUUID` plus the detected extension,
  never derived from the client's filename (D56); the real bytes, not the
  browser's declared `Content-Type`, decide the image type via `image-size`
  (D57).
- **site_settings** - single row: `site_title`, `logo_media_id` -> media,
  `navigation` (JSON list of `{label, pageId | url}`), `updated_at`
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
  including `javascript:` (D30).
- **Image blocks store a media id, not a URL.** The URL is resolved at render
  time through one `buildMediaUrl(publicUrl, storageKey)` helper that both
  5b's editor preview and 5c's public renderer will call, so a bucket or
  domain change never touches content. The `media` table and its
  storage/upload path exist since item 5a; the image block itself (5b) and
  its public rendering (5c) are not yet built. The table has no caption
  column - `design.md`'s "muted caption" line under images is a gap 5c still
  has to resolve.
- **The format marker is enforced at both ends** (D31): the database refuses a
  write whose `blocks_format` is not the current one, the reader refuses a row
  whose format this build does not understand, and a save requires the row's
  own current format so a stale tab cannot silently downgrade newer content.
- **Values PostgreSQL cannot hold in `jsonb`** - U+0000, lone surrogates - are
  refused at the trust boundary (parser, schema, and the post title) rather than
  reaching the database as a 500 (D32).

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
  host-only on the admin hostname (no `Domain`) - now that D22's split is
  live, it never reaches the public site at all (F-71's comment describing
  the old single-origin behaviour is stale, open).
- **Every admin request loads the user from the database**, rejects a
  deactivated user or a `token_version` mismatch, and **reads the role from the
  database, never the token** - removals and role changes take effect at once
  (D6).
- Login rate-limited per IP and per email (IP from the rightmost
  `X-Forwarded-For` entry, which Caddy sets; IPv6 keyed per /64). Logged: failed
  logins, role changes, deactivations, password resets.
- **CSRF:** SameSite cookie plus an origin check in root middleware
  (`app/root.tsx`), scoped to `ADMIN_URL` only (item 4c) - the public site has
  no forms in v1, so a state-changing request there is refused by Origin
  mismatch alone, with no separate host check. **Revisit this scoping the
  moment a public-facing form is added** (none planned before item 7 at the
  earliest).
- Permissions: **author** - own posts (create, edit, publish, delete), upload
  media, delete own media; **editor** - all posts, pages and media; **admin** -
  everything plus settings and users.
- **Uploads:** 10 MB cap; JPEG, PNG, WebP, GIF only - **no SVG**.
- Content-Security-Policy is deliberately unset until item 5 lands.
- **Editor.js's own injected CSS is overridden only inside the editor**
  (`.canvas`-scoped, one class more specific than the library's rule, so it wins
  on specificity rather than injection order) - D33.

### Quality bar (`blueprint/context/quality-bar.md`)

Public pages < 500 ms p95 server-side; admin saves < 1 s p95 (measured for
formatted posts: p95 65.1 ms). Up to ~10 admin users, a few thousand entries,
media files and daily page views. Down until noticed, but an uptime alert; at
most 24 h of data loss (nightly off-server backup); rebuild on a fresh server in
under 1 hour. Security standard: OWASP Top 10:2025. Accessibility standard: WCAG
2.2 AA, recorded in `design.md`.

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
  rename (F-72, fixed): the pre-4c unit file is saved at
  `/etc/habre-cms/habre-cms.service.pre-4c` so a rollback to `0ad8300`
  restores the unit alongside the symlink, not just the symlink.
- **Caddy** handles HTTPS and renews certificates. The repository owns only
  `deploy/caddy/habre-cms.caddy` - now three site blocks (`cms.`, the public
  apex, and a `www` redirect, since item 4c) - imported by the server's main
  Caddyfile - **never replace the main Caddyfile** (D17, amended). The app
  listens on `127.0.0.1`; ports 3000 and 5432 are closed in both firewalls.
- **IPv4 only:** no IPv6 on the VM, no AAAA record; no `bind` in the site file.
  If IPv6 appears, re-check F-13 (an AAAA on the apex affects both hostnames).
- **No Docker on the server;** Docker is used only for the development database.
- **Portable:** everything rebuildable from the repository, a backup and fresh
  secrets (a rebuild generates new ones).
- **Env vars read today:** `DATABASE_URL`, `PUBLIC_URL`, `ADMIN_URL`,
  `JWT_SECRET`, `PORT`, `NODE_ENV` - `APP_URL` no longer exists (item 4c).
  `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`,
  `R2_PUBLIC_URL` since item 5a - the app now refuses to start without them,
  the same as `JWT_SECRET`.
- **Rules from `AGENTS.md`:** never build on `main`; nothing committed without
  approval; never push or deploy without a separate yes.

## Current state

- **Build plan: items 1-4 and item 5a are done** - items 1, 2 (2a, 2b), 3,
  4 (4a, 4b, 4c) and 5a are all checked off and archived under
  `blueprint/history/features/`. Item 5 (Images) is in progress: 5a shipped
  (storage and the media library); 5b (insert images into posts) and 5c
  (render images on the public site) are next. Nothing in flight
  (`current-work.md` is empty). `prototype` has run and its mockups are
  **fully consumed and deleted**; `design.md` stays as the permanent record
  of what they decided.
- **The public site is real and live in production.** `/` lists the newest 10
  published posts, newest first (D47), each linking to its own
  `/posts/:slug`, which renders the post's blocks - text, headings, lists,
  inline bold/italic/link formatting - through JSX only, never an
  HTML-building helper (`render.tsx`, D26/D28). A draft or missing post 404s
  inside the site's own header/footer chrome (D51), not root's bare error
  page. The header/footer are fixed placeholder text until item 7 wires up
  `site_settings` (D48). Measured against the quality bar, not assumed: p95
  for both routes is single-digit milliseconds against the production build,
  far under the 500 ms target. **Reachable at its real address**,
  `https://surenmaharjan.fyi`, since item 4c's deploy - not only under
  `cms.surenmaharjan.fyi/` as before.
- **Writing, managing, publishing and reading posts all work, in production
  as well as development.** `/admin/posts/new` and `/admin/posts/:id` save
  drafts through Editor.js, with structured inline formatting stored as
  canonical runs in `blocks_format` `v2` (D28), never HTML. `/admin/posts`
  lists them - role-scoped, filterable, searchable, paginated - and
  `/admin/posts/:id/delete` removes one after a confirmation screen (item 3).
  The editor also publishes and unpublishes (item 4a, D42-D46): a
  `Publish`/`Unpublish` button next to Save, only once a post has been saved
  once (D45); `published_at` is set the first time and kept across every
  later unpublish, per the schema's own comment rather than a new decision.
  **Production has all three migrations applied** (`0001_users.sql`,
  `0002_entries.sql`, `0003_blocks_v2.sql`) as of the item-4 deploy.
- **What item 2b settled, for the items that read it:** a piece of text is a
  list of `{ text, bold?, italic?, href? }` runs, canonical (one stored form per
  text); links are checked against an allowlist enforced at both the parser and
  the schema (D30); the format marker is enforced at both ends so a stale write
  or an unreadable row fails loudly rather than silently (D31); values
  PostgreSQL cannot hold in `jsonb` are refused at the boundary (D32); the
  public renderer must render through JSX, never an HTML-building helper
  (D26, amended by D28) - **item 4b is that renderer**, now built; a post's
  address is chosen once at creation (D25); untrusted structure is bounded by
  name rather than hoped about (D27).
- **What item 3 settled, for item 4a to reuse rather than re-invent:**
  `listEntries(actor, query)` and its `{ entries, total, totalPages, counts }`
  shape are load-bearing - `saveEntry`'s content+status save reads through the
  same query, never a second one (D34's routes table entry); a successful
  redirect-producing action reports itself through `?deleted=<title>` (D37) -
  item 4a generalized this into `readBanner`/`bannerRedirect`
  (`app/features/content/banner.ts`, D46), which delete now shares too;
  `PAGE_SIZE` is server-only, the client works from a derived `totalPages`
  (D40, discovered by React Router's build refusing to bundle a server
  constant into the browser).
- **What item 4a settled, for item 4b and later items to reuse:** `saveEntry`
  (renamed from `updateDraft`, closing F-40) takes an optional status
  transition and applies it in the *same* atomic update as the content save,
  never two requests (D42). `banner.ts` is now the one place a
  redirect-with-announcement to `/admin/posts` is built (D46). The success
  banner had **no "view it on the site" link** - item 4b did not add it
  either, since a link still needs a real target the reader can trust; worth
  revisiting now that `/posts/:slug` exists.
- **What item 4b settled, for item 4c and later items to reuse:**
  `renderBlocks`/`renderRuns` (`app/features/blocks/render.tsx`) take a plain
  `Block[]`/`Run[]`, not an `Entry` - entry-type-agnostic on purpose, so item
  6 (pages) reuses the same renderer rather than building a second one
  (Data and contracts, archived `04b`). The public layout's header/footer
  live in a shared `Chrome` component used by both the normal page and its
  `ErrorBoundary` (D52) - React Router's error boundary *replaces* its
  route's own component entirely rather than nesting inside it, so any future
  public route adding its own `ErrorBoundary` should follow the same shape or
  lose its chrome. **A pre-existing, unrelated defect surfaced while
  verifying this item, filed as F-69**: `server/app.ts` never passes a
  `mode` to `createRequestHandler`, so every error has been sanitized as if
  in production - regardless of `NODE_ENV` - since item 1; `root.tsx`'s own
  dev-mode stack trace has never actually shown one. Left open for a future
  item; no end-user impact, since production is supposed to sanitize anyway.
- **What item 4c settled, for item 5 and later items to reuse:**
  `resolveHostRouting` (`app/lib/host-routing.ts`) is a pure function -
  `{ method, pathname, search, requestHost, publicHost, adminHost,
  publicOrigin, adminOrigin }` in, `allow` / `redirect` / `not-found` out -
  the contract any future host-aware redirect reuses. **No new decisions** -
  D22 already settled the domains, the `/admin` prefix and the redirect
  semantics; this item only implemented what D22 recorded. The one thing worth
  naming for later readers: CSRF is scoped to `ADMIN_URL` only, not both
  hosts, on the assumption the public site has no forms - revisit that
  assumption before item 7 adds one.
- **What item 5a built, for 5b and 5c to build against:** any signed-in
  writer can upload a JPEG/PNG/WebP/GIF up to 10 MB to Cloudflare R2 through
  `/admin/media`, see it in a shared library - every role sees every upload
  (D54) - and delete their own (authors) or any (editor/admin) upload behind
  a confirmation screen, the same 404-not-403 pattern as posts. Upload
  validates the real image bytes with `image-size` rather than trusting the
  browser's `Content-Type` (D57); the R2 object is written before the
  database row on upload, and the row is removed before the object on
  delete, both per the plan's own data rules. Alt text is required at
  upload and captured once on the media row, not per block-use (D55) - the
  only place in v1 that touches it, so every image 5b places already has
  one. Storage keys are generated (`randomUUID` plus the detected
  extension), never derived from the client's filename (D56). **What 5b and
  5c reuse rather than re-derive** (`Data and contracts`, archived `05a`):
  the `media` table's exact shape; a media id is the only thing a block will
  ever store, resolved to a URL at read time through one `buildMediaUrl`
  helper; the table carries no caption column, which 5c still has to
  resolve against `design.md`'s "muted caption" line. Review found three
  findings, all repaired and closed within the item (archived as `05a/F-73`
  - the delete link had no per-item accessible name, unlike posts' own
  already-solved version of the same problem; `05a/F-74` - a failed R2
  delete showed a generic error page even though the row, the actual source
  of truth, was already gone; `05a/F-75` - a page number past the last page
  showed a false empty state, the same bug F-56 found for posts).
- **Production is one item behind `main`.** Release `4165637` (deployed
  2026-09-21) carries everything through item 4c - items 1, 2a, 2b, 3, 4a, 4b
  and 4c, all of it, behind both live hostnames. Item 5a (`d4950b6`, merged
  2026-09-22) has not been deployed: production has no `media` table, no R2
  credentials in `/etc/habre-cms/production.env`, and `/admin/media` does not
  exist there yet - nothing urgent on its own, since 5a is storage and a
  library screen with nothing wired to the post editor or the public site
  yet, but it means `deploy` has real work queued, including the still-open
  production R2 token and bucket (`needs-you.md`). The previous release,
  `0ad8300`, was items 1-3 only; no new migration shipped with item 4
  (`0001`-`0003` were already applied by the `0ad8300` deploy). This is the
  first deploy where a
  symlink-only rollback would have been wrong (F-72, fixed) - the systemd
  unit's env vars changed (`APP_URL` -> `PUBLIC_URL`/`ADMIN_URL`), so the
  pre-4c unit was saved alongside the pre-4c release for a paired restore.
  The first release, `48e5052`, had shipped with a P0 - behind Caddy every
  form POST was rejected, so login was impossible - fixed by
  `fix/trust-forwarded-proto` (D23) and proven in production.
- **Also done outside the build loop:** `preflight` (no-go for real users at
  first release, its findings now closed or accepted; a second milestone
  audit before this item-4 deploy raised F-72, repaired same-day), `host`
  (server, backups, restore, rollback), three `deploy` runs, and `docs` (real
  README, proven by running its commands).
- **`main` is pushed and in sync.** Item 2a went in through pull request #3,
  item 2b through pull request #4, item 3 through pull request #5, item 4a
  through pull request #6, item 4b through pull request #7, item 4c through
  pull request #8, and **item 5a through pull request #9**, all with CI
  green before merge - the loop the workflow recommends. CI runs `verify`
  only, so the browser tests covering the worst defects in every item still
  gate nothing (F-17).
- **Item 2b's review, across two independent passes, found and closed six
  findings** (archived as `2b/F-37`, `2b/F-43`..`2b/F-47`): a heading's Bold
  un-bolding text with no way to save it back; an app-wide selection-colour
  override that rested on a misreading; refusal messages that named the wrong
  rule; a stale-format write with no guard; a missing format check on read; and
  a NUL character reaching the database as a 500. **The second pass, after the
  first repair round, found three more** (F-48, F-49, F-53 - a toolbar focus
  ring invisible against hover, the NUL fix not covering lone surrogates, and an
  unmeasured contrast claim in `design.md`), all repaired and shipped in the
  same item. Three findings from that second pass remain open at P3 (F-50,
  F-51) and unverified (F-52) - none blocking.
- **Item 3's review found eleven findings; two were repaired and shipped in
  the same item** (F-54 - four bare element selectors in `post-list.module.css`
  leaking into the global stylesheet; F-60 - unqualified `author_id`/`status`/
  `title` columns in a query newly joined to `users`, which the repair itself
  nearly reintroduced in a fourth query before it was caught in review of the
  fix). The other nine (F-55 through F-59, F-61 through F-64) are `open` or
  `unverified` at P3 - a server/browser timezone mismatch on the "last changed"
  date, a page-past-the-end showing a false "no matches", a doubled auth
  check, an extra redirect hop through the guarded `/admin`, no submit control
  on the search box, two possible screen-reader gaps, and two stale reference
  screenshots.
- **Item 4a's review found two findings, and closed both within the item** -
  the first time a review's own findings were fully closed before shipping,
  rather than carried to a later pass. Archived as `4a/F-57` (the
  delete/publish/unpublish banner text was attacker-controlled and unbounded
  - fixed by capping it to the title's own 200-character limit) and
  `4a/F-65` (the banner-redirect one-liner had drifted to three copies -
  extracted into `banner.ts`). F-40 (`updateDraft`'s misleading name) was
  fixed in the same item by the `saveEntry` rename.
- **Item 4b's review found three findings, and closed all three within the
  item too** (archived as `04b/F-66`, `04b/F-67`, `04b/F-68`): the public
  layout's `ErrorBoundary` showed less diagnostic detail in development than
  root's own does (fixed by mirroring root's pattern, though its practical
  effect waits on F-69); two of six new tests lacked shown-to-fail proof
  (both proven afterward, no code change needed); `design.md`'s contrast
  table had no row for a pairing this item actually introduced (added: 5.9
  light / 7.8 dark, both comfortably passing AA). F-69 (above) stayed open,
  as an unrelated discovery.
- **Item 4c's review found two findings, both left open (P2/P3, neither
  blocking):** F-70 - `routeByHost`'s two refusal branches (wrong method on
  the wrong host; a host matching neither) log nothing, unlike the CSRF
  middleware two lines below it in the same file - a detection gap, not a
  bypass. F-71 - the session cookie's comment still describes the pre-split,
  single-origin reality ("the public site receives it but never reads it"),
  when the cookie now never reaches the public site at all. **Preflight's
  milestone audit before this deploy found a third, F-72** (the env-var
  rename breaking the proven symlink-only rollback) - **repaired same-day**,
  see *Production is caught up* above.
- **Findings ledger: 39 total, none above P2** and nothing `open` or `fixed`
  at P0/P1. P2: F-48, F-72 `fixed` · F-16 `closed` · F-18 `accepted` ·
  F-17, F-25, F-29, F-69, F-70 open · F-22 unverified. P3: F-07, F-40, F-41,
  F-49, F-53, F-54, F-60 `fixed` · F-13, F-31, F-52, F-63 unverified ·
  F-19, F-20, F-23, F-24, F-26, F-27, F-38, F-39, F-50, F-51, F-55, F-56,
  F-58, F-59, F-61, F-62, F-64, F-71 open. **F-15 [P1] remains accepted by
  the owner** - nothing alerts when the live system breaks, until `monitor`
  runs. Item 5a's own review found three findings (`05a/F-73`, `05a/F-74`,
  `05a/F-75`), all repaired and closed within the item - archived with the
  feature rather than carried in this ledger, so the 39-total count above is
  unchanged by item 5a shipping.
- **Next:** `context` regeneration is done (this file); `spec` item 5b
  (insert images into posts - an Editor.js image block backed by the media
  library) is the next unchecked build item. `deploy` also has item 5a
  queued once the production R2 token and bucket exist (`needs-you.md`).
  `monitor` is still worth running soon, now the public site is live and has
  real visitors reachable for the first time.
- **Remaining items, in order:** 5b Insert images into posts · 5c Render
  images on the public site · 6 Pages · 7 Site settings and menu · 8 Users
  and roles.
- **Waiting on the user** (`needs-you.md`): a custom domain for the R2
  images bucket, and a production R2 token and bucket, both before item 5
  reaches production - the local `.env`'s `R2_PUBLIC_URL` is now set to the
  bucket's `r2.dev` address, which item 5a built and shipped against, but
  that address is rate-limited and not meant for real traffic; an
  UptimeRobot account (`monitor`, F-15); a screen-reader and keyboard pass
  over login, the admin shell, the posts list (filter tabs, search, delete
  confirmation) and the block editor including its inline toolbar (F-18,
  accepted for this release by the owner); **a screen-reader and keyboard
  pass over the public site** - home, one post, the 404 - still open, and
  now live in production, not just development; deleting the old
  `hone.surenmaharjan.fyi` DNS record. The dev images bucket, backup bucket,
  server software and local `.env` lines are **done**.
