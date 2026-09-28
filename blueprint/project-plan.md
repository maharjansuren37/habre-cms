# Project Plan

> One of the two planning docs you own. Answer each section in a line or two -
> a worksheet, not an essay. Draft it yourself, or let the AI help you sharpen
> it; either way the content is yours to direct. When it is filled in, run the
> `context` skill to generate the project overview from this plus
> blueprint/build-plan.md.

## 1. Problem - what are we solving?

WordPress is the default way to run a content website, but it is heavy and
confusing for the people who actually edit the content. Habre CMS is a website
management system that makes writing, managing and publishing a site's content
**really easy** - and serves the public site itself, so no developer is needed
to put content online.

## 2. Users - who is this for?

- **Editors and authors** at a small organisation managing one website's
  content - not developers.
- **Admins** who set the site up and decide who can edit it.
- **Visitors** read the public site and have no accounts.
- Starting small: a handful of users per site.
- Not for developers wanting a headless API, and not for people wanting a
  drag-and-drop page builder - both deferred (section 11).

## 3. Features - what does the first version need?

- Log in and out; 1-week session; no public signup.
- Write posts and pages in a block editor with basic blocks: text, heading,
  image, list.
- Save as draft, publish, unpublish.
- Upload images and reuse them from a media library.
- Public site rendered from published content with one built-in theme.
- Site settings: title, logo, navigation menu.
- Users and roles:
  - **Author** - writes and publishes their own posts.
  - **Editor** - manages everyone's content.
  - **Admin** - everything an editor can do, plus users and settings.
- Light and dark mode in both the admin area and the public site.

## 4. Data - what are we storing?

Users (with role), posts, pages (both made of content blocks), media (metadata
here; files in Cloudflare R2), site settings, navigation menu.

## 5. Tech - what stack are we using?

Written by `stack` (2026-09-15). Minimal dependencies: each new runtime
dependency is a decision recorded in `dev-notes/decisions.md`.

- **Platform:** web - browser-based admin plus a server-rendered public site.
- **Language:** TypeScript **7.0.2** (installed by `scaffold`) - all code.
- **Lint / format:** Biome **2.5.13** (added by `scaffold`, D19).
- **Runtime:** Node.js **26** everywhere `engines` requires it. Installed
  versions differ by machine: 26.8.1 on the dev machine, 26.8.2 in production;
  CI installs whatever is newest under the `26` major at each run, not pinned
  to a patch (`.github/workflows/ci.yml`). All will move to the first 26 LTS
  release when it is promoted (expected October 2026). React Router 8 requires
  >= 22.22.
- **Framework:** React Router **8.3.1**, framework mode; React **19.3.0**;
  Vite **8.3.0**. Served by a plain `node:http` server through
  `@remix-run/node-fetch-server` (see *Node server* below) - no Express. v8 is newer than an agent's training; its installed
  docs in `node_modules/react-router/docs/` are the authority.
- **Database:** PostgreSQL **16** (Ubuntu 24.04 packages). Driver `postgres`
  **3.4.9**, raw SQL. Migrations are numbered `.sql` files applied by a small
  in-repo runner that records them in `schema_migrations`. Development runs
  PostgreSQL 16 in Docker (`postgres:16-alpine`) on the dev machine - Arch packages 18,
  which would not match production.
- **Styling:** plain CSS - custom properties for light/dark tokens, CSS Modules
  (built into Vite). No CSS framework.
- **Auth:** JWT via `jose` **6.2.12**; passwords hashed with `node:crypto`
  scrypt. No auth library.
- **Validation:** Zod **4.6.5** at every trust boundary.
- **Node server:** `@remix-run/node-fetch-server` **0.14.1** - the listener is
  built from it directly so `trustProxy` can be set, which is what makes the app
  read Caddy's `X-Forwarded-Proto` (D23, fixes F-21).
- **Bot detection:** `isbot` **5.2.2** - required by React Router's default
  server entry (added by `scaffold`, D20).
