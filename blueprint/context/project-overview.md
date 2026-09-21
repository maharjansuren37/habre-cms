# Project Overview

> **Generated file.** Written by the `context` skill from blueprint/project-plan.md
> and blueprint/build-plan.md. This is the AI-facing source of truth loaded every
> session - edit the two planning docs and regenerate, rather than editing this
> file directly.

Generated 2026-09-21 at `main` `c7ff306`. Decision
numbers (D1-D46) refer to `dev-notes/decisions.md` - read the entry before
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

- **Not installed until their item:** `aws4fetch` and `image-size` (item 5)
  (D20). Editor.js 2.31.6 with `@editorjs/header` 2.8.9 and `@editorjs/list`
  2.0.9 arrived with item 2a, pinned exactly; their shipped `.ts` types use
  `enum`, so `app/types/editorjs.d.ts` describes what this app uses.
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

### Hostnames (D22 - decided, built in item 4c)

One app answers two hostnames; Caddy proxies both to the same process.

| Hostname | Serves |
|---|---|
| `surenmaharjan.fyi` | the public site: `/`, `/posts/:slug`, `/:slug` |
| `cms.surenmaharjan.fyi` | the admin: `/admin/*`; `/` redirects to `/admin` |
| `www.surenmaharjan.fyi` | redirects to the apex (in Caddy) |

- **Config:** `PUBLIC_URL` and `ADMIN_URL` replace today's single `APP_URL`.
  When equal (development, browser tests on one port) the app acts as one host
  and redirects nothing.
- **Routing by host, before any route runs:** admin path on the public host ->
  same path on the admin host; public path on the admin host -> public host.
  GET/HEAD only, **temporary** redirects; any other method on the wrong host
  gets 404. `/healthz` answers on both. A host matching neither gets 404.
- **Admin stays under `/admin`** - the prefix keeps admin and public routes from
  colliding and lets development run on one host. `/cms` was rejected.
- Admin "view" links are absolute on `PUBLIC_URL`; public pages never link to
  the admin. Browser tests need two local hostnames (`127.0.0.1`, `localhost`).
- **Until item 4c ships:** the app reads one `APP_URL`, and production runs on
  `cms.surenmaharjan.fyi` only; the apex serves nothing.

### Routes

- **Public** (server-rendered HTML, no login, works without JS): `/` latest
  published posts · `/posts/:slug` one post · `/:slug` one page · `/healthz`
  (exists, reports database reachability). Unknown or draft content -> 404.
  Reserved page slugs: `admin`, `posts`, `api`, `healthz`.
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
  `/admin/media` (all roles, item 5 - not yet built) · `/admin/settings`
  (admin, item 7 - not yet built) · `/admin/users[/:id]` - add, change role,
  reset password, deactivate (admin, item 8 - not yet built).
- **The admin shell's nav list grows one entry per shipped section** (D35) -
  today only "Posts"; a nav item for a route that does not exist yet is a dead
  link, so each remaining item adds its own entry when it ships.
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
  `height`, `alt_text`, `uploaded_by` -> users, `created_at`
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
  time, so a bucket or domain change never touches content. (Item 5, not yet
  built.)
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
  host-only on the admin hostname (no `Domain`), so it never reaches the public
  site once D22 lands.
- **Every admin request loads the user from the database**, rejects a
  deactivated user or a `token_version` mismatch, and **reads the role from the
  database, never the token** - removals and role changes take effect at once
  (D6).
- Login rate-limited per IP and per email (IP from the rightmost
  `X-Forwarded-For` entry, which Caddy sets; IPv6 keyed per /64). Logged: failed
  logins, role changes, deactivations, password resets.
- **CSRF:** SameSite cookie plus an origin check in root middleware
  (`app/root.tsx`) - today against `APP_URL`, after item 4c against `ADMIN_URL`
  only, so every state-changing request to the public host is refused.
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
  `APP_URL`) live in the unit.
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
- **Caddy** handles HTTPS and renews certificates. The repository owns only
  `deploy/caddy/habre-cms.caddy`, imported by the server's main Caddyfile -
  **never replace the main Caddyfile** (D17, amended). The app listens on
  `127.0.0.1`; ports 3000 and 5432 are closed in both firewalls.
- **IPv4 only:** no IPv6 on the VM, no AAAA record; no `bind` in the site file.
  If IPv6 appears, re-check F-13 (an AAAA on the apex affects both hostnames).
- **No Docker on the server;** Docker is used only for the development database.
- **Portable:** everything rebuildable from the repository, a backup and fresh
  secrets (a rebuild generates new ones).
- **Env vars read today:** `DATABASE_URL`, `APP_URL`, `JWT_SECRET`, `PORT`,
  `NODE_ENV`. `R2_*` from item 5; `PUBLIC_URL`/`ADMIN_URL` replace `APP_URL` in
  item 4c.
- **Rules from `AGENTS.md`:** never build on `main`; nothing committed without
  approval; never push or deploy without a separate yes.

## Current state

- **Build plan: items 1, 2 (2a and 2b), 3, and 4a done** - archived under
  `blueprint/history/features/`. Item 4 split into 4a/4b/4c at spec time
  (item 4a was too big to review as one bundle with the public renderer and
  the hostname split); 4a is done, **4b and 4c are not started**. Nothing in
  flight (`current-work.md` is empty). `prototype` has run (`design.md`
  exists).
