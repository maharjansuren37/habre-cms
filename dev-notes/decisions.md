# Decisions

Why this project is shaped the way it is. Read this before changing its shape -
not just the code, but the choices underneath it.

One entry per decision, newest at the bottom, numbered `D1`, `D2`, and so on.
The number is permanent: later entries refer back to it.

**A superseded decision is marked, never deleted.** The reasoning stays useful
even when the conclusion stops being true - and knowing what was already tried
and rejected saves the next person from re-treading it.

The `docs` skill maintains this file, and `stack` and `architect` add an entry
when a choice they made has a real reason behind it. You can write one yourself
at any time.

## Format

    ## D1 - Short statement of the decision (YYYY-MM-DD)

    **Chose:** what was decided, in one line.

    What the alternatives were, and why they lost. What this choice costs -
    every real decision costs something, and writing it down is what stops it
    being a surprise later.

## Decisions

## D1 - The CMS renders the public site (2026-09-15)

**Chose:** editors write in a block editor and the CMS serves the site from a
built-in theme - not headless, not a page builder.

Headless lost because a non-developer cannot put a website online with it, and
the product's point is ease of use for non-developers. A page builder lost on
size: the builder is a product of its own and would swallow the first version.
Cost: layout control is limited to what the theme allows until a page builder
or theme customisation arrives.

Both are deferred, not rejected. A page builder is the likely next direction,
so the block content model should be one it can extend.

## D2 - One site per installation for the first version (2026-09-15)

**Chose:** the first version manages a single website.

Many sites in one system is the likely shape of a hosted service, but it adds a
site boundary to every table and permission check before the product has proven
itself. Not settled: whether the data model carries a site id from day one
anyway, to make scaling cheaper - an open question in the project plan for
`architect`.

## D3 - Three roles on the WordPress model (2026-09-15)

**Chose:** author (own posts), editor (all content), admin (content, users and
settings).

Familiar to anyone arriving from WordPress, and small enough to enforce
server-side without a permissions system. Cost: no custom roles or per-section
permissions until someone needs them.

## D4 - One application, one deployable (2026-09-15)

**Chose:** admin area, public site and endpoints in a single application.

A separate API plus frontend lost: they share one database, deploy together and
have one owner, so a split would add a contract, two deploys and coordination
for nothing. A headless API later is extra routes in the same app. Cost: public
site and admin scale together - fine on one VPS.

## D5 - Posts and pages in one table, content as structured blocks (2026-09-15)

**Chose:** one `entries` table with a `type`, and content as an ordered JSON list
of `{id, type, data}` blocks, never raw HTML.

Separate posts and pages tables lost: they would duplicate the editor, publish
flow and permissions. Raw HTML lost: it must be sanitised forever and cannot be
restructured by a page builder. Blocks can gain `children` containers later, and
`blocks_format` versions the shape. Cost: querying inside content needs JSON
queries, and the renderer must handle every block type.

## D6 - JWT checked against the database on every admin request (2026-09-15)

**Chose:** 7-day JWT in an httpOnly cookie, but each admin request loads the
user and checks `deactivated_at` and `token_version`; the role comes from the
database.

Pure stateless JWT lost: a removed or demoted user would keep access for up to a
week. Server-side sessions lost only because JWT was a stated constraint - they
would work equally well. Cost: one indexed database lookup per admin request.

## D7 - Image uploads go through the app server (2026-09-15)

**Chose:** browser -> app -> R2, with a 10 MB cap and a type allowlist (no SVG).

Browser-direct presigned uploads lost: they need CORS rules, a confirmation step
and orphan cleanup, and bring no benefit at a handful of editors. Cost: upload
bandwidth and memory pass through the VPS.

## D8 - One site per installation; many sites later means a database per site (2026-09-15)

