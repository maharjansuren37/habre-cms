# Status

**Read this first** after a break or a cleared context. It answers "where is
this, and what should I do next" without needing to read the whole repository.

For the live view - which build steps are ticked, what git says, what has
drifted - run `progress` instead. This file is the slower-moving picture:
what has been verified, and what is known to be missing.

The `docs` skill maintains it.

## Where this stands

**Goal:** a CMS non-technical editors can run a website with. 8 build items;
items 1, 2 (2a and 2b), 3, and now 4 (4a, 4b, 4c - the hostname split) are
shipped. `main` is at `4165637` and in sync with origin.

**Production** now answers **two hostnames**: `https://cms.surenmaharjan.fyi`
(admin) and `https://surenmaharjan.fyi` (public site, live for the first
time), both from release `4165637` (deployed 2026-09-21) - **items 1, 2a, 2b,
3, 4a, 4b and 4c, all of it.** The previous release, `0ad8300`, was items 1-3;
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

## Next

1. **Item 4 is fully shipped and deployed** - `spec` item 5 (Images) next, or
   `monitor` to check the public site's UptimeRobot check reflects the new
   hostname.
2. `ci` would close F-17 by giving CI a PostgreSQL service.
3. A full `docs` regeneration of this file is due - this entry records the
   item-4 deploy only; the "Done"/"Open" sections below still describe the
   state through item 3.

## Open / not done

- **Browser tests gate nothing** (F-17): CI runs `verify` only, and the tests
  covering every item's worst defects are in the Playwright suite.
- **No alerting on a failed backup** - the heartbeat is built but
  `BACKUP_HEARTBEAT_URL` is deliberately unset (owner's decision); a failed
  backup tells nobody.
- **Accessibility never checked by hand** (F-18) - now also covering the editor's
  two popovers, which is where the real WCAG risk sits.
- **30 findings in the ledger**, none blocking: F-15 P1 accepted by the owner
  (no alerting until `monitor`); the rest are P2/P3 or unverified leads.
- **No CSP** until item 5; **no staging**; single server, down until noticed.
- Waiting on the owner (`needs-you.md`): R2 public URL and a production R2 token
  (item 5), the screen-reader pass, deleting the stale `hone` DNS record.

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

    npm run verify            # typecheck, lint, 148 unit tests, build
    npm run test:e2e          # 39 browser tests; needs docker compose up -d
    curl -sS https://cms.surenmaharjan.fyi/healthz

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

_None yet._
