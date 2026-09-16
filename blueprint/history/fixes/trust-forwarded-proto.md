# Fix: Trust Caddy's forwarded protocol so logins work in production

**Type:** Fix
**Status:** built, awaiting review
**Fixes:** F-21 (P0, `blueprint/context/findings.md`)

## Goal

Make the app build `request.url` from the proxy's `X-Forwarded-Proto`, so that
behind Caddy it knows its own origin is `https://cms.surenmaharjan.fyi`. Today it
sees the plain-http connection from Caddy on 127.0.0.1, decides its origin is
`http://...`, and React Router aborts every form submission whose `Origin` header
says `https://` - which is every real browser. Login is impossible in production
(evidence in F-21: `POST /admin/login` -> 400 before any of this project's code
runs).

## In scope

- Building the Node request listener with `trustProxy` enabled.
- Taking `@remix-run/node-fetch-server` as a direct dependency, pinned, with a
  decision entry - it is already in the tree as `@react-router/node`'s own
  dependency, but importing it directly makes it ours.
- A regression test that fails without the fix: a request carrying
  `X-Forwarded-Proto: https` reaches the action instead of being refused.
- Updating F-21 to `fixed` with evidence.

## Out of scope

- **Proving it in production.** That is `deploy`, then `verify`, after this ships.
- **Making CI run the browser tests** (F-17) - the regression test added here
  lands in the Playwright suite, which CI still does not run. Its own fix.
- The Content-Security-Policy (item 5), and anything about the D22 hostname
  split (item 4). This change is only about the scheme the app believes it is
  serving on.

## Build steps

- [x] **Step 1 - Build the listener with `trustProxy`** - in `server/app.ts`,
  replace `createRequestListener` from `@react-router/node` with
  `createRequestHandler` from `react-router` wrapped in `createRequestListener`
  from `@remix-run/node-fetch-server`, passing `{ trustProxy: true }`. Add
  `"@remix-run/node-fetch-server": "0.14.1"` to `dependencies` (the version
  already installed; pinned, no caret). Keep the `#app/lib/env.server.ts` import
  that makes the server refuse to start misconfigured.
  *Done when:* `npm run verify` passes; `npm run build` then `npm start` still
  serves `/` 200 and `/healthz` `{"status":"ok","database":"up"}`; a local
  `curl -X POST http://127.0.0.1:3000/admin/login -H 'X-Forwarded-Proto: https'
  -H 'Origin: https://127.0.0.1:3000' -d 'email=a@b.co&password=wrongpassword'`
  is **not** answered with React Router's "origin does not match" 400 (a 403 from
  this project's own check is the expected answer here, because `APP_URL` is
  http locally - the point is that the request now reaches our code).

- [x] **Step 2 - Regression test behind a simulated proxy** - add a second
  `webServer` entry to `playwright.config.ts` on port 3101 started with
  `APP_URL=https://127.0.0.1:3101`, and `e2e/forwarded-proto.spec.ts` using
  Playwright's `request` context against it: (a) a POST to `/admin/login` with
  `X-Forwarded-Proto: https` and `Origin: https://127.0.0.1:3101` reaches the
  action - it comes back as the login form's own "email or password is wrong"
  400, or a 302, never the CSRF abort; (b) the same POST with
  `Origin: https://evil.example` is still refused with 403 and logs
  `request_refused`; (c) a GET `/healthz` on that server answers 200, proving it
  started.
  *Done when:* `npm run test:e2e` passes all three plus the existing 12; and the
  new test is shown to **fail** with the Step 1 change reverted (paste the
  failure) - a test that cannot fail proves nothing.

- [x] **Step 3 - Record the dependency and close the finding** - add `D23` to
  `dev-notes/decisions.md` (why the direct dependency: the React Router wrapper
  exposes only `build`, `getLoadContext` and `mode`, so `trustProxy` cannot be
  passed through it; what it costs: one more pinned dependency to upgrade in step
  with `@react-router/node`, and an app that now trusts `X-Forwarded-*`, which is
  only safe because it listens on 127.0.0.1 and nothing but Caddy can reach it).
  Note the same in `AGENTS.md`'s stack list if it names the dependencies. Mark
  F-21 `fixed` with the evidence from steps 1 and 2.
  *Done when:* `npm run verify` passes; F-21 reads `fixed` with a Resolution line
  naming the commands and their output.

## Files and areas

- `server/app.ts` - the listener (the whole change).
- `package.json` / `package-lock.json` - the pinned dependency.
- `playwright.config.ts`, `e2e/forwarded-proto.spec.ts` - the regression test.
- `dev-notes/decisions.md`, `blueprint/context/findings.md` - the record.
- **Not** `server.js`, `app/root.tsx` or `app/lib/same-origin.ts`: this
  project's own CSRF check is correct and stays as it is.

