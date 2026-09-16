# Findings

> **Generated file.** The findings ledger: review findings raised by the `review`
> skill against the work in progress, each with a durable ID, a severity (P0-P3),
> and a status. `build` marks a repaired finding `fixed`; only a later `review`
> pass moves it to `closed`. **A finding no code fixes** - raised by `preflight`
> or `host`, such as missing backups or a leaked secret - is marked `fixed` with
> evidence by whichever skill repairs it, and `preflight` re-checks and closes it.
> `ship` refuses to merge while any P0 or P1 finding
> is `open` or `fixed`, then archives resolved findings with the work item and
> resets this file.

### F-21 [P0] open - Nobody can log in to production: every form POST is rejected behind the proxy

**File:** server/app.ts:5 (`createRequestListener({ build })`)
**Found:** 2026-09-16 by deploy (production verification of `48e5052`)
**Why it matters:** Caddy terminates HTTPS and proxies to the app over plain http on 127.0.0.1, so the app builds `request.url` as `http://cms.surenmaharjan.fyi/...` while a browser sends `Origin: https://cms.surenmaharjan.fyi`. React Router aborts the action before any of this project's own code runs: *"The `request.url` origin does not match `origin` header from a forwarded action request."* Login is the only feature item 1 has, and in production it is impossible - the deployed release is read-only. Evidence: `POST /admin/login` with the real https `Origin` -> **400** with that error in the journal; the same POST with a spoofed `http` origin gets past React Router and is then correctly refused by this project's own check -> 403 `request_refused`. Nothing caught it earlier because the browser tests run over http on 127.0.0.1 with no proxy, where the scheme matches (see F-17).
**Suggested fix:** `spec` then `build`. The installed `@remix-run/node-fetch-server` supports `trustProxy: true` (also `protocol`/`host` overrides), documented in `node_modules/@remix-run/node-fetch-server/dist/lib/request-listener.d.ts` as trusting `Forwarded`, `X-Forwarded-Host`, `X-Forwarded-Proto` and `X-Forwarded-For` - **but `@react-router/node`'s `createRequestListener` accepts only `build`, `getLoadContext` and `mode`** (`node_modules/@react-router/node/dist/index.d.ts:8-12`), so the option cannot be passed through it. The spec should check the installed React Router 8.3.1 docs for the supported route - most likely building the listener from `@remix-run/node-fetch-server` with React Router's `createRequestHandler` and `trustProxy: true`, since the app is only ever reached through Caddy on 127.0.0.1. A test that exercises a request with `X-Forwarded-Proto: https` belongs with the fix, or nothing will catch a regression.

### F-14 [P1] fixed - The README is still the scaffolder's boilerplate

**File:** README.md:1
**Found:** 2026-09-16 by preflight (first-release audit)
**Why it matters:** It opens `# Project Name` with the template's "replace everything down to How this project is built" comment. Anyone picking this up - including a future session - gets no description of the project and no proven way to run it, and `docs --check` has never run. The commands further down were never executed as written.
**Suggested fix:** `docs` - write the README against the real repository and run every command in it.
**Correction to the finding:** narrower than first reported. Only the title, the template comment and the one-line description were boilerplate; the setup and build commands were already real.
**Resolution:** Repaired 2026-09-16 by `docs`. The README is now titled *Habre CMS*, says what it is and who it is for, states honestly that nothing is deployed, adds a *Deploying it* section describing `deploy/`, notes that `verify` excludes the browser tests, and keeps the pointer to `AGENTS.md`. **Every command in it was run, in this order:** `docker compose up -d`; `npm run db:migrate` -> "No pending migrations."; `npm run verify` -> passed; `npm start` -> `/` 200, `/healthz` `{"status":"ok","database":"up"}`, `/admin/login` 200; `npm run test:e2e` -> 12 passed in 11.9 s. `npm run create-admin` was checked against `scripts/create-admin.ts:16-22` - the documented `--email` and `--name` flags are the ones it accepts (it cannot be run non-interactively here, as it prompts for a password). Status set to `fixed` so `preflight` re-checks and closes it.

### F-15 [P1] open - Nothing tells anyone when the live system breaks

