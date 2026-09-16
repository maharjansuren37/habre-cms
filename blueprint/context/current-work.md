# Fix: Trust Caddy's forwarded protocol so logins work in production

**Type:** Fix
**Status:** not started
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

- [ ] **Step 1 - Build the listener with `trustProxy`** - in `server/app.ts`,
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

- [ ] **Step 2 - Regression test behind a simulated proxy** - add a second
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

- [ ] **Step 3 - Record the dependency and close the finding** - add `D23` to
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
