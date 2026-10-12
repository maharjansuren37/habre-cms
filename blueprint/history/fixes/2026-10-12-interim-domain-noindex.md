# Fix: surenmaharjan.fyi until the platform domain is bought, sites on habre.page, and nothing crawlable

**Type:** Fix
**Branch:** fix/interim-domain-noindex
**Verified:** 2026-10-12, bf41fd328be7 - no separate `verify` pass; every behavioural done-when proven live in build against the served production build: `npx playwright test e2e/no-index.spec.ts e2e/seo.spec.ts` 26 passed (build and both reviews), `caddy adapt` in `caddy:2` exit 0 with the interim values
**Reviewed:** 2026-10-12, bf41fd328be7, current, every lens (accessibility n/a), re-review read whole except caddy-ask.ts, server.js, seo.spec body, decisions.md - 0 blocking; F-430, F-432, F-433 closed; F-434, F-435 open (P3), F-436 unverified

## Goal

Let the v1 deploy go out before the platform domain is bought (owner,
2026-10-12): the platform at `app.surenmaharjan.fyi`, sites at
`<address>.habre.page` (bought 2026-10-12; first planned as
`<address>.sites.surenmaharjan.fyi`), site 1 staying on `surenmaharjan.fyi`
as its own domain. And keep every host out of search engines for the beta: no
host may be crawled or indexed.

## In scope

- A `SEARCH_INDEXING` switch (`on` by default, `off`): when off, `/robots.txt`
  on every host - platform, subdomain site, own domain - disallows everything
  with no `Sitemap:` line, and every response the app sends carries
  `X-Robots-Tag: noindex, nofollow`. Production sets it to `off`.
- `deploy/caddy/habre-cms.caddy`: take out the platform apex/www redirect
  block. With `HABRE_PLATFORM_DOMAIN=surenmaharjan.fyi` it defines
  `surenmaharjan.fyi` and `www.surenmaharjan.fyi` a second time (site 1's own
  blocks), which Caddy refuses. A comment says to put it back with a bought
  platform domain.
- Records: D153 amended (interim domains, and the accepted risk), needs-you
  lines for the domain, the token and the DNS records, production-pending.

## Out of scope

- Buying the platform domain and switching to it later - a later fix restores
  the block and changes the two platform values; `SEARCH_INDEXING` turns back
  on when the owner wants it.
- The Cloudflare token, Caddy DNS module, `on_demand_tls ask` line and DNS
  records on the server - the owner's, via `host` (F-426).
- Static files `server.js` serves itself (`/assets/*`): they are JS, CSS and
  fonts, which no search engine lists as pages. Disallowed by robots.txt anyway.

## Build steps