## Data and contracts

No schema change, no migration, no stored shape touched.

Load-bearing behaviour this locks in: `request.url` is derived from
`X-Forwarded-Proto` and `X-Forwarded-Host` when present, so every later item that
compares an origin - the D22 hostname split in item 4 especially - can rely on
`new URL(request.url).origin` being the public origin, not the proxy hop.

## Testing

- Unit: none - this is configuration, not logic.
- Browser/integration: step 2's three cases, in the Playwright suite.
- Existing `e2e/auth.spec.ts` (12 tests) must stay green: they run without any
  forwarded headers, so they prove the non-proxied path still works.
- Manual, after deploy: a real login through `https://cms.surenmaharjan.fyi`.

## Notes

- **Quality bar:** this is a security-relevant path. The bar's line "CSRF:
  SameSite cookie plus an origin check" must still hold after the change -
  step 2(b) is what proves it.
- `trustProxy` also makes the client address come from `Forwarded` /
  `X-Forwarded-For`. `app/features/auth/client-ip.ts` reads the header itself and
  is unchanged; do not rewrite it in this fix.
- React Router 8.3.1 is newer than training data. The authority is
  `node_modules/@remix-run/node-fetch-server/README.md:152` (trustProxy) and
  `node_modules/@react-router/node/dist/index.js:23-28`, which shows the wrapper
  passing no options through.
- Production currently runs release `48e5052` with this bug. The next `deploy`
  ships the fix and is also the first real test of the rollback mechanism.

## Findings

### trust-forwarded-proto/F-21 [P0] closed - Nobody can log in to production: every form POST is rejected behind the proxy

**File:** server/app.ts:5 (`createRequestListener({ build })`)
**Found:** 2026-09-16 by deploy (production verification of `48e5052`)
**Why it matters:** Caddy terminates HTTPS and proxies to the app over plain http on 127.0.0.1, so the app builds `request.url` as `http://cms.surenmaharjan.fyi/...` while a browser sends `Origin: https://cms.surenmaharjan.fyi`. React Router aborts the action before any of this project's own code runs: *"The `request.url` origin does not match `origin` header from a forwarded action request."* Login is the only feature item 1 has, and in production it is impossible - the deployed release is read-only. Evidence: `POST /admin/login` with the real https `Origin` -> **400** with that error in the journal; the same POST with a spoofed `http` origin gets past React Router and is then correctly refused by this project's own check -> 403 `request_refused`. Nothing caught it earlier because the browser tests run over http on 127.0.0.1 with no proxy, where the scheme matches (see F-17).
**Suggested fix:** `spec` then `build`. The installed `@remix-run/node-fetch-server` supports `trustProxy: true` (also `protocol`/`host` overrides), documented in `node_modules/@remix-run/node-fetch-server/dist/lib/request-listener.d.ts` as trusting `Forwarded`, `X-Forwarded-Host`, `X-Forwarded-Proto` and `X-Forwarded-For` - **but `@react-router/node`'s `createRequestListener` accepts only `build`, `getLoadContext` and `mode`** (`node_modules/@react-router/node/dist/index.d.ts:8-12`), so the option cannot be passed through it. The spec should check the installed React Router 8.3.1 docs for the supported route - most likely building the listener from `@remix-run/node-fetch-server` with React Router's `createRequestHandler` and `trustProxy: true`, since the app is only ever reached through Caddy on 127.0.0.1. A test that exercises a request with `X-Forwarded-Proto: https` belongs with the fix, or nothing will catch a regression.
**Resolution:** Repaired 2026-09-16 by build on `fix/trust-forwarded-proto`. `server/app.ts` now builds the listener from `@remix-run/node-fetch-server` 0.14.1 (pinned, direct dependency) with `trustProxy: true`, wrapping React Router's `createRequestHandler` - D23 records why the `@react-router/node` wrapper could not be used. Evidence, on clean servers with no reuse: with the fix, `POST /admin/login` carrying `X-Forwarded-Proto: https` and an https `Origin` returns the login page with its own "That email and password don't match." error (6951 bytes) and logs no CSRF abort; with `trustProxy` reverted the same request returns the 11-byte "Bad Request" and logs `origin does not match`. `e2e/forwarded-proto.spec.ts` covers three cases and **was shown to fail when the fix is reverted** (`Expected substring: "That email and password don't match." / Received string: "Bad Request"`). `npm run test:e2e` 15 passed; `npm run verify` passes. Two flaws in the test setup were fixed to make that proof trustworthy: Playwright reused servers from previous runs (`reuseExistingServer` now `false`), and it starts web servers **before** `globalSetup`, so a build placed there ran too late - the build is back in the first server's command and the second waits for it. **Still unproven in production:** the release running there is `48e5052`, without this fix. Status `fixed`, for `review` to re-examine and `deploy` to prove.
Closed 2026-09-16 by review (scope: current; base `main` `0329dff`). Re-examined the repaired code rather than the repair's own account of it: `server/app.ts` passes `trustProxy` to the listener that builds `request.url`, which `node_modules/@remix-run/node-fetch-server/dist/lib/request-listener.js:301-303` reads exactly as claimed; `createRequestHandler` is called without `mode`, which defaults to `NODE_ENV` - the same value the old `@react-router/node` wrapper passed, so development and the browser tests are unchanged; the dev path (`server.js:101`, Vite `ssrLoadModule`) loads the same module, so both paths got the fix. `npm run verify` passes, `npm run test:e2e` 15 passed, `npm audit --omit=dev` 0 vulnerabilities, and the lockfile holds one copy of the new dependency. The repair introduced one new issue, filed separately as F-22 rather than left inside this entry. **Production still runs `48e5052` without the fix - closing this says the code is right, not that the live site is.**

