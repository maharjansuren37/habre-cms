# Feature: Split the hostnames

**From build plan:** item 4c
**Type:** Feature
**Status:** built, verified, reviewed (F-70/F-71 found but left open, P2/P3, no blocker); shipped

## Goal

Serve the public site on `surenmaharjan.fyi` and the admin on
`cms.surenmaharjan.fyi` from the one application, routing by the request's host
(D22). This is the last piece of item 4: once it ships, the public renderer
built in 4b is reachable at its real address instead of only under
`cms.surenmaharjan.fyi/`, and the admin session cookie stops being sent to a
domain that serves anonymous visitors.

## In scope

- Two origins in config (`PUBLIC_URL`, `ADMIN_URL`) replacing the single
  `APP_URL`.
- Host-based routing before any route runs: an admin path on the public host
  redirects to the admin host; a public path on the admin host redirects to the
  public host; `/` on the admin host redirects to `/admin`; only GET/HEAD
  redirect, any other method on the wrong host gets 404; `/healthz` answers on
  both; a host matching neither gets 404.
- Scoping the CSRF origin check and the session cookie's `Secure` derivation to
  `ADMIN_URL` (the only host that ever issues or reads the session).
- The admin shell's "View site" link, made absolute on `PUBLIC_URL`.
- The Caddy site file: add `surenmaharjan.fyi` (reverse proxy, same app) and
  `www.surenmaharjan.fyi` (redirect to the apex), alongside the existing
  `cms.surenmaharjan.fyi` block.
- Browser tests that actually exercise two hostnames, per D22's own plan
  (`127.0.0.1` and `localhost` against one port).

## Out of scope

- Custom domains, or anything multi-tenant - D8 holds, still no site id.
- The `/:slug` pages route and its reserved-slug enforcement - item 6.
- Deploying the Caddy change or updating DNS - `host`/`deploy` apply this once
  the code and config are reviewed; this item only writes the file.
- Content-Security-Policy - still deliberately unset until item 5 (unchanged).

## Build steps

- [x] **Step 1 - `PUBLIC_URL` and `ADMIN_URL` replace `APP_URL`** - update
  `app/lib/env.server.ts`'s schema (both `z.url({ protocol: /^https?$/ })`,
  same validation `APP_URL` had); `.env.example` (two lines with a comment that
  they may be equal in development); `deploy/habre-cms.service`
  (`PUBLIC_URL=https://surenmaharjan.fyi`,
  `ADMIN_URL=https://cms.surenmaharjan.fyi`); `README.md`'s env var line;
  `playwright.config.ts`'s two existing `webServer` commands (both set
  `PUBLIC_URL` and `ADMIN_URL` to the same value they gave `APP_URL`, since
  neither exercises the split yet); and the two existing consumers -
  `app/root.tsx`'s CSRF check and `session-cookie.server.ts`'s `secure` flag -
  updated to read `env.ADMIN_URL` in place of `env.APP_URL` (mechanical here,
  same single-origin behavior just renamed; Step 3 is what makes the CSRF
  check meaningfully host-aware). *Done when:* `grep -rn "APP_URL" app/
  server/ deploy/ playwright.config.ts README.md` returns nothing (only
  `dev-notes/decisions.md`'s historical entries remain), `npm run typecheck`
  passes, and starting the server with only one of the two vars set refuses to
  start naming the missing one.

- [x] **Step 2 - Host-routing decision, as a pure function** - add
  `app/lib/host-routing.ts` exporting a function that takes `{ method,
  pathname, search, requestHost, publicHost, adminHost, publicOrigin,
  adminOrigin }` and returns `{ type: "allow" }`, `{ type: "redirect", to }` or
  `{ type: "not-found" }`, deciding purely from those inputs (no `Request`, no
  env import - kept testable the way `db/pending-migrations.ts` is). Rules,
  in order: `publicHost === adminHost` -> always `allow` (development and any
  single-host test server); `pathname === "/healthz"` -> `allow`; on the admin
  host, `pathname === "/"` -> redirect (same-origin, `/admin`) for GET/HEAD,
  else not-found; on the admin host, an admin-prefixed path
  (`pathname === "/admin" || pathname.startsWith("/admin/")`) -> `allow`;
  on the admin host, anything else -> redirect to `publicOrigin + pathname +
  search` for GET/HEAD, else not-found; on the public host, an admin-prefixed
  path -> redirect to `adminOrigin + pathname + search` for GET/HEAD, else
  not-found; on the public host, anything else -> `allow`; a host matching
  neither -> not-found. *Done when:* `app/lib/host-routing.test.ts` covers
  every branch above (including the `/adminfoo` non-prefix case and that the
  query string survives a cross-host redirect) and `npm test` passes.

- [x] **Step 3 - Wire host routing into every request** - in `app/root.tsx`,
  add a `routeByHost` middleware (computing `requestHost` from
  `new URL(request.url).host`, `publicHost`/`adminHost` from
  `env.PUBLIC_URL`/`env.ADMIN_URL`) ahead of the existing
  `refuseCrossSiteRequests` (which, since Step 1, already compares against
  `env.ADMIN_URL` - this step is what makes that comparison meaningfully
  host-aware rather than a same-single-origin rename), throwing `redirect(to)`
  or `data("Not Found", { status: 404 })` per Step 2's result. *Done when:*
  `e2e/auth.spec.ts` still passes unmodified against a single-host test server
  (`PUBLIC_URL === ADMIN_URL`, as today), and a manual request with a forged
  `Origin` equal to the public origin against `/admin/login` on the admin host
  is refused.

- [x] **Step 4 - "View site" points at the public host** - extend
  `admin-shell/layout.tsx`'s loader to also return `publicUrl: env.PUBLIC_URL`
  (env is server-only; the value crosses the loader boundary like `user`
  already does) and use it as the link's `href` instead of `/`. *Done when:*
  rendered admin shell shows `href="<PUBLIC_URL>"` on the "View site" link
  (screenshot or DOM check), not a relative `/`.

- [x] **Step 5 - Caddy site file for the public host and `www`** - in
  `deploy/caddy/habre-cms.caddy`, add a `surenmaharjan.fyi` block matching the
  existing `cms.surenmaharjan.fyi` block's shape (encode, its own rolled
  access log, `reverse_proxy 127.0.0.1:3000` - same app, same port, host
  routing tells them apart) and a `www.surenmaharjan.fyi` block that redirects
  to the apex, keeping the file's own "no `bind`" comment accurate. *Done
  when:* `caddy validate` (no `caddy` binary installed locally, so run inside
  the official `caddy:2-alpine` container against the real file) reports
  `Valid configuration`; actual use on the real server happens in `host`/
  `deploy` against the real binary on `ocwebserver`, not here.

