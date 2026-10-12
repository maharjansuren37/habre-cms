# Status

**Read this first** after a break or a cleared context. It answers "where is
this, and what should I do next" without needing to read the whole repository.

For the live view - which build steps are ticked, what git says, what has
drifted - run `progress` instead. This file is the slower-moving picture:
what has been verified, and what is known to be missing.

The `docs` skill maintains it.

## Where this stands

preflight: no-go, 2026-10-13, 22ec086 - blockers F-427, F-428, F-441 (F-426 closed)

**Goal:** a CMS non-technical editors can run a website with. **All 8 MVP
items plus items 9-11 (home page, sections, columns) are shipped and live in
production**, as of the deploy below. Production runs `8d82ce4`, which is `origin/main`. **Item 12
(ready-made sections: hero, call to action, image + text; 12a-12c) was deployed
2026-10-01** (release `8d82ce4`, below); the screen-reader pass was accepted by
the owner (F-130). Nothing merged is undeployed and nothing is in flight; the
build plan is complete. **Owner action now:** publish a page and choose it as the home page in
Settings - production `/` showed the "This site is being set up" placeholder
on 2026-09-29 (`needs-you.md`).

- **Deploy, 2026-10-01 04:24 UTC (items 12a-12c to production):** release
  `8d82ce4` ("docs: preflight 12a-12c ...", CI green on this exact SHA; code is
  `1d58e42`, item 12c, on top of 12a-12b). Built from a **clean clone at that
  commit**: `npm ci` -> `npm run verify` (exit 0, 296 unit tests) -> `npm ci
  --omit=dev` -> `rsync --rsync-path="sudo rsync" --chown=habre_cms:habre_cms` to
  `/srv/habre-cms/releases/8d82ce4` (same layout, 59M). The browser suite (141)
  ran locally before the merge; CI does not run it (F-17). **No migration, no
  env, unit or Caddy changes.** `current` repointed and `habre-cms` restarted
  (04:24:16 UTC, `NRestarts=0`, "Server listening ... (production)"). Verified
  through the real proxy: `/healthz` on both hostnames ->
  `{"status":"ok","database":"up"}`; `/` -> 200, `/posts` -> 200, an unknown slug
  -> 404, `cms.../admin/login` -> 200; the CSP header still names the R2 image
  host; 0 error lines in the journal since the restart. Not exercised on
  production: saving a page with a hero, call to action or image + text section
  (it would create real content). Preflight before it: go, F-130 accepted by the
  owner. **Rollback:** `sudo ln -sfn /srv/habre-cms/releases/135bd1d
  /srv/habre-cms/current && sudo systemctl restart habre-cms` - **safe only while
  no page has been saved with a hero, call to action or image + text section**;
  after that, `135bd1d` throws on those pages (restore from the nightly backup,
  or remove those sections by hand). No schema change, so the database is
  compatible either way.