**File:** blueprint/context/quality-bar.md:38 (Availability: "down until noticed, **but an uptime check alerts the owner**")
**Found:** 2026-09-16 by preflight (first-release audit)
**Why it matters:** Three silent failures have no watcher. (1) No uptime check exists - the UptimeRobot account is still open in `needs-you.md`, so nothing polls `/healthz` and the project misses its own availability bar. (2) Nothing watches certificate expiry: the `site-check` timer that did this for the old static site was deleted on 2026-09-16 with it, and Caddy's renewal failing is an outage with a date on it. (3) A failed backup is silent - `habre-cms-backup.service` failing shows only in the journal, so the first sign would be an empty bucket at restore time. OWASP Top 10:2025 A09 Logging & Alerting Failures.
**Suggested fix:** `monitor`, after the user creates the UptimeRobot account: a check on `/healthz` for both hostnames with email alerts, certificate expiry alerting, and a heartbeat the backup job pings on success (or a check that reads `/var/lib/habre-cms/last-backup`).
**Deferred by the user, 2026-09-16:** the owner will create the UptimeRobot alert when `monitor` runs, so this does not block `deploy`. It stays `open` and P1: until it is done, a deployed site can be down, a certificate can fail to renew and a backup can fail with nobody told. **Re-read before anyone relies on this site** - deploying with no watcher is a knowingly-accepted gap for a site with no content and no users, not a state to leave it in afterwards.

### F-16 [P2] open - The backup has never been restored

**File:** deploy/backup-db.sh:1
**Found:** 2026-09-16 by preflight (first-release audit)
**Why it matters:** The quality bar promises at most 24 h of data loss and a rebuild in under an hour, and both rest on a restore nobody has performed. The mechanism is proven as far as it can be today - one run dumped, verified with `pg_restore --list`, uploaded, and the object's size was re-read from the bucket - but production's database has **0 tables** (migrations have never run there), so the dump is an empty database and restoring it proves nothing about the schema the code needs. Not a P1 only because there is no content to lose yet; it becomes one the moment anyone writes a post.
**Suggested fix:** `host`, immediately after the first `deploy` runs migrations: restore the newest dump into a scratch database and start the app against it (the dump is mode 600 root, so copy it for the `postgres` user first), then record the evidence here.

### F-17 [P2] open - The browser tests that cover login never run automatically

**File:** .github/workflows/ci.yml, package.json:22 (`verify` = typecheck, lint, unit tests, build)
**Found:** 2026-09-16 by preflight (first-release audit)
**Why it matters:** `e2e/auth.spec.ts` holds 10 tests covering the item-1 behaviours nothing else asserts end to end - rate limiting, the cross-site refusal, deactivated users, session revocation, logout. They need a database, CI has none, and `verify` excludes them, so they run only when someone remembers locally. A regression in any of those reaches `main` with every gate green.
**Suggested fix:** `ci` - add a job with a PostgreSQL service container that runs `npm run test:e2e`, or state in `AGENTS.md` that these are a manual pre-release gate and run them as part of `deploy`.

### F-18 [P2] open - Keyboard and screen-reader behaviour has never been checked

**File:** blueprint/context/design.md (Accessibility bar: WCAG 2.2 AA, listed unchecked)
**Found:** 2026-09-16 by preflight (first-release audit)
**Why it matters:** The project holds itself to WCAG 2.2 AA, and the only two screens that exist - `/admin/login` and the admin shell - have never been driven by keyboard alone or heard through a screen reader. No automated check hears what is announced; the open line in `needs-you.md` has been there since item 1's spec. Contrast was measured in `design.md`, so this is about focus order, focus visibility, labels and announcements.
**Suggested fix:** The user, from item 1's `verify --manual` walkthrough (NVDA, VoiceOver or Orca); `verify` records the result and closes the `needs-you.md` line.

### F-19 [P3] open - The one migration has no reverse, and nothing says that is intended

**File:** db/migrations/0001_users.sql:1
**Found:** 2026-09-16 by preflight (first-release audit)
**Why it matters:** The runner applies `.sql` files forward only and no migration carries a down path. That is a defensible choice for a project whose rollback story is "restore the backup", but it is nowhere recorded, so the next person adding a destructive migration has no stated policy to follow and may assume one exists.
**Suggested fix:** `migrate` or a decision entry - write the policy down (forward-only, reverse by restore) or add down paths. Then this becomes an accepted risk rather than an omission.

### F-20 [P3] open - Root can still log in over SSH with a key

**File:** ocwebserver `/etc/ssh/sshd_config` (`permitrootlogin without-password`)
**Found:** 2026-09-16 by preflight (first-release audit)
**Why it matters:** Password authentication is off and the firewalls are tight, so this is a hardening gap rather than a hole: any key in root's `authorized_keys` is a direct root session with no sudo record. Deploys use the `ubuntu` user with sudo and never need root over SSH.
**Suggested fix:** `host`, with the user's yes: set `PermitRootLogin no`, reload `sshd`, and confirm the `ubuntu` session still works before closing the old one.

### F-07 [P3] fixed - Without X-Forwarded-For every login shares one rate-limit bucket

