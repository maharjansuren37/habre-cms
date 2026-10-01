# Project Plan

> One of the two planning docs you own. Answer each section in a line or two -
> a worksheet, not an essay. Draft it yourself, or let the AI help you sharpen
> it; either way the content is yours to direct. When it is filled in, run the
> `context` skill to generate the project overview from this plus
> blueprint/build-plan.md.

## 1. Problem - what are we solving?

**Rescoped 2026-10-01 (D148).** Habre is now **an AI-powered platform to
create, manage and publish a website** - not "a headless CMS", because most
people do not care what a CMS is. They want a website, a blog, their business or
portfolio online, and later a team to run it or an API for their app.

Getting a good website online still takes either technical knowledge or a
builder that runs out of room. Habre starts simple - describe what you want, get
a site, edit it, publish it - and reveals more power only when it is needed:
**simple by default, powerful when needed.** The CMS serves the public site
itself, so no developer is needed to put content online.

The original problem - WordPress is heavy and confusing for the people who
edit content - still holds; it is now the Level 1 half of a wider product.

## 2. Users - who is this for?

For everyone, through **progressive disclosure** - one product, one content
engine, three levels of experience:

- **Level 1 - Personal:** individuals and small businesses with no technical
  knowledge ("a photographer in Adelaide who wants a site people can enquire
  from"). **The first platform version serves this level.**
- **Level 2 - Professional:** teams and businesses - members, roles,
  approvals, scheduling, several sites. Soon after (section 11).
- **Level 3 - Developer:** agencies and developers - content models, API,
  webhooks. Later (section 11).
- **Visitors** read the public sites and have no accounts.
- **Before the rescope** (items 1-12): editors, authors and admins at one small
  organisation, one site per installation. That code is the base of Level 1.

## 3. Features - what does the first version need?

**Platform v1 (rescope D148, build items 13-21)** - a stranger signs up,
describes what they want, gets a site, edits it and publishes it:

- Current stack versions before the editor changes.
- TipTap replaces Editor.js for posts and page columns: drag to reorder blocks,
  with Move up / Move down as the non-drag alternative (WCAG 2.5.7), undo and
  redo. Existing content is discarded, not converted.
- Public signup with email verification and password reset by email. Signing
  up creates a site; the person who signs up is its admin. Each site's content,
  media, settings and members are its own. Media storage is capped per site
  from the first signup (D150).
- Each site's public site on a platform subdomain, `<name>.<platform domain>`.
- SEO basics: title and description per page and post, social image,
  `sitemap.xml`, `robots.txt`.
- Start from a description: "What do you want to create?" (Website, Blog,
  Business, Portfolio), then "Tell us about it"; AI builds pages, navigation,
  starter text and SEO basics in the built-in theme, and the user reviews,
  edits and publishes. AI use is capped per site.
- A contact form section: visitors enquire, submissions are stored per site and
  emailed to the site owner, with spam protection.
- Simple by default: a new site's admin shows only Level 1 screens; Users and
  advanced settings appear when switched on.
- Billing: one paid plan raises the Free plan's limits (AI use, storage), lets
  a site use its own domain and removes the "Made with Habre" footer link, paid
  through Stripe (D149). Billing stays off through an invite-only beta (D150).
- Self-hostable: anyone can run their own copy, free and open source. v1 keeps
  that possible (section 10); the install guide comes soon after.

**Built before the rescope (items 1-12):**

- Log in and out; 1-week session; no public signup.
- Write posts and pages in a block editor with basic blocks: text, heading,
  image, list.
- Save as draft, publish, unpublish.
- Upload images and reuse them from a media library.
- Public site rendered from published content with one built-in theme.
- Site settings: title, logo, navigation menu, home page.
- Users and roles:
  - **Author** - writes and publishes their own posts.
  - **Editor** - manages everyone's content.
  - **Admin** - everything an editor can do, plus users and settings.
- Light and dark mode in both the admin area and the public site.
- **Page builder, first cut (rescope, 2026-10-01):** pages are built from
  sections; a section can hold 2-3 columns; ready-made sections (hero,
  call-to-action, image + text) can be inserted.

## 4. Data - what are we storing?

Users (with role), posts, pages (both made of content blocks), media (metadata
here; files in Cloudflare R2), site settings, navigation menu.

**From platform v1 (D148):** sites are first-class. Every site owns its
content, media, settings, navigation, members and contact-form submissions;
nothing of one site is visible to another. Users have a verified email and can
reset their password by email. Per site: SEO fields on pages and posts, and a
record of AI use against its cap. Posts and pages remain the only content types
until Level 3. Sites share tables, separated by a site id and row-level
security (D151, section 6).

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

Written by `architect` (2026-09-15); **re-run for platform v1 on 2026-10-01
(D151-D164)**. `layout` adds the directory tree beneath the part count once the
framework is known.

### Shape questions

| Question | Answer |
|---|---|
| More than one deployable service? | **No** - one application serves the platform host, the admin, every site's public pages and the webhooks (D4 holds). |
| Work outside a request? | **Yes, one thing: AI site generation** (D154) - 30 seconds to a few minutes, longer than a form post should wait. It runs in the same process, recorded in a database row. Email is sent inside the request. Nothing is scheduled. |
| Consistency across more than one write? | **Yes** - signup (user, site, membership, settings), applying an AI run (entries, navigation, settings) and a Stripe webhook (event record, plan) are each one transaction. **Concurrent writers:** many sites, a handful of editors each; same-entry collisions are still caught by the version check. |
| Dependency whose failure is unacceptable? | **No** - PostgreSQL down means every site down, accepted on one VPS. The AI, email, Stripe and R2 each degrade one feature (*Failure modes*). |
| Real load or a hard latency target? | **No hard target** - an invite-only beta; numbers in `blueprint/context/quality-bar.md`. |
| Rate-limited or unreliable external API? | **Yes** - the AI providers (rate limits, minute-long calls, refusals) and the email provider (send limits). Stripe is reliable and retries its own webhooks. |

### Parts

**One application, deployed once** (D4, unchanged). Admin, public sites,
signup, onboarding and webhooks share one database, ship together and have one
owner. The AI run is work inside that process, not a second part. A headless
API later is extra routes in the same app.

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

**Platform v1 adds features, not shape** (D16 holds; `layout` is not re-run).
New feature directories under `app/features/`: `sites` (host -> site
resolution, tenancy helpers), `signup` (signup, email verification, password
reset), `onboarding` (start from a description, the AI run), `ai`, `email`,
`forms` (contact form, submissions), `seo` (sitemap, robots, meta tags),
`billing`. Provider clients are `*.server.ts`. Operator commands join
`create-admin` in `scripts/`.

### Platform and organisation

- **Platform:** web - browser-based admin plus server-rendered public websites,
  one per site. No mobile app, no offline/PWA.
- **Organised by feature:** `auth`, `users`, `content` (posts and pages),
  `blocks`, `media`, `settings`, `public-site`, plus the v1 features above.
- **`blocks` is the one shared module:** block types, validation and HTML
  rendering, used by the editor, the server, the public site and the AI run's
  output check. Item 14 changes what is inside it, not its role.

### Sites and tenancy

- **Shared tables with a `site_id` on every site-owned table** (D151;
  supersedes D8's database per site). A database per site lost on a 954 MB
  server: a connection pool per site and migrations run once per site. A schema
  per site lost for the same reason.
- **Isolation is enforced twice:**
  - **The app:** every site-owned query takes its site from the request, which
    is resolved once from the host (public) or the membership (admin).
  - **PostgreSQL row-level security** on every site-owned table: a query sees
    only rows of the site set for its transaction, and **sees nothing when no
    site is set**. A forgotten `where site_id` therefore returns nothing instead
    of another site's rows.
- **Two database roles** (D152): an owner role runs migrations and owns the
  tables; the app connects as a second role that can read and write rows but
  not change the schema, and is subject to row-level security. A table owner
  bypasses row-level security, which is why one role is not enough.
- **Platform tables are not under row-level security:** `sites`,
  `site_domains`, `users`, `site_members`, `email_tokens`, `invites`,
  `stripe_events`, `schema_migrations`. They are read before a site is known
  (host lookup, login, signup, webhooks); app code scopes them.
- **No cross-site references:** foreign keys between site-owned tables include
  `site_id`, so a page cannot point at another site's media. References inside
  JSON (image blocks, navigation) are resolved by site-scoped queries, so
  another site's id renders as missing.
- **Users are global; roles live on a membership** (D159). In v1 a user belongs
  to exactly one site: an email already in use is refused when a site admin
  adds a member. Several sites per account is Level 2.
- **Media objects** are stored in R2 under `sites/<site id>/`.
- **Today's installation becomes site 1** (D162): one migration creates it from
  the current `site_settings`, makes today's users its members with their
  current roles, and gives it `surenmaharjan.fyi` as its domain. Its content is
  discarded at item 14 as D148 decided, not here.

### Hostnames

D153; replaces D22 when item 16 is built.

| Host | Serves |
|---|---|
| `app.<platform domain>` | signup, sign-in, email links, onboarding, the admin under `/admin`, the Stripe webhook |
| `<platform domain>`, `www.<platform domain>` | redirect to `app.<platform domain>` (no landing page is planned) |
| `<name>.<sites domain>` | that site's public pages, sitemap, robots file and contact form |
| a site's own domain | the same as its subdomain - `surenmaharjan.fyi` for site 1, paid sites' domains from item 21 |
| `media.<sites domain>` | images, from R2's custom domain (replaces `r2.dev`; `needs-you.md`) |
| `cms.surenmaharjan.fyi` | redirects to `app.<platform domain>` |

- **User sites get their own registrable domain**, separate from the platform's
  (e.g. `habre.page` beside `habre.ai`). The reason is reputation and isolation,
  not cosmetics. One phishing page on a free site can get its whole registrable
  domain blocklisted by browsers, which would take the sign-in page down with
  it. And sibling subdomains count as "same-site", so the SameSite cookie
  would protect the admin from user sites only on a separate domain.
- **The host decides the site before any route runs:**
  - the platform host gets platform and admin routes;
  - a subdomain of the sites domain is looked up in `sites.subdomain`;
  - any other host is looked up in `site_domains`;
  - an unknown host or a suspended site gets 404.
- **Subdomains** are chosen at signup: lowercase letters, digits and hyphens,
  with a reserved list (`www`, `app`, `admin`, `api`, `media`, `mail`, ...).
  Changing one is not in v1 - it breaks every shared link.
- **Certificates:**
  - The platform hosts and one **wildcard certificate for `*.<sites domain>`**
    are configured in the repository's Caddy site file. The wildcard comes from
    a DNS challenge through Caddy's Cloudflare DNS module, with an API token in
    Caddy's own environment on the server, never in the repository.
  - A certificate per subdomain lost: Let's Encrypt limits certificates per
    registered domain per week, and every site name would be published in the
    certificate transparency logs.
  - **Own domains (item 21)** need on-demand certificates: Caddy asks the app
    whether a domain belongs to a paid site before issuing. That needs one
    global option in the server's main Caddyfile, which the repository does not
    own - a one-time `host` change at item 21.
- **The session cookie is host-only on `app.<platform domain>`.** Public sites
  set no cookies.
- **Development:** `app.localhost:3000` and `<name>.localhost:3000`. Chromium
  resolves `*.localhost` to the loopback address; item 16's spec checks this
  under Playwright before relying on it.
- **Links across hosts are absolute.**

### Routes

**Platform host** - `app.<platform domain>`:

| Route | What |
|---|---|
| `/signup` | create an account and a site, choosing its address; an invite code while signup is invite-only |
| `/verify` | the emailed link: verifies the address and signs in (D161) |
| `/forgot-password`, `/reset-password` | password reset by email |
| `/admin/login` | sign in (unchanged path) |
| `/start`, `/start/:runId` | "What do you want to create?", "Tell us about it", then progress, then review and apply (item 18) |
| `/admin` | Home (Level 1) |
| `/admin/posts`, `/admin/pages`, `/admin/media`, `/admin/settings` | as today, scoped to the member's site; settings gains SEO defaults and the advanced switch |
| `/admin/users` | members of this site; shown only when advanced is switched on (item 20) |
| `/admin/messages` | contact-form submissions (item 19) |
| `/admin/plan` | the paid plan and own domain (item 21) |
| `/webhooks/stripe` | POST from Stripe, checked by signature - no session, no origin check (item 21) |
| `/healthz` | every host |

Screen names and navigation ("Blog" for posts, where Messages sits) are
`prototype`'s.

**Site hosts** - a subdomain or an own domain:

| Route | What |
|---|---|
| `/`, `/posts`, `/posts/:slug`, `/:slug` | as today, for the host's site |
| `/sitemap.xml`, `/robots.txt` | per site (item 17) |
| `/_contact` | POST only: a contact-form submission (item 19) - **the only state-changing route on a site host**, accepted only when the origin is that site's own host |
| `/healthz` | every host |

- Server-rendered, no login, works without JavaScript - unchanged.
- Item 17's and 19's specs check that no page slug can take these paths.

**Operator work is server commands, not screens, in v1** (D158), like
`create-admin` today: `create-invite`, `suspend-site` / `unsuspend-site`
(abuse), `delete-site` (a deletion request). An operator screen waits until the
commands are run often enough to hurt.

### Switches - what a self-hosted copy can turn off

D148: billing, AI, email and signup are each switchable off.

| Switch | Off means |
|---|---|
| Signup: `off`, `invite` or `open` | `off`: accounts come only from `create-admin`. `invite`: a code from `create-invite` is required - the beta. `open`: anyone can sign up |
| AI (a primary provider's key is set; up to two fallbacks, in order, are optional) | "Start from a description" is not offered; sites start blank. Without fallbacks, a primary outage fails the run |
| Email (SMTP is configured) | signup must be off, there is no reset by email (a site admin resets a member's password, as today), and contact submissions are stored without a notification |
| Billing (Stripe is configured) | no plan page; the configured limits apply to every site |
| Limits (configuration) | default to the Free plan (D150, D164); a self-hosted copy can raise or remove them |

A switch that is on with its configuration missing stops the app at startup,
like every other variable today.

### Data model

Shared tables, `site_id` on site-owned tables (D151). Site-owned tables, in
*italics*, are under row-level security.

- **sites** - `id`, `subdomain` (unique, lowercase), `plan` (free | paid),
  `suspended_at`, `created_at`, `updated_at`; from item 21 `billing_customer_id`,
  `billing_subscription_id`, `billing_status`, `paid_until`
- **site_domains** - `domain` (unique, lowercase), `site_id`, `verified_at`,
  `created_at`
- **users** - `id`, `email` (unique, case-insensitive), `name`,
  `password_hash`, `email_verified_at`, `token_version`, `created_at`,
  `updated_at` - role and deactivation move to the membership
- **site_members** - `site_id`, `user_id`, `role` (admin | editor | author),
  `deactivated_at`, `created_at`; primary key (`site_id`, `user_id`)
- **email_tokens** - `id`, `user_id`, `purpose` (verify | reset), `token_hash`
  (SHA-256; the token itself exists only in the email), `expires_at` (verify
  24 hours, reset 1 hour), `used_at`
- **invites** - `id`, `code_hash`, `note`, `created_at`, `used_at`,
  `used_by_site_id`
- ***entries*** - as today plus `site_id`; `slug` unique per site and type;
  `blocks_format` gains item 14's format; `seo_title`, `seo_description`,
  `social_image_media_id` (item 17)
- ***media*** - as today plus `site_id`; `storage_key` under `sites/<site id>/`
- ***site_settings*** - one row per site, keyed by `site_id`: as today plus
  `site_description` (item 17) and `advanced_enabled` (item 20)
- ***contact_submissions*** (item 19) - `id`, `site_id`, `entry_id` (the page
  the form was on), `name`, `email`, `message`, `created_at`, `notified_at`
  (empty when the email failed), `read_at`
- ***ai_runs*** (item 18) - `id`, `site_id`, `user_id`, `kind` (website | blog
  | business | portfolio), `description`, `status` (running | succeeded |
  failed | applied), `result` (the validated proposal), `error`, `provider`,
  `model`, `input_tokens`, `cached_input_tokens`, `output_tokens`, `credits`,
  `created_at`, `finished_at`
- **stripe_events** (item 21) - `id` (Stripe's event id), `type`,
  `received_at`
- **schema_migrations** - owned by the in-repo migration runner: `filename`,
  `applied_at`. No library creates any other table.

**Usage is computed, never counted:** storage is the sum of a site's media
sizes, and AI use is the sum of `credits` over its runs this month. There are
no counters to drift.

**Blocks** are an ordered list of `{id, type, data}`:

- **Sections (page builder, D113/D114), pages only - posts stay flat.** A page's
  `blocks` is a list of `section` blocks (`blocks_format` v3). A `plain` section
  has `data.layout` (`"1"`, `"2"` or `"3"` columns) and `children`: a list of
  columns, each a list of the leaf blocks below. Ready-made sections (`hero`,
  `cta`, `image-text`, item 12) are their own section types (siblings of
  `section`, D125) with fixed slots - plain strings, an allowlisted link, a
  media id (D126) - not free columns. Nesting stops at
  section -> column -> leaf; sections never contain sections.
- **v2 content stays valid, nothing is migrated destructively.** A v2 page
  loads as one implicit 1-column section and becomes v3 on its next save; the
  renderer reads both. The one migration relaxes the `blocks_format` check to
  `in ('v2','v3')` - so that release cannot be rolled back by symlink, and a
  page saved as v3 would not render under older code.
- **Text is stored as structured data, never raw HTML**, and escaped on render.
  Inline formatting is bold, italic and links, stored as structured runs
  (`blocks_format` v2, D28-D30).
- **Image blocks store a media id, not a URL.** The URL is resolved at render
  time, so a bucket or domain change never touches content.
- **Item 14 (TipTap, D148):** a column, and a post, holds one TipTap
  (ProseMirror) JSON document instead of an Editor.js block list. On save it is
  validated by **our own Zod schema**, which admits only our nodes and marks:
  paragraph, heading, lists, image by media id, bold, italic and an
  allowlisted link. It is rendered by **our own escaping renderer**. TipTap's
  HTML output is never stored or trusted, so D28-D30 hold. Sections, columns
  and ready-made sections stay as they are around it. v2 and v3 content is
  discarded, not converted - a destructive migration with its own yes.

### Data rules

- Saving a published entry updates the live page (revisions are deferred).
- A page has at most 30 sections and a section at most 3 columns; a save
  beyond that is refused (one editor mounts per column).
- Every save sends the entry's `version`; if someone saved in between, the save
  is rejected with "changed by someone else, reload".
- **Upload:** write the R2 object first, then the media row. A failure between
  leaves an unreferenced object - harmless.
- **Delete media:** remove the row first, then the object.
- **Memberships are deactivated, never deleted** - authorship stays intact and
  nothing needs reassigning.
- **The server's disk holds no state but the database.** No local uploads, no
  config edited by hand on the server (D9).
- **Limits refuse the action, never the published site** (D150). An upload past
  the storage cap is refused. Two uploads at once can pass the cap by at most
  one file each - accepted.
- **AI use is a monthly allowance of credits per site** (D164).
  - **1 credit = US$0.001 of provider cost,** worked out from each run's
    reported tokens and the configured price of the model that ran. The same
    allowance caps the same money whichever model or fallback ran.
  - **A run starts only while some allowance is left.** The last run of the
    month can pass it by at most one run, because each run's output is
    capped.
  - **A failed run costs no credits.**
  - **Screens show a percentage,** never tokens or credits.
- **AI suggests, the user applies** (principle). A run stores a proposal;
  applying it writes pages **as drafts**, and the navigation and SEO settings,
  in one transaction. Nothing is published until the user publishes. In v1 a
  run is offered only while a site has nothing published, so applying one
  cannot change a live site.
- **AI output is untrusted input:** it passes the same schemas as an editor's
  save, and its links pass the same allowlist.
- **The AI chooses no images in v1** - no stock or generated pictures. That
  would bring licensing and cost questions with it. Its sections render
  without an image, and the review screen points at empty image slots.
- **A contact submission is saved before its notification email is sent.**
- **Deleting a site** removes its rows first, then its R2 prefix. Objects left
  behind by a failure are harmless.

### Where logic lives

All on the server: authorization, validation, rendering, and every call to the
AI, email and Stripe. The browser runs the editor and uploads, and is
redirected to Stripe's own pages for payment. It never holds a provider key or
decides a permission.

### Auth boundary

- **Sign-in on the platform host** -> JWT, 7 days, in an **httpOnly, Secure,
  SameSite=Lax cookie**, host-only on `app.<platform domain>` - not browser
  storage, which page scripts can read.
- **Every admin request loads the user and their membership** from the
  database, and rejects a deactivated membership or a mismatched
  `token_version`. **The role is read from the membership, never the token**
  (D6, now per site). Changing a role, deactivating a membership or resetting a
  password bumps `token_version` and takes effect on the next request.
- **Signup** creates the user, the site, the admin membership and the settings
  in one transaction. **The emailed link verifies the address and signs the user
  in; nothing works before that** (D161). This stops AI spend through throwaway
  addresses and keeps the first two minutes short: email, click, start.
- **Password reset:**
  - the answer is the same whether or not the email has an account;
  - the token is single-use and lasts an hour;
  - a completed reset bumps `token_version`.
  A site admin can still reset a member's password while each user belongs to
  one site. That becomes email-only with several sites per account (Level 2).
- **Rate limits** use the existing in-memory limiter, per process. A restart
  resets them - accepted with one process. They cover:
  - login - existing;
  - signup and resending verification - per IP;
  - reset requests - per IP and per email;
  - contact submissions - per IP, per site;
  - AI runs - per site, per day.
- **CSRF:**
  - The platform host checks the origin against the platform URL.
  - Site hosts refuse every state-changing request except `/_contact` from
    the site's own origin.
  - The Stripe webhook is checked by its signature instead.
- **Logged** - today's events (failed logins, role changes, deactivations,
  password resets), plus:
  - signups, verifications, and reset requests and completions;
  - site suspensions and deletions;
  - each AI run's outcome and provider;
  - webhook failures.
- **Public routes need no auth;** drafts are never served publicly.

| (per site) | Author | Editor | Admin |
|---|---|---|---|
| Posts | own: create, edit, publish, delete | all | all |
| Pages | - | all | all |
| Media | upload; delete own | all | all |
| Settings, members, plan, messages | - | - | yes |
| Start from a description | - | - | yes |

### Integrations

- **Cloudflare R2** - images, as today, under a per-site prefix, served from
  `media.<sites domain>`.
  - **Uploads go through the app server** (D7): 10 MB cap; JPEG, PNG, WebP,
    GIF only. **No SVG** - it can carry script.
- **AI: three providers in order - Anthropic's Claude API, then OpenAI, then
  OpenRouter** (D155). They sit behind one `ai` module with one adapter per
  provider.
  - **Two packages, not three.** Anthropic and OpenAI are called through their
    official SDKs (`@anthropic-ai/sdk`, `openai`). OpenRouter speaks OpenAI's
    API, so the `openai` SDK calls it by changing the base URL - no new
    package.
  - **OpenRouter's request settings:**
    - `provider.require_parameters: true` - only endpoints that honour our
      output schema;
    - `provider.data_collection: "deny"` - no upstream that stores or trains
      on the data;
    - its own failover between upstreams left on.
    Its model is configuration: Claude through Amazon's or Google's cloud
    keeps the primary's model family when Anthropic itself is down. Asking
    for zero data retention as well can leave some models with no endpoint
    that accepts a schema, so item 18 checks the combination it uses.
  - **The models are configuration,** with a price per model for credits
    (D164). Item 18 measures the cost and quality of Claude Opus 5.5
    (US$4 / US$20 per million input / output tokens) against Claude Sonnet 5.5
    (US$2 / US$10), and each fallback model the same way. The owner picks.
  - **When the next provider is used:** only when the current one is
    unavailable - rate limited, overloaded, a server error, a dropped
    connection or a timeout - once its SDK's own retries are spent. Every
    move is logged.
  - **When it is not used:**
    - **A refusal never moves to another provider.** A description any
      provider declines - a fake bank login page, say - is not sent elsewhere
      to get a yes. Anthropic's own server-side fallback to another Claude
      model handles Claude's refusals; if that also declines, the run fails.
    - **A request error (400) or an authentication error (401)** is our bug or
      a broken key. It fails loudly instead of being hidden by the fallback.
  - **Every provider fills the same constrained schema:** pages made of
    ready-made section kinds with plain-text slots, navigation and SEO text.
    Our Zod schema validates it and the server turns it into blocks, so a
    fallback result has the same shape as a Claude one. The AI never writes
    HTML or free-form editor JSON.
  - **Tokens, credits, provider and model are recorded on each run.** The fixed
    instructions are prompt-cached.
  - **Cost of the fallbacks:**
    - three accounts, keys and spend limits;
    - a prompt that item 18 tests on every configured model;
    - a privacy policy that names Anthropic, OpenAI, and OpenRouter with its
      upstreams, because a user's description reaches whichever one runs.
  - **Optional.** A self-hosted copy can use any one provider alone, with its
    own key. Each fallback is optional.
- **Email: SMTP**, through `nodemailer` (D156) - SMTP works with any provider
  and any self-hosted mail server.
  - **The hosted platform uses Resend:** its free tier is 3,000 emails a month
    and **100 a day**, whichever runs out first; Pro is US$20 for 50,000, with
    no daily cap.
  - **When to move:** to Resend Pro or Postmark (US$15 for 10,000) once the
    daily cap is hit, for example by a large batch of beta invites, or once
    verification emails land in spam. Either move is a configuration change.
  - **Optional** (see *Switches*).
- **Payments: Stripe** (D149), through **the official `stripe` SDK** (D160).
  It has no dependencies of its own, and it is better than hand-written calls
  where it matters:
  - it checks webhook signatures - timing-safe, with a timestamp tolerance -
    which is security-critical code not to write ourselves;
  - it pins the API version and adds idempotency keys to its retries;
  - its types cover every object.
  - **Stripe's hosted pages:** Checkout and the Customer Portal, so card
    details never reach the server.
  - **Webhooks are the only thing that changes a site's plan.** Each event is
    processed once, keyed by its event id.
  - **Optional.**
- **Contact-form spam: no third party** (D157) - a hidden honeypot field, a
  minimum time to fill the form, and a per-IP limit. It works without
  JavaScript. A captcha comes only if spam gets through.
- **Nothing else** - no analytics, cache, queue, CDN or image service.

### System design

**Background work - the AI run** (D154):

- **The flow:**
  - The action records an `ai_runs` row as `running`.
  - It starts the generation in the same process, without waiting for it.
  - It redirects to `/start/:runId`, which polls until the run finishes.
- **At most two runs at once per process.** A third is refused with "busy,
  try again in a minute". That keeps the providers' rate limits and the spend
  bounded.
- **A run has a 5-minute timeout, covering every provider's attempt.**
- **A run that a restart interrupted is marked `failed` at the next startup.**
- **All or nothing:** a run writes only its own row. Applying it is the one
  transaction. Retrying is a new run. A failed run costs no credits.
- **Lost:**
  - generating inside the request, streamed to the page - a dropped mobile
    connection would lose a paid run;
  - a job queue or worker process - D4, the memory budget, and nothing else
    needs one.

**Failure modes:**

| Dependency | Down, slow or refusing |
|---|---|
| PostgreSQL | every site and the admin down; `/healthz` 503 |
| R2 | uploads fail with a message; images missing, text still served |
| AI provider | Claude unavailable: the SDK retries, then the run moves to OpenAI, then to OpenRouter. All unavailable: the run fails ("Couldn't build your site - try again, or start blank"), no credits spent. A refusal never moves provider; it is a failed run with its own message |
| Email | signup: "We couldn't send the email" with a resend button. Reset: the same neutral reply, failure logged. Contact form: submission kept, `notified_at` empty, shown in Messages |
| Stripe API | the plan page says payment is unavailable; sites unaffected |
| Stripe webhooks | Stripe retries for days; each event processed once |

**Caching:** none, as before. The first fix when public pages miss the
performance bar is a per-site cache of rendered pages. It is invalidated when
an entry is saved, published or unpublished, or the settings change.

**Consistency:**

- **Transactions:** signup, applying a run, a webhook and site deletion's
  rows.
- **No cross-system transaction:** R2 is ordered by write order, as before.

**Rate limits, both directions:**

- **Inbound:** as in *Auth boundary*.
- **Outbound:**
  - AI calls are bounded by two concurrent runs and each site's credit
    allowance;
  - email volume is a few messages per signup;
  - Stripe calls happen only on a user's click.

**Scaling ceiling** - not measured.

- **One process renders every site,** so one site's traffic spike slows all of
  them. That noisy-neighbour risk is the first thing to break. The first fix
  is the page cache above; the next is a bigger VPS.
- **Large unresized images** still make public pages heavy, as before.
- **AI runs are network waits, not memory or CPU.**
- **Shared tables** are not the limit before thousands of sites.

**What must be measurable** (input to `monitor`):

- **Uptime checks** on the platform host, on one site subdomain (it proves the
  wildcard certificate), and on `surenmaharjan.fyi` - this closes F-113's gap.
- **AI runs:** count, outcome, duration, provider, and tokens and credits per
  run (stored on `ai_runs`); credits spent per day across all sites.
- **Failures:** email sends and webhooks (logs).
- **Growth:** signups per day, and sites at their storage or AI limit.
- **Errors:** 5xx responses per host.

### Build order - notes for `spec`

Items are built and merged one by one, but none is deployed until v1 is
complete (D163). Each item still has to leave `npm run verify` and the full
browser suite green.

- **13** - none.
- **14** - the TipTap format and its Zod schema. Discarding v2/v3 content is a
  destructive production migration with its own yes.
- **15** - the tenancy foundation, and too big for one review. Proposed split:
  - **15a. Sites and memberships** - `site_id`, row-level security, the two
    roles, site 1 from today's data, the admin scoped by membership. No
    signup.
  - **15b. Signup** - the email module, signup with verification, invites, and
    choosing an address.
  - **15c. Password reset by email.**
  - **15d. Storage cap per site.**
- **16** - host resolution, `site_domains` (`surenmaharjan.fyi`), the wildcard
  certificate, `suspend-site`.
- **17** - SEO.
- **18** - AI runs: providers and fallbacks, credits, the proposal, review and
  apply.
- **19** - the contact form and Messages.
- **20** - the advanced switch.
- **21** - billing, plus own domains through on-demand certificates. They stay
  in 21, not 16: nobody can pay before 21, and site 1's domain needs only a
  fixed entry.

## 7. UI/UX - how should it look and feel?

- **Simple by default, powerful when needed** (a principle, D148). A beginner
  never sees content schemas, API versions, webhooks, JSON or role matrices
  unless they switch them on. Level 1 admin: Home, Pages, Blog, Media,
  Settings.
- **The first two minutes matter most.** Onboarding asks "What do you want to
  create?", then "Tell us about it", then shows a ready site: "Your website is
  ready. What would you like to change?" - not account, then dashboard, then
  setup.
- **Ease of use is the product.** The editing experience must be clearly simpler
  than WordPress for a non-technical editor: few screens, obvious next actions,
  no settings they don't need.
- Light and dark mode from the first screen, not added later - admin area and
  public site both.
- The look is recorded in `blueprint/context/design.md` (`prototype`,
  2026-09-15). Platform v1's new screens - signup, onboarding, the Level 1
  admin and Home, the TipTap editor - are not designed yet.

## 8. Deployment - where and how does it ship?

Known so far: an **Oracle Cloud VPS**, with **PostgreSQL 16 installed on the
same server** (2026-09-16, `deploy/setup-server.sh`). Images go to **Cloudflare R2**.

From `architect`:

- **Platform v1 (D153, 2026-10-01):**
  - **Two domains:** the platform domain (`app.` serves the app; the apex and
    `www` redirect to it) and a separate sites domain (a wildcard for every
    site, plus `media.` for R2). Both are on Cloudflare DNS. They replace the
    two fixed hostnames below at item 16.
  - **Caddy** needs the Cloudflare DNS module for the wildcard certificate, and
    an API token in its own environment. That is `host`'s change, with a yes.
  - **Item 21** adds on-demand certificates for own domains: one global option
    in the main Caddyfile.
- **Two database roles (D152):**
  - an owner role runs migrations, so `npm run db:migrate` needs the owner's
    connection string;
  - the app role reads and writes rows only;
  - `deploy/setup-server.sh`, `db/dev/init.sh` and CI create both.
  - Backups are unaffected: `pg_dump` runs as the `postgres` superuser.
- **New optional configuration:**
  - the signup mode;
  - the AI providers' keys and models: Anthropic first, then OpenAI and
    OpenRouter as optional fallbacks, with a price per model for credits;
  - SMTP settings and the from address;
  - Stripe's secret key, webhook secret and price;
  - the plan limits: storage and the monthly AI credit allowance.
  - `PUBLIC_URL` and `ADMIN_URL` become the platform URL and the sites domain
    at item 16.
- **One deployable, one process, `/healthz` on every host** - unchanged.
- **Production holds until v1 is done (D163).** Production stays on release
  `8d82ce4` (items 1-12) while items 13-21 are built, then v1 ships in one
  deploy:
  - **Its migrations run once,** in order, in that deploy - including item 14's
    content discard and the move to site 1.
  - **Rehearse first.** Before that deploy, the whole migration set runs
    locally against a restored copy of the latest production backup.
  - **Rollback is the backup, not the symlink:** restore the pre-deploy dump
    and point `current` back at `8d82ce4`.
  - **An urgent fix in the meantime** (a security patch) ships from a branch
    off `8d82ce4`, never from `main`, which by then holds unreleased v1 work.
- **Domains (D22, 2026-09-16; replaced by D153 at item 16):** public site `surenmaharjan.fyi`
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

A hosted service (D148). Intended tiers, not built: **Free** (one site, basic
pages, basic AI, platform subdomain), **Personal** (custom domain, more AI and
storage, analytics), **Business** (team members, workflows, several sites,
marketing), **Pro / Developer** (API, webhooks, custom content models),
**Enterprise** (SSO, advanced permissions, audit, governance). Platform v1 ships
the Free plan with enforced limits and **one paid plan** that raises them and
adds the site's own domain, through Stripe (item 21); the other tiers come with
the features they sell. Prices and exact limits not decided. Launch is an
invite-only beta on Free only, billing off; billing is switched on later (D150).

**Self-hosted:** anyone can run their own copy, **free and open source**
(owner, 2026-10-01; licence not chosen). The hosted service is what is sold.
A self-hosted copy has billing off, signup optional and AI optional with its
own key.

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
- **Existing code (D148):** items 1-12 are built and live. Existing content is
  disposable - not converted to the new editor or site model (owner,
  2026-10-01). A destructive migration in production still needs its own
  explicit yes at the time.
- **Stack kept (D148):** the rescope does not change the stack beyond the
  editor swap; no Redis, separate search engine or cloud platform.
- **Paid services:** three AI providers (D155) and an email provider
  (verification, password reset, form notifications; D156) - accounts and
  spend are the owner's.
- **AI cost and abuse:** public signup plus AI means AI use is capped per site
  from the first release.
- **Self-hostable (D148):** everything must run with only Node.js, PostgreSQL
  and S3-compatible storage. Nothing may depend on a platform-only service;
  billing, the AI provider, the email provider and signup are each switchable
  off. A payment provider is a further paid account (item 21).
- **Deadline / budget:** not stated.

## 11. Deliberately deferred - what is not in the first version?

Rewritten by the platform rescope (D148). Platform v1 proves Level 1; everything
below matters only once it does.

**Soon after - Level 2, Professional:**

- **Editorial:** revision history (compare, restore), scheduled publishing, an
  approval step.
- **Findability beyond the basics:** redirects, categories and tags.
- **Dashboard with content health** - counts, missing alt text, broken links.
- **Media upgrades** - search, "where used", replace a file keeping every
  reference, responsive image sizes.
- **Builder follow-ups** - section palette, reusable saved sections, section
  styling, page templates.
- **Several sites per account, team invites by email.** (Own domains moved
  into v1's paid plan, D150.)
- **More AI** - suggestions in the editor (rewrite, alt text, meta
  description) and conversational changes ("make it look more professional").
- **Analytics, and the paid tiers beyond v1's one paid plan.**
- **Self-hosting install** - an install guide and a single-site mode for
  people running their own copy (v1 only keeps it possible).

**Later - Level 3, Developer:**

- **Custom content types** - admin-built types and fields; posts and pages are
  the only types until then.
- **Content API** - REST with scoped API keys, webhooks on publish.
- **GraphQL, SDKs, CLI, environments, plugins, custom components.**

**Done in earlier rescopes:** the page builder's first cut - sections, columns
and ready-made sections (items 10-12, D113). SEO fields, sitemap, public
signup, many sites, forms and password reset by email move into platform v1.

**Later, or never:**

- **Free-form drag-anywhere canvas, custom CSS/HTML** - fights ease of use and
  multiplies the accessibility surface.
- **Multiple themes and theme customisation.**
- **Store / e-commerce, multiple languages, comments, importing from WordPress.**
- **Other channels** - mobile apps, email, digital displays, AI agents.
- **Enterprise** - audit log, SSO, SAML, SCIM, data residency.

## Open questions

- ~~One installation per customer, or many sites in one system?~~ **Settled by
  D8:** one site per installation, no site id; many sites later means a database
  per site. **Reopened by D148, settled by D151:** shared tables with a site id
  and row-level security.
- **The platform's name and domain.** `surenmaharjan.fyi` is a personal domain.
  **The owner is buying a new domain for the platform (2026-10-01)**; the name
  is not chosen. Owner's decision, needed by item 16. ~~Whether user sites also
  get a separate domain~~ **settled by D153:** yes, a separate sites domain, so
  sites live at `<name>.<sites domain>`.
- ~~Which AI and email providers~~ **settled by D155 and D156:** Anthropic,
  then OpenAI and OpenRouter as fallbacks; email over SMTP through Resend.
  ~~Payment provider~~ **settled by D149:** Stripe, as a plain processor.
- **Prices and plan limits** - what Free allows and what the paid plan raises.
  Owner's decision, needed by item 21.
- **The open-source licence** - AGPL (a hosted fork must stay open) or MIT
  (anyone may close it). Owner's decision, needed before code is published.
