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

**Superseded by D148** (2026-10-01): platform v1 has many sites, created by
public signup.

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

**Amended by D154** (2026-10-01): the AI site generation run is background
work inside the same process. Still one deployable.

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

**Superseded by D148** (2026-10-01): public signup means many sites in one
installation from platform v1. The database-per-site versus shared-tables
choice reopens for `architect`, with this entry's reasoning as its input.
**Settled by D151** (2026-10-01): shared tables with a site id, and row-level
security as a second guard.

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

*Widened 2026-10-06 (D324, item 16b):* the repository also owns a systemd
drop-in for `caddy.service` and the placeholder `/etc/caddy/habre-cms.env`. The
main Caddyfile and Caddy's unit stay hand-managed.

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

**Superseded by D153** (2026-10-01), when item 16 is built: the admin moves to
`app.<platform domain>` and sites to a separate sites domain. The reasoning
above - separate origins for the admin and public pages - carries over and is
strengthened by putting sites on a different registrable domain.
Took effect with item 16a (2026-10-06, D309-D312): the platform and sites hosts
replace the apex/`cms.` split.
Fully superseded with item 16b (2026-10-06): the Caddy file redirects
`cms.surenmaharjan.fyi` to the platform host, and `surenmaharjan.fyi` is site 1's
own domain. Live once the v1 deploy installs it.

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

## D28 - Inline formatting is stored as flat canonical runs (2026-09-21)

**Chose:** a piece of text is a list of `{ text, bold?, italic?, href? }` runs -
`blocks_format` `v2` - with exactly three marks, whitespace collapsed, and one
canonical form per text: no empty runs, no two neighbours with identical marks,
a mark key present only when it applies.

Beat: a nested tree, where `<b><i>x</i></b>` and `<i><b>x</b></i>` mean one thing
and compare as two; and text-plus-ranges, where every edit that shifts an offset
breaks the ranges. Flat runs compare with a deep-equal, which is what the browser
tests assert on, and render as a simple map in JSX for item 4. Line breaks inside
a block stay collapsed to a space rather than becoming a fourth mark nobody asked
for. **This supersedes the "Cost" half of D26:** a writer's `<b>` is formatting
now; text that merely looks like markup is still kept as visible characters, and
D26's escaping obligation moved into `runsToHtml`. Cost: run JSON is larger than
a plain string, so the 1 MB body cap is reached slightly sooner (F-39), and each
new mark is a `v3` migration rather than a silent extra field - which
`runsSchema`'s strict objects make explicit on purpose.

## D29 - The editor's HTML is parsed by an in-repo scanner, not a library (2026-09-21)

**Chose:** ~100 lines in `app/features/blocks/inline-runs.ts` - a single
left-to-right scan with counters, no recursion and no regex over the whole input.

Beat: `node-html-parser`, `parse5`, `htmlparser2`, DOMPurify. The input is
Editor.js's already-sanitized output over four tags, the project's
minimal-dependencies constraint makes any runtime dependency a recorded decision,
and the bounds D27 requires are far easier to prove on code we own: 20,000
characters, 2,000 runs, 10,000 tags, each checked as the scan goes so a crafted
input stops early. Cost: a hand-written parser is ours to get right - which is
why its tests carry the obfuscated-scheme cases and the round trip, and why an
independent review re-ran roughly 60 hostile inputs against it before ship.

## D30 - An unsafe link refuses the save, against a scheme allowlist (2026-09-21)

