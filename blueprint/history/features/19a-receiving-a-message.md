# Feature: Receiving a message (19a)

**From build plan:** item 19a
**Type:** Feature
**Verified:** 2026-10-12, 3c34e730968e, 574 browser tests passed live (npm run test:e2e, 6.2m), npm run verify green, after the F-394..F-396 repairs
**Reviewed:** 2026-10-12, 3c34e730968e, current, every lens (third pass) - 0 blocking

## Goal

A visitor's message can reach a site and be kept for it: `POST /_contact` on a
site host stores a name, email and message against that site and the page the
form was on, behind D157's spam guards. No screen and no block yet - 19b is the
form, 19c is Messages and the email. This is the riskiest part of item 19 (the
only state-changing route on a site host, and visitors' personal data), so it
is built and proved on its own, by POSTing.

## In scope

- Migration `0021_contact_submissions.sql`: the table, row-level security, an
  index; `deleteAccount` removes a taken site's rows.
- The cross-site rule for site hosts: today `refuseCrossSiteRequests` compares
  every state-changing request's `Origin` with the **platform** origin, so a
  browser POST from a site is refused 403. Site hosts now accept exactly one
  state-changing path, `/_contact`, and only with the site's own origin.
- `/_contact`: body-size cap, field validation (Zod), honeypot, signed
  minimum-fill-time token, per-IP-per-site and per-site limits, entry check,
  insert, 303 back to the page.
- Security-log events for the refusals and the rate limit. Never a name, email
  or message in a log line.

## Out of scope

- The form block, its rendering, the token's issuing in a page (19b - the
  `issueContactToken` helper exists here and 19b calls it).
- `/admin/messages`, mark read, deleting a message, the notification email,
  `notified_at` being set (19c; the column exists, stays empty).
- A captcha (D157: only if spam gets through). A JSON answer for `fetch` (19b
  decides if it wants one; the 303 works with or without JavaScript).
- Checking that the target page actually holds a contact block (19b).

## Design reference

None - no visible screen. The answer codes below are the contract 19b renders.

## Build steps

- [x] **Step 1 - The table** - `db/migrations/0021_contact_submissions.sql`:
  `id uuid`, `site_id` (restrict, like every site-owned table), `entry_id`
  (references `entries`, `on delete set null`, so deleting a page keeps its
  messages), `name` (1-100), `email` (1-254), `message` (1-5000), `created_at`,
  `notified_at`, `read_at` (both null), index `(site_id, created_at)`, the same
  `site_isolation` policy as 0011/0020, the explicit grant. `deleteAccount`
  deletes the site's rows (beside `ai_runs`, `account.server.ts`). Header
  comment says: additive, release rollback by symlink safe, reversible by
  `drop table contact_submissions`. *Done when:* `npm run db:migrate` applies
  it on the development database; `e2e/site-isolation.spec.ts` gains a check
  that the app role with no site set reads zero rows, with site A set reads
  only A's, and cannot insert a row naming B; `e2e/account-delete.spec.ts`'s
  site-deletion case leaves no `contact_submissions` row for the site (owner
  connection).
- [x] **Step 2 - Site hosts accept one POST** - a pure
  `isAllowedSiteRequest(method, pathname, headers, siteOrigin)` beside
  `isAllowedRequest` in `app/lib/same-origin.ts`: safe methods pass; `POST` to
  exactly `/_contact` passes when `Origin` equals `siteOrigin` (the request's
  own origin - the site was resolved from this host), or, with no `Origin`,
  `Sec-Fetch-Site: same-origin`; everything else is refused. Root
  middleware uses it for requests that resolved to a site and keeps the
  platform-origin rule for the platform host (the existing log event is
  reused). *Done when:* `same-origin.test.ts` covers: own origin on
  `/_contact` allowed; platform origin on `/_contact` refused; another site's
  origin refused; no `Origin` and no `Sec-Fetch-Site` refused; own origin on
  `/admin/...`, `/_contact/x` and `/posts` refused; `GET` unchanged.
  `host-routing.test.ts`: `POST /_contact` is `subdomain` on a site host,
  `not-found` with `platformHost` on the platform host.