- [x] **Step 1 - `SEARCH_INDEXING`** - `SEARCH_INDEXING: z.enum(["on", "off"])`,
  default `on`, blank is `on`, in the environment schema; `.env.example`
  documents it. `app/features/seo/robots.ts` returns
  `User-agent: *\nDisallow: /\n` on every host when it is `off`.
  `server/app.ts` sets `X-Robots-Tag: noindex, nofollow` on every response
  from the request handler when it is `off`. The host-split test server in
  `playwright.config.ts` runs with `SEARCH_INDEXING=off`. *Done when:* a unit
  test shows the variable parses `on`, `off`, blank and unset, and refuses
  anything else naming `SEARCH_INDEXING`; a browser test against the
  host-split server shows a site host's and the platform's `/robots.txt` is
  `Disallow: /` with no `Sitemap:`, and a site's home page, its `/sitemap.xml`
  and the platform's `/admin/login` each carry `X-Robots-Tag: noindex,
  nofollow`; the existing `e2e/seo.spec.ts` robots tests still pass on the
  primary server (default `on`), whose site home page has no `X-Robots-Tag`.
  Run by `npm test` and `npm run test:e2e` (local, and CI's `e2e` job).
- [x] **Step 2 - the Caddy file** - remove the
  `{$HABRE_PLATFORM_DOMAIN}, www.{$HABRE_PLATFORM_DOMAIN}` block; a comment in
  its place names this fix and says to restore it with a bought platform
  domain; the header comment's example values gain the interim pair. *Done
  when:* `caddy adapt` in the stock `caddy:2` Docker image, on a copy of the
  file with the `tls { dns cloudflare ... }` lines stripped (the stock image
  has no Cloudflare module) and `HABRE_PLATFORM_DOMAIN=surenmaharjan.fyi`,
  `HABRE_SITES_DOMAIN=sites.surenmaharjan.fyi`, exits 0; the same check on
  `main`'s file fails with an ambiguous/duplicate site address error. The
  real check stays `setup-server.sh`'s `caddy validate` on the server.
- [x] **Step 3 - Repair F-430 to F-433** - the records: `AGENTS.md`'s
  development and production rows name `SEARCH_INDEXING` and the interim
  values; `production-pending.md`'s 16a/16b lines point at the interim
  domains and the nameserver move (this spec's Production needs carry the
  rest at `ship`); `needs-you.md` gains the nameserver move with its
  hardening, and the site-1 domain warning (F-433). `playwright.config.ts`
  pins `SEARCH_INDEXING=on` on the primary and proxied servers (F-431);
  `server/app.ts` drops `noIndex`'s unreachable fallback (F-432). *Done
  when:* with `SEARCH_INDEXING=off` exported, `npx playwright test
  e2e/no-index.spec.ts` fails its "indexing on" test before the config
  change and passes after; `npm run verify` and `e2e/no-index.spec.ts`
  pass; the records name `SEARCH_INDEXING=off` for production.
- [x] **Step 4 - sites on `habre.page`** - the owner bought `habre.page`
  (2026-10-12), so the interim sites domain is `habre.page`, not
  `sites.surenmaharjan.fyi`: the Caddy file's header comment, `AGENTS.md`'s
  production row, `production-pending.md`'s 16a/16b lines and `needs-you.md`
  say so; the Cloudflare token is for the `habre.page` zone; `surenmaharjan.fyi`
  stays on Porkbun's DNS (it needs only an `app` record), so the nameserver
  move line becomes a hardening line. *Done when:* `caddy adapt` as in Step 2
  with `HABRE_SITES_DOMAIN=habre.page` exits 0 and lists `*.habre.page`; no
  record still names `sites.surenmaharjan.fyi` except as the first plan
  (`grep -rn 'sites.surenmaharjan' AGENTS.md blueprint/production-pending.md
  blueprint/context/needs-you.md deploy/`).

## Files and areas

- `app/lib/env.server.ts` (or a small `*-env.server.ts` beside it, the
  `hosts-env` pattern, so `node --test` can exercise it), `.env.example`
- `app/features/seo/robots.ts`, `server/app.ts`
- `playwright.config.ts`, `e2e/seo.spec.ts` (or a new `e2e/no-index.spec.ts`)
- `deploy/caddy/habre-cms.caddy`
- `AGENTS.md` environments rows (the new variable), `blueprint/production-pending.md`

## Data and contracts

None stored. One new environment variable, `SEARCH_INDEXING` (`on` | `off`,
default `on`).

## Testing

Unit: the variable's parse rules (`npm test`, in `verify` and CI). Browser:
the host-split server with indexing off, the primary server with it on
(`npm run test:e2e`, local and CI `e2e` - needs no R2). Caddy: Docker
`caddy:2 caddy adapt`, local only - CI has no step for it.

## Decisions

- **D153 amended, interim (2026-10-12):** until the platform domain is
  bought, `PLATFORM_URL=https://app.surenmaharjan.fyi`; sites are on the
  bought sites domain, `SITES_URL=https://habre.page`, so customer sites do
  not share a registrable domain with sign-in - D153's split holds for
  sites. The wildcard certificate is `*.habre.page`, DNS challenge on the
  `habre.page` zone; `habre.page`'s apex has no block. While interim, site 1's own domain must not be removed: the app refuses to
  re-add a domain under the platform's parent (F-433). Also accepted: the
  session cookie has no `__Host-` prefix, so anything served on the apex or
  another `*.surenmaharjan.fyi` host could plant a parent-domain cookie; and
  site 1's pages are same-site with the admin, so the Lax session cookie is
  sent on their subresource requests - no path found, as content renders no
  raw HTML and admin POSTs are origin-checked (F-436). Both end when the
  platform moves to its own domain. Email is sent from `surenmaharjan.fyi`
  while interim, never `habre.page` (F-434).
