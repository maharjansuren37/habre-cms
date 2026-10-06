# Feature: Sites by host

**From build plan:** item 16a
**Type:** Feature
**Verified:** 2026-10-06, 9e39db5887ce, 9 of 10 proven, 1 could not verify (CI resolving `*.localhost` - the PR's first `e2e` run); full suite 374 passed, 1 failed on F-231's "Login is busy" (passed 3 of 3 alone)
**Reviewed:** 2026-10-06, 9e39db5887ce, current (c09d62b..4f5798d, F-281), every lens - 0 blocking

## Goal

Each site's public pages are served at its own address,
`<address>.<sites domain>`, or at a verified own domain in `site_domains`
(`surenmaharjan.fyi` for site 1). Sign-in, signup and the admin move to the
platform host. Until now every public request has shown the oldest site
(D248), so a site made at signup has had nowhere to be seen. This item fixes
that (D153).

## In scope

- **Configuration:** `PLATFORM_URL` (e.g. `https://app.habre.ai`) and
  `SITES_URL` (e.g. `https://habre.page`) replace `ADMIN_URL` and `PUBLIC_URL`
  everywhere (owner, 2026-10-06). A site's origin is `SITES_URL`'s scheme,
  then `<address>.`, then `SITES_URL`'s host with its port.
- **Host resolution, before any route runs** (plan section 6, *Hostnames*):
  - the platform host gets the platform and admin paths. `/` redirects to
    `/admin`; every public path answers 404. There is no single-host fallback
    (owner, 2026-10-06).
  - a host `<label>.<sites host>` is looked up in `sites.subdomain`.
  - any other host is looked up in `site_domains`, verified rows only.
  - an unknown host, an unverified domain or a suspended site
    (`suspended_at` set) answers 404.
  - a platform path on a site host redirects to the same path on the platform
    for GET/HEAD and answers 404 for anything else, as D22 did.
  - `/healthz` answers on every host.
- **`site_domains`**: a migration creates the table and gives site 1
  (subdomain `surenmaharjan`) `surenmaharjan.fyi`, verified.
- **The site travels in router context:** root middleware resolves it once
  into a `siteContext`. Every public loader reads it there.
  `findPublicSiteId` is deleted.
- **Links to a site** use its subdomain origin: the admin shell's View site
  link, and the site card's address under the site name (design.md *Admin
  shell*). Signup's address field gets the fixed `.<sites host>` suffix
  (`.input-group`, design.md *Added*).
- **The oldest site is no longer special** (lifts D302): its last active
  admin can delete their account like any other. Deleting a site deletes its
  `site_domains` rows.
- **The browser suite on `*.localhost`:** public pages are visited at
  `http://<address>.localhost:<port>` and the platform at
  `http://127.0.0.1:<port>`.

## Out of scope

- `suspend-site` / `unsuspend-site` and the Caddy file (platform hosts,
  wildcard certificate, `cms.` redirect) - **item 16b**. This item tests
  suspension by setting `suspended_at` directly.
- One main address per site, redirects to it and `<link rel="canonical">`
  (D173) - **item 17**. Until then site 1 answers on its subdomain *and* on
  `surenmaharjan.fyi`, and every link uses the subdomain, including View site
  for a site that has an own domain.
- Adding or verifying own domains - **item 21**.
- The sites domain's apex and `www`: nothing serves them. They fall to the
  `site_domains` lookup and answer 404.
- Moving `e2e/deleted-account.spec.ts` off site 1 (D308) - this item makes it
  possible, but does not do it.
- F-151 (a percent-encoded admin path), P2 unverified - the routing is
  rewritten here, but the finding is not taken on unless the owner asks
  (see Notes).

## Build steps

- [x] **Step 1 - Prove `*.localhost` under Playwright** - a throwaway spec
  against the primary test server, which listens on `127.0.0.1` only. It
  opens `http://surenmaharjan.localhost:3100/healthz` in Chromium and through
  the `request` fixture. *Done when:* both answer 200 locally, shown with the
  command and its output. If the `request` fixture cannot resolve the name
  (Node resolves it through the OS; it answered `::1` on this machine), the
  step records the fallback the later steps use - `127.0.0.1` with a `Host`
  header, or the proxied server's `X-Forwarded-Host` - and says so in
  Decisions. The spec file is deleted before the step closes. CI's own
  evidence comes from the PR's first `e2e` run: `verify` names it.
