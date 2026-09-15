# Status

**Read this first** after a break or a cleared context. It answers "where is
this, and what should I do next" without needing to read the whole repository.

For the live view - which build steps are ticked, what git says, what has
drifted - run `progress` instead. This file is the slower-moving picture:
what has been verified, and what is known to be missing.

The `docs` skill maintains it.

## Where this stands

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

_Nothing yet._

## Open / not done

Known gaps, untested paths, and things deliberately deferred. **Be honest here** -
this section is the one that saves time later, and it only works if it is
complete.

_Nothing yet._

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
