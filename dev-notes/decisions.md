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