- [x] **Step 2 - Migration `0015_site_domains`** (run through `migrate`):
  - columns `domain` (text primary key, lowercase, checked like a hostname),
    `site_id` (references `sites`, `on delete restrict`), `verified_at`,
    `created_at`, and an index on `site_id`;
  - a platform table with no row-level security; the app role gets
    `select, delete`;
  - seeds `surenmaharjan.fyi`, verified now, for the site whose subdomain is
    `surenmaharjan`, when that site exists;
  - the reverse is written in the file's header comment, as `0010` does.

  *Done when:* `npm run db:migrate` applies it to the development database.
  `\d site_domains` shows the shape, site 1 has its row, and the app role can
  `select` but not `insert`, each shown with `psql` output.
- [x] **Step 3 - Rename the configuration** - `PLATFORM_URL` and `SITES_URL`
  replace `ADMIN_URL` and `PUBLIC_URL` in `app/lib/env.server.ts`. `SITES_URL`
  is an http(s) origin with no path, query or fragment, and Zod refuses
  anything else, naming the variable. The rename also reaches:
  - every reader: root middleware, `host-routing.ts`'s caller, the session
    and pending-email cookies, the email links, the admin shell;
  - `.env.example` and `playwright.config.ts` (each server keeps equal
    values for now, so routing is unchanged);
  - `deploy/habre-cms.service`: the two `Environment=` lines move to
    `production.env`, and `deploy/setup-server.sh` writes them there as
    commented placeholders;
  - `AGENTS.md`'s *Environments* rows.

  No behaviour changes. *Done when:* `npm run verify` and
  `npm run test:e2e` pass. `grep -rn "ADMIN_URL\|PUBLIC_URL\b"` outside
  `blueprint/`, `dev-notes/` and `CHANGELOG.md` finds nothing, and a unit
  test shows `SITES_URL=https://habre.page/x` refused with a message naming
  `SITES_URL`.