- **Block editor:** Editor.js (`@editorjs/editorjs` **2.31.6**) with `@editorjs/header`
  **2.8.9** and `@editorjs/list` **2.0.9** (installed with item 2a, pinned exactly);
  the image tool is hand-written in the repo, not a package (D58). Their shipped `.ts` types use `enum`,
  which `erasableSyntaxOnly` forbids, so `app/types/editorjs.d.ts` describes the
  surface we use and `tsconfig.vite.json` maps the packages to it.
- **Media:** `aws4fetch` **1.0.20** for R2's S3 API; `image-size` **2.0.4**.
- **Installed with their item, not at scaffold:** `jose` (item 1), Editor.js and
  its header and list tools (item 2), `aws4fetch` and `image-size` (item 5) - so
  no package sits in `package.json` with nothing calling it. Versions above stay
  the pins.
- **Testing:** `node:test` (built in) for unit tests; `@playwright/test`
  **1.63.0** for browser tests and screenshots.
- **Monitoring:** UptimeRobot free tier checks `/healthz` and **alerts by
  email**. App logs go to the systemd journal. No error-tracking service in v1.

## 6. Architecture - how is it structured?

Written by `architect` (2026-09-15). `layout` adds the directory tree beneath
the part count once the framework is known.

### Shape questions

| Question | Answer |
|---|---|
| More than one deployable service? | **No** - one application serves admin, public site and its endpoints. |
| Work outside a request? | **No** - nothing in v1 is scheduled or slow; images stored as uploaded. Scheduled publishing or image resizing (both deferred) would make this yes. |
| Consistency across more than one write? | **No** - every v1 action is a single-row write. One cross-system pair (R2 file + media row) cannot share a transaction; handled by write order (see Data rules). |
| Dependency whose failure is unacceptable? | **No** - PostgreSQL down means site down, accepted on one VPS. R2 down means images missing, text still served. |
| Real load or a hard latency target? | **No** - see `blueprint/context/quality-bar.md`. Concurrent writers: a handful of editors at most; same-entry collisions caught by a version check. |
| Rate-limited or unreliable external API? | **No** - R2 is the only external service. |

**System design does not apply:** single process, one database, no background
work, no cache.

### Parts

**One application, deployed once.** Admin, public site and endpoints share the
same data, ship together, and have one owner. A headless API later is extra
routes in the same app, not a second part.

### Layout

Written by `layout` (2026-09-15). Follows React Router 8's `node-custom-server`
template, with route modules kept inside their feature (D16).

```
habre-cms/
├── app/                        source root (React Router convention)
│   ├── root.tsx                HTML shell, theme switch, error boundary
│   ├── routes.ts               every URL, pointing at route modules inside features
│   ├── app.css                 global CSS: design tokens, light/dark
│   ├── features/
│   │   ├── auth/               login/logout routes, JWT + scrypt (*.server.ts), request guard
│   │   ├── users/              admin user routes, user queries
│   │   ├── content/            post + page admin routes, entry queries, version check
│   │   ├── blocks/             block types, Zod schemas, HTML renderer,
│   │   │                       editor.client.tsx (Editor.js wrapper, browser only)
│   │   ├── media/              media library route, upload handler, R2 client (*.server.ts)
│   │   ├── settings/           settings route, navigation menu
│   │   └── public-site/        /, /posts/:slug, /:slug, /healthz, 404
│   └── lib/                    cross-feature code: db.server.ts, env.server.ts, logging
├── server/app.ts               builds React Router's request listener (template convention)
├── server.js                   node:http entry: Vite middleware in dev, build output in production
├── db/
│   ├── migrations/             0001_users.sql, ... applied in order
│   └── migrate.ts              migration runner, run with plain `node`
├── scripts/create-admin.ts     first-admin command, run on the server
├── deploy/
│   ├── setup-server.sh         installs Node 26, PostgreSQL 16, the service, the Caddy site
│   ├── habre-cms.service       systemd unit
│   └── caddy/habre-cms.caddy   this app's site block only, imported by the server's main Caddyfile
├── e2e/                        Playwright tests (*.spec.ts)
├── public/                     copied into the build as-is - favicon only
├── compose.yaml                development-only PostgreSQL 16 container
├── .env.example                variable names, no values
├── package.json · package-lock.json · react-router.config.ts · vite.config.ts
├── tsconfig.json · tsconfig.node.json · tsconfig.vite.json · playwright.config.ts
├── AGENTS.md · CLAUDE.md · blueprint/ · dev-notes/    workflow files
└── build/ · .react-router/ · node_modules/            generated, gitignored
```