- [x] **Step 3 - The guards, pure** - `app/features/contact/`:
  `contact-message.ts` (Zod: trimmed `name`, `email` shape, `message`, the
  lengths above, control characters stripped except newlines; the answer-code
  union), `contact-token.server.ts` (`issueContactToken(now)` and
  `checkContactToken(token, now)` returning `ok | too_fast | stale | invalid`:
  `<issued-ms>.<HMAC-SHA-256 with JWT_SECRET>`, timing-safe compare;
  too fast under 3 s, stale over 24 h), `contact-rate-limit.server.ts` (two
  `createRateLimiter`s: 5 attempts an hour per `siteId:rateLimitKeyForIp(ip)`,
  100 an hour per site). Extend `SecurityEvent` with `contact_rate_limited
  { scope: "ip" | "site"; siteId; ip }` and `contact_spam_dropped
  { reason: "honeypot" | "token"; siteId; ip }`. *Done when:* unit tests for
  validation (each bound, both sides; an address with no `@`; a message of
  only whitespace), token (round trip, forged HMAC, tampered time, too fast,
  stale, missing) and both limiters (the 6th attempt blocked, a different
  site's key unaffected).
- [x] **Step 4 - `/_contact`** - route `route("_contact",
  "features/contact/contact-submit.ts")` in `app/routes.ts`: a resource route
  exporting only `action` (so `GET` is 405). The order: refuse a body over
  16 KiB before reading it (413); read the form; count the attempt against
  both limiters (counted whether or not it validates, as signup does) and
  answer `busy` when blocked; honeypot field `url` non-empty -> answer `sent`,
  store nothing, log `contact_spam_dropped`; token `too_fast` / `stale` /
  `invalid` -> `again`; Zod failure -> `invalid`; `entry` must be a
  **published** entry of this site (looked up inside `inSite`, naming
  `site_id`), else `invalid`; insert inside `inSite`; answer `sent`. Every
  answer is a `303` to the entry's public address (the same path function the
  sitemap uses; `/` for the home page) with `?contact=sent|invalid|again|busy`.
  A suspended site answers 404 like its pages. *Done when:* a new
  `e2e/contact.spec.ts` (needs the development database; runs in CI's `e2e`
  job) POSTs to a site host with its own `Origin` and shows each case below.
- [x] **Step 5 - The two-site check** - extend `e2e/contact.spec.ts`: a
  submission to site A is in the table under A's `site_id` and not B's; an
  `entry` from site B posted to site A's host is `invalid` and stores nothing;
  a platform-host `POST /_contact` is 404 and stores nothing. *Done when:*
  `npm run test:e2e -- contact site-isolation` passes with the output shown.

