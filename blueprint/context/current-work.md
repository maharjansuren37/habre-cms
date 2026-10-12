# Feature: Own domain

**From build plan:** item 21c
**Type:** Feature
**Verified:** 2026-10-12, 1a7a7b2a87d5, 5 of 7 proven (steps 1-5 by browser and unit tests against the running app); step 6 proven with fakes only (the timer, the https pre-warm and the 15 s refresh never ran live: SITES_URL is http in every test); step 7 could not verify (`caddy` not installed here, so the new file and the setup-server.sh import were never validated)
**Reviewed:** 2026-10-12, 1a7a7b2a87d5, current, every lens, read whole except the e2e spec's bodies and the unit tests' bodies (skimmed) - 0 blocking (6 P2/P3 raised, F-414 to F-419; run inside autopilot, so a self-review)

## Goal

An admin of a Launch site can attach their own domain from `/admin/plan`: the
page shows the two DNS records to create, a **Check now** button proves them,
and once they hold the domain becomes the site's main address (D173) - the
subdomain redirects to it and Caddy issues its certificate on first visit. An
admin can remove it again. Without this, Launch's "use your own domain"
promise (D175) is only true for site 1's seeded row.

## In scope

- Migration `0026`: `site_domains.verification_token`, and the app role's
  insert and update on **named columns only** (0015 revoked both; D153 left
  them for item 21).
- One domain per site added through the admin (site 1's seeded row is one).
- Ownership proof: a TXT record at `_habre-verify.<domain>` holding
  `habre-verify=<token>`. Reach proof: the domain's A/AAAA addresses (a CNAME
  is followed) include one of the site's own subdomain's. Both must hold to
  verify; neither alone does, because a verified domain *becomes the main
  address* and an unreachable one would take the site off.
- Rules for a domain: lowercase, internationalised names converted to ASCII,
  at least two labels, not an IP, not the platform or sites domain or under
  either. A domain is not accepted while another site holds it verified, or
  holds it unverified and younger than 24 hours; an older unverified claim is
  replaced (so nobody can squat someone else's domain by typing it first).
- Launch only to **add**. A site that later drops to Free keeps serving a
  verified domain (D150: a limit refuses an action, never the published
  site); it just cannot add another.
- **Check now** is rate-limited per site (10 an hour, in memory like the
  resend limits).
- **Automatic re-check:** an in-process timer (like the `ai_runs` runner,
  D154) re-checks every waiting domain younger than 24 hours - every minute
  for its first 10 minutes, every 5 until 2 hours, then every 30 - so the
  person never has to press anything. It resumes after a restart from the
  database. The waiting state refreshes itself every 15 s while open.
- **Pre-warm:** the moment a domain verifies, the app makes one HTTPS request
  to it, which makes Caddy fetch the certificate before any visitor arrives.
  Fire and forget; its failure is logged and changes nothing.
- `GET /_caddy/ask?domain=<host>` for Caddy's on-demand TLS: 200 only for a
  verified domain of a site that is not suspended, 404 otherwise, and 404 for
  anything that arrived through the proxy.
- Caddy: a catch-all `https://` block with `tls { on_demand }` in
  `deploy/caddy/habre-cms.caddy`; the global `on_demand_tls { ask ... }`
  option is the server's main Caddyfile's, so it is recorded as a host change
  (Production needs), not made here.
- `design.md`: the Own domain section's states (Plan row, "deferred to item
  21", is stale since 21a).

## Out of scope

- Several domains per site, `www` handling, apex-to-www choice: one domain, the
  one the person typed. Later, if asked.
- Cloudflare proxied ("orange cloud") domains: their addresses are not ours,
  so the reach check says "not pointing here yet". Documented on the page.
- Changing the subdomain (D173: breaks shared links).
- Dropping a verified domain when a site returns to Free, or re-verifying
  periodically - a decision for later; see Decisions.
- An email when a domain verifies, a "certificate ready" status, one-click
  DNS setup (Domain Connect) and Cloudflare for SaaS: revisit if own
  domains become common.
- Any change to the main Caddyfile or the server (`host`, its own yes).

## Design reference

`blueprint/context/design.md` - the Plan screen's shape from 21a/21b (`h1`,
`section` per thing with an `h2`, `role="status"` banners, `Message`, `Button`).
New: a records `table` (caption, Type / Name / Value columns, the value in
`code`) and a status line per state. Step 6 records it in `design.md`.

