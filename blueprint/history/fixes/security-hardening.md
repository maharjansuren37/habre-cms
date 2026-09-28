# Fix: Security hardening - CSP, host-refusal logging, pinned forwarded headers

**Type:** Fix
**Status:** shipped 2026-09-28
**Branch:** `fix/security-hardening`
**Findings:** F-100, F-70, F-22

## Goal

Production is live with real content, and three P2 security findings have been
carried since the MVP. This fix closes all three together:

- **F-100:** send a Content-Security-Policy on every HTML page. It was deferred
  until item 5 shipped (plan §8), and item 5 has now shipped.
- **F-70:** log a security event when host routing refuses a request, the same
  way the cross-site check already does.
- **F-22:** set the forwarded-header behaviour explicitly in Caddy.
  Production evidence already shows Caddy overwrites both headers, so this is a
  pin rather than a repair.

None of the three is exploitable today. They are the second line of defense
(CSP), detection (logging), and a safeguard in config (Caddy).

## In scope

- A per-request nonce, generated in a revealed `app/entry.server.tsx` and passed
  to `<ServerRouter nonce>` and `renderToPipeableStream({ nonce })`, following
  the installed docs (`node_modules/react-router/docs/how-to/security.md`).
- Two policies, chosen by path (D22 anticipated both):
  - **public:** strict, with no inline styles.
  - **admin:** the same, except `style-src` allows `'unsafe-inline'`, which
    Editor.js needs.
- The CSP header on HTML documents only, and only in production builds.
- A browser test that fails on any CSP violation across every screen.
- A new `request_refused` reason, `wrong_host`, logged by `routeByHost`.
- `header_up X-Forwarded-Host {host}` and `header_up X-Forwarded-Proto {scheme}`
  on both `reverse_proxy` blocks in `deploy/caddy/habre-cms.caddy`.

## Out of scope

- **A CSP reporting endpoint** (`report-to`), which would need somewhere to
  send reports. The browser test does that job before release. It can be a
  later item if `monitor` wants the signal.
- **CSP in development.** Vite's dev server injects inline scripts and styles
  with no nonce. The browser tests run the production build, so they are what
  proves the policy.
- **Turning `trustProxy` off in development or tests**, which is F-22's residue
  and local only. Also the dev rate-limit forgery, which comes from `clientIp`
  reading `X-Forwarded-For` rather than from `trustProxy`. Both are left as they
  are, and `review` judges whether F-22 closes.
- The other open findings: F-17, F-25, F-29, F-69, and F-48/F-72 (already
  fixed). Also the 41-item backlog.
- Deploying. `deploy` does that, with its own approval.

## Build steps

- [x] **Step 1 - Log host-routing refusals (F-70)** - add
      `{ event: "request_refused"; reason: "wrong_host"; method; path; host; ip }`
      to `SecurityEvent` in `app/lib/security-log.server.ts`. Call
      `logSecurityEvent` in `routeByHost` (`app/root.tsx`) before throwing the
      404, mirroring `refuseCrossSiteRequests`. Use `url.pathname` for `path`
      (never `request.url`, per the admin-data fix), `url.host` for `host`, and
      `clientIp(request.headers)` for `ip`. *Done when:* on the host-split server
      (`PUBLIC_URL=http://127.0.0.1:3102`, `ADMIN_URL=http://localhost:3102`,
      `npm start`):
      - `curl -X POST http://127.0.0.1:3102/admin/posts` gets a 404 and writes
        exactly one JSON line to stderr with `"reason":"wrong_host"`, `method`,
        `path` `/admin/posts`, and `host` `127.0.0.1:3102`.
      - `curl -H 'Host: evil.example' http://127.0.0.1:3102/` gets a 404 and logs
        `host` `evil.example`.
      - A normal GET logs nothing.
      - `npm run verify` passes, and so does `e2e/host-routing.spec.ts`.
