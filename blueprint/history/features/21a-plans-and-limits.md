# Feature: Plans and limits

**From build plan:** item 21a
**Type:** Feature
**Verified:** 2026-10-12, c8304e07172b, 8 of 9 proven, 1 could not verify (Step 3's query log; no screenshots taken)
**Reviewed:** 2026-10-12, c8304e07172b, current, every lens - 0 blocking

## Goal

A site's limits follow its plan. Free keeps today's numbers; Launch (the
`sites.plan = 'paid'` value) raises storage and the monthly AI allowance and
drops the "Made with Habre" footer link. `/admin/plan` shows the plan and what
is used. Nothing is paid for yet: an operator command sets the plan until item
21b's webhooks do (D150, D175).

## In scope

- Migration `0024`: `billing_customer_id`, `billing_subscription_id`,
  `billing_status`, `paid_until` on `sites` (all nullable; written by 21b).
- Launch's limits by configuration: `LAUNCH_STORAGE_LIMIT_MB`,
  `LAUNCH_AI_CREDITS_PER_MONTH`. Free's stay `STORAGE_LIMIT_MB` and
  `AI_CREDITS_PER_MONTH`.
- Storage and AI allowance resolved per site from its plan (today both are
  process-wide).
- The "Made with Habre" footer link on public pages of Free sites.
- `/admin/plan` (admin only) and its nav entry.
- `npm run set-plan -- --address <site> --plan free|paid`.
- At a limit, the refusal says "Paid plans are coming soon" (already true for
  storage; added to the AI refusal).

## Out of scope

- Stripe, Checkout, the Portal, webhooks, `billing_status` writes, an Upgrade
  button, the billing switch: **21b**.
- Own domains: **21c**. The plan page does not offer one.
- Downgrade behaviour beyond what falls out of reading the plan at request
  time (a Free site over its limit keeps what it has and cannot add): 21b adds
  the triggers.
- Launch's price and the final limit numbers: `needs-you.md` ("Free plan limits
  and the paid plan's price"). The defaults below are provisional.

## Design reference

`blueprint/context/design.md` has no plan screen. It reuses the Media meter
and Home's AI meter as they are and the shell's page layout; no new component
or state. Add one line to `design.md` after the item if the page's look
differs.

## Build steps

- [x] **Step 1 - Migration `0024`** - the four nullable columns on `sites`,
  `billing_status` constrained to a short list (`active`, `past_due`,
  `canceled`), additive so a symlink rollback is safe (the old release never
  reads them). `migrate` skill. *Done when:* `npm run db:migrate` applies it on
  the development database; `\d sites` shows the columns; existing rows read
  null; the app role can update `sites` (as `suspend-site` already does).
- [x] **Step 2 - Limits by plan, as a pure module** - `app/features/plans/plan-limits.ts`:
  `limitsFor(plan, config)` returning `{ storageBytes, aiCredits }` (either may
  be null = none). New env variables parsed in `limits-env.server.ts` and
  `ai-env.server.ts` with the existing rules; defaults `10240` MB and `6000`
  credits (about 20 generations, D150's starting points, provisional). Unset
  Launch values never lower below Free's. `.env.example` lists them.
  *Done when:* unit tests: Free returns the Free numbers; paid returns the
  Launch numbers; `none` is null; an invalid value names its variable; a Launch
  value below Free's is refused at startup naming both variables.
- [x] **Step 3 - The site's plan reaches the request** - `PublicSite` and
  `findSiteBy*` carry `plan` (same query, no new one); an admin request reads it
  from the site row it already loads (`findMemberSite`). *Done when:* a unit
  test over the lookup shape; no extra query is added to a public request
  (checked by reading the diff and the query log of one page load).
- [x] **Step 4 - Storage follows the plan** - `store-upload.server.ts`, Media's
  meter and Home's storage line use `limitsFor(site.plan)`. *Done when:* a
  Playwright test (extending `e2e/storage-limit.spec.ts`): the same upload that
  a Free site is refused for is accepted for a paid site, and Media's meter
  shows the Launch limit.
- [x] **Step 5 - AI allowance follows the plan** - `createRunner` resolves the
  allowance per site (`allowanceFor(siteId)`) instead of one number; Home's
  meter and the wait's refusal use it; the refusal text ends with "Paid plans
  are coming soon." *Done when:* unit tests in `run-generation.test.ts`: a
  site on Free with 1,000 credits used is refused, a paid site with the same
  use starts; the refusal text names the renewal date and the coming-soon
  line.
- [x] **Step 6 - The footer link** - the public layout's loader returns
  `showCredit` (plan is free); the footer renders `<a>` "Made with Habre" to
  the platform origin, inside the existing `footer`, with no new landmark.
  Paid sites render no link. *Done when:* Playwright: a Free site's page has a
  link named "Made with Habre" in its `contentinfo`; the same page for a paid
  site has none; the admin Preview shows it the way the public page does.
  Public pages stay under the 500 ms p95 bar (`quality-bar.md`): no added
  query, per Step 3.
- [x] **Step 7 - `set-plan`** - `scripts/set-plan.ts`, `npm run set-plan`,
  modelled on `suspend-site.ts` (app role, `--address`, `--plan`, exits 1 for
  an unknown address, prints the old and new plan). Documented in `AGENTS.md`
  commands. *Done when:* a unit test for the argument rule; run against the
  development database it flips a site and back, and Step 6's pages follow.
- [x] **Step 8 - `/admin/plan`** - route in `app/routes.ts`, admin only
  (`requireRole`, 404 for others), "Plan" in the shell nav for admins at both
  levels. Shows the plan's name (Free / Launch), storage and AI meters with the
  numbers of that plan, what Launch adds (more storage, more AI, no footer link; the own
  domain is not listed until 21c), and "Paid plans are
  coming soon." AI meter hidden when AI is off. Semantic headings: one `h1`,
  meters as `<meter>`/`progress` as the existing ones. *Done when:* Playwright:
  admin sees the page and its numbers for each plan; an author or editor gets
  a 404; the page has one `h1`; role-based locators only.
- [x] **Step 9 - Capabilities and docs** - `limits.md`, `ai.md`/`onboarding.md`
  and a new `plans.md` updated per *Behaviour changes*; `.env.example`,
  `AGENTS.md` environments row mention the Launch variables. *Done when:*
  `npm run verify` passes.

## Files and areas

`db/migrations/0024_billing_columns.sql`; `app/features/plans/` (new);
`app/lib/limits-env.server.ts`, `ai-env.server.ts`, `env.server.ts`;
`app/features/media/store-upload.server.ts`, `media-list.tsx`;
`app/features/ai/runner.server.ts`, `run-generation.ts`;
`app/features/admin-shell/home.tsx`, `layout.tsx`;
`app/features/public-site/layout.tsx`; `app/features/sites/find-site.server.ts`,
`site-context.ts`; `scripts/set-plan.ts`; `app/routes.ts`; `package.json`;
`.env.example`; `e2e/storage-limit.spec.ts`, `e2e/plan.spec.ts` (new).

## Data and contracts

- `sites.plan` already exists (`free` | `paid`, `0010`); `paid` is Launch.
  **Load-bearing for 21b and 21c:** they read the plan only through
  `limitsFor` / `site.plan`, and 21b's webhooks are the only writer besides
  `set-plan`.
- New columns (Step 1): `billing_customer_id text`, `billing_subscription_id
  text`, `billing_status text`, `paid_until timestamptz`. No row-level
  security (platform table).
- `limitsFor(plan, config): { storageBytes: number | null; aiCredits: number | null }`.

## Testing

- Unit (`npm test`, no database): `plan-limits`, env parsing, run-generation
  allowance, `set-plan` arguments.
- Browser (`npm run test:e2e`, needs the development database; CI runs them,
  none of these upload to R2 except the storage test, which already uses
  `skipWithoutStorage`): `e2e/plan.spec.ts`, `e2e/storage-limit.spec.ts`,
  footer link.
- Manual: screen reader over `/admin/plan` - appended to the existing
  `needs-you.md` line.

## Decisions

- **Launch's limits are two new variables, not a table or database rows**
  (beats per-plan JSON, and a `plans` table: one paid plan, and self-hosters
  already configure by environment). Provisional defaults 10 GB / 6,000
  credits; the owner sets them (`needs-you.md`).
- **The footer link is tied to the plan alone, with no switch** (beats an
  env flag): a self-hosted copy without payment sets its site to `paid` with
  `set-plan` to remove it.
- **`/admin/plan` exists with billing off** (beats hiding it, as plan section
  *Switches* currently says): there it shows the plan and use with no way to
  pay. Billing's switch (21b) only adds the buttons.
- **Admin loaders read the plan with their own `findMemberSite` call** (beats
  putting `plan` on `userContext`, which would change `findUserById` and
  `SessionUser`): one primary-key query on admin routes and uploads only;
  public requests gain none (Step 3). `env.PLAN_LIMITS` is the config
  `limitsFor` reads; `STORAGE_LIMIT_BYTES` was removed.
- **Operator `set-plan` command until 21b** (beats a SQL one-liner in the
  runbook): matches `suspend-site`.

## Production needs

- Migration `0024` (additive).
- Optional: `LAUNCH_STORAGE_LIMIT_MB`, `LAUNCH_AI_CREDITS_PER_MONTH` in
  `/etc/habre-cms/production.env`; defaults apply when unset.
- No external service.

## Behaviour changes

- Changes `limits.1` from "an upload whose stored sizes would take a site's media past its storage limit (`STORAGE_LIMIT_MB`, 500 MB unless set) is refused with a message naming the limit, and no media row is added" to "an upload whose stored sizes would take a site's media past its plan's storage limit (Free `STORAGE_LIMIT_MB`, 500 MB unless set; Launch `LAUNCH_STORAGE_LIMIT_MB`, 10 GB unless set) is refused with a message naming the limit, and no media row is added" - Step 4
- Changes `ai.5` from "a site with no credits left this month cannot start a run" to "a site with no credits left of its plan's monthly allowance cannot start a run" - Step 5
- New capability `plans`: a site's plan is Free or Launch and starts as Free - Step 3
- Adds to `plans`: a Free site's public pages carry a "Made with Habre" link in the footer, a Launch site's do not - Step 6
- Adds to `plans`: an operator can set a site's plan with `npm run set-plan` - Step 7
- Adds to `plans`: an admin sees the plan, its limits and the use against them at `/admin/plan`; other roles get a 404 - Step 8
- Adds to `limits`: `LAUNCH_*` values below Free's stop the app at startup - Step 2

## Notes

- **Plan-file conflict to approve:** `project-plan.md` *Switches* (line ~462)
  says billing off means "no plan page; the configured limits apply to every
  site". This item contradicts it deliberately (see Decisions). Proposed
  edit: "Billing (Stripe is configured) | the plan page shows plan and use with
  no way to pay; limits follow the site's plan". Needs your yes before `build`.
- Follow `coding-standards.md`: `#app/...` imports with extensions,
  `*.server.ts` for database use, Zod at env boundaries, site-owned queries in
  `inSite` (the plan page reads `sites`, a platform table, scoped by id).
- Never print `.env`; tests set their own values.
- Semantic HTML: the footer link is an `a` in the existing `footer`.

## Findings

_No findings were closed in this item; F-405 (P3, open) moved to the backlog._
