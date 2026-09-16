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

### F-28 [P2] fixed - A mistyped post address answers 500 instead of 404

**File:** app/features/content/post-edit.tsx:16 (`findEntryForUser(params.id, …)`), app/features/content/entries.server.ts:36
**Found:** 2026-09-16 by review (scope: current; lens: correctness)
**Why it matters:** `params.id` goes straight into a `uuid` comparison, so anything that is not a UUID makes PostgreSQL raise `invalid input syntax for type uuid` before the query can return nothing. **Measured:** logged in, `GET /admin/posts/not-a-uuid` returns **500** with "Oops! An unexpected error occurred." The same URL shaped like a UUID correctly returns 404. No data is at risk and it is behind the login, which is why this is not a P1 - but a mistyped or stale link is an ordinary thing to do, and the answer should be the same 404 a missing post gets. OWASP Top 10:2025 A10, mishandling of exceptional conditions.
**Suggested fix:** Check the shape before querying - a `z.uuid()` parse of `params.id` in the loader and action, throwing the same `data("Not Found", { status: 404 })`. A browser test alongside the existing ownership one.
**Resolution:** Repaired 2026-09-16 by build. `requirePostId()` in `post-edit.tsx` parses the id with `z.uuid()` and throws the same 404 a missing post gets; both the loader and the action go through it. Evidence: `GET /admin/posts/not-a-uuid` now returns **404** with no error page, covered by `e2e/write-post.spec.ts` ("a mistyped post address is not found"), **which was shown to fail with the guard removed** (1 failed / 5 passed) and pass with it (6 passed). `npm run verify` green, `npm run test:e2e` 21 passed. Status `fixed` for `review` to re-examine.

### F-29 [P2] fixed - The writing area has no accessible name