- **The DNS challenge runs on Cloudflare, for `habre.page`; `surenmaharjan.fyi`
  stays on Porkbun's DNS** (owner, 2026-10-12). Beat a Porkbun DNS module for
  Caddy: a Cloudflare token can be limited to DNS edit on one zone, filtered
  to the server's IP and given an expiry, and cannot change nameservers,
  while a Porkbun API key reaches every API-enabled domain in the account.
  `surenmaharjan.fyi` needs no token - `app.` and the apex get ordinary
  certificates - so it does not move. First decided as moving
  `surenmaharjan.fyi` to Cloudflare, before `habre.page` was bought.
- **`SEARCH_INDEXING=off` blocks crawling at the app, not at Caddy.** Beat
  Caddy-only headers and a Caddy-answered robots.txt: those would make seo.2
  false in production while every test says it holds, could not be tested
  without a Caddy, and a self-hoster without our Caddy file would get
  nothing. Both robots.txt (crawling) and `X-Robots-Tag` (indexing a URL
  found through a link) - robots.txt alone still lets a linked URL be listed.

## Production needs

- `SEARCH_INDEXING=off`, `PLATFORM_URL=https://app.surenmaharjan.fyi`,
  `SITES_URL=https://habre.page` in `/etc/habre-cms/production.env`.
- `/etc/caddy/habre-cms.env`: `HABRE_PLATFORM_DOMAIN=surenmaharjan.fyi`,
  `HABRE_SITES_DOMAIN=habre.page`, and a Cloudflare token with DNS edit on
  the `habre.page` zone only.
- DNS: `habre.page` on Cloudflare with `*` pointing at `ocwebserver`, DNS
  only (grey cloud); at Porkbun, `app.surenmaharjan.fyi` pointing at
  `ocwebserver`.

## Behaviour changes

- Changes `seo.2` from "the platform host's `/robots.txt` disallows everything; a site's allows everything and names its sitemap on the main address" to "the platform host's `/robots.txt` disallows everything; with `SEARCH_INDEXING` on (the default), a site's allows everything and names its sitemap on the main address" - Step 1
- Adds to `seo`: with `SEARCH_INDEXING=off`, every host's `/robots.txt` disallows everything with no sitemap line, and every response carries `X-Robots-Tag: noindex, nofollow` - Step 1

## Notes

