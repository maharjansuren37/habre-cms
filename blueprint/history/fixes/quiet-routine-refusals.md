# Fix: stop logging scanner 404s and 405s as errors (F-114)

**Type:** Fix
**Status:** built

## Goal

Make the systemd journal usable as this project's only error signal (the plan
has no error tracker). Since 2026-09-16, React Router has logged 2,119+ full
stack traces for URLs no route matches, and 15 for POSTs to routes with no
`action`. All of them are bots probing `/wp-admin/install.php`, `/.git/config`
and similar paths. They make up about 99% of the journal's `Error` lines, so a
real unhandled exception is buried. After this fix, those expected refusals
are not logged, and every other server error is logged exactly as today.

## In scope

- A pure predicate that decides whether a server error is worth logging.
- A `handleError` export in `app/entry.server.tsx` that uses it.
- One line in `coding-standards.md` *Error handling pattern* recording the
  rule.

## Out of scope

- **The CSRF origin-mismatch trace** (`The request.url origin does not match
  origin header`, 4 lines since 09-16). It is security-relevant and rare, so it
  stays logged.
- **The app's own structured events** (`request_refused`, `login_failed`, ...)
  are unchanged.
- **Caddy access logs** are unchanged. Every 404 and 405 still appears there
  with its path and status.
- **The streaming `onError` in `handleRequest`** is unchanged.
- **An error tracker or alerting.** No error alerting is a separate gap,
  recorded in `dev-notes/status.md` *Monitoring gaps*.
- **F-69** (no server mode passed to `createRequestHandler`) is a separate
  finding.

## Build steps

- [x] **Step 1 - the predicate, with tests.** Create `app/lib/server-errors.ts`
      exporting `isRoutineRefusal(error: unknown): boolean`. It returns true
      only when `isRouteErrorResponse(error)` is true, the error has an
      internal `error` field (meaning the router generated it; app code never
      sets one), and `status` is 404 or 405. It returns false for everything
      else: plain `Error`s, route error responses with other statuses (400,
      500, ...), 404s thrown by app code with `data(...)` (no `.error`), and
      non-objects.
      Tests go in `app/lib/server-errors.test.ts`. Build fixtures with
      React Router's exported `UNSAFE_ErrorResponseImpl`, constructed the way
      the router does (status, statusText, data, internal flag - check the
      constructor in `node_modules/react-router/dist/production/lib/router/utils.js`
      before writing them). One test per case above.
      *Done when:* `npm test` passes, and the tests were seen to fail against a
      stub that returns `false`.
- [x] **Step 2 - wire it into `handleError`.** In `app/entry.server.tsx`,
      export `handleError: HandleErrorFunction` following the installed docs
      (`node_modules/react-router/docs/how-to/error-reporting.md`). Return
      early when `request.signal.aborted` (as the default does) or when
      `isRoutineRefusal(error)` is true. Otherwise log
      `isRouteErrorResponse(error) && error.error ? error.error : error` with
      `console.error`, the same thing the default handler logs today
      (`server-runtime/server.js:37`), so real errors look unchanged in the
      journal. Add the rule to `coding-standards.md` *Error handling pattern*:
      router-generated 404/405s are not logged; Caddy's access log records
      them.
      *Done when:*
      - `npm run verify` exits 0.
      - Against a local production build (`npm run build && npm start`, dev
        database up), with the server's terminal output watched:
        - `curl -i http://127.0.0.1:3000/wp-admin/install.php` returns 404 and
          prints nothing.
        - `curl -i http://127.0.0.1:3000/does-not-exist.data` (the
          single-fetch path, which calls `handleError` separately) returns
          404 and prints nothing.
        - `curl -i -X POST http://127.0.0.1:3000/posts -H "Origin: http://127.0.0.1:3000"`
          returns 405 and prints nothing.
        - `/posts/does-not-exist` returns 404 and prints nothing (unchanged).
        - With the database stopped (`docker compose stop`), `/posts` returns
          a 500 **and its error is printed** with a stack trace, proving real
          errors still reach the log. The driver may wait for its connect
          timeout before failing. Restart the database afterwards.

## Files and areas

- `app/lib/server-errors.ts` (new): the pure predicate. It lives in
  `app/lib/` because `node --test` cannot import `entry.server.tsx` (JSX).
  It is plain `.ts`, not `.server.ts`: it touches no secrets, database or I/O.
- `app/lib/server-errors.test.ts` (new).
- `app/entry.server.tsx`: new `handleError` export.
- `blueprint/context/coding-standards.md`: one line under *Error handling
  pattern*.

## Data and contracts

None. No schema, route or stored shape changes. `handleError` is a documented
React Router 8 entry-module export (`HandleErrorFunction`).