- [x] **Step 4 - Public visits in the browser suite go through one helper** -
  `siteUrl(path, address = "surenmaharjan")` in `e2e/helpers/sites.ts`, which
  still returns the primary server's single origin. Every `goto` and
  `request.get` of a public path (about 49 in 16 spec files) uses it, and so
  do assertions on a public page's URL. Mechanical, no behaviour change.
  *Done when:* `npm run test:e2e` passes, and a grep for `goto("/` and
  `` goto(`/ `` finds only platform paths (`/admin`, `/signup`, `/verify`,
  `/forgot-password`, `/reset-password`, `/confirm-email`).
- [x] **Step 5 - The host classifier, pure** - `app/lib/host-routing.ts`
  rewritten as one pure function. It takes the method, path, search, request
  host, platform origin and sites origin, and returns one of:
  - allow on the platform;
  - redirect;
  - not-found, marking whether the host was outside both domains (logged);
  - look up a subdomain (the label);
  - look up a domain (the lowercased host).

  A label must be a single DNS label: `a.b.<sites host>` is not-found, and so
  is the bare sites host. Not wired yet. *Done when:* `npm test` runs
  `host-routing.test.ts` covering every rule in *In scope*'s host list,
  including those two edge cases, upper-case hosts, the sites host's port and
  `/healthz` on each kind of host.
- [x] **Step 6 - Wire it: the site comes from the host** - root middleware
  calls the classifier and runs one indexed query for a subdomain or domain
  lookup, refusing suspended sites and unverified domains. It sets
  `siteContext`. The public loaders (`layout`, `home`, `posts`, `post`,
  `page`) read it, and `findPublicSiteId` is deleted. Only a host outside
  both domains logs `wrong_host`; an unknown address under the sites domain
  answers 404 silently. `playwright.config.ts` gives each server
  `PLATFORM_URL=http://127.0.0.1:<port>` and `SITES_URL=http://localhost:<port>`,
  and `siteUrl` returns `http://<address>.localhost:<port>`. The D22 tests in
  `e2e/host-routing.spec.ts`, which assume one public host, are removed;
  Step 7 replaces them. *Done when:* `npm run test:e2e` passes in full, plus:
  - a second site (`createSite`) at `http://<its address>.localhost:3100`
    shows its own title and published post, not site 1's, and site 1's post
    slug answers 404 there;
  - journey 6 passes: signed out, open `/admin/pages` on the platform host,
    sign in, land on `/admin/pages`;
  - **quality bar:** a site's home page on its subdomain, served by
    `npm start`, answers under 500 ms at p95 over 200 sequential requests,
    measured with `curl -w %{time_total}` and the p95 shown.
- [x] **Step 7 - Browser tests for every host rule** - `e2e/host-routing.spec.ts`
  rewritten. *Done when:* `npm run test:e2e` passes with tests that show:
  - an unknown address and a site with `suspended_at` set answer 404;
  - on the proxied server, `X-Forwarded-Host: surenmaharjan.fyi` serves site
    1's home page, and a domain row with `verified_at` null answers 404;
  - `/admin/posts` on a site host answers 302 to the platform's
    `/admin/posts`, and a POST there answers 404;
  - `/posts/x` on the platform host answers 404, and `/` answers 302 to
    `/admin`;
  - `/healthz` answers 200 on the platform host, a site host and an unknown
    host.
- [x] **Step 8 - Links to the site, and signup's suffix** - a pure
  `siteOrigin(address, sitesUrl)` in `app/lib/`, unit-tested. The admin
  shell's View site uses it for the member's site, and the site card shows
  the address (`<address>.<sites host>`) under the site name. Signup's
  address field gets the `.input-group` suffix `.<sites host>` from
  `blueprint/design-kit/components.css` (`.input-group`,
  `.input-group__addon`). The addon's text is part of the input's
  `aria-describedby`, so it is announced. *Done when:*
  - journey 2 passes end to end: publish a page on the platform host, follow
    View site, and land on `http://surenmaharjan.localhost:3100/` showing it;
  - a browser test reads the suffix on `/signup` and finds it in the
    address field's accessible description;
  - `e2e/contrast.spec.ts` still passes with the addon on the page.
- [x] **Step 9 - The oldest site is ordinary** - remove the oldest-site case
  from `deletionCase`, `readDeletionFacts` and the confirm screen (D302).
  `deleteAccount` deletes the site's `site_domains` rows before the site, and
  the comments that say "until item 16" go. design.md's *Your account* row
  drops the refusal. *Done when:*
  - a unit test shows `deletionCase` has no oldest-site branch;
  - a browser test shows the last admin of a second site that has a verified
    `site_domains` row deleting their account, after which the site and its
    domain row are gone (checked as the owner role);
  - the refusal test is removed and `npm run test:e2e` passes.

## Files and areas

- `db/migrations/0015_site_domains.sql` (new)
- `app/lib/env.server.ts`, `.env.example`, `app/lib/host-routing.ts` (+ test),
  `app/lib/content-security-policy.ts` (comment only), `app/root.tsx`
- `app/lib/site-context.ts` or similar (new: the `siteContext` key);
  `app/lib/site-origin.ts` (+ test, new)
- `app/features/public-site/` - `layout.tsx`, `home.tsx`, `posts.tsx`,
  `post.tsx`, `page.tsx`; `public-site.server.ts` loses `findPublicSiteId`
  and gains the host lookup, or the lookup lives in a new
  `app/features/sites/` (plan section 6 names that directory for host-to-site
  resolution - prefer it)
- `app/features/admin-shell/layout.tsx` (+ its CSS module)
- `app/features/signup/signup.tsx`, `app/lib/ui/` (Field gains a suffix)
- `app/features/auth/session-cookie.server.ts`,
  `app/features/signup/pending-email-cookie.server.ts`, the four email-link
  callers (`signup.tsx`, `signup-sent.tsx`, `forgot-password.tsx`,
  `account.tsx`)
- `app/features/account/account.server.ts`, `account-delete-input.ts`
  (+ tests), the delete confirm screen
- `app/routes.ts` (comment only)
- `playwright.config.ts`, `e2e/helpers/sites.ts`, `e2e/helpers/ports.ts`
  (comments), `e2e/host-routing.spec.ts`, the 16 spec files with public
  visits, `e2e/account-delete.spec.ts`
- `deploy/habre-cms.service`, `deploy/setup-server.sh`, `AGENTS.md`,
  `blueprint/context/design.md` (step 9)

## Data and contracts

- **`site_domains`** (load-bearing; items 17 and 21 build on it): `domain text
  primary key` (lowercase hostname, no port, no trailing dot), `site_id uuid
  not null references sites on delete restrict`, `verified_at timestamptz`
  (null means not served), `created_at timestamptz not null default now()`.
  A platform table with no row-level security; the app role has
  `select, delete` (item 21 adds `insert` when it needs it).
- **`siteContext`** (load-bearing; items 17 and 19 read it): a router context
  value `{ id: string; subdomain: string }`, set by root middleware on every
  site-host request and never set on the platform host. A public loader that
  finds it unset throws, because that means a routing bug, not a visitor
  error.
- **`PLATFORM_URL`, `SITES_URL`** (load-bearing): http(s) origins. A site's
  origin is `${sites.protocol}//${address}.${sites.host}`.
- **The host classifier's result** - the union named in Step 5 - is internal
  to `app/lib/host-routing.ts` and root middleware.

## Testing

- **Unit (`npm test`, inside `verify`, runs in CI with no database):** the
  classifier, `siteOrigin`, the env refusal and `deletionCase`. None needs
  the database.
- **Browser (`npm run test:e2e`, locally with the dev database, and in CI's
  `e2e` job):** everything else. They need `*.localhost` to reach
  `127.0.0.1`. Step 1 proves this locally. CI's runner (`ubuntu-24.04`, with
  systemd-resolved) is expected to resolve it too, and the first `e2e` run on
  the PR is the proof. If it fails there, Step 1's fallback is what the specs
  switch to.
