# Fix: Zod's eval probe runs before `jitless` on screens that load Zod (F-399)

**Type:** Fix
**Branch:** fix/csp-zod-jitless
**Verified:** not yet
**Reviewed:** 2026-10-13, 6f2e83ffaa03, current, every lens (reviewer subagent), PARTLY READ: settings-input.ts, user-input.ts, settings.tsx import blocks and diffs only; zod-jitless.client.ts whole - 0 blocking

## Goal

Stop the browser reporting "script-src blocked eval" on the screens whose
bundle includes Zod, so `e2e/content-security-policy.spec.ts:193` passes with
storage on, and the full local browser suite is green before the v1 deploy
(the needs-you line "Run the full browser suite locally, with real R2").

**Cause, from the build** (`build/client/assets`, 2026-10-13): Zod 4 decides
whether to compile an object schema with `new Function` when the schema is
*constructed* (`node_modules/zod/v4/core/schemas.js:1166-1168`), not when it
parses. Two shared client chunks construct schemas at module scope -
`brand-fields-*` (via `settings/settings-input.ts`, which also pulls in
`contact/contact-message.ts`) and `user-input-*` (`users/user-input.ts`) - and
both evaluate before the route chunk's own body. `settings.tsx` imports
`zod-jitless.client.ts`, but that code runs in the route chunk, after the
probe has already fired. The four routes that load the Zod chunk are
`settings`, `onboarding/start-brand`, `account/account` and
`signup/reset-password`; only the first is visited by the CSP spec (F-102).

## In scope

- Make `jitless` take effect before any client-side schema is built, by
  importing `zod-jitless.client.ts` first in the two modules that build them.

## Out of scope

- Browser CSP checks for `account`, `reset-password` and `start-brand` (F-102,
  stays open).
- The content security policy itself - unchanged.
- F-152 (keyboard selection) and F-230, which the same spec file works around.

## Build steps

- [x] **Step 1 - set `jitless` where schemas are built** - in
  `app/features/settings/settings-input.ts` and `app/features/users/user-input.ts`,
  add `import "#app/lib/zod-jitless.client.ts";` as the **first** import (ESM
  evaluates imports in source order, so it must precede `contact-message.ts` in
  `settings-input.ts`). Remove the now-redundant import from
  `app/features/settings/settings.tsx`. Rewrite the comment in
  `app/lib/zod-jitless.client.ts`: it is imported by the modules that build
  schemas in browser code, first, because Zod probes at construction; name
  the two. *Done when:* `npm run test:e2e -- e2e/content-security-policy.spec.ts`,
  run locally with the real `.env` (storage on, nothing skipped), passes, having
  failed at `content-security-policy.spec.ts:308` with
  `script-src blocked eval (from .../schemas-*.js:1)` before the change (seen
  2026-10-13 in the full run, 693 passed, 1 failed); and `npm run verify`
  passes.

## Files and areas

- `app/features/settings/settings-input.ts` - one import line
- `app/features/users/user-input.ts` - one import line
- `app/features/settings/settings.tsx` - remove one import line
- `app/lib/zod-jitless.client.ts` - comment only

## Data and contracts

None.

## Testing

- The reproduction is the existing browser test
  `e2e/content-security-policy.spec.ts:193`. It runs only locally with storage
  configured: CI skips it (`E2E_SKIP_R2=1`), so this fix is proven by a local
  run, not by CI.
- Unit tests: `settings-input.ts` and `user-input.ts` are also imported by
  `node --test`; there `zod-jitless.client.ts` runs as plain code and turns
  `jitless` on for that process. Validation results are the same either way,
  so `npm test` must still pass unchanged. On the server build React Router
  stubs `.client` modules, so the server keeps the compiled fast path.

## Decisions

None.

## Production needs

None.

## Behaviour changes

None - no capability file covers the content security policy; the browser test is the record.

## Notes

- Biome's import sorting treats a side-effect import as a group boundary, so it
  stays first; confirm `npm run lint` does not move it.