- [x] **Step 6 - Browser tests that exercise both hostnames** - add a third
  `webServer` entry to `playwright.config.ts` on its own port, started with
  `PUBLIC_URL=http://127.0.0.1:<port>` and `ADMIN_URL=http://localhost:<port>`
  (D22's own answer to "browser tests need two local hostnames"), and
  `e2e/host-routing.spec.ts` against it: an admin path requested on
  `127.0.0.1` redirects to the same path on `localhost`; a public path
  requested on `localhost` redirects to `127.0.0.1`; `/` on `localhost`
  redirects to `/admin`; a POST to an admin path on `127.0.0.1` gets 404; a
  request to a third, unrelated host header gets 404; `/healthz` succeeds on
  both. *Done when:* `npm run test:e2e` passes including the new file.

## Files and areas

- `app/lib/env.server.ts`, `.env.example`, `deploy/habre-cms.service`,
  `README.md`, `playwright.config.ts` - config rename (Step 1)
- `app/lib/host-routing.ts`, `app/lib/host-routing.test.ts` - new (Step 2)
- `app/root.tsx`, `app/features/auth/session-cookie.server.ts` (Step 3)
- `app/features/admin-shell/layout.tsx` (Step 4)
- `deploy/caddy/habre-cms.caddy` (Step 5)
- `playwright.config.ts`, `e2e/host-routing.spec.ts` (Step 6)

## Data and contracts

- **Env contract change, load-bearing:** `APP_URL` is removed; every reader of
  a single app origin becomes two readers. Anything added after this item that
  needs "the app's own origin" must say which one - there is no longer a
  single answer.
- **CSRF stays scoped to `ADMIN_URL` only** (not both hosts): the public site
  has no forms in v1, so a state-changing request there is refused by Origin
  mismatch alone, with no separate host check. **The moment a public-facing
  form is added (none planned before item 7 at the earliest), this needs
  revisiting** - it would need its own explicit allow rather than inheriting
  the admin check.
- `resolveHostRouting`'s input shape (Step 2) is the contract item 6 and 7
  reuse if they ever need a host-aware redirect; nothing else calls it yet.

## Testing

- Unit: `app/lib/host-routing.test.ts` (new) - the full branch table in Step 2.
- Browser: `e2e/host-routing.spec.ts` (new, Step 6); `e2e/auth.spec.ts` and
  `e2e/forwarded-proto.spec.ts` re-run unmodified in behavior (only their
  server-start env vars change, in Step 1) to prove nothing already covered
  regressed.
- `npm run verify` (typecheck, lint, unit tests, build) and `npm run test:e2e`
  both green before this item is reviewed.

## Decisions

None new - D22 already settled the domains, the `/admin` prefix, the redirect
semantics (GET/HEAD only, temporary), and the two-local-hostnames test
approach. This item only implements what D22 recorded. The one thing worth
naming for later readers is the CSRF-scope note above, since it is easy to
assume "scoped to ADMIN_URL" means "checked against both."

## Notes

- `trustProxy: true` (`server/app.ts`) is what makes `request.url`'s host
  reflect Caddy's forwarded host in production; in development and the browser
  tests, the request already arrives with the right `Host` header directly, so
  no additional change is needed there.
- Redirects are 302 (React Router's `redirect()` default) per D22 - never 301,
  which a browser would cache past the point these hostnames might change.
- The existing `cms.surenmaharjan.fyi` Caddy block is untouched beyond context
  - it already does the right thing today for everything under `/admin`.

## Findings

`review` raised two findings against this item, both left `open` in the live
ledger rather than repaired here - neither is a P0 or P1, so neither blocked
the merge:

- **F-70 [P2] open** - host-routing refusals (`app/root.tsx`'s `routeByHost`)
  log nothing for a wrong-host admin attempt or an unrecognized host, unlike
  the CSRF middleware two lines below it. Detection gap, not a bypass.
- **F-71 [P3] open** - `session-cookie.server.ts`'s comment on the cookie's
  `path: "/"` still describes the pre-split, single-origin reality ("the
  public site receives it but never reads it"); once `PUBLIC_URL` and
  `ADMIN_URL` genuinely differ, the cookie never reaches the public site at
  all.