- The p95 measurement is a one-off command in Step 6, not a committed test.

## Decisions

- **`PLATFORM_URL` and `SITES_URL`**, renamed rather than reusing `ADMIN_URL`
  and `PUBLIC_URL` with new meanings (owner, 2026-10-06). A site's origin
  takes the scheme and port from `SITES_URL`.
- **No single-host fallback:** a public path on the platform host answers
  404, including in development and the browser suite, which use
  `127.0.0.1` for the platform and `<address>.localhost` for sites. The
  alternative was serving the oldest site when the two URLs are equal: fewer
  test changes, but the main suite would never exercise host lookup (owner,
  2026-10-06).
- **A platform path on a site host redirects to the platform** (GET/HEAD) and
  answers 404 otherwise. This keeps D22's behaviour. A 404 for every admin
  path was the alternative, and it strands someone who types
  `<address>.habre.page/admin`.
- **A platform path redirects from any non-platform host without a lookup**
  (Step 5): the classifier never asks whether the host is a real site before
  sending `/admin` to the platform, so an unknown host's GET `/admin` also
  redirects. The target is always the platform origin, so it is not an open
  redirect, and it keeps the classifier pure. A non-GET there is not found,
  logged when the host is outside both domains.
- **Only a host outside both domains is logged** as `wrong_host`. An unknown
  or suspended address under the sites domain is a normal 404: the wildcard
  sends every guessed name here, and logging each one would bury the real
  signal.
- **Own domains are matched on the full lowercased host**, with no port
  stripping. Production has no ports, and a port would only appear in a test.
- **Links use the subdomain until item 17** brings the main address (D173). It
  beat linking to `surenmaharjan.fyi` now: the seed row exists in every
  environment, so development's View site would open production.
- **The seed targets subdomain `surenmaharjan`**, not "the oldest site". That
  is what `0010` named site 1, and on a fresh install the name of the oldest
  site is chance.