- Not a security change: the policy still refuses eval; this only stops Zod
  asking.

## Findings

### 2026-10-13-csp-zod-jitless/F-399 [P2] closed - The editor-chrome CSP test fails with "script-src blocked eval" whenever storage is on

**Found:** 2026-10-12 by review (scope: current; lens: tests)
**Why it matters:** `content-security-policy.spec.ts:192` is skipped in CI and under `E2E_SKIP_R2=1`, so it has not run for a while; with R2 configured it fails on `main` too: Zod's JIT probe (`new Function`) runs in a client chunk before `zod-jitless.client.ts` is imported (only `settings.tsx` imports it).
**Suggested fix:** import `zod-jitless.client.ts` from the editor's entry (or the root), then run the spec locally with storage.
**Resolution:** fix/csp-zod-jitless, 2026-10-13 - `zod-jitless.client.ts` is now the first import of `settings-input.ts` and `user-input.ts`, the two modules that build schemas in browser code (Zod probes at construction), and no longer imported by `settings.tsx`. Test: `e2e/content-security-policy.spec.ts:193`, the finding's own reproduction, run locally with the real `.env` (storage on): before the repair 1 failed at `:308` with `script-src blocked eval (from .../schemas-DE2IPrNl.js:1)`, after it 7 passed. `npm run verify` exit 0. Closed by build.

### 2026-10-13-csp-zod-jitless/F-426 [P1] closed - The v1 release has nowhere to go: no platform or sites domain, no Cloudflare token, Caddy not rebuilt

**File:** `blueprint/context/needs-you.md` (domain, Cloudflare token and Caddy lines); `deploy/setup-server.sh`; `/etc/caddy/habre-cms.env` on `ocwebserver`
**Found:** 2026-10-12 by preflight
**Why it matters:** `PLATFORM_URL` and `SITES_URL` are required at startup and need two domains that are not bought. Item 16b's Caddy file needs the Cloudflare DNS module and a zone-scoped token, and `setup-server.sh` refuses without them. Item 21c needs the `on_demand_tls { ask }` line in the server's main Caddyfile. None has run against a real Caddy. Without these, the release cannot start or serve a site. Not a code defect; a person's work.
**Suggested fix:** `host`, with the owner's yes: buy both domains, create the token, add the Caddy module and `ask` option, fill `/etc/caddy/habre-cms.env`, then `caddy validate` the two Caddy files. The needs-you lines name each step.
**Deferred to:** `host` - release blockers, not code in this fix; due before the v1 deploy (owner, 2026-10-12)
**Resolution:**
Re-checked by preflight, 2026-10-13, at `22ec086` - **closed**. Platform domain: interim `app.surenmaharjan.fyi` by decision (D495), DNS answered by Porkbun's `*` CNAME; sites domain `habre.page` bought, `*.habre.page` A 161.33.89.75 (DoH, `progress.md`). Cloudflare token: owner's `tokens/verify` on the server returned `active`, expires 2027-10-12 (`dev-notes/v1-deploy-prep-2026-10-13.md`). Checked over SSH today: `caddy list-modules` lists `dns.providers.cloudflare` (count 1); `/etc/caddy/Caddyfile` opens with the global block holding `on_demand_tls { ask http://127.0.0.1:3000/_caddy/ask }`. What remains - filling `/etc/caddy/habre-cms.env`, installing and `caddy validate`-ing the two habre-cms Caddy files, the wildcard-certificate `curl` - are `deploy` steps already listed in `blueprint/production-pending.md` (16b, 21c); `/etc/caddy/habre-cms.env` could not be read without sudo.

### 2026-10-13-csp-zod-jitless/F-427 [P1] closed - The v1 migration set (0008-0026) has never been rehearsed on a restored production backup; the fresh-database decision that replaces it is not recorded