**Conventions:**

- **No client/server directory split.** A route module holds both: `loader` and
  `action` run on the server and are stripped from the browser bundle; the
  component renders on both. The boundary is marked per file:
  - `*.server.ts` - server only (database, JWT, R2, env). The build fails if
    browser code imports one.
  - `*.client.ts(x)` - browser only (Editor.js).
  - Everything else runs in both on purpose (block renderer, Zod schemas).
- **Imports:** `#app/...` with an explicit `.ts` extension, declared once in
  `package.json` `"imports"`. No `~/` alias - plain `node` cannot resolve it
  (`ERR_MODULE_NOT_FOUND`), and the migration runner, `create-admin` and unit
  tests run under plain `node`.
- **Tests:** unit tests colocated as `*.test.ts`, testing logic in `.ts` files
  (plain `node` cannot run `.tsx`). Browser tests in `e2e/*.spec.ts`.
- **Config** lives at the repository root - it is the only part.

**Ecosystem traps this avoids:**

- **Test discovery by path:** Node treats a `test/` directory as tests, so
  browser tests live in `e2e/`. Playwright's default pattern also matches
  `*.test.ts`, so its config sets `testDir: "e2e"`.
- **Wholesale copy:** `public/` ships to visitors as-is - nothing private in it.
- **A shared server config:** Caddy on `ocwebserver` is managed by hand and may
  serve other apps later (D17), so the repository owns only `deploy/caddy/habre-cms.caddy`, pulled in by an
  `import` line in the server's main Caddyfile - never the whole Caddyfile.
- **Silently unchecked files:** the template's TypeScript configs cover only
  `app/`, `server/`, `server.js` and `vite.config.ts`. `db/`, `scripts/`, `e2e/`
  and `playwright.config.ts` must be added, or `tsc` never checks them.

**Verified** in `node:26-alpine` (Node 26.8.2, TypeScript 7.0.2, Vite 8.3.0),
2026-09-15: `node --test` found and passed `app/**/*.test.ts` and did not run
`e2e/*.spec.ts`; `#app/*` imports resolved under plain `node`, `tsc` and a Vite
build; `~/` failed under plain `node`.

**Settled by `scaffold` (2026-09-15):** TypeScript 7.0.2 works with React
Router 8 typegen and `tsc -b` - no fallback needed, and the typecheck was shown
to fail on errors planted in `app/`, `db/`, `e2e/` and `server.js`.
`build/client` is served by `server.js` (D18). Tests sit beside their subject as
`<name>.test.ts`. Additions to the tree: `db/pending-migrations.ts` (pure logic,
unit-tested), `db/dev/init.sh` (creates the non-superuser role in the dev
container), `db/migrations/.gitkeep`, `biome.json`. React Router's agent skill
lives in `.agents/skills/react-router/` and `.claude/skills/react-router/`.

### Platform and organisation

- **Platform:** web - browser-based admin plus a server-rendered public website.
  No mobile app, no offline/PWA.
- **Organised by feature:** `auth`, `users`, `content` (posts and pages),
  `blocks`, `media`, `settings`, `public-site`.
- **`blocks` is the one shared module:** block type definitions, validation and
  HTML rendering, defined once and used by the editor, the server and the public
  site. A page builder later extends this module.

