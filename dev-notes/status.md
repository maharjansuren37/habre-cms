# Status

**Read this first** after a break or a cleared context. It answers "where is
this, and what should I do next" without needing to read the whole repository.

For the live view - which build steps are ticked, what git says, what has
drifted - run `progress` instead. This file is the slower-moving picture:
what has been verified, and what is known to be missing.

The `docs` skill maintains it.

## Where this stands

**First production deploy, 2026-09-16: release `48e5052` (`main`, item 1 admin
login) is live at `https://cms.surenmaharjan.fyi` - and its one feature does not
work.** See F-21 (P0): behind Caddy the app thinks its origin is `http://`, so
every form POST, login included, is rejected with 400. Read-only pages are fine.
The release was left running deliberately (no users, no content, and it is what
the fix will be verified against); the next deploy carries the fix.

- **Deployed:** commit `48e5052`, built from a clean clone of `main` in a scratch
  directory (never on the server, never from the working tree), `npm ci` ->
  `npm run verify` passed -> `npm run build` -> `npm ci --omit=dev`, copied by
  rsync to `/srv/habre-cms/releases/48e5052` (53 MB), `current` symlink
  repointed, service restarted.
  **Caveat: CI does not publish artifacts, so this is a local build of the commit
  CI tested - same source, a different build.**
- **Migration:** `0001_users.sql` applied to production by `migrate` on
  2026-09-16, after a fresh backup (`habre_cms-20260916T015818Z.dump`). Re-run
  prints "No pending migrations." `users` and `schema_migrations` exist with the
  columns, unique email index and role check from the plan. Forward-only: the
  reverse is restoring a dump (F-19).
- **Verified through the public URL** (not localhost): `/` 200 · `/healthz`
  `{"status":"ok","database":"up"}` · `/admin/login` 200 · `/admin` without a
  cookie 302 to the login page with `redirectTo` · unknown path 404 · http 308 to
  https · `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` present
  (no CSP yet, deliberate) · **login POST 400 - F-21**.
- **No admin account exists yet.** Create one on the server with:
  `sudo -u habre_cms bash -c "cd /srv/habre-cms/current && /usr/local/bin/node --env-file=/etc/habre-cms/production.env scripts/create-admin.ts --email you@example.org --name 'Your Name'"`
  It prompts for the password twice. Logging in only works once F-21 is fixed.
- **Rollback:** untested, and there is no previous release to go back to. The
  mechanism is `ln -sfn /srv/habre-cms/releases/<sha> /srv/habre-cms/current`
  then `systemctl restart habre-cms`; it becomes real on the second deploy.
- **Previous release:** none. Releases kept on disk: `48e5052`.

**Hosting (host, 2026-09-16, branch `host/production`):** decided, not
provisioned. Production only, on `ocwebserver`; backups to a private R2 bucket
(D21). **Server provisioned 2026-09-16** by `deploy/setup-server.sh` (run
twice; the second run fixed Node and changed nothing else). No release deployed,
no account created. Next: `deploy` (needs `preflight` first), and the nightly
backup script and timer once the private R2 bucket exists - `preflight` blocks
on backups.

- **Verified on the server, 2026-09-16:**
  - Node v26.8.2 runs (`/opt/node-v26.8.2-linux-x64`, linked into
    `/usr/local/bin`). The first run left it broken - the official build needs
    `libatomic1`, which minimized Ubuntu lacks; the script now installs it and
    runs `node --version` before finishing.
  - PostgreSQL 16.15: `listen_addresses=localhost` (listening on
    127.0.0.1:5432 only), `shared_buffers=128MB`, `max_connections=20`. Role
    `habre_cms` (not superuser, no createrole/createdb) owns database
    `habre_cms`, PUBLIC access revoked; login with `DATABASE_URL` from the env
    file succeeds.
  - `/etc/habre-cms` root:habre_cms 750; `production.env` habre_cms:habre_cms
    600, holding `DATABASE_URL` and `JWT_SECRET` (names checked, values never
    printed).
  - `habre-cms.service` enabled, not started (no release). `/srv/habre-cms`
    habre_cms 750.
  - Caddy: one `import /etc/caddy/sites/habre-cms.caddy` line, config valid (the
    backup the script took was removed in the test-site cleanup below).
    `https://surenmaharjan.fyi` and `www` still 200. `https://cms.surenmaharjan.fyi`
    has a Let's Encrypt production certificate (issuer `YE2`, expires
    2026-12-14; Caddy renews it) and returns 502 until a release runs.
  - From outside: ports 3000 and 5432 still dropped.
  - Memory after setup: ~554 MB available (was 596 MB).
  - `sysstat` came in as a PostgreSQL recommended package; its service is
    inactive.