- [x] **Step 2 - Reveal `entry.server.tsx` and pass a nonce** - run
      `npx react-router reveal entry.server`, then generate
      `randomBytes(16).toString("base64")` per request in `handleRequest` and
      pass it to both places the docs name. No header yet. *Done when:*
      - Every inline `<script>` in a production page's HTML carries a `nonce`
        attribute, checked on the public home page and `/admin/login`.
      - Two requests get different values.
      - `npm run verify` passes and the full `npm run test:e2e` passes unchanged.
- [x] **Step 3 - The policy as a pure function** -
      `app/lib/content-security-policy.ts` exports
      `contentSecurityPolicy({ nonce, area, imageOrigin })`, where `area` is
      `"public" | "admin"`, and returns the header string. Put
      `areaForPath(pathname)` beside it: `/admin` and `/admin/*` map to admin,
      everything else to public. Unit tests go in `content-security-policy.test.ts`.
      *Done when:* `npm test` shows tests asserting:
      - both policies contain every directive in **Data and contracts**
      - the nonce appears in `script-src`
      - `imageOrigin` appears in `img-src` as an origin, with any path on
        `R2_PUBLIC_URL` dropped
      - only admin's `style-src` has `'unsafe-inline'`
      - `areaForPath` classifies `/admin`, `/admin/posts`, `/administrator` and
        `/`
- [x] **Step 4 - A browser test that fails on any CSP violation** -
      `e2e/content-security-policy.spec.ts`. An `addInitScript` records every
      `securitypolicyviolation` event, and the test also collects console
      messages containing "Content Security Policy". It then visits:
      - **Public:** the home page, a post with an image block, a page, and a 404.
      - **Admin:** login, then the posts list, the post editor (type text, open
        the + toolbox, use Bold and Link from the inline toolbar, insert an image
        from the media picker), the media library, settings with a logo set, and
        users.

      It asserts that nothing was recorded, and that the CSP header is present
      on a public and an admin document. *Done when:* the test is written and,
      with no header sent yet, fails only on the header-presence assertion.
      Step 5 makes it pass.
- [x] **Step 5 - Send the header (F-100)** - in `entry.server.tsx`, when not
      `import.meta.env.DEV`, set `Content-Security-Policy` on `responseHeaders`
      from `contentSecurityPolicy`, using `areaForPath(new URL(request.url).pathname)`
      and the origin of `env.R2_PUBLIC_URL`. Replace the "deliberately not set
      yet" comment in `server.js` with a pointer to where CSP is set. *Done when:*
      - `npm run test:e2e` passes in full, including Step 4's test.
      - Temporarily dropping the R2 origin from `img-src` makes Step 4's test
        fail. Show the failure, then revert.
      - `curl -sI` of the production build shows the public policy on `/` and the
        admin policy on `/admin/login`, with no header from `npm run dev`.
      - `npm run verify` passes.
- [x] **Step 6 - Pin forwarded headers in the Caddy site file (F-22)** - add the
      two `header_up` lines to both `reverse_proxy` blocks, with a comment saying
      why: they stop the app's origin from depending on Caddy's defaults or on a
      `trusted_proxies` setting in the main Caddyfile, which this repo does not
      own. *Done when:* `caddy fmt --diff deploy/caddy/habre-cms.caddy` shows no
      formatting change, or if `caddy` is not installed locally the step says so
      and relies on `caddy validate` at deploy. `deploy`'s post-check reruns
      F-22's two curl probes against production.

## Files and areas

- `app/lib/security-log.server.ts` - one new event variant
- `app/root.tsx` - `routeByHost` logs before its 404
- `app/entry.server.tsx` - new (revealed), with the nonce and CSP header
- `app/lib/content-security-policy.ts` and `.test.ts` - new
- `e2e/content-security-policy.spec.ts` - new
- `server.js` - comment only
- `deploy/caddy/habre-cms.caddy` - two `header_up` lines per site block

## Data and contracts

No schema change and no migration.

**Security event (load-bearing: the journal is parsed by eye and by `monitor`):**

    { "event": "request_refused", "reason": "wrong_host",
      "method": "POST", "path": "/admin/posts", "host": "surenmaharjan.fyi", "ip": "..." }