### trust-forwarded-proto/F-14 [P1] closed - The README is still the scaffolder's boilerplate

**File:** README.md:1
**Found:** 2026-09-16 by preflight (first-release audit)
**Why it matters:** It opens `# Project Name` with the template's "replace everything down to How this project is built" comment. Anyone picking this up - including a future session - gets no description of the project and no proven way to run it, and `docs --check` has never run. The commands further down were never executed as written.
**Suggested fix:** `docs` - write the README against the real repository and run every command in it.
**Correction to the finding:** narrower than first reported. Only the title, the template comment and the one-line description were boilerplate; the setup and build commands were already real.
**Resolution:** Repaired 2026-09-16 by `docs`. The README is now titled *Habre CMS*, says what it is and who it is for, states honestly that nothing is deployed, adds a *Deploying it* section describing `deploy/`, notes that `verify` excludes the browser tests, and keeps the pointer to `AGENTS.md`. **Every command in it was run, in this order:** `docker compose up -d`; `npm run db:migrate` -> "No pending migrations."; `npm run verify` -> passed; `npm start` -> `/` 200, `/healthz` `{"status":"ok","database":"up"}`, `/admin/login` 200; `npm run test:e2e` -> 12 passed in 11.9 s. `npm run create-admin` was checked against `scripts/create-admin.ts:16-22` - the documented `--email` and `--name` flags are the ones it accepts (it cannot be run non-interactively here, as it prompts for a password). Status set to `fixed` so `preflight` re-checks and closes it.
Closed 2026-09-16 by a `preflight` re-check of the evidence, at the user's direction at the `ship` gate: the README opens `# Habre CMS` with a real description, neither template marker (`Project Name`, "Replace everything") appears anywhere in it, and every `npm run` command it names - `build`, `create-admin`, `db:migrate`, `dev`, `test:e2e`, `verify` - resolves to a script that exists in `package.json`. Those commands were also executed when the repair was made, with their output recorded above.

### trust-forwarded-proto/F-15 [P1] accepted - Nothing tells anyone when the live system breaks

**File:** blueprint/context/quality-bar.md:38 (Availability: "down until noticed, **but an uptime check alerts the owner**")
**Found:** 2026-09-16 by preflight (first-release audit)
**Why it matters:** Three silent failures have no watcher. (1) No uptime check exists - the UptimeRobot account is still open in `needs-you.md`, so nothing polls `/healthz` and the project misses its own availability bar. (2) Nothing watches certificate expiry: the `site-check` timer that did this for the old static site was deleted on 2026-09-16 with it, and Caddy's renewal failing is an outage with a date on it. (3) A failed backup is silent - `habre-cms-backup.service` failing shows only in the journal, so the first sign would be an empty bucket at restore time. OWASP Top 10:2025 A09 Logging & Alerting Failures.
**Suggested fix:** `monitor`, after the user creates the UptimeRobot account: a check on `/healthz` for both hostnames with email alerts, certificate expiry alerting, and a heartbeat the backup job pings on success (or a check that reads `/var/lib/habre-cms/last-backup`).
**Accepted by the user, 2026-09-16**, asked directly at the `ship` gate and answered "accept it, with the reason". **Their reason:** they will create the UptimeRobot alert themselves when `monitor` runs, and the site has no users and no content until then, so an outage nobody is told about costs nothing today. Accepted as a timing decision, not as a permanent state - **it must be revisited before anyone relies on this site**, and the risk below is what is being accepted meanwhile.
**Deferred by the user, 2026-09-16:** the owner will create the UptimeRobot alert when `monitor` runs, so this does not block `deploy`. It stays `open` and P1: until it is done, a deployed site can be down, a certificate can fail to renew and a backup can fail with nobody told. **Re-read before anyone relies on this site** - deploying with no watcher is a knowingly-accepted gap for a site with no content and no users, not a state to leave it in afterwards.