- **Test sites removed, 2026-09-16** (owner ran the removal script; checked
  afterwards): `/srv/redpanda`, `/srv/shelf`, `/etc/hone`, the `site-check`
  timer and files, the red panda and hone access logs, hone's certificate and
  the old Caddyfile backups are gone. `/srv` holds only `habre-cms`. The
  Caddyfile is only the `habre-cms` import (valid, Caddy active; one backup kept
  at `/etc/caddy/Caddyfile.bak-remove-redpanda-20260915215406`). Certificates
  for `surenmaharjan.fyi` and `www` were kept for the CMS public site.
  `https://surenmaharjan.fyi` now serves nothing; `cms` still returns 502 with
  its certificate.
- **Decided by `architect`, 2026-09-16 (D22):** public site on
  `surenmaharjan.fyi`, admin on `cms.surenmaharjan.fyi` (still `/admin`), one app
  routing by host; `PUBLIC_URL`/`ADMIN_URL` replace `APP_URL`. Built in item 4,
  which also adds the apex and `www` to `habre-cms.caddy`. Until then production
  runs on `cms` only with `APP_URL`.
- **Backups working, 2026-09-16:** `deploy/backup-db.sh` (installed as
  `/usr/local/sbin/habre-cms-backup`) with `habre-cms-backup.service` and a
  `.timer` at 02:30 UTC nightly (`Persistent=true`, enabled, next run listed by
  `systemctl list-timers`). It runs `pg_dump --format=custom` over the local
  socket as `postgres` (no password to hold), rejects and deletes a dump that
  fails `pg_restore --list`, uploads with `curl --aws-sigv4` (no S3 client
  installed), re-reads the object's size from the bucket, writes
  `/var/lib/habre-cms/last-backup`, and keeps 7 days of local copies.
  Credentials: `/etc/habre-cms/backup.env`, root-only - **not** the app's file,
  so an app compromise cannot reach the backups. Evidence: one manual run ->
  `habre_cms-20260915T231515Z.dump`, 2019 bytes, listed in the bucket at the
  same size; unit result `success`.
- **Restore not yet proven, and cannot be until item 1 deploys:** the production
  database has **0 tables** (migrations have never run there), so the dump is an
  empty database and a restore restores nothing. After `deploy` runs migrations,
  repeat: restore the newest dump into a scratch database and start the app
  against it. `preflight` should not count backups as proven until then.
- **Nothing alerts when a backup fails** (OWASP A09). A failed timer is silent:
  the failure only shows in `systemctl list-timers` and the journal. For
  `monitor` to close - the cheapest options are an UptimeRobot heartbeat the job
  pings on success, or a check that reads `/var/lib/habre-cms/last-backup`.
- **R2 (images), 2026-09-16:** the owner's development credentials are in the
  local `.env`; checked by host - listing the bucket 200, listing all buckets
  403, so the token is bucket-scoped. `R2_PUBLIC_URL` is still empty, and
  production needs its own token (both in `needs-you.md`).
- **Not verified yet:** that Caddy's `X-Forwarded-For` reaches the app as
  expected (F-07) - needs a running release.

- **Server inventory, 2026-09-16:** Ubuntu 24.04.4, 596 MB RAM available, 41 GB
  disk free. Missing: `node`, `git`, `psql`/`pg_dump`. `rsync` was missing and
  was installed by the owner the same day (3.2.7, checked with `rsync --version`
  on the server), so `deploy` copies files with rsync over SSH. Present: Caddy (active, admin on
  127.0.0.1:2019), `curl`, `openssl`, `tar`, `xz`. Unattended upgrades on. SSH
  key-only (`passwordauthentication no`; `permitrootlogin without-password`).
  Host firewall allows only 22, 80, 443; ports 3000 and 5432 also time out from
  outside, so Oracle's security list drops them too. Port 3000 is free. Caddyfile
  serves only `surenmaharjan.fyi`; `/srv/shelf` exists and is not in it.