## Testing

- **Unit:** `app/lib/server-errors.test.ts`, run by `npm test` inside
  `verify` and in CI. It needs no database.
- **By hand:** the curl checks in Step 2, locally only. Playwright cannot
  easily assert on the server's stdout, and this change is not worth building
  that harness for. `verify` runs them from the done-when.
- **Browser tests:** `npm run test:e2e` must still pass. Only logging
  changes, not any response.

## Decisions

- **Router-generated 404s and 405s are not logged. Everything else is,
  unchanged.** Rejected alternatives:
  - Filtering by message text: brittle across React Router versions.
  - Dropping all route error responses: that would also hide 400s and 500s.
  - Logging them at a lower level (`console.warn`): the journal would still
    be flooded, just at a different priority.
  - **Trade-off:** a real form that posts to a route with no `action` also
    stops being logged. The browser tests catch that case, and the 405 still
    shows in Caddy's access log.

## Production needs

None. No env vars, migrations or host changes. It ships with the next
`deploy`. After that deploy, the journal check is:
`journalctl -u habre-cms --since <deploy time> | grep -c "No route matches"`,
which should print 0.

## Notes

- `import type { HandleErrorFunction }` (`verbatimModuleSyntax`).
  `isRouteErrorResponse` is a value import from `"react-router"`.
- Imports use `#app/lib/server-errors.ts` with the extension.
- The public `ErrorResponse` type may not declare the internal `error` field
  that `ErrorResponseImpl` carries. If `tsc` rejects `error.error`, narrow
  with `"error" in error` in the predicate and in `handleError`. Never use
  `as any`.
- Keep the `request.signal.aborted` guard: the docs and the default handler
  both have it.
- When this lands, `build` marks F-114 `fixed`. It is a P3, so `build` may
  close it itself if the Step 1 tests were seen to fail first.

## Findings

### quiet-routine-refusals/F-114 [P3] closed - Scanner 404s write a full stack trace to the journal, burying the app's real errors
File: app/entry.server.tsx (no `handleError` export)

**File:** app/entry.server.tsx (no `handleError` export)
**Found:** 2026-09-29 by monitor
**Why it matters:** The plan chose the systemd journal as the only error signal in v1: no error tracker. Since 2026-09-16, `journalctl -u habre-cms` holds 2,119+ `Error: No route matches URL "…"` stack traces. Those come from bots probing `/wp-admin/install.php`, `/.git/config`, `/.config/gcloud/...` and similar paths. It also holds 15 `POST ... did not provide an action` traces from the same kind of traffic. Each 404 is expected and already answered correctly. But roughly 99% of `Error` lines are noise, so a real unhandled exception is hard to find by reading the journal, and so is a count of errors per day. The deploy checks' "0 `error` lines since the restart" only works in the first minutes after a restart.
**Suggested fix:** Export `handleError` from `app/entry.server.tsx`. Skip logging when `request.signal.aborted` or when the error is a route error response with status 404/405 (`isRouteErrorResponse`). Log everything else as today. Check it in the installed React Router 8.3.1 docs (`node_modules/react-router/docs/`, `handleError`) before building, because this changes what reaches `console.error`.
**Resolution:** Repaired 2026-09-29 on `fix/quiet-routine-refusals`. `app/lib/server-errors.ts` adds `isRoutineRefusal`, and `app/entry.server.tsx` adds a `handleError` that skips it and aborted requests and logs everything else the way the default handler does.
- **Test from the reproduction:** `app/lib/server-errors.test.ts`, "a URL no route matches is a routine refusal". It uses a router-built 404 carrying `No route matches URL "/wp-login.php"`.
  - With the repair reverted (predicate stubbed to `false`), it failed, along with the 405 test.
  - With the repair restored, it passed (7/7).
- **Live check against `npm start`:** `/wp-admin/install.php` (404), `/does-not-exist.data` (404) and `POST /posts` (405) printed nothing. `/posts` with the database stopped (500) printed `ECONNREFUSED` with its stack trace.
- `npm run verify`: exit 0, 235 tests.
- Closed by build.

Re-examined 2026-09-29 by review (scope: current; all lenses): the close stands.
- **Unchanged:** every app-thrown 404 (`require-role.server.ts:30`, the public and content routes, `root.tsx:53`) uses `data("Not Found", ...)`, which has no `.error`, so it is unaffected. React Router never logged those anyway.
- **Logged the same as before:** real errors print as before. For route error responses, the `instanceof Error` check matches the default, because the constructor sets `.error` only from an `Error`.
- **Browser suite:** `npm run test:e2e` passed 99 of 99.
