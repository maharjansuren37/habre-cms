# Status

**Read this first** after a break or a cleared context. It answers "where is
this, and what should I do next" without needing to read the whole repository.

For the live view - which build steps are ticked, what git says, what has
drifted - run `progress` instead. This file is the slower-moving picture:
what has been verified, and what is known to be missing.

The `docs` skill maintains it.

## Where this stands

**Goal:** a CMS non-technical editors can run a website with. **All 8 build
items are shipped and now live in production**, as of the deploy below.
`main` is at `6bf3ddb`, in sync with origin, and live in production.

- **Deploy, 2026-09-28 (fix `admin-data-host-redirect` to production):**
  release `6bf3ddb` ("fix: keep login on the admin host (admin.data
  redirect) (#17)", CI green on this exact SHA). Built locally from a clean
  clone of `main` at this commit: `npm ci` -> `npm run verify` (exit 0, 220
  unit tests; `test:e2e` 89/89 ran before merge) -> `npm ci --omit=dev` ->
  `rsync --rsync-path="sudo rsync" --chown=habre_cms:habre_cms` to
  `/srv/habre-cms/releases/6bf3ddb` (same layout as `4d9efdb`, 59M). No
  migrations, no env, unit or Caddy changes. `current` repointed, service
  restarted cleanly. Verified through the real proxy: `/healthz` on both
  hostnames -> `{"status":"ok","database":"up"}`; `https://surenmaharjan.fyi/`
  -> 200; `/admin/login` -> 200; **`https://cms.surenmaharjan.fyi/admin.data`
  -> data redirect to `/admin/login?redirectTo=%2Fadmin` (was
  `https://surenmaharjan.fyi/admin.data`)**; `/admin/pages.data` ->
  `redirectTo=%2Fadmin%2Fpages` (was `...pages.data`). No journal errors.
  **A real login in production was confirmed by the owner**, landing on
  `/admin/posts` on the admin host.
  **Rollback:** `sudo ln -sfn /srv/habre-cms/releases/4d9efdb
  /srv/habre-cms/current && sudo systemctl restart habre-cms` - no schema
  change, so safe. 6 releases on disk (40G free). Note: `/srv/habre-cms` is
  mode 750, so `readlink`/`ls` there need `sudo`.
- **Deploy, 2026-09-23 (items 5-8 to production):** release `4d9efdb` (commit
  `4d9efdbd2e8fb4a2fd2a146b450d39795022e2b2`, "feat: users and roles (item 8)
  (#16)", CI green on this exact SHA). Built from a **clean clone of `main`**
  at this commit - never the working tree, never the server - `npm ci` ->
  `npm run verify` (exit 0, 220 unit tests) -> `npm run test:e2e` (85/86
  passed; the one failure is the already-documented F-78 race under parallel
  workers, re-ran clean the same day from the working tree at 86/86 - not a
  regression) -> `npm run build` -> `npm ci --omit=dev` -> rsynced to
  `/srv/habre-cms/releases/4d9efdb` (`app/`, `build/`, `db/`, `scripts/`,
  `server.js`, `package.json`, `package-lock.json`, production
  `node_modules`, 59M). **Migrations `0004_media.sql` and
  `0005_site_settings.sql` applied ahead of this deploy** (see Migrations,
  above) - schema first, code after. No systemd unit or Caddy changes needed
  this time (unlike item 4c/F-72) - same `PUBLIC_URL`/`ADMIN_URL` shape,
  R2 vars added to the existing `production.env` file, not the unit.
  `current` repointed to `4d9efdb`, `habre-cms` restarted cleanly ("Server
  listening on http://127.0.0.1:3000 (production)", no errors since).
  Verified serving through the real proxy, not `localhost`: `/healthz` on
  both hostnames -> `{"status":"ok","database":"up"}`; `https://surenmaharjan.fyi/`
  -> 200; `https://cms.surenmaharjan.fyi/admin/login` -> 200;
  `/admin/media` and `/admin/users` (both new) -> 302 (redirect to login,
  not 404 - routes exist and are gated). No errors in the journal since
  restart.
  **Four risks accepted by the owner for this release** (recorded in
  `needs-you.md` and F-100, all "will address after MVP"): production R2
  credentials still shared with development; `R2_PUBLIC_URL` still the
  rate-limited `r2.dev` address; no screen-reader/keyboard pass has been
  done (WCAG 2.2 AA is the recorded bar); no Content-Security-Policy.
- **Rollback, if needed - symlink only, no paired unit/Caddy restore this
  time:** `sudo ln -sfn /srv/habre-cms/releases/4165637 /srv/habre-cms/current
  && sudo systemctl restart habre-cms`. The new tables (`media`,
  `site_settings`) stay in the schema but nothing in `4165637`'s code reads
  them, so this is safe. 5 releases now on disk (40G free, no cleanup
  needed): `48e5052`, `52c2670`, `0ad8300`, `4165637`, `4d9efdb`.
- **Post-deploy check, 2026-09-23:** `/healthz` on both hostnames ->
  `{"status":"ok","database":"up"}`, `https://surenmaharjan.fyi/` -> 200,
  `/admin/users` -> 302 - so UptimeRobot's keyword check still matches.
  README (F-98) and CHANGELOG (F-99) have since been updated by `docs`.

**Previous release:** `4165637` (deployed 2026-09-21) - items 1 through 4c,
when `https://surenmaharjan.fyi` (public site) went live for the first time
beside `https://cms.surenmaharjan.fyi` (admin). The previous release, `0ad8300`, was items 1-3;
no new migration shipped with item 4 (0001-0003 were already applied).

- **Deploy, 2026-09-21 (item 4a/4b/4c to production):** built from a clean
  clone of `main` at `4165637` (never on the server, never from a working
  tree) - `npm ci` -> `npm run verify` (exit 0, 165 unit tests) -> `npm run
  test:e2e` (56 browser tests, incl. the host-routing/hostname-split suite) ->
  `npm run build` -> `npm ci --omit=dev` -> rsynced to
  `/srv/habre-cms/releases/4165637` (`app/`, `build/`, `db/`, `scripts/`,
  `server.js`, `package.json`, `package-lock.json`, production
  `node_modules`). No pending migrations (`db/migrate.ts` against production:
  "No pending migrations").
  **This release also required two infrastructure changes, not just a code
  swap** - item 4c renamed `APP_URL` to `PUBLIC_URL`/`ADMIN_URL`, so the app
  now refuses to start without both:
  - **F-72 repaired first:** the live systemd unit was copied aside to
    `/etc/habre-cms/habre-cms.service.pre-4c` (mode 600) before being
    overwritten, so a rollback to `0ad8300` can restore the matching unit
    alongside the symlink rather than leaving them mismatched.
  - The repo's `deploy/habre-cms.service` (now setting `PUBLIC_URL`/
    `ADMIN_URL` instead of `APP_URL`) and `deploy/caddy/habre-cms.caddy` (now
    three site blocks - `cms.`, the apex, and a `www` redirect, where before
    only `cms.` existed) were installed to `/etc/systemd/system/` and
    `/etc/caddy/sites/`. `daemon-reload`, `current` repointed to `4165637`,
    `habre-cms` restarted, Caddy reloaded (`caddy validate` passed first).
    **One hiccup:** the reload initially failed - `caddy validate`, run
    directly as root to check the config, had itself created
    `/var/log/caddy/habre-cms-public-access.log` owned by `root`, which the
    `caddy` user then couldn't open; `chown caddy:caddy` on that one file and
    the reload succeeded.
  Verified serving, through both hostnames, not `localhost`: `/healthz` on
  both -> `{"status":"ok","database":"up"}`; `https://surenmaharjan.fyi/` ->
  200 with `<title>Habre CMS</title>` (the public home page, live for the
  first time); `https://www.surenmaharjan.fyi/` -> 301 to the apex;
  `https://cms.surenmaharjan.fyi/admin/login` -> 200; an admin path requested
  on the public host redirects to the admin host and vice versa (D22,
  confirmed live); a wrong-password POST -> 403 cross-site refusal (expected -
  curl has no session/CSRF context), not a crash. No errors in the journal
  since the restart.
- **Rollback, if needed - not symlink alone, because the unit changed too:**
  `sudo ln -sfn /srv/habre-cms/releases/0ad8300 /srv/habre-cms/current &&
  sudo cp /etc/habre-cms/habre-cms.service.pre-4c
  /etc/systemd/system/habre-cms.service && sudo systemctl daemon-reload &&
  sudo systemctl restart habre-cms` - then also restore the previous Caddy
  site file (only the `cms.` block) if the apex should stop serving. No
  migration to reverse. **This is the first release where a symlink-only
  rollback would have been wrong** (F-72) - future releases that touch the
  unit or Caddy config need the same paired-restore treatment, not the old
  proven procedure by habit.

## Done, with evidence

- **Item 1, admin login** - shipped; `verify` passed every done-when at ship time
  (login p95 0.191 s). Proven in production: the owner created an admin with
  `create-admin` on the server and logged in through a browser.
- **Item 2a, write a post** - shipped through **PR #3 with CI green**, the first
  item CI checked before it reached `main`. 110 unit tests, 25 browser tests,
  save p95 105 ms against a 1 s bar. Four independent `reviewer` passes found and
  closed a P0 (every list block stored as `[object Object]`), stored XSS through
  Editor.js's own render path, and two ways to save an empty body over a real
  post - each now covered by a test shown to fail when the repair is reverted.
- **Item 2b, inline formatting** - shipped through **PR #4 with CI green**. Bold,
  italic and links stored as canonical `{ text, bold?, italic?, href? }` runs
  (`blocks_format` v2, D28-D32), never HTML; links checked against an allowlist;
  the format marker enforced at both ends. Two independent `reviewer` passes
  found and closed six findings, then three more after the first repair round
  (a toolbar focus ring invisible against hover, a NUL-character fix that missed
  lone surrogates, an unmeasured contrast claim) - all repaired and shipped in
  the same item. Three P3s remain open (F-50, F-51) or unverified (F-52), none
  blocking.
- **Item 3, manage posts** - shipped through **PR #5 with CI green**.
  `/admin/posts` lists, filters (All/Drafts/Published, with counts), searches
  and paginates (20 a page); delete asks for confirmation first. 148 unit tests,
  39 browser tests; list load p95 20.2 ms, delete p95 68.9 ms against 2,000
  seeded rows (1 s bar). Review found 11 findings; 2 repaired and shipped
  (leaking CSS selectors, unqualified SQL columns), 9 remain open or unverified
  at P3.
- **Item 4a, publish and unpublish** - shipped through **PR #6**. A
  Publish/Unpublish button on the post editor, saved atomically with content
  in the same request; `published_at` set once, never reset. No unit test
  (DB-backed, matches the project's own pattern for `entries.server.ts`);
  proven through `npm run test:e2e`, which stood at 152 unit / 44 browser
  tests by the end of this item. Two findings (F-57, F-65), both P3, repaired
  and closed in the same item - an unbounded/attacker-controlled banner
  string, and a third copy of a redirect one-liner extracted into `banner.ts`.
  Also repaired F-40 (the `updateDraft` -> `saveEntry` rename).
- **Item 4b, render the public site** - shipped through **PR #7**. `/`
  (newest 10 published posts) and `/posts/:slug` (one post, blocks rendered
  through JSX, never an HTML-building helper), both themed 404s. No unit test
  (DB-backed/JSX, matches project precedent); proven by
  `e2e/public-site.spec.ts` (6 tests); p95 for both routes measured under the
  500ms bar. Three findings (F-66, F-67, F-68), all P3, repaired and closed -
  a lost dev-mode stack trace, two tests never shown to fail, an unmeasured
  contrast pairing. Also surfaced **F-69** (P2, `createRequestHandler` never
  gets a `mode`, so dev-mode error detail has never actually worked) - filed
  but deliberately left open, unrelated scope.
- **Item 4c, split the hostnames** - shipped through **PR #8**. See the full
  deploy record under *Where this stands* above (F-72, the systemd-unit
  rollback pairing, was found and repaired during this item's own
  `preflight`).
- **Item 5a, media storage and library** - shipped through **PR #9**. Upload
  to R2 (`aws4fetch`), 10MB/JPEG-PNG-WebP-GIF cap checked against real bytes
  not the declared MIME type, a shared `/admin/media` library (every role
  sees every upload, deletion ownership-scoped for authors). Unit tests
  covering `detectImage`, size/alt-text validation, storage-key generation;
  total unit tests reached 174 by this item's close. Three findings, all
  repaired and closed: **F-73 [P2]** (delete links had no per-item accessible
  name, unlike posts' own already-solved version of the same problem),
  **F-74 [P2]** (an R2 delete failure showed a generic error page even
  though the row - the source of truth - was already gone), F-75 [P3] (the
  same false-empty-state-on-a-late-page bug F-56 already found for posts).
- **Item 5b, insert images into posts** - shipped through **PR #10**. A
  hand-written Editor.js image tool (D58, not the `@editorjs/image` package -
  it stores URLs, this project stores only a media id) with a picker dialog
  over `/admin/media/picker`; existing images resolve server-side in the
  loader, no per-block fetch. This item also had to ship a real (not stub)
  public `<img>` render, since `render.tsx`'s exhaustive block-type switch
  fails the build otherwise. Unit tests reached 183. Two findings, both
  closed in the same review pass that found them: **F-76 [P2]** (picking an
  image dropped keyboard focus to `<body>` - root cause was that everything
  outside an open native `<dialog>` is inert, not just a focus-call ordering
  issue) and F-77 [P3] (`logIn` duplicated byte-for-byte across five e2e
  files, extracted to a helper).
- **Item 5c, render images on the public site** - shipped through **PR #11**.
  Every rendered image on the public site gets a `<figure>`/`<figcaption>`
  caption (the media's existing alt text, not a new field - D65). One step,
  no new findings closed; **F-79 (P3, unverified)** stays open - the alt
  text is announced twice by a screen reader (once as the image's accessible
  name, once as the caption), a known, accepted tradeoff pending the still-
  outstanding screen-reader pass. `npm run verify` - 183 unit tests; full
  suite 64 browser tests passed.
- **Item 6a, manage pages** - shipped through **PR #12**. `/admin/pages`
  (list/new/edit/delete), restricted to editor/admin (author gets the same
  404-not-403 shape as any other ownership refusal); generalized
  `entries.server.ts` to take `type: "post" | "page"` as every function's
  first parameter, with zero behavioral change to posts. New `requireRole`
  middleware, reusable by item 8. Unit tests reached 187. Three findings, all
  closed: **F-80 [P2]** (the pages happy-path e2e test never actually edited
  content or verified a delete at the data layer - repair also surfaced that
  retyping into an already-loaded Editor.js block is unreliable in this
  harness, so the fix proves the edit through the title field instead),
  F-81 [P3] (a redirect target typed as bare `string`), F-82 [P3] (role
  refusals weren't logged, unlike every other access refusal in the app).
- **Item 6b, render pages on the public site** - shipped through **PR #13**.
  `/:slug` resolves a published page through the same `findPublishedEntry`
  contract posts use, rendered through the identical `renderBlocks` - no
  byline, no back link (a page is static reference content, not a dated
  article - D72-74). Unit tests held at 187 (no new unit-testable logic,
  route module only); full suite 70/70 on one run (a second run hit the
  pre-existing F-78-class parallel-worker flake on unrelated tests). p95 for
  `GET /:slug` measured across three runs: 4.3ms, 3.5ms, 3.7ms against the
  500ms bar. One finding, **F-85 [P3]**, closed - the spec's own commitment
  to reword a `design.md` line hadn't actually landed in the diff.
- **Item 7a, site title and logo** - shipped through **PR #14**. New
  `site_settings` singleton table (migrated whole, including the reserved
  `navigation` column 7b later populates); `/admin/settings` (admin-only)
  sets title and logo via the same picker dialog pattern the image block
  uses; both the admin sidebar and public header/footer read the live
  values. Six findings, five closed by repair: F-87 [P2] (the required e2e
  spec was never written), F-88 [P2] (the same focus-loss defect F-76 fixed
  once, reintroduced by the duplicated picker), F-89 [P3] (a deleted-media-row
  logo id crashed the save instead of failing gracefully), F-90 [P3] (the
  "Logo" field had no programmatic label), F-91 [P3] (`site_settings`
  queried twice per request). **Standout: F-92** - the logo resolved against
  the site's own URL instead of the R2 public URL in all three loaders, so it
  would have 404'd for every real visitor; caught by `build` itself while
  writing F-87's test, not by the original review pass. One finding,
  **F-93 [P3]**, stays open - a silent fallback that could mask a future
  lookup failure.
- **Item 7b, navigation menu** - shipped through **PR #15**. An ordered
  nav-item editor on `/admin/settings` (add/remove/move-up/move-down as
  same-form intents, no JS required), rendering as a `<nav>` in the public
  header; reuses the existing link allowlist, no new scheme rules. e2e suite
  reached 78 tests. One finding this item's own review raised, **F-94 [P2]**,
  closed - with several `type="submit"` buttons now on the form, pressing
  Enter in the Site title field either did nothing or silently appended a
  blank nav row instead of saving; fixed with a hidden default-submit button
  as the form's first focusable child.
- **Item 8, users and roles** - shipped through **PR #16**, the MVP's last
  item. `/admin/users` (admin-only): list, add (email/name/role/password),
  and per-user role change / password reset / deactivate-reactivate, each an
  independent form keyed by its own `intent`. Every role-changing,
  deactivating or password-resetting action bumps `token_version` in the
  same statement (takes effect on the user's very next request) and logs a
  security event. **Built and reviewed with no findings raised against it.**
  Standout: no "last active admin" count check exists or is needed - proven
  by construction, not tested defensively, since every route requires an
  active admin and self-role-change/self-deactivation are refused outright,
  so at least one admin is mathematically always left. (A later, separate
  review pass found F-97, a `design.md` documentation gap for the new
  Active/Deactivated badge - tracked live in `blueprint/context/findings.md`,
  not this item's own archived findings.)
- **Server** (`ocwebserver`, Ubuntu 24.04): Node 26.8.2, PostgreSQL 16.15 on
  localhost, systemd `habre-cms.service` as `habre_cms`, Caddy terminating HTTPS.
  Secrets in `/etc/habre-cms/production.env` (mode 600); backup credentials
  separately in root-only `backup.env`. Ports 3000 and 5432 closed in both
  firewalls.
- **Backups** - nightly `pg_dump` at 02:30 UTC to a private R2 bucket, checked
  before upload. **Restore proven** by running the app against a restored copy
  (login succeeded on restored data).
- **Rollback proven** - 5 s back, 3 s forward:
  `sudo ln -sfn /srv/habre-cms/releases/<sha> /srv/habre-cms/current && sudo systemctl restart habre-cms`.
  A release carrying a migration cannot be rolled back this way (F-19).
- **Monitoring** - UptimeRobot on `/healthz` every 5 minutes with a
  `"database":"up"` keyword check and SSL expiry alerts; email delivery proven by
  a real alert.

## Migrations

- **2026-09-23, production:** `0004_media.sql` and `0005_site_settings.sql`
  applied (`db/migrate.ts`, run by the owner directly on `ocwebserver` as
  `habre_cms`, against `/etc/habre-cms/production.env`) - production was still
  on `0001`-`0003` despite `main` carrying items 5-8. Backed up first (nightly
  `pg_dump`, 2026-09-23 02:37 UTC, confirmed uploaded before migrating). Both
  purely additive: `create table media (...)` with an index on `uploaded_by`,
  and `create table site_settings (...)` (singleton, seeded with
  `site_title = 'Habre CMS'`) - no `alter`, no backfill, neither touches
  `entries` or `users`. Reversible: `drop table media` / `drop table
  site_settings` (not exercised). Verified after: `schema_migrations` lists
  all five files; `media`, `site_settings` now exist; the seed row reads back
  correctly; `media` is empty as expected. **The deployed release (`4165637`,
  item 4c) does not read either table**, so this is safe ahead of the actual
  code deploy - schema first, code after, as the migrate skill asks. **This
  does not deploy anything** - the running app is still item 4c only; items
  5-8's code is on `main` but not yet on the server. Next: run `preflight`
  covering items 5-8, then `deploy`.

## Preflight, 2026-09-23 (second milestone audit, covering items 5-8)

**Verdict: no-go, four blockers - all accepted as risk by the owner, to fix
after the MVP ships.** Everything else checked clean: `npm audit` 0
vulnerabilities, no secrets in git history, no P0/P1 in the 49-entry findings
ledger, all required env vars present with no dev-default fallbacks, `npm run
verify` green (220 unit tests), and the **full Playwright suite run locally
against a production build - 86/86 passed**, covering items 1-8 (CI still
doesn't gate these - F-17, unchanged).

- **Production R2 credentials are the same token/bucket as development**
  (found by hashing the values, never printed) - `needs-you.md` reopened this
  after I'd closed it too early on variable names alone. Accepted risk.
- **`R2_PUBLIC_URL` still the rate-limited `r2.dev` address**, not a custom
  domain. Accepted risk (already open in `needs-you.md`).
- **No screen-reader/keyboard pass ever done** (editor, admin shell, public
  site - three separate `needs-you.md` lines, all widened through item 8).
  Accepted risk - the project's own recorded bar is WCAG 2.2 AA.
- **No Content-Security-Policy**, past its own "until item 5" trigger in the
  code comment. New finding **F-100 [P2]**. Accepted risk.

Also filed **F-98**/**F-99** (P3, non-blocking): `README.md` and
`CHANGELOG.md` both stale, describing item-3 state only.

**Deployed 2026-09-23** - see the deploy entry at the top of *Where this
stands*. All 8 items are now live in production.

## Next

1. **The MVP is fully shipped and live.** No queued build item -
   `ideate --rescope` or a fresh `spec` decides what's next.
2. **The four accepted risks from this deploy** (R2 credential separation,
   R2 custom domain, screen-reader/keyboard pass, CSP) are real open work,
   not resolved - the owner's plan is to do them "after the MVP". Worth
   revisiting soon rather than indefinitely.
3. `ci` would close F-17 by giving CI a PostgreSQL service.
4. `context` - regenerate `project-overview.md`: its *Current state* still
   says production is behind `main`, which stopped being true at this deploy.

## Open / not done

- **Browser tests gate nothing** (F-17): CI runs `verify` only, and the tests
  covering every item's worst defects are in the Playwright suite (run by
  hand before each deploy instead).
- **No alerting on a failed backup** - the heartbeat is built but
  `BACKUP_HEARTBEAT_URL` is deliberately unset (owner's decision); a failed
  backup tells nobody.
- **Accessibility never checked by hand** - three separate `needs-you.md`
  lines (editor, admin shell, public site), all still open, **all explicitly
  accepted as risk by the owner for the 2026-09-23 deploy** - the plan is to
  do this after the MVP. WCAG 2.2 AA is the project's own recorded bar.
- **49 findings in the current ledger**, none above P2: 6 P2 open, 1 P2
  unverified, 26 P3 open, 6 P3 unverified, the rest fixed. Highest is **F-100
  (CSP, below)**.
- **No CSP** (F-100) - past its own "until item 5" trigger, item 5 shipped
  weeks before this was noticed; **accepted risk**, same 2026-09-23 decision.
  **No staging** environment; single server, down until noticed (UptimeRobot
  covers "noticed").
- Waiting on the owner (`needs-you.md`): separating the production R2
  credentials from development's and a custom domain for the images bucket
  (both **accepted risk** for now, not blocking, to fix after the MVP), and
  deleting the stale `hone` DNS record. (The UptimeRobot line was stale -
  already satisfied since `monitor` ran - and has been closed by this pass.)

## Gotchas

- **`npm test` runs inside `npm run verify`, and CI has no database** - so
  anything needing PostgreSQL goes in `e2e/`, and logic worth testing is split
  into a plain module beside the one that opens a connection (D24).
- **Editor.js renders with `innerHTML` and sanitizes only on save** - text handed
  back to it must be escaped (D26). **Item 4's public renderer inherits this**,
  and the `title` column is stored raw.
- **`@editorjs/list` saves objects, not strings**, and its block settings menu
  offers a Checklist this version refuses; the toolbox config does not filter it.
- **Editor.js's floating menus are not worth driving in tests** - seed a draft in
  the database and assert the round trip instead.
- **Self-review missed every serious defect in item 2a.** Use the `reviewer`
  agent for anything non-trivial; it reads with fresh context.
- **Read full command output** before diagnosing: a typecheck failure was
  explained by its *last* line while the first five sent me chasing a valid file.

## Verify with

    npm run verify            # typecheck, lint, 220 unit tests, build
    npm run test:e2e          # 86 browser tests; needs docker compose up -d
    curl -sS https://cms.surenmaharjan.fyi/healthz
    curl -sS https://surenmaharjan.fyi/healthz

## Running it by hand

The commands behind the automation: how to build, test, and run this without the
scripts, and how to do by hand what CI does on push.

**Anything that only exists as automation is one broken pipeline away from
nobody knowing how to do it.** Write it down here.

**What CI does on push, by hand** (from the repository root, Node 26):

    npm ci --no-audit --no-fund
    npm run verify

`npm run verify` runs, in order:

    npx react-router typegen     # generate route types (gitignored, so CI needs this)
    npx tsc -b                   # typecheck
    npx biome check .            # lint + format check
    node --test                  # unit tests (**/*.test.ts)
    npx react-router build       # production build into build/

To reproduce CI exactly, run it from a fresh clone with no `.env` - that is how
it was proven on 2026-09-15 (commit `0ab3b35`):

    git clone <repo> /tmp/habre-ci && cd /tmp/habre-ci && npm ci && npm run verify

**Not run by CI** - browser tests, because they need a database:

    docker compose up -d && npx playwright install chromium && npm run test:e2e

## Recommendations

Judgment rather than fact - "if you pick this up later, do X". Kept separate from
what is verified above, on purpose.

- **Of the four accepted risks from the 2026-09-23 deploy, do the R2
  credential separation and CSP first** - both are small (a new Cloudflare
  token/bucket; one header block already drafted in F-100) and close real
  gaps. The screen-reader pass is bigger and has been deferred since item 1;
  it deserves a dedicated session rather than being squeezed in.
- **Give CI a database** (closes F-17). The browser suite is now the only
  thing that actually proves items 1-8 still work together, and it is being
  run by hand, from a fresh clone, immediately before every production
  deploy - that is a real check, but it depends on someone remembering to run
  it. A PostgreSQL service container in `ci.yml` would make it automatic on
  every push, not just at release time.
- **This file is getting long and increasingly chronological** (a preflight
  entry, a migration entry, two deploy entries, each with its own detail).
  Worth a light restructure next time it's touched - collapse older deploy
  detail into shorter lines and keep only the most recent release's full
  evidence at that level of detail.
