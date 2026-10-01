# Fix: Browser tests run in CI (F-17)

**Type:** Fix
**Status:** not started
**Repairs:** F-17 [P2] - the browser tests that cover login never run automatically

## Goal

`npm run test:e2e` runs on every pull request and push to `main`, in a new CI
job with its own PostgreSQL, so a regression in login, roles, content, sections
or the public site fails a check instead of reaching `main` with every gate
green. Today `verify` (the one command CI runs) excludes the 141 browser tests
because they need a database; they run only when someone remembers.

## In scope

- A second CI job, `e2e`, beside `verify`: a `postgres:16-alpine` service
  container, the role and database created by the project's own
  `db/dev/init.sh` (same non-superuser shape as development and production),
  `npm run db:migrate`, Chromium installed, `npm run test:e2e`.
- **26 of the 141 tests upload to real Cloudflare R2** (measured 2026-10-01 by
  running the suite with dummy R2 values: 115 pass, 26 fail with `fetch
  failed`). CI has no R2 credentials and the shared dev token must not go there,
  so those 26 **skip themselves in CI** through an explicit switch,
  `E2E_SKIP_R2=1`, and still run locally. Files: `image-block` (7),
  `page-image-text` (12), `manage-settings` (2), `content-security-policy` (2),
  `public-site` (2), `page-sections` (1).
- The app still needs all five `R2_*` variables to start (`env.server.ts`), so
  the job sets obviously fake values; nothing in CI can reach a real bucket.
- `forbidOnly` in CI so a committed `test.only` cannot silently shrink the
  suite; the failure report and traces upload as an artifact when the job fails.
- `AGENTS.md`'s `ci` environment row and `dev-notes/status.md` say what CI now
  runs and what it skips.

## Out of scope

- **A fake R2 server** so the 26 also run in CI (needs an optional
  `R2_ENDPOINT` override in `r2.server.ts` - a production-code change and a new
  env var). Chosen against by the owner 2026-10-01; the 26 stay local-only and
  are named in the docs so it reads as a decision, not an oversight.
- F-103 (specs sharing the one `site_settings` row, `workers: 2`). It is a
  known race; this fix does **not** add retries, so a rare red run is possible
  and is F-103's evidence, not a reason to mask it.
- Making the `e2e` check **required** in GitHub branch protection (the owner's
  repository setting - recorded in `needs-you.md`).
- Any change to `npm run verify`: it stays database-free and fast.
- Production, Caddy, migrations. None.

## Build steps

- [x] **Step 1 - The R2 skip switch** - add `e2e/helpers/storage.ts` exporting
  `skipWithoutStorage` (true when `process.env.E2E_SKIP_R2 === "1"`) and the
  reason string. Apply it so exactly the 26 tests skip: a file-level
  `test.skip(skipWithoutStorage, reason)` where every test in the file needs
  R2 (`image-block`, `page-image-text`), a per-test or `describe`-level skip in
  the mixed files. *Done when:* with `E2E_SKIP_R2=1` and fake `R2_*` values the
  suite reports **115 passed, 26 skipped, 0 failed**; without the switch (local
  `.env`) it still reports **141 passed**; `npm run typecheck` and `npm run lint`
  are clean. The skipped count is in the step's note.
- [x] **Step 1b - Remove the exact-count race in `manage-posts.spec.ts`** -
  added after autopilot stopped (owner chose this fix, 2026-10-01): the test
  "the list is scoped by role, and the tabs' counts match" asserted `All3` for
  an editor, who sees every author's posts, so a post from a spec running in
  parallel made it `All4` (3 of 4 full runs with 26 tests skipped). The editor
  step now asserts the other author's post is visible and the All count is at
  least 3. The author-scoped counts above it stay exact (an author sees only
  their own). Other specs were searched for the same pattern: none. *Done when:*
  three consecutive full runs with `CI=1 E2E_SKIP_R2=1` report 115 passed / 26
  skipped / 0 failed, and the test still goes red if an editor stops seeing
  another author's post (mutation shown).
- [x] **Step 2 - Strict mode in CI** - in `playwright.config.ts` set
  `forbidOnly: !!process.env.CI` and, in CI only, `reporter: [["list"],
  ["html", { open: "never" }]]` so the failure artifact exists. No retries.
  *Done when:* with `CI=1`, a temporary `test.only` fails the run before any
  test starts (shown, then removed), and a normal `CI=1` run still reports 115
  passed / 26 skipped.
- [x] **Step 3 - The `e2e` CI job** - in `.github/workflows/ci.yml` add job
  `e2e` (`ubuntu-24.04`, `timeout-minutes: 20`, same SHA-pinned checkout and
  setup-node, Node 26, `npm ci`). Service `postgres:16-alpine` with
  `POSTGRES_PASSWORD` and a health check. Steps: create the role and database
  by running `db/dev/init.sh` with `POSTGRES_USER=postgres`,
  `HABRE_DB_PASSWORD` and `PGHOST=127.0.0.1`; `npm run db:migrate`; `npx
  playwright install --with-deps chromium`; `npm run test:e2e`; on failure,
  upload `playwright-report/` and `test-results/` (the upload action pinned to a
  commit SHA like the others). Job env: `DATABASE_URL`, a `JWT_SECRET`
  generated in the job (`openssl rand`), fake `R2_*`, `E2E_SKIP_R2=1`; no
  repository secrets are used. `permissions: contents: read` stays. *Done when:*
  the workflow parses and every `uses:` is a full commit SHA with its version
  comment; and a **local rehearsal of the same command sequence** against a
  throwaway `postgres:16-alpine` container on a spare port, with a clean clone
  and no `.env`, ends **115 passed / 26 skipped** (the rehearsal's output is the
  evidence).
