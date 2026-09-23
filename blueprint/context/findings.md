# Findings

> **Generated file.** The findings index, loaded every session: one heading per
> live finding - `### F-03 [P0] open - <title>` and a `File:` line under it -
> and nothing else. The full entry is `blueprint/findings/F-03.md`, read when
> acting on that finding; **status lives only here**, evidence in the entry's
> **Resolution**. `review` raises code findings; `build` marks a repair `fixed`;
> only a later `review` pass moves it to `closed` - except a P2 or P3 whose
> repair `build` saw a test fail without, which `build` closes itself. **A
> finding no code fixes** - raised by `preflight` or `host`, such as missing
> backups or a leaked secret - is marked `fixed` with evidence by whichever
> skill repairs it, and `preflight` re-checks and closes it. `ship` refuses to
> merge while any P0 or P1 finding is `open` or `fixed`, then archives resolved
> findings with the work item, moves unresolved P3s to
> `blueprint/findings/backlog.md`, and resets this file. A finding the user puts
> off rather than abandons is `deferred`, with a
> `Deferred to:` line naming the skill that will do it: it gates nothing, stays
> in the ledger through `ship`, and `preflight` reports it at every audit until
> that skill has run.

### F-72 [P2] fixed - Item 4c's env-var rename breaks the proven symlink-only rollback for this specific release
File: /etc/systemd/system/habre-cms.service on `ocwebserver`; deploy/habre-cms.service in the repo

### F-70 [P2] open - Host-routing refusals are silent - no security event is logged for a wrong-host admin attempt or an unrecognized host
File: app/root.tsx:23-40 (`routeByHost`)

### F-48 [P2] fixed - The three inline toolbar buttons have no perceivable focus indicator, and the spec asked for one
File: app/features/content/post-form.module.css:135-136

### F-29 [P2] open - The writing area has no accessible name
File: app/features/blocks/editor.client.tsx:68

### F-25 [P2] open - Two people starting the same-titled post at once can get a 500
File: app/features/content/entries.server.ts:44-66 (`createDraft`)

### F-22 [P2] unverified - The app now believes any client's `X-Forwarded-Host` and `X-Forwarded-Proto`
File: server/app.ts:17 (`{ trustProxy: true }`)

### F-17 [P2] open - The browser tests that cover login never run automatically
File: .github/workflows/ci.yml, package.json:22 (`verify` = typecheck, lint, unit tests, build)

### F-69 [P2] open - `createRequestHandler` is never given a mode, so every error is sanitized in development too - root's own dev-mode stack trace has never been reachable
File: server/app.ts:6 (`createRequestHandler(() => import("virtual:react-router/server-build"))`)

### F-100 [P2] open - No Content-Security-Policy, past its own stated trigger, at the milestone this project chose to set it by
File: server.js:14-19
