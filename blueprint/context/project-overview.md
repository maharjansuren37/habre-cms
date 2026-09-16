# Project Overview

> **Generated file.** Written by the `context` skill from blueprint/project-plan.md
> and blueprint/build-plan.md. This is the AI-facing source of truth loaded every
> session - edit the two planning docs and regenerate, rather than editing this
> file directly.

Generated 2026-09-16 at `main` `52c2670` (record edits uncommitted). Decision
numbers (D1-D23) refer to `dev-notes/decisions.md` - read the entry before
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
list); draft / publish / unpublish; image upload and a reusable media library;
a public site rendered from published content with one built-in theme; site
title, logo and navigation menu; three roles; light and dark mode in admin and
public site.

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
| Editor | Editor.js 2.31.6 + header and list tools | Saves the `{id, type, data}` block shape directly (D13) |
| Media | Cloudflare R2 via `aws4fetch` 1.0.20; `image-size` 2.0.4 | Uploads through the app server (D7) |
| Lint / format | Biome 2.5.13 | (D19) |
| Tests | `node:test` unit tests; Playwright 1.63.0 (Chromium) browser tests | |
| Monitoring | UptimeRobot on `/healthz`, alerts by email; logs to the systemd journal | |

- **Not installed until their item:** Editor.js and tools (item 2), `aws4fetch`
  and `image-size` (item 5) (D20).
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
- `db/migrations/NNNN_name.sql` (`0001_users.sql` exists), `db/migrate.ts`;
  `scripts/create-admin.ts`; `deploy/` - `setup-server.sh`, `habre-cms.service`,
  `caddy/habre-cms.caddy` (written by `host`); `e2e/*.spec.ts`.
- **Imports:** `#app/...` with explicit `.ts`/`.tsx` extensions. **Never a `~/`
  alias** - plain `node` cannot resolve it.
- **Boundary per file, not per directory:** `*.server.ts` = server only (the
  build fails if browser code imports it); `*.client.tsx` = browser only
  (Editor.js). Loaders and actions run on the server.
- Unit-testable logic goes in `.ts` files beside a `*.test.ts` - `node --test`
  cannot run `.tsx`.

### Hostnames (D22 - decided, built in item 4)

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
- **Until item 4 ships:** the app reads one `APP_URL`, and production runs on
  `cms.surenmaharjan.fyi` only; the apex serves nothing.

### Routes

- **Public** (server-rendered HTML, no login, works without JS): `/` latest
  published posts · `/posts/:slug` one post · `/:slug` one page · `/healthz`
  (exists, reports database reachability). Unknown or draft content -> 404.
  Reserved page slugs: `admin`, `posts`, `api`, `healthz`.
- **Admin** (login required): `/admin/login`, `/admin/logout`, `/admin` (exist
  since item 1) · `/admin/posts[/new|/:id]` (all roles; authors only their own) ·
  `/admin/pages[/new|/:id]` (editor, admin) · `/admin/media` (all roles) ·
  `/admin/settings` (admin) · `/admin/users[/:id]` - add, change role, reset
  password, deactivate (admin).
- **The first admin is created by a server command (`npm run create-admin`),
  never a web setup page.**

### Data model (no site id on any table - D8)

- **users** - `id`, `email` (unique, case-insensitive), `name`, `password_hash`,
  `role` (admin | editor | author), `token_version`, `deactivated_at`,
  `created_at`, `updated_at` (exists: `0001_users.sql`)
- **entries** - posts **and** pages in one table (D5): `id`, `type` (post |
  page), `title`, `slug` (unique per type), `blocks` (JSON), `blocks_format`,
  `status` (draft | published), `published_at`, `author_id` -> users, `version`,
  `created_at`, `updated_at`
- **media** - `id`, `storage_key`, `filename`, `mime_type`, `byte_size`, `width`,
  `height`, `alt_text`, `uploaded_by` -> users, `created_at`