**File:** app/features/blocks/editor.client.tsx:68
**Found:** 2026-09-16 by review (scope: current; lens: accessibility)
**Why it matters:** The title input carries a visually-hidden label, but the editor's container is a bare `<div>` holding Editor.js's `contenteditable` region, which exposes a textbox role with **no name**. A screen-reader user tabbing from the title hears an unlabelled edit area and has to infer what it is. **WCAG 2.2 level A, 4.1.2 Name, Role, Value** - the project's recorded bar is AA, which includes every level A criterion (`design.md`, Accessibility bar). Checkable statically, unlike focus order, which still needs the manual pass in F-18.
**Suggested fix:** Give the holder `role="region"` and `aria-label="Post content"`, or label it from a visually-hidden heading. Confirm in the manual pass that Editor.js does not override it.
**Resolution:** Repaired 2026-09-16 by build. The container is now `<section aria-label="Post content">` - a real landmark rather than a div with a role, which is what Biome`s `a11y/useSemanticElements` asked for when the first attempt used `role="region"`. **Statically fixed only:** whether a screen reader announces it usefully is still the manual pass in F-18. Status `fixed`.

### F-30 [P3] fixed - The editor container carries a class name nothing defines

**File:** app/features/blocks/editor.client.tsx:68 (`className="editor-canvas"`)
**Found:** 2026-09-16 by review (scope: current; lens: quality)
**Why it matters:** This project styles components with CSS Modules (`coding-standards.md`, and every other component here uses `styles.x`). `editor-canvas` is a global class that no stylesheet defines, so it reads as intent that was never finished: a maintainer looking for it finds nothing, and a later global rule could match it by accident.
**Suggested fix:** Either drop the attribute, or add the class to a module and reference it as `styles.canvas` like the rest of the form.
**Resolution:** Repaired 2026-09-16 by build: the orphan `editor-canvas` class is gone, and the element carries no class at all - Editor.js styles its own canvas. Status `fixed`.

### F-25 [P2] open - Two people starting the same-titled post at once can get a 500

**File:** app/features/content/entries.server.ts:44-66 (`createDraft`)
**Found:** 2026-09-16 by review (scope: current; lens: correctness)
**Why it matters:** The free address is chosen by reading the taken ones and then inserting, with no transaction between the two. Two saves racing with the same title both read the same taken list, both pick `hello-world-2`, and the second violates `entries_type_slug_key` - an unhandled `23505` becomes the "Oops! An unexpected error occurred." page, and the writer's text is still in their editor but their save is lost. Narrow window and a handful of editors (`quality-bar.md`), so it is not a P1, but the failure is ugly and the fix is small.
**Suggested fix:** Catch `23505` on the insert in `createDraft` and retry with the next free address, two or three times before giving up. A unit test cannot reach this without a database, so it belongs with F-17's CI database or a browser test that inserts a clashing row first.

### F-26 [P3] open - `/admin/posts/new` has no loader, so a client-side navigation skips the auth check

**File:** app/features/content/post-new.tsx:9
**Found:** 2026-09-16 by review (scope: current; lens: security)
**Why it matters:** `requireUser` is route middleware, and `admin-shell/layout.tsx:11` documents the pattern: the loader is what makes a client-side navigation call the server, so the middleware runs on those too. This route has no loader, so a client-side navigation to it renders the editor without a server check. **Nothing leaks** - the page has no data, and the action re-checks on save - so this is a P3 about consistency, not an open door. It becomes a real gap the moment this route loads anything.
**Suggested fix:** Give it a loader returning `null` (or the user, once the screen shows who is writing), matching the admin shell.

### F-27 [P3] open - The address lookup scans rather than using the index

**File:** app/features/content/entries.server.ts:46-48
**Found:** 2026-09-16 by review (scope: current; lens: performance)
**Why it matters:** `slug like 'base%'` cannot use `entries_type_slug_key` under the database's default collation - a prefix `LIKE` needs `text_pattern_ops` - so every new post scans the entries table. At the recorded scale (a few thousand entries, `quality-bar.md`) this is microseconds and well inside the 1 s save bar (measured p95 105 ms), so it is a note for when the table grows, not a problem today.
**Suggested fix:** When it matters, add `create index entries_slug_prefix_idx on entries (type, slug text_pattern_ops)`, or select the exact candidates instead of a prefix match.

### F-22 [P2] unverified - The app now believes any client's `X-Forwarded-Host` and `X-Forwarded-Proto`

**File:** server/app.ts:17 (`{ trustProxy: true }`)
**Found:** 2026-09-16 by review (scope: current; lens: security)
**Why it matters:** `trustProxy` makes `request.url` come from `X-Forwarded-Proto` and `X-Forwarded-Host` whenever they are present, with no check on who sent them. In production that is safe only while **Caddy overwrites both on every request** and nothing but Caddy can reach the app - the second half is verified (127.0.0.1, ports dropped in both firewalls), **the first half is not**. If Caddy passes a client-supplied `X-Forwarded-Host` through, a visitor controls both sides of React Router's own CSRF comparison (`node_modules/react-router/dist/production/lib/actions.js:25` compares the `Origin` header to `request.url`), disabling that layer. **Impact is contained, which is why this is P2 and not higher:** this project's own check (`app/root.tsx:22`) compares `Origin` against `APP_URL` from the environment, which a header cannot change, and nothing builds an absolute URL from the request host - the three readers of `request.url` (`login.tsx:83`, `require-user.server.ts:36`, `root.tsx:28`) take only a path, and `safeRedirect` allows `/admin` paths only. So the practical loss is one of two CSRF layers, not an open redirect or a poisoned link. Also note the option is on in **development and the browser tests** too, where the app is reachable directly - there a local process can forge its own client address and evade the login rate limit. OWASP Top 10:2025 A05 Security Misconfiguration.
**Suggested fix:** After the fix deploys, check what Caddy actually forwards: `curl -sS -o /dev/null -H 'X-Forwarded-Host: evil.example' -H 'X-Forwarded-Proto: http' https://cms.surenmaharjan.fyi/admin/login` and confirm from the app's behaviour and journal that it still treats the request as `https://cms.surenmaharjan.fyi`. If Caddy does pass client values through, the smallest fix is `header_up X-Forwarded-Host {host}` and `header_up X-Forwarded-Proto {scheme}` in `deploy/caddy/habre-cms.caddy`. A test asserting a forged `X-Forwarded-Host` cannot change the origin the server believes in belongs with whichever change closes this.
**Production evidence, 2026-09-16 by deploy (release `52c2670`), against `https://cms.surenmaharjan.fyi`:** a POST carrying `X-Forwarded-Host: evil.example` with a matching `Origin: https://evil.example` was refused with the 11-byte "Bad Request" and a CSRF abort in the journal - so Caddy replaced the forged host and the app still read its origin as `cms.surenmaharjan.fyi`. A POST carrying `X-Forwarded-Proto: http` with the genuine https `Origin` reached the action normally, so Caddy overwrote that header too. **Caddy's `reverse_proxy` does not pass client-supplied `X-Forwarded-Host` or `X-Forwarded-Proto` through**, which was the unverified half. **What remains true:** the option is still on in development and the browser tests, where the app is reachable directly and a local process can forge its own client address to evade the login rate limit - a local-only concern on a single-user dev machine. Left `unverified` for `review` to judge: the production risk is disproven, and only `review` sets `invalid`.