- **Cost:** $0/month today, if `ocwebserver` is on Oracle's Always Free tier
  (unconfirmed; idle Always Free VMs can be reclaimed). R2 is free up to 10 GB
  stored, 1M writes and 10M reads a month; UptimeRobot's free plan is for
  non-commercial use.
- **Secrets (production), by name:** `DATABASE_URL` (password generated on the
  server), `JWT_SECRET` (generated on the server; rotating it logs everyone out),
  `R2_*` (item 5, entered by the owner), plus the backup bucket's token. All in
  `/etc/habre-cms/production.env`, mode 600. No rotation schedule set; rotate on
  suspected leak or when someone with server access leaves.
- **Checked from outside, 2026-09-16:** ports 22, 80 and 443 answer; 5432 and
  3000 time out (dropped upstream). `http://cms.surenmaharjan.fyi` returns 308 to
  https; https fails TLS (no Caddy site block yet).

## Verified

What has actually been proven to work, and how it was proven. Not what should
work.

- **Item 1, admin login** - `verify` at ship time on `81a3480`: every done-when
  passed (login p95 0.191 s, light/dark screenshots at 1280 and 390 px).
  Archived in `blueprint/history/features/01-admin-login.md`.
- **Every README command, run 2026-09-16 by `docs`:** `docker compose up -d`;
  `npm run db:migrate` -> "No pending migrations."; `npm run verify` -> passed
  (typecheck, lint, 40 unit tests, build); `npm start` -> `/` 200,
  `/healthz` `{"status":"ok","database":"up"}`, `/admin/login` 200;
  `npm run test:e2e` -> **12 passed** in 11.9 s.
- **CI** - green on `main` for all three pushes (latest `35023825857`, item 1).
- **Production server** - provisioned and checked; see *Where this stands*.
- **Nightly backup** - one manual run dumped, verified, uploaded; the object is
  in the bucket at the same size.

## Open / not done

Known gaps, untested paths, and things deliberately deferred. **Be honest here** -
this section is the one that saves time later, and it only works if it is
complete.

- **Nothing is deployed.** 1 of 8 build items done; the public site, the editor
  and everything else are unbuilt. `preflight` on 2026-09-16 said **no-go for
  real users**.
- **Open findings** (`blueprint/context/findings.md`): F-15 P1 nothing alerts on
  failure - **deferred by the owner to `monitor`** (2026-09-16), so it does not
  block `deploy` · F-16 P2 backup never restored · F-17 P2 browser tests never run
  automatically · F-18 P2 accessibility never checked by hand · F-19 P3 no
  migration reverse policy · F-20 P3 root SSH login allowed. F-14 (README) is
  `fixed`, awaiting a `preflight` re-check. F-07 `fixed`, F-13 `unverified`.
- **The browser tests are the only cover for login's real behaviour, and CI does
  not run them** - they need a database. Run `npm run test:e2e` before a release.
- **`npm run create-admin -- --help` crashes** with an unhandled
  `ERR_PARSE_ARGS_UNKNOWN_OPTION` stack trace instead of printing the usage line
  it already has (`scripts/create-admin.ts:16`). Cosmetic, unspecced; worth a
  small fix item.
- **No Content-Security-Policy** until item 5 lands - deliberate, recorded in the
  plan with that trigger.
- **No staging environment** (D21), and no rollback has ever been performed.
- **`R2_PUBLIC_URL` is empty** and production has no R2 token yet - both needed
  by item 5.
- **No `CHANGELOG.md`** - deliberate: nothing is released and nobody else runs
  this. `docs` writes it from `blueprint/history/` at the first release.
- **No licence and no privacy policy** - not distributed, no public accounts.
  Both become real before anyone outside the organisation uses it.

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
