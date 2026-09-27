# Fix: Login lands on the public site at `/admin.data`

**Type:** Fix
**Status:** shipped 2026-09-28
**Branch:** `fix/admin-data-host-redirect`

## Goal

In production, logging in at `https://cms.surenmaharjan.fyi/admin/login` sends
the browser to `https://surenmaharjan.fyi/admin.data` instead of the posts list.
Make login - and every client-side navigation to `/admin` - stay on the admin
host, and make a session that expires mid-navigation return people to the page
they asked for rather than to a raw `.data` URL.

**Root cause (from `debug`, 2026-09-28, reproduced against the production
build):** React Router passes middleware and loaders the *raw* request, so on a
client-side navigation `request.url` ends in `.data` (`/admin.data`). The
cleaned-up URL arrives in a separate `url` argument (`DataFunctionArgs.url` in
`node_modules/react-router/dist/development/lib/router/utils.d.ts`: "a normalized
URL with React-Router-specific implementation details removed (`.data`
suffixes, `index`/`_routes` search params). For the raw incoming URL, use
`request.url`"). `routeByHost` in `app/root.tsx:26` reads `request.url`;
`/admin.data` is not an admin path to `resolveHostRouting`, so on the admin host
it redirects to `${PUBLIC_URL}/admin.data`. The login `<Form>` submits by fetch
and then navigates to `/admin` the same way, which is why every login hits it.
Development and the main browser-test server never see it: equal
`PUBLIC_URL`/`ADMIN_URL` short-circuits host routing to `allow`.

## In scope

- Host routing reads the normalized `url` argument, not `request.url`.
- `requireUser` builds `redirectTo` from the normalized `url`, not `request.url`
  (same cause: a session expiring during a client-side navigation to
  `/admin/pages` currently records `redirectTo=/admin/pages.data`).
- Discarding the uncommitted `safeRedirect` change on `main`. It patched the
  wrong layer: every login now goes to `/admin`, which is the one path that
  triggers the bug, and deep links after login are lost.
- Browser tests that fail without the fix.

## Out of scope

- The two places that only **log** `new URL(request.url).pathname`
  (`app/root.tsx:49`, `app/features/auth/require-role.server.ts:26`) - logs
  show `.data` on client-side navigations. Cosmetic; a one-line follow-up if
  wanted.
- Loaders that read only `searchParams` from `request.url` (`page-list.tsx`,
  `media-picker.ts`, `user-edit.tsx`, `settings.tsx`, `login.tsx:83`) - the
  query string is the same on both URLs apart from React Router's `_routes`,
  which none of them read.
- F-70 (host-routing refusals are not logged) - same function, separate finding.
- F-17 (browser tests never run in CI) - these new tests inherit that gap.
- Deploying the fix - `deploy`, after `ship`.

## Build steps

- [x] **Step 1 - Discard the uncommitted `safeRedirect` change** - restore
  `app/features/auth/safe-redirect.ts` and `safe-redirect.test.ts` to `HEAD`.
  **Discards uncommitted work - needs the owner's yes before running.**
  *Done when:* `git diff HEAD --stat -- app/features/auth/` is empty, and
  `npm test` passes including "a path inside the admin area is kept".
- [x] **Step 2 - Host routing reads the normalized URL** - in `routeByHost`
  (`app/root.tsx`), take `url` from the middleware arguments and pass its
  `pathname` and `search` to `resolveHostRouting`; keep `url.host` for
  `requestHost`. Update the doc comment in `app/lib/host-routing.ts:19`, which
  says `request.url`. Add to `e2e/host-routing.spec.ts` (split-host server,
  port 3102):
  - a request test: `GET ${ADMIN}/admin.data` with no session returns React
    Router's data redirect to `/admin/login`, and the body does not contain the
    public origin;
  - a browser test: a fresh admin logs in at `${ADMIN}/admin/login` and lands on
    `${ADMIN}/admin/posts` with the "Posts" heading.
  *Done when:* both new tests fail on the step-1 code (shown) and pass after
  the change; the existing six host-routing tests still pass.
- [x] **Step 3 - `requireUser` records the normalized path** - in
  `app/features/auth/require-user.server.ts`, build `redirectTo` from the
  middleware's `url` (`url.pathname + url.search`), not `request.url`. Add to
  `e2e/auth.spec.ts`: log in, revoke the user's sessions, click the "Pages" nav
  link (a client-side navigation, so a `.data` request); expect
  `/admin/login?redirectTo=%2Fadmin%2Fpages`; log in again; expect
  `/admin/pages`. *Done when:* the new test fails on the step-2 code (shown)
  and passes after the change.
- [x] **Step 4 - Full check** - *Done when:* `npm run verify` passes and
  `npm run test:e2e` passes in full (development database running), with the
  output shown.

## Files and areas

- `app/root.tsx` - `routeByHost` middleware (lines ~23-40)
- `app/lib/host-routing.ts` - doc comment only; the pure function is correct for
  the clean paths it is meant to receive
- `app/features/auth/require-user.server.ts` - `redirectTo` construction (line ~36)
- `app/features/auth/safe-redirect.ts`, `safe-redirect.test.ts` - restored to `HEAD`
- `e2e/host-routing.spec.ts`, `e2e/auth.spec.ts` - new tests
- `blueprint/context/current-work.md` - this file

## Data and contracts

None. No schema, route or stored shape changes. `resolveHostRouting`'s input
contract is unchanged; it was always meant to get a clean pathname, and now it
does.

## Testing

- **Browser tests** (steps 2-3): `npm run test:e2e`, **run locally only** - they
  need the development database (`docker compose up -d`) and a `.env` with
  `DATABASE_URL`, `JWT_SECRET` and the `R2_*` names. CI does not run them (F-17).
  Test users come from `e2e/helpers/users.ts` (`createAdmin`, `revokeSessions`,
  `deleteTestUser`) and are removed afterwards, following the existing specs.
- **Unit tests:** none added. `routeByHost` lives in a `.tsx` route module that
  `node --test` cannot load, and moving it out is a refactor, not part of this
  fix. The existing `safe-redirect` and `host-routing` unit tests must stay green.
- **Why the browser test on the split-host server:** it is the only local setup
  where `PUBLIC_URL` and `ADMIN_URL` differ, which is what production does.

## Decisions

- **Middleware, loaders and actions read the path from React Router's
  normalized `url` argument, never from `request.url`.** `request.url` ends in
  `.data` on every client-side navigation. It beat stripping `.data` ourselves
  (duplicates the framework's own normalization, including `_/.data` and
  `_routes`) and making `isAdminPath` accept `/admin.data` (patches one symptom
  and leaves the other path readers wrong). Reading `searchParams` from
  `request.url` stays acceptable.

## Production needs

None: no environment variables and no migrations. Production stays broken until
this is deployed, and a normal symlink rollback remains possible.

## Notes

- The work is currently uncommitted on `main`. `build` creates the branch first;
  the uncommitted changes carry over and step 1 removes the product-code part.
- React Router 8.3.1: the `url` argument is typed on `DataFunctionArgs`, which
  `MiddlewareFunction` receives. The installed type docs are the authority here,
  not memory.
- Keep `safeRedirect` exactly as committed. Its allowlist is the open-redirect
  guard for `/admin/login`.