- React Router's `redirect()` builds a Response with mutable headers, so
  `server/app.ts` sets the header in place; no route returns
  `Response.redirect()` (F-432). The Step 1 browser test includes a redirect
  (the platform's `/` -> `/admin`).

- Indexing off makes the needs-you "real share preview and sitemap" check
  impossible until it is turned back on; that line says so.
- Share previews (Facebook, LinkedIn) still fetch pages - they ignore
  `noindex` - which is fine: nothing is listed in search.

## Findings

### 2026-10-12-interim-domain-noindex/F-430 [P2] closed - The interim fix's deploy records are not written, so nothing tells the deploy to set SEARCH_INDEXING=off
File: blueprint/production-pending.md:42, :66; AGENTS.md (Environments rows)

**Found:** 2026-10-12 by review (scope: current; lens: all)
**Why it matters:** The spec puts the D153 amendment, `production-pending.md` and the `AGENTS.md` environment rows in scope, but no build step writes them. `deploy` reads `production-pending.md`, which still says "no new environment variables", and `SEARCH_INDEXING` defaults to `on`: the v1 release would go out indexable.
**Suggested fix:** A Step 3 for the records: production-pending (`SEARCH_INDEXING=off`, interim `PLATFORM_URL`/`SITES_URL`, `HABRE_*` values, the `app` and `*.sites` DNS records), the `AGENTS.md` development and production rows. D153's amendment is `ship`'s, from the spec's Decisions.
**Resolution:** Step 3 (build, 2026-10-12): AGENTS.md development and production rows name SEARCH_INDEXING and the interim values; production-pending 16a/16b lines point at the interim domains and the nameserver move; the spec's Production needs name SEARCH_INDEXING=off for `ship` to carry. Re-review 2026-10-12 (review, scope current): defect gone, nothing new - closed.

### 2026-10-12-interim-domain-noindex/F-431 [P3] closed - The primary test server does not pin SEARCH_INDEXING, so a local .env with it off fails the robots tests
File: playwright.config.ts:45

**Found:** 2026-10-12 by review (scope: current; lens: tests)
**Why it matters:** `npm start` loads `.env`; the primary server's command sets no `SEARCH_INDEXING`, so `SEARCH_INDEXING=off` in a developer's `.env` fails `e2e/no-index.spec.ts`'s "indexing on" test and the robots tests in `e2e/seo.spec.ts`. The config pins every other variable for this reason.
**Suggested fix:** `SEARCH_INDEXING=on` in the primary (and proxied) server commands in `playwright.config.ts`.
**Resolution:** Step 3 (build, 2026-10-12): `SEARCH_INDEXING=on` on the primary and proxied servers. Red: `SEARCH_INDEXING=off npx playwright test e2e/no-index.spec.ts` - 1 failed ("indexing on" test, received "noindex, nofollow"). Green after the repair, same command: 3 passed. Closed by build.

### 2026-10-12-interim-domain-noindex/F-432 [P3] closed - noIndex's copy-the-response fallback is unreachable and untested
File: server/app.ts:27-38

**Found:** 2026-10-12 by review (scope: current; lens: quality, tests)
**Why it matters:** React Router's `redirect()` builds a Response with mutable headers, and no route returns `Response.redirect()` or a raw `fetch()` response, so the `catch` branch never runs; the spec's note that the redirect test covers it is wrong. The copy itself looks correct.
**Suggested fix:** Drop the try/catch, or move `noIndex` to a pure `app/lib/*.ts` taking the setting as a parameter and unit-test it with `Response.redirect()`.
**Resolution:** Step 3 (build, 2026-10-12): try/catch removed; noIndex sets the header in place. Behaviour unchanged - e2e/no-index.spec.ts (incl. the redirect) 3 passed. No test can reach the removed branch, so left for review. Re-review 2026-10-12 (review, scope current): defect gone, nothing new - closed.

### 2026-10-12-interim-domain-noindex/F-433 [P3] closed - Under the interim domains, site 1's own domain cannot be re-added once removed
File: app/features/own-domain/own-domain.ts:47-53

**Found:** 2026-10-12 by review (scope: current; lens: quality)
**Why it matters:** With `PLATFORM_URL=https://app.surenmaharjan.fyi`, `normalizeDomain` (`app/features/own-domain/own-domain.ts:47-53`) refuses `surenmaharjan.fyi` as reserved. The seed row from `0015` still serves, but pressing Remove on `/admin/plan` takes site 1 off its domain and only SQL puts it back. The same rule correctly stops any `*.surenmaharjan.fyi` own domain taking over `app.` or `sites.`.
**Suggested fix:** No code: a sentence in the D153 amendment and needs-you - do not remove site 1's domain while interim; restore by SQL.
**Resolution:** Step 3 (build, 2026-10-12): needs-you line "Do not remove site 1's surenmaharjan.fyi ..." and the spec's D153 amendment say so. No code. Re-review 2026-10-12 (review, scope current): defect gone, nothing new - closed.
