# Fix: Two browser tests fail at random - strict mode, and the signup race refused as busy

**Type:** Fix
**Quick:** yes - `e2e/manage-posts.spec.ts` and `e2e/signup.spec.ts` only, both tests; no product code, no stored data, contract, dependency or variable; Behaviour changes none; nothing `quality-bar.md` names; reproduced by Playwright (the probe in Step 1)
**Verified:** not yet
**Reviewed:** not yet

## Goal

Two browser tests fail CI's `e2e` at random, on code that is right, because
their locators match two elements at the moment they check. In the last 12 CI
runs they caused every `e2e` failure: `manage-posts.spec.ts:149` three times
(including item 18b3's PR #43, run 37677490732) and `signup.spec.ts:272`
twice (runs 37605727181, 37581026172 on `main`). A red `e2e` that is usually
noise teaches people to merge past it.

## In scope

- **`e2e/manage-posts.spec.ts:149`, "canceling a delete leaves the post
  exactly as it was"** - `waitForURL(/<id>\/delete/)` resolves on the
  client-side URL change, while the posts list can still be on screen; line
  157's `getByText("Keep this one")` then matches the list's title link and
  the Delete link's hidden "Delete Keep this one" text. Repair: first wait for
  the delete screen's own heading, `getByRole("heading", { level: 1, name:
  "Delete this post?" })`, then check the title within `main` exactly
  (`page.getByRole("main").getByText("Keep this one", { exact: true })`).
- **`e2e/signup.spec.ts:272`, "two signups at once for one address"** - line
  291's `getByRole("heading", { level: 1 }).or(getByRole("alert"))` waits for
  either the next screen or the error; on the losing page, once the "is taken"
  alert shows, it matches the page's own `h1` Create your website **and** the
  alert. Repair: wait for what each page ends on rather than "either" - a
  winner's URL `/signup/sent`, or an alert - with `.first()` on the `.or()`
  locator so its match of two is not a violation. The existing assertions
  after it (exactly one on `/signup/sent`, the other's alert says "is taken")
  stay unchanged and still decide the test.

## Out of scope

- F-251's flakes (`block-toolbar.spec.ts:687`, `sites.spec.ts:56`,
  `site-navigation.spec.ts:115`) - a different shape (sign-in stalls under
  load), still open.
- The CI "Install Chromium" hang on PR #43's second attempt - GitHub's runner,
  not this repository; caching the browser is a separate `ci` change if it
  recurs.
- Any other `getByText` / `.or()` in the suite - not seen failing.
- The number of password-check slots (2, F-231's guard for the public
  site) - the app is right; only the test assumed it had both slots.

## Build steps

- [x] **Step 1 - make both locators unambiguous** - the two repairs above.
  *Done when:* (a) **seen failing first:** a temporary probe, run with
  `npx playwright test` before the repair and deleted after, shows each old
  locator resolving to 2 elements in the state CI hit - the posts list with
  "Keep this one" on it (`getByText("Keep this one")` count 2), and the losing
  signup page after its alert shows (`h1.or(alert)` count 2), so the
  original `toBeVisible()` there throws the strict-mode violation; (b) after
  the repair, `npx playwright test e2e/manage-posts.spec.ts:149
  e2e/signup.spec.ts:272 --repeat-each=10` passes 20 of 20 with
  `E2E_SKIP_R2=1`; (c) `npm run lint` passes. Runs locally, needs the
  development database (`docker compose up -d`); CI's `e2e` job runs both
  tests on the PR.
- [x] **Step 2 - repeat the signup race when it was refused as busy (F-363)**
  - signup takes one of the two `passwordCheckSlots` login shares
  (`app/features/auth/login-rate-limit.server.ts:25`), so a login on the
  other worker can make one of the two signups "Signup is busy." before the
  race reaches the database (PR #44, CI run 37683844073). In
  `e2e/signup.spec.ts:272`, run the race as an attempt - a fresh address,
  two fresh invites, two contexts - wait until each page is on
  `/signup/sent` or shows an alert, and when either alert says "busy", close
  both and try again, at most 3 attempts; fail naming the busy refusals if
  all 3 were. The assertions after it are unchanged: exactly one page on
  `/signup/sent`, the other's alert says "is taken". *Done when:* (a) red:
  before the repair, `npx playwright test e2e/manage-posts.spec.ts
  e2e/signup.spec.ts -g "canceling a delete leaves|two signups at once"
  --repeat-each=10` on 2 workers shows the "Signup is busy" failure; (b)
  after it, the same command passes 20 of 20; (c) `npm run lint` passes;
  (d) CI's `e2e` on PR #44 is green.

## Files and areas

- `e2e/manage-posts.spec.ts` (lines 155-157)
- `e2e/signup.spec.ts` (lines 272-302)

## Data and contracts

None.

## Testing

Browser tests only, `npm run test:e2e` / `npx playwright test`, locally with
the development database and in CI's `e2e` job. The timing that triggers the
flakes may not happen on a fast laptop, which is why (a) proves the
ambiguity directly with a probe instead of waiting for it to occur.

## Decisions

None.

## Production needs

None.

## Behaviour changes

None - test code only; no product behaviour changes.

## Notes

- Prefer role-based locators (`coding-standards.md`, *Test runner*).
- The probe is evidence, not a test to keep: delete it before the commit.
- Item 18b3's PR #43 is waiting on a green `e2e`; once this merges, rebase
  that branch on `main` so its CI runs the repaired tests.