**Chose:** no site id on any table (settles D2's open question). If it becomes a
hosted service with many sites, each site gets its own database with the same
tables, and the app picks the database from the request's domain.

Site id on every table lost for now: with one site there is nothing to test
isolation against, so the column would imply separation nothing proves, and
every item would carry the filter. A schema per site lost to a database per
site, which isolates as well and makes backup, restore and deleting a customer
one command. Cost: at hundreds of sites, per-database migrations and connection
pools get heavy - reconsider shared tables then. The CMS always gets its own
PostgreSQL database and role, never tables inside another app's database.

## D9 - The server holds no state but the database (2026-09-15)

**Chose:** all state in PostgreSQL and R2; Caddy config in the repository;
server setup reproducible.

The server may move to another VPS (e.g. headless Ubuntu), and app and database
share one disk. Keeping nothing else on it makes a migration and a disk-loss
recovery the same procedure: set up, restore the latest backup, copy secrets,
point DNS - under 1 hour. Cost: no local file uploads or hand-edited server
config, even when that would be quicker.

## D10 - React Router 8 (framework mode) over Next.js (2026-09-15)

**Chose:** React Router 8.3.1 with Vite, served by a plain `node:http` server.

Next.js 16 lost on weight and fit: `next` alone unpacks to 185 MB against
2.8 MB, it typically runs at 200-400 MB on a 954 MB server, and its image
optimisation and page cache write to local disk, against D9. React Router's
loader/action model gives HTML forms that work without JavaScript, matching the
public site. Cost: a smaller ecosystem than Next.js, and v8 is recent enough that
its docs must be checked rather than recalled.

## D11 - Raw SQL with the `postgres` driver, no ORM (2026-09-15)

**Chose:** `postgres` 3.4.9 (zero dependencies), tagged-template queries, `.sql`
migration files and a small in-repo runner.

An ORM lost on dependencies and weight for four tables. Kysely (type-safe query
builder, zero dependencies) is the runner-up. Cost: queries are not type-checked
against the schema, and row types are written by hand - revisit with Kysely if
SQL typos start reaching tests.

## D12 - Plain CSS with custom properties, no Tailwind (2026-09-15)

**Chose:** CSS custom properties for light/dark tokens, CSS Modules for scoping.

Tailwind lost: it adds a build plugin and class-heavy markup to reach what custom
properties already give, and `prototype`'s token file maps straight onto CSS
variables. Cost: more CSS written by hand, and consistency depends on using the
tokens.

## D13 - Editor.js for the block editor (2026-09-15)

**Chose:** `@editorjs/editorjs` 2.31.6 with its header and list tools.

It saves `{id, type, data}` blocks - the D5 shape - with no conversion, and its
block-at-a-time interface suits "really easy to use". Lexical lost: its own tree
format would need converting both ways, and more of the UI is built by hand.
Cost: no nested blocks, so a page builder will likely replace the editor while
the stored content format stays.

## D14 - systemd and a setup script, no Docker on the server; never build there (2026-09-15)

**Chose:** Node 26 and PostgreSQL 16 installed natively by an in-repo setup
script, the app as a systemd service, builds done locally or in CI.

Docker lost on the server: its daemon costs ~100 MB of 954 MB. Building on the
VPS lost: 1 GB will not build reliably, and a server that rebuilds runs code no
check examined. Development does use Docker for PostgreSQL 16, because Arch
packages 18. Cost: the setup script must be kept accurate - D9's recovery target
depends on it.

## D15 - Node 26 over Node 24 (2026-09-15)

**Chose:** Node 26 (26.8.2, moving to the first 26 LTS release when promoted).

Node 24 is LTS today but reaches end of life in April 2028, which would force a
runtime upgrade within about 18 months of launch; 26 is supported to April 2029
and is due for LTS before the first deploy. The usual breakage on a new Node
major is native add-ons, and this stack has none. Cost: until October 2026 it is
a Current release, with less third-party testing against it.

## D16 - Feature folders hold route modules; `#app/*` subpath imports (2026-09-15)

**Chose:** route modules live in `app/features/<feature>/`, listed in
`app/routes.ts`; imports use `#app/...` with explicit `.ts` extensions; no
client/server directory split.

React Router's default `app/routes/` directory lost: with by-feature
organisation (section 6) it would split every feature across two folders, and
`routes.ts` accepts route files anywhere under `app/`. The template's `~/` alias
lost: plain `node` cannot resolve it, and the migration runner, `create-admin`
and `node:test` all run under plain `node` - `#app/*` resolved under `node`,
`tsc` and Vite in a Node 26 container. A client/server split lost: a route module
holds both halves and the build separates them; `*.server.ts` and `*.client.tsx`
mark the boundary and the build enforces it. Cost: route files are not where the
React Router docs show them - `routes.ts` is the index - and every import
carries a `.ts` extension.

## D17 - The repository owns a Caddy site file, not the Caddyfile (2026-09-15)

**Chose:** `deploy/caddy/habre-cms.caddy` holds only this app's site block; the
server's main Caddyfile pulls it in with an `import` line.

Shipping a whole `deploy/Caddyfile` lost: `ocwebserver`'s Caddy also serves
`surenmaharjan.fyi`, and more apps may share it, so a deploy that replaced the
file would take the other sites down. Express stays out (D10 confirmed): Caddy can
compress and serve `build/client`, or `server.js` gets a small static handler -
`scaffold` picks. No per-service memory cap for
now. Cost: the server's main Caddyfile is managed by hand outside this
repository, and the setup script has to add the `import` line without
duplicating it.

*Amended 2026-09-16 (D22):* the static site on `surenmaharjan.fyi` was removed,
so "Caddy also serves `surenmaharjan.fyi`" no longer holds - the CMS now serves
that name itself, from this site file. The choice stands: the main Caddyfile
stays hand-managed and only imports site files, so a later app on the same
server cannot collide with this one.

## D18 - `server.js` serves `build/client` itself (2026-09-15)

**Chose:** a ~30-line static handler in `server.js` (GET/HEAD only, dotfiles and
paths outside `build/client` refused, hashed assets cached for a year).

Caddy's `file_server` lost: the app would then only work behind Caddy, so
`npm start`, Playwright and any future host would each need a proxy to serve
CSS and JavaScript, and the Caddy site file would need the release path. Express
or `sirv` lost on dependencies (D10). Cost: this is our code on a security
boundary - path traversal and dotfile requests were tested (both 404) and must
stay tested if it changes. Compression is not done by Node; Caddy's `encode`
does it.

## D19 - Biome for lint and format (2026-09-15)

**Chose:** Biome 2.5.13 with its recommended rules, 2-space indent, 100-column
lines.

The plan named no linter. ESLint plus Prettier lost on dependencies - two tools,
many plugins - against the minimal-dependency constraint. No linter lost because
strict TypeScript does not catch unused imports, `debugger` statements or
suspicious patterns. Cost: Biome's rule set is smaller than ESLint's ecosystem,
and there is no React Router-specific lint plugin.

## D20 - `isbot` pinned; item-specific packages installed with their item (2026-09-15)

**Chose:** `isbot` 5.2.2 as a runtime dependency; `jose`, Editor.js,
`aws4fetch` and `image-size` not installed until items 1, 2 and 5.

React Router's default server entry imports `isbot` so crawlers get complete
HTML; without it the build adds a floating `^5` by itself, which breaks the
pinning rule. The deferred packages lost their scaffold-time install because an
installed package with no call site reads as a finished capability. Cost: the
items that need them add a dependency in their own diff.

## D21 - Production only, on the existing VPS; backups to a private R2 bucket (2026-09-16)

**Chose:** one hosted environment, `production`, on `ocwebserver` (a server we
manage); nightly `pg_dump` copied to a second, private R2 bucket with its own
token.

Staging on the same VPS lost: a second service and database cost ~100-150 MB of
~580 MB free RAM. Staging on a second VPS lost: another box to patch and possibly
pay for. Releases are tried locally and in CI instead. Backups to another provider
lost to one fewer account; pulling to the owner's machine lost because it only
runs while that machine is on. Secrets (database password, `JWT_SECRET`) are
generated on the server by the setup script and never leave it; a rebuild makes
new ones rather than restoring them. Cost: no rehearsal environment - a bad
release is found in production and undone by `deploy rollback`; images and
backups share one Cloudflare account, so losing that account loses both (the
content itself survives in the database only if the VPS does); and every
self-hosting duty - restarts, TLS renewal, patching, both firewalls, backups - is
ours.

## D22 - Public site on the apex domain, admin on a subdomain, one app routing by host (2026-09-16)

**Chose:** `surenmaharjan.fyi` serves the public site and `cms.surenmaharjan.fyi`
the admin (still under `/admin`), both answered by the one application, which
routes by the request's host. `PUBLIC_URL` and `ADMIN_URL` replace `APP_URL`.
Built in item 4.

Everything on `cms.surenmaharjan.fyi` lost: no work, but the public address
carries `cms.`. Everything on the apex with `/admin` lost: one origin is the
simplest code, but it puts the login page on the public domain and browsers send
the admin cookie with every public page view. Renaming `/admin` to `/cms` lost:
`cms.surenmaharjan.fyi/cms/...` repeats itself and changes item 1's routes and
tests for nothing; a prefix is still needed so admin and public routes cannot
collide and development can run on one host. Routing by host is also the shape
D8's "pick the database from the request's domain" and later custom domains
need. Two separate deployables were never considered - D4 holds. Cost: two
hostnames to configure in Caddy and production config, cross-host redirects to
build and test, and browser tests that need two local hostnames (`127.0.0.1` and
`localhost`) to exercise them.

*Reconsidered and kept, 2026-09-16.* The owner asked whether a single domain with
`/admin` would do. It would, and it is simpler - one origin, one certificate, one
Caddy block, no host routing, no cross-host redirects, and a smaller item 4. The
split was kept for one reason: on a single origin the session cookie travels with
every public page view, so **any XSS on a public page is same-origin with the
admin and can act as the logged-in user**, which the CSRF origin check cannot
distinguish from a real request. That risk is small today (public pages render
escaped structured blocks, no raw HTML, no comments, no forms) and grows with
item 5 and the page builder. A second reason: separate origins allow a strict
public CSP alongside the looser one Editor.js needs. Revisit only with those two
in view.

## D23 - The Node listener is built directly, to trust Caddy's forwarded headers (2026-09-16)

**Chose:** `server/app.ts` builds the request listener from
`@remix-run/node-fetch-server` **0.14.1** (now a direct, pinned dependency) with
`trustProxy: true`, wrapping React Router's own `createRequestHandler`, instead
of calling `createRequestListener` from `@react-router/node`.

Keeping the React Router wrapper lost because it cannot express this: it is the
same two calls and passes no options through (`@react-router/node`
`dist/index.js:23-28`), so `trustProxy` is unreachable. Without it the app builds
`request.url` from the connection, which behind Caddy is plain http on
127.0.0.1, while browsers send an `https` `Origin` - React Router then aborts
every form post, and the first production release shipped with login impossible
(F-21). Setting `protocol: "https"` outright lost: it would be wrong in
development and in the browser tests, which really do serve http. Terminating
TLS in the app lost: Caddy already does it for every site on the server (D17).

The package is not new to the tree - it is `@react-router/node`'s own dependency
- but importing it ourselves makes it ours to pin and upgrade. Cost: one more
pinned dependency, which must move in step with `@react-router/node` (its range
is `^0.14.1`); and the app now trusts `X-Forwarded-*`, which is only safe because
it listens on 127.0.0.1 and nothing but Caddy can reach it - **if it is ever
exposed directly, a client can forge its own origin and client address.**

## D24 - Database-backed tests live in the Playwright suite, not `node --test` (2026-09-16)

**Chose:** tests that need PostgreSQL go in `e2e/`, run by `npm run test:e2e`;
`node --test` keeps only pure logic, and modules holding it are split away from
anything that opens a connection.

`npm test` runs inside `npm run verify`, which CI runs **with no database**, so a
database-dependent unit test turns CI red on the next push. Skipping such a test
when `DATABASE_URL` is absent lost: a test that silently skips in the one place
that runs automatically reports safety nobody has. Cost: those tests only run
when someone remembers, because CI does not run the browser suite (F-17) - so the
ownership rule and the stale-save check are proven by tests no pipeline gates on.
The real fix is a PostgreSQL service in CI, which is F-17's own change. This also
forces a file split whenever logic needs testing beside a database module -
`entry-input.ts` beside `entries.server.ts`, `editor-content.ts` beside
`post-form.tsx` - following `db/pending-migrations.ts`.

## D25 - A post's web address is chosen once, at creation (2026-09-16)

**Chose:** `createDraft` derives the slug from the title and never changes it;
later title edits leave the address alone.

Following the title lost: a saved draft's address would move under any link
someone had shared, and every save would re-check uniqueness against the table.
Changing it deliberately is the "Change" control `design.md` describes, which no
item has built. Cost: an address can end up unrelated to a retitled post until
that control exists, and item 3 or 7 has to build it.

## D26 - Blocks are stored as plain text in `blocks_format` v1, escaped when handed back to the editor (2026-09-16)

**Chose:** `{id, type, data}` blocks holding **plain text**, with the editor's
markup stripped on the way in (`toPlainText`) and re-escaped on the way out
(`escapeForEditor`).

Storing the editor's HTML lost - D5 rules it out, and it is what makes a page
builder possible later. The escape on the way out is not symmetry, it is the fix
for a real stored-XSS hole (F-33): Editor.js sanitizes on save and on paste but
renders with `innerHTML`, so text that merely *looks* like markup executed when a
post was reopened. **The same obligation lands on item 4's public renderer**,
which must render through JSX and never an HTML-building helper - and note the
`title` column is stored raw, never passing through `toPlainText`. Cost: bold,
italic and links wait for item 2b, which introduces `v2` with structured inline
runs and migrates existing rows; until then a writer's `<b>` is kept as visible
text rather than formatting.

## D27 - Untrusted structure is bounded by name, not by hoping (2026-09-16)

**Chose:** the block mapper refuses rather than copes - `Array.isArray` at every
level, `null` and non-objects skipped by name, nested results pushed one at a
time rather than spread, 8 levels of nesting, 500 items, 200 blocks, 20,000
characters a block, and a 1 MB body; and a save carrying **no `blocks` field at
all** is refused rather than read as an empty post.

Every bound here was earned by something measured, not imagined: `String(item)`
stored every list as `[object Object]` (F-32); an 82-byte body with `items:
[null]` threw a TypeError to an action with no catch; a 150,000-item child
exhausted the stack through an argument spread; a native submit with no `blocks`
part wiped a saved body twice over, once from the server side (F-34) and once
from the client defaulting an unreadable editor to an empty post (F-42). Cost:
the mapper is longer and more defensive than its happy path needs, and a writer
who exceeds a bound is refused rather than truncated - which is the intended
trade, since truncation loses work silently.
