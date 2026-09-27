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
