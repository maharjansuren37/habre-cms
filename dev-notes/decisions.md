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