### Hostnames

One application answers two hostnames (D22); Caddy proxies both to the same
process. Decided 2026-09-16; built in item 4.

| Hostname | Serves |
|---|---|
| `surenmaharjan.fyi` | the public site: `/`, `/posts/:slug`, `/:slug` |
| `cms.surenmaharjan.fyi` | the admin: `/admin/*`; `/` redirects to `/admin` |
| `www.surenmaharjan.fyi` | redirects to `surenmaharjan.fyi` (in Caddy) |

- **Two origins in config:** `PUBLIC_URL` and `ADMIN_URL` replace `APP_URL`.
  When they are equal (development, browser tests on one port) the app behaves
  as one host and redirects nothing.
- **The app routes by the request's host before any route runs:**
  - An admin path on the public host redirects to the same path on the admin
    host; a public path on the admin host redirects to the public host.
  - Only GET and HEAD redirect; any other method on the wrong host gets 404.
  - Redirects are temporary: browsers cache permanent ones indefinitely, and
    hostnames change once custom domains arrive.
  - `/healthz` answers on both hosts.
  - A host matching neither gets 404. Only Caddy reaches the app, and it
    forwards only these names.
- **Admin stays under `/admin` on its own host.** The prefix keeps admin and
  public routes from colliding and lets one-host development work; no route
  moves and the reserved slugs are unchanged. `/cms` was considered and lost: it
  reads `cms.surenmaharjan.fyi/cms/...` and buys nothing.
- **Links across hosts are absolute:** admin "view" links use `PUBLIC_URL`;
  public pages never link to the admin.

### Routes

**Public** - server-rendered HTML, no login, works without JavaScript:

| Route | Shows |
|---|---|
| `/` | latest published posts |
| `/posts/:slug` | one post |
| `/:slug` | one page |
| `/healthz` | health check, including database reachability |

- Unknown or draft content returns 404.
- Reserved slugs pages cannot take: `admin`, `posts`, `api`, `healthz`.

**Admin** - login required, interactive in the browser:

| Route | Who |
|---|---|
| `/admin/login` | anyone |
| `/admin/posts`, `/admin/posts/new`, `/admin/posts/:id` | all roles (authors see and edit only their own) |
| `/admin/pages`, `/admin/pages/new`, `/admin/pages/:id` | editor, admin |
| `/admin/media` | all roles |
| `/admin/settings` - title, logo, menu | admin |
| `/admin/users`, `/admin/users/:id` - add, change role, reset password, deactivate | admin |

Each admin action has a server handler; its exact shape follows the framework's
conventions.

**The first admin is created by a command run on the server, not a web setup
page** - an open setup page on a freshly deployed server belongs to whoever
reaches it first.

### Data model

One site per installation - no site id on any table (D8).

- **users** - `id`, `email` (unique, case-insensitive), `name`,
  `password_hash`, `role` (admin | editor | author), `token_version`,
  `deactivated_at`, `created_at`, `updated_at`
- **entries** - posts and pages in one table: `id`, `type` (post | page),
  `title`, `slug` (unique per type), `blocks` (JSON), `blocks_format`, `status`
  (draft | published), `published_at`, `author_id` -> users, `version`,
  `created_at`, `updated_at`
- **media** - `id`, `storage_key`, `filename`, `mime_type`, `byte_size`,
  `width`, `height`, `alt_text`, `uploaded_by` -> users, `created_at`
- **site_settings** - a single row: `site_title`, `logo_media_id` -> media,
  `navigation` (JSON list of `{label, pageId | url}`), `updated_at`
- **schema_migrations** - owned by the in-repo migration runner: `filename`,
  `applied_at`. No library creates any other table.

**Blocks** are an ordered list of `{id, type, data}`:

- A page builder adds container block types with `children`; existing content
  stays valid. `blocks_format` versions the format for future changes.