## Build steps

- [x] **Step 1 - Migration `0026` and grants** - add `verification_token text`
  and `last_checked_at timestamptz` to `site_domains`; grant the app role
  `insert (domain, site_id, verification_token)` and `update (verified_at,
  verification_token, last_checked_at)`; mirror
  it in `db/roles.sql` so a re-run does not widen or drop it (F-270).
  Reversible (drop the column, revoke). *Done when:* `npm run db:migrate`
  applies it; as the app role an insert of those columns works, an update of
  `site_id` or `domain` is refused, and site 1's seeded row is untouched
  (asserted in `e2e/own-domain.spec.ts`, which connects with both URLs).
- [x] **Step 2 - The rules, pure** - `app/features/own-domain/own-domain.ts`:
  `normalizeDomain` (trim, lowercase, drop a trailing dot, `domainToASCII`, the
  0015 pattern; refuses a scheme, a path or port, IPs, and anything equal to or
  under the platform or sites host), `verificationRecords`
  (the TXT name and value, and what the reach record should resolve to),
  `decideVerification` (given the TXT answers and the two address sets, one of
  `verified`, `no-txt`, `wrong-txt`, `not-pointing`, `lookup-failed`), and
  `canReplaceClaim` (the 24-hour rule). *Done when:* `npm test` passes
  `own-domain.test.ts`, one test per outcome above and per refusal, including
  `Example.COM.`, `münchen.de`, `1.2.3.4`, `app.<platform domain>`, `a`,
  and a CNAME-style address overlap.
- [x] **Step 3 - Lookups and store** - `own-domain-dns.server.ts` (a
  `node:dns` `Resolver` with a 2 s timeout and one try; `ENOTFOUND`,
  `ENODATA`, `ECONNREFUSED` and a timeout are answers, not errors) and
  `own-domain.server.ts`: `addDomain`, `checkDomain`, `removeDomain`, each
  scoped by `site_id` (platform table, no `inSite`), add refusing a Free
  site, a second domain and a domain held as above. The token is
  `randomBytes(16).toString("hex")`. A successful check sets `verified_at` in
  one `update ... where verified_at is null`. *Done when:* `npm test` passes
  the rate-limit unit test (the 11th check in an hour is refused, the 10th is
  not); the store's behaviour is proved by Step 5's browser tests, which run
  against the database.
- [x] **Step 4 - Caddy's ask endpoint** - resource route
  `app/features/own-domain/caddy-ask.ts` at `/_caddy/ask`, in
  `app/routes.ts`; `classifyHost` lets that path through for a loopback host
  only (`127.0.0.1`, `localhost`, `[::1]`, any port); the route also answers
  404 when `X-Forwarded-For` or `X-Forwarded-Host` is present, which Caddy
  sets on everything it proxies. GET only. *Done when:* `npm test` passes new
  `classifyHost` cases (loopback allowed, `app.<platform>` and a site host
  not, a POST not), and `e2e/own-domain.spec.ts` shows: 200 for a verified
  domain and 404 for an unverified one, an unknown one, a suspended site's,
  and the same request with `X-Forwarded-Host` set.
- [x] **Step 5 - The Own domain section** - on `/admin/plan` (admin only
  already): states **Free with billing on** (what Launch adds, link to the
  upgrade area above), **Free with billing off** ("Paid plans coming soon"),
  **Launch, none yet** (a form: Domain, Add), **waiting** (the two records in
  a `table`, the "turn Cloudflare's proxy off" note, **Check now**, **Remove**,
  and why it is not verified yet, one sentence per outcome), **verified**
  ("*domain* is your site's address. *address* redirects to it."), and the
  refusals (taken, invalid, Free, too many checks). Three intents on the
  existing action, same body-size guard. *Done when:* `npm run test:e2e`
  passes `e2e/own-domain.spec.ts`: a Launch admin adds `example.invalid`,
  sees the records and "not found yet" after Check now; removing it brings
  the form back; a Free admin sees no form; another site's admin cannot
  see, check or remove the first site's domain (tampered request answers
  400); a row set verified through the owner connection shows the verified
  state and, with `SITES_URL` http, still serves on the subdomain.
