# Project Overview

> **Generated file.** Written by the `context` skill from
> `blueprint/project-plan.md` and `blueprint/build-plan.md`. Edit those and
> regenerate - never edit this file by hand. It orients; the files it names are
> the record. Decision numbers (D1-D132) are entries in `dev-notes/decisions.md` -
> read the entry before changing anything it covers.

Generated 2026-10-01 from `main` (`7bc4356`).

## What this is

**Habre CMS** - a website management system like WordPress, but **really easy**
for the non-technical people who edit content. Editors write, manage and publish
one website's content in a block editor, and the CMS serves the public site
itself, so no developer is needed to put content online (D1).

- **Authors and editors** at a small organisation, **admins** who set it up and
  manage users, **visitors** with no accounts. A handful of users per site; one
  site per installation (D2, D8).
- **Ease of use is the product:** few screens, obvious next actions, no settings
  an editor does not need. Light and dark mode in admin and public site.
- Meant to become a hosted service later; no billing or signup now.

## Scope

**First version (all built):** login with a 1-week session and no signup; posts
and pages in a block editor (text, heading, image, list; bold, italic, links);
draft / publish / unpublish; image upload and a media library; a public site in
one built-in theme; site title, logo and navigation menu; author / editor /
admin roles with user management; light and dark mode.

**After MVP (built):** item 9 - an admin picks one published page as `/`, with a
welcome placeholder until one is chosen; `/` never lists posts, which live at
`/posts` (D107).

**Active direction (D113, rescope 2026-10-01): a first-cut page builder**,
items 10-12. **Item 10 is built:** a page is an ordered list of 1-30 sections
(`blocks_format` v3, move up/down buttons, D114-D118); v2 pages load as one
section and convert on save; posts stay flat. **Item 11 is built:** a section
has 1-3 columns, one Editor.js each, stacked below `48rem`; fewer columns merge,
never discard (D119-D124). **Item 12 is split:** **12a is built** - a
ready-made `hero` section (heading, text, optional button; plain-string slots,
its own section type, "Add hero section" in the editor; D125-D132); **12b** call
to action and **12c** image + text are next. No drag-and-drop, no new runtime
dependency.

**Deferred - do not build unasked.** Full list and reasons: plan section 11.
Soon after: reusable saved sections, section styling, page templates,
categories and tags, scheduling and revisions, SEO and sitemap, password reset
by email, custom domains. Later or never: free-form canvas, custom CSS/HTML,
headless API, multiple themes, many sites, WordPress import, plugins.

## Stack

Pinned versions and reasons: plan section 5 and `AGENTS.md` *Stack and
versions*. **Minimal dependencies is a constraint** - a new runtime dependency is
a recorded decision.

- TypeScript 7.0.2, strict, `erasableSyntaxOnly` (no `enum`/`namespace`) - Node
  runs `.ts` by stripping types. Node.js 26 (D15).
- **React Router 8.3.1 framework mode**, React 19.3.0, Vite 8.3.0, on `node:http`
  via `@remix-run/node-fetch-server` with `trustProxy` - **no Express** (D10,
  D17, D23). React Router 8 is newer than an agent's training: the installed
  docs in `node_modules/react-router/docs/` decide.
- PostgreSQL 16, `postgres` driver, **raw SQL, no ORM**, numbered `.sql`
  migrations run by `db/migrate.ts` (D11).
- Plain CSS with custom-property tokens and CSS Modules, **no Tailwind** (D12);
  the look is in `blueprint/context/design.md`.
- Auth: `jose` JWT + `node:crypto` scrypt, **no auth library** (D6). Zod at every
  trust boundary.
- Editor.js with header and list tools; the image tool is hand-written (D13,
  D58). Media in Cloudflare R2 via `aws4fetch`, types checked by `image-size`.
- Biome; `node:test` unit tests; Playwright (Chromium) browser tests.

## Architecture

Full detail: plan section 6. **One application, deployed once** (D4) - no
background jobs, cache, queue or multi-write transactions; do not add them
without a requirement that calls for them.