**Policy (load-bearing: the page builder will have to fit inside it).** `<n>`
is the per-request nonce and `<r2>` the origin of `R2_PUBLIC_URL`.

| Directive | public | admin |
|---|---|---|
| `default-src` | `'self'` | `'self'` |
| `script-src` | `'self' 'nonce-<n>'` | `'self' 'nonce-<n>'` |
| `style-src` | `'self'` | `'self' 'unsafe-inline'` |
| `img-src` | `'self' <r2>` | `'self' <r2> data:` - Editor.js's stylesheet draws an icon mask from a `data:image/svg+xml` URL (found by Step 4's test in Step 5) |
| `font-src` | `'self'` | `'self'` |
| `connect-src` | `'self'` | `'self'` |
| `object-src` | `'none'` | `'none'` |
| `base-uri` | `'none'` | `'none'` |
| `form-action` | `'self'` | `'self'` |
| `frame-ancestors` | `'none'` | `'none'` |

If Step 4's test shows a directive needs loosening (for example `data:` in
admin `img-src` for an Editor.js icon), loosen only that directive, only for
that area, and record the reason in this table before ticking the step.

## Testing

- **Unit:** `npm test`, run by `npm run verify` locally and in CI. Covers the
  policy builder and `areaForPath` (Step 3). No database needed.
- **Browser:** `npm run test:e2e`, **locally only**. It needs the development
  database, and CI does not run it (F-17, open). Step 4's test lives here,
  against the production build on the primary server (single host, port 3100).
  Existing `host-routing.spec.ts` covers Step 1's refusals still refusing.
- **By hand, at `verify`:** Step 1's log lines, since no test reads the server's
  stderr, and Step 5's `curl -sI` headers.

## Decisions

- **Nonce-based `script-src`**, which beat two alternatives:
  - hashes: React Router's inline scripts carry per-page hydration data, so
    their hashes change every request
  - `'unsafe-inline'`: that is no script protection at all
- **Admin `style-src` allows `'unsafe-inline'`; public does not**, which beat
  passing the nonce to Editor.js's `style.nonce`. That would mean the client
  reading the nonce back out of the DOM, for a risk (inline style injection)
  far smaller than scripts. D22 recorded this split as one of the two reasons
  for separate hostnames.
- **The policy is chosen by path (`/admin`), not by host.** Single-host
  development and the main browser-test server then get the same split as
  production.
- **Enforced directly, with no Report-Only phase.** There is no report
  collector, so Report-Only would only log to consoles nobody reads. Step 4's
  browser test over every screen does that job before release.
- **Production builds only.** Vite's dev server cannot run under a nonce policy
  without extra plumbing, and the browser tests already exercise the production
  build.
- **Zod runs `jitless` in the browser** (settled in Step 5, owner's choice).
  Zod 4 probes `new Function` once to decide whether to compile validators;
  the policy refuses it, Zod swallows the refusal, and the browser still
  reports a violation on every admin screen that loads Zod.
  `z.config({ jitless: true })` in `app/lib/zod-jitless.client.ts`, imported
  by the two screens whose bundles load Zod (`entry-form.tsx`, `settings.tsx`),
  skips the probe. It beat two alternatives:
  - `'unsafe-eval'` in admin `script-src`, which re-allows eval for every
    script and undoes much of the nonce policy
  - filtering the violation out of the browser test, which leaves a blind spot
  `.client` keeps the server on Zod's compiled path.
- **Forwarded headers are pinned in the site file** instead of relying on
  Caddy's defaults, because the main Caddyfile (where `trusted_proxies` would
  live) is not this repo's (D17).

## Production needs

- **No new environment variables.** The policy reads `R2_PUBLIC_URL`, which
  already exists.
- **No migrations.**
- **Caddy reload:** the updated `deploy/caddy/habre-cms.caddy` installed to
  `/etc/caddy/sites/habre-cms.caddy`, then `caddy validate` and a reload, as
  `deploy/setup-server.sh` does.