- **Text is stored as structured data, never raw HTML**, and escaped on render.
  Inline formatting is bold, italic and links, stored as structured runs
  (`blocks_format` v2, D28-D30).
- **Image blocks store a media id, not a URL.** The URL is resolved at render
  time, so a bucket or domain change never touches content.

### Data rules

- Saving a published entry updates the live page (revisions are deferred).
- Every save sends the entry's `version`; if someone saved in between, the save
  is rejected with "changed by someone else, reload".
- **Upload:** write the R2 object first, then the media row. A failure between
  leaves an unreferenced object - harmless.
- **Delete media:** remove the row first, then the object.
- **Users are deactivated, never deleted** - authorship stays intact and nothing
  needs reassigning.
- **The server's disk holds no state but the database.** No local uploads, no
  config edited by hand on the server (D9).

### Where logic lives

All on the server: authorization, block validation, rendering. The browser
handles admin interactivity only - the editor and uploads - and never decides
permissions.

### Auth boundary

- Email and password -> JWT signed with a server secret, 7-day expiry, in an
  **httpOnly, Secure, SameSite=Lax cookie** - not browser storage, which page
  scripts can read.
- **Every admin request loads the user from the database** and rejects it if
  deactivated or if `token_version` does not match the token. **Role is read
  from the database, never from the token.** Removing a user, changing a role or
  resetting a password bumps `token_version` and takes effect immediately. Cost:
  one indexed lookup per admin request (D6).
- Login is rate-limited per IP and per email.
- Logged: failed logins, role changes, deactivations, password resets.
- State-changing requests are protected against cross-site request forgery by
  the SameSite cookie plus an origin check against `ADMIN_URL`. The public site
  has no forms in v1, so every state-changing request to the public host is
  refused.
- The session cookie is host-only on the admin hostname (no `Domain`
  attribute), so browsers never send it to the public site.
- Public routes need no auth; drafts are never served publicly.

| | Author | Editor | Admin |
|---|---|---|---|
| Posts | own: create, edit, publish, delete | all | all |
| Pages | - | all | all |
| Media | upload; delete own | all | all |
| Settings, users | - | - | yes |

### Integrations

- **Cloudflare R2** - stores images; served to visitors from the bucket's public
  URL.
  - **Uploads go through the app server** (D7): 10 MB cap; JPEG, PNG, WebP, GIF
    only. **No SVG** - it can carry script.
- **Nothing else.** No email, analytics, cache or CDN beyond R2.

### Scaling ceiling

One VPS. The first thing likely to break is **large unresized images making
public pages heavy**, then rendering CPU under a traffic spike. If the
performance bar is missed, the first fix is caching rendered public pages,
invalidated on entry save, publish/unpublish, and settings change.

**Many sites later:** a database per site with the same tables; the app picks
the database from the request's domain. Reconsider shared tables with a site id
at hundreds of sites (D8).

## 7. UI/UX - how should it look and feel?

- **Ease of use is the product.** The editing experience must be clearly simpler
  than WordPress for a non-technical editor: few screens, obvious next actions,
  no settings they don't need.
- Light and dark mode from the first screen, not added later - admin area and
  public site both.
- No specific visual reference yet; `prototype` settles the look.

## 8. Deployment - where and how does it ship?

Known so far: an **Oracle Cloud VPS**, with **PostgreSQL 16 installed on the
same server** (2026-09-16, `deploy/setup-server.sh`). Images go to **Cloudflare R2**.

From `architect`:

- **Domains (D22, 2026-09-16):** public site `surenmaharjan.fyi`
  (`PUBLIC_URL=https://surenmaharjan.fyi`), admin `cms.surenmaharjan.fyi`
  (`ADMIN_URL=https://cms.surenmaharjan.fyi`), `www` redirecting to the apex.
  `deploy/caddy/habre-cms.caddy` serves all three names, proxying the two app
  hosts to the same port. Production values are set in production config,
  never in `.env.example`.