- [x] **Step 4 - Docs and the finding** - `AGENTS.md` *Environments* `ci` row:
  it now has a database service and runs browser tests, skips the 26 R2 tests,
  holds no secrets; keep the Node pin sentence. `dev-notes/status.md`: what CI
  runs, the 26 skipped and why, how to run the same by hand, F-17 resolved.
  `needs-you.md`: a line to make `e2e` a required check. Set F-17 to `fixed`
  with the evidence (`build` never closes a P2 without a failing-first test; the
  failing-first proof is Step 5). *Done when:* the docs match the workflow file
  when re-read against it.
- [x] **Step 5 - Prove it on GitHub** - **needs your yes to push a branch**
  (AGENTS.md: no push without a separate yes). Push the fix branch and open a
  pull request: the `verify` and `e2e` jobs both pass, `e2e` showing 115 passed
  / 26 skipped. Then, on a throwaway commit on the same branch, break one login
  behaviour the auth specs cover (for example remove the failed-login lockout)
  and show the `e2e` job **fail**; revert it and show it pass again, so the new
  check is seen to fail once. *Done when:* the three runs' ids and results are
  in the step's note, and the throwaway commit is gone from the final branch.

## Files and areas

- `.github/workflows/ci.yml`
- `playwright.config.ts`
- `e2e/helpers/storage.ts` (new); `e2e/image-block.spec.ts`,
  `page-image-text.spec.ts`, `manage-settings.spec.ts`,
  `content-security-policy.spec.ts`, `public-site.spec.ts`,
  `page-sections.spec.ts` (skip lines only)
- `AGENTS.md`, `dev-notes/status.md`, `blueprint/context/needs-you.md`,
  `blueprint/findings/F-17.md`, `blueprint/context/findings.md`

## Data and contracts

None. No app code, no schema, no stored shape. The only new interface is the
test-run switch `E2E_SKIP_R2=1`.

## Testing

- **Where each check runs:** the unit tests and `verify` stay in the `verify`
  job (no database). The browser tests run in the new `e2e` job (PostgreSQL
  service, Chromium) and locally (`npm run test:e2e`, dev database + real R2 for
  all 141).
- **Failing-first:** Step 5's deliberate break is the proof the new check can
  fail; Step 2's `test.only` check proves strict mode.
- **Bar:** the quality bar names no CI target; the job's own budget is 20 min,
  and the measured run time goes in the step 5 note (the local suite takes about
  1.5 min).

## Decisions

- **The 26 R2-dependent browser tests skip in CI through an explicit
  `E2E_SKIP_R2=1` switch.** Beats: a fake R2 server with an `R2_ENDPOINT`
  override (production-code change, bigger item); real credentials in CI (the
  shared dev token, fork-PR exposure); auto-detecting a missing bucket (a
  silent skip is how coverage disappears). Costs: image, logo and media
  behaviour is not covered by CI; the count (26) is named in the docs.
- **Browser tests are a separate `e2e` job, not part of `verify`.** Beats:
  adding them to `verify` (it would need a database on every laptop run of the
  quick check, and AGENTS.md says `verify` is database-free). Costs: two checks
  to read.
- **The CI database is built by `db/dev/init.sh`, not a superuser from the
  service's own environment.** Beats: `POSTGRES_USER` on the image (a superuser,
  so a migration needing one would pass in CI and fail in production). Costs:
  one extra step.
- **No retries in CI.** Beats: `retries: 1` (hides the F-103 race and any other
  flake). Costs: a rare red run until F-103 is fixed.

## Production needs

None. CI only; nothing reaches the server and no variable is added to
`production.env`.

## Notes

- Follow the CI row in `AGENTS.md`: `ubuntu-24.04`, Node pinned to `26`, actions
  pinned to commit SHAs - never `latest` or a tag.
- No secrets in the workflow; `JWT_SECRET` is generated per run and the R2
  values are fake strings that cannot authenticate anywhere.
- Playwright's own config builds the app and starts three servers (ports
  3100-3102); the job needs nothing else running.
- The e2e helpers read `DATABASE_URL` from the environment; `.env` is optional
  (`playwright.config.ts` loads it only if present).
- `build` branches off `main` (`fix/browser-tests-in-ci`); nothing is committed
  unseen; **the push in Step 5 and any merge need their own yes.**
- Four docs-only changes are uncommitted on `main` from the 12a-12c deploy record
  (CHANGELOG, `status.md`, `production-pending.md`, overview). They are not part
  of this fix; commit them to `main` first, or they will ride along.

## Step 5 evidence (2026-10-01)

- **Green:** PR #22, run 36821876462 - `Verify` pass (33 s), `Browser tests
  (Playwright, PostgreSQL)` pass (3 m 14 s): **115 passed, 26 skipped**.
- **Red:** throwaway draft PR #23 (lockout limit 5 -> 500), run 36822186924 -
  `Verify` **pass** (31 s, so the old CI would have let it through), `e2e`
  **fail** (3 m 40 s) on `auth.spec.ts:65` "five failed logins lock the email,
  even for the right password"; the `playwright-report` artifact uploaded.
- **Cleanup:** #23 closed and its branch deleted (remote and local); the fix
  branch carries no trace of the break. Because the break lived on its own
  branch, "revert and pass again" is shown by #22's green run on the same code.
- The runner's own `psql` ran `db/dev/init.sh` (the assumption from Step 3).
- `e2e` takes about 3 m 14 s on GitHub (local: 1.2 min), inside the 20 min limit.

