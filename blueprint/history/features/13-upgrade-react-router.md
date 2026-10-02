# Feature: Upgrade React Router

**From build plan:** item 13
**Type:** Feature
**Verified:** 2026-10-02, ca4c0a0bfced, 10 of 10 proven
**Reviewed:** 2026-10-02, ca4c0a0bfced, current, every lens (re-review of F-133-F-135: package-lock.json, spec Notes) - 0 blocking

## Goal

Move the app onto React Router 8.4.0 before platform v1 builds on it, so items
13b-21 are written against the current framework and its current installed
docs rather than upgrading mid-feature. Nothing a user sees changes;
`npm run verify` and all 141 browser tests stay green.

## In scope

`npm outdated` on 2026-10-02 (`npm audit`: 0 vulnerabilities, all
dependencies):

| Package | Now | To |
|---|---|---|
| `react-router`, `@react-router/node`, `@react-router/dev` | 8.3.1 | **8.4.0** |
| `@remix-run/node-fetch-server` | 0.14.1 | **0.14.2** |

- Exact pins in `package.json`, as now; `package-lock.json` committed with them.
- Every version record that names these numbers (Step 2).

## Out of scope

- **Vite 8.3.2, Biome 2.5.15 and `@types/node` 26.6.4** - parked by the owner
  (2026-10-02): patch releases with nothing this project needs, and nothing
  deploys before v1 (D163). They wait for the next upgrade.
- **`@remix-run/node-fetch-server` 1.0.0** (published 2026-10-01). D23: our
  direct pin moves in step with `@react-router/node`, whose 8.4.0 range is still
  `^0.14.1`. Taking 1.0.0 would put two copies in the tree and serve every
  request through a major nobody has read. Revisit when `@react-router/node`
  moves to `^1`.
- **Editor.js 2.31.7.** Item 14a removes Editor.js.
- **A wider transitive refresh** (`npm update`). Transitive packages move only
  as far as the new direct versions require.
- **Node 26 LTS** - a runtime change on the server when it is promoted (plan
  section 5), not a package bump.
- The unused import at `app/features/blocks/render.tsx:11` (F-129, F-132) - its
  own quick fix, after this item.
- The look - item 13b.

## Build steps

- [x] **Step 1 - React Router 8.4.0** - first, on the old versions, run
  `npm run verify` and `npm run test:e2e` (local, real R2) and record both
  results in Notes as the baseline, and save the lockfile's package names
  (`node -p "Object.keys(require('./package-lock.json').packages).map(k => k.replace(/.*node_modules\//, '')).filter(Boolean).sort().join('\n')"`)
  to the scratchpad. Then pin `react-router`, `@react-router/node` and
  `@react-router/dev` to 8.4.0 and `@remix-run/node-fetch-server` to 0.14.2,
  and `npm install`. Read `node_modules/react-router/CHANGELOG.md` for 8.3.1 to
  8.4.0 against our code: the `UNSAFE_` context changes (our only `UNSAFE_`
  import is `UNSAFE_ErrorResponseImpl`, in `app/lib/server-errors.test.ts`,
  which is not a context), the `createStaticRouter({ branches })` deprecation
  (not used). Adapt only what breaks.
  *Done when:* `npm ls @remix-run/node-fetch-server` shows one copy, 0.14.2,
  with `@react-router/node`'s deduped onto it; the lockfile's package names,
  compared with the saved list, gain nothing unexplained - every added name is
  listed with the package that pulls it in (none expected: `@react-router/dev`
  8.4.0's peers - `wrangler`, `@react-router/serve`, `@vitejs/plugin-rsc`,
  `react-server-dom-webpack` - are the same as 8.3.1's and still marked
  optional); `npm audit` reports 0 vulnerabilities; `npm run verify` exits 0;
  with `npm start` running, requests to `/` and `/admin/login` leave no line
  containing `deprecat` in its output; with the development database up
  (`docker compose up -d`), `npm run dev` starts and
  `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/healthz`
  prints 200 (`@react-router/dev` is the Vite plugin dev runs on).