- **Writing, managing, and now publishing posts all work, in development
  only.** `/admin/posts/new` and `/admin/posts/:id` save drafts through
  Editor.js, with structured inline formatting (bold, italic, links) stored as
  canonical runs in `blocks_format` `v2` (D28), never HTML. `/admin/posts`
  lists them - role-scoped, filterable by status, searchable by title,
  paginated at 20 a page - and `/admin/posts/:id/delete` removes one after a
  confirmation screen (item 3, D34-D40). **As of item 4a, the editor also
  publishes and unpublishes** (D42-D46): a `Publish`/`Unpublish` button next
  to Save, only once a post has been saved once (D45); `published_at` is set
  the first time and kept across every later unpublish, per the schema's own
  comment (`0002_entries.sql`) rather than a new decision. **Production has
  none of `0002_entries.sql`, `0003_blocks_v2.sql` applied** - the next deploy
  needs `migrate` to run both, in order, before the release; neither item 3
  nor item 4a added a schema change.
- **What item 2b settled, for the items that read it:** a piece of text is a
  list of `{ text, bold?, italic?, href? }` runs, canonical (one stored form per
  text); links are checked against an allowlist enforced at both the parser and
  the schema (D30); the format marker is enforced at both ends so a stale write
  or an unreadable row fails loudly rather than silently (D31); values
  PostgreSQL cannot hold in `jsonb` are refused at the boundary (D32); **item
  4b's public renderer still must render through JSX, never an HTML-building
  helper** (D26, amended by D28); a post's address is chosen once at creation
  (D25); untrusted structure is bounded by name rather than hoped about (D27).
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
  never two requests (D42) - the pattern for any future action that changes
  both content and a status flag together. `banner.ts` is now the one place a
  redirect-with-announcement to `/admin/posts` is built (D46); a future
  row-level action on that list should call `bannerRedirect`, not write the
  string again. The success banner has **no "view it on the site" link yet**
  (D44) - item 4b adds it once `/posts/:slug` is real.
- **It is live and working, but four items behind.** Production serves
  `https://cms.surenmaharjan.fyi` from release `52c2670` - **item 1 (admin
  login) only**: that release predates item 2a (`52c2670` ships only
  `db/migrations/0001_users.sql`, confirmed directly on the server), so
  **items 2a, 2b, 3 and 4a have none of their code or migrations in
  production yet**. An admin account exists and the owner has logged in
  through a browser. The first release `48e5052` shipped with a P0 - behind
  Caddy every form POST was rejected, so login was impossible - fixed by
  `fix/trust-forwarded-proto` (D23) and proven in production. **Until item
  4c, everything is on `cms`; the apex serves nothing.**
- **Also done outside the build loop:** `preflight` (no-go for real users, its
  two P1s now closed or accepted), `host` (server, backups, restore, rollback),
  two `deploy` runs (both before item 2b), and `docs` (real README, proven by
  running its commands).
- **`main` is pushed and in sync.** Item 2a went in through pull request #3,
  item 2b through pull request #4, item 3 through pull request #5, and
  **item 4a through pull request #6**, all with CI green before merge - the
  loop the workflow recommends. CI runs `verify` only, so the browser tests
  covering the worst defects in every item still gate nothing (F-17).
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
  the first time a review's own findings were fully closed (not just fixed)
  before shipping, rather than carried to a later pass. Archived as
  `4a/F-57` (the delete/publish/unpublish banner text was attacker-controlled
  and unbounded - fixed by capping it to the title's own 200-character limit
  in `readBanner`; the "no proof this happened" half is deliberately left as
  an accepted low-reach property of URL-param banners) and `4a/F-65` (the
  banner-redirect one-liner had drifted to three copies across two files -
  extracted into `banner.ts` alongside F-57's fix, since both touched the
  same code). F-40 (`updateDraft`'s misleading name, found in item 3's
  review) was fixed in the same item, by the `saveEntry` rename - still
  `fixed`, not yet `closed`, since it was fixed in the step before this
  item's own review ran, and stays in the live ledger rather than being
  archived here.
- **Open findings:** 35 in the ledger, **none above P2** and nothing `open` or
  `fixed` at P0/P1. P2: F-16, F-48 `fixed` (F-16's restore proven, `preflight`
  closes) · F-17, F-18, F-25, F-29 open · F-22 unverified. P3: F-07, F-40,
  F-41, F-49, F-53, F-54, F-60 `fixed` · F-13, F-31, F-52, F-63 unverified ·
  F-19, F-20, F-23, F-24, F-26, F-27, F-38, F-39, F-50, F-51, F-55, F-56,
  F-58, F-59, F-61, F-62, F-64 open. **F-15 [P1] was accepted by the
  owner** - nothing alerts when the live system breaks, until `monitor` runs.
- **Next:** `context` regeneration is done (this file); `spec` item 4b
  (Render the public site) to keep building, or `deploy` first to carry items
  2b, 3 and 4a to production (needs `migrate` for `0002` and `0003` in order
  before the release - `0003` is unaffected by 4a, which added no migration).
- **Remaining items, in order:** 4b Render the public site · 4c Split the
  hostnames (D22) · 5 Images · 6 Pages · 7 Site settings and menu · 8 Users
  and roles.
- **Waiting on the user** (`needs-you.md`): a public URL for the R2 images
  bucket and a production R2 token (both item 5); an UptimeRobot account
  (`monitor`, F-15); a screen-reader and keyboard pass over login, the admin
  shell, the posts list (filter tabs, search, delete confirmation) and the
  block editor including its inline toolbar (F-18, F-29); deleting the old
  `hone.surenmaharjan.fyi` DNS record. The images bucket, backup bucket, server
  software and local `.env` lines are **done**.