`e2e/contact.spec.ts` cases (Step 4's done-when): valid message -> 303 to
`/<slug>?contact=sent`, one row with the right site, entry, name, email,
message, `notified_at` and `read_at` null; honeypot filled -> `sent`, no
row; token issued under 3 s ago -> `again`, no row; token forged -> `again`;
empty name / bad email / 5,001-char message -> `invalid`; 6th post from one IP
-> `busy` (to `/?contact=busy`), and a different `X-Forwarded-For` still works; draft entry ->
`invalid`; body over 16 KiB -> 413; cross-origin post (`Origin` of the platform
or another site) -> 403, no row; `GET /_contact` -> 405.

## Files and areas

- `db/migrations/0021_contact_submissions.sql` (new)
- `app/features/contact/` (new): `contact-message.ts`, `contact-token.server.ts`,
  `contact-rate-limit.server.ts`, `contact-store.server.ts` (insert; siteId
  first), `contact-submit.ts`, with a `.test.ts` beside each pure file
- `app/lib/same-origin.ts` (+ test), `app/root.tsx` (the middleware),
  `app/lib/host-routing.test.ts`, `app/lib/security-log.server.ts`
- `app/routes.ts`, `app/features/account/account.server.ts`
- `e2e/contact.spec.ts` (new), `e2e/site-isolation.spec.ts`,
  `e2e/account-delete.spec.ts`

## Data and contracts

**Load-bearing: 19b and 19c build on these.**

- Table `contact_submissions` as Step 1. Plan section 7 already names it.
- **Form fields:** `name`, `email`, `message`, `entry` (the page's entry id),
  `started` (the signed token), `url` (the honeypot: hidden, never filled by a
  person).
- **Answer codes**, in the redirect's `contact` query: `sent`, `invalid`,
  `again` (a fast, stale or missing token: "please send it again"), `busy`
  (too many from this address). The page keeps no state; 19b shows the
  right line and, for `invalid`, cannot restore the values without
  JavaScript - accepted, since a fast reader's retry is one retype.
- **Limits:** name 100, email 254, message 5,000 characters; body 16 KiB;
  5 attempts an hour per IP per site; 100 an hour per site; 3 s minimum, 24 h
  maximum token age.
- `issueContactToken(now)` is the only way a page gets a token.

## Testing

- Unit (`npm test`, inside `verify`, no database): origin rule, host
  routing, validation, token, limiters.
- Browser (`npm run test:e2e`, needs the development database; CI's `e2e` job
  has Postgres and runs it): `e2e/contact.spec.ts`, `site-isolation.spec.ts`,
  `account-delete.spec.ts`. None of it uploads to R2, so CI runs all of it.
- No test calls a mail server: nothing is sent in 19a.

## Decisions

- **Always a 303 to the page, with a code, not a JSON answer.** Works with no
  JavaScript (D157), one path for the browser and `fetch`. Beats: a JSON
  endpoint plus a no-JS fallback, two answers to keep in step. Costs: a
  rejected form loses its text without JavaScript.
- **A bot is told `sent`** when it fills the honeypot, and learns nothing.
  Beats: an error, which tells it which field gave it away. Costs: a person
  who fills a hidden field (a password manager gone wrong) loses a message
  silently - accepted, the field is `aria-hidden`, out of the tab order, and
  autocomplete is off (19b).
- **The minimum fill time is a signed token, not a bare timestamp**, HMAC with
  `JWT_SECRET`. Beats: an unsigned hidden timestamp a script sets itself.
  Costs: a rotated `JWT_SECRET` gives `again` to forms open at the time.
- **Two limits: per IP per site, and per site.** Beats: per IP only, which a
  botnet gets around and which would fill a site's Messages. Costs: a flood
  can lock out real visitors for up to an hour; the site is not harmed (D150).
- **Every attempt is counted, valid or not** - the signup rule.
- **The route exports a loader that answers 405.** React Router 8.4 answers a
  GET to an action-only route with 400, so the spec's `GET` -> 405 needs it
  (F-395). Beats: action only, which gives 400. Costs: one tiny export.
- **A `busy` answer goes to `/`, not the page.** The attempt is counted before
  the entry is looked up (F-394), so a flood costs the limiter, not the
  database. Costs: a refused visitor lands on the home page; 19b shows `busy`
  there.
- **A body over 16 KiB is refused before it is read** - answers F-389's class
  of problem for this route from the start.
- **`entry_id` is set null when its page is deleted**, so a message outlives
  its page. Beats: cascade, which would delete a visitor's enquiry because the
  owner tidied a page.

## Production needs

- Migration `0021_contact_submissions.sql` - additive, a new table; the previous
  release never reads it, so a release rollback by symlink is safe.
- No new environment variable. Uses `JWT_SECRET` (already required).

## Behaviour changes

- New capability `forms`: a visitor's `POST /_contact` from a site's own address stores a submission (name, email, message, the page) for that site alone and answers 303 back to the page with `contact=sent` - Step 4
- Adds to `forms`: a post from any other origin, from the platform host, or with no origin evidence is refused and stores nothing; `/_contact` is the only state-changing path a site host accepts - Step 2
- Adds to `forms`: a post with the hidden field filled is answered `sent` and stores nothing - Step 4
- Adds to `forms`: a post sent under 3 seconds after its form was issued, or with a missing, forged or day-old token, stores nothing and answers `again` - Step 4
- Adds to `forms`: more than 5 posts an hour from one address to one site are answered `busy` and stored nowhere - Step 4
- Adds to `forms`: an empty or over-long field, a malformed email, an entry that is not a published entry of this site, or a body over 16 KiB stores nothing (`invalid`, or 413 for the body) - Step 4
- Adds to `forms`: one site's submissions are unreadable by every other site and by the app with no site set - Step 1
- Adds to `accounts`: deleting a site's last account removes the site's contact submissions with it - Step 1

## Notes

- Quality bar - personal data: log events carry the site id and IP only; the
  `SecurityEvent` type has no field for a name, email or message, which is how
  that is held. Retention is until the site deletes them (19c adds deleting a
  message).
- `AGENTS.md`' stack facts and `design.md` need no change in 19a.
- Coding standards: `.server.ts` for the token, limiters and store; `#app/...`
  imports with extensions; `siteId` first in the store function, `inSite` plus
  `site_id` in the insert's own `where` (D151).
- **Receiver (owner, 2026-10-12):** the notification address is a per-site
  setting, with a default when empty (every active admin of the site). It is
  the email's concern, so it lands in 19c - a `site_settings` column, its
  Settings field and validation - not here; 19a stores the message and sends
  nothing. 19c's spec resolves the column name and whether "empty" falls back
  to admins or to the account owner.
- Note for 19b: `style` and CSP - `form-action 'self'` already allows the post.
- Backlog not tidied: 113 open P3s remain (declined, 2026-10-12).

## Findings

### 19a-receiving-a-message/F-394 [P2] closed - /_contact looks the entry up before the limiter counts the attempt

# 19a-receiving-a-message/F-394 - /_contact looks the entry up before the limiter counts the attempt

**Found:** 2026-10-12 by review (scope: current; lens: all)
**Why it matters:** Step 4's order counts the attempt first; here one indexed DB query runs per post before the 5-an-hour limit can refuse it, so a flood costs the database, not just the limiter.
**Suggested fix:** count the attempt first; do the lookup only for answers that need the entry's path (a `busy` can go to `/`, or look up once after the limiter passes).
**Resolution:**
Fixed 2026-10-12: contactLimits.attempt now runs before findPublishedEntryPath; a busy answer goes to `/`. e2e/contact.spec.ts (sixth post -> `/?contact=busy`) passes, 15 of 15.
Re-examined by review 2026-10-12 (scope: current, every lens): contactLimits.attempt now precedes findPublishedEntryPath in contact-submit.ts; a refused attempt costs no query; e2e busy case passes. Closed.

### 19a-receiving-a-message/F-395 [P3] closed - The route exports a loader (405 for GET); the spec says action only and was not updated

# 19a-receiving-a-message/F-395 - The route exports a loader (405 for GET); the spec says action only

**Found:** 2026-10-12 by review (scope: current; lens: quality)
**Why it matters:** React Router 8.4 answers GET to an action-only route with 400, so the loader is needed for the spec's 405; the spec's Step 4 text and Decisions do not say so.
**Suggested fix:** record the choice under the spec's Decisions (ship carries it to dev-notes); no code change.
**Resolution:**
Fixed 2026-10-12: no code change; the loader's reason and its cost are recorded under the spec's Decisions (current-work.md).
Re-examined by review 2026-10-12: the loader is in contact-submit.ts and the spec's Decisions records why (400 for GET on an action-only route). Closed.