- **After deploy:**
  - `curl -sI` both hostnames for the CSP header.
  - Rerun F-22's two forged-header probes.
  - Load one public post with an image and the post editor in a real browser,
    and check the console for CSP errors.

## Notes

- **React Router 8 is newer than training.** The installed
  `node_modules/react-router/docs/how-to/security.md` and the revealed
  `entry.server.tsx` decide the nonce plumbing, not memory.
- `entry.server.tsx` is `.tsx`, so it has no unit tests (`node --test` cannot run
  JSX). All logic worth testing lives in `content-security-policy.ts`.
- `routeByHost` must keep reading `url`, not `request.url`
  (`blueprint/history/fixes/admin-data-host-redirect.md`).
- **Plan §8 will be stale** once Step 5 lands: its "Content-Security-Policy is
  deliberately not set yet" paragraph. Plans belong to the owner. Step 5 shows
  the exact replacement text for approval and does not edit it silently.
- `build` marks F-100, F-70 and F-22 `fixed` with evidence. Only a later
  `review` closes them.

## Findings

### security-hardening/F-100 [P2] closed - No Content-Security-Policy, past its own stated trigger, at the milestone this project chose to set it by
File: server.js:14-19


**File:** server.js:14-19
**Found:** 2026-09-23 by preflight (milestone audit before deploying items 5-8)
**Why it matters:** The code's own comment says "Content-Security-Policy is deliberately not set yet - see plan section 8," and `project-overview.md` records the trigger as "until item 5 lands" - item 5 (images) shipped weeks ago and items 6-8 have shipped since. `X-Content-Type-Options`, `Referrer-Policy` and `X-Frame-Options` are all set; CSP is the one security header still missing. **Contained, not exploitable today as far as this audit found**: every text field is stored as structured runs and escaped on render (D28-D30, never raw HTML), so there is no known stored-XSS path for CSP to be the second line of defense against - but that is exactly what a defense-in-depth header is for: a mitigation that matters when something else fails, not when everything else already holds. OWASP Top 10:2025 A05 Security Misconfiguration. P2 rather than P1 because no exploitable gap was found that CSP alone would close.
**Suggested fix:** `build` - a starting policy for this app (no inline scripts beyond what Vite's build emits with a nonce/hash, images from `self` and the R2 public URL, no `object-src`) with `Content-Security-Policy-Report-Only` first if the exact directives need proving out against the real bundle, then enforced. Small, self-contained change - add it to `SECURITY_HEADERS` in `server.js` and verify no page breaks.
**Risk accepted by the owner, 2026-09-23:** shipping items 5-8 to production without CSP; will add it after the MVP is live. Stays `open`, not `fixed` - nothing changed.
**Resolution:** fixed by build, 2026-09-28, on `fix/security-hardening` (steps 2-5). `app/entry.server.tsx` (revealed) generates a 16-byte nonce per HTML response, passes it to `<ServerRouter nonce>` and `renderToPipeableStream`, and in production builds sets `Content-Security-Policy` from `app/lib/content-security-policy.ts`. There are two policies by path: public, and admin, which adds `'unsafe-inline'` styles and `data:` images for Editor.js. `script-src 'self' 'nonce-…'` has no `unsafe-eval`. Zod's `new Function` probe is disabled in the browser by `app/lib/zod-jitless.client.ts`. Evidence:
- `e2e/content-security-policy.spec.ts`, 3 passed. It walks the public home, a post with an R2 image, a page and a 404, and every admin screen including the editor's inline tools, toolbox and image picker, asserting zero `securitypolicyviolation` events and zero CSP console errors.
- With the R2 origin removed from `img-src`, tests 2 and 3 failed; restored, they passed.
- `curl -sI` on the production build showed the public policy on `/`, the admin policy on `/admin/login`, and none on `/healthz`. The dev server sends none.
- `npm run test:e2e`: 92 passed. `npm run verify`: exit 0, 225 unit tests.

Stays `fixed` for `review`; the production header check belongs to `deploy`.
**Closed by review, 2026-09-28** (scope: current). I re-examined `app/entry.server.tsx` and `app/lib/content-security-policy.ts`:
- The header is set before the HEAD short-circuit and before streaming starts.
- There is a fresh 16-byte nonce per document, passed to both `ServerRouter` and `renderToPipeableStream`.
- `script-src` has no `unsafe-inline` or `unsafe-eval`.
- No `style=`, `dangerouslySetInnerHTML` or inline `<script>`/`<style>` exists in `app/` for the public policy to break.

`npx playwright test e2e/content-security-policy.spec.ts` passed 3/3, and `npm run verify` exited 0 with 225 unit tests. A new, smaller issue in the same area is F-102 (test coverage wording). The production header is still unobserved; that is `deploy`'s post-check.

### security-hardening/F-70 [P2] closed - Host-routing refusals are silent - no security event is logged for a wrong-host admin attempt or an unrecognized host
File: app/root.tsx:23-40 (`routeByHost`)


**File:** app/root.tsx:23-40 (`routeByHost`)
**Found:** 2026-09-21 by review (scope: current, item 4c; lens: security)
**Why it matters:** `routeByHost` throws a bare 404 for two cases and logs neither: a non-GET/HEAD request to an admin path on the public host, and a request whose host matches neither `PUBLIC_URL` nor `ADMIN_URL`. The second case should be unreachable in production - F-22's evidence confirms only Caddy reaches the app, on 127.0.0.1 with the other ports closed, and Caddy forwards only the two configured hostnames - which is exactly why it is worth logging rather than silently swallowing: if it ever fires, the network assumption behind the whole security model has been violated, and nothing here would tell anyone. Compare `refuseCrossSiteRequests` two lines below, in the same middleware array, which logs every refusal via `logSecurityEvent({ event: "request_refused", reason: "cross_site", ... })` - the new middleware sits right next to that pattern and does not follow it. `fundamentals.md`'s Logging section: "Log the security-relevant events: failed authentication, access denied, and anything that changes permissions... Detection you never wrote is the one gap no later audit can close retroactively." OWASP Top 10:2025 A09, Logging & Alerting Failures. Not exploitable on its own - the request is correctly refused either way - so this is a detection gap, not a bypass.
**Suggested fix:** Call `logSecurityEvent` with a new reason (e.g. `"wrong_host"`) before throwing the 404 in `routeByHost`, mirroring `refuseCrossSiteRequests`'s shape (`method`, `path`, `ip`, plus the host that was actually requested).
**Resolution:** fixed by build, 2026-09-28, on `fix/security-hardening` (step 1). `routeByHost` in `app/root.tsx` now calls `logSecurityEvent({ event: "request_refused", reason: "wrong_host", method, path, host, ip })` before its 404, with a new `SecurityEvent` variant in `app/lib/security-log.server.ts`. Evidence: production build on port 3102 with `PUBLIC_URL=http://127.0.0.1:3102`, `ADMIN_URL=http://localhost:3102` - `curl -X POST http://127.0.0.1:3102/admin/posts` returned 404 and logged `{"event":"request_refused","reason":"wrong_host","method":"POST","path":"/admin/posts","host":"127.0.0.1:3102","ip":"unknown"}`; `curl -H 'Host: evil.example' http://127.0.0.1:3102/` returned 404 and logged the same with `"host":"evil.example"`; a normal GET returned 200 and logged nothing. `npm run verify` exit 0; `e2e/host-routing.spec.ts` 8 passed. No automated test reads stderr, so this stays `fixed` for `review`.
**Closed by review, 2026-09-28** (scope: current, `fix/security-hardening` uncommitted on `main` 2fd9621). I re-examined `app/root.tsx`. The only `not-found` branch of `routeByHost` now logs `request_refused`/`wrong_host` before its 404, using `url.pathname` (not the raw `.data` URL) and `url.host`. JSON logging escapes a hostile Host value, and nothing new was introduced. `e2e/host-routing.spec.ts` still passes (8/8 within an 11-test run). The log line itself is proven only by build's manual curl run; no test reads stderr.