**File:** `db/migrations/0008` to `0026`; `blueprint/production-pending.md` (15a line 3); `blueprint/project-plan.md` section 8 (D163)
**Found:** 2026-10-12 by preflight
**Why it matters:** The plan's own gate says the whole set runs locally against a restored copy of the latest production backup before the deploy. `dev-notes/status.md` records only single rehearsals inside rolled-back development transactions, never the full set on production-shaped data. `0009` and `0012` delete every entry, user, membership and media row; `0011` drops `users.role`. None can be undone by symlink - the only rollback is restoring the pre-deploy dump. An unrehearsed run of that set on the only hosted copy is how a release becomes an outage.
**Suggested fix:** `migrate`: restore the latest R2 backup into a scratch database, run `db:migrate` from `8d82ce4`'s schema through `0026`, run `create-admin`, boot the app and hit `/healthz`; record the result and timings. Then practise restoring the pre-deploy dump once.
**Resolution:**
Re-checked by preflight, 2026-10-13, at `22ec086` - **still a blocker, now a records one.** The owner decided on 2026-10-13 that production starts on a fresh database: drop and recreate `habre_cms`, migrate 0001-0026 from empty (the path CI's `e2e` runs on every push), no rehearsal, no backup copied (`dev-notes/v1-deploy-prep-2026-10-13.md`). That removes this finding's risk, but the decision lives only in a dev note: `dev-notes/decisions.md` D162 still says site 1 carries today's users and domain and D163 still requires the rehearsal, and `blueprint/production-pending.md` (15a line 3) still lists it - the files `deploy` reads. Repair: record the decision as a D-entry superseding D162/D163's rehearsal (`architect` or `docs`), and rewrite the 14a1/15a/15b lines in `production-pending.md` for the fresh start (drop, recreate, `roles.sql`, migrate, `create-admin`). Dropping the database still needs its own yes at `deploy`. Then preflight closes this.
Repaired 2026-10-13 - **fixed**, for preflight to close: D503 in `dev-notes/decisions.md` records the fresh database and supersedes D162's carried users and D163's rehearsal and dump rollback; `blueprint/project-plan.md` (site 1 note, *Production holds* bullets) and `blueprint/production-pending.md` (14a1, 15a, 15b lines) now describe drop, recreate, `roles.sql`, migrate from empty, `create-admin`. Dropping the database is still its own yes at `deploy`.
Re-checked by preflight, 2026-10-13 - **closed**: D503 is in `dev-notes/decisions.md`, and `project-plan.md` and `production-pending.md` both name it and no longer call for a rehearsal (`grep -c D503`: decisions 1, plan 2, pending 3). The drop stays a separate yes at `deploy`.

### 2026-10-13-csp-zod-jitless/F-102 [P3] closed - The CSP browser test is described as covering more screens than it visits

**File:** app/lib/zod-jitless.client.ts:8-9; e2e/content-security-policy.spec.ts:148
**Found:** 2026-09-28 by review (scope: current; lens: quality, tests)
**Why it matters:** The jitless module's comment says the CSP browser test "fails if a new one forgets" to import it, and the test is named "every admin screen". But the test never visits the pages list or page editor, add or edit user, or any delete confirmation. A screen that later pulls Zod into its bundle, or adds an inline `style` on the public site, is only caught if it is one of the visited screens, and the comments promise more than that.
**Suggested fix:** Reword both to name what is actually walked, e.g. "the post editor, settings, and the other screens `content-security-policy.spec.ts` visits". Alternatively, add the page editor and the user forms to the walk; each is a `goto` plus one visibility assertion.
**Resolution:** Fixed in tidy-findings Step 5 (2026-10-02, autopilot): zod-jitless.client.ts comment and the CSP test name list the screens the walk visits. Review 2026-10-02: repaired; stays fixed (autopilot never closes its own repairs). Review 2026-10-13 (fix/csp-zod-jitless): the rewritten zod-jitless.client.ts comment still lists exactly the screens the walk visits and says the others are unchecked; closed.
