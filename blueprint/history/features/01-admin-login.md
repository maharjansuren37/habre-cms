# Feature: Admin login

**From build plan:** item 1
**Type:** Feature
**Status:** in progress

## Handoff (2026-09-15, end of autopilot build..review)

**Goal:** ship item 1 (admin login) from branch `feature/admin-login`.

**Done** - all 13 build steps and "Repair F-01" ticked, 12 checkpoint commits
`3c1917b..dfc0c88` on the branch (nothing merged, pushed or deployed):
- `env -u JWT_SECRET -u APP_URL npm run verify` -> exit 0, 62/62 unit tests
- `npm run test:e2e` (with `JWT_SECRET` exported) -> 7/7
- `verify` on `81a3480`: every done-when passed (evidence in the conversation;
  login p95 0.191 s, screenshots light/dark at 1280/390)
- `review current` wrote `findings.md`: F-01 P1 `fixed` (413 before reading
  bodies > 8 KB; RSS 112 -> 114 MB under 3x100 MB), F-02 P2 open, F-03..F-06 P3
  open, F-07 unverified

**In progress:** nothing mid-edit. The F-02..F-12 repairs are uncommitted on the branch.

**Next:**
1. ~~Independent review~~ - done 2026-09-16 (reviewer agent): F-01 `closed`;
   new **F-08 [P1]** (concurrent logins bypass rate limits) and **F-09 [P2]**
   (scrypt burst stalls public requests) - see `findings.md`.
2. ~~Repair F-08 + F-09~~ and ~~F-02..F-07~~ - built 2026-09-16, all
   `fixed`, uncommitted. `verify` exit 0 (67 unit tests), `test:e2e` 12/12.
   `.env.example` is back to blank `APP_URL=` (user approved the F-06 repair).