- **Deploy, 2026-09-30 22:21 UTC (items 10 and 11 to production):** release
  `135bd1d` ("docs: regenerate overview after item 11", CI green on this exact
  SHA; code is `8392922`, item 11, on top of `947d202`, item 10). Built from a
  **clean clone at that commit**, never the working tree or the server: `npm
  ci` -> `npm run verify` (exit 0, 266 unit tests) -> `npm ci --omit=dev` ->
  `rsync --rsync-path="sudo rsync" --chown=habre_cms:habre_cms` to
  `/srv/habre-cms/releases/135bd1d` (same layout, 59M; 10 releases on disk,
  39G free). The browser suite was run on the item branch before the merge
  (111/111); CI does not run it (F-17). **Migration `0007` applied first, as its
  own step** (see *Migrations*). No env, unit or Caddy changes. `current`
  repointed and `habre-cms` restarted (22:21:14 UTC, `NRestarts=0`, "Server
  listening ... (production)"). Verified through the real proxy: `/healthz` on
  both hostnames -> `{"status":"ok","database":"up"}`; `https://surenmaharjan.fyi/`
  -> 200, `/posts` -> 200 (reads entries), `/admin/login` -> 200, an unknown
  slug -> 404; 0 `error` lines in the journal since the restart. Not exercised
  on production: saving a page with sections or columns (would create v3
  content). Preflight before it: no-go on F-125 (screen-reader pass), **accepted
  by the owner 2026-10-01**. **Rollback:**
  `sudo ln -sfn /srv/habre-cms/releases/5bd0d29 /srv/habre-cms/current && sudo
  systemctl restart habre-cms` - **safe only while no page has been saved as v3**;
  after that, `5bd0d29` throws on v3 pages (restore from backup
  `habre_cms-20260930T222050Z.dump`, or convert the pages to v2 by hand).

- **Deploy, 2026-09-29 (fixes F-114, F-115, F-116 to production):** release
  `5bd0d29` ("fix: public page titles name the site (F-116) (#21)", CI green
  on this exact SHA), carrying `quiet-routine-refusals` (F-114),
  `escape-control-characters` (F-115) and `public-page-titles` (F-116). Built
  locally from a clean clone at this commit: `npm ci` -> `npm run verify`
  (exit 0, 240 unit tests; `test:e2e` 100 passed on the same code before
  merge) -> `npm ci --omit=dev` -> `rsync --rsync-path="sudo rsync"
  --chown=habre_cms:habre_cms` to `/srv/habre-cms/releases/5bd0d29` (same
  layout, 59M). No migrations, no env, unit or Caddy changes. `current`
  repointed and `habre-cms` restarted (07:23:47 UTC, `NRestarts=0`, "Server
  listening ... (production)"). Verified through the real proxy: `/healthz`
  on both hostnames -> `{"status":"ok","database":"up"}`; `/` -> 200
  `<title>Habre</title>` (the production site title; before the deploy it
  was "Habre CMS"); `/posts` -> 200 "Posts - Habre"; `/posts/sunset` -> 200
  "Sunset - Habre"; an unknown slug -> 404 "Page not found - Habre" (it had
  no `<title>` before); `cms.../admin/login` -> 200. **F-114's check:** 0
  "No route matches" lines and 0 error-priority lines in the journal since
  the restart, with that 404 probe among the requests. **Rollback:** `sudo
  ln -sfn /srv/habre-cms/releases/bded549 /srv/habre-cms/current && sudo
  systemctl restart habre-cms` - safe, no schema change. 9 releases now on
  disk (40G free) - prune the oldest (`48e5052`, `52c2670`, `0ad8300`) at
  some point.

- **Deploy, 2026-09-28 (item 9 `choose-the-home-page` to production):**
  release `bded549` ("feat: choose the home page (item 9) (#18)", CI green
  on this exact SHA). Built locally from a clean clone at this commit:
  `npm ci` -> `npm run verify` (exit 0, 228 unit tests) -> `npm ci
  --omit=dev` -> `rsync --rsync-path="sudo rsync" --chown=habre_cms:habre_cms`
  to `/srv/habre-cms/releases/bded549` (same layout, 59M). **Migration
  `0006` applied first, as its own step** (see *Migrations*). No env, unit
  or Caddy changes. `current` repointed and `habre-cms` restarted
  (22:46:49 UTC, `NRestarts=0`, "Server listening ... (production)").
  Verified through the real proxy: `/healthz` on both hostnames ->
  `{"status":"ok","database":"up"}`; `https://surenmaharjan.fyi/` -> 200
  showing "This site is being set up" (no home page chosen - production has
  one draft page and no published one); `/posts` -> 200 listing
  `/posts/sunset`, which -> 200; `/admin/login` -> 200; an unknown slug ->
  404; 0 `error` lines in the journal since the restart. UptimeRobot's
  `/healthz` keyword check is unaffected. **Rollback:** `sudo ln -sfn
  /srv/habre-cms/releases/8d6afba /srv/habre-cms/current && sudo systemctl
  restart habre-cms` - safe, `0006` only adds a nullable column the old code
  never reads. 8 releases now on disk (40G free) - prune the oldest
  (`48e5052`, `52c2670`, `0ad8300`) at some point.

- **Deploy, 2026-09-28 (fix `security-hardening` to production):** release
  `8d6afba` ("fix: security hardening - CSP, host-refusal logging, pinned
  forwarded headers", CI green on this exact SHA). Built locally from a clean
  clone of `main` at this commit: `npm ci` -> `npm run verify` (exit 0, 225
  unit tests; `test:e2e` 92 passed before merge) -> `npm ci --omit=dev` ->
  rsynced to `/srv/habre-cms/releases/8d6afba` (same layout, 59M). No
  migrations, no env or unit changes. `current` repointed and the service
  restarted by the owner (12:14:52 UTC). **Caddy site file updated** (F-22's
  `header_up` pins): previous file backed up to
  `/etc/caddy/sites/habre-cms.caddy.bak-20260928121722`, new one installed,
  `caddy validate` (run as the `caddy` user) ok, `systemctl reload caddy`.
  Verified through the real proxy: `/healthz` on both hostnames ->
  `{"status":"ok","database":"up"}`; `https://surenmaharjan.fyi/` -> 200 with
  the public CSP (nonce in `script-src`, R2 origin in `img-src`, no
  `unsafe-inline`); `https://cms.surenmaharjan.fyi/admin/login` -> 200 with the
  admin CSP (`'unsafe-inline'` styles, `data:` images); `www` -> 301 to the
  apex. **F-70:** `POST https://surenmaharjan.fyi/admin/posts` -> 404 and one
  `request_refused`/`wrong_host` line in the journal. **F-22 probes, after the
  Caddy reload:** forged `X-Forwarded-Host: evil.example` with matching
  `Origin` -> 400, 11-byte "Bad Request", CSRF abort in the journal; forged
  `X-Forwarded-Proto: http` with the genuine `Origin` -> reached the login
  action normally. No other journal errors. **In-browser CSP check, 2026-09-28:**
  `/posts/sunset` (with an R2 image) in a clean headless Chromium - no
  violations, image loaded; the post editor checked by the owner in
  LibreWolf - no CSP errors. A violation the owner first saw was uBlock
  Origin's injected inline script, blocked as intended; gone with it off.
  `blueprint/production-pending.md` is now empty.
  **Rollback:** `sudo ln -sfn /srv/habre-cms/releases/6bf3ddb
  /srv/habre-cms/current && sudo systemctl restart habre-cms` - no schema
  change, so safe. The Caddy change is independent; revert it by copying the
  `.bak-20260928121722` file back, `caddy validate`, reload. 7 releases on
  disk (40G free).
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
- **Item 9, choose the home page** - shipped through **PR #18**, deployed as
  `bded549` (evidence in its deploy entry above). `/` is the chosen published
  page or a placeholder, never a post list; posts live at `/posts`; a home
  page's own slug redirects to `/`.
- **Fixes since the MVP** - `admin-data-host-redirect` (PR #17, deployed
  `6bf3ddb`), `security-hardening` (F-100 CSP, F-70, F-22; deployed
  `8d6afba`), and `quiet-routine-refusals` (F-114, PR #19),
  `escape-control-characters` (F-115, PR #20) and `public-page-titles`
  (F-116, PR #21), all three deployed together as `5bd0d29`. Archives in
  `blueprint/history/fixes/`.
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
  a real alert. **It checks only `cms.surenmaharjan.fyi`**. The public hostname
  and its certificate have no check (F-113).
- **Signals read, 2026-09-29 (`monitor`, about 1 h after the item 9 deploy):**
  - Both `/healthz` return `{"status":"ok","database":"up"}` (110-125 ms).
    `habre-cms` has been active since 22:46:49 UTC, `NRestarts=0`, 36 MB.
  - Box: disk 11% (40G free), 538 MB memory available, load 0.00. Certs
    expire 2026-12-02 (apex) and 2026-12-14 (`cms.`). Caddy renews both.
  - Last nightly backup succeeded.
  - Caddy access logs (from 09-16 admin, 09-21 public): **0 5xx**.
  - Latency: public GET p95 21 ms, admin GET p95 12 ms, admin POST p95
    119 ms. The slowest request was a media upload at 1.2 s. All inside
    `quality-bar.md`.
  - Usage: public traffic is mostly `/` and scanners. `/posts/sunset` was
    read 3 times. Admin traffic is the owner only.
  - Auth events since 09-16: 8 `login_succeeded`, 26 `login_failed`, 2
    `login_rate_limited`, 59 `request_refused`.
  - The journal is almost all scanner 404 stack traces (2,119+), so real
    errors are hard to find (F-114).
  - **Nothing broken, nothing slower than the bar, no plan items from usage**
    yet: there is one published post and no home page, so there is not yet
    any traffic to learn from.
  - Re-read these signals after the owner chooses a home page and publishes
    real content.

## Migrations

- **Two database roles (item 15a, D152).** `npm run db:migrate` connects as the
  owner `habre_cms` through `DATABASE_OWNER_URL`; the running app connects as
  `habre_cms_app` through `DATABASE_URL`. The owner bypasses row-level
  security, the app role does not.
  **Before the first deploy that carries `0010`:** (1) run `db/roles.sql` once
  on the server as `postgres`, with a newly generated password
  (`psql -v ON_ERROR_STOP=1 -d habre_cms -v app_password=... -f db/roles.sql`);
  (2) in `/etc/habre-cms/production.env` set `DATABASE_OWNER_URL` to today's
  `DATABASE_URL` value, then point `DATABASE_URL` at `habre_cms_app` with that
  password; (3) rehearse `0010` and `0011` on a restored production backup -
  both carry real rows. **Once `0011` has run, a symlink rollback is
  impossible** - the previous release reads `users.role` - the same as `0009`.
  Take a backup first.
- **2026-09-30, production:** `0007_blocks_v3.sql` (item 10) applied at
  22:20 UTC by `db/migrate.ts` from the not-yet-live release
  `/srv/habre-cms/releases/135bd1d`, run as `habre_cms` against
  `/etc/habre-cms/production.env`. Backed up first: a fresh run of
  `habre-cms-backup.service` uploaded `habre_cms-20260930T222050Z.dump` (23426
  bytes) just before. Drops and re-adds `entries_blocks_format_check` to allow
  `v2` and `v3`; no row is rewritten (3 entries, all `v2`). Reversible only
  before any page is saved as `v3`: re-add the check as `in ('v2')` and delete
  the `schema_migrations` row - not rehearsed on production. Verified after:
  `schema_migrations` lists `0007`; the constraint reads `v2`/`v3`; the live
  release `5bd0d29` kept serving (`/healthz` ok, `/` 200) until the switch.

- **2026-09-28, production:** `0006_site_settings_home_page.sql` (item 9)
  applied at 22:45:53 UTC by `db/migrate.ts` from the not-yet-live release
  `/srv/habre-cms/releases/bded549`, run as `habre_cms` against
  `/etc/habre-cms/production.env`. Backed up first: a fresh run of
  `habre-cms-backup.service` uploaded `habre_cms-20260928T224508Z.dump`
  (22299 bytes) to R2 just before. Purely additive: `alter table site_settings
  add column home_page_id uuid references entries (id) on delete set null` -
  nullable, no backfill (null means "no home page chosen"). Reversible:
  `alter table site_settings drop column home_page_id` plus deleting its
  `schema_migrations` row - rehearsed on development inside a rolled-back
  transaction, not run on production. Verified after: `schema_migrations`
  lists `0006`; `home_page_id` is `uuid`, nullable, FK `on delete set null`;
  the one `site_settings` row has it null. **The live release (`8d6afba`)
  names its `site_settings` columns and never reads `home_page_id`**, so it
  keeps running unchanged: `/healthz` on both hostnames through Caddy ->
  `{"status":"ok","database":"up"}`, `https://surenmaharjan.fyi/` -> 200.
  Schema first, code after: **this deploys nothing** - `current` still points
  at `8d6afba`; `bded549` is on disk, not switched to. Because the column is
  additive and nullable, a symlink rollback to `8d6afba` after the item 9
  deploy still works.
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

1. **`monitor`** - re-read the signals now that F-114 keeps scanner 404s out
   of the journal, and again once a home page is chosen and real content is
   published.
2. **No queued build item** - `ideate --rescope` or a fresh `spec` decides
   what's next; a page builder is the recorded direction.
3. **Three of the four accepted risks from the 2026-09-23 deploy are still
   open** (R2 credential separation, R2 custom domain, screen-reader/keyboard
   pass); CSP was closed by `security-hardening`. The owner's plan is "after
   the MVP", which is now.
4. `ci` would close F-17 by giving CI a PostgreSQL service.

## Open / not done

- **CI runs 115 of the 141 browser tests** (F-17 fixed 2026-10-01, closed by
  `review`): the new `e2e` job. **The other 26 upload to R2 and skip
  in CI** (`E2E_SKIP_R2=1`) - image blocks, the picker, the logo, image + text -
  so run `npm run test:e2e` locally with the real `.env` before a deploy. A fake
  R2 server would bring them into CI (needs an optional `R2_ENDPOINT` in
  `r2.server.ts`); not built. `e2e` is not yet a *required* check (`needs-you.md`).
- **No alerting on a failed backup** - the heartbeat is built but
  `BACKUP_HEARTBEAT_URL` is deliberately unset (owner's decision); a failed
  backup tells nobody.
- **Accessibility never checked by hand** - three separate `needs-you.md`
  lines (editor, admin shell, public site), all still open, **all explicitly
  accepted as risk by the owner for the 2026-09-23 deploy** - the plan is to
  do this after the MVP. WCAG 2.2 AA is the project's own recorded bar.
- **9 findings in the live ledger** (2026-09-29), none above P2: 7 P2 open,
  2 P2 fixed awaiting a re-check (F-72, F-115). **39 more in
  `blueprint/findings/backlog.md`.**
- **No staging** environment; single server, down until noticed (UptimeRobot
  covers "noticed" for the admin hostname only - F-113).
- **Monitoring gaps** (`monitor`, 2026-09-29):
  - **No UptimeRobot check on the public hostname** (F-113).
  - **No error alerting.** Errors reach only the journal - no longer
    drowned by scanner 404s since F-114 went live in `5bd0d29`, but nobody
    is told when one appears. No error tracker, by plan decision.
  - **No alert on a failed backup** (above).
  - **No latency or disk alerts.** Both are far below any limit today.
  - **Alerts go to one email address, with no escalation.**
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

**The `e2e` job, by hand** (needs Docker; Node 26; no `.env` needed):

    docker run -d --name ci-db -e POSTGRES_PASSWORD=ci-superuser-password -p 127.0.0.1:5433:5432 postgres:16-alpine
    docker exec -i -e POSTGRES_USER=postgres -e HABRE_DB_PASSWORD=ci-app-password -e HABRE_APP_DB_PASSWORD=ci-app-role-password ci-db sh -s < db/dev/init.sh
    export DATABASE_OWNER_URL=postgres://habre_cms:ci-app-password@127.0.0.1:5433/habre_cms
    export DATABASE_URL=postgres://habre_cms_app:ci-app-role-password@127.0.0.1:5433/habre_cms
    npm run db:migrate
    export JWT_SECRET=$(openssl rand -base64 32) R2_ACCOUNT_ID=ci R2_ACCESS_KEY_ID=ci \
      R2_SECRET_ACCESS_KEY=ci R2_BUCKET=ci R2_PUBLIC_URL=https://r2.invalid E2E_SKIP_R2=1 CI=1
    npx playwright install chromium && npm run test:e2e   # 115 passed, 26 skipped

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

- **Of the three accepted risks still open from the 2026-09-23 deploy, do
  the R2 credential separation first** - it is small (a new Cloudflare
  token/bucket) and closes a real gap. The screen-reader pass is bigger and has been deferred since item 1;
  it deserves a dedicated session rather than being squeezed in.
- **Give CI a fake R2 server** so all 141 browser tests run there, not 115.
  F-17's database part is done; the 26 uploading tests still depend on someone
  running the suite locally with real R2 before a deploy.
- **This file is getting long and increasingly chronological** (a preflight
  entry, a migration entry, two deploy entries, each with its own detail).
  Worth a light restructure next time it's touched - collapse older deploy
  detail into shorter lines and keep only the most recent release's full
  evidence at that level of detail.