- **One deployable application.** It listens on localhost only; **Caddy**
  (already installed) terminates HTTPS and proxies the domain to it. HTTPS is
  required - auth cookies are Secure.
- **Database:** a dedicated `habre_cms` PostgreSQL database owned by its own
  role with access to nothing else. PostgreSQL listens on localhost only.
- **Storage:** Cloudflare R2 bucket for images, with a public URL.
- **Health check:** `/healthz`, reporting database reachability.
- **Env vars:** `PUBLIC_URL`, `ADMIN_URL` (replaced `APP_URL`, item 4c),
  `DATABASE_URL`, `JWT_SECRET`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
  `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL`.
- **Backups:** nightly database dump stored off the VPS - app and database share
  one disk.
- **Portable (D9):** the Caddy config lives in the repository, server setup is
  reproducible (a setup script - D14), and all state lives in
  PostgreSQL and R2. Moving to another server (e.g. headless Ubuntu) and
  recovering from a disk loss are the same procedure: set up, restore the latest
  backup, copy the secrets, point DNS.

From `stack`:

- **Host:** `ocwebserver` - Oracle Cloud VPS, Ubuntu 24.04.4 LTS, x86_64,
  2 vCPU, 954 MB RAM + 2 GB swap, 41 GB free. Caddy 2.11.4 running. Node 26.8.2
  and PostgreSQL 16.15 installed 2026-09-16 by the setup script.
- **Server is this app's alone (2026-09-16):** the test static site
  `surenmaharjan.fyi` (`/srv/redpanda`), the unserved `shelf` app, their
  `site-check` timer and the hone app's leftovers were removed at the owner's
  request. Caddy's main Caddyfile now holds only the `habre-cms` import, and
  `surenmaharjan.fyi` serves nothing until the CMS public site moves there (the
  owner wants the public site on `surenmaharjan.fyi` and admin on
  `cms.surenmaharjan.fyi` - designed in D22, built in item 4). More web apps later
  likely need a bigger VPS - decide before hosting a second app.
- **Caddy:** the repository ships only `deploy/caddy/habre-cms.caddy`; the
  server's main Caddyfile imports it. **The setup script must not replace the
  main Caddyfile, and must not reinstall or reconfigure an existing PostgreSQL**
  - it adds this app's database and role alongside whatever is there.
- **IPv4 only today (checked 2026-09-16, F-13):** `ocwebserver` has no global
  IPv6 address and no IPv6 default route; `cms.surenmaharjan.fyi` is a CNAME to
  the root with no AAAA. Caddy listens on `*:443`/`*:80` with no `bind`. The
  login rate limit assumes IPv6 clients cannot reach the CMS (one /48 would get
  65,536 limit keys). `host` chose no `bind` (2026-09-16); `habre-cms.caddy`
  says to re-check F-13 if the VM ever gets IPv6. An AAAA on the apex now puts
  both the public site and `cms` on IPv6.
- **No per-service memory cap** for now (decided 2026-09-15).
- **Process:** a systemd service runs the built server on a localhost port;
  Caddy proxies the domain to it. No Docker on the server - its daemon costs
  ~100 MB of 1 GB (D14).
- **Builds happen locally or in CI, never on the VPS.** A deploy ships the build
  output and production dependencies.
- **Files reach the server with `rsync` over SSH** (from `host`, 2026-09-16).
  The server has no `git`; `rsync` 3.2.7 was installed on it by the owner on
  2026-09-16 for this. The setup script and each release are copied with it;
  `deploy` puts releases under `/srv/habre-cms/releases/` and points the
  `/srv/habre-cms/current` symlink at the one to run, so rollback is repointing
  the symlink.
- **Build / start (from `scaffold`, 2026-09-15):** `npm ci && npm run build`
  produces `build/` (`build/server/index.js`, `build/client/`). The server runs
  `NODE_ENV=production node server.js` from the app directory (`npm start` does
  the same, and also loads `.env` if present) and needs `build/`, `server.js`,
  `package.json` and production `node_modules`. It listens on `127.0.0.1:$PORT`
  only. Migrations: `npm run db:migrate`.