- **`site_domains` restricts deletes;** `deleteAccount` removes the rows
  explicitly. This is the pattern 15e2 set for every later site table
  (`account.server.ts`'s comment).
- **D302 is lifted:** once the public host no longer serves the oldest site,
  nothing makes that site special.
- **The site is resolved once, in root middleware, into router context.** It
  beat each loader looking up the host itself: the 404 for an unknown site
  then comes before any route runs, and one query serves every loader on the
  request.

## Production needs

- **Migration `0015_site_domains`** - runs in the v1 deploy (D163).
- **`PLATFORM_URL` and `SITES_URL` in `/etc/habre-cms/production.env`**, and
  `PUBLIC_URL` / `ADMIN_URL` removed from the systemd unit (this item moves
  them out of `deploy/habre-cms.service`). The values depend on the two
  domains still to be bought (`needs-you.md`).
- **DNS and certificates for the platform and sites domains, and the Caddy
  file** - item 16b and `host`. Without them, nothing reaches the new hosts.

## Behaviour changes

- Changes `sites.6` from "the public site shows the oldest site's content (until item 16)" to "a site's public pages are served at `<address>.<sites domain>` and show only that site's content" - Step 6
- Adds to `sites`: a verified domain in `site_domains` serves its site; an unverified domain, an unknown address or a suspended site answers 404 - Step 7
- Adds to `sites`: sign-in, signup and the admin answer on the platform host only - an admin path on a site host redirects there, a public path on the platform host answers 404, and `/` there redirects to `/admin` - Step 7
- Adds to `sites`: View site and the admin's site card show the site's address, and signup shows the sites domain after the address field - Step 8
- Removes `accounts.23`: the oldest site is no longer special once each site is served from its own host (D302 lifted)
- Adds to `accounts`: the last active admin of any site can delete their account, and the site's domains go with it - Step 9

## Notes

- **React Router 8.4.0 middleware and context:** read
  `node_modules/react-router/docs/how-to/middleware.md` before Step 6.
  `userContext` in `app/features/auth/` is the existing pattern for
  `createContext`. Use `url` (`.data` stripped), never `request.url`, as the
  current middleware does.
- **`public-site.1` holds:** `siteContext` never reaches loader data. Public
  pages still carry no site id.
- `isPlatformPath` keeps its list. `/admin/login` is under `/admin/`.
- **Site-owned data rule (coding-standards):** public loaders keep calling
  `inSite(site.id, ...)` and naming `site_id`. Only the source of the id
  changes.
- The host lookup is a platform-table query (`sites`, `site_domains`): no
  `inSite`, and it is a hot path. Use one query on the unique index.
- `HOST_SPLIT_PORT`'s server is now the email-off server. Update its
  comments, but leave its name alone.
- F-151 sits in the code Step 5 rewrites. Taking it on would add a
  percent-decoding rule to the classifier and one browser test. Say so at the
  gate if you want it; otherwise `review` checks that the rewrite does not
  make it worse.
- The old host-split comments (D22) in `e2e/helpers/ports.ts`, `routes.ts`
  and `content-security-policy.ts` are reworded as their steps touch them.
- `dev-notes/decisions.md`: `ship` records the above and marks D22 and D248
  superseded and D302 lifted.

## Findings

### 16a-sites-by-host/F-270 [P3] closed - Re-running `setup-server.sh` re-grants `insert, update` on `site_domains`, undoing 0015's revoke
File: db/migrations/0015_site_domains.sql:36; db/roles.sql:24; deploy/setup-server.sh:171-174

# F-270 - Re-running `setup-server.sh` re-grants `insert, update` on `site_domains`, undoing 0015's revoke

**Found:** 2026-10-06 by review (scope: current, item 16a; every lens; reviewer subagent)
**Why it matters:** `roles.sql` grants all four rights on every table and `setup-server.sh` re-runs it on existing servers. 0015 is the first per-table revoke, and nothing re-applies it, so the app role silently regains insert and update.
**Suggested fix:** After the blanket grant in `roles.sql`, revoke insert, update on `site_domains` (guarded by the table existing).
**Resolution:** Fixed 2026-10-06 by build. `db/roles.sql` revokes `insert, update` on `site_domains` after its blanket grant, guarded by `to_regclass`. Shown on the development database: re-running the old `roles.sql` left the app role with `DELETE INSERT SELECT UPDATE`; the new one leaves `DELETE SELECT`. No committed test (CI runs no `roles.sql` re-run), so left `fixed` for `review`. Closed 2026-10-06 by review (reviewer subagent): roles.sql dry-run as postgres with ON_ERROR_STOP inside begin/rollback printed GRANT x4, ALTER DEFAULT PRIVILEGES x2, DO, and left DELETE SELECT on site_domains; skipped before the table exists, 0015 revokes on a fresh install. Nothing new introduced.

### 16a-sites-by-host/F-271 [P3] closed - The admin site card's address breaks mid-word
File: app/features/admin-shell/layout.module.css:44-47; app/features/admin-shell/layout.tsx:46

# F-271 - The admin site card's address breaks mid-word

**Found:** 2026-10-06 by review (scope: current, item 16a; every lens; reviewer subagent)
**Why it matters:** `overflow-wrap: anywhere` broke `surenmaharjan.localhost:3200` as `...localhost:32` / `00` in verify's 1280px screenshot. Addresses run to 63 characters plus the domain. Not a WCAG failure; hard to read.
**Suggested fix:** Render `<wbr>` after each `.` so lines break at label boundaries; keep `anywhere` as the fallback for one long label.
**Resolution:** Fixed 2026-10-06 by build. The site card renders a `<wbr>` after each `.` of the address (`addressLabels` in `layout.tsx`); `overflow-wrap: anywhere` stays as the fallback. A throwaway screenshot at 1280px of `a-rather-long-site-address-for-wrapping-6822dfe0.localhost:3100` showed the break after the dot, before `localhost:3100`. No committed test. Closed 2026-10-06 by review (reviewer subagent): <wbr> gives the break points, the sidebar is a fixed grid column so `anywhere` stays a fallback, `rest` keys are unique, accessible and copied text unchanged. Narrow widths not rendered.

### 16a-sites-by-host/F-272 [P3] closed - The own-domain browser test reads site 1's shared title (F-103 pattern)
File: e2e/host-routing.spec.ts:40-53

# F-272 - The own-domain browser test reads site 1's shared title (F-103 pattern)

**Found:** 2026-10-06 by review (scope: current, item 16a; every lens; reviewer subagent)
**Why it matters:** It reads `site_title` then requests the page; `manage-settings.spec.ts` changes site 1's title on the other worker, so it can fail at random.
**Suggested fix:** Compare against `siteUrl("/")`'s response in the same test, or assert 200 plus a marker that is not the title.
**Resolution:** Fixed 2026-10-06 by build. The title read and the request are retried together with `expect(...).toPass({ timeout: 10_000 })`, so a title change on the other worker between them no longer fails the test. `npx playwright test e2e/host-routing.spec.ts` (with manage-pages, contrast, sites, deleted-account): 42 passed. The race itself was not reproduced. Closed 2026-10-06 by review (reviewer subagent): the read and request retry together for 10s and still fail if the page never holds the current title.

### 16a-sites-by-host/F-273 [P3] closed - `PLATFORM_URL` is not checked as a bare origin, while `SITES_URL` is
File: app/lib/hosts-env.server.ts:17

# F-273 - `PLATFORM_URL` is not checked as a bare origin, while `SITES_URL` is

**Found:** 2026-10-06 by review (scope: current, item 16a; every lens; reviewer subagent)
**Why it matters:** Email links use the raw value; `PLATFORM_URL=https://app.habre.ai/x` passes Zod and produces `/x/verify` links that then fail the host and CSRF checks.
**Suggested fix:** Add `.refine(isBareOrigin, ...)` to `PLATFORM_URL` and one unit test.
**Resolution:** Closed 2026-10-06 by build. `PLATFORM_URL` gets the same `isBareOrigin` refine as `SITES_URL`. Test `a PLATFORM_URL with a path is refused naming PLATFORM_URL` (`app/lib/hosts-env.server.test.ts`) failed with `hosts-env.server.ts` reverted and passed with the repair back (`node --test`). closed by build.

### 16a-sites-by-host/F-274 [P3] closed - Stale comments and dev docs after the host change
File: app/features/auth/session-cookie.server.ts:12-15; app/features/public-site/layout.tsx:122; e2e/deleted-account.spec.ts:17; app/features/content/slug.ts:18; README.md:31; AGENTS.md:237,239; server.js:127

# F-274 - Stale comments and dev docs after the host change

**Found:** 2026-10-06 by review (scope: current, item 16a; every lens; reviewer subagent)
**Why it matters:** Comments still say the two URLs are equal in development, a loader reads SITES_URL, the oldest site is served until item 16, platform paths are on the admin host. The dev docs and startup log point at `http://127.0.0.1:3000`, which is neither host with the documented `.env`.
**Suggested fix:** Reword each; point dev docs at `http://app.localhost:3000/admin` and `http://surenmaharjan.localhost:3000`.
**Resolution:** Fixed 2026-10-06 by build. Reworded: `session-cookie.server.ts` (host-only cookie stays on the platform), `public-site/layout.tsx` (no SITES_URL read), `e2e/deleted-account.spec.ts` (site 1 by history, D308), `slug.ts` (platform paths redirect from a site host); README and AGENTS.md point at `http://app.localhost:3000/admin` and `http://surenmaharjan.localhost:3000`; `server.js`'s startup log also prints `PLATFORM_URL` and `SITES_URL`. Comments and docs only, so no test. Closed 2026-10-06 by review (reviewer subagent): all cited spots reworded; a grep for the stale phrases finds only applied migrations and accurate comments. The startup log prints validated values in production; isBareOrigin refuses credentials.

### 16a-sites-by-host/F-275 [P3] closed - A host with a trailing dot is looked up as an own domain
File: app/lib/host-routing.ts:37-41

# F-275 - A host with a trailing dot is looked up as an own domain

**Found:** 2026-10-06 by review (scope: current, item 16a; every lens; reviewer subagent)
**Why it matters:** `x.habre.page.` or `app.habre.ai.` answers 404 and logs `wrong_host` instead of serving. Matters only if 16b's Caddy forwards such hosts.
**Suggested fix:** Strip one trailing `.` before comparing, with a unit case; or settle in 16b that Caddy never forwards them.
**Resolution:** Closed 2026-10-06 by build. `classifyHost` drops one trailing `.` from the host, before any port. Test `a trailing dot on the host is ignored, with or without a port` (`app/lib/host-routing.test.ts`: `lena.habre.page.`, `app.habre.ai.`, `surenmaharjan.fyi.`, `lena.localhost.:3100`) failed with `host-routing.ts` reverted and passed with the repair back. closed by build.

### 16a-sites-by-host/F-276 [P3] closed - A public path's 404 on the platform host renders in the customer-site look
File: app/root.tsx:89

# F-276 - A public path's 404 on the platform host renders in the customer-site look

**Found:** 2026-10-06 by review (scope: current, item 16a; every lens; reviewer subagent)
**Why it matters:** `data-surface` comes from `areaForPath(pathname)` and ignores the host, so `app.<platform>/posts/x` shows the neutral site 404 rather than Habre's.
**Suggested fix:** Leave it, or choose the scope from whether `siteContext` was set. Owner's call.
**Resolution:** Owner chose to fix it now instead of deferring (2026-10-06). Closed 2026-10-06 by build. `classifyHost` marks the platform host's not-found with `platformHost: true`; root middleware then throws the 404 with a `PLATFORM_NOT_FOUND` body, and `Layout` reads it through `useRouteError` to leave `data-surface="site"` off. Test `a public path's 404 on the platform host is in the platform's look` (`e2e/host-routing.spec.ts`, checked after hydration) failed before the repair (`not.toHaveAttribute` failed) and passed after (host-routing spec 13 passed); `a 404 on a site host keeps the site's look` passed both times. closed by build.

### 16a-sites-by-host/F-277 [P3] closed - `confirm-email` is a platform path but not a reserved page slug
File: app/features/content/slug.ts:19-28

# F-277 - `confirm-email` is a platform path but not a reserved page slug

**Found:** 2026-10-06 by review (scope: current, item 16a; every lens; reviewer subagent)
**Why it matters:** Pre-existing. A page titled "Confirm email" gets slug `confirm-email`; on a site host GET redirects that path to the platform, so the page can never be seen. Since 16a every site has this.
**Suggested fix:** Add `"confirm-email"` to `RESERVED_PAGE_SLUGS`.
**Resolution:** Closed 2026-10-06 by build. `confirm-email` added to `RESERVED_PAGE_SLUGS`. Test `a page titled Confirm email gets the numbered address` (`slug.test.ts`) failed with `slug.ts` reverted (pass 9, fail 1) and passed with it back (pass 10). closed by build.

### 16a-sites-by-host/F-278 [P3] closed - A platform host with a trailing dot is now allowed, but every POST there is refused as cross-site
File: app/lib/host-routing.ts:39; app/root.tsx:78-89; app/lib/same-origin.ts

# F-278 - A platform host with a trailing dot is now allowed, but every POST there is refused as cross-site

**Found:** 2026-10-06 by review (scope: current, 986d402..91afeae; every lens; reviewer subagent)
**Why it matters:** Since F-275, `app.habre.ai.` classifies as `allow`; the login page loads, but the browser's `Origin: https://app.habre.ai.` differs from the platform origin, so sign-in answers 403 and logs `cross_site`. Fails closed - noise, not a bypass; matters only if 16b's Caddy forwards dotted hosts. Item 19's `/_contact` POST will need the same normalising.
**Suggested fix:** Redirect a GET on a dotted platform host to the bare platform origin and keep anything else not-found; or settle in 16b that Caddy never forwards dotted hosts.
**Resolution:** Closed 2026-10-06 by build. `classifyHost` no longer serves the platform at its dotted host: GET/HEAD redirect to the same path and query on the bare platform origin, anything else is a platform not-found; `/healthz` still answers. Test `the platform host with a trailing dot redirects to the bare platform, and a POST is not found` (`app/lib/host-routing.test.ts`) failed with `host-routing.ts` reverted (fail 1) and passed with it back (pass 15). Dotted site hosts are still served (F-275); item 19's `/_contact` POST will need the same care. closed by build. Re-examined 2026-10-06 by review (reviewer subagent): the close stands - no open redirect (target authority is always the platform origin; `//evil.com/x` stays a platform path), no loop in a valid configuration, `app.localhost.:3000` handled, a POST there renders the platform 404 (F-276).

### 16a-sites-by-host/F-279 [P3] closed - `.env.example` says only `SITES_URL` must be a bare origin
File: .env.example:18-19

# F-279 - `.env.example` says only `SITES_URL` must be a bare origin

**Found:** 2026-10-06 by review (scope: current, 986d402..91afeae; every lens; reviewer subagent)
**Why it matters:** Since F-273, `PLATFORM_URL` with a path is refused at startup too; the comment undersells the rule a self-hoster will hit.
**Suggested fix:** Say both must be origins with no path.
**Resolution:** Fixed 2026-10-06 by build. `.env.example` now says both `PLATFORM_URL` and `SITES_URL` must be origins with no path. Comment only, no test, so left `fixed` for review. Closed 2026-10-06 by review (reviewer subagent): `.env.example:18-19` matches `hosts-env.server.ts`, which checks both variables with `isBareOrigin`.

### 16a-sites-by-host/F-280 [P3] closed - A `PLATFORM_URL` or `SITES_URL` ending in a dot loops forever or 404s every site
File: app/lib/hosts-env.server.ts:8-11 (`isBareOrigin`); app/lib/host-routing.ts:39-42

# F-280 - A `PLATFORM_URL` or `SITES_URL` ending in a dot loops forever or 404s every site

**Found:** 2026-10-06 by review (scope: current, 91afeae..85b26a6; every lens; reviewer subagent)
**Why it matters:** The classifier strips the request host's trailing dot but not the configured origins'. `PLATFORM_URL=https://app.habre.ai.` redirects every platform GET to itself (a loop, confirmed by calling `classifyHost`); `SITES_URL=https://habre.page.` sends every site to the own-domain lookup, so all 404. Needs a hand-written misconfiguration.
**Suggested fix:** In `isBareOrigin`, refuse a hostname ending in `.`; one unit test per variable in `hosts-env.server.test.ts`.
**Resolution:** Closed 2026-10-06 by build. `isBareOrigin` refuses a hostname ending in `.`, so both `PLATFORM_URL` and `SITES_URL` fail at startup naming the variable. Test `an origin whose host ends in a dot is refused, naming the variable` (`hosts-env.server.test.ts`) failed with `hosts-env.server.ts` reverted (fail 1) and passed with it back (pass 8); `npm run verify` exit 0, 563 pass. closed by build. Re-examined 2026-10-06 by review (reviewer subagent): the close stands - dotted hosts with a port, upper case, `..`, `%2E` and the fullwidth dot are all refused naming only the variable; an IPv4 host's dot is normalised away by URL; no configured value ends in a dot.

### 16a-sites-by-host/F-281 [P3] closed - A scheme-less or empty `PLATFORM_URL`/`SITES_URL` crashes startup with a bare `TypeError` that names no variable and prints the value
File: app/lib/hosts-env.server.ts:7-11 (`isBareOrigin`)

# F-281 - A scheme-less or empty `PLATFORM_URL`/`SITES_URL` crashes startup with a bare `TypeError` that names no variable and prints the value

**Found:** 2026-10-06 by review (scope: current, 85b26a6..c09d62b; every lens; reviewer subagent). Introduced in 0e6ad62, widened to `PLATFORM_URL` by 91afeae.
**Why it matters:** Zod 4's `z.url` issue does not abort, so `.refine(isBareOrigin)` still runs and `new URL` throws `ERR_INVALID_URL` (with the value as `input`) inside `safeParse`; `parseEnv` never reports. Hit by copying `.env.example` (empty) or omitting the scheme. Breaks coding-standards' "naming the variable and rule, never its value". Reproduced: `SITES_URL=habre.page` throws `TypeError ERR_INVALID_URL`.
**Suggested fix:** In `isBareOrigin`, `URL.parse(value)` and return true when null (z.url reports it); fix the comment; unit test that `""` and `habre.page` throw a ZodError naming the variable.
**Resolution:** Closed 2026-10-06 by build. `isBareOrigin` uses `URL.parse` and returns true for a value that is not a URL, leaving `z.url`'s issue to report it naming the variable; the false comment is corrected. Test `an empty or scheme-less origin is refused naming the variable, not thrown as a TypeError` (`hosts-env.server.test.ts`, `""` and `habre.page` for both variables) failed with `hosts-env.server.ts` reverted (fail 1) and passed with it back (pass 9); `npm run verify` exit 0, 564 pass. closed by build. Re-examined 2026-10-06 by review (reviewer subagent): the close stands - through the real `parseEnv`, `""`, `habre.page`, `https://[::1].` and other invalid values each report `Invalid URL` at the variable without the value; z.url itself uses `URL.parse`, so nothing passes both checks; no other env file has the pattern.