- [x] **Step 6 - Automatic re-check and pre-warm** -
  `own-domain-schedule.ts` (pure: `isDue(createdAt, lastCheckedAt, now)` from
  the 1 / 5 / 30 minute ladder, and `null` after 24 hours) and
  `own-domain-checker.server.ts` (a timer every 30 s, started with the server
  like the AI runner; picks up to 20 due unverified rows, checks them one at a
  time through Step 3's `checkDomain`, writes `last_checked_at`; on a new
  verification makes one `https://<domain>/` request with a 5 s timeout, errors
  logged). Not started when `SITES_URL` is http, because own domains are served
  only over https there and the pre-warm would reach nothing. The waiting
  state calls `useRevalidator` every 15 s. *Done when:* `npm test` passes
  `own-domain-schedule.test.ts` (due at 1 min, not at 30 s; due at 5 min
  between 10 min and 2 h; due at 30 min after; never after 24 h; never
  verified; a null `last_checked_at` is due at once) and a test of the
  checker's loop with a fake store, resolver and fetch showing: a due row is
  checked, a verification triggers exactly one pre-warm, a thrown lookup does
  not stop the next row, and a pre-warm failure is logged and swallowed.
- [x] **Step 7 - Caddy file, docs, records** _(built inline; `caddy` is not installed here, so `caddy validate` was not run)_ - the catch-all block in
  `deploy/caddy/habre-cms.caddy` (with the ask's reason in its comment);
  `design.md` Plan row and an Own domain note; `blueprint/context/needs-you.md`
  two lines (below); `deploy/setup-server.sh` message that the global option
  is still the owner's if it refuses on its absence (read the script first;
  if it validates the adapted file, `caddy validate` must still pass without
  the option - on-demand without `ask` is refused by Caddy, so the catch-all
  must be skipped until the option exists, or the script must say so).
  *Done when:* `caddy validate` of the file with the option present passes
  where Caddy is installed, or, where it is not, the spec's Notes say it was
  not run; `npm run verify` passes.

## Files and areas

- `db/migrations/0026_own_domain.sql`, `db/roles.sql`
- `app/features/own-domain/` (new: `own-domain.ts`, its test,
  `own-domain-dns.server.ts`, `own-domain.server.ts`, `caddy-ask.ts`, rate
  limit, `own-domain-schedule.ts`, `own-domain-checker.server.ts`)
- `server/app.ts` or wherever the AI runner starts (read it in Step 6)
- `app/features/plans/plan-page.tsx` (+ module CSS), `plan-view.ts`
- `app/lib/host-routing.ts` and its test, `app/routes.ts`
- `deploy/caddy/habre-cms.caddy`, possibly `deploy/setup-server.sh`
- `e2e/own-domain.spec.ts`; `blueprint/context/design.md`

## Data and contracts

- `site_domains.verification_token text` null for the seeded row and once
  verified (cleared on verify; the TXT record is no longer needed).
  `last_checked_at timestamptz` null until the first check; the schedule's
  only input besides `created_at`.
- App role: `insert (domain, site_id, verification_token)`,
  `update (verified_at, verification_token, last_checked_at)`, `select`, `delete`. **Load-
  bearing:** nothing may be able to change `site_id` or `domain` of an
  existing row.
- Records contract (shown to people, so fixed): TXT name
  `_habre-verify.<domain>`, value `habre-verify=<token>`; reach: A/AAAA of
  the domain overlaps those of `<subdomain>.<sites domain>`.
- `/_caddy/ask?domain=` returns an empty 200 or 404, nothing else.
- `findSiteByDomain` and `mainHost` are unchanged: a verified row already
  serves its site and becomes the main address (sites.6, sites.7, sites.14).

## Testing

- Unit (`npm test`, no database): the rules, the decision, the rate limit,
  `classifyHost` additions.
- Browser (`npm run test:e2e`, needs the development database; CI's `e2e`
  job has one): `e2e/own-domain.spec.ts` as in Steps 1, 4 and 5. It uses
  `example.invalid`, which cannot resolve, so the offline and CI answer is
  the same "not found yet". **The verified path has no automated end to end
  test**: it needs a real domain in DNS and Caddy; the success decision is
  unit-tested with a fake resolver, and the live round trip is a needs-you
  line.