- **Layout (D16):** `app/routes.ts` lists every URL; route modules live in
  `app/features/<feature>/` (`auth`, `admin-shell`, `users`, `content`,
  `blocks`, `media`, `settings`, `public-site`); shared code in `app/lib/`.
  `server.js` + `server/app.ts` are the Node entry; `db/` migrations; `e2e/`
  browser tests; `deploy/` server setup, systemd unit, Caddy site file.
  Conventions (imports, `.server.ts` / `.client.tsx`, tests): `coding-standards.md`.
- **Two hostnames, one app (D22):** `surenmaharjan.fyi` serves the public site,
  `cms.surenmaharjan.fyi` the admin under `/admin`. Host routing runs before any
  route (`app/lib/host-routing.ts`); `PUBLIC_URL` and `ADMIN_URL` are equal in
  development.
- **Routes:** public `/` (chosen home page, else a welcome placeholder - D107),
  `/posts`, `/posts/:slug`, `/:slug`, `/healthz` - server-rendered,
  work without JavaScript. Admin `/admin/posts`, `/pages`, `/media`,
  `/settings`, `/users`. First admin comes from `npm run create-admin`, never a
  web page.
- **Data model** (no site id - D8): `users`, `entries` (posts and pages in one
  table, D5), `media`, `site_settings` (single row), `schema_migrations`.
- **Blocks** are an ordered list of `{id, type, data}`. Text is structured runs,
  **never raw HTML**, escaped on render (D28-D30); links pass an allowlist.
  Image blocks store a media id, resolved at render (D60).
- **Data rules:** every save sends `version` and a stale save is rejected; R2
  object before media row on upload, row before object on delete; **users are
  deactivated, never deleted**; the server's disk holds no state (D9).

### Where logic lives and the auth boundary

- **Authorization, validation and rendering all happen on the server.** The
  browser only runs the editor and uploads.
- JWT (7 days) in an httpOnly, Secure, SameSite=Lax cookie, host-only on the
  admin hostname.
- **Every admin request loads the user from the database** and reads the role
  from there, never the token. A `token_version` bump takes effect on the next
  request (D6).
- Role checks beyond login use `requireRole` and refuse with 404 (D69, D70).
- CSRF: SameSite plus an origin check against `ADMIN_URL`.
- Admins cannot change their own role or deactivate themselves (D85, D86).
- Permissions: **authors** own posts and media, **editors** all content,
  **admins** also settings and users. Pages are editor/admin only.
- Uploads: 10 MB, JPEG/PNG/WebP/GIF, **no SVG**.

## Constraints

- **Server:** `ocwebserver`, an Oracle Cloud VPS (Ubuntu 24.04, 2 vCPU,
  **954 MB RAM**), running only this app. Nothing memory-heavy, **never build on
  the server** (D14), no Docker there.
- **Environments (D21):** `development`, `ci`, `production` - no staging. Each
  one's config and secrets: `AGENTS.md` *Environments*.
- **Deploys:** `rsync` releases over SSH, with a `current` symlink for rollback.
  Caddy terminates HTTPS; the repository owns only its site file, never the main
  Caddyfile. A release carrying a migration cannot be rolled back by symlink.
- **Portable:** rebuildable from the repository, a backup and fresh secrets.
  Nightly `pg_dump` goes to a private R2 bucket.
- **Standards:** OWASP Top 10:2025, WCAG 2.2 AA, performance and availability
  in `blueprint/context/quality-bar.md`.
- **`AGENTS.md` rules:** never build on `main`; nothing committed without
  approval; never push or deploy without a separate yes.

## Current state

- **Plan:** items 1-11 and 12a done, archived in `blueprint/history/features/`;
  12b, 12c open; nothing in flight. Next: `spec` for 12b.
- **Live:** production runs release `135bd1d`, through item 11 (migration `0007`
  applied). **12a is merged, not deployed** - deploy 12a-12c together; no
  symlink rollback once a page has a hero. See `blueprint/production-pending.md`.
- **Principles:** none recorded (`blueprint/context/principles.md`).
- **Records:** findings in `blueprint/context/findings.md` and
  `blueprint/findings/backlog.md`; work only the owner can do in
  `needs-you.md`.