- **site_settings** - single row: `site_title`, `logo_media_id` -> media,
  `navigation` (JSON list of `{label, pageId | url}`), `updated_at`
- **schema_migrations** - owned by the migration runner: `filename`,
  `applied_at`. No library owns any other table.

**Blocks:** an ordered list of `{id, type, data}`. Text is **structured data,
never raw HTML**, escaped on render (inline formatting is decided in item 2's
spec). Image blocks store a **media id, not a URL**. A page builder later adds
container blocks with `children`.

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
  (`app/root.tsx`) - today against `APP_URL`, after item 4 against `ADMIN_URL`
  only, so every state-changing request to the public host is refused.
- Permissions: **author** - own posts (create, edit, publish, delete), upload
  media, delete own media; **editor** - all posts, pages and media; **admin** -
  everything plus settings and users.
- **Uploads:** 10 MB cap; JPEG, PNG, WebP, GIF only - **no SVG**.
- Content-Security-Policy is deliberately unset until item 5 lands.

### Quality bar (`blueprint/context/quality-bar.md`)

Public pages < 500 ms p95 server-side; admin saves < 1 s p95. Up to ~10 admin
users, a few thousand entries, media files and daily page views. Down until
noticed, but an uptime alert; at most 24 h of data loss (nightly off-server
backup); rebuild on a fresh server in under 1 hour. Security standard: OWASP Top
10:2025. Accessibility standard: WCAG 2.2 AA, recorded in `design.md`.

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
  item 4.
- **Rules from `AGENTS.md`:** never build on `main`; nothing committed without
  approval; never push or deploy without a separate yes.

## Current state

- **Build plan: 1 of 8 items done** - item 1 *Admin login* shipped (archived in
  `blueprint/history/features/01-admin-login.md`). Nothing in flight
  (`current-work.md` is empty). `prototype` has run (`design.md` exists).
- **It is live and working.** Production serves `https://cms.surenmaharjan.fyi`
  from release `52c2670`; an admin account exists and the owner has logged in
  through a browser. The first release `48e5052` shipped with a P0 - behind
  Caddy every form POST was rejected, so login was impossible - fixed by
  `fix/trust-forwarded-proto` (D23) and proven in production.
  **Until item 4, everything is on `cms`; the apex serves nothing.**
- **Also done outside the build loop:** `preflight` (no-go for real users, its
  two P1s now closed or accepted), `host` (server, backups, restore, rollback),
  two `deploy` runs, and `docs` (real README, proven by running its commands).
- **`main` is 4 commits ahead of `origin/main` and has never been pushed**, so
  this machine holds the only copy and **CI has not checked anything since
  `48e5052`**. Record edits from the last deploy are uncommitted.
- **Open findings:** F-16 [P2] `fixed` (restore now proven, `preflight` closes) ·
  F-17 [P2] browser tests never run in CI · F-18 [P2] accessibility never checked
  by hand · F-22 [P2] `unverified` (trusting forwarded headers; the production
  half is disproven) · F-19, F-20, F-23, F-24 [P3] · F-07 [P3] `fixed` (evidence
  now recorded) · F-13 [P3] `unverified`. **F-15 [P1] was accepted by the owner**
  - nothing alerts when the live system breaks, until `monitor` runs.
- **Next:** commit the record edits, push `main` (needs a separate yes), then
  `spec` **item 2 - Write a post**. `monitor` whenever the owner is ready.
- **Remaining items, in order:** 2 Write a post · 3 Manage posts · 4 Publish to
  the public site (includes the D22 hostname split) · 5 Images · 6 Pages · 7 Site
  settings and menu · 8 Users and roles.
- **Waiting on the user** (`needs-you.md`): a public URL for the R2 images bucket
  and a production R2 token (both item 5); an UptimeRobot account (`monitor`,
  F-15); a screen-reader and keyboard pass over login and the admin shell
  (F-18); deleting the old `hone.surenmaharjan.fyi` DNS record. The images
  bucket, backup bucket, server software and local `.env` lines are **done**.