- `quality-bar.md`: no hot path is touched (`findSiteByDomain` is unchanged).
  The ask endpoint is one indexed query by primary key.

## Decisions

- **One domain per site, added in the admin** - beats several (a main-address
  choice, a redirect set, a UI for it) that nobody has asked for.
- **Both a TXT record and a reach check to verify** - beats TXT alone (a
  verified domain would become the main address while pointing nowhere) and
  reach alone (anyone could claim a domain that happens to point at the
  platform, e.g. through a shared CNAME target).
- **Reach compared with the site's own subdomain's addresses** - beats a
  configured server IP: no new variable, and it keeps working after the
  server moves.
- **A verified domain keeps serving after a downgrade** - follows D150;
  beats dropping it, which takes a published site off the internet over a
  failed card. **Flagged for the owner at the gate**: the cost is a Free site
  with a custom domain indefinitely.
- **Unverified claims expire after 24 hours** - beats first-come forever
  (squatting) and beats allowing duplicates (the primary key is the domain,
  and changing it is a bigger migration).
- **Re-check automatically for 24 hours, in the process, then stop** - beats
  a Check now button alone (people forget, and DNS caches delay "not yet" by
  minutes) and a job queue or worker (D154's reasoning). 24 hours matches the
  claim's expiry; Check now still works after, until someone else claims it.
- **Pre-warm the certificate by requesting the domain once** - beats waiting
  for the first visitor, who would get a slow or failed first load, and
  beats polling Caddy (no API to read from here).
- **`/_caddy/ask` refuses anything that came through the proxy** - beats a
  shared secret (no new variable) and an open endpoint (it would tell anyone
  which domains are verified).

## Production needs

- Migration `0026`, additive; no data change. Needs `npm run db:migrate` as
  the owner, as every migration.
- **A host change, the owner's yes** (`host`): in the server's main Caddyfile
  global options, `on_demand_tls { ask http://127.0.0.1:3000/_caddy/ask }`
  (the app's port as in `habre-cms.service`), then reload Caddy. Until it is
  there the repository's catch-all block must not be loaded (Step 6).
- No new environment variables.
- DNS for a customer's domain is theirs; nothing for the owner to configure
  per domain.

## Behaviour changes

- New capability `own-domain`: a Launch site's admin can add one own domain on `/admin/plan`, which shows the TXT and address records to create - Step 5
- Adds to `own-domain`: a domain is verified only when its TXT record holds the site's token and its addresses include the site's subdomain's - Step 3
- Adds to `own-domain`: an unverified domain does not serve the site and does not change its main address - Step 5
- Adds to `own-domain`: a domain that is the platform's, the sites domain's, under either, an IP, or held by another site is refused - Step 2
- Adds to `own-domain`: a Free site cannot add a domain, and sees what Launch adds - Step 5
- Adds to `own-domain`: an admin can remove their site's domain, and its subdomain serves it again - Step 5
- Adds to `own-domain`: an admin of another site cannot see, check or remove a site's domain - Step 5
- Adds to `own-domain`: Check now is refused after ten checks in an hour for one site - Step 3
- Adds to `own-domain`: a waiting domain is re-checked without any click for 24 hours, and verifies as soon as its records hold - Step 6
- Adds to `own-domain`: a domain that verifies is requested once over https so its certificate is ready before a visitor - Step 6
- Adds to `own-domain`: `/_caddy/ask` answers 200 only for a verified domain of an unsuspended site, and 404 for any request that came through the proxy - Step 4

## Notes

- Capability file `blueprint/capabilities/own-domain.md` is created by `ship`
  from the section above; `plans.md` and `sites.md` do not change.
- React Router 8: the action keeps 21b's shape (`data(...)` for refusals,
  `redirect` only for Stripe). Read the installed docs before adding a
  second `Form`, as the page already has two.
- Own domains are served only where `SITES_URL` is https (`mainHost`), so
  nothing here changes behaviour in development.
- No automated check fetches a certificate: Let's Encrypt cannot reach a
  laptop. That is `needs-you`.
- `ownDomainSql` and `findSiteByDomain` already filter by `verified_at`; do
  not duplicate that filter in the new code.
- Step 7's `setup-server.sh` question must be answered by reading the
  script, not assumed; if the catch-all cannot be safely loaded before the
  global option exists, ship the block commented out with the instruction
  beside it and say so.