**Chose:** `http:`, `https:`, `mailto:`, a site-relative `/path` (not `//` or
`/\`) or a `#fragment`, at most 2,048 characters - checked after ASCII
whitespace and control characters are removed, because browsers ignore those
before reading a scheme. Anything else **refuses the whole save**, naming the
block.

Beat: dropping the link and keeping the text, which silently loses what the
writer did (D27 again: refuse rather than truncate); allowing `tel:`, which
nobody asked for; and allowing anything `new URL` parses, which includes
`javascript:`. The check lives in `isSafeHref` and is applied by both the parser
and the stored schema, so a payload that never went through the parser cannot
store what the parser would refuse. This matters because Editor.js's own link
field accepts any `scheme:` - its `addProtocol` passes `javascript:` straight
through - so the server is the only check there is. Cost: a writer who pastes an
address the allowlist does not know is refused rather than corrected.

## D31 - The block format marker is enforced at both ends (2026-09-21)

**Chose:** the database refuses a write whose `blocks_format` is not the current
one (`entries_blocks_format_check`), the reader refuses a row whose format this
build does not understand (`assertKnownFormat`, naming the entry id and both
formats), and `updateDraft`'s `where` requires the row's current format so a
stale tab cannot overwrite a newer one.

Beat: trusting that every write goes through the `BLOCKS_FORMAT` constant. It
does today; the measured failure is what a `v3` deploy would do to an editor tab
opened before it - before the `where` clause, a save from such a tab answered 200
and silently replaced newer content with older, downgraded content (F-46). Cost:
one extra column on every read and a 500 rather than a rendered message when a
row is from the future - loud, which is the point, and unreachable while the
check constraint holds.

## D32 - Values PostgreSQL cannot hold are refused at the trust boundary (2026-09-21)

**Chose:** one predicate, `isStorableText` - no U+0000, and `isWellFormed()` -
applied to run text, link addresses and block ids, all of which land in the same
`jsonb` column; the post title carries its own U+0000 refusal, because it lands
in a `text` column with the same limitation.

Both were measured reaching the database: `jsonb` rejects U+0000 and a lone
surrogate ("Unicode low surrogate must follow a high surrogate"), and either one
turned an authenticated crafted save into a 500 through the error boundary,
losing whatever was in the editor (F-47, F-49; OWASP Top 10:2025 A10). The parser
strips U+0000 but the schema *refuses* a lone surrogate rather than repairing it
with `toWellFormed()`, because that would silently rewrite a writer's text to
U+FFFD - D27's rule again. Cost: two checks on every save of every run, and a
refusal message rather than a repair for input no editor can actually produce.

## D33 - Editor.js's own styling is overridden only inside the editor (2026-09-21)

**Chose:** every override of the library's injected CSS is scoped under
`.canvas`, one class more specific than the rule it replaces, so it wins on
specificity rather than on the order Editor.js happens to inject its stylesheet.

Two were needed and both were first written too wide: the selection colour, where
Editor.js's `.codex-editor ::selection` light blue hid selected text in dark mode
and the first fix changed selection app-wide on a misreading of the rule's scope
(F-44); and the toolbar's focus ring, where the library's only affordance is a
background swap at 1.1:1 that is also identical to hover (F-48). **Keyboard focus
in that toolbar is a class, not DOM focus** - the caret stays in the block while
Editor.js moves `ce-popover-item--focused` along the items - so `:focus-visible`
never fires and the ring has to hang off that class. Cost: these rules are
coupled to internal class names of a library that does not promise them, so an
Editor.js upgrade is the moment to re-measure; both are guarded by browser tests
that were shown to fail with the rules removed.

## D34 - `/admin` redirects to `/admin/posts`, rather than becoming the list itself (2026-09-21)

**Chose:** `/admin`'s loader always throws a redirect to `/admin/posts`, which
is the real list route.

Beat: rendering the list directly at the bare `/admin` path, which is what
`home.tsx`'s own comment ("makes /admin the posts list") read as on a literal
reading. `project-plan.md`'s Routes table names `/admin/posts` explicitly as
its own route, comma-separated from `/new` and `/:id` - the redirect satisfies
both that table and the comment's intent, and gives every future admin section
(`/admin/pages`, `/admin/media`, …) the same shape: a named index route, not an
overloaded root. Cost: one extra redirect hop on first arrival at `/admin`
(see D40).

## D35 - The admin nav grows one entry per shipped section, not five with four disabled (2026-09-21)

**Chose:** the sidebar shows only "Posts" - the one section that is real.
Pages, Media, Settings and Users each add their own entry when their own item
ships.

Beat: showing all five now, with the unbuilt four greyed out or disabled -
`design.md`'s full five-item description describes the *finished* shell, and a
nav item pointing at a route that does not exist yet is a dead link regardless
of styling. Cost: the nav's shape changes visibly at every future item that
adds a section, rather than being stable from day one.

## D36 - Delete is a two-screen confirmation, not a JS dialog or an inline toggle (2026-09-21)

**Chose:** `GET /admin/posts/:id/delete` shows a confirmation page; `POST` on
the same route performs the delete.

Beat: a JavaScript `confirm()` dialog, which breaks the moment JavaScript is
off (D10: forms work without it); and an inline row toggle ("Delete? Cancel /
Confirm"), a second interaction pattern invented for one button when
`post-edit.tsx` already has the exact GET-then-POST shape this reuses. Cost:
one extra screen between clicking Delete and it happening - the point, not a
side effect.

## D37 - A successful delete's message reaches the list through `?deleted=<title>` (2026-09-21)

**Chose:** the redirect after a delete carries the removed title as a query
param, read once by the list's loader and shown as a success banner.

Beat: inventing a new mechanism, when the `posts-list.html` mockup already
shows this exact banner shape after a redirect-producing action (its "is
published." example). Item 4's publish/unpublish should reuse the same param
shape for its own banner rather than a second one. Cost: the param is plain
text in the URL, readable and shareable, and reflected back unbounded and
unverified - a finding the item's own review caught (F-57), not fixed here.

## D38 - `PAGE_SIZE = 20` (2026-09-21)

**Chose:** the list shows 20 posts a page.

Beat: no pagination at all, which the quality bar's "a few thousand entries"
scale rules out directly; and a larger page size, which the mockup's own row
count did not suggest was needed. Cost: at a few thousand entries, up to a few
hundred pages - acceptable at this project's stated scale.

## D39 - No new database index for the list's search or filter (2026-09-21)

**Chose:** `listEntries`'s `type`/`status` filter and `ilike` search run as a
sequential scan, with no new index.

Beat: adding one now, which would need `pg_trgm` for the `ilike` half - a new
dependency the minimal-dependencies constraint makes its own decision, not a
passenger on this one - for a scan that is sub-millisecond at "a few thousand"
rows. The same judgment already recorded for the slug lookup (F-27). Cost:
revisit if the entries table ever grows past what a sequential scan comfortably
covers.

## D40 - `PAGE_SIZE` stays server-only; the client works from a derived `totalPages` (2026-09-21)

**Chose:** `listEntries` computes and returns `totalPages` itself; the client
component never imports the constant.

Not a choice between two options so much as a build-time correction: computing
the page count from `PAGE_SIZE` directly in the client component tried to pull
a server-only constant into the browser bundle, and React Router's build
correctly refused it - server code cannot reach the client (`code-splitting`
docs). Cost: none - the derived number is strictly what the client needed
anyway.

## D41 - `home.tsx` became `home.ts` once it held no UI (2026-09-21)

**Chose:** the redirect-only `/admin` route is a `.ts` file exporting only a
`loader`, matching the project's own resource-route convention (`logout.ts`).

Its placeholder markup - "Hello, {name}" - left with item 3's redirect, and
what remained was a loader that always throws, never a component. Coding
standards already name this shape ("Resource routes … are `.ts` files
exporting only `loader`/`action`"); keeping the `.tsx` extension and an unused
default export would have been the second way to write the same thing. Cost:
none.

## D42 - Publish and unpublish save content and status in one atomic update (2026-09-21)

**Chose:** `saveEntry` (item 4a) takes an optional status transition applied in
the same `update` statement as the title/blocks save, rather than two separate
requests.

Beat: a save-then-publish pair, which could race against each other or against
a concurrent edit in a way the existing single-version optimistic-concurrency
check would not catch - two requests means two chances for another save to land
in between. Cost: none; the transition is one more SQL fragment on a query that
already existed.

## D43 - Once published, neither Save nor Unpublish is styled `primary` (2026-09-21)

**Chose:** both buttons use the `default` button variant once a post is
published; only `Publish` (on a draft) gets `primary`.

Beat: forcing one of the two into `primary` to satisfy an assumed "there must
be one" rule - design.md's actual rule is "at most one primary per view," which
zero also satisfies, and neither Save nor Unpublish is the important action on
a published post the way Publish is on a draft. Cost: none.

## D44 - The publish/unpublish success banner has no "view it on the site" link yet (2026-09-21)

**Chose:** the banner says `"<title>" was published.` with no link, even though
design.md's generic Success state calls for one ("a link to the result").

Beat: linking to a public post URL that does not exist until item 4b ships -
the public site still renders a placeholder home page. Cost: item 4b should add
the link once `/posts/:slug` is real, rather than this item inventing a URL
ahead of the feature that serves it.

## D45 - Publish/Unpublish only appear once a post has been saved once (2026-09-21)

**Chose:** `PostForm` shows the Publish/Unpublish button only when the post
already has an address (`slug !== ""`); a brand-new, never-saved post gets only
Save.

Not in the original spec - discovered while building it: `post-new.tsx`'s
action always creates a new entry as a draft, with no way to carry a status
transition through `createDraft`. Without this gate, a Publish button on an
unsaved post would render and do nothing when clicked. Beat: teaching
`createDraft` a transition too, for a first-save publish nobody asked for.
Cost: none - the gate is one boolean already derived from a prop the form had.

## D46 - The posts-list banner title is capped at 200 characters, matching the entry title's own limit (2026-09-21)

**Chose:** `readBanner` (`app/features/content/banner.ts`) truncates whatever
`?deleted=`/`?published=`/`?unpublished=` carries to 200 characters before it
reaches the page.

Repaired finding, not an original design choice (F-57): the param is read
straight from the URL with no proof the action it names actually happened, so
a crafted link could make the banner say anything, at any length. Beat: a flash
cookie instead of a URL param, which would close the "no proof" half too but is
a bigger change than this fix warranted. Cost: the "no proof" half is still
open - a crafted link can still show a plausible-looking success banner to a
logged-in admin, just not an unbounded one.

## D47 - The public home page shows the newest 10 published posts, no pagination (2026-09-21)

**Chose:** `listPublishedPosts(limit)` (item 4b) caps the home page at 10 posts,
newest first, with no "older posts" link.

Beat: matching the admin list's `PAGE_SIZE` (20) - a different concern with no
reason to be coupled to it - and building pagination nobody asked for at this
scale (`quality-bar.md`: a few thousand entries, not a few thousand read every
day). Cost: revisit if the public archive ever needs to go back further than
the newest 10.

## D48 - The public header and footer show fixed "Habre CMS" text, no nav, until site settings exist (2026-09-21)

**Chose:** `layout.tsx`'s `Chrome` hardcodes the brand text and omits a
navigation list entirely, rather than inventing placeholder content.

Beat: a fake site title or a dead-link nav - mirrors the admin shell's own
precedent for the same gap (`design.md`: no nav list until the first admin
section ships). Cost: none; item 7 replaces this wholesale once
`site_settings` exists.

## D49 - Public posts are ordered by `published_at`, not `updated_at` (2026-09-21)

**Chose:** `listPublishedPosts` orders by `published_at desc`.

Beat: reusing `listEntries`'s admin ordering (`updated_at desc`), which would
let an unrelated copy-edit silently reorder the public home - readers should
see order reflect when something became public, not when it was last touched.
Cost: none.

## D50 - Public dates are formatted with an explicit `timeZone: "UTC"` (2026-09-21)

**Chose:** both `home.tsx` and `post.tsx` format dates with `timeZone: "UTC"`
explicitly.

Beat: leaving it implicit, which is exactly the shape of an already-recorded
bug in the admin list's own date formatter (F-55: a server/client locale
mismatch, a hydration mismatch waiting to happen). New code doing the same
kind of formatting does not get to repeat a defect already on record. Cost:
none.

## D51 - A missing or draft post 404s inside the public layout's own `ErrorBoundary`, not root's (2026-09-21)

**Chose:** `layout.tsx` exports its own `ErrorBoundary`, themed inside the
site's header/footer, rather than extending `root.tsx`'s.

Beat: reshaping root's boundary (shared with the admin, out of scope here) or
shipping the public 404 unthemed - `design.md` explicitly left the 404's shape
"to be decided in item 4," and this is that decision. Cost: `root.tsx`'s own
dev-mode diagnostic behavior no longer reaches errors thrown inside the public
route subtree (closest boundary renders) - `layout.tsx`'s `ErrorBoundary`
mirrors that same dev-mode pattern itself (D52) so nothing is lost by the
split, beyond the pre-existing gap tracked separately as F-69.

## D52 - The layout's header/footer live in a shared `Chrome` component, used by both the normal layout and its `ErrorBoundary` (2026-09-21)

**Chose:** a `Chrome` function component wraps both `PublicLayout`'s default
export and its `ErrorBoundary`.

Not in the original spec - discovered while building: React Router's error
boundary *replaces* its route's own component entirely rather than nesting
inside it (confirmed against the installed docs), so without a shared
component a themed 404 would have lost the header/footer it was meant to sit
inside. Beat: duplicating the header/footer markup in both places. Cost: none
- any future public route adding its own `ErrorBoundary` should follow the
same shape.

## D53 - `createDraftFor`'s test helper now sets `published_at` for a "published" seeded row (2026-09-21)

**Chose:** `e2e/helpers/users.ts`'s `createDraftFor` defaults `published_at`
to `now()` when `status: "published"`, or accepts an explicit `Date` for
deterministic ordering in tests.

Not in the original spec - the helper never set it before item 4b, because
nothing before this item ordered by it; without the fix, seeded "published"
rows tied at `null` and made ordering unverifiable. Beat: leaving tests to
work around it individually. Cost: none - every future test seeding published
posts should pass an explicit `publishedAt` when order matters, rather than
relying on insertion order.

## D54 - The media library lists every uploaded file to every role; only deletion is ownership-scoped for authors (2026-09-22)

**Chose:** `listMedia` returns every row, unscoped by actor, to every signed-in
role; `deleteMedia`/`findMediaForUser` alone check `uploaded_by` for an author.

Beat: siloing the library per author, which the plan's permission table
("Media: author - upload; delete own") could be read to imply but never
actually states for *listing*. The product scope is "media library **to
reuse them**", which requires seeing what other people uploaded, not just
your own - siloing would make "reuse" impossible for anyone but the original
uploader. Cost: none identified; revisit if a future role needs a narrower
view than "everything, minus who may delete it".

## D55 - Alt text is required at upload, stored once on the media row, and not editable afterward in this item (2026-09-22)

**Chose:** `altTextSchema` refuses an empty value at upload time; there is no
UI to edit it later, and the data model holds one `alt_text` value per file,
not one per block-use.

Beat: making it optional and nagging about it later, which is exactly the
kind of accessibility debt this project's own findings ledger already
carries several open items for (F-29, and others). This item is the only
place in v1 that touches alt text, so requiring it here is the cheapest way
to guarantee every image item 5b places already has one. Cost: no way to fix
a typo'd alt text without re-uploading, until a future item adds an edit
screen - acceptable for v1's scope.

## D56 - Storage keys are generated (`randomUUID + detected extension`), never derived from the client's filename (2026-09-22)

**Chose:** `generateStorageKey` builds the R2 object key from `crypto
.randomUUID()` plus the extension `image-size` detected from the real bytes.
The client's original filename is kept only in the `filename` column, for
display.

Beat: keeping the client's name in the key, which would need its own
sanitizing (path separators, length, collisions) and can still collide
between two different uploads of, say, `photo.jpg`. Cost: none - the key is
never shown to anyone, so its opacity costs nothing in the UI.

## D57 - An upload's real bytes decide its image type, via `image-size`, not the browser's declared `Content-Type` (2026-09-22)

**Chose:** `detectImage` runs `image-size` against the actual buffer and maps
the four types it can return (`jpg`/`png`/`webp`/`gif`) to this project's
allowed set; a value the browser's `Content-Type` header claims is never
trusted on its own.

Beat: trusting the header, which a crafted upload can set to anything - the
same reasoning the project already applies to blocks (validated at the
boundary, never assumed from the client). Cost: a handful of image formats
`image-size` cannot detect are refused even if genuinely images, which is the
intended behaviour - the allowed set is JPEG/PNG/WebP/GIF only, matching the
plan's own upload restriction.

## D58 - A custom Editor.js tool places images, not the `@editorjs/image` package (2026-09-22)

**Chose:** a hand-written `Tool` class (`app/features/blocks/image-tool.client.ts`)
rather than the official npm package.

Beat: bending `@editorjs/image` to this project's shape - its `uploader`
callbacks return `{ file: { url } }`, storing a URL, which item 5a's own
contract already ruled out ("a media id is the only thing a block will ever
store"), and it has no "pick from an existing library" mode of its own.
Matches this project's existing precedent of a small in-repo piece for an
exact fit (D29's inline-run scanner, not a library). Cost: this project's
first hand-written Editor.js Tool UI - more code than a dependency line, but
code this app fully controls.

## D59 - Placing an image only picks from the existing library; there is no upload-in-editor (2026-09-22)

**Chose:** the image tool's dialog lists what `/admin/media` already holds.
Uploading a brand-new image still needs its own trip to `/admin/media` first.

Beat: rebuilding the upload path (validation, R2 write, alt text capture)
inside a Tool class, which would roughly double this item's surface for a
convenience nobody had asked for yet - and would not match the official
tool's usual upload-first UX, which was rejected for the same reason as D58.
Cost: placing a brand-new image needs two screens, not one - flagged against
"ease of use is the product" at the item's own review gate; easy to add
later if it turns out to matter.

## D60 - An image block's url/alt/dimensions resolve server-side, in the loader that already has the entry (2026-09-22)

**Chose:** `collectImageMediaIds` -> one `findMediaByIds` query -> a
`mediaById` lookup passed into `toEditorJs`/`renderBlocks`, built once per
page by the loader - never fetched per-block by the tool itself.

Beat: every image block self-fetching its own preview on mount (closer to
the official tool's usual shape), which would mean one request per image in
a post and a visible loading state on every open. Cost: `renderBlocks` and
`toEditorJs` both take a `mediaById` lookup now, and every future caller
(item 6's pages) has to supply it the same way.

## D61 - A `mediaId` that no longer resolves degrades silently rather than being prevented (2026-09-22)

**Chose:** deleting a media file that a post's block still references is
allowed; the block renders as "no longer available" in the editor and drops
silently on the public site.

Beat: blocking the delete or cascade-cleaning references - a block's
`mediaId` is JSON, not a foreign key, so nothing stops the delete anyway, and
solving that was real scope this item did not need to carry to be useful.
Matches the plan's own stance elsewhere ("R2 down means images missing, text
still served"). Cost: a writer can end up with a quietly broken block until
they notice it themselves in the editor.

## D62 - The media picker endpoint clamps an out-of-range page rather than returning an empty result (2026-09-22)

**Chose:** `/admin/media/picker` clamps a requested page to the last real one
before responding, via `clampToLastPage` (`app/features/media/media-list-query.ts`).

Beat: leaving it to return an empty page past the end, which F-56 and F-75
had already found twice in the list screens - closed here before it became a
third instance for `review` to find again. Cost: none.

## D63 - An image block with no `mediaId` ever chosen is dropped by the tool's own `validate()`, not sent to the server (2026-09-22)

**Chose:** `ImageTool.validate()` returns `false` unless `mediaId` is a
string, so Editor.js drops an abandoned "+ Image" placeholder from the saved
output entirely.

Not in the original spec - discovered while building: without it, an
abandoned placeholder would submit as `{ mediaId: undefined }`, which
`blocksSchema` could only refuse with a raw Zod sentence naming no way to fix
it - the same shape of rough edge F-51 already found for an empty list
block. Beat: leaving the server to refuse it. Cost: none; matches how
Editor.js already drops an empty paragraph.

## D64 - Code that closes a native `<dialog>` and moves focus elsewhere must close it first (2026-09-22)

**Chose:** in `image-tool.client.ts`'s thumbnail click handler, `dialog.close()`
runs *before* the callback that re-renders the block and focuses its new
button - not after.

Not in the original spec - discovered repairing F-76 (picking an image left
keyboard focus on `<body>`). The first fix attempted - moving the `.focus()`
call earlier, while the dialog was still open - did not work and was proven
not to work (`document.activeElement` stayed off the target): everything
outside an open modal `<dialog>` is **inert** per the platform's own rules,
so nothing outside it can take focus while it is still open, regardless of
which line the `.focus()` call sits on. Beat: custom focus-trap bookkeeping
to work around the inertness. Cost: none - a rule for any future native
`<dialog>` in this app: close it before touching focus outside it, not after.

## D65 - A public image's caption is its existing alt text, not a new field (2026-09-22)

**Chose:** the public renderer's `<figcaption>` shows the same `altText`
already stored on the media row and already resolved into every entry's
`mediaById` lookup - no new column, no new input anywhere in the app.

Beat: adding a per-placement caption field on the block or a caption column
on `media`. Alt text is already one value per file, captured once at upload
(D55), and the post editor's own preview already shows that value as a
read-only line under the image - reusing it publicly is the same choice made
a second time, not a new one, and a second field would be a second piece of
text an editor has to keep in sync with the first. Cost: the image's `alt`
and the visible caption say the same thing, so a screen reader announces it
twice in a row (`<figcaption>` is not an image's accessible name or
description in any browser) - accepted rather than fixed, tracked as F-79
pending the project's own screen-reader pass, because emptying `alt` instead
is not a reliable substitute and nothing has actually heard it yet.

## D66 - `entries.server.ts` takes a `type: EntryType` parameter, rather than a parallel `pages.server.ts` (2026-09-22)

**Chose:** every function in `entries.server.ts` (`findEntryForUser`,
`createDraft`, `saveEntry`, `listEntries`, `deleteEntry`,
`findPublishedEntry`) takes `type: EntryType` as its first parameter,
consistently, and now serves both posts and pages.

Beat: a second, near-identical `pages.server.ts`. The data-layer functions
are the same operation over the same table - the `entries` table has carried
a `type` column since item 1 - so the reason to change is shared, not merely
similar-looking: this is extraction, not premature abstraction. Cost: every
call site names its entry type explicitly (`"post"` or `"page"`), which is
one line of insurance against the wrong list reading the wrong rows, not
boilerplate.

## D67 - The post and page editors share one `EntryForm` component; the list and delete screens do not (2026-09-22)

**Chose:** `PostForm` was renamed to `EntryForm` and parametrized
(`entryType: "post" | "page"`), reused by both `post-new.tsx`/`post-edit.tsx`
and `page-new.tsx`/`page-edit.tsx`. `page-list.tsx` and `page-delete.tsx` were
instead copied from their post-* counterparts and adapted.

Beat: copying the form too (this project's usual "copy the second time,
extract on the third" default), and sharing the list/delete screens too. The
form's save/publish state machine is complex and has a real history of
subtle bugs fixed once in one place (F-34 - a native submit wiping the body;
F-42 - the same failure mode for `readEditor`; D64 - dialog focus
management) - duplicating it risks a future fix landing in only one copy. The
list and delete screens hold little beyond markup and a loader, so that risk
does not apply to them, and each can grow its own columns or filters later
without fighting a shared component. Cost: one `ENTRY_COPY` lookup table in
`entry-form.tsx` for the handful of things a post and a page editor say
differently (back link, address prefix, title placeholder).

## D68 - Reserved page addresses are absorbed into the free-slug search, not refused as an error (2026-09-22)

**Chose:** `RESERVED_PAGE_SLUGS` (`admin`, `posts`, `api`, `healthz`) are
unioned into `createDraft`'s "taken" list whenever `type === "page"`, so a
page titled "Admin" silently becomes `/admin-2` - the exact mechanism a
second "Hello world" already goes through. `api` is reserved even though no
`/api` route exists yet, so a page cannot occupy an address a later item
needs.

Beat: refusing the save with a new validation error. Cost: none - no new
message for a writer to read, no new code path to test beyond the existing
free-address search.

## D69 - A role restriction is enforced by a new, reusable `requireRole` middleware, refusing with 404 rather than 403 (2026-09-22)

**Chose:** `app/features/auth/require-role.server.ts` exports
`requireRole(allowed: readonly Role[])`, a route-level (not layout-level)
middleware that throws `data("Not Found", { status: 404 })` for a
disallowed role - the same shape `findEntryForUser` already uses for an
ownership refusal.

Beat: a 403 Forbidden, or an inline check duplicated per route. 404 keeps
every access refusal in this app answering the same way, and does not signal
that a restricted feature exists to a role that cannot reach it. Route-level
rather than layout-level because posts and pages share the admin-shell
layout but not a role restriction. Cost: none; reusable as-is by item 8 for
admin-only routes (settings, users).

## D70 - A role refusal is logged, matching every other access refusal in the app (2026-09-22)

**Chose:** `requireRole` calls `logSecurityEvent` (a new
`request_refused`/`reason: "role"` variant - `path`, `role`, `ip`) before
throwing its 404.

Not in the original spec - found by `review` (F-82): `refuseCrossSiteRequests`
and every login outcome already log their refusals, and a role check is
exactly the "access denied" fundamentals.md's Logging section names.
Beat: leaving it silent, matching `findEntryForUser`'s own unlogged
ownership refusal (accepted there as a pre-existing gap, not repeated here
in new code). Cost: none.

## D71 - Editing an existing entry is proven in e2e by a title change, not a body change, for pages specifically (2026-09-22)

**Chose:** `e2e/manage-pages.spec.ts`'s "edit its content" step changes the
page's title (a plain `<input>`) rather than retyping into the loaded
Editor.js block.

Not in the original spec - discovered repairing F-80: three different
techniques for retyping into an *already-loaded* Editor.js block (click+End,
click+Ctrl/Cmd+A, with and without confirming the DOM changed first) each
passed some test runs and silently saved stale content on others, with no
reproducible cause found after real investigation (a standalone debug script
with explicit waits, console and screenshot capture). Beat: continuing to
guess at a fourth technique, against this workflow's own "stop guessing
after the second try" rule. The title exercises the identical `saveEntry`
round trip deterministically, matching this project's own precedent of not
driving a flaky rich-text interaction when it is not worth what it adds
(`write-post.spec.ts`: "Driving the floating menu proved too flaky"). Cost:
no e2e coverage yet of editing an existing page's *body* specifically - low
risk, since `write-post.spec.ts` already covers the identical code path for
posts extensively. The underlying flakiness is unresolved, not just avoided;
worth a `debug` pass before a page builder needs to drive an already-populated
block reliably.

## D72 - A public page has no byline, unlike a post (2026-09-23)

**Chose:** `/:slug` renders a page's title and body only - no date, no author -
where `/posts/:slug` shows both above the title.

`design.md`'s "article with date and author above the title" was written
describing item 4b's post page specifically, and item 6b is not bound to repeat
it for a different kind of content. A page (About, Contact) is static
reference content, not a dated article; showing "12 March 2026 · Jane" under a
page like "About" would be misleading rather than helpful. Cost: `design.md`
had to be reworded to say the byline is posts-only rather than a blanket rule,
so a page carries the reasoning as write-up, not just as an absence.

## D73 - The article typography is copied into `page.module.css`, not shared with `post.module.css` (2026-09-23)

**Chose:** `page.tsx`'s CSS (article/title/body/image/figure/figcaption rules)
is a literal copy of `post.module.css`'s own rules, minus `.meta` and `.back`.

`fundamentals.md`: "copy the second time, extract on the third." This is the
second near-identical consumer of that typography, not the third - a shared
`article.module.css` earns its place when a third one shows up, likely a page
builder's own content area. Cost: the two files will drift apart by hand if
either is tuned later without remembering the other exists; worth extracting
the moment a third consumer appears rather than letting a fourth arrive first.

## D74 - A public page has no "back" link (2026-09-23)

**Chose:** unlike `/posts/:slug`'s "← All posts", a page has nothing linking
back to a list.

`/` is a real list of posts a reader came from; there is no equivalent list of
pages (no public page index exists, and none is planned before item 7's
navigation menu). Cost: none yet - revisit once item 7 adds a navigation menu,
since a page reached from that menu may then want a way back to it.

## D75 - Item 7 split into 7a (site title and logo) and 7b (navigation menu) (2026-09-23)

**Chose:** one spec covering a new table, a new admin screen, a reused picker
dialog, and a reorderable list editor was too big for one review cycle - the
same size call items 4, 5 and 6 each made.

7a ships the site's identity (title, logo); 7b (unbuilt) adds the navigation
menu on top of the same `site_settings` row. Cost: none - the plan already
supports sub-items, and 7b can build on 7a's table and route without any
rework.

## D76 - `site_settings` migrated whole, including the unused `navigation` column (2026-09-23)

**Chose:** the singleton table's full shape - `site_title`, `logo_media_id`,
`navigation`, `updated_at` - lands in item 7a's own migration, even though
nothing reads or writes `navigation` until 7b.

The alternative was a second migration on the same table when 7b starts. Cost:
a column that sits unused for one item's duration - cheaper than a second
migration, and the shape was already settled in the plan.

## D77 - `site_settings.logo_media_id` is a real foreign key, unlike a block's image reference (2026-09-23)

**Chose:** `references media (id) on delete set null`, rather than the JSON,
no-FK pattern block content uses for image ids (D61).

A block's image reference degrades silently at render time because it is JSON
inside `entries.blocks` - adding a real constraint there would need a new
mechanism. `site_settings.logo_media_id` is a plain column, so a real FK keeps
it valid for free instead of needing that same "no matching row" handling
built again. Cost: a deleted-media-row save must be guarded against the FK
violation this creates (see F-89's repair) - a real constraint doing its job,
same shape as F-25's unhandled slug clash.

## D78 - The logo picker duplicates the image block's dialog rather than sharing it (2026-09-23)

**Chose:** `logo-picker.client.ts` is a near-identical copy of
`blocks/image-tool.client.ts`'s dialog (fetch, grid, pagination, focus
handling), not a shared component.

`fundamentals.md`: "copy the second time, extract on the third." This is the
dialog's second use. Cost: a fix to one (e.g. F-88's keyboard-focus repair,
first found and fixed on the image block as F-76) has to be applied to the
other by hand until a third consumer justifies extracting one component.

## D79 - The public footer shows the site title as text, not the logo again (2026-09-23)

**Chose:** the header carries the logo and title; the footer repeats only the
title.

No mockup or `design.md` line asked for the logo twice on one page. Cost:
none - if a future design pass wants the footer branded further, it is a
small, separate change.

## D80 - Navigation reorder is move-up/move-down, not drag-and-drop (2026-09-23)

**Chose:** per-row "Move up"/"Move down" submit buttons, disabled at the ends,
over a drag handle.

Keeps the editor working with no JavaScript (D10), matching the project's
existing progressive-enhancement stance. Cost: one extra click per position
moved, versus a drag gesture - accepted since a menu tops out at 20 items
(the item's own cap). A future item can add drag-and-drop as a JS enhancement
over the same server actions if this ever feels slow to use.

## D81 - Add/remove/move on the navigation editor reshape the same form Save persists, with no separate draft storage (2026-09-23)

**Chose:** every row-editing intent (`nav-add`, `nav-remove-N`,
`nav-move-up-N`, `nav-move-down-N`) re-renders the draft from resubmitted
form fields; only `intent=save` writes to the database.

Beats a JS-driven local list state, which would leave the no-JS path unable
to add or remove a row at all - and beats a second table or session-backed
draft, which nothing else in this project uses for a form in progress. Cost:
every reshape is a full page round-trip; accepted for a form this size.

## D82 - A navigation row needs exactly one of a page or a URL, not a type toggle field (2026-09-23)

**Chose:** the row carries both a page dropdown and a URL text field, with
`draftRowsToNavItems` refusing a save where both or neither are filled,
rather than a `kind` radio that switches which one is shown.

A toggle would still have to render both fields to work without JS (there is
no way to hide one without client script), so it buys nothing over checking
the combination at save time. Cost: a row can be submitted in an invalid
"both" or "neither" state and only rejected at Save, not prevented by the
form shape itself.

## D83 - `pageId` existence is checked at save time; publish status is checked at render time (2026-09-23)

**Chose:** `draftRowsToNavItems` refuses a save whose `pageId` does not match
`listPagesForNav()` (any status), but whether the linked page is currently
published is decided later, when the public site resolves the menu.

Mirrors the image block's own split (D60 exists-check at save-adjacent time /
D61 silent degrade at render) rather than inventing a new rule for this
table. `pageId` is deliberately not a foreign key on `site_settings`, unlike
`logo_media_id` (D77) - so a page deleted after being added to the menu
degrades the same way an image does: dropped silently at render. Cost: a
menu item pointing at a since-deleted page is only caught by the editor
screen's own inline note (F-95), not the database.

## D84 - The public header renders every nav link as a plain `<a>`, not React Router's `<Link>` (2026-09-23)

**Chose:** `Chrome` in `public-site/layout.tsx` renders the resolved
`{label, href}` list with `<a href={href}>` for every item.

A `pageId` item's href is a known internal path, but a `url` item's is
whatever the admin typed - external, `mailto:`, or a `#fragment` - and the
resolved list mixes both without keeping the distinction around by the time
it reaches the component. `<Link>` is only correct for the internal subset,
so using it would mean carrying an extra "is this internal" flag through the
loader for no behavioral gain in a server-rendered app with no client-side
transition to preserve. Cost: none observed.

## D85 - No "last active admin" count check (2026-09-23)

**Chose:** rely on the shape of the guards already in place - every
`/admin/users*` route requires `requireRole(["admin"])`, and self-role-change
and self-deactivation are refused outright (D86) - rather than a separate
query counting active admins and refusing at zero.

Whoever performs a role change or deactivation is themselves an active
admin, and cannot change their own admin status as a side effect of
managing someone else. So before any action on a *different* user, at least
two active admins already exist (the actor, plus whoever admin status is
about to be removed from), which means at least one (the actor) always
remains afterward. Beats: a count-and-refuse check, which would be real
code defending against a state the existing guards already make
unreachable - and a branch that unreachable can never be exercised by a
test.

## D86 - Self-role-change and self-deactivation are refused; self password-reset is allowed (2026-09-23)

**Chose:** `user-edit.tsx`'s action refuses `change-role` and
`deactivate`/`reactivate` against the acting admin's own id (400, with an
explanatory message, re-checked server-side regardless of what a request
claims), but permits `reset-password` against your own account.

The first two would either strip your own access or lock you out
mid-session with no other admin needing to act - both are better done by a
different admin, and refusing them is also what makes D85 hold. Password
reset has no such asymmetry: it is your own credential. Resetting your own
password still bumps `token_version` like any other token-revoking action
(D6), so it logs you out and back to the login page immediately after -
not special-cased, since a person resetting their own password is not
surprised to be asked to log back in with it. Beats: exempting self-reset
from the token bump, which would make self-service resets behave
differently from admin-performed ones for no stated reason.

## D87 - The admin sets a new user's initial password directly; no forced change on first login (2026-09-23)

**Chose:** `user-new.tsx`'s create form takes a real password from the
admin and stores it as-is - no "temporary password" flag, no forced-change
screen on first login.

Matches `create-admin.ts`'s existing pattern exactly, and password reset by
email is already recorded as deferred (project-overview.md's Scope). Beats:
a temporary-password flag and forced-change flow, which would be new schema
and a new screen for a case the plan does not ask for.

## D88 - F-84 (the pre-existing `request_refused`/`role` event's `role: string`) is left untouched by item 8 (2026-09-23)

**Chose:** item 8's own new `SecurityEvent` variants (`role_changed`,
`user_deactivated`, `user_reactivated`, `password_reset`) are typed `Role`
from the start, but the existing `request_refused`/`role` variant F-84 flags
keeps its `role: string` field rather than being widened in the same diff.

Widening the existing line is an adjacent fix to code this item does not
otherwise touch. Beats: folding it in anyway, which `ai-interaction.md`
rules out directly - refactoring is its own item, never a passenger on
someone else's diff. F-84 stays open in the ledger for a future pass that
wants to close it outright.

## D89 - Middleware, loaders and actions read the path from React Router's normalized `url`, never `request.url` (2026-09-28)

**Chose:** any code that needs the request's path takes the `url` argument
React Router passes to middleware, loaders and actions - `.data` suffix and
`_routes`/`index` parameters already removed - rather than parsing
`request.url`. Reading only `searchParams` from `request.url` stays acceptable.

`request.url` ends in `.data` on every client-side navigation, which sent
every production login to `https://surenmaharjan.fyi/admin.data` (host
routing saw a non-admin path) and recorded `redirectTo=/admin/pages.data`
for an expired session (fix `admin-data-host-redirect`). Beats: stripping
`.data` ourselves, which duplicates the framework's normalization; and
teaching `isAdminPath` about `/admin.data`, which patches one symptom and
leaves every other path reader wrong. Costs: nothing at runtime; the two
log lines that still read `request.url` are F-101.

## D90 - Content-Security-Policy `script-src` uses a per-request nonce (2026-09-28)

**Chose:** `app/entry.server.tsx` generates a 16-byte nonce per HTML response
and passes it to `<ServerRouter nonce>` and `renderToPipeableStream`;
`script-src` is `'self' 'nonce-<n>'`.

Beats: script hashes, which change on every request because React Router's
inline scripts carry per-page hydration data; and `'unsafe-inline'`, which is
no script protection at all. Costs: the policy can only be set per response,
so it lives in `entry.server.tsx`, not with the other headers in `server.js`
(fix `security-hardening`, F-100).

## D91 - Two CSP policies: public is strict, admin allows inline styles and `data:` images (2026-09-28)

**Chose:** admin `style-src` adds `'unsafe-inline'` and admin `img-src` adds
`data:`, both for Editor.js; the public policy has neither. The full table is
in `blueprint/history/fixes/security-hardening.md`, *Data and contracts*.

Beats: passing the nonce to Editor.js's `style.nonce`, which means the client
reading the nonce back out of the DOM, for a risk (inline style injection) far
smaller than scripts. `data:` was found by the CSP browser test: Editor.js's
stylesheet draws an icon mask from a `data:image/svg+xml` URL. D22 anticipated
this split as a reason for separate hostnames. Costs: the admin is open to
style injection, and the page builder has to fit inside these directives.

## D92 - The CSP is chosen by path (`/admin`), not by host (2026-09-28)

**Chose:** `areaForPath` maps `/admin` and `/admin/*` to the admin policy and
everything else to public.

Beats: choosing by hostname, which would give single-host development and the
main browser-test server (both hosts equal, D22) no split at all. Costs:
nothing today, since host routing already keeps admin paths off the public
host.

## D93 - CSP is enforced directly, with no Report-Only phase and no report endpoint (2026-09-28)

**Chose:** the header is `Content-Security-Policy`, enforced from the first
release, and `e2e/content-security-policy.spec.ts` walks the public site and
the admin screens failing on any violation.

Beats: Report-Only first, which with no report collector only logs to
consoles nobody reads; and a `report-to` endpoint, which needs somewhere to
send reports. Costs: a violation on a screen the test does not visit (F-102)
breaks that screen in production with no signal; `monitor` can add reporting
later if it wants one.

## D94 - CSP is sent only by production builds (2026-09-28)

**Chose:** `entry.server.tsx` sets the header only when not
`import.meta.env.DEV`.

Beats: a development policy, which Vite's dev server cannot run under without
extra plumbing, since it injects inline scripts and styles with no nonce.
Costs: a CSP break is invisible in `npm run dev`; the browser tests, which run
the production build, are where it shows.

## D95 - Zod runs `jitless` in the browser (2026-09-28)

**Chose:** `app/lib/zod-jitless.client.ts` sets `z.config({ jitless: true })`,
imported by the two screens whose bundles load Zod (`entry-form.tsx`,
`settings.tsx`). `.client` keeps the server on Zod's compiled path.

Zod 4 probes `new Function` once; the policy refuses it, Zod swallows the
refusal, and the browser still reports a violation on every admin screen that
loads Zod. Beats: `'unsafe-eval'` in admin `script-src`, which re-allows eval
for every script and undoes much of D90; and filtering the violation out of
the browser test, which leaves a blind spot. Costs: any new screen that pulls
Zod into its bundle must import this module too (F-102).

## D96 - Forwarded headers are pinned in the Caddy site file (2026-09-28)

**Chose:** both `reverse_proxy` blocks in `deploy/caddy/habre-cms.caddy` set
`header_up X-Forwarded-Host {host}` and `header_up X-Forwarded-Proto {scheme}`.

The app takes its origin from these headers (`trustProxy`, D23). Production
already showed Caddy overwrites both, but only by default, and a
`trusted_proxies` setting in the main Caddyfile - not this repo's (D17) -
would pass a client's values through. Beats: relying on the defaults. Costs:
two lines per site block; not validated locally, since `caddy` is not
installed on the dev machine, so `deploy` runs `caddy validate` (F-22).

## D97 - The home page is one nullable `site_settings.home_page_id`; null means none chosen (2026-09-29)

**Chose:** a nullable foreign key to `entries(id)`, `ON DELETE SET NULL`
(migration 0006). Null is the only encoding of "no home page" (item 9's D-1,
as revised by D-12). Beats: a separate `home_mode` column plus an id, which
can disagree with each other, and storing a slug, which breaks when a page is
renamed. Costs: the foreign key cannot tell a page from a post, so the
settings action checks the type (D102). Deleting the page falls back safely
with no extra code.

## D98 - `/` never 404s: an unpublished or deleted home page shows the placeholder (2026-09-29)

**Chose:** `findHomePage()` returns the entry only when it is a published
page; otherwise `/` renders the welcome placeholder (item 9's D-2, revised by
D-12). Beats: a 404, which is right for a URL but wrong for the site's front
door. Costs: an admin can unpublish the front page without seeing a warning.

## D99 - `/posts` always lists posts, whatever the setting (2026-09-29)

**Chose:** a permanent `/posts` route (item 9's D-3). `posts` was already a
reserved page slug (D68). Beats: creating `/posts` only while a page is
chosen, which would break links to it when an admin switches back. Costs:
`/posts` is now part of the public URL contract.

## D100 - The home page's own slug redirects to `/` with a 302 (2026-09-29)

**Chose:** `page.tsx` throws `redirect("/")` when the page found is the
current home page (item 9's D-4), so each page has one address. Temporary
because the setting can change, and browsers cache a 301 indefinitely (the
same reasoning as D22's host redirects). Costs: a nav item pointing at the
home page renders `/<slug>` and takes one extra hop.

## D101 - A draft page can be chosen as the home page, with a hint (2026-09-29)

**Chose:** the select lists every page; one that is not published shows "Not
published - visitors see a placeholder until it is." (item 9's D-5), tied to
the select with `aria-describedby` (D-10). It matches the navigation editor
(item 7b): set things up before publishing. D98 keeps visitors safe
meanwhile. Costs: the setting can name a page visitors cannot see.

## D102 - The home page must be a page, checked in the settings action (2026-09-29)

**Chose:** the Save validates the id against `listPagesForNav()`, not only
its shape (item 9's D-6). A post has a date and byline and belongs in the
list. Beats: trusting the foreign key, which accepts any entry, or a
database trigger. Costs: the rule lives only in the action; a write from
anywhere else could store a post's id.

## D103 - `isHomePage` rides on `findPublishedEntry`'s own query (2026-09-29)

**Chose:** a subquery on `site_settings` inside the entry lookup, which also
returns the entry's `id` (item 9's D-7), so `/:slug` stays one query. Beats:
a second settings read in `page.tsx`. Costs: public loader data carries `id`
and `isHomePage`, which the view never reads (F-108).

## D104 - A page's image lookup is shared in `page-media.server.ts` (2026-09-29)

**Chose:** `resolvePageMedia`, used by `/` and `/:slug` (item 9's D-8).
`post.tsx` was outside item 9's files and keeps its own copy (F-104).

## D105 - `/posts` is titled "Posts - Habre CMS" (2026-09-29)

**Chose:** the "<name> - Habre CMS" pattern the other public routes use
(item 9's D-9). The placeholder at `/` keeps "Habre CMS".

**Superseded by D110** (2026-09-29): public titles now end in the site title
from Settings, not "Habre CMS" - `/posts` is "Posts - <site title>".

## D106 - The settings Save is one transaction (2026-09-29)

**Chose:** `saveSiteSettings` runs the identity, home page and navigation
writes inside `sql.begin`. A foreign-key refusal on the logo or home page
rolls the whole save back and returns that check's existing 400 (item 9's
D-11; F-106, F-110). The three single-column functions stay separate (F-40)
and take the transaction. Beats: ordering the writes, which cannot protect
against both races at once. Costs: the app's first transaction outside the
migrator. It is still a single-row change, so the plan's "every v1 action is
a single-row write" holds.

## D107 - Page-first: `/` is always a landing page and never lists posts (2026-09-29)

**Chose:** `/` shows the chosen published page, else a placeholder: the site
title as its `h1`, "This site is being set up.", and a "Read the posts" link
to `/posts` only when a post is published (item 9's D-12, the owner's call).
Beats: keeping the post list as the default (WordPress's model), which makes
posts what visitors see until someone changes a setting; and auto-creating a
"Home" page, which needs a write to production's real data. Costs:
production's `/` switches from the post list to the placeholder at deploy,
until the owner chooses a page (`needs-you.md`). The link check is one extra
`exists` query, run only when no page is shown.

## D108 - Only React Router's own 404s and 405s go unlogged (2026-09-29)

**Chose:** `handleError` in `app/entry.server.tsx` skips aborted requests
and route error responses with status 404/405 that carry the router's
internal `error` (`isRoutineRefusal`, fix `quiet-routine-refusals`, F-114).
Everything else is logged the way React Router's default logs it.
Beats:
- matching message text, which breaks across React Router versions;
- dropping every route error response, which hides 400s and 500s;
- logging refusals at `warn`, which still floods the journal.

Costs: a real form that posts to a route with no `action` no longer logs a
trace. Browser tests catch that case, and Caddy's access log still records
every 404 and 405.

## D109 - Control characters in source are written as escapes, never raw bytes (2026-09-29)

**Chose:** a control character a file needs - in a regex or a string - is
written as an escape (`\u0000`, `\u007f`), never as the literal byte (fix
`escape-control-characters`, F-115). One raw NUL makes git treat the whole
file as binary: `isSafeHref`'s allowlist went unreviewable in every diff
from item 2b until this fix.
Beats:
- keeping the literal and adding a `.gitattributes` `diff` override, which
  fixes git's view but not `grep` or the search tools that skip binary
  files, and has to be remembered per file;
- relying on Biome's `noControlCharactersInRegex`, which flags escapes too
  and so was already suppressed here, where the match is deliberate.

Costs: nothing checks it yet. It happened twice (items 2b and 5a), and a
source-scanning guard test is an open question, not built.

## D110 - Public page titles end in the site title, not the CMS name (2026-09-29)

**Chose:** every public `<title>` is `<page title> - <site title>`, or the
site title alone for `/`'s placeholder (fix `public-page-titles`, F-116).
The site title is read from the public layout's loader data through
`matches`, by one helper, `publicTitle` in
`app/features/public-site/public-title.ts`. "Habre CMS" is only the fallback
when that data is missing, and stays the admin's title, where the product is
the CMS. A chosen home page keeps `<page> - <site>`.
Beats:
- the site title alone on `/` even when a page is chosen - the page already
  has its own title in its `<h1>`, and the tab should say which page it is;
- a second settings query in each route's loader - the layout already loads
  the settings on every public request.

Costs: the helper asserts the layout's data type by route id. Renaming or
moving `features/public-site/layout.tsx` changes that id, and every public
title silently falls back to "Habre CMS" (the browser test in
`e2e/manage-settings.spec.ts` would catch it).

## D111 - Titles stay on the route `meta` export, not React 19's `<title>` element (2026-09-29)

**Chose:** the route module `meta` export for titles (fix
`public-page-titles`). React Router 8's installed docs
(`route-module.md`, *meta*) recommend React 19's built-in `<title>` element
over `meta`.
Beats:
- moving to the `<title>` element here, which would mean changing every
  route, admin included, inside a small fix.

Costs: the project stays on the approach its framework now calls
second-best. Moving over is a refactor of its own, if it is ever wanted.

## D112 - Public error pages are titled by the layout's `meta` (2026-09-29)

**Chose:** the public layout exports `meta`, giving a 404 "Page not found -
<site title>" and any other error "Something went wrong - <site title>" - the
same words its `ErrorBoundary` shows (fix `public-page-titles`). React Router
cuts `matches` off at the boundary that renders, so a child route's `meta`
never runs for its own 404. Before this, a public 404 had no `<title>` at
all, which fails WCAG 2.2's 2.4.2 Page Titled.
Beats:
- a `meta` in `root.tsx`, which would also title admin errors with the
  public site's name.

Costs: the "Something went wrong" branch has no test - a server error is
hard to cause in the browser tests, and `node --test` cannot load `.tsx`.

## D113 - Rescope: the page builder becomes the active direction (2026-10-01)

**Chose:** build a first cut of the page builder - sections on pages (item 10),
columns (11), ready-made sections (12) - appended after item 9. Items 1-9 stay
as built; nothing is removed, so no rollback. Section reordering uses move
up/down buttons like the nav editor, not drag-and-drop, so item 10 needs no new
runtime dependency.
Supersedes: the original scope line "MVP only, page builder deferred" (plan
section 11). The MVP decisions themselves stand.
Beats:
- a free-form canvas, which fights "really easy" and the accessibility bar;
- the other deferred items (tags, scheduling, SEO), which the owner did not pick.

Costs: sections change the stored block shape (D28), so `architect` should run
before `spec` for item 10, and existing pages must load as one section.

**Superseded by D148** (2026-10-01) as the active direction. Items 10-12 stay
built; the builder follow-ups move to Level 2.

Its rejection of a free-form canvas was reconsidered and **confirmed by D165**
(2026-10-01).

## D114 - Sections are v3 container blocks, arranged in React, one Editor.js per column (2026-10-01)

**Chose:** pages only store `section` blocks (`blocks_format` v3): `plain`
sections hold 1-3 columns of the existing leaf blocks; hero, cta and image-text
are typed blocks with fixed slots. Nesting stops at section -> column -> leaf;
at most 30 sections and 3 columns. v2 pages load as one implicit section and
convert on save; the only migration relaxes the format check to v2 or v3. The
section list (move up/down/remove buttons) lives in React; each column mounts
its own Editor.js.
Beats:
- a nested Editor.js inside Editor.js, which is fragile and hard to make
  accessible;
- a migration rewriting every page to v3, which is destructive and makes the
  release unrecoverable by symlink for no gain;
- sections on posts too, which nobody asked for.

Costs: the release carrying the check change cannot be rolled back by symlink,
and a v3 page breaks under older code. Many Editor.js instances on a large page
(bounded by the caps; item 10's verify checks usability). `page-media.server.ts`
(D60) must walk sections and columns.

Superseded at item 14 by **D169** (2026-10-02): one TipTap document per
entry, with sections and columns as nodes in it.

## D115 - Posts stay v2; only pages are v3, and a v2 page's implicit section is `"legacy"` (2026-10-01)

**Chose:** `blocks_format` is per entry type: pages read `v2` or `v3` and save `v3`,
posts only `v2`, and a `v3` post is refused loudly on read. A `v2` page loads as
one section with the fixed id `"legacy"`, replaced by a generated id on its first
save.
Beats: one format for everything (posts have no use for sections); deriving the
section id from the entry id (longer, no benefit).
Costs: the format check is on the entry type everywhere it is read or written.

**Will be superseded by D165** when item 14 is built: posts get sections too.

## D116 - A page holds 1-30 sections and 200 blocks in total; item 10 accepts only `layout: "1"` (2026-10-01)

**Chose:** the same 200 leaf blocks as a post, counted across all sections, keeps
the 1 MB save limit and the 1 s save target safe. `layout` is widened by item 11
rather than pre-built: item 10 accepts one column only.
Beats: 200 per section (30 x 200 = 6,000 blocks); accepting 2-3 columns the
editor cannot produce yet.
Costs: item 11 changes `sectionsSchema` and the wire parser together.

## D117 - Section ids: `crypto.randomUUID()` in the browser, unique, `[A-Za-z0-9_-]` only (2026-10-01)

**Chose:** the browser generates ids; the server checks 1-64 characters,
uniqueness within the page and the character class (F-119), because the editor
builds a focus selector from the id and keeps one reader per id.
Beats: shape-only validation as for block ids (two equal ids lose a section's
content on save; a quote in an id throws); `CSS.escape` alone (still allows
duplicates).
Costs: a hand-built request with other ids is refused.

## D118 - Removing a section asks inline; an empty section renders nothing publicly (2026-10-01)

**Chose:** Remove swaps the actions for "Remove this section? Remove / Keep" in
the card, focus on Keep; the only section has no Remove. A section with no blocks
produces no `<section>` element on the public page.
Beats: no confirmation (removal loses a section's content in one click); a modal
dialog (heavier, more to make accessible); empty `<section>` elements in the HTML.
Costs: a few more states in `sections-editor.client.tsx`.

## D119 - Shrinking a section's columns merges them, with no prompt (2026-10-01)

**Chose:** choosing fewer columns appends the removed columns' blocks to the end of the last kept column, in column order; growing adds empty columns on the right. Nothing is discarded.
Beats: refusing to shrink until the columns are empty (an extra chore for the editor); discarding (loses content); a confirm dialog (nothing is lost, so nothing to confirm).
Costs: growing again does not un-merge.

## D120 - A section's layout is derived from the column count the server receives (2026-10-01)

**Chose:** `fromEditorJsSections` sets `layout` to the number of columns sent (1-3) and the schema refuses a section whose `children.length` differs from `Number(layout)`. Continues D116's rule that the client's layout is never trusted.
Beats: sending `layout` and validating it against the columns (two fields that can disagree).
Costs: none; item 10's `layout: "1"` pages stay valid, so no migration.

## D121 - Equal-width columns, one breakpoint at 48rem (2026-10-01)

**Chose:** a multi-column section is a grid of equal columns from `48rem` up and a single stack, in column order, below it - in the editor and on the public page.
Beats: a per-section width choice (section styling is deferred); a new breakpoint (the app has one).
Costs: the page body keeps its 42rem reading width, so three columns are narrow.

## D122 - An empty column keeps its cell, and is hidden only when stacked (2026-10-01)

**Chose:** the public page renders an empty column as an empty `<div data-column>`; side by side it holds its cell, stacked it is `display: none`. A column's first block has no top margin, so a heading does not sit lower than a neighbour's text (F-124).
Beats: dropping empty columns (the next column would slide over and change the layout the editor chose).
Costs: an empty element in the HTML of multi-column sections.

## D123 - Column caps stay D114's: 30 sections x 3 columns, up to 90 editors (2026-10-01)

**Chose:** no total-column cap. Measured on the dev machine with a seeded page: all 90 editors mounted in about 190 ms and the save round trip took about 200 ms (bars: 10 s and 1 s).
Beats: a total-column cap chosen without evidence.
Costs: a slower machine or phone has not been measured; a total cap is the fallback.

## D124 - Images picked this session are remembered for editor re-mounts (2026-10-01)

**Chose:** `pickedMedia` in `image-tool.client.ts` records each image chosen in the picker; the sections editor adds it to the loader's media map whenever it re-mounts a section's editors (a column-count change).
Beats: re-fetching media on a count change; letting a just-picked image come back as "missing".
Costs: a module-level map that lives until the page is left.

## D125 - A ready-made section is its own section type, not a variant of `section` (2026-10-01)

**Chose:** `hero` (and 12b/12c's kinds) are siblings of the plain `section` in `sectionsSchema`, a discriminated union on `type`; callers that read `children` narrow with `isPlainSection` (`sections.ts`, Zod-free).
Beats: a `kind` field on `section` (would make `children` and `layout` optional and weaken the invariant D120 locked).
Costs: every caller that reads `children` has to narrow.

Superseded at item 14c by **D170** (2026-10-02): ready-made sections become
templates of ordinary blocks. Item 14c's spec says which of D126-D143's rules
carry over to blocks.

## D126 - Hero slots are plain strings, not runs (2026-10-01)

**Chose:** a hero stores `{ heading, text, button?: { label, href } }` as plain strings. **This amends plan section 6**, which worded ready-made slots as "runs, an allowlisted link, a media id".
Beats: storing runs (the slots are form fields with no toolbar, so marks could never be made and the shape would promise formatting that cannot exist).
Costs: adding formatting to a slot later is a new shape for that slot.

## D127 - Hero limits: heading 120, text 400, button label 40 characters; no newlines stored (2026-10-01)

**Chose:** the save parser collapses typed line breaks and runs of spaces to one space and trims; the schema refuses a stored line break. A label and a link are both set or both empty.
Beats: the 20,000-character run cap (a hero is a banner, not an article); refusing line breaks at save (Enter in the text box would break a save).
Costs: a hero's text is always one paragraph.

## D128 - Adding a section is two buttons, not a menu (2026-10-01)

**Chose:** "Add blank section" and "Add hero section" in the add row, both disabled at 30 sections.
Beats: a popover menu (more to make keyboard- and screen-reader-accessible for two options).
Costs: revisit when 12c makes it three kinds.

## D129 - Section kinds are not convertible (2026-10-01)

**Chose:** to change a section's kind, remove it and add the other.
Beats: converting with a slot-to-block mapping (content-loss rules for no stated need).
Costs: an editor retypes a hero's words if they wanted blocks instead.

## D130 - The wire names the kind; the server builds everything stored (2026-10-01)

**Chose:** a section is sent as `{ id, columns }` (plain) or `{ id, kind: "hero", fields }`; type, layout and every stored field are derived on the server, and an unknown kind, or a kind sent with columns, is refused as unreadable. Continues D116 and D120.
Beats: accepting a stored `type` from the client.
Costs: a new kind needs a new `kind` string on the wire as well as a new `type` in storage.

## D131 - A hero's button link box is plain text with a URL keyboard, not `type=url` (2026-10-01)

**Chose:** `<input type="text" inputMode="url">`; the server's link allowlist is the real check.
Beats: `type=url`, whose native check refuses a relative link such as `/about` and silently blocks the save (found by the 30-section browser test).
Costs: no native format hint.

## D132 - A hero has no image in 12a (2026-10-01)

**Chose:** the image slot and its picker arrive with item 12c (image + text); the hero button uses the primary button's colour pair, so no new contrast figure.
Beats: building the picker here, before any kind needs it.
Costs: a hero is text-only until 12c, if a hero image is wanted then.

## D133 - A call to action is its own section type and wire kind, with a required button (2026-10-01)

**Chose:** `cta` is a third sibling in `sectionsSchema` (`{ heading 1-120, text 0-400, button: { label 1-40, href } }`, button required); the wire kind is `cta`; a missing label or link is refused as "the button needs a label and a link". Continues D125 and D130.
Beats: a hero with a "button required" flag (blurs two kinds the editor labels differently); one shared "optional button" rule (a call to action with nothing to click is a hero by another name).
Costs: another union member for every caller that switches on `type`.

## D134 - Hero and call to action share one field parser (2026-10-01)

**Chose:** `slotSectionFromFields(type, ...)` in `blocks.ts` builds either kind; they differ only in the type, the name used in messages and whether the button is required. Hero messages are unchanged.
Beats: a copy of the hero parser per kind (12c would make three).
Costs: hero-named identifiers (`HeroForm`, `HERO_*`) now serve both - F-128.

## D135 - Three add buttons; the menu decision moves to 12c (2026-10-01)

**Chose:** "Add blank section", "Add hero section", "Add call to action", all disabled at 30 sections, wrapping on a narrow screen. Amends D128's "revisit at three kinds" to "revisit at four".
Beats: building a popover menu now (three buttons still fit one wrapped row).
Costs: 12c, which makes four, has to decide between buttons and a menu.

## D136 - A call to action is a bordered panel on `--color-surface` (2026-10-01)

**Chose:** 1px `--color-border`, `--radius-md`, `--space-6` padding, centred, heading at `--text-xl`; the button uses the hero button's rule. The one new colour pair, button fill on the panel, measures 6.45 light / 7.76 dark.
Beats: a bare banner like the hero (indistinguishable on the page); an accent-filled band (a new full-width colour pair to measure).
Costs: none beyond one contrast row in `design.md`.

## D137 - Image and text is its own section type and wire kind, with a required media id (2026-10-01)

**Chose:** `image-text` is a fourth sibling in `sectionsSchema` (`{ mediaId uuid, heading 1-120, text 0-400, button? }`); the wire kind is `image-text` with `mediaId` among its fields; the stored section holds the media id only, never a url, alt or size (D60). A missing or non-uuid id is refused as "choose an image". Continues D125, D126, D130.
Beats: an optional image (then it is a hero by another name); storing a url.
Costs: another union member for every caller that switches on `type`.

## D138 - One shared field parser serves all three ready-made kinds (2026-10-01)

**Chose:** `slotSectionFromFields` takes the third type and reads `mediaId` for image and text only; error labels come from one `SLOT_KIND_LABELS` table. Hero and CTA messages are unchanged.
Beats: a fourth near-copy of the parser.
Costs: hero-named identifiers still serve every kind (F-128).

## D139 - The picture's alt text is the library's, with no caption and no per-section alt (2026-10-01)

**Chose:** the public `<img>` takes `alt` from the media row; there is no figcaption; the editor shows the alt text, not a field for it.
Beats: a second alt field (drift from the library's, more to fill in) and a caption repeating the alt text beside the picture's own words.
Costs: one picture cannot carry a different alt in two places.

## D140 - The picture is always on the left, stacked above the text below `48rem` (2026-10-01)

**Chose:** two equal columns with a `--space-6` gap from `48rem` up, picture first; with no picture row the text takes the full width. No new colour pair.
Beats: a left/right choice (a setting no editor asked for, against the product's ease-of-use rule).
Costs: an editor cannot put the picture on the right.

## D141 - Four add buttons stay buttons; a menu is revisited at a fifth kind (2026-10-01)

**Chose:** "Add blank section", "Add hero section", "Add call to action", "Add image and text", all disabled at 30 sections and wrapping on a narrow screen. Closes D135's open question.
Beats: a popover menu (more to make keyboard- and screen-reader-accessible for no gain at four short buttons; the section-controls accessibility pass is itself unverified).
Costs: the row gets longer with each new kind.

## D142 - The picker dialog is the image block's, exported, not rebuilt (2026-10-01)

**Chose:** `openImagePickerDialog` and `PickerMedia` are exported from `image-tool.client.ts`; the section form's "Choose image" button calls it and moves focus back to itself afterwards.
Beats: a React copy of the dialog (two pickers to keep in step).
Costs: the form calls into vanilla DOM code, as the image block does.

## D143 - A deleted picture drops silently in public and blocks the save in the editor (2026-10-01)

**Chose:** publicly, the text renders and the picture does not; in the editor, the form says "This image is no longer in the library. Choose another." and a save sends no id, so the server refuses with "choose an image" and keeps the typed text.
Beats: failing the public page (the plan's stance on missing images is that text still serves) and silently saving a section with a dead id.
Costs: the server itself accepts any uuid, as an image block does (no database check on save).

## D144 - The 26 R2-uploading browser tests skip in CI through an explicit `E2E_SKIP_R2=1` (2026-10-01)

**Chose:** `e2e/helpers/storage.ts` exports `skipWithoutStorage`; the `e2e` job sets the switch, a laptop with a real `.env` does not, so all 141 still run locally.
Beats: a fake R2 server with an `R2_ENDPOINT` override (a production-code change and a bigger item), real credentials in CI (the shared dev token, fork-PR exposure), and auto-detecting a missing bucket (a silent skip is how coverage disappears).
Costs: image, logo and media behaviour is not covered by CI; the count is named in the docs.

## D145 - Browser tests are a separate `e2e` CI job, not part of `verify` (2026-10-01)

**Chose:** a second job beside `verify` with a PostgreSQL service; `npm run verify` stays database-free.
Beats: adding them to `verify` (every laptop run of the quick check would need a database).
Costs: two checks to read, and `e2e` is not a required check until the owner sets it in branch protection.

## D146 - The CI database role is made by `db/dev/init.sh`, not by the service's `POSTGRES_USER` (2026-10-01)

**Chose:** the app connects as a non-superuser that owns its database, as in development and production.
Beats: a superuser from the image's own environment (a migration needing superuser would pass in CI and fail in production).
Costs: one extra step.

## D147 - No retries in CI (2026-10-01)

**Chose:** `forbidOnly` in CI, no `retries`.
Beats: `retries: 1` (hides the F-103 race and any other flake).
Costs: a rare red run until F-103 is fixed.

## D148 - Rescope: an AI-powered website platform, Level 1 first (2026-10-01)

**Chose:** Habre becomes an AI-powered platform to create, manage and publish a
website, for everyone through progressive disclosure - Level 1 Personal, Level 2
Professional, Level 3 Developer, one content engine. Platform v1 (items 13-21)
serves Level 1 only: public signup creates a site on a platform subdomain, AI
builds a draft site from a description, the user edits and publishes, and a
Free plan with enforced limits plus one paid plan is billed (item 21). It is
also free and open source to self-host (licence not chosen): v1 must run on
Node.js, PostgreSQL and S3-compatible storage alone, with billing, AI, email and
signup each switchable off; the install guide comes soon after. The stack
is kept; TipTap 3 replaces Editor.js. Existing content is disposable. Two
principles recorded: "simple by default, powerful when needed" and "AI
suggests, the user applies".
Supersedes: D2 and D8 (one site per installation), D113 as the active
direction, and plan section 11's "public signup", "many sites", "forms",
"password reset by email" and "SEO fields" deferrals. Will supersede D13
(Editor.js) when item 14 is built - and with it the Editor.js-specific D29
(HTML scanner), D33 (editor styling), D58, D63 and D124 (image tool) and
D114's one Editor.js per column - and D22 (two fixed hostnames) when item 16 is.
Items 1-12 stay built and checked; nothing is rolled back. D1, D3, D4 and D9
still hold.
Beats:
- a general headless, API-first CMS (from a pasted enterprise brief): competes
  with mature open-source TypeScript CMSs and drops Habre's one edge, ease of
  use; its content API and custom types are Level 3, later;
- the brief's stack (Next.js, NestJS, Redis, OpenSearch, AWS): a rewrite of 12
  shipped items, and OpenSearch alone exceeds the 954 MB server; Postgres covers
  search, vectors and jobs at this scale;
- building all three levels at once, or the Level 2 groups the owner also
  wanted (editorial, findability, dashboard, media + builder) - they matter only
  once Level 1 has users.
Costs: multi-tenancy reaches every table, query and permission check; paid AI
and email providers; AI use must be capped per site from day one; the platform
needs its own name and domain (open question). "Describe your business, get a
site" is a crowded space - the edge is the path from Level 1 to Level 3 on the
same content, which only exists once Level 1 does. `architect` runs before
`spec` for item 13.

Its levels get names and a switch inside the product - Simple, Pro and
Developer - in **D166** (2026-10-02).

## D149 - Stripe is the payment provider, as a plain processor (2026-10-01)

**Chose:** Stripe, without its merchant-of-record service, for item 21's paid
plan. The business starts in Australia and expects mostly Australian customers
at first: 1.65% + A$0.30 on Australian cards from 2026-10-01 (1.7% before),
plus 0.7% for Stripe Billing on subscriptions, against 4-5% plus a fixed fee
for a merchant of record; international cards 3.5% + A$0.30, plus 2% when
currency is converted; A$25 a dispute. Australian GST (10%, registration required from A$75,000
turnover) is the owner's to handle; digital services sold overseas are generally
GST-free from Australia's side. Billing sits behind one module so the provider
can change. How the app calls Stripe is `architect`'s.
Beats: Paddle (handles VAT and sales tax worldwide, ~3% more on every sale;
the better choice if overseas sales grow), Polar (cheaper merchant of record,
younger), Stripe Managed Payments (not offered to Australian sellers), and Lemon
Squeezy (owned by Stripe, its future unclear).
Costs: overseas customers bring their own tax registrations - EU and UK VAT
from the first sale, US state sales tax past each state's threshold - before
they are sold to; moving to Paddle later means existing subscribers re-enter a
card. Fees from comparison sites, not Stripe's page - check stripe.com/au/pricing
before pricing the plan. The fixed A$0.30 favours yearly billing.

## D150 - Limits from the first signup, billing after a beta, own domains in the paid plan (2026-10-01)

**Chose:** every limit that protects money is on from the first public signup:
AI use (item 18) and media storage per site (moved from item 21 into item 15).
Launch is an invite-only beta on the Free plan with billing off; a user at a
limit sees "Paid plans coming soon". Billing is switched on, and signup opened
to everyone, once people are hitting limits, the terms of service and privacy
policy exist, and the GST question is answered. The one paid plan raises the
limits, lets a site use its own domain (moved from Level 2) and removes the
"Made with Habre" footer link. A limit refuses the action that would pass it,
never the published site: downgrading or a failed payment drops a site back to
Free limits, keeps what it already has, and blocks only new uploads and AI use.
Starting points to tune, not researched: Free 1 site, 3 AI site generations,
500 MB; paid e.g. 20 generations a month, 10 GB. The AI number comes from item
18's measured cost per generation.
Beats: storage capped only when billing arrives (signup would open uncapped);
billing live at launch (charges before anyone has used it, and before the legal
and tax work is done); a paid plan that only raises limits (WordPress.com, Wix
and similar sell the own domain and removing their branding - limits alone give
a Level 1 user little reason to pay).
Costs: item 21 grows - serving a site on its own domain needs certificates
issued per domain, which `architect` decides alongside D22's replacement, and
may place in item 16 instead. The beta earns nothing.

**Amended by D175** (2026-10-02): the one paid plan is Launch, at a
provisional $19 a month; prices follow measured use.
**Amended by D164** (2026-10-01): AI use is a monthly allowance of credits per
site, not a count of site generations; the starting points above become
allowances, set by the owner. `architect` kept own domains in item 21 (D153).

## D151 - Shared tables with a site id; row-level security as a second guard (2026-10-01)

**Chose:** every site-owned table carries `site_id`. The app scopes every
site-owned query by the site resolved from the request. PostgreSQL row-level
security on those tables shows a transaction only the rows of the site it has
set - and none when no site is set. Foreign keys between site-owned tables
include `site_id`.
Beats:
- a database per site (D8): a connection pool and a migration run per site on
  a 954 MB server;
- a schema per site: the same costs;
- app-only scoping: one forgotten `where site_id` leaks a stranger's content -
  the worst failure this product can have, and the easiest to write.
Costs: every site-owned query runs in a transaction that sets the site; the
two roles of D152; item 15a touches every data module (about 43 queries in
five files). Platform tables (`sites`, `site_domains`, `users`,
`site_members`, `email_tokens`, `invites`, `stripe_events`) stay outside
row-level security, because they are read before a site is known; app code
scopes them.

## D152 - Two database roles: an owner for migrations, an app role under row-level security (2026-10-01)

**Chose:** an owner role owns the tables and runs migrations. The app connects
as a second role that reads and writes rows, cannot change the schema, and is
subject to row-level security.
Beats: one role - a table's owner bypasses row-level security, which would make
D151's second guard decorative.
Costs: `deploy/setup-server.sh`, `db/dev/init.sh`, CI and `.env.example` create
and name both roles, and `npm run db:migrate` takes the owner's connection
string. Bonus: an injection through the app cannot drop a table. Backups are
unaffected - `pg_dump` runs as the `postgres` superuser.

## D153 - The platform on `app.<platform domain>`, sites on a separate domain, a wildcard certificate (2026-10-01)

**Amended by D495** (2026-10-12): interim domains until the platform domain is bought.

**Chose:** sign-in, signup, onboarding and the admin on `app.<platform
domain>`; each site at `<name>.<sites domain>` on a separate registrable domain;
images at `media.<sites domain>`; own domains looked up in `site_domains`. One
wildcard certificate covers every site subdomain, issued by DNS challenge
through Caddy's Cloudflare DNS module. Own domains (item 21) use Caddy's
on-demand certificates, approved by the app. Replaces D22 when item 16 is
built.
Beats:
- sites as subdomains of the platform domain: one phishing page can get the
  whole registrable domain blocklisted, sign-in included, and sibling
  subdomains are "same-site" to the SameSite cookie;
- a certificate per subdomain: Let's Encrypt's weekly limit per registered
  domain, and every site name published in certificate transparency logs.
Costs:
- a second domain to buy;
- Caddy rebuilt with a DNS module, and an API token on the server;
- one global option in the main Caddyfile, which the repository does not own,
  at item 21.

## D154 - AI site generation runs in the process, recorded in the database (2026-10-01)

**Chose:**
- The action records an `ai_runs` row, starts the generation without waiting
  for it, and redirects to a page that polls the row.
- At most two runs at once.
- A 5-minute timeout.
- A run left `running` by a restart is marked failed at startup.
- A run writes only its own row; applying its proposal is one transaction.
Beats:
- generating inside the request, streamed to the page: a dropped mobile
  connection loses a run that was already paid for;
- a job queue or a worker process: D4, the memory budget, and nothing else
  needs one.
Costs: an interrupted run is lost, not resumed; the user retries, and a
failed run costs no credits.

## D155 - AI from Anthropic, then OpenAI, then OpenRouter (2026-10-01)

**Chose:**
- **The order:** Claude through Anthropic's official SDK first, then OpenAI
  through its official SDK, then OpenRouter through the `openai` SDK at its own
  address - two packages, neither with dependencies of its own beyond
  Anthropic's two.
- **When a run moves on:** only when a provider is unavailable - rate limited,
  overloaded, a server error, a dropped connection, a timeout.
- **When it does not:**
  - never on a refusal: a description one provider declines is not shopped
    to another; Anthropic's own server-side fallback handles Claude's
    refusals;
  - never on a 400 or 401, which mean our bug or a broken key.
- **One output shape:** every provider fills the same constrained schema, and
  our Zod schema checks it.
- **OpenRouter settings:** endpoints must support the schema, and none may
  store or train on the data.
- **Models are configuration,** chosen by item 18's measurement - Claude Opus
  5.5 at US$4 / US$20 per million tokens against Sonnet 5.5 at US$2 / US$10, as
  listed 2026-09-25.
Beats:
- a single provider: its outage stops every signup's first two minutes;
- Google Gemini as a fallback: its SDK brings four packages, including an auth
  library and protobufjs;
- OpenRouter alone as the fallback: one account fewer, but the owner chose a
  direct OpenAI tier too.
Costs:
- three accounts, keys and spend limits;
- a prompt tested on every configured model;
- a privacy policy that names all three providers and OpenRouter's upstreams.

**Amended by D372** (2026-10-07, item 18b1): OpenRouter is first, by default,
in a configured order (`AI_PROVIDERS`); Anthropic and OpenAI direct become
optional fallbacks (18b2). Credits come from the cost OpenRouter reports. The
rules on when a run moves on are unchanged.

## D156 - Email over SMTP with nodemailer; Resend for the hosted platform (2026-10-01)

**Chose:** one email module sending over SMTP through `nodemailer` (no
dependencies of its own). The hosted platform uses Resend: free for 3,000
emails a month and 100 a day, whichever runs out first; US$20 for 50,000 with
no daily cap (comparison sites, 2026; check before relying on them). It moves
to Resend Pro or Postmark once the daily cap is hit or verification emails
land in spam.
Beats:
- a provider's HTTP API: ties every self-hosted copy to that provider;
- Postmark: US$15 for 10,000 with a strong transactional record, but only 100
  free emails a month, for testing - the runner-up, and a configuration change
  away;
- Amazon SES: US$0.10 per 1,000, but its free tier lasts 12 months, it needs
  approval to leave its sandbox, and bounce handling would be ours to build;
- SMTP2GO: free for 1,000 a month and 200 a day - a higher daily cap, a lower
  monthly one;
- Cloudflare's email sending: in public beta.
Costs: SPF, DKIM and DMARC records for the sending domain; a dependency for a
protocol nobody should write by hand.

## D157 - Contact-form spam stopped without a third party (2026-10-01)

**Chose:** a hidden honeypot field, a minimum time to fill the form, and a
per-IP limit per site. It works without JavaScript.
Beats: Cloudflare Turnstile or reCAPTCHA - JavaScript on public pages, a third
party seeing every visitor, and a cookie banner question.
Costs: a determined spammer gets through. A captcha comes only if one does.

## D158 - Operator work is server commands in v1 (2026-10-01)

**Chose:** `create-invite`, `suspend-site` / `unsuspend-site` and
`delete-site`, run on the server like `create-admin`. No operator screens.
Beats: an operator admin area - screens, a role and an attack surface, for
tasks the owner runs a few times a month in a beta.
Costs: the owner needs SSH access to act on abuse; screens come when the
commands are run often enough to hurt.

## D159 - Users are global; roles live on a site membership (2026-10-01)

**Chose:** `users` holds the person; `site_members` holds the role and the
deactivation per site. In v1 each user belongs to one site, and an email
already in use is refused when a member is added.
Beats: users per site - Level 2's several sites per account would need users
re-keyed.
Costs: a site admin's "reset password" for a member must become email-only
once a user can belong to several sites, or one site's admin could take over
an account used elsewhere.

## D160 - Stripe through its official SDK and hosted pages; webhooks set the plan (2026-10-01)

**Chose:**
- the `stripe` SDK (no dependencies of its own);
- Stripe Checkout and the Customer Portal, so card details never reach the
  server;
- webhooks as the only thing that changes a site's plan, each event processed
  once, keyed by its id.
Beats: plain `fetch`, which would mean hand-writing the webhook signature check
(security-critical: timing-safe comparison, timestamp tolerance) and nested
form encoding, to save one dependency-free package.
Costs: 17 MB of package on disk, mostly types, on the server only.

## D161 - The email link verifies and signs in; nothing works before it (2026-10-01)

**Chose:** signup creates the account and the site unverified; the emailed link
verifies the address, signs the user in and starts onboarding.
Beats: signing in first and verifying later - AI spend would be open to
throwaway addresses, and every feature would need an "unverified" state.
Costs: an email round trip inside the first two minutes, and signup depends on
the email provider being up.

## D162 - Today's installation becomes site 1 (2026-10-01)

**Chose:** the tenancy migration creates site 1 from the current
`site_settings`, makes today's users its members with their roles, and gives it
`surenmaharjan.fyi` as its own domain. Its content is still discarded at item
14 (D148).
Beats: a fresh production start - it would lose the owner's accounts and domain
for nothing.
Costs: the migration has to carry real rows, so it is rehearsed on a restored
production backup (D163).

## D163 - Production holds on 8d82ce4 until platform v1 is done (2026-10-01)

**Chose:** items 13-21 are built and merged one by one but not deployed. v1
ships in one deploy, its migrations rehearsed first on a restored copy of the
latest production backup. Rollback is restoring the pre-deploy dump and
pointing `current` back at `8d82ce4`. An urgent fix in the meantime ships from
a branch off `8d82ce4`, not from `main`.
Beats: deploying item by item - item 14 would wipe the live content, and
between items 15 and 16 signup would create sites with no public address.
Costs: one large release, and nothing new reaches production for a long time.

## D164 - AI use is a monthly credit allowance per site (2026-10-01)

**Chose:**
- **The unit:** each plan gives a site an allowance of credits per calendar
  month; 1 credit = US$0.001 of provider cost.
- **Metering:** each run's credits come from its reported tokens (input,
  cached input, output) and the configured price of the model that ran.
- **Starting a run:** a run starts only while some allowance is left, so the
  last run can pass it by at most one run (each run's output is capped).
- **Failures** cost no credits.
- **Screens** show a percentage, never tokens or credits.
- **Level 2's editor AI** will draw from the same allowance.
Beats:
- a count of site generations (D150's starting point): it cannot cover later
  AI features, and it prices a cheap run and an expensive one the same;
- an allowance in raw tokens: output tokens cost 5 times input on Claude,
  cached input a tenth, and models and fallbacks differ, so the same number of
  tokens would cap very different amounts of money.
Costs: a price table per model in configuration, kept current by the owner;
an allowance is an estimate until item 18 measures real runs.

## D165 - Mailchimp-style editing in v1, Elementor-style layout in Level 2 (2026-10-01)

**Chose:** item 14's editor is structured drag and drop for pages and posts:
drag blocks from a palette into any section or column, where they drop between
other blocks; Move up / Move down stay as the non-drag alternative (WCAG
2.5.7). Ready-made sections carry over, mobile stacks automatically, TipTap
edits the text. Content is stored as containers - a section holds columns, a
column holds blocks - so Level 2 can reveal Elementor-style layout (nested
containers, row or column direction, widths per device; absolute placement
considered then) without a migration. Reached during `prototype`, after
comparing Mailchimp's and Elementor's builders.
Supersedes: D115's "posts stay flat", when item 14 is built; plan section 11's
"section palette" deferral (it is in v1). D113's rejection of a free-form
canvas stands.
Beats:
- a pixel-exact canvas (Wix): no reflow between phone and desktop, a second
  layout to arrange by hand, and text enlarged to 200% spills out of fixed
  boxes (WCAG 1.4.4, 1.4.12);
- a grid-snap canvas (Squarespace Fluid Engine), mocked in
  `prototypes/editor.html`: a new stored format and reading-order work for a
  freedom Level 1 users do not need;
- Elementor-style layout in v1: too many settings for Level 1, against "simple
  by default";
- Mailchimp-style with no Level 2 path: a later layout model would need a
  migration of customers' content.
Costs: item 14 grows - the palette, drag between sections and columns, posts
with sections, the container format - and splits when spec'd. `editor.html`
is re-mocked. `architect` decides the container format before item 14.

The container format is decided in **D169**, and ready-made sections become
templates in **D170** (2026-10-02).

## D166 - Editing levels: Simple, Pro and Developer, in one editor (2026-10-02)

**Chose:** D148's three levels become a level a site switches between inside
the product, named **Simple** (Level 1, the default), **Pro** (Level 2's
tools) and **Developer** (Level 3). One editor and one stored format; the
level only reveals controls. In v1, Pro adds Users, the advanced settings and
the H5-H6 text styles - item 20's switch becomes this. Pro grows at Level 2
with D165's Elementor-style layout, section styling and the team features;
Developer arrives with Level 3. Simple's text styles are named, not numbered:
Main heading, Heading, Subheading, Small heading (H1-H4). The person chooses
the main heading - one per page, rendered as its `h1`; a hero's heading starts
as it; a page with none shows its title as the `h1` (owner, at the mockup
review, 2026-10-02; the first draft said `h1` is never inside content).
Switching down never breaks a page: content made at a higher level keeps
rendering, its higher-level settings lock, and its text stays editable. Reached during `prototype`, after comparing Webflow, Wix, Duda,
WordPress, Elementor and Shopify (`blueprint/reference/page-builders-2026-10-02.md`).
Supersedes: item 20's single on/off "advanced switch" (plan sections 3 and 6).
Beats:
- roles deciding what someone sees (Webflow's Content Editor, Marketer and
  Designer): v1 has one person per site (D159), so there is nobody to split
  between;
- two separate products (Wix Editor and Wix Studio): two editors to build and
  keep in step;
- everything shown at once: against "simple by default";
- skill labels such as "amateur": they name the person, not the mode.
Costs: every editor control carries a level, and the browser tests cover Simple
and Pro. Pro also turns on dark mode for the public site (D168). `architect`
decides where the level is stored (on the site, as item 20 planned, or per
member) and the exact lock rule, with item 14's format.

Where the level is stored, and the lock rule: **D172** (2026-10-02).

## D167 - Branding at onboarding: a logo, a brand colour and three style presets (2026-10-02)

**Chose:** onboarding gains an optional third step after "Tell us about it",
"Make it yours":
- **a logo** - JPEG, PNG, WebP or GIF, or **SVG turned into a PNG in the
  browser** (about 1200px wide) before upload, so the server's type allowlist
  is unchanged and no SVG is ever stored (D7);
- **a brand colour**, taken from the logo's pixels in the browser; with no
  logo, item 18's AI run suggests one from the description; a colour picker
  always overrides;
- **a style preset** - three, names provisional (Classic, Modern, Friendly),
  each a font pair and a corner shape.
No logo gives a wordmark: the site name in the preset's font and the brand
colour. Our own function derives the shades the site uses - button text, links
on light and on dark - each meeting WCAG 2.2 AA, so a user's choice never
lowers the bar. Settings gains the brand colour and the style, beside the logo
it already has. AI suggests, the user applies.
Supersedes: plan section 11's "multiple themes and theme customisation",
narrowed - one theme with a brand colour and three presets is in v1; more
themes, styling per element and custom CSS stay out.
Beats:
- AI-generated logo images: Anthropic's models do not make images, OpenAI is a
  fallback only (D155), each image costs money, text inside generated images
  is often garbled, and a generated mark can resemble someone's trademark -
  possibly a paid extra later;
- AI reading the logo image: credits spent on what counting pixels does
  exactly;
- a colour picker only: more work for a beginner;
- storing SVG behind a sanitiser (Ghost, WordPress's Safe SVG): sanitisers are
  bypassed repeatedly (svg-sanitizer, DOMPurify CVE-2024-47875 and
  CVE-2026-41238, October CMS), a security dependency to patch forever;
- no style choice (recommended): the owner chose three presets.
Costs: three self-hosted font pairs, whose licences must allow self-hosting;
contrast checked per preset, light and dark; a `site_settings` migration; the
public pages' Content-Security-Policy is `style-src 'self'`, so the colour
reaches them through a per-site stylesheet or a nonce - `architect` decides; a
logo counts toward the site's storage cap (D150); an SVG that loads outside
fonts or images renders without them, which the preview shows before saving;
item 18 splits.

The colour reaches the public pages as a nonce'd inline `<style>`: **D171**
(2026-10-02).

## D168 - Public sites are light only in Simple; Pro turns dark mode on (2026-10-02)

**Chose:** a customer's public site is light, whatever the visitor's device
prefers, unless the site is Pro and its owner turns dark mode on - then it
follows the device as items 1-12's site does today (`data-dark="auto"`,
`design.md`). Habre's own screens still follow the device; the editor's canvas
shows the site light even inside dark Habre. Owner, at the mockup review
(2026-10-02).
Supersedes: plan sections 3 and 7, "light and dark mode ... public site
both", for customer sites. This changes shipped behaviour: items 1-12's public
site follows the device. The re-theme build item carries it out.
Beats:
- following the device (today): the site a visitor sees can differ from the
  one its owner built and checked, and a dark logo disappears on a dark page;
- a light / dark / auto choice in Simple: one more setting, against "simple by
  default".
Costs: the dark-mode switch is stored per site - `architect` decides where,
with the editing level (D166); the browser tests cover a Simple site under a
dark device; a Pro site with dark mode on can still show a dark logo on a
dark page.

Where the switch is stored: **D172** (2026-10-02).

## D169 - Item 14 stores one TipTap document per entry, sections and columns as nodes (2026-10-02)

**Chose:** from item 14 an entry - page or post - is one TipTap (ProseMirror)
JSON document, `blocks_format` `v4`: `doc -> section (1-30) -> column (1-3)
-> block`. Blocks are paragraph, heading (levels 1-6), bullet and numbered
lists, quote, image (media id), button (label, allowlisted link), line, space
and, from item 19, contact form; marks are bold, italic and an allowlisted
link. A section has `align` (top | middle) and `background` (none | band); a
column has no attributes in v1. Sections and columns are `isolating` nodes, so
typing and deleting never cross or merge them. One editor and one undo
history per page. Our own Zod schema validates the whole tree on save and our
own renderer draws each node as its semantic element - a button block is a
link (`coding-standards.md`); TipTap's HTML is never stored (D28-D30). At most
one level-1 heading, on pages only; a post's Title field is always its visible
`h1` - the browser-tab and search title can differ (D110, item 17) (D166).
Level 2 widens the schema - attributes with defaults, a column that may hold a
section - so every v1 document stays valid without a migration (D165).
Supersedes: D114's one Editor.js per column, at item 14; plan section 6's "a
column, and a post, holds one TipTap document".
Beats:
- one TipTap per column: moving a block between columns spans two editors and
  two undo histories, so one move is two undo steps in two places (D123
  measured that 90 editors mount fast enough, so speed is not the reason);
- our own block list with a TipTap per block: rebuilds splitting and merging
  blocks, paste, and arrow keys between blocks, which ProseMirror already does
  inside one document.
Costs: the page's structure sits inside the editable area, so section chips,
block toolbars and drop gaps are drawn outside it and kept in place by our
code; the stored shape is ProseMirror's JSON, which a Level 3 API would
expose; D116's caps (30 sections, 200 blocks) bound one document.

## D170 - Ready-made sections become templates of ordinary blocks (2026-10-02)

**Chose:** from item 14c, the palette's sections insert an ordinary section of
ordinary blocks, as `prototypes/editor.html` draws them:
- **Hero** - two columns, middle-aligned: a heading (the main heading when the
  page has none), text and a button, then an image;
- **Image and text** - two columns: an image, then a heading and text;
- **Call to action** - one column on a band background: a heading, text and a
  button;
- **Blank section** - one empty column.
Simple's Section settings show Columns only; `align` and `background` are set
by templates, and Pro may reveal them. Item 18's AI output keeps its shape -
section kinds with plain-text slots - and the server expands each kind with
the same templates. A button with no label or link is not rendered publicly;
an image block with no media shows a placeholder in the editor only.
Supersedes: D125's section types, at item 14c.
Beats: keeping fixed-slot section types (D125) - a hero could not take a
dragged block, there would be two kinds of section to build, test and render,
and the approved mockup draws the hero as ordinary blocks.
Costs: items 12a-12c's section code is replaced, not carried over; 12b's
required button fields and 12c's missing-image message become rules on button
and image blocks wherever they sit.

## D171 - A site's brand colour reaches its pages as a nonce'd inline `<style>` (2026-10-02)

**Chose:** each public page's `<head>` carries a `<style>` with the response's
nonce, holding only custom properties, derived at render from
`site_settings.brand_color` (parsed as exactly `#rrggbb`) and `style_preset`
(an enum). The public pages' `style-src` becomes `'self' 'nonce-…'`, using the
per-response nonce F-100 already generates. Only the inputs are stored; the
shades are derived on each render (D167), so improving the derivation needs no
migration.
Beats:
- a per-site stylesheet route: an extra request, a cache to clear when the
  colour changes, and one more route on every site host;
- `style` attributes: they need `'unsafe-inline'`.
Costs: the public policy admits nonce'd styles; a value reaching CSS
unvalidated would be CSS injection, so the colour is parsed, never passed
through; plan section 8's Content-Security-Policy line changes with item 18a.

## D172 - The editing level and dark mode are stored per site, in `site_settings` (2026-10-02)

**Chose:** `site_settings.level` (simple | pro, default simple) replaces item
20's `advanced_enabled`; `dark_mode` (default off) applies only while the site
is Pro, so switching to Simple makes the public site light again without
losing the choice (D168). Item 18a adds `brand_color` (empty for the neutral
ink look) and `style_preset` (classic | modern | friendly, default modern)
beside them. **Lock rule:** in Simple, a control whose current value is
Pro-only - an H5 heading's text style, say - shows it read-only with "Switch
to Pro to change"; the text stays editable and the block can still be moved or
deleted (D166).
Beats:
- per member: one person per site in v1 (D159), and D166 rejected roles
  deciding what someone sees; a per-member override can be added at Level 2;
- on `sites`: that row is the platform's - plan, address, suspension - while
  these are the site admin's, under row-level security.
Costs: the columns arrive with the items that use them (18a, 20); item 21's
paid plan cannot be called "Pro", or a free mode reads as a paid one.

## D173 - Basic SEO adds one main address, no indexing before publishing, and a site language (2026-10-02)

**Chose:** item 17 also covers three gaps found reviewing SEO:
- **one main address per site** - its verified own domain when it has one,
  otherwise its subdomain; every other host of the site answers a 301 to the
  same path there, and every public page carries `<link rel="canonical">`;
- **nothing indexed until a site publishes** - the "being set up" placeholder
  sends `noindex`, `sitemap.xml` lists only published entries, and the
  platform host's `robots.txt` disallows everything;
- **the site's language** - `site_settings.language`, default `en`, in Settings
  and on `<html lang>`, which is hard-coded to `en` today (`app/root.tsx`).
Owner, 2026-10-02.
Beats:
- serving a site on both its subdomain and its own domain (plan section 6 until
  now): search engines see two copies and split the ranking between them;
- a canonical link alone, without the redirect: visitors and links keep using
  both addresses.
Costs: item 17 grows; a site's subdomain stops serving pages once its own
domain is verified, so links to the subdomain rely on the redirect; the admin
stays in English whatever the site's language.

## D174 - Images are resized on the server with `sharp` (2026-10-02)

**Chose:** from item 17b, the server turns each upload into WebP at 480, 960,
1600 and 2400 px wide (never wider than the original) and a 1200 px JPEG for
the social image, with `sharp` (libvips): rotated by the camera's orientation,
converted to sRGB, camera details dropped - including location, which today's
uploads can keep. The upload itself is not kept; animated GIFs are stored as they
are. One resize at a time. Pages pick the size they show with `srcset` and
`sizes` from the column count; the first image loads at once with
`fetchpriority="high"`. Objects get a one-year immutable cache header. A server
command, `optimise-media` (D158), resizes media uploaded before 17b. AVIF waits
for a bigger server, made by the same command. The owner said the server can
be upgraded as usage grows (2026-10-02), which is what makes server-side work
acceptable.
Supersedes: the quality bar's "no resizing in v1".
Beats:
- resizing in the browser (proposed first): lower quality, no certainty that
  Safari encodes WebP from a canvas, the server storing files a browser made,
  and nothing for media already uploaded or a later API;
- Cloudflare's image transformations: the least code and AVIF, but charged
  beyond a free monthly allowance, tied to the media custom domain, and a
  self-hosted copy without Cloudflare gets nothing (D148);
- no resizing (until now): a phone downloads a 10 MB photo shown 400 px wide.
Costs: `sharp` is a native runtime dependency - `node_modules` is installed on
the dev machine and copied, so the server's CPU type must match (`uname -m`
before installing), and an ARM server means installing for ARM; an upload
waits a few seconds; resizing is CPU and memory on the one server; storage
counts every size (D150); about five objects per image instead of one.

## D175 - Levels are how someone uses Habre; tiers are what a site pays for (2026-10-02)

**Chose:** a site's level (Simple, Pro, Developer - D166) is never tied to
money: every site can switch to any level on any tier. Tiers are packages of
limits and services, the way WordPress.com sells its plans - AI and storage
allowances, an own domain, removing the footer link, more members, several
sites, enterprise needs. A tier may limit how much a site uses, never which
level it can use, and **Free always has limits, at every level**. No tier is
named after a level. Intended tiers (owner's table): Free $0, Launch $19 a
month, Growth $59, Scale $179, Enterprise custom. v1 sells Free and Launch -
Launch is item 21's one paid plan; Growth and Scale arrive with the members and
sites they sell; Enterprise on demand. **Prices are provisional:** set at item
21, and revised as measured resource use shows what each tier costs to serve.
Owner, 2026-10-02.
Supersedes: plan section 9's intended tiers - Personal, Business and "Pro /
Developer", which sold API, webhooks and content models - and workflows as
something a tier sells.
Beats: selling levels as tiers, Pro or Developer as a paid plan - the owner
rejected it: a level is how someone wants to use the CMS, not what they pay.
Costs: Developer features cost the hosted service to run on every tier, so
tiers cap their use instead; tier names avoid the level names, including
section 2's audience labels (Personal, Professional); Growth's and Scale's
prices wait for features v1 does not have; a yearly price is item 21's.
**Currency** (owner, 2026-10-02): the customer's own, with each price set by
hand per currency - AUD with GST included for Australia, USD for everyone else
to start, EUR or GBP once selling there is worth the VAT registration - rather
than Stripe converting automatically, which gives odd amounts, charges the
customer a conversion fee and may not be offered to Australian accounts. Tax
follows the customer's country whatever the currency (D149).

## D176 - Migrations are forward only; a migration is reversed by restoring the backup taken before it (2026-10-02)

**Chose:** no down migrations. A migration that must be undone is undone by
restoring the database backup taken immediately before it ran (F-19).
Beats: down paths, which nobody runs until the day they matter and so are
never proven.
Costs: every migration needs a fresh backup taken first, and a restore loses
anything written after it. Item 14a's destructive migration is the first to
rely on this, with its own yes.

## D177 - A malformed stored menu reads as empty and logs an error (2026-10-02)

**Chose:** `parseStoredNavigation` parses `site_settings.navigation` with
`navigationSchema`; a value that fails reads as an empty menu and logs one
error naming the column (F-96), matching D61's "degrade silently" for this
table.
Beats: failing loudly as `blocks_format` does, which would 500 the one screen
that can repair it.
Costs: a corrupted menu disappears from the public site until someone saves
Settings again; only the log says why.

## D178 - A settings save without `homePageId` is refused, not half-applied (2026-10-02)

**Chose:** a Settings POST with no `homePageId` field answers 400 with "This
form is out of date. Reload the page and try again." and changes nothing
(F-107).
Beats: leaving the home page unchanged, which needs a third state in the
update and hides a stale form instead of telling the person.
Costs: a stale tab loses its unsaved edits on reload. F-138 notes the field
can still be cleared one save later.

## D179 - Settings bodies are capped at 16 KB (2026-10-02)

**Chose:** the Settings action checks `Content-Length` against 16 KB before
reading the body and answers 413 above it, or when the length is missing or
not a number (F-117). 20 menu rows and a title are well under it.
Beats: reading an unbounded body into memory on a 954 MB server.
Costs: menus with long non-Latin labels can approach the cap (F-139).

## D180 - The posts and pages lists build every return URL from their parsed query (2026-10-02)

**Chose:** one `entryListHref` / `entryListSearch` in `entry-list-query.ts`
builds the list URL from the parsed query - `status`, `q`, `page` only,
defaults omitted - for Cancel, the redirect after delete and the
past-the-last-page redirect. The "deleted" banner rides through the clamp,
read by `readBanner` and rebuilt by `bannerRedirect` (F-56, F-61, F-136).
Beats: echoing the incoming query string into a redirect, which lets
arbitrary values reach the URL.
Costs: a new list filter must be added to the parser and the builder, or a
delete drops it.

## D181 - Colour roles are `light-dark()` pairs switched by `color-scheme` (2026-10-02)

**Chose:** each role in `app/app.css` is one `light-dark(<light>, <dark>)`
declaration; `:root` sets `color-scheme: light dark`, the public site scope
sets `light`, and item 20 turns a site dark by setting `light dark` (item 13b).
Beats: porting `theme.css`'s duplicated `@media` and `[data-theme]` blocks;
the `data-theme` toggle was mockup-only.
Costs: the production build polyfills `light-dark()`, so a `color-scheme`
set outside the bundled CSS (an inline `<style>`, JavaScript) does not switch
roles there (F-149) - items 18a and 20 must prove theirs on the built app.

## D182 - The app keeps its own spacing and type scales (2026-10-02)

**Chose:** `--space-1..8` and `--text-*` stay as they were; only the names
`design.md` lists were renamed, plus `--control-height` -> `--size-control-md`
and `--measure` -> `--size-measure`, whose values the redesign changes.
`--font-mono` and `--duration-fast` keep their names beside the kit's
`--motion-*` tokens (item 13b).
Beats: adopting the kit's whole token set - its `--space-5` is 1.25rem, ours
1.5rem, so the same name would silently change every gap.
Costs: kit CSS cannot be pasted in; its spacing and type tokens are
translated by value.

## D183 - The public site scope sits on `<html>`, chosen by path (2026-10-02)

**Chose:** the root `Layout` puts `data-surface="site"` on `<html>` for every
path `areaForPath` calls public - the rule the Content-Security-Policy uses -
read with `useLocation()`, so the 404 and error pages are in it too (item 13b).
Beats: a wrapper `div` in the public layout, which leaves the body and
scrollbars dark and misses the root error boundary.
Costs: an admin screen reached by a path `areaForPath` reads differently
from the router would be styled as public (F-151, unverified).

## D184 - Fonts are bundled through CSS from `app/fonts/` (2026-10-02)

**Chose:** Inter Variable (latin, 48 KB woff2) and its OFL licence live in
`app/fonts/` and are loaded by an `@font-face` in `app.css`, so Vite hashes
the file into `/assets/`, served `immutable` (item 13b).
Beats: `public/fonts/`, cached for an hour under a fixed name.
Costs: a preset's fonts (item 18a) are bundled the same way, in every build.

## D185 - Colour contrast is proved by a browser test on the real app (2026-10-02)

**Chose:** `e2e/contrast.spec.ts` resolves every role in the served app and
asserts the design record's pairs at 4.5 or 3, in Habre light and dark, the
site scope light and with the device dark; it runs in CI (item 13b).
Beats: keeping `prototypes/checks/contrast.mjs`, which measures the mockups,
not the shipped CSS.
Costs: a new colour role or scope needs its pairs added there (item 14a adds
the selection pairs).

## D186 - A table wider than a phone scrolls inside its card (2026-10-02)

**Chose:** the posts, pages and users tables sit in a positioned
`overflow-x: auto` card, the kit's `.table-wrap`, so every column stays
reachable and visually hidden cell text cannot widen the page (item 13b).
Beats: hiding columns on a phone, which drops Delete.
Costs: on a phone the last columns are reached by scrolling the table.

## D187 - The narrow admin shell keeps its pre-13b arrangement (2026-10-02)

**Chose:** below 48rem the site card and account share a row and the nav is
a wrapping row beneath them; the rules target the `<nav>` element, which they
had silently missed by targeting its list (item 13b). No Menu button until
the new shell (items 15-19).
Beats: restyling the broken arrangement as found.
Costs: a phone shows the whole nav above every admin page.

## D188 - Buttons in a form keep their own width (2026-10-02)

**Chose:** a button in the settings or user form grid is
`justify-self: start`; only fields run full width, as in the kit's forms
(item 13b). The login button stays full width, as the sign-up layout has it.
Beats: every button stretching to the form's width.
Costs: none known.

## D189 - The kit's quote, rule and spacer wait for item 14 (2026-10-02)

**Chose:** only `.display` and `.lede` were ported, as the hero's heading and
text; no block renders a quote, line or space until item 14's editor (item
13b).
Beats: styling elements nothing emits.
Costs: item 14 ports them with its renderer.

## D190 - The current admin nav entry is marked by weight and a bar, not colour alone (2026-10-02)

**Chose:** `[aria-current="page"]` in the admin nav is semibold with a 3px
`--color-primary` bar on its start edge, besides the kit's rust on its subtle
fill (F-143, WCAG 1.4.1).
Beats: the kit's colour-only mark - rust and the muted grey are ~1.03:1
apart in dark mode.
Costs: one deliberate difference from the kit's `.nav__link`, recorded in
`design.md`.

## D191 - The editor canvas matches the published content width (2026-10-02)

**Chose:** for a v4 entry the editor canvas gives the document the same width
the public page does, so the 40rem container query stacks or places columns
in the editor exactly as it will publish (owner, item 14a1).
Beats: keeping the 42rem form (columns always stacked in the editor), and
widening both to the prototype's 64rem (changes the public reading width too).
Costs: the entry form is wider than the other admin forms.

## D192 - Existing pages and posts are deleted, not converted (2026-10-02)

**Chose:** migration `0009` deletes every entry and resets the menu; the check
becomes `blocks_format = 'v4'` (owner: "this is a rebuild", item 14a1).
Beats: keeping rows with emptied bodies (addresses nobody needs, pages that
show only a title), and converting v2/v3 (D169 chose discard).
Costs: the site starts empty at the v1 deploy; no release before 14a1 can read
the database afterwards, so rollback by symlink is impossible.

## D193 - Lists are flat in v1 (2026-10-02)

**Chose:** a list item holds one paragraph; Tab does not nest; a nested list
is refused by `parseDocument` (item 14a1).
Beats: nesting - items 1-12 had none.
Costs: nesting is a Level 2 widening of the schema (D165), with no migration.

## D194 - The stored document is the schema's output (2026-10-02)

**Chose:** `parseDocument` stores what the Zod schema returns: keys and attrs
outside the contract (`orderedList.start`, `link.target` / `rel` / `class`)
are dropped; a node or mark outside it is refused. A text node keeps one mark
of each kind, the first (the renderer reads the first link), and an empty
`content` or `marks` is stored as absent (F-155, F-162; item 14a1).
Beats: storing the submitted JSON once validated (F-50) - a shape the editor's
content check can refuse, locking the entry.
Costs: mark order and adjacent same-mark text nodes are still stored as sent;
ProseMirror normalises both on load.

## D195 - No hard breaks and no node ids in v1 (2026-10-02)

**Chose:** Shift+Enter starts a new paragraph; ProseMirror addresses nodes by
position (item 14a1).
Beats: D117's section ids, which existed for one editor per column.
Costs: a later feature needing a stable block address adds ids to the schema.

## D196 - Removing a section is immediate and undoable (2026-10-02)

**Chose:** Remove section acts at once as one transaction, and Ctrl+Z restores
it; the control is absent when one section is left (item 14a1). Supersedes
D118's inline question, which existed because there was no undo. D118's "an
empty section renders nothing publicly" holds.
Beats: asking first.
Costs: none known - undo covers it.

## D197 - TipTap pinned at exactly 3.31.4, with `injectCSS: false` (2026-10-02)

**Chose:** `@tiptap/core`, `pm`, `react`, `starter-kit` and `extensions` at
3.31.4 exactly; TipTap's few required rules live in our stylesheet (item
14a1).
Beats: a caret range (the document format is ours to lock), and TipTap's
injected `<style>`, which would keep the admin on `'unsafe-inline'`.
Costs: five runtime packages replace Editor.js's three; upgrades are deliberate.

## D198 - An editor that cannot read its document refuses to save (2026-10-02)

**Chose:** the editor runs TipTap's content check; when a stored document
fails it, the form refuses Save rather than overwriting the row with an empty
document (F-154, item 14a1).
Beats: opening empty and letting Save destroy the content.
Costs: the editor still opens empty and editable, and the refusal comes only
at Save (F-163, open).

## D199 - A save over 1 MB is refused in the browser and by the action (2026-10-02)

**Chose:** the browser checks the body size before submitting and shows "This
is too long to save. Remove some text and save again." without submitting; the
action answers an oversized body with the same banner (`data(..., 413)`), not a
thrown error, so the editor stays mounted and the draft is kept (F-39, item
14a1).
Beats: a thrown error that unmounts the editor and loses the text.
Costs: none known - browser and action share one check, `entry-body-size.ts`.

## D200 - No image caption in v1 (2026-10-03)

**Chose:** an image renders as a plain `img` named by its media's alt text, no
`figure` / `figcaption` (item 14a2; closes F-79).
Beats: items 1-12's alt-text-as-caption (read twice by a screen reader), and a
caption attr (a second text field per image, which D55 rejected).
Costs: no visible captions until Level 2 adds an attr with a default - no
migration needed.

## D201 - The Space block has one height and no attrs (2026-10-03)

**Chose:** `space` is a fixed-height spacer with no settings (item 14a2).
Beats: sizes - the settings panel exists only for blocks that have settings,
and a Simple user stacks two spaces for more room.
Costs: no size control until Level 2 adds one with a default.

## D202 - A button's page target is stored as `href` `/<slug>` (2026-10-03)

**Chose:** a button pointing at a page stores `/<slug>`, like a link in text
(item 14a2).
Beats: storing a page id as the menu does - one link shape for every block
keeps the renderer and the allowlist single.
Costs: changing a page's address breaks buttons pointing at it, as text links
today; item 17's redirects are where that gets fixed.

## D203 - Button style is filled or outline, filled by default (2026-10-03)

**Chose:** `style: "filled" | "outline"`, stored as `filled` when absent, in
the v4 contract now (item 14a2).
Beats: adding it later - templates (14c) and the AI draft (18b) can set it.
Costs: none known; both variants use already-measured contrast pairs.

## D204 - The palette inserts after the selected block, in its column (2026-10-03)

**Chose:** a palette tile adds its block after the selected block or the block
holding the cursor - the column's direct child - in the same column; an editor
never focused adds after its first block (item 14a2).
Beats: "at the end of the page", which lands out of sight on a long page.
Costs: none known.

## D205 - Columns move from the section chip to Section settings (2026-10-03)

**Chose:** the Columns control lives in the settings panel, opened by the
chip's "Section settings" button; the chip keeps its label and Remove section
until 14a3 (item 14a2, design.md *Section controls*).
Beats: keeping it on the chip, which the design moves off.
Costs: one more press to change columns.

## D206 - One media picker module, shared by the logo and the image block (2026-10-03)

**Chose:** `app/features/media/media-picker-dialog.client.ts`, titled by its
caller and returning `PickedMedia` (item 14a2).
Beats: a second copy for the image block - the duplication F-104 removed once.
Costs: none known.

## D207 - Move crosses columns and sections in reading order (2026-10-03)

**Chose:** Move down from a column's last block goes to the top of the next
column, then the next section; Move up mirrors it (item 14a3).
Beats: stopping at the column's edge - Move is dragging's single-pointer
alternative (WCAG 2.5.7), so it must reach every place a drag can.
Costs: a block crosses into a neighbouring column with one press, which a user
may not expect; the announcement names the new column.

## D208 - A column never empties (2026-10-03)

**Chose:** removing a column's last block leaves an empty paragraph, and a
block arriving in an untouched column replaces it; an untouched column of a
two- or three-column section shows "Empty column - add a block or change
Columns in Section settings." in the editor only (item 14a3).
Beats: removing the column (changes the layout behind the user's back) and
refusing the move (a block could never leave a one-block column).
Costs: blank columns can be published; the hint is the only cue.

## D209 - One main heading, kept by the editor, by node identity (2026-10-03)

**Chose:** an `appendTransaction` guard demotes a second level-1 heading from a
paste or `# ` to level 2, keeping the heading that is the same node object as
one in the old document; with none, the first in reading order. The Text style
menu's Main heading demotes the old one itself, announced (item 14a3).
Beats: leaving it to `parseDocument`, which refuses only at Save; and "first
in reading order" alone, which lets a paste above displace the main heading.
Costs: one transaction that both changes the old main heading and adds
another falls back to reading order.

## D210 - A list's toolbar has Bulleted / Numbered; a quote's has no style (2026-10-03)

**Chose:** lists switch type from their toolbar; quotes have no style control
(item 14a3).
Beats: dropping them with the format bar (numbered lists unreachable but by
typing `1. `) and putting lists in the Text style menu (not a text style;
multi-paragraph quotes would convert ambiguously).
Costs: no control converts text to a list or quote, or back (F-191).

## D211 - Undo and Redo in the editor's top bar at every width (2026-10-03)

**Chose:** Undo / Redo always visible in the top bar (item 14a3).
Beats: the mockup's desktop-only buttons - a phone has no keyboard undo.
Costs: two more buttons in a crowded phone top bar (it wraps).

## D212 - The block toolbar is one tab stop with arrow keys (2026-10-03)

**Chose:** the ARIA toolbar pattern - one tab stop, arrows, Home and End move
within, Escape returns to the writing area with the selection kept; the
remembered stop resets to Move up when focus leaves or the block changes
(item 14a3, F-183).
Beats: a tab stop per button, the format bar's way - eight more Tab presses on
every pass between the writing area and the chip.
Costs: the pattern must be known; screen readers announce it as a toolbar.

## D213 - End-of-range moves use `aria-disabled` (2026-10-03)

**Chose:** Move up / down and Move section up / down at the first or last
position are `aria-disabled`, not `disabled`; pressing does nothing (item 14a3).
Beats: `disabled`, which drops focus to the page body when the button becomes
disabled under it.
Costs: the button stays focusable and must ignore presses itself.

## D214 - The section chip is label, Move section up / down, Section settings, Remove section (2026-10-03)

**Chose:** that chip; a one-section page offers no Move section up / down, as it
offers no Remove section (item 14a3).
Beats: the mockup, which had no Remove section - nothing else removes one.
Costs: a wider chip.

## D215 - The admin CSP drops `'unsafe-inline'` styles and `data:` images (2026-10-03)

**Chose:** admin `style-src 'self'` and no `data:` in `img-src`; the toolbar and
chip are placed with CSSOM, never a `style` attribute (item 14a3).
Beats: keeping them for 14b - Editor.js, which needed them, is gone, and the
CSP test now keeps 14b from bringing them back unnoticed.
Costs: any future library writing inline style attributes in the admin is
refused and needs a recorded decision.

## D216 - The block cap refuses only a move that adds a block (2026-10-03)

**Chose:** at 200 blocks, a move out of a one-block column (which leaves a
placeholder) is refused with the palette's 200-block sentence; a pure reorder
never is (item 14a3).
Beats: refusing every move at the cap, which would freeze a full page.
Costs: none known.

## D217 - Dragging uses Pointer Events, not HTML5 drag and drop, and no library (2026-10-03)

**Chose:** one drag controller on Pointer Events (`block-drag.client.tsx`),
started by `startDrag(source, event)` from a palette tile or the selected
block's grip (item 14b).
Beats: native drag and drop - uneven touch support, the browser draws its own
drag image instead of the design's ghost, and ProseMirror's drop handler would
insert the drag's data as text; dnd-kit or Pragmatic drag and drop - a runtime
dependency that knows DOM lists, not ProseMirror positions.
Costs: hit-testing, auto-scroll, pointer capture and cleanup are ours to keep.

## D218 - The drop gap is a widget decoration inside the writing area (2026-10-03)

**Chose:** the gap is a ProseMirror widget decoration - not focusable, not
stored, `aria-hidden`, `contenteditable="false"` - set by a plugin whose
transactions change no document and add no history (item 14b). Replaces plan
section 6's "drop gaps drawn outside the editable area".
Beats: an overlay outside the writing area, which can only draw a line over
content, not open a gap that pushes the blocks below it down.
Costs: a decoration inside the editable area; D169's rule - nothing
interactive there - still holds, as with 14a3's empty-column hint.

## D219 - A drop lands by the midpoint rule; a drag starts after 6px (2026-10-03)

**Chose:** above a block's vertical middle is before it, below is after;
hit-testing reads the live block rects, skipping the gap, at most once per
animation frame. A press moving less than 6px is a click: a tile adds its
block, the grip announces itself (item 14b).
Beats: edge-based targets, which flicker as the gap pushes blocks down.
Costs: none known.

## D220 - Only the selected block's grip drags it, and the grip is pointer-only (2026-10-03)

**Chose:** a grip `button` at the start of the selected block's toolbar,
`tabindex="-1"` and out of the toolbar's arrow order, `touch-action: none`,
named "Drag to move, or use Move up and Move down"; a press without a drag
announces that name. Move up / Move down are the keyboard path (WCAG 2.5.7).
Not draggable from the phone's Add dialog, which is modal over the canvas
(item 14b).
Beats: dragging an atom by its body or text by its block (a press in text
starts a text selection), hover grips (not in the record), and a keyboard
drag mode.
Costs: select first, then drag.

## D221 - A block's own place is no drop target (2026-10-03)

**Chose:** no gap opens at the two slots beside the dragged block; releasing
there changes nothing and makes no undo step (item 14b).
Beats: a no-op transaction that adds an empty undo step.
Costs: none known.

## D222 - Drop announcements name positions, not columns (2026-10-03)

**Chose:** drop announcements reuse `describePosition`, describing where the
block will be once dropped ("Image: drop at block 1 of 2 in column 2 of
section 1."), only when the place changes (item 14b).
Beats: the mockup's column names ("column 2, Portraits") - columns have none.
Costs: none known.

## D223 - Any document change mid-drag cancels the drag (2026-10-03)

**Chose:** a change to the document while dragging (a Ctrl+Z, say) cancels
it with "Drag cancelled."; the document changes only on release (item 14b).
Beats: re-mapping the dragged position, which risks using a stale one.
Costs: an undo mid-drag ends the drag.

## D224 - Duplicate selects the copy, after the original (2026-10-03)

**Chose:** Duplicate in every toolbar puts a copy just after the block,
selects it, and announces it as one undo step; a main heading's copy is a
Heading (the 14a3 guard keeps the original by identity), but the announcement
names what was duplicated - "Main heading duplicated: ..." (item 14b).
Beats: selecting the original, which leaves the copy unannounced and unseen.
Costs: none known.

## D225 - The block toolbar never covers the section chip (2026-10-03)

**Chose:** when the toolbar would overlap the section chip it slides left to
end before it; with no room (a phone) it stacks just above the chip (owner,
during item 14b step 3).
Beats: "just below the block", tried and refused - it covered the next block.
Costs: the toolbar is not always aligned to the block's right edge.

## D226 - A section tile inserts after the section holding the selection (2026-10-03)

**Chose:** Blank section, Hero, Image and text and Call to action add their
section directly after the section holding the selection, the cursor in its
first text block, as one undo step (item 14c1).
Beats: appending at the end (what "Add a section" already does, so a tile
would add nothing but a kind); inserting before (reading order puts new
things after the place you are).
Costs: adding to the end of a long page means selecting in the last section
first, or using Add a section.

## D227 - Section templates hold empty blocks, never starter text (2026-10-03)

**Chose:** every text block a template inserts is empty, its button has no
text or link and its image no file; editor-only hints name each empty block
("Main heading", "Text"). AI fills the same templates in item 18b. The hero is
heading, text, space, button | image - the space as the mockup draws it, which
D170's list leaves out.
Beats: placeholder copy ("Your headline here"), which publishes if left
unedited.
Costs: an inserted template looks bare until filled; an untouched one
publishes nothing.

## D228 - Templates are plain v4 JSON, shared by the editor and the server (2026-10-03)

**Chose:** `sectionTemplate(kind, { mainHeading })` in
`app/features/blocks/section-templates.ts` returns a v4 `Section` as JSON with
no editor import; its kinds (`blank`, `hero`, `image-text`, `cta`) are the
section kinds item 18b's AI output uses (D170).
Beats: building templates with the editor's ProseMirror schema, which the
server cannot import.
Costs: the editor converts with `schema.nodeFromJSON`, and a template must
stay valid against the v4 Zod schema (unit-tested).

## D229 - An image with no file chosen is stored as `mediaId: ""` (2026-10-03)

**Chose:** the v4 schema accepts an image's `mediaId` as a UUID or exactly
`""` ("not chosen yet"); anything else is still refused with "An image needs
a file from Media.". `""` renders nothing publicly and is never looked up
(`documentMediaIds` skips it). **Amends 14a2's contract**, which required a
UUID.
Beats: refusing the save (every hero would block its page's save until both
images were chosen); dropping the block on save (the layout would change
silently).
Costs: a published page can hold image blocks that draw nothing; an image
column left empty still takes its width (F-205).

## D230 - Empty-text hints are the editor's own decorations, not TipTap's `Placeholder` (2026-10-03)

**Chose:** `blockDecorations` marks each empty text block with `is-empty` and
a `data-placeholder` from `emptyTextHint`: an empty heading names its style; an
empty paragraph beside other blocks says "Text", and with the cursor in a
column paragraph "Write your page…" / "Write your post…"; list and quote
lines have none. The generated text has empty alt text (`/ ""`) so screen
readers skip it (F-204, unconfirmed).
Beats: TipTap's `Placeholder`, which computes the hint while the editor still
holds the previous document, so a hint that depends on the parent went wrong
once typing shifted positions.
Costs: `@tiptap/extensions` is no longer imported by app code but stays in
`package.json` (StarterKit depends on it at the same pinned version); "Write
your page…" now draws in any empty one-column section holding the cursor.

## D231 - A section drop reuses `insertSection` with an index, not `drop()` (2026-10-03)

**Chose:** `insertSection(state, kind, { ..., index? })` places a dragged
section tile before top-level section `index`; `DropSource` gains
`{ template }` so `startDrag` stays the one entry point; `SectionSlot =
{ index }` sits beside the unchanged `DropSlot`.
Beats: widening `drop()` to `{ template }` (14b's note) - `drop()` works on a
slot inside a column, and a section slot has none.
Costs: the controller branches on the source (F-207 records the casts this
took); `useBlockDrag` now takes `{ entryType, maxSections }`, since it drops
sections itself rather than routing through the palette.

## D232 - A section slot is the midpoint rule over whole sections, anywhere over the writing area (2026-10-03)

**Chose:** above a section's vertical middle is before it, below is after,
anywhere inside the writing area's rect, including inside a section's
columns; outside it is no place. The gap is the block gap's look, labelled
"Drop <name> here", and a dropped section never replaces an untouched one.
Beats: a thin strip between sections (hard to hit with a finger or at 200%
zoom); a taller section-sized gap; replacing an untouched page's one section
(a click does not, and the cursor's section would vanish).
Costs: the dashed line between two sections is absent beside the gap; the
writing area's rect includes what the sticky bar covers when scrolled
(F-193).

## D233 - Typing straight after a drop joins its undo step (2026-10-03)

**Chose:** keep ProseMirror's grouping - changes within 500ms share one undo
step - for drops and inserted sections, as 14b and 14c1 already behave.
Beats: forcing `closeHistory` after every drop, which no item has needed yet.
Costs: a Ctrl+Z right after typing at once removes the dropped section and
the typing together.

## D234 - An out-of-range drop slot is refused, not clamped (2026-10-04)

**Chose:** `drop()` returns `"invalid"` for a slot naming no column or an
index outside the column's children, and `insertSection` returns null for an
index outside 0 to the section count; both are announced as a cancel.
`topLevelPosition(doc, index)` in `palette-insert.ts` is the one place a
top-level index becomes a position. `"full"` now means only the block cap.
Beats: clamping to the nearest valid place (F-206's suggestion) - a bad slot
means hit-testing is wrong, and landing somewhere else silently hides that.
Costs: a hit-testing bug shows as a cancelled drag rather than a near-miss
drop.

## D235 - A point covered by anything drawn over the writing area is no drop place (2026-10-04)

**Chose:** in a block or section-tile drag, a point is a place only when
`document.elementFromPoint` there is inside the writing area (`view.dom`), so
the sticky top bar, the settings sheet below 1024px and any later overlay
count as outside every section.
Beats: clipping section rects to the bar's and sheet's rects (F-193's
suggestion) - one rule covers every overlay, present and future, instead of a
list kept up to date.
Costs: relies on the gap being inside `view.dom`, the ghost having
`pointer-events: none`, and the toolbar and chip hiding while dragging; a
pointer outside the viewport has no element and so is no place (F-216).

## D236 - Touch drags by the grip only; a touch on a palette tile is a tap (2026-10-04)

**Chose:** palette block and section tiles start a drag only for
`pointerType` mouse or pen; a touch does nothing on pointerdown and the tap's
click adds the block.
Beats: `touch-action: none` on the tiles, which would stop a swipe from
scrolling the side panel.
Costs: a tablet user cannot drag a tile into place, only tap it in after the
selected block and then move it.

## D237 - While auto-scrolling, a hover place is announced only once it has held for 300 ms (2026-10-04)

**Chose:** while `scrollSpeed` is not 0, a hover announcement waits until its
place has stayed the same for 300 ms; the gap and ghost still move every
frame, and with no auto-scroll announcements stay immediate.
Beats: a fixed rate limit, which would still announce places the pointer is
only passing.
Costs: during a long auto-scroll a screen reader hears nothing until the page
stops or the pointer holds still.

## D238 - Docs name the R2 skip mechanism, not a count of tests (2026-10-04)

**Chose:** `AGENTS.md`, `ci.yml` and `needs-you.md` describe the R2-only
browser tests as those calling `test.skip(skipWithoutStorage)`, and a full
local run as "every test passes, none skipped".
Beats: a test count - it was wrong three times in a row (26, 27, really 5
calls), because every item that adds a test changes it.
Costs: a reader wanting the number has to grep for it.

## D239 - Site ids are UUIDs (2026-10-04)

**Chose:** `sites.id` is `uuid default gen_random_uuid()`; "site 1" is a name
for today's installation, not its id.
Beats: an integer id, which would show in URLs and R2 keys how many sites
exist, and break 0001's id convention.
Costs: ids are long in logs and test output.

## D240 - The app role is created by `db/roles.sql` as the superuser, not by a migration (2026-10-04)

**Chose:** `habre_cms_app` is made by an idempotent psql script run as the
superuser, with `ALTER DEFAULT PRIVILEGES FOR ROLE habre_cms` so later tables
are granted without a migration naming the role.
Beats: giving the owner `CREATEROLE` so a migration could make it - a power
the schema owner never otherwise needs.
Costs: one by-hand step outside `db:migrate` on every existing database (dev
machine, production at the v1 deploy).

## D241 - `DATABASE_URL` stays the app's; the owner gets `DATABASE_OWNER_URL` (2026-10-04)

**Chose:** the web app's variable keeps its name and now names the app role;
a new `DATABASE_OWNER_URL` is read only by `db:migrate` and the browser
tests' helpers.
Beats: renaming both, which would change every environment's web config.
Costs: the same name now means a different role than before item 15a; every
`.env` and `production.env` needs the one-time change.

## D242 - Row-level security without `FORCE` (2026-10-04)

**Chose:** `entries`, `media` and `site_settings` enable row-level security
but do not force it, so the owner bypasses it.
Beats: `FORCE`, which would hide rows from migrations, backups and the test
helpers.
Costs: anything connecting as the owner sees every site; the app must never
connect as the owner (D152).

## D243 - A transaction-local `app.site_id`, set only by `inSite` (2026-10-04)

**Chose:** `inSite(siteId, run)` opens a transaction and runs
`set_config('app.site_id', siteId, true)`; the policy reads it with
`nullif(current_setting('app.site_id', true), '')::uuid`, so no site means no
rows.
Beats: a session-level `SET`, which a pooled connection carries into the next
request, and one database role per site.
Costs: every site-owned read is a transaction, and `Promise.all` inside it
runs one query at a time on its connection.

## D244 - Site-owned data functions take `siteId` first, and their queries name `site_id` too (2026-10-04)

**Chose:** every function in the site-owned data modules takes `siteId` as
its first parameter and filters or inserts `site_id` itself, inside `inSite`
- two guards, the query and row-level security.
Beats: putting the site on `Actor`, which public queries do not have.
Costs: every call site passes the site, and each query repeats a filter the
policy already applies.

## D245 - One membership per user, enforced by `unique (user_id)` (2026-10-04)

**Chose:** `site_members` has `unique (user_id)` in v1 (D159), so "the
user's membership" is one row by construction.
Beats: enforcing it only in code.
Costs: Level 2's multiple sites per person needs a migration dropping the
index and every lookup that assumes one row.

## D246 - Authors and uploaders are members of the row's site, by composite foreign keys (2026-10-04)

**Chose:** `entries (site_id, author_id)` and `media (site_id, uploaded_by)`
reference `site_members (site_id, user_id)`; memberships are deactivated,
never deleted, so authorship survives.
Beats: the old foreign keys to `users`, which let a site's row name another
site's member.
Costs: a membership can never be deleted while its rows exist; deleting a
test site removes rows in dependency order.

## D247 - Tenancy migrated as expand then contract, 0010 then 0011 (2026-10-04)

**Chose:** 0010 adds `sites`, `site_members` and `site_id` with a temporary
default; 0011 adds the membership foreign keys, drops the defaults,
`users.role`, `users.deactivated_at` and `site_settings.id`, and enables
row-level security.
Beats: one migration, which would break the app and the suite mid-item.
Costs: neither rolls back by symlink once 0011 has run; both need a rehearsal
on a restored production backup before the v1 deploy (D163).

## D248 - The public host serves the oldest site until item 16 (2026-10-04)

**Chose:** `findPublicSiteId()` returns the site with the earliest
`created_at`; item 16 replaces it with a lookup by host.
Beats: an environment variable naming a site id - one more production value
for 16 to remove.
Costs: a site created with an earlier timestamp would take over the public
host; nothing makes one before 16.

**Superseded by D311** (2026-10-06): item 16a resolves each request's site
from its host; `findPublicSiteId` is deleted.

## D249 - New uploads go under `sites/<site id>/`; existing R2 objects keep their keys (2026-10-04)

**Chose:** `generateStorageKey(siteId, ext)` returns
`sites/<siteId>/<uuid>.<ext>`; no migration moves old objects.
Beats: moving objects in a migration - a script outside a transaction against
a live bucket, for media 0009 already orphaned from content.
Costs: two key shapes live side by side; `storage_key` stays unique across
all sites.

## D250 - Site 1's subdomain is `surenmaharjan` (2026-10-04)

**Chose:** 0010 creates site 1 with subdomain `surenmaharjan`; nothing serves
it until item 16, and site 1 stays on its own domain.
Beats: no other candidate was proposed; the owner may change it before 16.
Costs: changing it later is an update to one row, but any link handed out on
the subdomain would break.

## D251 - The emailed link opens a confirm page; a POST confirms (2026-10-04)

**Chose:** `GET /verify` shows "Confirm your email" and changes nothing;
pressing Confirm my email (a POST) uses the token, confirms and signs in.
Beats: confirming on GET - mail scanners (Outlook's Safe Links among them)
open links first and would use up a single-use link. D161 holds: one press.
Costs: one extra click for the person.

## D252 - Email is configured by `SMTP_URL` plus `EMAIL_FROM`; plain `smtp://` only to loopback (2026-10-04)

**Chose:** one URL (`smtps://user:pass@host:port`) and a sender; `smtp://` is
refused unless the host is `127.0.0.1`, `localhost` or `::1`. Blank values
count as unset; `EMAIL_FROM` takes `Name <address>` or a bare address.
Beats: separate host, port, user and password variables - four values for
one secret, in a form no provider documents.
Costs: a provider without implicit TLS on 465 needs STARTTLS support we have
not added.

## D253 - `SIGNUP_MODE` defaults to `off`; turning it on without email stops startup (2026-10-04)

**Chose:** `off` | `invite` | `open`, default `off`; `invite` or `open` with
no `SMTP_URL` or `EMAIL_FROM` fails at startup naming the variable.
Beats: defaulting on, or failing at the first signup - a self-hosted copy or
today's production would change behaviour with no new variable.
Costs: an operator must set three values to open signup.

## D254 - Mailpit catches development and CI email (2026-10-04)

**Chose:** `axllent/mailpit` pinned, in `compose.yaml` and as a CI service;
browser tests read its API by recipient.
Beats: nodemailer's JSON transport (exercises no SMTP) and Resend test keys
(an account and network access from CI).
Costs: one more container locally and in CI; Resend itself is first
exercised at deploy.

## D255 - Plain-text emails in v1 (2026-10-04)

**Chose:** every email is `text` only.
Beats: HTML email - escaping, rendering and testing across mail clients.
Costs: no branding until the emails need it.

## D256 - Signup says plainly that an email is in use; Send it again stays neutral (2026-10-04)

**Chose:** signup shows "An account with this email already exists" with Log
in (the link in the error summary, since `Field` takes text only); the resend
form answers the same for every address.
Beats: a neutral signup reply plus an email - a person who mistyped gets no
explanation.
Costs: an invited person can learn whether an email has an account (F-236).
It rests on the beta being invite-only and signup rate-limited per IP.

## D257 - Site address rules (2026-10-04)

**Chose:** 3-63 characters, lowercase letters, digits and hyphens, no hyphen
first or last, not `xn--`, not in the reserved list (15b spec, *Data and
contracts*); the first rule broken is reported. Suggestions: the name joined,
then `-site`, `-web`, `-2`..`-9`; the server keeps the first two free.
Beats: allowing one- and two-letter names - they stay free for later.
Costs: the reserved list is fixed in code; adding a name later cannot reclaim
an address already taken.

## D258 - A new site's title is its address until onboarding (2026-10-04)

**Chose:** `site_settings.site_title` = the address at signup; item 18 sets a
real one.
Beats: asking for a title on the signup form - one more field at the front
door.
Costs: new sites read as their address until the owner renames them.

## D259 - Invite codes: 12 characters from a 30-letter alphabet, hashed, single use (2026-10-04)

**Chose:** `2-9` and `A-Z` without `I L O U`, shown as three groups of four,
normalised (trim, uppercase, no spaces or dashes), stored as SHA-256, used
once by `update ... where used_at is null returning id`.
Beats: storing the code (a database read leaks every invite) and Crockford's
exact alphabet (keeps `U`, which reads as `V`).
Costs: about 59 bits, not 60 - still impractical to guess under the per-IP
limit.

## D260 - Rate limits for signup and resend (2026-10-04)

**Chose:** signup 10 attempts an hour per IP, counting every POST and never
reset by success, sharing login's two password-hash slots (503 when busy);
resend 5 an hour per IP and 3 an hour per email, refused attempts not counted.
Beats: per-IP only - one address could be flooded from many IPs, through
Resend's 100-a-day free cap.
Costs: in-memory limiters reset on restart, as login's do.

## D261 - v1 starts with no accounts (2026-10-04)

**Chose:** migration 0012 deletes every user, membership, entry and media row
and empties every menu, keeping sites and settings; `create-admin` makes the
first admin afterwards.
Beats: backfilling today's users as confirmed - nothing from the single-site
build needs to survive.
Costs: not reversible; R2 objects are left unreferenced; it needs its own yes
at the v1 deploy.

## D262 - Users made by an admin or `create-admin` are confirmed when created (2026-10-04)

**Chose:** `createUser` sets `email_verified_at = now()`; only signup inserts
an unconfirmed user. The column has no default.
Beats: emailing them a link - the admin vouches for them, as today.
Costs: an admin who mistypes an address creates a confirmed account at it.

## D263 - The verification email is sent inside the request, after the commit (2026-10-04)

**Chose:** send after the transaction commits, 10-second SMTP timeouts;
a failure lands on "We couldn't send the email" with Send it again.
Beats: a background send - there is no queue (D154 keeps the one in-process
job for AI), and the person must be told at once.
Costs: a slow mail server slows the signup response.

## D264 - Only the newest verification link works (2026-10-04)

**Chose:** Send it again marks the user's unused verify tokens used before
issuing a new one. On `/signup/sent` the pending-email cookie wins over a
typed address.
Beats: several live links - an old email in the inbox would still sign in.
Costs: a person who opens the older email gets the expired-or-used state.

## D265 - `/signup*` and `/verify` are admin-host paths until item 16 (2026-10-04)

**Chose:** `isPlatformPath` in `content-security-policy.ts` is the one test,
used by the CSP area and by host routing; `signup` and `verify` are reserved
page slugs.
Beats: serving them on the public host - they need the session cookie, which
is host-only on the admin host.
Costs: item 16 moves them to the platform host.

## D266 - Confirming lands on `/admin` until item 18 (2026-10-04)

**Chose:** the confirm POST redirects to `/admin`.
Beats: a placeholder `/start`.
Costs: a new owner lands on an empty admin with no guidance until 18.

## D267 - The signup transaction inserts the site, uses the invite, then inserts the user (2026-10-04)

**Chose:** that order inside one `inSite(newSiteId, ...)` transaction, the
site's UUID generated in the app.
Beats: user first - without a valid code the invite error now comes before
any email check, so only an invited person learns an email is taken (D256).
Costs: an invalid code also hides every other server-side error on that
submit.

## D268 - Send it again does not wait for the mail server (2026-10-04)

**Chose:** the resend reply returns before the send finishes; a failure is
logged as `email_send_failed` and the reply stays neutral.
Beats: awaiting it - a real unconfirmed account would answer slower than a
missing one and reveal itself.
Costs: a failed resend is invisible to the person; only signup shows the
send failure.

## D269 - A used link on a confirmed account shows "already confirmed" (owner, 2026-10-04)

**Chose:** Confirm pressed twice shows "Your email is already confirmed" with
Log in; the expired-or-used state covers unknown, expired and superseded
links.
Beats: the expired-or-used state for a second press - a link reaches a
confirmed account only once used, so "already confirmed" would be
unreachable.
Costs: a used link confirms whether its account exists; reverting is one
`used_at is null` condition in `verify.tsx`.

## D270 - Login checks confirmation last; sessions come only from login and `/verify` (2026-10-04)

**Chose:** an unconfirmed user is refused after the password, membership and
deactivation checks, logged `login_failed` `unverified`, and sent to
`/signup/sent`; `requireUser` does not re-check; `/verify` has no rate limit
(its token is 256 random bits).
Beats: checking first - it would change the existing refusals.
Costs: a session issued some other way would skip the check; none exists.

## D271 - Password reset by email is on exactly when email is configured (2026-10-04)

**Chose:** `/forgot-password` and `/reset-password` exist when `SMTP_URL` and
`EMAIL_FROM` are both set (`isEmailOn`), whatever `SIGNUP_MODE` is; otherwise
both are Not Found and login keeps "Ask an admin of this site to reset it".
Beats: tying reset to signup - a self-hosted copy with `create-admin`
accounts and SMTP should have reset; plan *Switches* already said so.
Costs: none known; item 19 and 15e read the same switch.

## D272 - `SMTP_URL` and `EMAIL_FROM` are set together or not at all (2026-10-04)

**Chose:** one without the other stops startup, naming the missing one.
Beats: accepting one alone, which would silently leave reset off on a server
meant to have email.
Costs: a new startup refusal; production has neither today.

## D273 - Only an account that can log in is sent a reset link (2026-10-04)

**Chose:** a confirmed user with an active membership; everyone else gets the
same reply and no email.
Beats: any account - a deactivated member could not sign in afterwards, and
an unconfirmed one confirms through Send it again, which signs them in.
Costs: an unconfirmed person who forgot their password must find Send it
again; F-233 (signup off strands them) stays open.

## D274 - The reset link opens a form; only its POST uses the link (2026-10-04)

**Chose:** GET checks the link read-only and shows the form or the expired
state; the POST sets the password. As `/verify` does (D251).
Beats: using the link on GET - mail scanners open links first.
Costs: one extra read per page view.

## D275 - A completed reset signs this browser in and every other session out (2026-10-04)

**Chose:** one transaction uses the link, sets the password, bumps
`token_version` and uses up the account's other reset links; the person lands
on `/admin`. A refusal throws inside the transaction, so the link stays
unused. Answers journey 7.
Beats: landing on login, or keeping other sessions.
Costs: no "password changed" message - the admin has no flash mechanism.

## D276 - A reset request does not wait for the mail server (2026-10-04)

**Chose:** the reply returns before the send; a failure is logged
`email_send_failed` `purpose: "reset"`. As D268, and plan *Failure modes*.
Beats: awaiting it - a real account would answer slower and reveal itself.
Costs: a real account still costs one small transaction more (F-238's gap);
accepted under the rate limits.

## D277 - Reset limits: 5 an hour per IP, 3 per email, own counters (2026-10-04)

**Chose:** reset requests are counted apart from Send it again, at the same
limits. The completion has no per-IP limit (256-bit token), checks the link
before any scrypt work and shares login's two password-hash slots.
Beats: sharing resend's counters, which would let one flow block the other.
Costs: see D281.

## D278 - Reset lives in `app/features/signup/` (2026-10-04)

**Chose:** the pages and data functions sit beside signup and verify, as plan
section 6 places them.
Beats: a new feature directory for four files sharing signup's tokens,
layout and limits.
Costs: `signup` now means "signed-out account flows".

## D279 - The reset pages' small rules (2026-10-04)

**Chose:** `/forgot-password` keeps the typed email after every answer; a 429
reads "Too many requests, wait an hour."; with both password slots taken the
reset form says "Busy, try again in a minute.", keeps the link and logs
nothing. Reference screenshots are taken once, never by the browser tests, so
a test run does not change the repository.
Beats: unstated defaults.
Costs: none.

## D280 - The completion's `used_at` and `expires_at` guards are backed by the live-link check (2026-10-04)

**Chose:** keep both guards in `completeReset`'s token update, though the
live-link check before scrypt refuses a used or expired link first; the guards
cover only two submits at once or a link that expires mid-request.
Beats: a concurrent-submit test - no test forces the interleaving.
Costs: dropping either guard alone turns no test red.

## D281 - Someone can keep a person from resetting; accepted (owner, 2026-10-04)

**Chose:** accept F-245: with only the newest link live and 3 requests an hour
per email, 3 requests an hour for one email burn each link its owner gets and
use up their limit.
Beats: keeping two links live, or burning links only on requests that pass
the limit - not worth it for an invite-only beta.
Costs: a targeted person cannot reset while it lasts; revisit if
`reset_rate_limited` scope `email` appears in the security log.

## D282 - Reset code locks the user before their tokens (2026-10-04)

**Chose:** `completeReset` reads the token's user unlocked, locks the user
`for update`, then uses the token - the same order as `issueResetToken`
(F-243).
Beats: locking the token first, which could deadlock against a request for
the same email and answer 500.
Costs: one extra read.

## D283 - A completed reset lifts the login lock on that email (2026-10-04)

**Chose:** a successful reset calls `emailLoginLimiter.reset(email)` (F-244).
Beats: leaving the 15-minute lock - the reset proved the person holds the
mailbox.
Costs: none; the per-IP limit is untouched.

## D284 - One storage limit setting for every site until billing (2026-10-04)

**Chose:** `STORAGE_LIMIT_MB` - 500 by default (D150), any whole number of MB,
`none` to remove it; anything else stops startup naming the variable. The app
reads it as `env.STORAGE_LIMIT_BYTES` (`number | null`). Every site gets it
until item 21 adds the paid plan's limit beside it.
Beats: a per-site column in `sites` (a migration for a value nothing can set
before billing); a constant in code (a self-hosted copy could not raise or
remove it, D148).
Costs: no per-site exception until item 21.

## D285 - Storage MB means 1,048,576 bytes (2026-10-04)

**Chose:** binary MB for the storage limit and its wording, the same unit as
the 10 MB upload cap.
Beats: decimal MB, which would make the two caps disagree.
Costs: a limit of "500 MB" is 524,288,000 bytes, not 500,000,000.

## D286 - Storage is checked before R2, with no lock (2026-10-04)

**Chose:** the upload action sums the site's `media.byte_size` (computed, never
counted) once the file's real size is known and it is a valid image, before
anything reaches R2 or the database.
Beats: a row lock or a reservation, which costs code for a 10 MB overshoot at
most.
Costs: two uploads at once can each pass the limit by one file.

## D287 - An upload past the storage limit is refused with 413 (2026-10-04)

**Chose:** status 413 and the error banner naming the limit, like the per-file
cap: the request is larger than the site has room for.
Beats: 403 (not a permission) and 507 (WebDAV's).
Costs: none.

## D288 - The usage meter is a native `<meter>` (2026-10-04)

**Chose:** `app/lib/ui/meter.tsx`, a `<meter>` with a visible `<label>` and the
"... used" text as its description, drawn as the mock's `.meter`; with no
limit, the text alone and no meter. Home reuses it.
Beats: the mock's `div role="img"` - coding-standards' semantic HTML rule,
ARIA only where no native element exists.
Costs: the bar is styled per engine (`::-webkit-meter-*`, `::-moz-meter-bar`).

## D289 - Storage usage rounds down, the limit rounds up (2026-10-04)

**Chose:** whole MB, then GB to one decimal; usage rounded down, the limit
rounded up (`formatStorage`, `formatStorageLimit`), and a full site's usage
rounded up too - so usage never reads as equal to a limit it has not reached,
nor below a limit it has (F-249, F-250).
Beats: rounding both down ("1.9 GB of 1.9 GB" with room left); rounding to
nearest ("2 GB of 2 GB" with room left).
Costs: a 2000 MB limit reads "2 GB" though it is 1.95 GB.

## D290 - Your account is `/admin/account`, in the shell, for every role (2026-10-05)

**Chose:** one page, **Your account**, inside the admin shell for authors,
editors and admins alike, reached from a link at the shell's foot under the
person's name, until item 21's Plan makes the account menu (item 15e1).
Beats: an account menu holding one entry.
Costs: the foot carries a link and the Log out button side by side until the
menu arrives.

## D291 - Changing email or password asks for the current password, checked like a login (2026-10-05)

**Chose:** the current password is verified as at sign-in - it takes a
`passwordCheckSlots` slot (503 "Busy, try again in a minute.") and a wrong one
counts a failure against `emailLoginLimiter` for the account's current email;
at the limit nothing is checked. A right one does not reset the counter.
Beats: no re-check (a borrowed, unlocked laptop could take the account); a
separate counter (two budgets of guesses for one password).
Costs: a person who mistypes their current password here can lock their own
sign-in for 15 minutes.

## D292 - With email on, a new email takes effect only from a link sent to it; the old address is told afterwards (2026-10-05)

**Chose:** the pending address lives on its `email_tokens` row
(`purpose = 'email_change'`, `new_email`), 24 hours, only the newest link
works, Confirm by POST (D251), no session issued (D270). Confirming re-checks
the address is free, uses up the person's reset links (sent to the old
address) and emails the old address a notice (owner, 2026-10-05).
Beats: changing at once (a typo loses the reset path); a pending column on
`users` (read on every request for a rare state).
Costs: a new purpose and a nullable column on `email_tokens` (`0013`), held
to `purpose = 'email_change'` by a check that any later purpose extends.

## D293 - With email off, an email change is immediate after the current password (2026-10-05)

**Chose:** Save changes the address at once and `email_verified_at` stays
set; `/confirm-email` is Not Found.
Beats: refusing email changes without email.
Costs: a typo in the new address cannot be caught by a link - there is no way
to send one, and an operator made the account.

## D294 - A password change keeps this browser signed in and ends every other session (2026-10-05)

**Chose:** saving bumps `token_version` and sets a fresh cookie on the new
version, as password reset does (D271-D283).
Beats: signing this browser out too; leaving other sessions alive.
Costs: a live reset link still works afterwards (accounts.9); completing it
ends every session.

## D295 - A taken address is said beside the email field (2026-10-05)

**Chose:** "That email is already used by another account." below the field,
asked again at Confirm since someone can sign up with it in between.
Beats: a neutral reply.
Costs: reveals that an address has an account - behind a signed-in session
and the current password, and D159's add-member already tells an admin.

## D296 - The confirmation link is limited per new address and per IP (2026-10-05)

**Chose:** 3 an hour per new address, 5 an hour per IP, a third
`createResendLimits()` instance with the resend limits' numbers; over it,
"Too many emails to that address. Try again later." and nothing is sent.
Beats: no limit (the page would email any inbox from your own account).
Costs: in-memory, so a restart resets it, like the resend limits.

## D297 - Deleting your account is immediate, with no grace period or restore (2026-10-05)

**Chose:** the account goes when the form is submitted (owner, 2026-10-05).
The safeguards are the confirm screen naming what goes, the current password,
and for the last admin the typed address.
Beats: a 30-day schedule (a sweeper, a restore path and a pending state
everywhere, for an invite-only beta).
Costs: a mistake cannot be undone. Deleted data survives only in the nightly
backups until they age out.

## D298 - A member who leaves keeps their content on the site, credited to "Deleted account" (2026-10-05)

**Chose:** `entries.author_id` and `media.uploaded_by` are nullable, and their
composite foreign keys to `site_members` set only that column to null
(`0014`). One `DELETED_ACCOUNT` label in `app/lib/deleted-account.ts`, which is
not `.server.ts` because browser components show it.
Beats: a placeholder "Deleted account" user per site (a fake row that can sign
in, a fake email, and one per site to create).
Costs: every read of an author or uploader must handle null. The five queries
that inner-joined `users` are now left joins.

## D299 - The public byline shows only the date for a deleted author (2026-10-05)

**Chose:** the public post drops the name and its separator; the admin shows
"Deleted account".
Beats: "Deleted account" on a customer's public post.
Costs: the admin and the public site describe the same post differently.

## D300 - The last active admin's deletion takes the site and every member's account (2026-10-05)

**Chose:** one transaction deletes `site_settings`, `entries`, `media`,
`site_members`, every member's `users` row and the `sites` row, in that order
(owner, 2026-10-05). With email on, each other member is told, deactivated
members included.
Beats: keeping their accounts (no site, cannot sign in, and their email is
stuck until Level 2).
Costs: one person's decision deletes other people's accounts. It rests on
`site_members`' `unique (user_id)` (D159), so at Level 2 a member of several
sites must keep their account and lose only this membership.

## D301 - `deleteAccount` is the one place a site is deleted (2026-10-05)

**Chose:** every later site-owned table and service adds its cleanup there:
`site_domains` (16), image variants' R2 keys (17b), `ai_runs` (18),
`contact_submissions` (19) and cancelling the Stripe subscription (21).
Memberships and users are deleted only there; everywhere else they are
deactivated (D159).
Beats: a cleanup spread across features.
Costs: each later item must remember to extend it.

## D302 - The last admin of the oldest site cannot delete their account until item 16 (2026-10-05)

**Chose:** the confirm screen shows a refusal with no form, and a POST is
refused (409) the same way (owner, 2026-10-05).
Beats: allowing it. Until item 16 the public domain serves the oldest site
(`findPublicSiteId`), so deleting it would put a stranger's site on it.
Costs: that admin must promote another member first.

**Lifted by D318** (2026-10-06): once each site is served from its own host,
the oldest site is no longer special.

## D303 - The last admin types the site's address; everyone gives their current password, checked like a login (2026-10-05)

**Chose:** 15e1's `withCurrentPassword` gate: one password slot, and a wrong
password counts against `emailLoginLimiter` (owner, 2026-10-05). The address
is trimmed and compared case-insensitively. It is checked against the loader's
address before the limiter.
Beats: the password alone (a whole site goes).
Costs: one more field for the last admin.

## D304 - The form carries the case it was loaded as, and the transaction re-checks it under a lock on the site row (2026-10-05)

**Chose:** a hidden `expect=leave|site`. The transaction locks the site row,
then the user row, and refuses with 409 "Something changed on your site."
when the case differs. The screen's loader reruns after a 409
(`shouldRevalidate`, F-263), so the person sees the new case.
Beats: no lock (two simultaneous deletions orphan the site, and a page loaded
as leaving could delete a site without the address typed).
Costs: a residual race with a role change in another tab (backlog F-267).

## D305 - The password slot is released before the deletion runs (2026-10-05)

**Chose:** `withCurrentPassword` only verifies; `deleteAccount` runs after it
returns (repair F-265). A wrong password counts even when the case is refused,
and a right one never does.
Beats: running the transaction inside the slot, which let a deletion waiting
on the site lock hold one of the two password slots.
Costs: none found.

## D306 - R2 removals and the members' notices run after the commit and are not awaited (2026-10-05)

**Chose:** `site-deleted-cleanup.ts`'s `removeStorageObjects` and
`notifyMembers` take R2, the mailer and the logger as parameters and never
reject. Each R2 failure is logged with its key; a notice failure logs
`email_send_failed` (`site_deleted_notice`) with the deleter's `userId`.
Beats: awaiting them (seconds for a full site, and the person deleting is
signed out and cannot be told of a failure); a background job (D154 runs
only AI).
Costs: a failed R2 delete leaves objects under `sites/<id>/` until a later
sweep (17b or a script).

## D307 - A deleted site's address is free again at once (2026-10-05)

**Chose:** nothing holds it.
Beats: holding it (needs a table, and nothing serves addresses until item 16).
Costs: someone else can take a recently deleted site's address.

## D308 - Account deletion: smaller build choices (2026-10-05)

**Chose:**
- afterwards the person lands on `/admin/login?deleted=1`, a fixed flag, with
  a `role="status"` banner;
- `findDeletion(siteId, userId)` and `deleteAccount(siteId, userId, expect)`
  take the session's `siteId` first, as site-owned data functions do;
- a refused or changed POST answers 409 with the message on the page;
- the password field stays uncontrolled, as in 15e1, so journey 8's "except
  the password" is not enforced;
- the confirm screen names every other member, active or deactivated, ordered
  by name, as "A, B and C";
- `insertTestMediaRow` takes an optional `siteId`;
- `e2e/deleted-account.spec.ts` runs on site 1, because the public post and
  `/` are served only from the oldest site until item 16. It restores
  `home_page_id`, but shares that row with `home-page.spec.ts` (F-103).
Beats: the alternatives recorded in the 15e2 archive.
Costs: the site-1 spec adds to F-103's shared-row risk.

## D309 - `PLATFORM_URL` and `SITES_URL` replace `ADMIN_URL` and `PUBLIC_URL` (2026-10-06)

**Chose:** two new names, each an http(s) bare origin refused at startup
otherwise, naming the variable (owner, 2026-10-06). A site's origin is
`SITES_URL`'s scheme, then `<address>.`, then its host with its port.
Beats: keeping the old names with new meanings.
Costs: every environment's configuration changes, production's included.

## D310 - No single-host fallback: a public path on the platform host answers 404 (2026-10-06)

**Chose:** development and the browser suite use `127.0.0.1` for the platform
and `<address>.localhost` for sites, so host lookup is always exercised
(owner, 2026-10-06).
Beats: serving the oldest site when the two URLs are equal - fewer test
changes, but the main suite would never exercise host lookup.
Costs: every public visit in the suite goes through `siteUrl`, and CI must
resolve `*.localhost`.

## D311 - The site is resolved once, in root middleware, into router context (2026-10-06)

**Chose:** a pure host classifier (`app/lib/host-routing.ts`) and one indexed
query set `siteContext` (`{ id, subdomain }`) before any route runs; public
loaders read it and throw if it is unset.
Beats: each loader looking up the host itself.
Costs: the context is load-bearing for items 17 and 19.

## D312 - A platform path on a site host redirects to the platform, without a lookup (2026-10-06)

**Chose:** GET/HEAD redirect to the same path on the platform origin, anything
else answers 404, keeping D22's behaviour. The classifier does not ask whether
the host is a real site first, so an unknown host's `/admin` also redirects.
Beats: a 404 for every admin path, which strands someone who types
`<address>.habre.page/admin`.
Costs: none worth naming; the target is always the platform origin, so it is
not an open redirect.

## D313 - Only a host outside both domains is logged as `wrong_host` (2026-10-06)

**Chose:** an unknown or suspended address under the sites domain is a silent
404.
Beats: logging every miss - the wildcard sends every guessed name here and
would bury the real signal.
Costs: guessing at addresses leaves no trace in the app log (Caddy's access
log still has it).

## D314 - Own domains match on the full lowercased host, ports included (2026-10-06)

**Chose:** no port stripping for `site_domains` lookups.
Beats: stripping ports - production has none; a port only appears in a test.
Costs: a test that wants an own domain sends it without a port
(`X-Forwarded-Host`).

## D315 - Links use the site's subdomain until item 17 (2026-10-06)

**Chose:** View site and the site card use `siteOrigin(address, SITES_URL)`,
even for a site with an own domain.
Beats: linking to `surenmaharjan.fyi` now - the seed row exists in every
environment, so development's View site would open production.
Costs: site 1's links show its subdomain until item 17 picks a main address
(D173).

## D316 - `site_domains` is seeded for subdomain `surenmaharjan`, not "the oldest site" (2026-10-06)

**Chose:** `0015` gives `surenmaharjan.fyi`, verified, to the site whose
subdomain is `surenmaharjan`, when it exists.
Beats: the oldest site - on a fresh install its name is chance.
Costs: a self-hosted install gets no seed row, which is right.

## D317 - `site_domains` restricts deletes; `deleteAccount` removes the rows (2026-10-06)

**Chose:** `on delete restrict` on `site_id`, and the app role gets only
`select, delete` (`roles.sql` re-applies the narrowing, F-270). Item 21 adds
`insert` when it needs it.
Beats: `on delete cascade` - the pattern 15e2 set makes every site table's
removal explicit in `deleteAccount`.
Costs: each new site table must be added to `deleteAccount` by hand.

## D318 - The oldest site is ordinary (D302 lifted) (2026-10-06)

**Chose:** the last active admin of any site can delete their account; the
site and its domains go with it.
Beats: keeping the refusal - once the public host no longer serves the oldest
site, nothing makes it special.
Costs: none; `e2e/deleted-account.spec.ts` can now move off site 1 (not done
here, D308).

## D319 - Suspension hides the public site only; members keep the admin, with a standing notice (2026-10-06)

**Chose:** `suspend-site` sets `sites.suspended_at`; the host lookup refuses the
site on every host, while members still sign in, edit and can delete their
account, and every admin screen, the editor included, shows "This site is
suspended." (owner, item 16b).
Beats: locking members out - there is no support address to send them to yet,
and a member could no longer delete their account. Beats a silent public 404,
which leaves an owner with no idea why their site went dark.
Costs: a suspended site's last admin can still delete their account, and the
site with it; only the nightly backups keep the evidence.

## D320 - A standing notice has no live role (2026-10-06)

**Chose:** the suspended notice is static text with `Message`'s `notice` tone
(the error look), no `role="alert"` or `role="status"`, its title a `p`.
Beats: `role="alert"` - it is a fact about the site, not an action's outcome,
and an alert would interrupt a screen reader on every navigation.
Costs: a screen-reader user meets it only in reading order, at the top of main.

## D321 - Operator commands take the site's address (2026-10-06)

**Chose:** `suspend-site` / `unsuspend-site --address <address>`, lowercased.
Beats: an id or an owner's email - an abuse report arrives as a URL.
Costs: an own domain is looked up by hand until an item needs more.

## D322 - Re-running an operator command changes nothing and exits 0 (2026-10-06)

**Chose:** suspending a suspended site (or the reverse) prints so, exits 0 and
keeps the original `suspended_at`.
Beats: failing - a repeated command is not an error, and the first time is the
one worth keeping.
Costs: none.

## D323 - The platform and sites domains reach Caddy as environment variables (2026-10-06)

**Chose:** `deploy/caddy/habre-cms.caddy` uses `{$HABRE_PLATFORM_DOMAIN}` and
`{$HABRE_SITES_DOMAIN}`, and reads `{env.CLOUDFLARE_API_TOKEN}` at runtime, from
`/etc/caddy/habre-cms.env` (mode 600, root). `PLATFORM_URL` and `SITES_URL`
in `production.env` must agree with them.
Beats: naming the domains in the repository - neither is bought yet, and a
self-hosted copy sets its own without editing the file (D148).
Costs: two places on the server hold the same domains and must be kept equal.

## D324 - The repository owns a systemd drop-in for `caddy.service` (2026-10-06)

**Chose:** `deploy/caddy/caddy-habre-cms.conf` adds one `EnvironmentFile=` line;
`setup-server.sh` installs it and creates the placeholder env file once, never
overwriting it. It refuses to install the site file while the Cloudflare module,
either domain or the token is missing, or while any line holds a value outside
`[A-Za-z0-9._-]` or an `export` (F-283) - refusing rather than stripping,
because systemd parses quotes, comments and spaces differently from the shell.
A failed reload with Caddy still active says the previous config is serving
(F-291). A narrow widening of D17.
Beats: doing it by hand on the server, which is not reproducible (D9).
Costs: the repository now touches Caddy's service, though never its unit.

## D325 - `Forwarded` is removed at Caddy (2026-10-06)

**Chose:** every `reverse_proxy` deletes a client-sent `Forwarded` header
alongside pinning `X-Forwarded-Host` and `X-Forwarded-Proto` (F-269).
Beats: ignoring it in the app - Caddy already pins the headers the app trusts
(D96, F-22), so one rule stays in one file.
Costs: the app trusts Caddy to do it; run without Caddy, the header is honoured.

## D326 - The editor screens sit under a pathless layout that is their login guard (2026-10-06)

**Chose:** `app/features/content/editor-layout.tsx` (no sidebar) wraps the four
editor routes, loads `findMemberSite` for the suspended notice and runs the one
`requireUser`; the page routes keep `requireRole` (F-282, F-293).
Beats: each route loading the site and the user itself - two guards per
request, and a screen that forgets the notice.
Costs: a new editor route must be added under the layout in `app/routes.ts`.

## D327 - An own domain is a site's main address only where `SITES_URL` is https (2026-10-06)

**Chose:** `mainHost` returns the site's own domain when `SITES_URL` is
`https:` and the site has a verified one, else `<subdomain>.<sites host>`
(item 17, D173).
Beats: the pure rule, which would send development and the browser tests' site
1 to the live `surenmaharjan.fyi` seeded by `0015`; clearing that seed outside
production; an explicit main-domain column.
Costs: an http deployment never uses own domains as the main address.

## D328 - Several verified domains: the earliest verified wins, then by name (2026-10-06)

**Chose:** `find-site` orders a site's verified domains by `verified_at, domain`
and takes the first, in the same indexed query.
Beats: a chosen main domain - item 21 may add one; until then there is one.
Costs: the rule is implicit; nothing tests the tie-break yet (F-296).

## D329 - The main-address redirect is a 301 on GET and HEAD, cached one day (2026-10-07)

**Chose:** any other host of a site answers GET and HEAD with a 301 to the same
path and query on the main address, with `Cache-Control: max-age=86400`. Hosts
compare without the scheme - the http-to-https hop is Caddy's. Other methods are
served where they arrive until item 19 decides `/_contact`. The redirect is
computed in root middleware and the main origin rides on `siteContext`, so
`find-site` stays free of the environment.
Beats: a 302 (search engines carry ranking less reliably); an uncached 301,
which browsers keep indefinitely - once item 21 can remove a domain, its next
owner would receive the site's readers.
Costs: a browser may revisit the old host once a day.

## D330 - A site's language is a fixed list of left-to-right tags (2026-10-06)

**Chose:** 68 base tags in `app/features/settings/languages.ts`, named by
`Intl.DisplayNames(["en"])`, stored as the tag, `en` by default; the database
checks only the tag's format. A stored tag no longer in the list shows as
English in Settings (`languageOrDefault`), never as the first option.
Beats: a free-text tag (jargon, unvalidatable); right-to-left languages, which
need `dir="rtl"` and a checked layout.
Costs: adding a language is a code change.

## D331 - Search and share fallbacks (2026-10-06)

**Chose:** `<title>` is the search title alone when set, else
"<title> - <site>" (F-116). `og:title` is the search title, else the entry's
title without the suffix, else the site title. The description is the entry's
own; only `/` and `/posts` fall back to the site description. No image falls
back. `og:image` is the original upload until item 17b. `twitter:card` is
`summary_large_image` with an image, else `summary`.
Beats: one description on every page (search engines read it as duplicate); the
logo as a share image (the wrong shape for a card).
Costs: a page with no description of its own has none.

## D332 - The search fields sit in a closed `<details>` under the title (2026-10-06)

**Chose:** a native disclosure, "Search and sharing", after the Web address
line, closed when the editor opens; saved with Save, Publish and Unpublish.
Admin words never say "SEO", "meta" or "Open Graph".
Beats: the block settings panel, which is block-only and script-driven.
Costs: one more keyboard stop in the editor (the summary).

## D333 - The share image is checked against the site in the save itself (2026-10-06)

**Chose:** `saveEntry` and `createDraft` check `socialImageMediaId` is this
site's media in the same transaction, backed by a composite foreign key
`(site_id, social_image_media_id)` with `on delete set null`; a 23503 on it is
the same refusal, never a 500. Deleting an image in use is not refused - the
foreign key clears the entry's column.
Beats: a check only in the route (a race past it); refusing a media delete.
Costs: an entry silently loses its share image when the image is deleted.

## D334 - Public pages carry no entry ids and no share image id or key (2026-10-06)

**Chose:** public loaders return the share image as a URL only
(`public-seo.server.ts`); the canonical path comes from the route's `slug`
param, which the loader matched exactly. Image blocks keep their `mediaId`,
which the renderer needs (F-295).
Beats: returning the id and building the URL in the page.
Costs: none beyond a second small query per page.

## D335 - Sitemap and robots shape (2026-10-06)

**Chose:** `/sitemap.xml` lists `/`, `/posts`, pages by slug, posts newest
first; `/posts` is dated by the newest post; an empty site answers 200 with an
empty `urlset`; bounded at 50,000 URLs. `robots.txt` tells the platform host
from a site by whether `siteContext` is set (React Router 8.4's context has no
`has()`, so it catches the throw). The under-500 ms check is one timed request,
not a p95 (owner accepted, 2026-10-07).
Beats: a sitemap index (no site is near 50,000); a timed p95 in the tests.
Costs: the timing proves one request, not load.

## D336 - A form missing an item 17 field is out of date, not blank (2026-10-06)

**Chose:** a Settings save without `siteDescription` or `language`, and an
editor save without `seoTitle` or `seoDescription`, are refused with the
out-of-date message (F-34, F-107), never treated as empty.
Beats: defaulting a missing field, which a tab open from before the deploy
would use to blank the description or reset the language.
Costs: an old open tab must reload before saving.

## D337 - The shared browser-test login retries once on 503 (2026-10-07)

**Chose:** `e2e/helpers/auth.ts` `logIn` submits again once, after 500 ms, when
the login answers 503 ("Login is busy."), reading the status, not the message
(F-231). The specs' local login copies, which test login itself, do not retry.
Beats: running signup's race test in its own Playwright project after the
others (slower, more config).
Costs: those local copies can still meet the 503 under the full suite.

## D338 - Variant widths: the set below the original, plus its own width under 2400 (2026-10-07)

**Chose:** an upload is stored at each of 480, 960, 1600 and 2400 px narrower
than the original, plus one at the original's own width when it is under 2400
(a 1200 px upload gives 480, 960, 1200). Widths follow the *oriented* width
(item 17b).
Beats: only the fixed four (a 1200 px upload would top out at 960, blurrier
than uploaded) and always all four (upscaling).
Costs: a row's widths are not a fixed set; readers use `variant_widths`.

## D339 - `variant_widths`: null = not yet optimised, `'{}'` = stored as uploaded (2026-10-07)

**Chose:** one nullable `media.variant_widths integer[]` column says both
whether a row is optimised and what sizes it has (`0017_media_variants`).
Beats: a separate `optimised` flag beside the widths.
Costs: three states in one column; every reader handles null and empty.

## D340 - `storage_key` points at the widest WebP (2026-10-07)

**Chose:** keys `sites/<siteId>/<uuid>/<width>.webp` and `.../social.jpg`;
`storage_key` holds the widest WebP, and the row's directory is `storage_key`
up to its last slash. Key and source functions need only
`{ storageKey, variantWidths }`.
Beats: a prefix-only key - every existing reader (the share-image subquery,
the logo, account deletion) keeps a valid URL unchanged.
Costs: the directory is derived from a key, not stored.

## D341 - `byte_size` is the sum stored; check widened to 50 MB (2026-10-07)

**Chose:** `byte_size` counts every object a row owns (D174, D150); the
column's check rises from 10 MB to 50 MB. The 10 MB cap on the upload itself
stays in the app.
Beats: keeping 10 MB, which would refuse a legal five-object row.
Costs: the down migration is refused while any row exceeds 10 MB.

## D342 - The storage limit is checked after resizing, with a cheap refusal first (2026-10-07)

**Chose:** a site already at or past its limit is refused before resizing (no
CPU spent); otherwise the limit is checked against the sum of the resized
objects.
Beats: checking the upload's size, which would refuse uploads that fit once
resized.
Costs: a site near its limit spends a resize on an upload that is then
refused.

## D343 - A 40-megapixel input cap, checked from the header (2026-10-07)

**Chose:** `MAX_INPUT_PIXELS` = 40 MP in `optimise-image.server.ts`, one
constant the refusal message reads, checked from the image header with no
pixels decoded, and **after** the animated-GIF check (an animated GIF's
height is every frame stacked). A reasonable default, raised with the server
(owner, 2026-10-07).
Beats: sharp's 268 MP default - one such decode needs over 1 GB on a 954 MB
server.
Costs: larger camera files are refused until the server grows.

## D344 - WebP and JPEG at quality 80; social image flattened onto white (2026-10-07)

**Chose:** WebP 80, JPEG 80 (mozjpeg off); the social JPEG is 1200 px wide
(or the original's width if narrower), encoded from the original, with
transparency flattened onto white.
Beats: higher quality (size) and sharp's default black flatten.
Costs: each upload decodes the original once per output (F-308).

## D345 - One resize at a time, in-process (2026-10-07)

**Chose:** every `optimiseImage` call goes through one promise chain in the
module; `sharp.cache(false)`; objects are written to R2 one at a time.
Beats: concurrent resizes, which multiply peak memory on a small server.
Costs: uploads queue behind each other (~3 s each on the dev machine).

## D346 - Every R2 object is written with a one-year immutable cache header (2026-10-07)

**Chose:** `uploadObject` requires a cache header; one constant,
`IMMUTABLE_CACHE_CONTROL` = `public, max-age=31536000, immutable`. Safe
because each upload gets a new key.
Beats: an optional header that a new caller could forget.
Costs: a deleted image may linger in a CDN edge cache (F-311).

## D347 - `srcset` on public pages only; fixed sizes in the admin (2026-10-07)

**Chose:** public images get `srcset` and `sizes`; the logo, Media's grid,
the picker, the delete screen and the share-image field use the 480
`thumbnail`; the editor uses `src` (widest up to 1600); `og:image` uses the
social JPEG. `PickedMedia.url` stays the thumbnail. `mediaSources` is the only
place besides `buildMediaUrl` where keys become URLs.
Beats: `srcset` everywhere - the admin is a few people on desktop.
Costs: a large admin preview may look soft.

## D348 - `sizes` from a 51rem reading column, stacking below 43rem (2026-10-07)

**Chose:** `imageSizes(columns)` uses the reading column measured at 51rem
(816 px, 68ch of 19px Inter in Chromium), the column gap, and a 43rem
stacking viewport, in `rem` and `vw` only (a `ch` in `sizes` resolves against
the browser's default font). A banded section's padding is not counted.
Beats: computing from `ch`, or counting padding.
Costs: the numbers must be kept in step with the tokens by hand; uncounted
padding skews the pick slightly wider.

## D349 - The share image's widths come from a second scalar subquery (2026-10-07)

**Chose:** `socialImageVariantWidths` beside the existing
`socialImageStorageKey` subquery in the entries query.
Beats: a join that would reshape the entry query.
Costs: two subqueries on the same media row.

## D350 - The resized-objects shape is one shared module (2026-10-07)

**Chose:** `stored-objects.server.ts` turns an `optimiseImage` result into the
objects to write, used by both the upload and `optimise-media`.
Beats: two copies of the key and byte-size logic.
Costs: none worth naming.

## D351 - `optimise-media` skips a row that fails and exits 1 (2026-10-07)

**Chose:** per site, inside `inSite`, each `variant_widths is null` row is
read, resized, written, then updated `where ... and variant_widths is null`;
a row that fails is logged by id and skipped; the command ends with counts
and exit code 1 if any failed. A row finished meanwhile counts as optimised
and its new objects are deleted.
Beats: stopping at the first failure - one missing object should not block
every other site.
Costs: an operator must read the counts; a failed old-object delete is not
retried (F-302).

## D352 - No colour is a stored choice, the first swatch (2026-10-07)

**Chose:** `brand_color = ''` means the neutral ink look, and Settings offers
it as the first swatch, "No colour (black and white)".
Beats: treating "no colour" only as the state before one is picked, with no
way back to ink once a colour is saved.
Costs: one more swatch in the row.

## D353 - The CSP nonce reaches the page through the public layout's loader (2026-10-07)

**Chose:** one per-request nonce, created before any loader runs;
`entry.server.tsx` puts it in the `Content-Security-Policy` header and the
public layout's loader returns it to root `Layout` for the `<style nonce>`.
Beats: reading React Router's internal nonce context (undocumented in 8.4.0),
or generating it twice.
Costs: the nonce is in loader data - already in the page's script tags, and
it changes per response.

## D354 - The admin's `style-src` stays `'self'`; brand colours go through CSSOM (2026-10-07)

**Chose:** public pages get `style-src 'self' 'nonce-…'`; the admin keeps
`'self'`, and the Settings swatches, preview and editor canvas set their
colours with `element.style.setProperty`.
Beats: widening the admin policy to nonce'd styles.
Costs: server-rendered swatches show their colour only once the page
hydrates (their visible names say it regardless).

## D355 - Dark brand shades wait for item 20 (2026-10-07)

**Chose:** `deriveBrandShades(hex, surface)` takes the surface, but only the
light one is defined and tested.
Beats: deriving and testing values no page can show yet (D168).
Costs: the derivation only darkens, so a dark surface needs a second
direction (F-313).

## D356 - Item 18a splits into 18a1 (colour and style) and 18a2 (the logo) (2026-10-07)

**Chose:** brand colour, presets, preview and canvas first; the SVG logo and
colours suggested from it second.
Beats: one spec of ten-plus steps; the logo's colour suggestion has its own
open question - reading a cross-origin R2 image's pixels in a canvas.
Costs: none worth naming.

## D357 - The shade rule: OKLCH lightness steps until every pair holds (2026-10-07)

**Chose:** hover is primary's OKLCH lightness - 0.07; subtle is lightness
0.965 at 35% of primary's chroma, hue kept; on-primary is white, else
`#0a0a0a`. A colour that fails any pair has its lightness lowered in 0.005
steps (chroma clamped into sRGB) until primary is >= 4.5:1 on bg, surface,
surface-sunken and subtle, and on-primary >= 4.5:1 on primary and hover.
Only the input is stored; shades are derived on every render (D171).
Beats: a lookup table; reproduces the `#2f6b5a` mock's hover and subtle
exactly.
Costs: a picked colour may be shown darker than picked.

## D358 - Primary must also clear 4.5:1 on the band background (2026-10-07)

**Chose:** the derivation checks primary against `--color-surface-sunken`
(`#f5f5f5`) as well, from `BrandSurface.sunken` (F-312).
Beats: checking only bg, surface and subtle - 1,233 of 140,608 sampled
colours fell below 4.5 on a band section.
Costs: some light colours derive one step darker.

## D359 - A logo's colours are counted on the server at upload and stored on its media row (2026-10-07)

**Chose:** `sharp` reads a 64px raw copy of each uploaded image and stores up
to three `#rrggbb` colours in `media.colours` (item 18a2). Supersedes D167's
"taken from the logo's pixels in the browser".
Beats: the browser canvas, which a logo picked from the library taints (R2 is
another origin; CORS is an owner setting), so library logos would get no
colours; reading the image back from R2 on each pick.
Costs: a 64px decode per upload and a column. Images uploaded before 18a2 have
no colours; `optimise-media` does not backfill them.

## D360 - The admin's `img-src` allows `blob:` (2026-10-07)

**Chose:** `blob:` in the admin's Content-Security-Policy `img-src`, so an SVG
logo can be drawn from the user's own file; the public policy is unchanged.
Beats: a `data:` URL (same risk, larger); putting the SVG into the page's DOM
(it would run).
Costs: none worth naming - only same-origin blobs qualify.

## D361 - The logo uploads through its own admin-only route, on one shared upload function (2026-10-07)

**Chose:** `POST /admin/settings/logo` answers JSON; Media's action and this
route both call `storeUpload(actor, file, altText)` (storage cap, sizes, R2
before the row). 18b's onboarding upload calls it too.
Beats: posting to `/admin/media` and reading its redirect.
Costs: one more route.

## D362 - A logo uploaded from Settings gets the alt text "<site title> logo" (2026-10-07)

**Chose:** that alt text, set by the server.
Beats: asking for alt text in Settings - the header shows the logo with
`alt=""` beside the site name, so this is only the library's label.
Costs: the label does not follow a later title change.

## D363 - Settings never selects a logo colour by itself (2026-10-07)

**Chose:** the logo's colours are offered as swatches, none checked; when the
logo changes or goes, a selected logo colour no longer offered stays selected
as Other colour with the same hex.
Beats: preselecting the logo's main colour - AI and the logo suggest, the user
applies (principles). 18b's onboarding may preselect.
Costs: one more click for the common case.

## D364 - An SVG logo becomes a PNG 1200px on its longer side (2026-10-07)

**Chose:** drawn from a `blob:` URL in an `<img>` into a canvas, 1200px on its
longer side, transparency kept, sent as `image/png`; the server's byte check
still refuses SVG. Re-confirmed by the owner (2026-10-07).
Beats: D167's "about 1200px wide" (a tall logo would grow past 1200px);
storing SVG, which needs all three of a server-side allowlist sanitiser, the
cookieless media domain, and `sandbox` CSP headers on `.svg` responses (needs
the custom R2 domain; `r2.dev` cannot set them).
Costs: the logo loses its vector sharpness above 1200px.

## D365 - Biome skips `e2e/fixtures` (2026-10-07)

**Chose:** `e2e/fixtures` excluded in `biome.json`.
Beats: linting them - Biome 2.5 lints `.svg` and fails on the deliberately
malformed and scripted fixtures, which are test inputs, not source.
Costs: a real lint problem in a fixture goes unseen.

## D366 - An SVG's size comes from its root tag's text (2026-10-07)

**Chose:** `svg-size.ts` reads plain or px `width` and `height`, else the
`viewBox`, else what the browser measured - as a string, never put into the
page.
Beats: the browser's measurement alone, which reports Chromium's 300x150
default for a viewBox-only SVG.
Costs: units other than px fall back to the viewBox.

## D367 - The palette rule (2026-10-07)

**Chose:** skip pixels under alpha 128 and with OKLab L > 0.95; a pixel joins
the nearest group whose running OKLab centre is within 0.08, else starts one;
keep groups of at least 5% of counted pixels; drop a halo - a group within 12
(of 255) of the open sRGB segment between another kept colour and white, or
between two other kept colours, at any size (F-317, F-323); each colour is its
group's sRGB average; at most three. Colour words: L < 0.25 black, chroma <
0.04 grey, else by hue - red 355-40, orange 40-80, yellow 80-125, green
125-176, teal 176-225, blue 225-285, purple 285-325, pink 325-355; a light red
(L > 0.78) is pink, a dark orange or yellow (L < 0.6) brown.
Beats: "within 0.16 OKLab of a larger kept group", which also dropped a real
second tone of one hue (`#4a9c80` beside `#2f6b5a` at 45%); a size bound on
halos, since a text wordmark's edges reach 0.71 of the main colour's pixels.
Costs: a deliberate tint of a kept colour, a grey beside black, or a mix of
two kept colours is dropped as a halo at any share (F-324). A colour is near
the drawn one, not exact - edge pixels within 0.08 join the group, so the
mock's `#2f6b5a` is stored as `#2d6a58`.

## D368 - A logo's colours are ordered most-used first (2026-10-07)

**Chose:** most-used first, ties by higher chroma - owner, 2026-10-07.
Beats: the spec's "highest chroma first" - 18b preselects `colours[0]`, and
the colour covering most of a logo is its brand colour more often than a
small saturated accent.
Costs: a logo with a large neutral-ish field and a small vivid mark offers
the field first.

## D369 - `media.colours`' check refuses anything but 0-3 lowercase `#rrggbb` values (2026-10-07)

**Chose:** `0019_media_colours.sql`'s check also refuses `{''}`, an element
holding a comma and a multi-dimensional array (F-318).
Beats: trusting the app to write well-formed values - 18b reads `colours[0]`.
Costs: none worth naming.

## D370 - An AI proposal holds pages only, no posts (2026-10-07)

**Chose:** the proposal is pages, navigation, SEO text and a brand colour; a
Blog kind gets a home page pointing at the post list (item 18b1).
Beats: one or two starter posts.
Costs: a new blog starts with no posts; starter posts would be content the
person must delete.

## D371 - A proposal's buttons link only to its own pages (2026-10-07)

**Chose:** `buttonTarget` is a page key of the same proposal, resolved to slugs
we make; a button without one links to the home page. The AI never writes a
URL.
Beats: AI-written links through the allowlist - safe, but a link the person did
not choose.
Costs: no outbound links in a generated site.

## D372 - OpenRouter first, by default, in a configured order (2026-10-07)

**Chose:** `AI_PROVIDERS` sets the order, default `openrouter`; any model it
serves is a setting (`OPENROUTER_MODEL`, default `anthropic/claude-opus-5.5`,
confirmed on its models list with structured outputs on 2026-10-07); credits
come from the cost it reports. Anthropic and OpenAI direct become optional
fallbacks in 18b2. Owner, 2026-10-07; amends D155.
Beats: Anthropic first with a configured price per model.
Costs: Anthropic's server-side refusal fallback is lost (a refusal fails the
run, which D155's refusal rule already allows); OpenRouter is one more company
in the description's path (`data_collection: "deny"`); its fee on buying
credits.

## D373 - A response with no reported cost fails the run as `invalid` (2026-10-07)

**Chose:** no `usage.cost` from OpenRouter fails the run as `invalid`, logged.
Beats: charging an estimate.
Costs: a run the provider served but did not price is wasted.

## D374 - OpenRouter out of credits (402) counts as unavailable (2026-10-07)

**Chose:** a 402 is `unavailable`, logged at error level, so 18b2's chain moves
on rather than every run failing.
Beats: treating it as broken.
Costs: an empty OpenRouter balance is visible only in the logs while a
fallback carries the runs.

## D375 - A site's AI allowance defaults to 1,000 credits a month (2026-10-07)

**Chose:** `AI_CREDITS_PER_MONTH` defaults to 1,000 (US$1 of provider cost),
or `none`; provisional until 18b2 measures a run (D150, D164).
Beats: no default.
Costs: a number set before any measurement; the owner's decision in
`needs-you.md`.

## D376 - Interrupted AI runs are swept by a security-definer function (2026-10-07)

**Chose:** `fail_interrupted_ai_runs()`, owned by the owner and executable by
the app role, sets every `running` row to `failed` / `interrupted` at startup,
because the app role sees no `ai_runs` row without a site set.
Beats: taking `ai_runs` out of row-level security.
Costs: one function that crosses every site, which must stay that narrow.

## D377 - `ai_runs.site_id` restricts deletion (2026-10-07)

**Chose:** `on delete restrict`, as every site-owned table does; taking the
site deletes its runs explicitly in `deleteAccount`.
Beats: `on delete cascade`.
Costs: each new site-owned table is one more line in `deleteAccount`.

## D378 - `max_tokens` 8000 for a run, not streamed (2026-10-07)

**Chose:** `max_tokens` 8000 (16000 until F-337). The four live runs used
1,061-1,673 output tokens, and 8000 ends the worst case well inside the
5-minute limit, so an over-long answer is charged as `invalid` instead of
timing out uncharged. Model-specific settings such as reasoning effort wait
for 18b2's measurement.
Beats: streaming, which a background run does not need; 16000.
Costs: a proposal near every upper bound would be cut off; a reasoning model's
reasoning counts against the 8000 (F-342).

## D379 - Every proposed page's first hero heading is its main heading (2026-10-07)

**Chose:** each page's first hero heading becomes its `h1`, not only the home
page's; a page without a hero falls back to its title (`render.tsx`), since
`parseDocument` refuses two level-1 headings.
Beats: an h1 only on the home page.
Costs: none worth naming.

## D380 - A proposal's text slot refuses every control character (2026-10-07)

**Chose:** newline and tab included, as well as lone surrogates and
whitespace-only text; the model's instructions say so.
Beats: allowing newlines in bodies.
Costs: a model that writes a newline fails the run as `invalid`.

## D381 - Unknown extra fields in a proposal are stripped, not refused (2026-10-07)

**Chose:** Zod's default stripping.
Beats: `strict()`, which would fail runs over a harmless extra key.
Costs: none worth naming.

## D382 - Credits are worked out in whole micro-dollars (2026-10-07)

**Chose:** a cost in US dollars becomes whole micro-dollars, then credits
(US$0.001 each), rounded up - US$0.003 is 3 credits, not 4; any non-zero cost
is at least 1; reaching the allowance exactly refuses the next run.
Beats: dividing floats.
Costs: none worth naming.

## D383 - Every AI variable is validated even when AI is off (2026-10-07)

**Chose:** a malformed `AI_PROVIDERS` or `AI_CREDITS_PER_MONTH` stops startup
without a key; `none` is `null`, as `STORAGE_LIMIT_MB` does.
Beats: ignoring them while off.
Costs: a self-hoster with AI off can still be stopped by a stray value.

## D384 - A run's slots are claimed synchronously, before its first await (2026-10-07)

**Chose:** two runs at once per process and one per site, claimed in memory
before any await, with the store's running-row check as a second guard. Order:
busy, allowance, running row, insert. A store error or a non-`AiError` throw
fails the run `broken`; an unpriceable cost `invalid`.
Beats: relying on the database check alone.
Costs: the two-at-once limit is per process, not per installation.

## D385 - Starting a run returns `done`, a promise that never rejects (2026-10-07)

**Chose:** `start` returns the run's id and `done`, so `ai:try` and tests can
wait for it.
Beats: polling the row.
Costs: none worth naming.

## D386 - The startup sweep is not awaited and never stops startup (2026-10-07)

**Chose:** a database failure is logged (`ai_runs_sweep_failed`), as
`/healthz` reports one.
Beats: refusing to start.
Costs: a failed sweep leaves interrupted rows `running` until the next start
(bounded to six minutes for blocking by D390).

## D387 - `ai:try` parses only the AI variables (2026-10-07)

**Chose:** the script reads `ai-env.server.ts`, not `env.server.ts`, so
`--fake` works with AI off.
Beats: importing the web app's whole environment.
Costs: none worth naming.

## D388 - Any HTTP status not named is `broken` (2026-10-07)

**Chose:** 429, 402 and 5xx are `unavailable`; every other status is `broken`
- a 404 or 422 is a request we got wrong. The run's own abort sorts as
`unavailable`, which the runner turns into `timeout`.
Beats: unknown statuses as `unavailable`.
Costs: a provider's new transient status fails runs until it is named.

## D389 - The provider schema is a hand-written, shape-only mirror (2026-10-07)

**Chose:** `provider-schema.ts` mirrors the proposal's shape, sections as
`z.union` so it emits `anyOf` (strict mode has no `oneOf`), optional slots
nullable; our Zod parse applies the bounds afterwards. A test checks a valid
proposal passes both.
Beats: deriving it from `proposalSchema` and stripping bounds.
Costs: two schemas to keep in step; the drift test checks one direction
(F-332).

## D390 - A `running` row older than six minutes no longer blocks its site (2026-10-07)

**Chose:** `hasRunningRun` counts only rows created in the last six minutes
(the 5-minute limit plus a minute), so a lost finish write blocks a site for at
most six minutes; `ai:try` exits 1 unless the run it reads back succeeded
(F-329).
Beats: blocking until the next restart's sweep.
Costs: the abandoned row stays `running` until a restart (F-339).

## D391 - A failed AI run is charged the cost the provider reported (2026-10-07)

**Chose:** a failed run that reported a cost is charged its credits; one that
reported none (a timeout, an unreachable provider) stays at 0. The `ai_runs`
check is `credits = 0` only while `running`. Owner, 2026-10-07 (F-330);
replaces "a failed run costs no credits".
Beats: a separate cap on summed `cost_usd`, or a daily cap on failed runs.
Costs: a site pays for a run that gave it nothing; a timeout can still go
uncharged (F-341).

## D392 - 18b2 ships without a live run through Anthropic or OpenAI direct (2026-10-07)

**Chose:** owner, 2026-10-07: Steps 6 and 7 narrowed to what runs with
OpenRouter alone (a succeeded chain run, a 401 that does not move, an
unreachable OpenRouter that moves to Anthropic, `ai:measure` 4 of 4 at a mean
31.8 credits). The direct providers are proven by unit tests on constructed
SDK responses; their live runs and the three-provider measurement are a
`needs-you.md` line, owed before the v1 deploy.
Beats: holding the item open until the keys arrive.
Costs: whether Anthropic accepts the provider schema through `output_config`
is unknown until the first live run.

## D393 - Anthropic's server-side refusal fallback is not used (2026-10-07)

**Chose:** owner, 2026-10-07: no `fallbacks` on Anthropic requests. Its
`"default"` form routes a refusal to a model Anthropic picks, priced at a rate
we have not configured, so the allowance would stop bounding spend (D391). A
refusal fails the run with every provider (D372). Amends plan section 6,
*Integrations*.
Beats: the array form with a configured fallback model and a second price.
Costs: a refusal Anthropic could have answered on another model fails the run.

## D394 - AI is on when the first provider in `AI_PROVIDERS` has its key (2026-10-07)

**Chose:** the first listed provider's key is the switch; a listed fallback
missing its key, model or price stops startup. A malformed price stops startup
even with AI off.
Beats: AI on when any listed key is set, skipping the rest.
Costs: a fallback can't be listed before its key exists.

## D395 - Direct providers have no default model or price (2026-10-07)

**Chose:** `ANTHROPIC_MODEL`/`_PRICE` and `OPENAI_MODEL`/`_PRICE` are required
when listed. A price belongs to one model, and a default drifts out of date
unnoticed.
Beats: defaulting to Claude Opus 5.5 at US$4 / US$20.
Costs: three more variables per direct provider to set.

## D396 - A price has all four keys (2026-10-07)

**Chose:** `input=…,output=…,cache_read=…,cache_write=…` in US$ per million
tokens, all required, with `cache_write=0` where a provider does not charge it
(OpenAI).
Beats: deriving the cache prices from the input price, which hides the 10x
difference between a cache read and an uncached token.
Costs: a longer variable to write.

## D397 - `Usage.input` counts every input token, cache included (2026-10-07)

**Chose:** for every adapter, `input` includes cache reads and writes, so
`ai_runs.input_tokens` means the same whichever provider ran; `costFromUsage`
subtracts the cache counts before pricing the rest.
Beats: storing each provider's own convention (Anthropic's `input_tokens`
excludes the cache).
Costs: the Anthropic adapter sums three fields.

## D398 - Every provider but the last has 150 s; the last has what is left (2026-10-07)

**Chose:** `ATTEMPT_TIMEOUT_MS` 150 s per non-last attempt, combined with the
run's 5-minute signal; an abandoned attempt counts as `unavailable` and is not
charged. With three providers the third may get no time - owner, F-345
accepted, revisit when optimising AI cost and latency. When the run's own
signal has fired, the chain logs `to: null` and tries nothing more (F-344).
Beats: a fixed 100 s for every attempt; sharing the time left across the
providers left.
Costs: two hung providers use the whole run.

## D399 - An `unavailable` attempt is charged nothing (2026-10-07)

**Chose:** none of the three providers reports a cost for a 429, 5xx, dropped
connection or abort, so a run that moved on is charged only what the provider
that answered reported.
Beats: summing the costs of every attempt.
Costs: none known; revisit if a provider starts reporting partial costs.

## D400 - OpenAI direct sends `max_completion_tokens` 8000 (2026-10-07)

**Chose:** not `max_tokens`, which the SDK marks deprecated and OpenAI's
reasoning models refuse with a 400 - sorted `broken`, never falling back.
Beats: the spec's `max_tokens`.
Costs: none known.

## D401 - The direct adapters take `Exclude<ProviderSettings, { name: "openrouter" }>` (2026-10-07)

**Chose:** one settings member covers both direct providers, so
`Extract<…, { name: "openai" }>` would be `never`.
Beats: splitting the union into one member per provider.
Costs: the type does not stop an Anthropic setting reaching the OpenAI adapter.

## D402 - `ai:measure` runs each provider on its own, not through the chain (2026-10-07)

**Chose:** every configured model is measured; to compare another, run it
again with `<P>_MODEL` changed. A 5-minute timeout is recorded as `timeout`,
not `unavailable` (F-346); the summary counts proposals that expand cleanly
(F-349).
Beats: a `--models` list, which would need a price per model on the command
line.
Costs: one run per model comparison.

## D403 - The SDK clients pin their address and logging in code (2026-10-07)

**Chose:** `client-options.ts` sets `baseURL`, `logLevel` and the auth token
for all three clients, so `ANTHROPIC_BASE_URL` and the like in the environment
cannot redirect a provider (F-347). `OPENAI_ORG_ID`/`_PROJECT_ID` and the
`*_CUSTOM_HEADERS` variables are still read by the SDKs (F-350, backlog).
Beats: trusting the SDKs' environment defaults.
Costs: an option list to keep in step with SDK upgrades.

## D404 - Browser tests drive AI runs through `AI_PROVIDERS=fake` (2026-10-08)

**Chose:** a no-network fake provider, accepted only alone and only when
`PLATFORM_URL` is loopback or `*.localhost`; markers in the description
(`[fake:refused]`, `[fake:unavailable]`, `[fake:invalid]`) pick its outcome.
Beats: seeding rows only (step 2's submit and journey 1 would never run in a
browser); a fake provider's address (D403 pins every client's address); a
`NODE_ENV` guard (the browser tests run the production build).
Costs: a test-only branch in production code, guarded by a check production
cannot pass.

## D405 - The app's runner uses OpenRouter alone, for now (2026-10-08)

**Chose:** `pickRunAdapter` gives the fake, else the `openrouter` adapter,
else `null` - never 18b2's chain; a list without `openrouter` leaves
onboarding off, and listing a direct provider logs `ai_fallbacks_unused`
(owner, 2026-10-07).
Beats: the chain as 18b2 built it, whose direct providers have had no live
run yet.
Costs: no fallback in the app until the chain is wired in - a change to
`pickRunAdapter` only. D155's order is unchanged.

## D406 - Daily cap: 10 AI runs per site per 24 hours, in memory (2026-10-08)

**Chose:** the existing limiter's fixed window from the first run, counted
only when a run starts.
Beats: no number in the plan; at 1,000 credits and ~30-40 a run, 10 a day
leaves the monthly allowance as the binding limit.
Costs: resets on restart, like every other in-memory limit.

## D407 - An onboarding description is 10-2,000 characters after trimming (2026-10-08)

**Chose:** bounds on the trimmed text, checked with Zod in step 2's action.
Beats: no bound. Short enough to bound input tokens, long enough for a
paragraph about a business.
Costs: none known.

## D408 - Onboarding steps read "of 2" until step 3 exists (2026-10-08)

**Chose:** number the steps that are built; 18b5 changes it to "of 3".
Beats: "of 3" with a step that does not exist yet.
Costs: one wording change in 18b5.

## D409 - Step 2 is `/start/about`, a GET from step 1 with the kind in the query (2026-10-08)

**Chose:** `/start?kind=` pre-checks a card; `/start/about?kind=&from=<runId>`
prefills from a run, carrying its id, never the text.
Beats: storing the kind server-side between steps - state with nowhere to
live yet, and Back would need it.
Costs: the kind is re-validated on every step.

## D410 - Signup's emailed link lands on `/start`; sign-in lands on `/admin` (2026-10-08)

**Chose:** Confirm my email goes to `/start`, which the gate passes on to
`/admin` when onboarding is not offered.
Beats: `/admin` bouncing to `/start` while offered, which would trap someone
who chose Start blank instead until they publish.
Costs: someone who leaves onboarding has no way back until 18b4's Home.

## D411 - Signing in may return to `/start` (2026-10-08)

**Chose:** `safeRedirect` follows `/start` paths as well as `/admin`.
Beats: losing the onboarding step on sign-in (journey 6).
Costs: one more allowed prefix to keep exact (`/startx` is refused).

## D412 - A suspended site is not offered an AI run (2026-10-08)

**Chose:** the onboarding gate redirects to `/admin` when the site is
suspended, as when AI is off or anything is published.
Beats: letting a site the operator took down for abuse keep spending
credits.
Costs: none known.

## D413 - The onboarding gate is the layout's middleware, not a loader (2026-10-08)

**Chose:** `start-layout.tsx` runs `startGate` as route middleware, so it
covers step 2's action and the wait's retry too.
Beats: a layout loader, which does not run for a POST and would let a site
with published content start runs.
Costs: none known.

## D414 - The wait polls every 2 seconds with `useRevalidator` (2026-10-08)

**Chose:** revalidate while the run is `running`, stop otherwise; a
`running` row older than six minutes shows as failed `timeout`. The status
rule shared by the loader and Try again lives in `run-view.ts`; the route
module is `start-wait.tsx`.
Beats: a stream or SSE (D154), and a meta refresh (a full reload each time,
losing focus).
Costs: one loader request per open wait page every 2 seconds.

## D415 - Item 18b4 splits into 18b4a and 18b4b (2026-10-08)

**Chose:** 18b4a is the review, Use this draft and Home; 18b4b is Preview
and Publish website (owner).
Beats: one item of ~10 steps; leaving Preview and Publish unplanned, which
would leave journey 1 without an end.
Costs: until 18b4b, Home's ready panel ends at Edit the home page.

## D416 - A site uses one AI draft in v1 (2026-10-08)

**Chose:** once a run is `applied`, onboarding is no longer offered - the
gate sends `/start*` to `/admin`, and Try again starts nothing.
Beats: a second apply adding a second set of pages (`home-2`, `about-2`)
and replacing the menu under the first.
Costs: before applying, only Change the description and Try again remain;
after, the person edits the drafts by hand.

## D417 - Apply fills the description and colour only when unset; it replaces the menu and home page (2026-10-08)

**Chose:** the site description is written only when it is `''`; the brand
colour only when it is `''` and there is no logo (D167). The menu and
`home_page_id` are replaced.
Beats: overwriting what a person typed in Settings after Start blank;
keeping a menu that points at none of the new pages.
Costs: a site that chose Start blank and built a menu loses it on apply.

## D418 - Home is the admin's landing; editors and authors keep Posts (2026-10-08)

**Chose:** an admin's `/admin` is Home, first in the sidebar; an editor or
author on `/admin` is redirected to `/admin/posts` (not a 404).
Beats: Home for every role, whose content (the draft, the AI allowance) is
admin-only, leaving an empty screen for authors.
Costs: two landings to keep in step with the sidebar.

## D419 - Drafted page addresses come from titles, never the proposal (2026-10-08)

**Chose:** `slugFromTitle` then `nextFreeSlug` against stored pages,
`RESERVED_PAGE_SLUGS` and earlier pages of the same proposal (F-353's
carry-forward); buttons point at those addresses.
Beats: trusting AI-written addresses.
Costs: an apply racing a concurrent page create on the same address
answers 500 (F-370, backlog).

## D420 - The run is claimed first in the apply transaction (2026-10-08)

**Chose:** `update ai_runs set status = 'applied' where ... and status =
'succeeded' returning result` opens the transaction; the row lock
serialises concurrent applies and the loser sees no row and creates nothing.
Beats: an advisory lock, or a read-then-write check.
Costs: none known.

## D421 - A succeeded run whose proposal no longer parses reads as failed `invalid` (2026-10-08)

**Chose:** `runView` takes whether the result parses; the wait, Try again
and Home (`findLatestFinishedRun`) all apply it. Pressing Use this draft on
such a run redirects to its own page, which shows the failed state with Try
again (F-369).
Beats: a 500, a review with nothing in it, or a 400 banner inside a review
that has no Try again.
Costs: the stored result is re-parsed on every read.

## D422 - The AI meter shows a percentage used, rounded down, capped at 100 (2026-10-08)

**Chose:** "N% of this month's AI allowance used. Renews on <date>." on a
native `<meter>` whose value is capped at the allowance; "No monthly AI
limit." and no meter without one. Never credits or tokens.
Beats: credits left (the mock).
Costs: someone at 99.9% reads 99%.

## D423 - The home page is `p1`, else the first page - one helper (2026-10-08)

**Chose:** `homePageKey(proposal)` decides it for both the review's Home
page badge and the apply's `home_page_id` (F-364).
Beats: badging by position, which disagreed with apply when `p1` was not
first.
Costs: none known.

## D424 - Home's smaller rules (2026-10-08)

**Chose:** Your pages shows the first 20 and links to Pages only past 20;
the ready panel omits Edit the home page when `home_page_id` is null and
drops "We drafted N pages" when N is 0; N is counted from the applied run's
re-parsed result.
Beats: a stored page count (a new column), or a panel with a dead link.
Costs: one parse per Home load while a draft is applied and unpublished.

## D425 - The preview lives on the platform host, under `/admin/preview`, admins only (2026-10-08)

**Chose:** `/admin/preview` and `/admin/preview/:slug` on the platform host,
behind `requireRole(["admin"])`; a refused visitor sees only "Page not
found.", with no bar or site chrome, because the layout's loader never ran.
Beats: a signed preview token on the site host (a second auth path, and a
draft reachable by anyone holding the link); the site host reading the
admin cookie (host-only by design, D6).
Costs: the preview is not on the site's own address, so its links are
rewritten (D427).

## D426 - A third CSP area, `preview`, with the public policy (2026-10-08)

**Chose:** `PolicyArea` gains `"preview"` for `/admin/preview` and under,
with the public policy (style nonce, no `blob:`), so the brand `<style>`
applies.
Beats: setting the brand through the CSSOM (a second way to apply the
brand, and a flash before hydration).
Costs: one more area for `areaForPath` to get right.

## D427 - Links in the preview stay in the preview where they can (2026-10-08)

**Chose:** one pure function, `previewHref`, through `renderDocument`'s
optional `hrefFor` (identity by default, so public output is unchanged):
the site's pages go to their preview addresses, any other site-relative
link goes to the live site at its subdomain origin (`siteOrigin`, the
address the sidebar's View site uses), external links unchanged.
`mainOrigin` lost because the platform has no own-domain lookup for a
member's site, and the subdomain redirects to the main address (D173).
Beats: leaving links as they are (every click a platform 404).
Costs: a link to the live site from a preview takes one redirect.

## D428 - Publish website publishes every draft page, never posts, once (2026-10-08)

**Chose:** `publishDraftPages(siteId)`, one statement, only while nothing
on the site is published and a draft was used; afterwards each page is
published from its editor. Changes 18b4a's note that it would publish "the
menu's pages": a page taken out of the menu would otherwise stay a draft
with no word about it.
Beats: the menu's pages; a site-wide publish available any time, which
could make an editor's unfinished pages public.
Costs: no way to publish the whole site again later.

## D429 - The ready panel's half-size live preview is cut (2026-10-08)

**Chose:** a Preview link (new tab) instead of `home.html`'s
`.ready__preview`.
Beats: an iframe (`frame-ancestors 'self'` on the preview and a second full
page load on every Home visit); rendering the document inside the admin
with the brand applied through the CSSOM.
Costs: Home no longer shows the site at a glance.

## D430 - Preview and publish's smaller rules (2026-10-08)

**Chose:** the preview bar is `--color-surface-sunken` (`--color-surface-2`
does not exist; in the site scope it is `--neutral-100`, light on every
device); a link styled as the secondary button is `home.module.css`'s
`.secondaryLink`, mirroring `.primaryLink` (no shared link-button class
existed); the published banner is a `?published=1` flag read as a boolean.
Beats: a new token; a shared link-button component; a session flash (no
flash store exists).
Costs: `?published=1` shows the banner whatever the state (F-380).

## D431 - Make it yours is `/start/:runId/brand`, after the run starts (2026-10-08)

**Chose:** step 3 at `/start/:runId/brand`, reached when Build my site has
already started the run; Finish and Skip for now go on to `/start/:runId`.
Beats: `/start/brand` before the run (the AI would wait on a step the
person may take minutes over); a query string (a real path per step, so
Back works between them).
Costs: step 3 cannot change what the run was asked for.

## D432 - Let the AI choose; Use this draft writes the AI's colour whenever none is set (2026-10-08)

**Chose:** step 3's colour row offers Let the AI choose (value `''`)
instead of No colour, and Use this draft writes the proposal's colour
whenever the site has no colour, logo or not. Supersedes D417's "and there
is no logo".
Beats: keeping the logo condition (a person who uploads a logo but keeps
the AI's colour would silently get none); a stored "AI's colour" flag (a
migration for one case).
Costs: a site that chose No colour in Settings and comes back to
onboarding gets the AI's colour unless it picks another; No colour is only
in Settings.

## D433 - No Back on step 3; Skip for now writes nothing (2026-10-08)

**Chose:** no Back button; Skip for now is a link to the run's page that
saves nothing.
Beats: the mock's Back (step 2 sends a running site to the run's page, so
it would bounce); a Skip that resets to Modern (it would undo a style saved
in Settings after Start blank).
Costs: the way to a new description is the wait's Change the description.

## D434 - Settings and step 3 share one Brand component (2026-10-08)

**Chose:** `app/features/settings/brand-fields.tsx` holds the Logo field,
the Brand colour row, Style and the preview for both screens; an `aiColour`
prop (`undefined` in Settings) adds the AI swatch.
Beats: a copy of Settings' 200 lines, whose rules (brand-swatches,
brand.10) would drift.
Costs: a change to Settings' Brand section changes step 3 too.

## D435 - Step 3's layout: a route `handle` and a `split` prop (2026-10-08)

**Chose:** step 3's wide main is a route `handle: { wide: true }` read by
the shared onboarding layout; the two columns are a `split` prop on
`BrandFields`, which with it renders the Logo in the first column and takes
Finish and Skip as `children` (F-384). Settings passes no `split`.
Beats: a class in `onboarding.module.css`, which cannot reach the
component's module classes.
Costs: `BrandFields` has two layouts to keep working.

## D436 - `findThisRun` is shared in `onboarding/this-run.server.ts` (2026-10-08)

**Chose:** the wait and step 3 find the site's run through one function.
Beats: a copy in each route.
Costs: none worth noting.

## D437 - Onboarding's posts are capped before they are read (2026-10-08)

**Chose:** step 3's action refuses a body over 16 KB with 413
(`isSettingsFormBodyAllowed`, Settings' cap for the same fields); Build
my site's over 32 KB (`body-size.ts`: 2,000 characters at four bytes,
percent-encoded, is 24 KB). A missing Content-Length is refused. F-382,
the F-01 rule.
Beats: reading `formData()` unchecked, which lets any signed-up admin make
the server buffer a large body.
Costs: the wait's action and Publish website are not capped yet (F-389).

## D438 - A site's own run in flight is refused as `site_busy` (2026-10-08)

**Chose:** `start()` checks the site before the slot count and refuses a
second run for a site with its own reason, `site_busy`, worded "A draft for
your site is already being built. Wait for it to finish, then try again."
`busy` now means only "both process slots are taken". F-358.
Beats: sending the person to the running run's page, which needs the run's
id - the in-memory `sitesInFlight` check has none.
Costs: one more refusal reason for every caller's `switch` to handle.

## D439 - The AI's suggested colour is labelled visibly (2026-10-08)

**Chose:** once the AI's colour is known, Make it yours' Let the AI choose
swatch shows the hex and a visible "Suggested by AI" under it. F-386.
Beats: keeping the label screen-reader only and recording that as intended
in `design.md` - the swatch saves `''`, not the hex, and only the label
tells the person the colour will follow the AI.
Costs: the hex sits off-centre under its dot (F-392).

## D440 - A visitor's message always answers with a 303 to the page, carrying a code (2026-10-12)

**Chose:** `POST /_contact` answers `303` to the entry's public address with
`?contact=sent|invalid|again|busy`, never JSON (item 19a, D157).
Beats: a JSON endpoint plus a no-JavaScript fallback, two answers to keep in step.
Costs: a rejected form loses its text without JavaScript.

## D441 - A bot that fills the honeypot is told `sent` (2026-10-12)

**Chose:** a non-empty `url` field answers `sent`, stores nothing and logs
`contact_spam_dropped`.
Beats: an error, which tells the bot which field gave it away.
Costs: a person whose password manager fills the hidden field loses a message
silently; the field is `aria-hidden`, out of the tab order, autocomplete off (19b).

## D442 - The minimum fill time is an HMAC-signed token (2026-10-12)

**Chose:** `<issued-ms>.<HMAC-SHA-256 with JWT_SECRET>`, too fast under 3 s, stale
over 24 h, checked timing-safe.
Beats: an unsigned hidden timestamp a script sets itself.
Costs: rotating `JWT_SECRET` answers `again` to forms open at the time.

## D443 - Two contact limits: per IP per site, and per site (2026-10-12)

**Chose:** 5 attempts an hour per `siteId:ip`, 100 an hour per site, in memory.
Beats: per IP only, which a botnet gets around and which would fill a site's Messages.
Costs: a flood can lock out real visitors for up to an hour; the site is not harmed (D150).

## D444 - Every contact attempt is counted, valid or not (2026-10-12)

**Chose:** the signup rule: the attempt is counted before anything is checked, and
a refused attempt is not counted again.
Beats: counting only failures, which lets a valid-looking flood through.
Costs: a visitor who retypes a few times uses up their five.

## D445 - A contact body over 16 KiB is refused before it is read (2026-10-12)

**Chose:** a missing, non-numeric or over-16 KiB `Content-Length` answers 413 before
`formData()` runs. Answers F-389's class of problem for this route from the start.
Beats: reading the body unchecked, which makes the server buffer any size.
Costs: a client that sends chunked with no length is refused; a browser form never does.

## D446 - A message outlives its page (2026-10-12)

**Chose:** `contact_submissions.entry_id` references `entries` with `on delete set null`.
Beats: cascade, which would delete a visitor's enquiry because the owner tidied a page.
Costs: a message can name no page; 19c shows it without one.

## D447 - The `/_contact` route exports a loader that answers 405 (2026-10-12)

**Chose:** a loader returning 405 with `Allow: POST`, beside the action. F-395.
Beats: an action-only route, which React Router 8.4 answers with 400 for a GET.
Costs: one small export.

## D448 - A `busy` answer goes to `/`, after the attempt is counted (2026-10-12)

**Chose:** the limiter counts first; only an attempt it lets through looks the entry
up. A refused one redirects to `/?contact=busy`. F-394.
Beats: looking the entry up first, which costs one query per post before the limit
can refuse it.
Costs: a refused visitor lands on the home page; 19b shows `busy` there.

## D449 - One contact form per document, fixed anchor `#contact` (2026-10-12)

**Chose:** a document holds at most one `contactForm` node, refused with one named message; the form's id and the answer's anchor are always `contact`.
Beats: several forms, which need unique ids, tokens and answers per form.
Costs: a page cannot hold two.

## D450 - Browser constraint validation is the "error beside the field" (2026-10-12)

**Chose:** `required`, `type=email` and `maxlength` on the fields; the server's one answer code shows a line above the form.
Beats: a JavaScript form layer, or field-level server errors, both more than 19a's one-code contract.
Costs: the server's `invalid` (rare once the browser has checked) loses what was typed.

## D451 - The form's labels and answer lines are fixed English (2026-10-12)

**Chose:** Name, Email, Message and the `invalid`, `again`, `busy` sentences are literals in `contact-form.ts`.
Beats: a translation table before the site language reaches blocks.
Costs: a non-English site shows English labels; revisit when language reaches the renderer.

## D452 - The token is issued per page view, only for pages with the block (2026-10-12)

**Chose:** `contactFor` returns the entry id, a fresh token and the answer only when the document holds a contact form (F-108).
Beats: issuing on every page.
Costs: a cached page would get `again` after 24 hours; there are no cache headers on public pages today.

## D453 - The admin's preview renders the form inert (2026-10-12)

**Chose:** no `contact` option means disabled fields, no `action`, and no entry, token or honeypot inputs.
Beats: a live form, because the platform host has no `/_contact` (404).
Costs: none.

## D454 - The form's markup is plain TypeScript, not JSX (2026-10-12)

**Chose:** `app/features/blocks/contact-form.ts` builds the form with `createElement` and takes its CSS class names as an argument, so `node --test` can render it.
Beats: JSX in `render.tsx`, which `node --test` cannot import, leaving the form with no unit test.
Costs: one block's markup is written differently from the rest of `render.tsx`.

## D455 - The contact email is sent after the answer, not awaited (2026-10-12)

**Chose:** `contact-submit.ts` starts `notifyContact` without awaiting it; the 303 answer never waits for SMTP.
Beats: awaiting it, which lets a down mail server hold a visitor's form for up to the 10 s timeout.
Costs: a restart in that moment loses the email; the row then shows the failed line after two minutes, which is true.

## D456 - One email per recipient (2026-10-12)

**Chose:** each recipient gets their own message, sent in parallel with `Promise.allSettled`.
Beats: one message with many addresses: no admin sees another's address, and one bad address does not fail the rest.
Costs: more sends against Resend's daily cap.

## D457 - Reply-To is the visitor, From stays EMAIL_FROM (2026-10-12)

**Chose:** `replyTo` is the visitor's address on every notification.
Beats: sending as the visitor, which SPF and DMARC would reject.
Costs: the email address is only as safe as the contact form's schema, which F-398 tightened (no `?&%,<>"`).

## D458 - Read state is explicit, set by a button (2026-10-12)

**Chose:** Mark as read / Mark as unread, a form post that works without JavaScript.
Beats: marking read on opening, because the list shows whole messages and there is no "opening" to hang it on.
Costs: one click per message.

## D459 - The failed line waits two minutes (2026-10-12)

**Chose:** "We couldn't email this message to you." shows only when `notified_at` is null, email is configured and the row is over two minutes old.
Beats: showing it at once, which would report a send still in flight as failed.
Costs: a real failure is invisible for two minutes.

## D460 - Only admins see Messages (2026-10-12)

**Chose:** `requireRole(["admin"])` on the route and the nav entry for admins only; others get the 404 of D69.
Beats: showing editors and authors, because visitors' personal data stays with the people who own the site.
Costs: an editor cannot read messages without an admin.

## D461 - Dark mode is a Settings choice at every level (2026-10-12)

**Chose:** `site_settings.dark_mode` applies whether the site is Simple or Pro; on, public pages follow the visitor's device, off they stay light (owner, at spec time).
Supersedes: D168's "Pro turns it on" and D172's "applies only in Pro".
Beats: Pro-only dark mode, which hid a plain on/off behind a level and left "advanced settings" with nothing in them for v1.
Costs: a dark logo can vanish on a dark page in Simple too; the editor's canvas and Settings' preview stay light, so what the owner sees there differs from a dark visitor's view.

## D462 - The editing level is read from the database on every request (2026-10-12)

**Chose:** `site_settings.level` (D172), read by the shell's loader and by `requireProLevel`, never copied into the JWT.
Beats: a claim in the token, which would go on granting Users after a switch back to Simple until the token expired.
Costs: one extra single-row read on each Users request.

## D463 - Heading 5 and Heading 6 are named "Heading 5" and "Heading 6" (2026-10-12)

**Chose:** the two Pro text styles carry their numbers in the Text style menu and the toolbar label. Placeholder names, with a needs-you line to rename them.
Beats: invented words ("Minor heading", "Label"), a design decision with no mockup behind it.
Costs: Simple's styles are words and these two are numbers.

## D464 - Simple locks the style it has and cannot make a Pro one (2026-10-12)

**Chose:** the document schema accepts levels 1-6 at every level, so a Pro page loads unchanged. On Simple the menu does not offer Heading 5/6, a block already at one shows its style read-only ("Switch to Pro to change."), and a guard refuses an edit that makes or unmakes one with no block going away: Ctrl+Alt+N, the `##### ` shortcut. Typing, moving, deleting, undo, Duplicate, paste and an Enter split pass.
Beats: refusing the save server-side, which would break "switching down never breaks a page"; counting only increases, which let Ctrl+Alt+6 turn a Heading 5 into a 6.
Costs: the guard is client-side, so a crafted request can still store a Heading 5 on a Simple site, which is harmless.

## D465 - A pasted Heading 5 is allowed on Simple (2026-10-12)

**Chose:** a paste is not refused by the guard, so a cut Heading 5 pastes back and a Pro page's text can be copied into a Simple site.
Beats: refusing every paste that holds one, which dropped the clipboard silently (F-401); rewriting pasted levels, which quietly changes a style.
Costs: a Heading 5 can arrive on a Simple site from outside by paste.

## D466 - Users is Not Found in Simple (2026-10-12)

**Chose:** `requireProLevel` throws the same 404 a role refusal gives (D69) and logs it as `request_refused` / `level`; the nav link is hidden.
Beats: a redirect or an "upgrade" screen, which would announce a screen the site has not switched on.
Costs: an admin who switched down finds no Users screen until they switch up again.

## D467 - Site 1 is Pro for the whole browser run (2026-10-12)

**Chose:** a Playwright `globalSetup` (`e2e/helpers/pro-site-one.ts`) sets site 1 to Pro and its teardown puts it back; level and dark-mode behaviour is tested on sites of their own (`levels.spec.ts`).
Beats: switching site 1 inside each spec, which two workers raced on (F-103's shape).
Costs: a crashed run can leave the development site on Pro.

## D468 - Launch's limits are two variables (2026-10-12)

**Chose:** `LAUNCH_STORAGE_LIMIT_MB` (10240 unless set) and `LAUNCH_AI_CREDITS_PER_MONTH` (6000 unless set), read into `env.PLAN_LIMITS`; `limitsFor(plan, config)` resolves a site's numbers. A value below Free's stops startup.
Beats: per-plan JSON, and a `plans` table - one paid plan, and self-hosters already configure by environment.
Costs: a third plan means a third pair of variables; defaults are provisional until the owner sets them (`needs-you.md`).

## D469 - The footer link follows the plan alone (2026-10-12)

**Chose:** a Free site's public pages carry "Made with Habre"; a Launch site's do not. No switch. A self-hosted copy without payment sets its site to `paid` with `set-plan`.
Beats: an environment flag.
Costs: a self-hoster must run one command per site to remove the link.

## D470 - `/admin/plan` exists with billing off (2026-10-12)

**Chose:** the page shows the plan and use with no way to pay; billing's switch (21b) only adds the buttons. Plan section *Switches* amended.
Beats: hiding the page until billing is on.
Costs: a screen that says "Paid plans are coming soon" until 21b.

## D471 - Admin loaders read the plan with their own site query (2026-10-12)

**Chose:** `findMemberSite` reads `plan` with the row it already loads; public requests gain no query, since `findSiteBy*` select `s.plan` in the query they already run.
Beats: putting `plan` on `userContext`, which would change `findUserById` and `SessionUser`.
Costs: one primary-key query on admin routes and uploads that need the plan.

## D472 - An operator command sets the plan until 21b (2026-10-12)

**Chose:** `npm run set-plan -- --address <site> --plan free|paid`, modelled on `suspend-site`; 21b's webhooks become the only other writer of `sites.plan`.
Beats: a SQL one-liner in the runbook.
Costs: a second writer to keep consistent when 21b lands.

## D473 - A subscription set to cancel at period end is `canceled` while the plan stays `paid` (2026-10-12)

**Chose:** the plan page only needs "Launch until <date>"; the `deleted` event makes it Free.
Beats: a new column for one flag.
Costs: a cancel and a payment-failure cancel read the same beyond the Free-site wording.

## D474 - A subscription carries the site id in its metadata, and events match subscription, then customer, then that id (2026-10-12)

**Chose:** set at Checkout; `subscription.created` can arrive before the checkout event.
Beats: matching only what a checkout stored, which drops an early event.
Costs: one more field Stripe holds about a site.

## D475 - An event older than the site's last applied one is ignored; an equal second is applied (2026-10-12)

**Chose:** Stripe's `created` has one-second resolution.
Beats: `<=`, which drops the second of two events in one second.
Costs: two events in the same second apply in arrival order.

## D476 - `past_due` keeps Launch; Stripe's retries are the grace period (2026-10-12)

**Chose:** an expired card mid-month must not strip a paying customer. `unpaid` and `canceled` drop to Free; content is untouched.
Beats: dropping on the first failed charge, or an app-side timer (a second clock).
Costs: the owner sets the retry schedule and final action in Stripe.

## D477 - Webhooks carry no origin check and are authenticated by signature alone (2026-10-12)

**Chose:** the path is matched exactly (`POST /webhooks/stripe`), body capped at 512 KB while streaming.
Beats: a Stripe IP allowlist, which drifts.
Costs: one exempt path in `same-origin.ts` to keep exact.

## D478 - The success URL never sets the plan (2026-10-12)

**Chose:** D160: only a webhook does; the page says the payment is being processed.
Beats: trusting the redirect.
Costs: a short delay before the plan shows.

## D479 - Deleting an account refuses when Stripe cannot cancel the subscription (2026-10-12)

**Chose:** a customer must not be charged for a site that is gone.
Beats: deleting anyway.
Costs: a Stripe outage blocks deletion (F-411: the cancel precedes the deletion's own checks).

## D480 - Checkout only, with a Stripe-held trial, once per site, card required (2026-10-12)

**Chose:** `trial_period_days`; a card-less trial invites throwaway sites and AI spend (D150).
Beats: an in-app card form; a trial per card, which the app cannot see.
Costs: a site that was ever subscribed gets no second trial.

## D481 - Prices live in Stripe and are read, not copied; settings are environment variables (2026-10-12)

**Chose:** a ten-minute cache; a failed read is remembered for a minute; our configuration holds which prices and the trial length.
Beats: amounts in our configuration, or a settings table and operator screen.
Costs: the plan page may read Stripe on a view (amends *Rate limits*).

## D482 - Only a Free site with no live subscription may start Checkout (F-407) (2026-10-12)

**Chose:** `canStartCheckout`; a Free site Stripe still holds a subscription for manages it in the Portal; `paused` is recorded as `past_due`.
Beats: offering Upgrade to every Free site, which could create a second subscription.
Costs: a Free site with an odd subscription must use Manage billing.

## D483 - Limit messages follow the billing switch (F-408), and the admin's `form-action` names Stripe's two hosted pages only with billing on (F-410) (2026-10-12)

**Chose:** `upgradeHint(plan, billingOn)`; `https://checkout.stripe.com` and `https://billing.stripe.com`, admin area only.
Beats: a fixed "coming soon" line; widening `form-action` everywhere.
Costs: the live redirect with and without JavaScript is a manual check (`needs-you.md`).

## D484 - One own domain per site, added in the admin (2026-10-12)

**Chose:** one own domain per site, added in the admin.
Beats: a main-address choice, a redirect set and a UI for them.
Costs: nobody has asked for several; a second domain waits for a request.


## D485 - A TXT record and a reach check are both needed to verify (2026-10-12)

**Chose:** a TXT record and a reach check are both needed to verify.
Beats: TXT alone (a verified domain becomes the main address while pointing nowhere) and reach alone (anyone could claim a domain that happens to point at the platform).
Costs: two records for the person to create.


## D486 - Reach is compared with the site's own subdomain's addresses, and every address must be one of them (F-414) (2026-10-12)

**Chose:** reach is compared with the site's own subdomain's addresses, and every address must be one of them (F-414).
Beats: a configured server IP, and an overlap test, which accepts a domain that also points elsewhere.
Costs: a domain behind a proxy (Cloudflare orange cloud) is reported as not pointing here.


## D487 - A verified domain keeps serving after a downgrade (2026-10-12)

**Chose:** a verified domain keeps serving after a downgrade.
Beats: dropping it, which takes a published site off the internet over a failed card (D150).
Costs: a Free site can keep a custom domain indefinitely; flagged for the owner.


## D488 - An unverified claim expires after 24 hours (2026-10-12)

**Chose:** an unverified claim expires after 24 hours.
Beats: first-come forever (squatting) and duplicates (the domain is the primary key).
Costs: a paying site can re-add a claim inside 24 hours (F-417).


## D489 - Waiting domains are re-checked in the process for 24 hours, then stop (2026-10-12)

**Chose:** waiting domains are re-checked in the process for 24 hours, then stop.
Beats: a Check now button alone, and a job queue or worker (D154).
Costs: a domain whose DNS settles after a day needs Check now.


## D490 - A verified domain is requested once over https to warm its certificate (2026-10-12)

**Chose:** a verified domain is requested once over https to warm its certificate.
Beats: waiting for the first visitor, and polling Caddy.
Costs: the request resolves the domain at that moment (F-420).


## D491 - `/_caddy/ask` answers only a loopback request that did not come through the proxy, whatever the path's case, slash or encoding (F-421) (2026-10-12)

**Chose:** `/_caddy/ask` answers only a loopback request that did not come through the proxy, whatever the path's case, slash or encoding (F-421).
Beats: a shared secret (a new variable) and an open endpoint.
Costs: the gate is `classifyHost` plus the loader's own hostname check.


## D492 - Removing a verified domain asks first, and the server refuses it without `confirm=yes` (F-419) (2026-10-12)

**Chose:** removing a verified domain asks first, and the server refuses it without `confirm=yes` (F-419).
Beats: one-click removal, which takes the main address and its certificate away.
Costs: an extra screen.


## D493 - The platform's own parent domain is reserved as well as its host (F-422) (2026-10-12)

**Chose:** the platform's own parent domain is reserved as well as its host (F-422).
Beats: reserving only `app.<domain>`, which lets someone claim `<domain>` itself.
Costs: a platform host without an `app.` label would reserve its suffix (F-425).


## D494 - The store lives in `own-domain-store.server.ts` and takes `sql`, so a database test can drive it (F-415, F-424) (2026-10-12)

**Chose:** the store lives in `own-domain-store.server.ts` and takes `sql`, so a database test can drive it (F-415, F-424).
Beats: SQL inside a module that imports the environment.
Costs: one more file.

## D495 - Interim domains: the platform on `app.surenmaharjan.fyi`, sites on `habre.page` (amends D153) (2026-10-12)

**Chose:** until the platform domain is bought, `PLATFORM_URL=https://app.surenmaharjan.fyi` and `HABRE_PLATFORM_DOMAIN=surenmaharjan.fyi`; sites on the bought sites domain, `SITES_URL=https://habre.page`, wildcard `*.habre.page` by DNS challenge on that zone. The Caddy file's platform apex/www block is commented out meanwhile - it would define site 1's `surenmaharjan.fyi` twice. Email is sent from `surenmaharjan.fyi`, never `habre.page`. Site 1's own domain must not be removed while interim: the app reserves the platform's parent and would refuse to re-add it (F-433).
Beats: waiting for `habre.ai` to deploy v1; sites under `sites.surenmaharjan.fyi`, the first plan, which kept customer sites on the sign-in's registrable domain.
Costs: site 1 and the admin share a registrable domain - an apex or sibling host could plant a parent-domain cookie (no `__Host-` prefix), and site 1's pages are same-site with the admin (F-436, no path found). Switching later restores the Caddy block and changes the two platform values.

## D496 - The DNS challenge runs on Cloudflare for `habre.page`; `surenmaharjan.fyi` stays on Porkbun (2026-10-12)

**Chose:** `habre.page` registered and served by Cloudflare, with a Caddy token limited to DNS edit on that zone, filtered to the server's IP, with an expiry. `surenmaharjan.fyi` stays on Porkbun's DNS - it needs no token. CAA on both: `letsencrypt.org` and `sectigo.com` (ZeroSSL, Caddy's fallback).
Beats: a Porkbun DNS module, whose API key reaches every API-enabled domain in the account and can change nameservers; moving `surenmaharjan.fyi` to Cloudflare, decided first and dropped once `habre.page` was bought.
Costs: two DNS providers to secure.

## D497 - `SEARCH_INDEXING=off` blocks search engines in the app, not in Caddy (2026-10-12)

**Chose:** one variable, `on` unless set; `off` makes every host's `robots.txt` disallow all with no sitemap and every app response carry `X-Robots-Tag: noindex, nofollow`. Production sets `off` through the beta.
Beats: Caddy-set headers and a Caddy-answered `robots.txt` - those make seo.2 false in production while every test says it holds, cannot be tested without a Caddy, and give a self-hoster nothing; `robots.txt` alone, which still lets a linked URL be listed.
Costs: static files `server.js` serves itself (`/assets/*`) carry no header; `robots.txt` disallows them anyway.

## D498 - The terms and the privacy policy live in the app, at `/legal/<document>`, on the platform host (2026-10-13)

**Chose:** `/legal/terms` and `/legal/privacy`, served by the app; `isPlatformPath` takes any path under `/legal/` with a document after it, so a site host redirects them to the platform (fixes/2026-10-13-legal-pages, F-428).
Beats: `/terms` and `/privacy`, which would take those names from every customer site (a single-segment platform path redirects); a document hosted elsewhere, which self-hosters could not ship.
Costs: a customer page can never live under `/legal/`; bare `/legal/` is left to the site (F-437 - it otherwise matched the public `:slug` route on the platform host and answered 500).

## D499 - Legal text is typed data, not markup or Markdown (2026-10-13)

**Chose:** `LEGAL_DOCUMENTS` in `app/features/legal/legal-documents.ts` - title, updated date, intro and sections as plain strings, rendered escaped like any text (D28-D30). Section ids are page anchors and are kept once published.
Beats: a Markdown file, which needs a renderer dependency; raw HTML, which the project never renders.
Costs: no inline links or emphasis in the text; editing means editing a TypeScript file.

## D500 - The drafts say only what the code does; what only the owner knows is a placeholder (2026-10-13)

**Chose:** every statement traced to the code: the AI is sent the kind of site and the description, to OpenRouter alone (D405 - not Anthropic or OpenAI, owner 2026-10-13, F-438); images sit at a public address; the last admin deleting takes the other members' accounts; local backups live up to 9 days (F-439). Anything else is an `[OWNER: ...]` placeholder. The drafts merged with 14 placeholders for testing (owner, 2026-10-13); they must be filled before signup opens to the public (`needs-you.md`, `production-pending.md`).
Beats: copying a template policy, which would promise things the code does not do.
Costs: wiring the AI fallbacks in, changing the backup script or adding a cookie means editing the policy too - `legal-documents.test.ts` guards the provider names.

## D501 - Agreement is a sentence above Create my website, not a checkbox (2026-10-13)

**Chose:** "By creating an account you agree to the Terms of service and Privacy policy." with both linked, above the button; login links both under its form; the policy pages link to signup only when signup is on (F-441).
Beats: a required checkbox, which adds a field without adding consent.
Costs: no record of which version someone agreed to - none needed while production starts empty; the owner may ask for the checkbox.

## D502 - The browser spec imports the documents it checks (2026-10-13)

**Chose:** `e2e/legal.spec.ts` imports `LEGAL_DOCUMENTS`, so it checks every section heading against the real data; `tsconfig.node.json` includes the file, as it does the own-domain files.
Beats: a hand-kept copy of the headings in the spec, which drifts.
Costs: one more app file in the node project's include list.

## D503 - Production starts v1 on a fresh database (2026-10-13)

**Chose:** at the v1 deploy the production `habre_cms` database is dropped and
recreated empty, owned by `habre_cms`; `db/roles.sql` runs against it, then
`npm run db:migrate` applies 0001-0026 from empty - the path CI's `e2e` job
runs on every push - and `create-admin` makes site 1's first admin. No
production backup is copied and no rehearsal runs. Site 1 and its
`surenmaharjan.fyi` domain still exist, because `0010` and `0015` create them
on an empty database too. Supersedes D162's carrying of today's users and
D163's rehearsal and dump rollback (owner, 2026-10-13).
Beats: rehearsing 0008-0026 on a restored backup (F-427) - `0009` and `0012`
already delete every entry, user, membership and media row, so nothing carried
across would survive, and the old content is test data.
Costs: dropping the database is its own yes at `deploy` and cannot be undone;
once dropped, pointing `current` back at `8d82ce4` has nothing to read unless
a dump was taken first, so the rollback is forward - fix and redeploy v1. The
nightly backups of the old database age out as usual.

## D504 - Signup is open from the v1 deploy (2026-10-13)

**Chose:** `SIGNUP_MODE=open` at the v1 deploy, not D150's invite-only beta;
billing stays off and every limit stays on. Amends D150's "signup opened to
everyone once..." (owner, 2026-10-13).
Beats: invite codes through the beta - anyone can start without waiting for a
code.
Costs: the terms and privacy policy must be final before the deploy (F-428).
AI spend is open to anyone who confirms an email address, so the only things
capping it are the per-site credits (D164) and each provider's spend limit.

## D505 - Habre is licensed AGPL-3.0-only (2026-10-13)

**Chose:** the GNU Affero General Public License v3.0, only that version, in
`LICENSE` and `package.json`, chosen by the owner when the repository went
public. Self-hosting stays free (D148); a modified copy served to others must
publish its source.
Beats: MIT - easier for companies to adopt, but a competing host could run a
closed, improved fork, against a business that sells hosting. "Or later" -
hands the choice of future terms to the licence's publisher rather than the
owner.
Costs: some companies will not use AGPL code; selling a separate commercial
licence later needs the rights to every outside contribution (a CLA before
accepting any).
