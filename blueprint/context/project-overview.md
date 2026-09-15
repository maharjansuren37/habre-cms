# Project Overview

> **Generated file.** Written by the `context` skill from blueprint/project-plan.md
> and blueprint/build-plan.md. This is the AI-facing source of truth loaded every
> session - edit the two planning docs and regenerate, rather than editing this
> file directly.

Generated 2026-09-15 at `main` `ece826c`. Decision numbers (D1-D20) refer to
`dev-notes/decisions.md` - read the entry before changing anything it covers.

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
| Runtime | Node.js 26 (dev 26.8.1, CI 26.8.2) | Supported to 2029, LTS due Oct 2026 (D15) |
| Framework | React Router 8.3.1 framework mode, React 19.3.0, Vite 8.3.0, served by `node:http` - **no Express** | Small, low memory, forms work without JS (D10, D17) |
| Database | PostgreSQL 16; `postgres` 3.4.9 driver, **raw SQL, no ORM**; numbered `.sql` migrations via `db/migrate.ts` | Four tables do not need an ORM (D11) |
| Styling | Plain CSS: custom properties for light/dark tokens, CSS Modules. **No Tailwind** | `prototype` tokens map straight to CSS variables (D12) |
| Auth | JWT with `jose` 6.2.12; passwords with `node:crypto` scrypt. **No auth library** | (D6) |
| Validation | Zod 4.6.5 at every trust boundary | |
| Editor | Editor.js 2.31.6 + header and list tools | Saves the `{id, type, data}` block shape directly (D13) |
| Media | Cloudflare R2 via `aws4fetch` 1.0.20; `image-size` 2.0.4 | Uploads through the app server (D7) |
| Lint / format | Biome 2.5.13 | (D19) |
| Tests | `node:test` unit tests; Playwright 1.63.0 (Chromium) browser tests | |
| Monitoring | UptimeRobot on `/healthz`, alerts by email; logs to the systemd journal | |

- **Not installed until their item:** `jose` (item 1), Editor.js and tools
  (item 2), `aws4fetch` and `image-size` (item 5) (D20).
- **React Router 8 is newer than an agent's training.** The installed docs in
  `node_modules/react-router/docs/` are the authority; React Router's agent skill
  is at `.claude/skills/react-router/`. This app is **Framework Mode**.

## Architecture

**One application, deployed once** (D4). No background jobs, no cache, no queue,
no multi-write transactions - the six system-design questions were all "no", and
nothing should be added to the design that they did not call for.

### Layout (D16)

- `app/routes.ts` lists every URL; route modules live inside
  `app/features/<feature>/` (`auth`, `users`, `content`, `blocks`, `media`,
  `settings`, `public-site`); cross-feature code in `app/lib/`
  (`db.server.ts`, `env.server.ts`).
- `server.js` (+ `server/app.ts`): the Node entry - Vite middleware in dev; in
  production serves `build/client` itself and sets security headers (D18).
- `db/migrations/NNNN_name.sql`, `db/migrate.ts`; `scripts/create-admin.ts`
  (item 1); `deploy/` (setup script, systemd unit, Caddy site file - written by
  `host`); `e2e/*.spec.ts`.
- **Imports:** `#app/...` with explicit `.ts`/`.tsx` extensions. **Never a `~/`
  alias** - plain `node` cannot resolve it.
- **Boundary per file, not per directory:** `*.server.ts` = server only (the
  build fails if browser code imports it); `*.client.tsx` = browser only
  (Editor.js). Loaders and actions run on the server.
- Unit-testable logic goes in `.ts` files beside a `*.test.ts` - `node --test`
  cannot run `.tsx`.

### Routes

- **Public** (server-rendered HTML, no login, works without JS): `/` latest
  published posts · `/posts/:slug` one post · `/:slug` one page · `/healthz`
  (exists). Unknown or draft content -> 404. Reserved page slugs: `admin`,
  `posts`, `api`, `healthz`.
- **Admin** (login required): `/admin/login` · `/admin/posts[/new|/:id]` (all
  roles; authors only their own) · `/admin/pages[/new|/:id]` (editor, admin) ·
  `/admin/media` (all roles) · `/admin/settings` (admin) ·
  `/admin/users[/:id]` - add, change role, reset password, deactivate (admin).
- **The first admin is created by a server command, never a web setup page.**

### Data model (no site id on any table - D8)

- **users** - `id`, `email` (unique, case-insensitive), `name`, `password_hash`,
  `role` (admin | editor | author), `token_version`, `deactivated_at`,
  `created_at`, `updated_at`
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
- Login -> JWT (7 days) in an **httpOnly, Secure, SameSite=Lax cookie**.
- **Every admin request loads the user from the database**, rejects a
  deactivated user or a `token_version` mismatch, and **reads the role from the
  database, never the token** - removals and role changes take effect at once
  (D6).
- Login rate-limited per IP and per email. Logged: failed logins, role changes,
  deactivations, password resets. CSRF: SameSite cookie plus an origin check.
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
10:2025. Accessibility standard: WCAG 2.2 AA, recorded by `prototype` in
`design.md`.

## Constraints

- **Server:** `ocwebserver` - Oracle Cloud VPS, Ubuntu 24.04, 2 vCPU, **954 MB
  RAM**, shared with the static site `surenmaharjan.fyi`. Nothing memory-heavy;
  **never build on the server** (D14).
- **Not yet installed there:** Node 26 and PostgreSQL 16.
- **Caddy** handles HTTPS. The repository owns only
  `deploy/caddy/habre-cms.caddy`, imported by the server's main Caddyfile -
  **never replace the main Caddyfile** (D17). The app listens on `127.0.0.1`.
- **No Docker on the server;** systemd service plus an in-repo setup script. Docker
  is used only for the development database.
- **Portable:** everything rebuildable from the repository, a backup and the
  secrets.
- **Domain:** `cms.surenmaharjan.fyi` (production `APP_URL=https://cms.surenmaharjan.fyi`). **R2 account not
  created yet.**
- **Rules from `AGENTS.md`:** never build on `main`; nothing committed without
  approval; never push or deploy without a separate yes.

## Current state

- **Build plan: 0 of 8 items done.** Nothing in flight (`current-work.md` is
  empty).
- **Done before the build loop:** plan, architecture, stack, layout; scaffold
  (app starts, `/` and `/healthz` serve, dev database in Docker); CI on GitHub
  Actions running `npm run verify` on pull requests and pushes to `main` - green
  on `main` at `ece826c`.
- **Next:** `prototype` (no visual direction exists and ease of use is the
  product), then `spec` for **item 1 - Admin login**.
- **Remaining items, in order:** 1 Admin login · 2 Write a post · 3 Manage
  posts · 4 Publish to the public site · 5 Images · 6 Pages · 7 Site settings and
  menu · 8 Users and roles.
- **Waiting on the user** (`needs-you.md`): R2 bucket and token (blocks item 5);
  DNS record for the CMS; Node 26 + PostgreSQL 16 + database on the VPS (needed
  by `host`); off-server backup location; UptimeRobot account; deleting the old
  `hone.surenmaharjan.fyi` DNS record.