3. ~~Second independent review~~ - done 2026-09-16: F-02..F-06, F-08, F-09
   `closed`; F-07 stays `fixed` for `host`/`preflight`. New, none blocking
   `ship`: F-10 [P3] (DB error counts as a failed login - 3-line repair
   suggested before ship), F-11 [P2 unverified] (2 busy slots lock out logins;
   accept or key IPv6 by /64 - user's call), F-12 [P3] (e2e shares one IP).
4. ~~Repair F-10..F-12~~ - built 2026-09-16, all `fixed`, uncommitted;
   `verify` exit 0 (73 unit tests), `test:e2e` 12/12. F-11 keeps an accepted
   residual (IPv4 botnet can hold both password slots).
5. ~~Third independent review~~ - done 2026-09-16: F-10..F-12 `closed`. New
   F-13 [P3 unverified]: one IPv6 /48 can hold both password slots if the CMS is
   served over IPv6 - user re-confirms the F-11 residual, `host` records AAAA.
6. `ship` (separate yes to merge; another to push).

**Gotchas:**
- Cookie is `Path=/` (user-approved): `/admin` missed `/admin.data` and the
  guard and login page redirected each other in a loop.
- React Router 8.3.1 has its own action origin check (400 for page routes); the
  root middleware is still needed for resource routes like `/admin/logout`.
- Local `.env` has empty `APP_URL`/`JWT_SECRET` (in `needs-you.md`); agent runs
  pass a throwaway secret via the environment and never write `.env`.
- Starting servers for checks: use ports 3200/3300 and kill by PID or port -
  `pkill -f server.js` matches the shell itself; a bare `wait` waits on the
  server too and hangs.
- Test users go in the dev DB with `@example.test` emails; delete them after.

**Verify with:** `env -u JWT_SECRET -u APP_URL npm run verify`;
`JWT_SECRET=$(node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))") npm run test:e2e`
(needs `docker compose up -d`).

## Goal

A person with an account can log in at `/admin/login`, stay logged in for a
week, and log out. Every `/admin` request is checked against the database, so
a user who is deactivated or has had their sessions revoked loses access
immediately (D6). The first admin is created with a server command, never a web
page. Every later item builds on the guard, the user shape and the admin shell
this delivers.

## In scope

- The design tokens moving from `prototypes/theme.css` into `app/app.css`, plus
  the three shared UI pieces login needs: button, form field, message
- `users` table (full shape from the plan, so item 8 needs no schema change)
- Password hashing with `node:crypto` scrypt
- `npm run create-admin`: creates an admin from the command line
- `APP_URL` and `JWT_SECRET` validated at startup
- JWT session in an httpOnly, SameSite=Lax cookie with a fixed 7-day lifetime
- A root middleware that rejects cross-origin POST, PUT, PATCH and DELETE requests (403)
- `/admin/login`: page, action and a safe `redirectTo`
- Rate limiting of failed logins, per email and per IP
- Security event log lines for login success, failure, rate limiting and logout
- A protected admin layout (sidebar shell) with a placeholder `/admin` home page
- `/admin/logout`, which ends every session for that user
- Playwright tests for the whole flow; README and `.env.example` updated

## Out of scope

- Posts navigation and `/admin/posts` - items 2 and 3 (the sidebar has no nav
  links yet; `/admin` stays a placeholder until item 3 redirects it)
- Adding users, roles, password reset by an admin, deactivating from the UI -
  item 8. Role-based **permissions** are item 8 too. The role is loaded and
  exposed here, but no route checks it yet.
- Site title and logo in the shell - item 7 (the shell shows "Habre CMS")
- Password reset by email, sliding sessions or "remember me", MFA - deferred
  (plan section 11)
- Content-Security-Policy - item 5 (plan section 8)
- Styled 404/500 pages - the root `ErrorBoundary` stays as it is

## Design reference

- **Login:** `prototypes/login.html`: centred card, error banner at the top of
  the form, "Forgot your password? Ask an admin…" help line.
- **Admin shell:** the sidebar in `prototypes/posts-list.html`: site name, user
  name and role, Log out at the bottom. **No nav links in this item.**
- **Tokens:** `prototypes/theme.css`. **Conventions:**
  `blueprint/context/design.md` (buttons, inputs, messages, pending state,
  WCAG 2.2 AA, measured contrast).
- **Not covered by the design record** (new, add to `design.md` in step 12):
  the sidebar with no nav items and the `/admin` placeholder home page. Keep both
  plain: page title "Hello, {name}", one muted line "You're logged in as
  {role}."

## Build steps

- [x] **Step 1 - Port the design tokens** - replace `app/app.css` with the
  tokens from `prototypes/theme.css` (`:root` custom properties, `light-dark()`
  colors) plus base styles only: box-sizing, body font/color/background,
  `a` color, `:focus-visible` outline, `.visually-hidden`. No component styles.
  *Done when:* `/` renders on `--color-bg` with `--color-text` in both light and
  dark (Chromium `colorScheme` emulation, screenshot of each);
  every custom property defined in `theme.css` is defined in `app/app.css`
  (`diff <(grep -o -- '--[a-z0-9-]*:' prototypes/theme.css | sort) <(grep -o -- '--[a-z0-9-]*:' app/app.css | sort -u)`
  shows nothing missing);
  `npm run verify` passes.

- [x] **Step 2 - `users` migration** - `db/migrations/0001_users.sql` with the
  table in *Data and contracts*.
  *Done when:* `npm run db:migrate` prints `Applied 0001_users.sql`; running it
  again prints `No pending migrations.`; `\d users` in `psql` shows every column,
  the role check and the lowercase-email check; inserting `Ann@Example.org` fails
  the email check; inserting role `owner` fails the role check.

- [x] **Step 3 - Password hashing** - `app/features/auth/password.server.ts`:
  `hashPassword(plain)` and `verifyPassword(plain, stored)` using async
  `crypto.scrypt`, a random 16-byte salt, `timingSafeEqual`, and the stored
  format in *Data and contracts*. `verifyPassword` returns `false` (never throws)
  for a malformed stored value. Also export `verifyAgainstDummyHash(plain)` so an
  unknown email takes as long as a wrong password.
  *Done when:* `password.server.test.ts` passes, covering: round trip is true;
  wrong password is false; two hashes of one password differ; the parameters are
  read from the stored string (a hash made with different N still verifies);
  malformed or truncated stored values are false. Each test was seen failing
  against a deliberately broken implementation.

- [x] **Step 4 - User input rules and queries** -
  `app/features/users/user-input.ts`: Zod schemas for email (trimmed and
  lowercased), name (trimmed, 1-100 characters) and new password (12-200
  characters). `app/features/users/users.server.ts`: `createUser`,
  `findUserByEmail` and `findUserById`, raw SQL, never returning
  `password_hash` except from `findUserByEmail`, which login needs.
  *Done when:* `user-input.test.ts` passes (uppercase or padded email is
  normalised; an 11-character password is rejected with a message naming the
  minimum; an empty name is rejected); `npm run verify` passes.

- [x] **Step 5 - `create-admin` command** - `scripts/create-admin.ts` and an
  `npm run create-admin` script. Takes `--email` and `--name`. Reads the
  password twice without echoing it when run in a terminal, or once from stdin
  when piped. Validates with step 4's schemas and inserts role `admin`. Refuses
  an existing email with `A user with that email already exists.` and exits
  with code 1. Never prints the password or the hash.
  *Done when:* `npm run create-admin -- --email you@example.org --name "You"`
  creates a row with role `admin`, `token_version` 0 and a `scrypt$…` hash; the
  same command again exits 1 with the message; a mismatched confirmation or a
  short password exits 1 without inserting; `echo 'correct horse battery' | npm
  run create-admin -- …` works non-interactively.

- [x] **Step 6 - Session token and config** - install `jose` **6.2.12**
  (exact pin, lockfile committed). **Split the environment check by consumer:**
  new `app/lib/database-env.server.ts` holds the schema for `NODE_ENV` and
  `DATABASE_URL` and exports `databaseEnv`; `db.server.ts` imports only that.
  `app/lib/env.server.ts` extends that schema with `APP_URL` (URL) and
  `JWT_SECRET` (at least 32 characters) and exports `env` for the web app - no
  variable is defined twice. `server/app.ts` imports `env.server.ts` so the
  production server validates everything at startup rather than on first use.
  Move both new variables to the "read by the app now" section of
  `.env.example` (noting the scripts need only `DATABASE_URL`), with the command
  to generate a secret.
  `app/features/auth/session-token.server.ts`: `signSessionToken(claims, secret,
  now?)` and `verifySessionToken(token, secret, now?)`. HS256 only, `iss`
  `habre-cms`, 7-day expiry. Claims are validated with Zod (`sub` must be a
  UUID, `tv` a non-negative integer); anything invalid returns `null`.
  `app/features/auth/session-check.ts`: pure
  `checkSessionUser(claims, userRow)` returning the `SessionUser`, or a reason
  (`no_user` | `deactivated` | `token_revoked`).
  *Done when:* unit tests pass for: round trip; expired token → null; tampered
  payload → null; wrong secret → null; an `alg: none` token → null; non-UUID
  `sub` → null; and every `checkSessionUser` branch. `npm run build && npm start`
  with `JWT_SECRET` unset exits **at startup, before any request**, with a
  message naming `JWT_SECRET` and not printing any value. `npm run db:migrate`
  with only `DATABASE_URL` set (`env -i PATH="$PATH" DATABASE_URL=… node
  db/migrate.ts`) still succeeds.

- [x] **Step 7 - Cross-site request check** - `app/lib/same-origin.ts`: pure
  `isAllowedRequest(method, headers, appOrigin)`. GET, HEAD and OPTIONS are
  always allowed. Any other method needs `Origin` to equal the `APP_URL` origin.
  When `Origin` is absent, it needs `Sec-Fetch-Site: same-origin`; with neither
  header it is rejected. Export `middleware` from `app/root.tsx` that throws a
  403 when the check fails. This guards every future action by default.
  *Done when:* `same-origin.test.ts` covers each branch; on the running build
  (corrected during step 7, see Notes): a cross-origin POST to a **resource
  route** (`/healthz`) → `403` from this middleware, and → not 403 with it
  removed; a POST with neither `Origin` nor `Sec-Fetch-Site` → `403`; a
  same-origin POST → not 403; a cross-origin POST to a **page route** (`/`) is
  refused (`400`, by React Router's own check, which runs first); `/` and
  `/healthz` GETs are unchanged.

- [x] **Step 8 - Shared UI and the login page (no action yet)** -
  `app/lib/ui/button.tsx`, `field.tsx` and `message.tsx`, each with a
  `.module.css` using only tokens, matching the design record (primary, default
  and quiet buttons; `aria-busy` pending state; label above the input, hint and
  error linked by `aria-describedby`; error with `role="alert"` and success with
  `role="status"`). `app/features/auth/login.tsx` at `/admin/login` renders the
  mockup: email (`autocomplete="username"`), password
  (`autocomplete="current-password"`), Log in, help line. Title "Log in - Habre
  CMS".
  *Done when:* screenshots of `/admin/login` at 1280 and 390 wide, light and
  dark, match `prototypes/login.html` apart from site name and logo; the form
  works by keyboard alone (Tab order: email, password, Log in; visible focus
  ring); every input has a programmatic label (Playwright `getByLabel` finds
  both); `npm run verify` passes.

- [x] **Step 9 - Protected admin layout** -
  `app/features/auth/user-context.ts` (`createContext<SessionUser>`);
  `app/features/auth/require-user.server.ts`, a middleware that reads the
  session cookie, verifies the token, loads the user with `findUserById` and
  runs `checkSessionUser`. On success it sets `userContext`. On failure it
  redirects to `/admin/login?redirectTo=<path>` and clears the cookie.
  `app/features/admin-shell/layout.tsx` is a layout route with that middleware,
  a loader (so client navigations always hit the server - see the middleware
  docs), and `Cache-Control: private, no-store`. It renders an unstyled
  `<Outlet />` for now. `app/features/admin-shell/home.tsx` is `/admin`, showing
  the user's name. Cookie definition in `app/features/auth/session-cookie.server.ts`.
  `app/features/auth/safe-redirect.ts` - pure `safeRedirect(value)`: only paths
  starting with `/admin`, never `//` or a backslash, default `/admin`; the guard
  uses it to build `redirectTo`, login uses it to follow one.
  *Done when:* `safe-redirect.test.ts` covers `/admin/x` (kept),
  `https://evil.example`, `//evil.example`, `/\evil.example` and `/posts` (all →
  `/admin`); `curl -i http://127.0.0.1:3000/admin` with no cookie → `302` to
  `/admin/login?redirectTo=%2Fadmin`; with a garbage or expired cookie → same
  redirect plus a `Set-Cookie` clearing `habre_session`; the response carries
  `Cache-Control: private, no-store`; `npm run verify` passes.

- [x] **Step 10 - Login action** - in `login.tsx`: parse the form with Zod
  (a login schema, not the new-password rule: empty email or password gets a
  field error "Enter your email." / "Enter your password.", which reveals
  nothing); `findUserByEmail`. An unknown email runs `verifyAgainstDummyHash`; a wrong
  password or a deactivated user all return **the same** 400 message: "That
  email and password don't match. Check them and try again." On success, sign
  the token with the user's `token_version`, set the cookie, and redirect to
  `safeRedirect(redirectTo)` (step 9). Log events via `app/lib/security-log.server.ts`. The
  Log in button shows "Logging in…" with `aria-busy` while submitting. A
  logged-in visitor to `/admin/login` is redirected to `/admin`.
  *Done when:* logging in with the step 5 admin lands on `/admin` showing
  their name, and the cookie is `HttpOnly; SameSite=Lax; Path=/`, with
  `Max-Age=604800`. A wrong password, an unknown email and a deactivated user
  (`update users set deactivated_at = now()`) each show the identical message.
  The journal shows `login_failed` with a reason and no email or password.
  Login response time is under 1 s: 20 sequential successful logins via `curl
  -w '%{time_starttransfer}'`, slowest value reported (quality bar: admin
  saves < 1 s p95). The form still logs in with JavaScript disabled.

- [x] **Step 11 - Rate limiting** - `app/features/auth/rate-limiter.ts`:
  pure `createRateLimiter({ limit, windowMs, maxKeys })` with an injected clock,
  `isBlocked(key)`, `recordFailure(key)` and `reset(key)`. It prunes expired
  keys on use and never holds more than `maxKeys`.
  `app/features/auth/login-rate-limit.server.ts` holds the two instances: email
  5 failures / 15 min; IP 20 failures / 15 min. The client IP is the rightmost
  `X-Forwarded-For` value, or `unknown`. The login action checks both **before**
  running scrypt. A blocked attempt returns 429 with "Too many attempts. Wait 15
  minutes, then try again." and logs `login_rate_limited`. A success resets that
  email's counter.
  *Done when:* `rate-limiter.test.ts` covers the block at the limit, the unblock
  after the window, reset, pruning and the `maxKeys` cap (fake clock, no
  sleeps). By hand: 5 wrong passwords, then the correct one → 429 message; a
  different email from the same IP still works.

- [x] **Step 12 - Admin shell and logout** - style `admin-shell/layout.tsx`
  as the mockup sidebar: "Habre CMS" and a "View site" link; no nav list; name,
  role and a Log out button at the bottom, stacking on top below `48rem`.
  `app/features/auth/logout.ts` is `POST /admin/logout` (action only, no
  loader). It increments the user's `token_version` when the cookie is valid,
  clears the cookie, logs `logout`, and redirects to `/admin/login`. Style the
  `/admin` home page. Add the sidebar without nav items and the placeholder home
  page to `blueprint/context/design.md`.
  *Done when:* screenshots at 1280 and 390 wide, light and dark, match the
  mockup sidebar. Log out lands on the login page, and the back button to
  `/admin` redirects to login. Two browser contexts are logged in as one user;
  logging out in one sends the other to login on its next request. `GET
  /admin/logout` does not log out.

- [x] **Step 13 - Browser tests and docs** - `e2e/auth.spec.ts` plus
  `e2e/helpers/users.ts`, which creates a unique user by piping a password into
  `create-admin` and updates rows directly with `postgres`.
  `playwright.config.ts` loads `.env` when present and starts the server with
  `APP_URL=http://127.0.0.1:3100`. Tests: redirect to login and back to the
  requested page; wrong password message; deactivated user refused; a
  `token_version` bump sends a logged-in user to login; logout. The README
  covers creating the first admin and the new environment variables.
  *Done when:* `npm run test:e2e` passes, and each new test was seen failing
  once (e.g. with the guard's `token_version` check commented out); `npm run
  verify` passes; the README's first-run steps work from a fresh clone
  (migrate → create-admin → dev → log in).

- [x] **Repair F-01 - Cap the login request size** - in `login-input.ts`, a pure
  `isLoginBodySizeAllowed(headers)`: `Content-Length` must be present and at most
  8 KB (a real login is under 1 KB; a missing length means a chunked body of
  unknown size). The login action checks it before `request.formData()` and throws a
  413. `loginSchema.password` gets the same 200-character maximum as a new
  password. *Done when:* unit tests cover a small body, an 8 KB boundary, an
  oversize body and a missing length; the three-concurrent-100 MB probe leaves
  server RSS near idle and each request gets 413 quickly; `npm run test:e2e`
  still passes (JS and form logins send a `Content-Length`).

- [x] **Repair F-08 + F-09 - Count login attempts up front and cap concurrent
  password checks** - `rate-limiter.ts` gains `forgive(key)` (removes one
  counted failure). New pure `app/features/auth/in-flight-limit.ts`:
  `createInFlightLimit(max)` with `tryAcquire(): boolean` and `release()`.
  `login-rate-limit.server.ts` holds `passwordCheckSlots = createInFlightLimit(2)`
  (half of libuv's default 4 threads, so file lookups for public requests always
  have threads free). The login action, after the `isBlocked` check: if no slot
  is free, return 503 "Login is busy. Try again in a minute." and log
  `login_rate_limited` with scope `server` (no password work, nothing counted);
  otherwise record a failure for both keys **before** `findUserByEmail`, run the
  password work in `try`/`finally` that releases the slot, and on success
  `reset` the email and `forgive` the IP.
  *Done when:* unit tests cover `forgive` (one fewer failure, a no-op for an
  unknown key) and the in-flight limit (refuses at max, frees on release, never
  goes below zero), each seen failing under a mutation; probe on the production
  build: 30 concurrent wrong passwords for one email from one IP give at most 5
  responses that are neither 429 nor 503; during 100 concurrent logins from 5
  IPs, `/` answers in under 500 ms; a correct login after a failed one still
  lands on `/admin`; `npm run verify` and `npm run test:e2e` pass.

- [x] **Repair F-02 - Ctrl-C at create-admin's prompt cancels cleanly** - an
  aborted password prompt prints "Cancelled. Nothing was created." and exits
  130, with no stack trace. *Done when:* in a real pty, Ctrl-C at `Password:`
  exits within 2 s with that message and code 130; piped use still works.

- [x] **Repair F-03 - Log refused cross-site requests** - `SecurityEvent` gains
  `request_refused {reason: "cross_site", method, path, ip}`; the root
  middleware logs it before throwing 403. *Done when:* a cross-origin POST to
  `/healthz` on the build gets 403 and one `request_refused` line with no
  headers or body; `npm run verify` passes.

- [x] **Repair F-04 - Browser tests for the login limits and refusals** - in
  `e2e/auth.spec.ts`: five wrong passwords then the right one shows "Too many
  attempts."; an unknown email gets the same refusal message; a logged-in
  visitor to `/admin/login` lands on `/admin`; a cross-site POST to
  `/admin/logout` gets 403; an oversized login body gets 413.
  *Done when:* `npm run test:e2e` passes, and each new test was seen failing
  with the code it covers broken.

- [x] **Repair F-05 - Record the accessibility standard** -
  `coding-standards.md` points at WCAG 2.2 AA in `design.md`; the matching line
  in `project-overview.md` says the same. *Done when:* neither file says the
  standard is not recorded.

- [x] **Repair F-06 - Keep `.env.example` blank and record the domain** -
  `APP_URL=` blank again; the production domain `cms.surenmaharjan.fyi`
  (`APP_URL=https://cms.surenmaharjan.fyi`) recorded in the plan's Deployment
  section, `needs-you.md`'s DNS line and the overview. *Done when:* the template
  value is blank and all three name the same domain.

- [x] **Repair F-07 - Warn when production logins arrive without
  X-Forwarded-For** - the login action warns once per process, in production
  only, when the client IP is `unknown`, naming the rate-limit consequence.
  Confirming the Caddy config stays with `host`/`preflight`. *Done when:* a
  production-build login without the header logs the warning exactly once over
  two requests; one with the header logs nothing; `npm run verify` passes.

- [x] **Repair F-10 - A login that errors is not counted** - in the login
  action, a `catch` before the `finally` forgives the up-front count for the
  email and IP, then rethrows. *Done when:* a production build with
  `DATABASE_URL` pointing at a closed port answers the correct password with 500
  six times in a row (no 429); `npm run test:e2e` still passes.

- [x] **Repair F-11 - Rate-limit IPv6 clients by /64** - pure
  `rateLimitKeyForIp(ip)` in `client-ip.ts`: an IPv6 address becomes its /64
  (`2001:db8:0:1::/64`), an IPv4-mapped IPv6 address becomes the IPv4 address,
  anything else is returned unchanged. The login action keys `ipLoginLimiter`
  with it; log lines keep the full address. The residual - many IPv4 addresses, or one
  IPv6 /48 if the CMS is served over IPv6 (F-13), can still hold both password
  slots - is accepted at ~10 editors (IPv6 wording pending user re-confirmation) (the cap protects
  the public site, F-09). *Done when:* `client-ip.test.ts` covers IPv4,
  `unknown`, full and compressed IPv6, two addresses in one /64 sharing a key,
  different /64s differing, IPv4-mapped, uppercase and a zone id, each seen
  failing under a mutation; on the build, 20 failures spread over 20 addresses
  in one /64 make a 21st address in that /64 get 429.

- [x] **Repair F-12 - A fresh test address per browser test** - `e2e/auth.spec.ts`
  sets `X-Forwarded-For` per test (page tests in `beforeEach`, `request` tests
  per call), and the comment says so. *Done when:* `npm run test:e2e` passes and
  the server log shows a different address for each test's login events.

## Files and areas

- **New:** `db/migrations/0001_users.sql` · `scripts/create-admin.ts` ·
  `app/features/auth/` (`password.server.ts`, `session-token.server.ts`,
  `session-cookie.server.ts`, `session-check.ts`, `require-user.server.ts`,
  `user-context.ts`, `safe-redirect.ts`, `rate-limiter.ts`,
  `login-rate-limit.server.ts`, `login.tsx`, `logout.ts`, plus tests) ·
  `app/features/users/` (`user-input.ts`, `users.server.ts`, tests) ·
  `app/features/admin-shell/` (`layout.tsx`, `home.tsx`, CSS modules) ·
  `app/lib/ui/` (button, field, message) · `app/lib/same-origin.ts` ·
  `app/lib/security-log.server.ts` · `app/lib/database-env.server.ts` ·
  `e2e/auth.spec.ts`, `e2e/helpers/users.ts`
- **Changed:** `app/app.css` · `app/root.tsx` (middleware) · `app/routes.ts` ·
  `app/lib/env.server.ts` · `app/lib/db.server.ts` (imports `databaseEnv`) ·
  `server/app.ts` (imports `env.server.ts`) · `.env.example` · `package.json`
  and the lockfile (`jose`, `create-admin` script) · `playwright.config.ts` ·
  `README.md` · `blueprint/context/design.md`
- **Not touched:** `server.js`, `db/migrate.ts`, the public site routes.

## Data and contracts

**Load-bearing: later items depend on these; change them only with a spec.**

**`users` table** (`0001_users.sql`):

```sql
create table users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email) and email <> ''),
  name text not null check (length(name) between 1 and 100),
  password_hash text not null,
  role text not null check (role in ('admin', 'editor', 'author')),
  token_version integer not null default 0,
  deactivated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

- **IDs are UUIDs.** `entries` and `media` follow the same convention.
- **Email is stored lowercased;** "case-insensitive unique" is enforced by the
  lowercase check plus `unique`. Code normalises at the boundary (step 4).
- `role` is a text check, not a PostgreSQL enum, so item 8 or a later role
  needs no enum migration.
- `updated_at` is set by the application's `update` queries; there are no
  triggers.

**`SessionUser`** (from `app/features/auth/session-check.ts`, read by every
admin loader and action through `context.get(userContext)`):

```ts
type Role = "admin" | "editor" | "author";
type SessionUser = { id: string; email: string; name: string; role: Role };
```

**Session token:** a JWT, HS256, signed with `JWT_SECRET`. Claims:
`sub` (user id), `tv` (`token_version` at login), `iss: "habre-cms"`, `iat`,
`exp` = `iat` + 7 days. **No role in the token**: the role is always read from
the database (D6).

**Session cookie:** `habre_session`, `HttpOnly`, `SameSite=Lax`,
`Path=/`, `Max-Age=604800`. `Secure` is set when `APP_URL` is `https:`.
**`Path=/`, not `/admin`** (approved during step 10): React Router fetches the
admin home page's data from `/admin.data`, which a `/admin` path does not match, so a
JavaScript login looped between the guard and the login page. The public site
receives the cookie but never reads it.
Revoking sessions means incrementing `users.token_version`. Logout does this
here; item 8 does it for role changes, deactivation and password resets.

**Password hash string:** `scrypt$<N>$<r>$<p>$<salt base64>$<hash base64>`.
The current values are N=32768, r=8, p=3, a 16-byte salt and a 32-byte key
(OWASP's 32 MiB scrypt setting, chosen for the 954 MB server). `maxmem` is set
explicitly. Because the parameters travel with the hash, they can change later
without a migration. **Passwords are normalised to Unicode NFC before hashing** (approved
during step 3), so the same password typed on different keyboards matches; this
cannot be removed once real hashes exist.

**Security log line:** one JSON object per line on stderr, via
`logSecurityEvent(event, fields)`. It never includes an email, password, token
or hash. Events defined here: `login_succeeded {userId, ip}`,
`login_failed {reason: "unknown_email" | "bad_password" | "deactivated", userId?, ip}`,
`login_rate_limited {scope: "email" | "ip" | "server", ip}` (`server` added by the F-09 repair), `logout {userId}`, `request_refused {reason: "cross_site", method, path, ip}` (added by the F-03 repair). Item 8 adds
`role_changed`, `user_deactivated` and `password_reset` in the same shape.

**Environment:** `APP_URL` (the public origin; used for the origin check and the
cookie's `Secure` flag) and `JWT_SECRET` (at least 32 characters) become
required by the web server at startup. **Scripts need only `DATABASE_URL`:**
`db.server.ts` imports `database-env.server.ts`, never `env.server.ts`, so
`db:migrate` and `create-admin` do not require secrets they never use. Later
items add web-app variables (e.g. R2 in item 5) to `env.server.ts`; a variable
goes in `database-env.server.ts` only if the scripts need it. In development
Vite loads `server/app.ts` on the first request, so there the check runs then,
the same as today.

## Testing

- **Unit (`npm test`):** password, session token, session check, user input,
  same-origin, safe redirect, rate limiter. All are pure or take their secret and
  clock as parameters, so none need `.env` or a database, and CI's `verify`
  stays environment-free.
- **Browser (`npm run test:e2e`, needs the dev database):** `e2e/auth.spec.ts`
  as in step 13.
- **By hand, recorded as evidence:** cookie attributes, CSRF `curl` checks,
  login timing, JS-disabled login, rate limiting.
- **Not covered by automation:** a screen-reader pass over login and the shell.
  It is recorded in `needs-you.md` and is not a blocker for this item.

## Notes

- **React Router 8 middleware** is used for the origin check (root) and the
  guard (admin layout). Follow `node_modules/react-router/docs/how-to/middleware.md`,
  not memory. The admin layout needs a loader so client-side navigations run the
  server middleware.
- **React Router 8.3.1 has its own CSRF check** (found in step 7,
  `throwIfPotentialCSRFAttack`): page-route and `.data` action requests whose
  `Origin` differs from the request URL get `400` before any middleware runs. It
  does **not** cover resource routes (action-only modules such as
  `/admin/logout`), lets a request with no `Origin` through, and compares against
  the `Host`-derived URL rather than `APP_URL`. The root middleware closes all
  three, so both stay; evidence in step 7.
- **Mutations only in actions.** Logout is a POST (the React Router sessions doc
  warns that a loader logout is a CSRF hole).
- **One generic login error** for unknown email, wrong password and deactivated
  user, with similar timing (dummy hash), so the form does not reveal which
  emails have accounts.
- **Rate limiter state is in memory** and resets when the process restarts. D9
  is about disk state, so this is consistent with it; the cost is that a restart
  forgets counters. Trade-off: 5 failures can lock an email out for 15 minutes.
  That is accepted at ~10 users.
- **Client IP comes from `X-Forwarded-For`**, which is only trustworthy because
  the app listens on `127.0.0.1` behind Caddy. `host` must keep that true. In
  development the header is spoofable, which does not matter there.
- **Production `APP_URL` must be `https://`**, or the cookie loses `Secure`.
  `preflight` and `deploy` should check it; e2e runs the production build over
  http on 127.0.0.1, so the schema cannot enforce https.
- **New feature folder `app/features/admin-shell/`**: D16's list has no home for
  the admin layout, which every admin feature shares. `docs` should add a line to
  D16 when this ships.
- **`jose` is the only new dependency** and was planned (D20). No new dev
  dependencies; e2e uses the existing `postgres` driver.
- Imports use `#app/...` with extensions; server-only code is `*.server.ts`;
  logic lives in `.ts` beside a `*.test.ts` (coding standards).
- **IP addresses are logged** with login events - personal data, but the only
  way to spot a guessing attack. No emails. Journal retention is `host`'s call.
- **A database outage during login** propagates to the root `ErrorBoundary`
  (500); `/healthz` already reports it. No special handling here.
- Scrypt is async (`crypto.scrypt`, not `scryptSync`) so a login never blocks
  other requests.

## Findings

### 01/F-01 [P1] closed - An unauthenticated login request with a huge body can exhaust the server's memory

**File:** app/features/auth/login.tsx:28 (`request.formData()`), app/features/auth/login-input.ts:9 (no password maximum)
**Found:** 2026-09-15 by review (scope: current; lens: security, performance)
**Why it matters:** The login action reads the whole request body, and no layer (server.js, React Router, the action) caps its size; the login password has no maximum length either. Measured on the production build: three concurrent POSTs to `/admin/login` with a 100 MB password field took the server from 113 MB to 1522 MB RSS (about 5x the bodies' size) and each still reached the scrypt step (400 in 1.0-1.4 s). The production VPS has 954 MB of RAM shared with PostgreSQL (quality-bar.md; D14), so a few anonymous requests can get the process OOM-killed. The rate limiter cannot help: it counts only after the body is parsed. OWASP Top 10:2025 A06 Insecure Design (missing resource limit on an unauthenticated endpoint). This item introduced the first unauthenticated action that parses a body.
**Suggested fix:** Smallest in-scope repair: in the login action, refuse before parsing when `Content-Length` is absent or above a small limit (e.g. 8 KB) with 413, and give `loginSchema.password` a maximum (200, matching `newPasswordSchema`). Follow-up for `host`/item 5: a general body limit (Caddy `request_body max_size`, sized for the 10 MB upload route) so later actions are covered too.
**Resolution:** Repaired 2026-09-15 by autopilot build (spec step "Repair F-01"). `isLoginBodySizeAllowed` in login-input.ts refuses a missing, malformed or >8 KB `Content-Length`; the login action throws 413 before `request.formData()`; `loginSchema.password` max 200. Evidence: unit tests (3 new, each seen failing under a mutation); re-run probe - three concurrent 100 MB POSTs -> 413 in ~25 ms, server RSS 112 -> 114 MB (was 113 -> 1522 MB); chunked 100 MB with no length -> 413; `npm run test:e2e` 7/7 and a no-JS login still reach /admin. Not closed: repaired and re-checked by the same autopilot run - needs a review by someone else. The general body limit for later actions (Caddy `request_body`) remains a `host` follow-up.
Closed 2026-09-16 by independent review (reviewer agent, scope: current). Read `login-input.ts:25-29`, `login.tsx:32-37` (413 before `request.formData()`), password max 200. Probe on the production build (port 3200): 3 concurrent declared-100 MB POSTs -> 413 in 20-28 ms, RSS 112 -> 114 MB; 3 concurrent chunked 100 MB with no length -> 413 in 3-8 ms; 8193 bytes -> 413, 8192 bytes -> 400 with no scrypt run; 201-character password -> 400; Content-Length plus Transfer-Encoding -> 400 from Node; short Content-Length then a 5 MB body -> connection reset, RSS 116 MB. No new defect from the repair. `host` follow-up: confirm Caddy forwards `Content-Length` for HTTP/2 logins, or they get 413.

### 01/F-02 [P2] closed - Ctrl-C at create-admin's password prompt prints a stack trace and leaves the process running

**File:** scripts/create-admin.ts:67-83 (`askHidden`)
**Found:** 2026-09-15 by review (scope: current; lens: quality)
**Why it matters:** Run in a real pseudo-terminal, pressing Ctrl-C at `Password:` aborts the readline question with `ABORT_ERR`; the top-level catch prints it as "Creating the admin failed:" with a full stack, and the process was still running 15 s later (killed by the probe). No user was created. This is the command an admin runs on the server during first setup (plan section 6), where a hung shell and a stack trace read as a broken install.
**Suggested fix:** Handle the abort as a cancel: catch `ABORT_ERR` from `reader.question`, print "Cancelled. Nothing was created.", close the reader and return exit code 130; confirm with the same pty probe that the process exits promptly.
**Resolution:** Repaired 2026-09-16 by build (spec step "Repair F-02"). `scripts/create-admin.ts`: the top-level catch treats `AbortError` (Ctrl-C at a readline prompt) as a cancel - prints "Cancelled. Nothing was created." and exits 130; other errors unchanged. Evidence: pty probe (Python `pty.fork`, `\x03` at `Password:`) - before: `AbortError` stack trace, exit 1; after: the message only, exit 130 in 0.01 s. The 15 s hang did not reproduce before the fix, so its cause is unconfirmed. Piped use still works: correct password exits 0 and creates the user; an 11-character one exits 1 with the length message.
Closed 2026-09-16 by independent review (reviewer agent, scope: current, working-tree repairs). Read `scripts/create-admin.ts:91-104`. Pty probe with `\x03`: at `Password:` -> "Cancelled. Nothing was created.", exit 130 in 0.01 s; at `Password again:` -> same, 0.00 s; no stack trace, no echo, no row created. Piped use still creates a user; e2e's `createAdmin` helper passed 12/12.

### 01/F-03 [P3] closed - Refused cross-site requests are not logged

**File:** app/root.tsx:21
**Found:** 2026-09-15 by review (scope: current; lens: security)
**Why it matters:** `fundamentals.md` (Logging) requires logging "access denied"; OWASP Top 10:2025 A09 Logging & Alerting Failures. A 403 from the origin check is exactly that event, and is the one signal that someone is trying cross-site requests against the admin. React Router's own 400 for page routes is logged by its `handleError` but not in the security-log shape.
**Suggested fix:** Add a `request_refused` event (`{ reason: "cross_site", method, path, ip }` - no headers or bodies) to `SecurityEvent` and log it before throwing the 403.
**Resolution:** Repaired 2026-09-16 by build (spec step "Repair F-03"). New `request_refused {reason: "cross_site", method, path, ip}` event in `security-log.server.ts`; the root middleware logs it before throwing 403. Evidence: production build, cross-origin POST to `/healthz` carrying a session cookie -> 403 and exactly one line `{"event":"request_refused","reason":"cross_site","method":"POST","path":"/healthz","ip":"203.0.113.9"}`, no headers or cookie; `npm run verify` exit 0.
Closed 2026-09-16 by independent review (reviewer agent, scope: current, working-tree repairs). Read `app/root.tsx:21-33` and `security-log.server.ts`. Production build: POST `/healthz?token=secretq` with a cross-site Origin, a session cookie and a form body -> 403 and exactly `{"event":"request_refused","reason":"cross_site","method":"POST","path":"/healthz","ip":"203.0.113.9"}` - no query, cookie or body. POST `/admin/logout` with no headers -> 403, `ip` `unknown`. `JSON.stringify` escapes the header-derived ip, so no log-line injection.

### 01/F-04 [P3] closed - The rate limiter's wiring into login has no automated test

**File:** app/features/auth/login.tsx:31-44, e2e/auth.spec.ts
**Found:** 2026-09-15 by review (scope: current; lens: tests)
**Why it matters:** `rate-limiter.ts` is unit-tested and seen failing, but nothing automated proves the action checks the limits before scrypt, counts unknown-email and deactivated refusals, or resets on success - that was proven only by hand in build and verify. The unknown-email refusal and the "logged-in visitor to /admin/login goes to /admin" redirect are likewise manual-only. A later edit to the action could drop the limiter call and every test would stay green. (Independent review 2026-09-16: the root 403 middleware and the 413 path are not exercised by e2e either.)
**Suggested fix:** One Playwright test: five wrong passwords then the correct one from a fixed `X-Forwarded-For` shows "Too many attempts."; and extend the refusal test to cover an unknown email.
**Resolution:** Repaired 2026-09-16 by build (spec step "Repair F-04"). Five tests added to `e2e/auth.spec.ts`: unknown email gets the same refusal; five failed logins then the right password shows "Too many attempts."; a logged-in visitor to `/admin/login` lands on `/admin`; a cross-site POST to `/admin/logout` gets 403; a 9 KB login body gets 413. Evidence: `npm run test:e2e` 12 passed; with the code each covers broken at once (email `recordFailure` removed, size check disabled, loader redirect disabled, unknown-email branch throwing, middleware 403 removed) exactly those 5 failed and the original 7 passed; restored, 12 passed. Concurrent attempts are still covered only by the probe in F-08's resolution.
Closed 2026-09-16 by independent review (reviewer agent, scope: current, working-tree repairs). Read the 5 tests at `e2e/auth.spec.ts:53-110`; `npm run test:e2e` 12 passed. Traced each failure mode (no size check -> 400 not 413; no middleware -> 302 not 403; no loader redirect -> URL stays on login; no email count -> 6th attempt gets the 400 message); not re-mutated, relying on the builder's recorded mutation run. Not automated: concurrency, the IP limit, the 503 busy path. Shared test IP recorded as F-12.

### 01/F-05 [P3] closed - coding-standards.md still says no accessibility standard is recorded

**File:** blueprint/context/coding-standards.md ("Standards this project follows")
**Found:** 2026-09-15 by review (scope: current; lens: accessibility)
**Why it matters:** `design.md` (written by prototype, committed in this branch) records WCAG 2.2 AA with measured contrast, but `coding-standards.md` still reads "Accessibility: not recorded yet" and `project-overview.md` repeats it. The next `review` reading only the standards file would treat the lens as unrecorded and report it clean by omission.
**Suggested fix:** Point the line at `design.md`: "Accessibility: WCAG 2.2 AA, as recorded in blueprint/context/design.md"; regenerate the overview with `context`.
**Resolution:** Repaired 2026-09-16 by build (spec step "Repair F-05"). `coding-standards.md` now reads "Accessibility: WCAG 2.2 level AA, as recorded in blueprint/context/design.md"; the matching sentence in `project-overview.md` was edited in place (not regenerated by `context`). Evidence: `grep -n "not recorded yet\|not yet written"` finds neither line.
Closed 2026-09-16 by independent review (reviewer agent, scope: current, working-tree repairs). `coding-standards.md` names WCAG 2.2 level AA pointing at `design.md:146-148`; `quality-bar.md:49` defers to `design.md`; grep for "not recorded yet"/"not yet written" finds nothing. `project-overview.md` is generated but was hand-edited, and `project-plan.md` has no WCAG line - check the next `context` run keeps it.

### 01/F-06 [P3] closed - Uncommitted .env.example change sets APP_URL to the production origin

**File:** .env.example:11 (uncommitted working-tree change, not made by this run)
**Found:** 2026-09-15 by review (scope: current; lens: quality)
**Why it matters:** `APP_URL=cms.surenmaharjan.fyi` has no scheme, so anyone who copies the template gets a startup error on `APP_URL` (the schema requires `http(s)://`). The template is also where the plan's convention keeps values blank, with the development default in the comment. Updated 2026-09-16 by independent review: the value is now `https://cms.surenmaharjan.fyi`. It validates, but a `.env` copied from the template refuses every local login with 403, because the same-origin check compares against the production origin.
**Suggested fix:** If the production domain is decided, record it in the plan's Deployment section and `needs-you.md`'s DNS line, put `https://cms.surenmaharjan.fyi` in the production environment's config (host), and leave `APP_URL=` blank in `.env.example`.
**Resolution:** Repaired 2026-09-16 by build (spec step "Repair F-06"), with the user's go-ahead. `.env.example` has `APP_URL=` blank again (no diff against HEAD). The production domain `cms.surenmaharjan.fyi` (`APP_URL=https://cms.surenmaharjan.fyi`) is recorded in `project-plan.md` section 8, `needs-you.md`'s DNS line and `project-overview.md`'s Domain line. Setting it in the production config is `host`'s.
Closed 2026-09-16 by independent review (reviewer agent, scope: current, working-tree repairs). `git diff HEAD --quiet -- .env.example` reports no change (line 11 `APP_URL=`). `cms.surenmaharjan.fyi` appears in `project-plan.md:343-345`, `needs-you.md:75`, `project-overview.md:180`, and in no template value.

### 01/F-08 [P1] closed - Concurrent login attempts bypass both rate limits

**File:** app/features/auth/login.tsx:41-62 (limits checked before `await`, failures recorded after scrypt)
**Found:** 2026-09-16 by review (scope: current; lens: security)
**Why it matters:** `isBlocked` runs before the password check, but `recordFailure` runs only after `findUserByEmail` and scrypt finish, so every request arriving while earlier ones are still in flight passes the check. Probe on the production build: 30 concurrent wrong passwords for one email from one IP -> all 30 got 400 (limit 5), the next got 429; 100 concurrent -> all 100 got 400 (email limit 5, IP limit 20). One client gets as many guesses per window as it can send at once, which breaks spec step 11 and is the only defence against online password guessing. OWASP Top 10:2025 A07 Authentication Failures.
**Suggested fix:** Count the attempt before the password work: call `recordFailure()` for both keys right after the `isBlocked` check, before `findUserByEmail`/scrypt. Keep `emailLoginLimiter.reset(email)` on success; if a success should not count against the IP limit, add a small `forgive(key)` that decrements. Add a unit or e2e check that N concurrent attempts yield at most `limit` non-429 responses.
**Resolution:** Repaired 2026-09-16 by build (spec step "Repair F-08 + F-09"). The login action records a failure for the email and IP before `findUserByEmail`/scrypt; on success it resets the email and calls the new `ipLoginLimiter.forgive(ip)`. Evidence: `forgive` unit tests (2 new, each seen failing under a mutation); probe on the production build with the F-09 cap lifted to isolate this fix: 30 concurrent wrong passwords for one email from one IP -> 5x 400, 25x 429, next attempt 429 (reviewer saw 30/30 before). With the real cap: 2x 400, 28x 503. A wrong then a correct password -> 400 then 302 `/admin`. `npm run verify` exit 0 (67 unit tests); `npm run test:e2e` 7/7. No e2e test for concurrency was added (still F-04's gap).
Closed 2026-09-16 by independent review (reviewer agent, scope: current, working-tree repairs). Read `login.tsx:43-75`: `isBlocked`, `tryAcquire` and both `recordFailure` calls run with no `await` between them; the 429 and 503 paths return before counting or taking a slot; `finally` releases the slot. Probes (production build, restarted between probes): 30 concurrent wrong passwords, one email and IP -> 2x 400, 28x 503, next -> 400 (3rd failure); 10 workers for 4 s on one email, a new IP per request -> exactly 5x 400, 4260x 429, 370x 503; one IP with 19 failures, then 2 correct logins (302, 302), a 20th wrong (400), then a correct one -> 429, so a success forgives only its own count; 5 wrong for an email then the correct password from a new IP -> 429. The up-front count introduced F-10 (P3), which does not reopen the bypass.

### 01/F-09 [P2] closed - A burst of anonymous logins stalls every public request, including static assets and /healthz

**File:** app/features/auth/password.server.ts:111 (`crypto.scrypt`), server.js:57 (`stat` on every GET)
**Found:** 2026-09-16 by review (scope: current; lens: performance)
**Why it matters:** `crypto.scrypt` and `fs.stat` share libuv's thread pool (4 threads by default), and `serveStatic` calls `stat` on every GET before routing, so queued scrypt jobs delay every request. Probe on the production build (12-core dev machine): 100 concurrent logins from 5 IPs at 20 each (inside the limits) -> `/` took 4.29 s (baseline 0.002 s); 100 from one IP -> `/`, a hashed CSS asset and `/healthz` each took 4.52 s. Quality bar: public pages < 500 ms p95; the 2-vCPU VPS will likely be worse. Fixing F-08 lowers the cost per IP, but a handful of addresses still stall the site. OWASP Top 10:2025 A06 Insecure Design.
**Suggested fix:** A small global cap on in-flight password checks in the login action (e.g. a counter in `login-rate-limit.server.ts`): above ~4 in flight, return the existing 429 without running scrypt. Optionally raise `UV_THREADPOOL_SIZE` in the systemd unit (`host`). Re-run the probe and confirm `/` stays under 500 ms.
**Resolution:** Repaired 2026-09-16 by build (spec step "Repair F-08 + F-09"). New pure `in-flight-limit.ts`; `passwordCheckSlots = createInFlightLimit(2)` (half the default thread pool). A login arriving with both slots busy gets 503 "Login is busy. Try again in a minute." with no password work, logged as `login_rate_limited` scope `server`; the slot is released in `finally`. Evidence: unit tests (3 new, each seen failing under a mutation). Probe on the production build, `/` timed by a separate curl process: 100 concurrent logins from 5 IPs -> `/` max 0.132 s with the cap, vs 4.735 s with the cap lifted. Not covered: a sustained flood (100 workers, a new IP per request, ~1100 requests/s for 3 s) still slows `/` to median 0.26 s, max 0.59 s, because every refused request still renders the login page. That is general request volume, not the thread pool; a `host` follow-up (a Caddy request rate limit on `/admin/login`). UV_THREADPOOL_SIZE unchanged.
Closed 2026-09-16 by independent review (reviewer agent, scope: current, working-tree repairs). Read `login-rate-limit.server.ts`, `in-flight-limit.ts`. 100 concurrent logins from 5 IPs -> 2x 400, 98x 503, `/` max 161 ms (baseline median 9 ms). Sustained 3.5 s floods, `/` timed from a separate process: logins with a new IP each at 1166 req/s -> `/` median 186 ms, p95 344 ms; plain `GET /` at 1613 req/s -> median 61 ms, max 103 ms. The remaining slowdown is general request volume, not the thread pool, but a refused login costs about 3x a page view (body parse, full render, synchronous log line). Unverified on the 2-vCPU VPS. `host` caveat: standard Caddy builds have no rate-limit directive (`caddy-ratelimit` is a third-party module needing a custom build). The cap's cost to login availability is F-11.

### 01/F-10 [P3] closed - A database error during login counts as a failed attempt, so retrying through an outage locks the user out

**File:** app/features/auth/login.tsx:59-66 (`recordFailure` before `checkCredentials`, no undo when it throws)
**Found:** 2026-09-16 by review (scope: current; lens: security, quality)
**Why it matters:** The F-08 repair counts every attempt before `findUserByEmail`, and only a success takes the count back. If `checkCredentials` throws (database down, query error), the 500 still leaves a failure on the email and the IP. Probe: production build on port 3300 with `DATABASE_URL` pointed at a closed port; the correct password 6 times -> `500 500 500 500 500 429`, and a 7th from another IP -> 429. The lock lasts 15 minutes after the database recovers; before the repair, errors were never counted. OWASP Top 10:2025 A10 Mishandling of Exceptional Conditions.
**Suggested fix:** A `catch` before the `finally` in `login.tsx`: `emailLoginLimiter.forgive(form.email); ipLoginLimiter.forgive(ip); throw error;`. The count still holds while the check is in flight (F-08 stays fixed), and an error never verifies a password, so no guess is gained. Re-run the outage probe and expect 500 on all six.
**Resolution:** Repaired 2026-09-16 by build (spec step "Repair F-10"). `login.tsx`: a `catch` before the `finally` forgives the up-front count for the email and the IP key, then rethrows; the count still holds while the check is in flight, so F-08 is unaffected. Evidence: production build with `DATABASE_URL` pointed at `127.0.0.1:5999` - the correct password 6 times from one IP -> `500 500 500 500 500 500`, a 7th from another IP -> 500 (the review saw `500x5, 429` before). `npm run verify` exit 0 (73 unit tests); `npm run test:e2e` 12 passed. No automated test covers the outage path.
Closed 2026-09-16 by independent review (reviewer agent, scope: current, F-10..F-12 repairs). The only call in `checkCredentials` that can realistically throw is `findUserByEmail` (login.tsx:104), before any password work; `verifyPassword` cannot throw after comparing (`parseHash` bounds parameters, derived and stored key lengths match for `timingSafeEqual`, `logSecurityEvent` is `console.warn`). So a forgiven error never checked a password: no free guess, no oracle. The zod email schema stops query-breaking input. `forgive` decrements a shared counter, so concurrent requests keep the total correct; a success `reset`, window rollover or `maxKeys` eviction inside one erroring request could drop another request's count, which needs a simultaneous outage - negligible. Probe: production build, `DATABASE_URL` at closed port 5999 - the correct password 6x from one IP -> `500 x6`, a 7th from another IP -> 500, 22 more from one /64 -> `500 x22`, no `login_rate_limited` events. Gap: no automated test of the forgive-on-error path.

### 01/F-11 [P2] closed - Keeping both password-check slots busy refuses every legitimate login with 503

**File:** app/features/auth/login-rate-limit.server.ts:25 (`createInFlightLimit(2)`), app/features/auth/client-ip.ts:7-11 (key is the full address)
**Found:** 2026-09-16 by review (scope: current; lens: security, performance)
**Why it matters:** A 503 is not counted, and a request that gets a slot counts only against its own IP and email, so an attacker rotating addresses and invented emails is never rate-limited and only has to keep 2 scrypt runs busy. Probe on the production build with a spoofed `X-Forwarded-For` per request while a real user tried the correct password every 100 ms: 2 attacker connections (~50 req/s) -> 3 of 43 real logins succeeded, 40 got 503; 4 connections -> 0 of 49. In production one IPv4 address holds a slot for only 20 attempts, so this needs roughly 600-1800 addresses per 15 minutes - botnet scale over IPv4, but trivial from one IPv6 /64 if the VPS is reachable over IPv6 (the unverified part). The cap protects the public site (F-09), the right priority for ~10 editors and a "down until noticed" bar, but admins can be locked out of login. OWASP Top 10:2025 A06 Insecure Design.
**Suggested fix:** Accept the trade-off explicitly, or harden cheaply: key the IP limiter by /64 for IPv6 addresses (a pure helper beside `clientIp`, unit-tested), which also stops one /64 getting a fresh 20-attempt budget per address. `host`: record whether Caddy serves the CMS over IPv6.
**Resolution:** Repaired 2026-09-16 by build (spec step "Repair F-11"), hardening rather than removing the trade-off. New pure `rateLimitKeyForIp` in `client-ip.ts`: IPv6 -> its /64 (`2001:db8:0:1::/64`), IPv4-mapped -> the IPv4 address, IPv4, `unknown` and malformed values unchanged; the login action keys `ipLoginLimiter` with it, log lines keep the full address. Evidence: 6 new unit tests, and 7 mutations (IPv4 path, 8 groups kept, no mapped IPv4, no lowercasing, no zone strip, two `::` allowed, no group count) each turned them red. Production build: 20 unknown-email failures from 20 addresses in `2001:db8:0:1::/64` -> 20x 400; a 21st address in that /64 -> 429 (`login_rate_limited` scope ip, full address logged); `2001:db8:0:2::1` -> 400; an IPv4 client -> 400. **Accepted residual (user asked for the repair; recorded in the spec):** an attacker with many IPv4 addresses (~600-1800 per 15 min) can still hold both password slots and make legitimate logins get 503 - accepted at ~10 editors because the cap protects the public site (F-09). Whether the VPS serves the CMS over IPv6 is still for `host` to record.
Closed 2026-09-16 by independent review (the code repair; residual wording corrected by F-13). `ipKey` is used at every `ipLoginLimiter` call (login.tsx:44, 61, 69, 81); logs keep the full `ip`. `rateLimitKeyForIp` on odd spellings: `2001:db8:0:1::1:0` -> `2001:db8:0:1::/64`; `::ffff:0102:0304` and `::` -> `0:0:0:0::/64`; `1:2:3:4:5:6:7::` -> `1:2:3:4::/64`; `::FFFF:1.2.3.4` -> `1.2.3.4`; `::ffff:0:1.2.3.4`, `64:ff9b::1.2.3.4`, `2001:db8::1.2.3.4`, `0:0:0:0:0:ffff:1.2.3.4`, `[2001:db8::1]`, `2001:db8::1.`, `02001:db8::1`, `1:2:3:4:5:6:7:8::` returned unchanged (own key each). Those dodge the /64 only if the attacker controls the string; behind Caddy they do not - Caddy replaces X-Forwarded-For from untrusted clients with the socket address in Go's canonical form (dotted IPv4, else compressed hex), so no spelling choice and no IPv6 client posing as a `::ffff:a.b.c.d` IPv4 key. The mapped branch is effectively unused in production but harmless. Live /64 probe not re-run by the reviewer (probe server failed to start in its shell); evidence is unit-level plus the builder's live probe.

### 01/F-12 [P3] closed - Browser tests share one X-Forwarded-For address for the whole file, contrary to their comment

**File:** e2e/auth.spec.ts:11-15
**Found:** 2026-09-16 by review (scope: current; lens: tests)
**Why it matters:** `randomInt` runs once when the module loads, so every test in the file uses the same address (every log line in the run showed `"ip":"198.51.100.116"`); the comment "a fresh address per test" is wrong. The new tests raise the failures counted against that address from 2 to 8 per run, of the IP limit of 20. It passes today, but a few more refusal tests, or `reuseExistingServer` keeping counts from an earlier run, will produce unexplained 429s in unrelated tests.
**Suggested fix:** Set the header per test: `test.beforeEach(({ page }) => page.setExtraHTTPHeaders({ "X-Forwarded-For": `198.51.100.${randomInt(1, 255)}` }))` (or an `extraHTTPHeaders` fixture function), and pass it per call in the `request`-fixture tests. Or correct the comment and state the 20-failure budget.
**Resolution:** Repaired 2026-09-16 by build (spec step "Repair F-12"). `e2e/auth.spec.ts`: `beforeEach` picks a random `10.x.y.z` per test and sets it with `page.setExtraHTTPHeaders`; the two `request`-fixture tests pass it per call; the comment now says each test gets its own address. Evidence: `npm run test:e2e` 12 passed; the server log's security events carry 9 distinct addresses, one per test that logs (the lockout test's 6 events share one), where the previous run showed a single address for every line.
Closed 2026-09-16 by independent review. `npm run test:e2e` 12 passed; security events carried 9 distinct `10.x.y.z` addresses (6 events on the lockout test's, 1 each otherwise), showing `page.setExtraHTTPHeaders` reaches both JS `.data` and no-JS form posts. No test opens a second context; the two `request` tests pass the header per call (they stop at 403/413 before the limiter anyway). Collisions are immaterial: ~16.5 M addresses, only the lockout test puts more than one failure on its address (5 of 20), each test has its own user; one spec file, not parallel, so module-level `testIp` is safe. Minor: `beforeEach` now instantiates `page` for the two request-only tests.