### F-23 [P3] open - The proxied test port is written twice

**File:** e2e/forwarded-proto.spec.ts:8-9, playwright.config.ts:6
**Found:** 2026-09-16 by review (scope: current; lens: quality)
**Why it matters:** `PROXIED_PORT` is defined in the config and the port is hardcoded again as `3101` in two string constants in the spec. Changing it in one place points the test at a server nobody started; the failure is loud (connection refused) rather than silent, so this is a tidiness finding, not a bug. `coding-standards.md`: one concept, one place.
**Suggested fix:** Export the port from a small shared module both import, or read it from an environment variable the config sets.

### F-24 [P3] open - `@react-router/node` may now be an unused dependency

**File:** package.json:24
**Found:** 2026-09-16 by review (scope: current; lens: dependencies)
**Why it matters:** After this change nothing imports it - the only occurrence left in the tree is a comment in `server/app.ts:8`. It may still be required by `@react-router/dev`'s build for the node server target, and it is where the `@remix-run/node-fetch-server` version range comes from, so removing it blindly could break the build or float the transitive version. An unused direct dependency is still code shipped and maintained (`fundamentals.md`, Dependencies).
**Suggested fix:** Its own small change, not this one: remove it, run `npm run verify` and `npm run test:e2e`, and keep it with a comment saying why if the build needs it.

### F-16 [P2] fixed - The backup has never been restored

**File:** deploy/backup-db.sh:1
**Found:** 2026-09-16 by preflight (first-release audit)
**Why it matters:** The quality bar promises at most 24 h of data loss and a rebuild in under an hour, and both rest on a restore nobody has performed. The mechanism is proven as far as it can be today - one run dumped, verified with `pg_restore --list`, uploaded, and the object's size was re-read from the bucket - but production's database has **0 tables** (migrations have never run there), so the dump is an empty database and restoring it proves nothing about the schema the code needs. Not a P1 only because there is no content to lose yet; it becomes one the moment anyone writes a post.
**Suggested fix:** `host`, immediately after the first `deploy` runs migrations: restore the newest dump into a scratch database and start the app against it (the dump is mode 600 root, so copy it for the `postgres` user first), then record the evidence here.
**Resolution:** Repaired 2026-09-16 by deploy, after release `52c2670` and with the schema in place. A fresh nightly backup ran (`habre_cms-20260916T024823Z.dump`, 7314 bytes, unit result `success`), was restored into a scratch database `habre_cms_restore_test` owned by the app's role, and **the application itself was started against that copy** - not merely opened in a database client, which only proves the file parses. Evidence: the restored copy holds `users` and `schema_migrations` with `0001_users.sql` recorded; `scripts/create-admin.ts` created an account against it; the app answered `/healthz` `{"status":"ok","database":"up"}`; a wrong password returned the form's own error (400) and **the right password returned 302 to `/admin`** - a real session issued from restored data. The scratch database was dropped and the throwaway account went with it. Recovery time for this data volume is seconds; the untested part that remains is a restore onto a **fresh server**, which is the D9 hour-long rebuild path. Status `fixed` for `preflight` to re-check and close.

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