- [x] **Step 2 - Record the version, and the full suite** - write 8.4.0 and
  0.14.2 into every record of them (exact edits under *Files and areas*), then
  run `context` to regenerate `project-overview.md`.
  *Done when:*
  `git grep -nE '8\.3\.1|0\.14\.1' -- ':!package-lock.json' ':!blueprint/history' ':!dev-notes/decisions.md' ':!blueprint/context/current-work.md'`
  prints nothing (the decisions log and archives are dated records and stay as
  written); `npm ci` exits 0, so the lockfile agrees with `package.json` the
  way CI installs it; `npm run verify` exits 0; `npm run test:e2e` locally
  reports 141 passed, matching the baseline - including `forwarded-proto.spec.ts`
  (D23's `trustProxy` path) and the quality bar's timing tests
  (`public-site.spec.ts` p95 under 500 ms; the 30-section "saves in under 1 s
  and serves in under 500 ms" tests in `page-cta`, `page-hero` and
  `page-image-text`).

## Files and areas

- `package.json`, `package-lock.json` - Step 1.
- Anything React Router 8.4.0 breaks - expected none (see Step 1).
- **Step 2's version records - these exact edits:**
  - `AGENTS.md` *Stack and versions*: React Router **8.3.1** -> **8.4.0**, and
    `@react-router/dev` and `@react-router/node` 8.3.1 -> 8.4.0 (lines
    161-162); `@remix-run/node-fetch-server` 0.14.1 -> 0.14.2 (line 167).
  - `blueprint/project-plan.md` section 5 (the plan is yours - this list is the
    whole change): line 145 React Router **8.3.1** -> **8.4.0**; line 159
    `@remix-run/node-fetch-server` **0.14.1** -> **0.14.2**.
  - `blueprint/context/coding-standards.md` line 32: "the installed docs for
    8.3.1 decide" -> 8.4.0.
  - `blueprint/context/project-overview.md` - regenerated by `context`, never
    edited by hand.

## Data and contracts

None. No schema, route, stored shape or environment variable changes.

## Testing

- **Unit and build:** `npm run verify` after each step - local, and CI's
  `verify` job runs the same command.
- **Browser:** `npm run test:e2e`, **locally with the real `.env`**, in Step 1
  (the baseline) and Step 2. It needs the development database
  (`docker compose up -d`) and real R2 credentials. CI's `e2e` job runs it with
  `E2E_SKIP_R2=1` and skips the R2 tests (26, per F-17), so only the local run
  proves the whole suite; CI runs once the branch is pushed, which is a
  separate yes.
- **Quality bar:** the existing timing tests are the evidence - nothing new to
  write.
- **No new tests.** An upgrade adds no behaviour; the 141 existing tests and the
  unit suite are the regression net.
- F-103 (two specs share the `site_settings` row) can fail a run at random. The
  Step 1 baseline is what tells a pre-existing flake from a regression: rerun
  that spec alone and note it, rather than calling the upgrade green or red on
  one run.

## Decisions

None. Keeping `@remix-run/node-fetch-server` on 0.14.x is D23's existing rule,
applied.

## Production needs

None. No new variable, migration, account or host setting. The new version
reaches production in v1's one deploy (D163), built locally or in CI as always.

## Behaviour changes

None - an upgrade changes no observable behaviour.

## Notes

- **Capabilities:** there are no capability files yet; `verify --all` would
  seed `blueprint/capabilities/` from the 12 archived items.
- **Branch:** `feature/upgrade-react-router`, cut from `main` at `366115e`
  after `rescope/platform` was fast-forwarded into `main` and deleted.
- **Docs authority:** after Step 1, `node_modules/react-router/docs/` is the
  8.4.0 documentation - every later item reads that, not 8.3.1's.
- **8.4.0's `@react-router/dev` fix** (`X-Forwarded-Proto` in `react-router
  dev` / `vite preview`) does not touch us: we serve through `server.js` and
  set `trustProxy` ourselves (D23), and neither of those commands is used.
- **Lint exited 1 twice during spec review** (2026-10-02), right after a
  read-only `npx @biomejs/biome@2.5.15` preview; five reruns exited 0 with the
  one known warning. If `build` sees it again, `debug` it.
- Never stage `blueprint/rescope-research-2026-10-01.md` - modified, not ours.
- **Installing (Step 1):** a plain `npm install` after editing the pins fails
  with ERESOLVE - `@react-router/node` peers `react-router` at exactly its own
  version, so the packages cannot move one at a time against the old lockfile.
  What worked, with no `--force` or `--legacy-peer-deps`: uninstall the three
  React Router packages, reinstall them together with `--save-exact`, then put
  `@react-router/dev` back under `devDependencies`. The next upgrade should
  install them in one command from the start.
- **One package added (Step 1):** `@remix-run/route-pattern` 0.22.1 (MIT,
  remix-run's own repository) - a regular dependency new in `react-router`
  8.4.0, behind its unstable route-pattern flag. Lockfile 156 -> 157 entries,
  nothing removed; none of the optional peers installed.
- **Baseline (Step 1), 2026-10-02, React Router 8.3.1:** `npm run verify`
  exit 0 on `225ee22` (code identical to the branch point `366115e`) - 296 unit
  tests pass, build OK, lint's one known warning (`render.tsx:11`).
  `npm run test:e2e` locally with real R2: **141 passed (1.6m)**, 0 skipped,
  0 flaky. Lockfile: 156 package entries.
- **Step 1 evidence, 2026-10-02, React Router 8.4.0:** `npm ls
  @remix-run/node-fetch-server` - one copy, 0.14.2, `@react-router/node`'s
  deduped; lockfile 157 entries, the one addition `@remix-run/route-pattern`
  0.22.1, nothing removed, no optional peer installed; `npm audit` 0
  vulnerabilities; `npm run verify` exit 0, 296/296; `npm start` - `/` and
  `/admin/login` 200, no `deprecat` in the log; `npm run dev` - `/healthz` 200.
- **Lockfile tooling restored (F-133):** the uninstall/reinstall had also moved
  six dev-only packages (`@babel/parser`, `browserslist`, `caniuse-lite`,
  `electron-to-chromium`, `node-releases`, `baseline-browser-mapping`) that no
  new range required. Their entries were restored from `main`'s lockfile, so it
  now differs from `main` only in the four upgraded packages and
  `@remix-run/route-pattern`.
- **Step 2 evidence, 2026-10-02, after the restore:** the done-when `git grep`
  prints nothing; `npm ci` exit 0; `npm audit` 0 vulnerabilities;
  `npm run verify` exit 0, 296/296, lint's one known warning;
  `npm run test:e2e` locally with real R2 - **141 passed (1.6m)**, 0 failed,
  skipped or flaky, including `forwarded-proto.spec.ts`, the `public-site` p95
  test and the three 30-section timing tests.

## Findings

### 13-upgrade-react-router/F-133 [P3] closed - Six dev-only lockfile entries moved further than the upgrade required
File: package-lock.json (`@babel/parser`, `browserslist`, `caniuse-lite`, `electron-to-chromium`, `node-releases`, `baseline-browser-mapping`)

**Found:** 2026-10-02 by review (scope: current; lens: dependencies)
**Why it matters:** The spec's *Out of scope* says transitive packages move only as far as the new direct versions require. `@babel/parser` 7.29.8 -> 7.29.9, `browserslist` 4.28.9 -> 4.29.3, `caniuse-lite` ...810 -> ...814, `electron-to-chromium` 1.5.428 -> 1.5.443, `node-releases` 2.0.55 -> 2.0.57 and `baseline-browser-mapping` 2.11.23 -> 2.11.27 all moved through the uninstall/reinstall workaround, though the old versions still met every range. All are `dev: true`; the done-when compared names only, so it did not catch them.
**Suggested fix:** Either restore the six entries from `git show main:package-lock.json` and confirm with `npm ci`, or accept them with a Notes line listing them as dev-only build tooling.
**Resolution:** 2026-10-02, build: the six entries restored from `main`'s lockfile; a lockfile comparison with `main` now lists only the four upgraded packages and `@remix-run/route-pattern`; `npm ci` exit 0, `npm audit` 0, `npm run verify` exit 0 (296/296), `npm run test:e2e` 141 passed. Recorded in the spec's Notes. Closed 2026-10-02 by review (re-review, scope: the repair): confirmed the defect gone and nothing new introduced.

### 13-upgrade-react-router/F-134 [P3] closed - The spec's *Branch* note names a branch that no longer exists
File: blueprint/context/current-work.md (Notes, *Branch*)

**Found:** 2026-10-02 by review (scope: current; lens: quality)
**Why it matters:** `current-work.md` Notes still says "decide before `build` whether `rescope/platform` merges into `main` first". `rescope/platform` was fast-forwarded into `main` and deleted, and this branch was cut from `main` at `366115e`. The archived spec would record an open decision that was already made.
**Suggested fix:** Replace the bullet with "Branched from `main` at `366115e`, after `rescope/platform` was fast-forwarded into it."
**Resolution:** 2026-10-02, build: the *Branch* bullet now names `feature/upgrade-react-router`, cut from `main` at `366115e`. Closed 2026-10-02 by review (re-review, scope: the repair): confirmed the defect gone and nothing new introduced.

### 13-upgrade-react-router/F-135 [P3] closed - The spec records the baseline but not the post-upgrade evidence
File: blueprint/context/current-work.md (Notes)

**Found:** 2026-10-02 by review (scope: current; lens: tests)
**Why it matters:** Steps 1 and 2 are ticked, but Notes holds only the 8.3.1 baseline. `ship` and the archive read this file, not the conversation, and AGENTS.md says never to claim a pass without naming the evidence.
**Suggested fix:** Add one Notes bullet per step naming each done-when command and its result (`npm ls`, `npm audit`, the `npm start` deprecation check, the dev `/healthz` 200, the `git grep`, `npm ci`, `verify` 296/296, e2e 141 passed).
**Resolution:** 2026-10-02, build: *Step 1 evidence* and *Step 2 evidence* bullets added to the spec's Notes, naming each done-when command and its result. Closed 2026-10-02 by review (re-review, scope: the repair): confirmed the defect gone and nothing new introduced.