- **Static files:** `server.js` serves `build/client` itself (hashed `/assets/*`
  cached for a year, other files an hour; dotfiles and paths outside
  `build/client` refused), so Caddy only needs `reverse_proxy` (D18).
- **Security headers:** set by `server.js` on every response -
  `X-Content-Type-Options: nosniff`, `Referrer-Policy:
  strict-origin-when-cross-origin`, `X-Frame-Options: DENY`.
  **Content-Security-Policy** is set per HTML response by
  `app/entry.server.tsx`, not `server.js`, because it carries a per-request
  nonce for React Router's inline scripts. The public site and the admin get
  separate policies: the admin also allows inline styles and `data:` images
  for Editor.js (D22). Images are allowed from `self` and the `R2_PUBLIC_URL`
  origin. It is not sent in development. `e2e/content-security-policy.spec.ts`
  fails on any violation.
- **More env vars:** `PORT`, `NODE_ENV`. Read today: `DATABASE_URL`,
  `PUBLIC_URL`, `ADMIN_URL`, `JWT_SECRET`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
  `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL`, `PORT` and `NODE_ENV` -
  the app now refuses to start without any of them (`AGENTS.md`'s Environments
  table).
- **Memory budget:** PostgreSQL tuned small (`shared_buffers` ~128 MB), app
  ~100 MB, Caddy ~30 MB.
- **Server setup script** in the repository installs Node 26 and PostgreSQL 16
  if missing, the systemd unit, and the Caddy site file plus its `import` line
  (D9).
- **Monitoring:** UptimeRobot checks `/healthz`, alerts by email.

## 9. Money - how does this pay for itself? *(optional)*

Intended as a hosted service eventually, so billing will come. Pricing model not
decided; no billing in the first version.

## 10. Constraints - what is fixed before anything is chosen?

- **Platform:** web - browser-based admin plus a server-rendered public site.
- **Database:** PostgreSQL 16, on the same Oracle VPS - installed 2026-09-16.
- **Minimal dependencies:** prefer the platform and standard library; every
  runtime dependency is a recorded decision.
- **Server resources:** 954 MB RAM, 2 vCPU - rules out memory-heavy runtimes and
  building on the server.
- **Hosting:** Oracle Cloud VPS, with Caddy already installed for HTTPS. Must
  stay portable to another VPS (e.g. headless Ubuntu).
- **Image storage:** Cloudflare R2.
- **Auth:** JWT with a one-week lifetime for the MVP. The gap - a removed or
  demoted user keeping access until expiry - is closed by a database check on
  every admin request (section 6, D6).
- **From scratch:** no existing code or data to migrate.
- **Deadline / budget:** not stated.

## 11. Deliberately deferred - what is not in the first version?

**Soon after:**

- **Categories and tags** - useful, but publishing works without them.
- **Scheduled publishing and revision history** - editor complexity before the
  editor is proven.
- **SEO fields and sitemap** - meta description, social image.
- **Password reset by email** - needs an email service; an admin resets
  passwords for now.
- **Custom domains** - needed once it is a hosted service.

**Later - likely direction:**

- **Page builder** - the probable next big step after the first version. A
  product of its own, so not in the MVP; `architect` should store content as
  blocks in a shape a page builder can extend (layout added on top), so it
  arrives as an addition rather than a rewrite.

**Later, or never:**

- **Headless content API.**
- **Multiple themes and theme customisation.**
- **Many sites per installation, public signup, billing.**
- **Importing from WordPress.**
- **Plugins, comments, forms, e-commerce, multiple languages.**

## Open questions

- ~~One installation per customer, or many sites in one system?~~ **Settled by
  D8:** one site per installation, no site id; many sites later means a database
  per site.
