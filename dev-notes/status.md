# Status

**Read this first** after a break or a cleared context. It answers "where is
this, and what should I do next" without needing to read the whole repository.

For the live view - which build steps are ticked, what git says, what has
drifted - run `progress` instead. This file is the slower-moving picture:
what has been verified, and what is known to be missing.

The `docs` skill maintains it.

## Where this stands

**Production runs release `52c2670` (2026-09-16), and login works.** Deployed at
`https://cms.surenmaharjan.fyi`; the first release `48e5052` shipped with F-21
(every form POST rejected behind Caddy) and this one fixes it. **An admin account
exists and the owner has logged in**, so item 1 is proven working in production.

- **Second deploy, `52c2670`:** built from a clean clone of `main` (never on the
  server), `npm ci` -> `npm run verify` passed -> `npm run build` ->
  `npm ci --omit=dev`, rsynced to `/srv/habre-cms/releases/52c2670`, `current`
  repointed, service restarted. **No migration** - this release changes no
  schema. **CI never ran on this commit:** `main` has not been pushed, and CI
  runs on push, so the checks that gated it ran only on the dev machine.
- **Verified through the public URL:** `/healthz` `{"status":"ok","database":"up"}`
  · `/admin/login` 200 · a POST with a browser-shaped `Origin: https://...`
  reaches the action and comes back as the form's own error (6951 bytes), logged
  `login_failed` with the real client IP - **F-21 fixed in production, and F-07's
  `X-Forwarded-For` proven again here**. Under the previous release the same
  request returned an 11-byte "Bad Request".
- **F-22 answered:** Caddy overwrites client-supplied `X-Forwarded-Host` and
  `X-Forwarded-Proto` - forging either changes nothing (evidence in the ledger).
- **Previous release:** `48e5052`, still on disk. **Rollback** is
  `sudo ln -sfn /srv/habre-cms/releases/<sha> /srv/habre-cms/current && sudo systemctl restart habre-cms`,
  which takes seconds and needs no rebuild.
- **Uptime monitoring live, 2026-09-16 (`monitor`).** The owner created an
  UptimeRobot account and an HTTP(s) monitor on
  `https://cms.surenmaharjan.fyi/healthz`, 5-minute interval, alerting by email,
  with a keyword check on `"database":"up"` so a 200 carrying the wrong body
  still counts as down. `/healthz` queries the database and answers 503 when it
  is unreachable, so this watches the app *and* PostgreSQL, from outside the box
  - a checker on the server could never report the server being off.
  **Delivery is proven, by accident and then by design:** the first monitor was
  pointed at `surenmaharjan.fyi`, which genuinely serves nothing until item 4,
  and the down alert arrived by email. Endpoint measured at the same time: 200
  on three consecutive checks, 0.11-0.23 s, against a 500 ms p95 bar;
  certificate valid to 2026-12-14. **SSL expiry alerting** covers renewal
  failing silently - the old `site-check` timer that used to do this was deleted
  with the test site.
  **This partly repairs the accepted F-15** (archived as
  `trust-forwarded-proto/F-15`): up/down and certificate expiry are now covered.
  **Still uncovered:** a failed backup tells nobody (the heartbeat ping is not
  built), application errors reach only the journal (no error tracker - a v1
  decision), disk filling has no signal, and there is no escalation beyond one
  person's inbox.
  **Add a second monitor on `https://surenmaharjan.fyi/` when item 4 ships** -
  not before, or it alerts on every check.
- **Caddy access log, 2026-09-16:** `/var/log/caddy/habre-cms-access.log`, JSON,
  rolled at 10 MB keeping 3 - the only signal for "is anyone using this", since
  the app logs security events rather than requests. It also carries per-request
  timings (`/healthz` 302 ms, `/admin/login` 43 ms on the first two entries).
  **It records visitor IPs and user agents**, which is the only visitor data this
  project stores; `quality-bar.md` otherwise says nothing about visitors is kept.
  **Trap found while installing it:** `sudo caddy validate` creates the log file
  as root, and Caddy runs as `caddy`, so the reload then fails with "permission
  denied" - Caddy keeps the old config and the site stays up, so the only symptom
  is a failed reload. `setup-server.sh` now creates the file as `caddy:caddy`
  first.
- **Backup heartbeat, 2026-09-16:** `backup-db.sh` pings `$BACKUP_HEARTBEAT_URL`
  only after the dump has verified and the bucket has confirmed its size, so a
  missed ping is what raises the alarm. **The URL is not set yet**, and the job
  says so on every run: `no BACKUP_HEARTBEAT_URL set - nothing is watching this
  job`. To finish: create an UptimeRobot **Heartbeat** monitor with a period just
  over 24 h, then add `BACKUP_HEARTBEAT_URL=...` to `/etc/habre-cms/backup.env`
  (root-only, never the repository - whoever holds that URL can fake a healthy
  backup). A failed ping after a good backup logs a warning and does **not** fail
  the job.
- **Restore proven 2026-09-16 (F-16).** The newest dump was restored into a
  scratch database and **the app was started against it**: `/healthz` healthy, a
  wrong password gave the form error, the right password gave 302 to `/admin`.
  The scratch database and its throwaway account were dropped afterwards. A
  restore onto a **fresh server** - D9's under-an-hour rebuild - is still
  untested.
- **Production was down for about a minute on 2026-09-16, by accident.** During
  the first restore attempt a cleanup `pkill -u habre_cms -f 'node server.js'`
  matched the live server as well as the scratch one; SIGTERM looks like a clean
  exit, so `Restart=on-failure` did not bring it back and the service sat
  `inactive` until `systemctl start`. No data was involved and nobody was using
  the site. **Two lessons worth keeping:** kill by the PID you started, never by
  pattern, on a machine running the real thing; and nothing would have told
  anyone - exactly the gap F-15 describes, demonstrated by accident.
- **Rollback drill run 2026-09-16, and it works.** Rolled production back to
  `48e5052` (**5 s**) and confirmed the old code was really serving, not just a
  moved symlink: the login POST came back as the 11-byte "Bad Request" that
  release is known for, while `/healthz` stayed `{"status":"ok","database":"up"}`.
  Rolled forward to `52c2670` (**3 s**): the same POST returned the 6951-byte
  form error again and `/admin/login` 200. **No migration was involved**, so
  neither direction had a schema to reconcile - a release that adds one cannot be
  rolled back this simply, and F-19 (forward-only migrations) is why.

**First deploy, 2026-09-16 (superseded by `52c2670` above; kept as the record):**

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
- **An admin account now exists, and the owner logged in through
  `https://cms.surenmaharjan.fyi/admin/login` on 2026-09-16** (reported by the
  owner). That is item 1 working end to end in production, in a real browser:
  F-21 is closed on evidence rather than on a curl approximation. The command
  below is how to add another.
- **Superseded:** *No admin account exists yet* - create one on the server with:
  `sudo -u habre_cms bash -c "cd /srv/habre-cms/current && /usr/local/bin/node --env-file=/etc/habre-cms/production.env scripts/create-admin.ts --email you@example.org --name 'Your Name'"`
  It prompts for the password twice. Logging in works now that F-21 is fixed.
- **Rollback:** the mechanism exists and is still **untested** - no rollback has
  been performed. Releases kept on disk: `48e5052`, `52c2670`.

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
