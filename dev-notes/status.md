# Status

**Read this first** after a break or a cleared context. It answers "where is
this, and what should I do next" without needing to read the whole repository.

For the live view - which build steps are ticked, what git says, what has
drifted - run `progress` instead. This file is the slower-moving picture:
what has been verified, and what is known to be missing.

The `docs` skill maintains it.

## Where this stands

**Goal:** a CMS non-technical editors can run a website with. 8 build items; item
1 and item 2a are shipped, `main` is at `8800f97` and in sync with origin, and
the working tree is clean.

**Production** serves `https://cms.surenmaharjan.fyi` from release `52c2670` -
**login only**. Item 2a's code and its `entries` table are **not** there: the next
deploy must run `migrate` for `0002_entries.sql` before shipping the release.
Until item 4, the apex `surenmaharjan.fyi` serves nothing.

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

1. **`spec` item 2b** (inline formatting: bold, italic, links as structured runs,
   moving `blocks_format` to `v2` with a migration) - or item 3 (posts list)
   first if that is wanted sooner.
2. **`deploy`** whenever item 2a should be live: `migrate` for `0002_entries.sql`
   against production **first**, then the release.
3. `ci` would close F-17 by giving CI a PostgreSQL service.

## Open / not done

- **Nothing of item 2a is in production.** Writing works in development only.
- **Browser tests gate nothing** (F-17): CI runs `verify` only, and the tests
  covering item 2a's P0 and both P1s are in the Playwright suite.
- **No alerting on a failed backup** - the heartbeat is built but
  `BACKUP_HEARTBEAT_URL` is deliberately unset (owner's decision); a failed
  backup tells nobody.
- **Accessibility never checked by hand** (F-18) - now also covering the editor's
  two popovers, which is where the real WCAG risk sits.
- **20 findings in the ledger**, none blocking: F-15 P1 accepted by the owner
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

    npm run verify            # typecheck, lint, 110 unit tests, build
    npm run test:e2e          # 25 browser tests; needs docker compose up -d
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