**File:** app/features/auth/client-ip.ts:10
**Found:** 2026-09-15 by review (scope: current; lens: security)
**Why it matters:** A request with no `X-Forwarded-For` is keyed as `unknown`. If production ever receives requests without it (a Caddy config that strips it, or the app reachable other than through Caddy), all visitors share one IP bucket and 20 failed logins from anyone lock everyone out for 15 minutes. Caddy's `reverse_proxy` sets the header by default, so this depends on deployment config not yet written - hence unverified.
**Suggested fix:** `host`: confirm the Caddy site file sets `X-Forwarded-For` and the app stays on 127.0.0.1; `preflight` checks it. Optionally log a warning once when a login arrives without the header in production.
**Resolution:** Partly repaired 2026-09-16 by build (spec step "Repair F-07"). The login action warns once per process, in production only, when a login arrives without `X-Forwarded-For`. Evidence: production build, two logins without the header -> exactly one warning line; a fresh process, a login with the header -> none; `npm run verify` exit 0. The finding's main check stays open for `host`/`preflight`: confirm the Caddy site file sets the header and the app listens only on 127.0.0.1. Status set to `fixed` so `preflight` re-checks and closes it.
Code part re-checked 2026-09-16 by independent review (reviewer agent): production build, 2 logins without the header (one 302, one 400) -> the warning exactly once, with no request data. Stays `fixed`: `preflight` closes it after `host` confirms the Caddy site file sets `X-Forwarded-For` and the app listens only on 127.0.0.1.
Deployment evidence, 2026-09-16 by deploy (release `48e5052`): a POST to `/admin/login` through `https://cms.surenmaharjan.fyi` was logged as `{"event":"request_refused",...,"ip":"180.150.113.140"}` - the real client address, not `127.0.0.1` and not `unknown`, so Caddy's `reverse_proxy` does set `X-Forwarded-For` and the app reads it correctly. The app binds `127.0.0.1` only (`server.js:10`), and ports 3000 and 5432 are dropped from outside. Both halves now have evidence; `preflight` can close this.

### F-13 [P3] unverified - One host with a routed IPv6 /48 still gets tens of thousands of rate-limit keys, so it can hold both password slots

**File:** app/features/auth/client-ip.ts:28 (`/64` key), app/features/auth/login-rate-limit.server.ts:25 (`createInFlightLimit(2)`); F-11's accepted residual
**Found:** 2026-09-16 by review (scope: current; lens: security)
**Why it matters:** F-11's accepted residual named only "an attacker with many IPv4 addresses (~600-1800 per 15 min)". Per-/64 keys give one machine with a routed /48 65,536 keys (~1.3 M counted attempts per 15 min) - a /48 is free from IPv6 tunnel brokers and standard at many hosts - far above the 600-1800 keys needed to keep both scrypt slots busy (a /56 gives 256 keys, 5,120 attempts: short of that but a large budget). So the slot-holding attack that makes real logins get 503 needs one machine, not a botnet, if the CMS hostname is reachable over IPv6; that reachability is the unverified part (`host` has not recorded it). The residual was accepted on an understated description. OWASP Top 10:2025 A06 Insecure Design.
**Suggested fix:** Correct F-11's residual wording to "many IPv4 addresses, or one IPv6 /48 if the CMS is served over IPv6" and have the user re-confirm. `host`: record whether the CMS hostname has an AAAA record; the cheapest mitigation is serving it over IPv4 only. Otherwise accept explicitly, or also count failures under a /48 key with a higher limit.
**Resolution:** Checked 2026-09-16 by build: `cms.surenmaharjan.fyi` is a CNAME to `surenmaharjan.fyi`, which has A `161.33.89.75` and no AAAA, so the hostname does not resolve over IPv6 today. Still unverified: DNS is not an access control - if the VPS has a public IPv6 address and Caddy listens on it, a client can connect to that address directly with the CMS hostname. `host` must check `ip -6 addr` on `ocwebserver` and Caddy's bind addresses, and note that an AAAA added to the root domain also applies to `cms` through the CNAME.
Evidence from the user, 2026-09-16, on `ocwebserver`: `ip -6 addr show scope global` is empty and there is no IPv6 default route; Caddy listens on `*:443` and `*:80` with no `bind`. With no public IPv6 address and no AAAA record, the CMS cannot be reached over IPv6, so the /48 attack is not possible on today's deployment. It becomes valid again if the VM gets IPv6; recorded for `host` in `project-plan.md` section 8 (put `bind 0.0.0.0` in `habre-cms.caddy`, or re-check this finding then). Status left `unverified`: marking it `invalid` is a `review` verdict or the user's call, not build's.
