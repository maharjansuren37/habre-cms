# Feature: Onboarding steps 1-2 and the wait

**From build plan:** item 18b3
**Type:** Feature
**Verified:** not yet
**Reviewed:** not yet

## Goal

A new admin, right after confirming their email, says what they want to
create and describes it; Habre starts an AI run (18b1-18b2's engine) and
shows its progress until it finishes or fails. This is the first screen that
lets a person spend AI credits, so the refusals - allowance, busy, a daily
cap - land here too. The draft's review and apply are 18b4.

## In scope

- **The app's runner uses OpenRouter alone** - not 18b2's fallback chain
  (owner, 2026-10-07). `fake` replaces it in the browser tests.
- **`/start` - step 1, What do you want to create?** Four large radio cards
  (Website, Blog, Business, Portfolio), Continue, and Start blank instead in
  the top bar. A plain GET form to step 2, so Back works and it needs no
  JavaScript.
- **`/start/about?kind=<kind>` - step 2, Tell us about it.** One textarea
  (10-2,000 characters after trimming), Build my site, Back. The action
  starts a run and redirects to `/start/:runId`; a refusal is a banner with
  the description kept.
- **`/start/:runId` - the wait.** Running: what is happening, an
  indeterminate `<progress>`, the seconds so far, polled every 2 seconds.
  Failed: what happened and what to do - Try again, Change the description,
  Start blank instead. Succeeded: a placeholder listing the draft's page
  titles, replaced by 18b4's review.
- **Offered only while it makes sense:** AI on, the person is the site's
  admin, the site is not suspended, and nothing is published. Otherwise
  `/start*` redirects to `/admin` (a non-admin gets Not Found, `requireRole`).
- **A run in progress takes over:** while the site has a running run,
  `/start` and `/start/about` redirect to its page.
- **Refusals:** the monthly allowance (with the date it renews), busy
  (two runs in the process), and a **daily cap of 10 runs per site** (plan
  *Auth boundary*, "AI runs - per site, per day", in-memory like every other
  limit).
- **Confirming signup's emailed link lands on `/start`** when it is offered
  (it falls through to `/admin` otherwise).
- **A no-network fake provider for the browser tests:** `AI_PROVIDERS=fake`,
  accepted only alone and only when `PLATFORM_URL` is loopback or `*.localhost`
  (Decisions). The primary Playwright server runs with it; CI still calls no
  provider.
- `design.md` gains the wait screen and step 2, which the mockups left open.

## Out of scope

- Reviewing and applying the proposal, Home and "Your website is ready", the
  AI meter - **18b4**. Here a succeeded run shows a placeholder.
- Step 3, Make it yours, and the run starting on step 2 while step 3 shows -
  **18b5**. The steps read "of 2" until then.
- A way back to `/start` from the admin for someone who left it - 18b4's
  Home offers it while nothing is published.
- Returning to a succeeded run that was never applied: `/start` starts a new
  one. 18b4 decides what an unapplied draft does to `/start`.
- Real progress from the provider (streaming): one provider call has none to
  report, and the plan rejects streaming to the page (D154).
- **The fallback chain in the app** - Anthropic and OpenAI direct after
  OpenRouter (18b2's `createAiAdapter`). Wired into the runner later, once
  the live direct-provider checks owed by 18b2 are done (`needs-you.md`);
  `ai:try` and `ai:measure` keep using them meanwhile.

## Design reference

- Step 1: `prototypes/start.html` - `.flow`, the step bars, `.choice-card`
  radios, the top bar's Start blank instead. Port the onboarding block of
  `prototypes/components.css` (`.flow`, `.steps`, `.choice-card*`) into an
  `app/features/onboarding/*.module.css`, using the tokens already in
  `app/app.css` - no new tokens.
- Step 2 and the wait were not mocked (`design.md` *Screens*: "mock it in that
  item's spec"). They use the same `.flow` page, step bars and kit form:
  - **Step 2:** "Step 2 of 2"; `h1` Tell us about it; lede "A sentence or two
    is enough: what it's called, what you do and who it's for."; a labelled
    textarea, "About your <kind>", hint "10 to 2,000 characters." under it;
    primary **Build my site** (busy: "Starting…", `aria-busy`); a ghost
    **Back** link to `/start?kind=<kind>`, which pre-checks the card.
  - **The wait, running:** `h1` Building your site; a `role="status"` line
    "Writing your pages, menu and search descriptions. This usually takes
    about a minute."; a native `<progress>` with no value (indeterminate),
    labelled "Building your site"; a muted "<n> seconds so far" outside the
    live region; after 120 seconds the status line becomes "This is taking
    longer than usual. It stops by itself after five minutes." No spinner of
    its own, no fake percentages. A `<noscript>` "Check progress" link
    reloads the page.
  - **Failed** (same `role="status"` line, so the change is announced; `h1`
    Couldn't build your site): unavailable, broken, invalid or timeout -
    "Something went wrong on our side. Try again, or start blank." with
    primary **Try again** (a POST that starts a new run with the same kind and
    description) and a secondary **Change the description**
    (`/start/about?kind=…&from=<runId>`, prefilled). Refused - "The AI
    wouldn't write a site from that description. Change it and try again, or
    start blank." with only **Change the description** as primary.
  - **Succeeded (placeholder for 18b4):** `h1` Your draft is ready; a `ul` of
    the draft's page titles.
  - **Refusal banners** (step 2 and Try again, `role="alert"`, the input
    kept): allowance - "Your site has used this month's AI allowance. It
    renews on 1 November. You can start blank instead."; busy - "Habre is busy
    building other sites. Try again in a minute."; daily - "You've started 10
    drafts today. Try again tomorrow, or start blank."
- Every step: 44px controls, one primary button, no horizontal scroll at
  390px, light and dark following the device.

## Build steps

- [x] **Step 1 - the fake provider** - `AI_PROVIDERS` accepts `fake`
  (`app/lib/ai-env.server.ts`; `ProviderSettings` gains `{ name: "fake" }`):
  it needs no key, model or price, must be the only name listed, and
  `env.server.ts` refuses it at startup unless `PLATFORM_URL`'s host is
  `localhost`, a `*.localhost` name (development's `app.localhost`),
  `127.0.0.1` or `[::1]`. `createProviderAdapter` maps it to
  `createFakeAdapter` explicitly (no fall-through to OpenAI), which gains a
  1-second delay (honouring the abort signal) and markers read from the
  description: `[fake:refused]`, `[fake:unavailable]`, `[fake:invalid]`
  (answers `{}`). `.env.example` names it under AI as test-only.
  *Done when:* `node --test app/lib/ai-env.server.test.ts
  app/features/ai/*.test.ts` passes with new cases - `fake` alone turns AI on
  with `http://127.0.0.1:3100` and `http://app.localhost:3000`;
  `fake,openrouter`, and `fake` with `PLATFORM_URL=https://app.habre.ai`,
  each stop startup naming `AI_PROVIDERS`; each marker gives its outcome
  through `createRunner` - and each new case was seen failing first.
- [x] **Step 2 - the app's runner, OpenRouter alone** - `providers.server.ts`
  gains `pickRunAdapter(settings): AiAdapter | null` - the fake when
  `AI_PROVIDERS` is `fake`, else `createOpenRouterAdapter` for the
  `openrouter` entry, else `null`; never the chain. New
  `app/features/ai/runner.server.ts`: the process's one runner (`runStore`,
  `pickRunAdapter(env.AI)`, `env.AI.creditsPerMonth`), `null` when AI is off
  or there is no adapter, so onboarding is then not offered; when
  `AI_PROVIDERS` also lists `anthropic` or `openai`, it logs once at startup
  that the app runs OpenRouter alone (`ai_fallbacks_unused`).
  `runs.server.ts`: `findRun` also returns `description`;
  `findRunningRun(siteId)` (the six-minute window `hasRunningRun` uses).
  *Done when:* `node --test app/features/ai/providers.server.test.ts` (new)
  passes, seen failing first: `fake` gives the fake; `openrouter` and
  `openrouter,anthropic,openai` each give an adapter whose answer reports
  provider `openrouter` (its HTTP call stubbed, as 18b1's adapter tests do),
  never a fallback; `anthropic` alone gives `null`. `npm run verify` green.
- [x] **Step 3 - the gate, the refusals and the daily cap** -
  `entries.server.ts`: `hasPublishedEntries(siteId)`, any page or post. A
  pure `app/features/onboarding/start-gate.ts` (offered, or `/admin` when AI
  is off, the site is suspended or anything is published) and
  `start-refusals.ts` (the banner wording; the renewal date as "1 November",
  the 1st of next month in UTC). `start-run.server.ts` wraps `runner.start`
  with the daily cap (10 runs per site in a 24-hour window from the first,
  `createRateLimiter`, counted only when a run starts) and logs each refusal
  (`ai_run_refused`, reason, siteId - never the description).
  *Done when:* `npm test` passes with unit tests for the gate (each of the
  three conditions, and all clear), the wording (a refusal at 31 October
  23:59 UTC says 1 November; on 31 December, 1 January) and the cap (the 11th
  start in the window is refused; a refused start does not count; the window
  ending lets the site start again), each seen failing first.
- [x] **Step 4 - `/start`, step 1** - `isPlatformPath` gains `/start` and
  `/start/*`; `safeRedirect` also follows `/start` paths, so signing in
  returns there (journey 6); `app/routes.ts` gains `/start` under
  `features/onboarding/start-layout.tsx` (Steps 5 and 6 add their routes, so
  each step typechecks): `requireUser`, `requireRole(["admin"])`, a loader
  running the gate, the `.flow` top bar with Habre's logo and Start blank
  instead -> `/admin`. `start.tsx` from the mockup; its loader sends a site
  with a running run to that run's page. The onboarding CSS. Playwright: the
  primary server gains `AI_PROVIDERS=fake AI_CREDITS_PER_MONTH=1000` and the
  host-split server `OPENROUTER_API_KEY=` - each pinned on the command line,
  because `npm start` loads `.env`, whose real key would otherwise turn AI on
  locally and not in CI (a variable already set is not overridden). *Done
  when:* `node --test app/features/auth/safe-redirect.test.ts` covers
  `/start` and `/start/about?kind=blog` followed and `/startx` refused, seen
  failing first; `e2e/onboarding.spec.ts` shows a new admin of an empty site
  step 1 - one `h1`, four radios in a group named "Kind of website",
  Continue reaching `/start/about?kind=business` by keyboard alone (Tab,
  arrows, Space, Enter); `/start?kind=blog` pre-checks Blog; signed out,
  `/start` -> sign in -> back on `/start`; an author of the same site gets
  Not Found; a site with one published page, and a suspended site, go to
  `/admin`; on the host-split server `/start` goes to `/admin`; no
  horizontal scroll at 390px; `e2e/content-security-policy.spec.ts`'s
  admin-policy check covers `/start`.
- [x] **Step 5 - `/start/about`, step 2, and starting the run** -
  `start-about.tsx`: loader (a missing or unknown `kind` -> `/start`; a
  running run -> its page; `from=<runId>` of this site prefills the
  description); action (Zod: kind, description trimmed 10-2,000; then
  `start-run.server.ts`; success -> `/start/:runId`; refusal -> 400 with the
  banner and the description kept). *Done when:* in
  `e2e/onboarding.spec.ts`, a 9-character description shows the field error
  with `aria-invalid` and the text kept, and adds no `ai_runs` row; a valid
  one lands on `/start/<uuid>` and its row holds the kind and description; a
  site whose runs this month already hold 1,000 credits (a finished row
  seeded as the owner) gets the allowance banner naming the 1st of next
  month and no new row; a site with a seeded `running` row is sent from
  `/start` and `/start/about` to that run's page.
- [ ] **Step 6 - `/start/:runId`, the wait** - `start-run.tsx`: loader
  (`findRun` in the member's site; not a uuid or not found -> 404; `applied`
  -> `/admin`; a `running` row older than six minutes - its finish write
  lost, the window `hasRunningRun` uses - is shown as failed `timeout`;
  returns status, error, seconds so far, page titles); revalidates every 2
  seconds while running (`useRevalidator`), stops otherwise. Action
  `intent=retry`: only for a failed run that was not refused, by the same
  rule the loader shows (400 otherwise); restarts with the run's kind and
  description through `start-run.server.ts`. Update `design.md`: *Screens*'
  "The AI drafting your site" row to built, with the wording above, and step
  2 under *Navigation map*. *Done when:* in `e2e/onboarding.spec.ts` - a
  seeded `running` row shows Building your site and a `progress` element;
  updating that row to `succeeded` with a valid proposal (as the owner) shows
  Your draft is ready and the proposal's page titles **within 5 seconds,
  without a reload** (the screen's share of `quality-bar.md`'s 2-minute
  p95); a seeded failed `timeout` row shows Try again, which lands on a new
  run's page; a seeded `refused` row offers Change the description, not Try
  again, its link prefills the description, and a retry POSTed to it
  anyway is refused with no new row; another site's run id and
  `/start/not-a-uuid` are Not Found; an `applied` row goes to `/admin`; a
  `running` row created seven minutes ago shows Couldn't build your site.
- [ ] **Step 7 - from the emailed link to the draft** - `verify.tsx`
  redirects to `/start` (the gate passes it on to `/admin` when not
  offered). Update the signup specs that expect `/admin` after Confirm.
  *Done when:* `e2e/onboarding.spec.ts` walks journey 1 as far as it is
  built, both as full page loads and through the app's own links: sign up
  with an invite -> the email in Mailpit -> Confirm my email -> `/start` ->
  Business -> Continue -> a description -> Build my site -> Building your
  site -> Your draft is ready with the fake's page titles, final URL
  `/start/<uuid>`; then the same with `[fake:unavailable]` ends on Couldn't
  build your site, and Change the description (marker removed) -> Build my
  site ends on Your draft is ready. The full suite, `npm run test:e2e`,
  passes locally.

## Files and areas

- `app/lib/ai-env.server.ts`, `app/lib/env.server.ts`, `.env.example` - `fake`
- `app/features/ai/fake-provider.ts`, `providers.server.ts` (`fake` only;
  the runner does not use `createAiAdapter`),
  `runs.server.ts`, new `runner.server.ts`
- `app/features/content/entries.server.ts` - `hasPublishedEntries`
- new `app/features/onboarding/`: `start-layout.tsx`, `start.tsx`,
  `start-about.tsx`, `start-run.tsx`, `start-gate.ts`, `start-refusals.ts`,
  `start-run.server.ts`, CSS modules, tests
- `app/lib/content-security-policy.ts` (`isPlatformPath`), `app/routes.ts`,
  `app/features/auth/safe-redirect.ts`
- `app/features/signup/verify.tsx`
- `playwright.config.ts` (primary: `AI_PROVIDERS=fake`,
  `AI_CREDITS_PER_MONTH=1000`; host-split: `OPENROUTER_API_KEY=`), new
  `e2e/onboarding.spec.ts`, the signup specs' post-confirm URL
- `blueprint/context/design.md`

## Data and contracts

- **No migration.** `ai_runs` (0020) already holds kind, description, status
  and error.
- **Routes (load-bearing for 18b4-18b5):** `/start` (step 1, `?kind=`
  pre-checks), `/start/about?kind=&from=` (step 2), `/start/:runId` (the
  run; 18b4 puts the review in its succeeded state). 18b5 adds
  `/start/brand` between them.
- **`StoredRun` gains `description`.** `findRunningRun(siteId): Promise<{ id:
  string } | null>`.
- **`start-gate.ts`:** `startGate({ aiOn, suspended, published }) ->
  { kind: "offer" } | { kind: "redirect"; to: "/admin" }`, run by the
  layout for all three routes. The role check stays `requireRole`'s 404; the
  running-run redirect is in the step 1 and step 2 loaders only, so the run
  page never redirects to itself.
- **`pickRunAdapter(settings: AiSettings | null): AiAdapter | null`** - the
  one place that chooses the app's provider; wiring the chain in later
  changes only this.
- **`AI_PROVIDERS` values:** `openrouter`, `anthropic`, `openai`, and `fake`
  (test-only, alone, loopback or `*.localhost` platform only).

## Testing

- **Unit (`npm test`, inside `verify`, runs in CI):** ai-env's `fake`
  rules; the fake's markers through `createRunner`; the gate; the refusal
  wording and dates; the daily cap.
- **Browser (`npm run test:e2e`, locally and in CI's `e2e` job):**
  `e2e/onboarding.spec.ts` on the primary server, which now runs
  `AI_PROVIDERS=fake` - no network, no key, so CI's "never calls a provider"
  holds. Run states are seeded and advanced through the owner connection
  (`DATABASE_OWNER_URL`, as `e2e/ai-runs.spec.ts` does) so no assertion races
  the fake's timer, except the one journey in Step 7. The tests that start a
  run go in one `serial` describe block: the process allows two runs at
  once, and two workers starting runs together could be refused as busy. The AI-off case uses
  the host-split server. None of it uploads to R2, so none is skipped in CI.
- The provider's own time to answer, the rest of the 2-minute bar, is
  `ai:measure`'s (owed, `needs-you.md`).

## Decisions

- **The browser tests drive runs through `AI_PROVIDERS=fake`**, refused at
  startup unless alone and on a loopback or `*.localhost` `PLATFORM_URL`. Beat: seeding rows
  only (step 2's submit and journey 1 would never run in a browser); a fake
  provider's address (D403 pins every client's address in code, on purpose);
  a `NODE_ENV` guard (the browser tests run the production build). Costs: a
  test-only branch in production code, guarded by a check production cannot
  pass.
- **The app runs OpenRouter alone for now** (owner, 2026-10-07): the
  runner takes the `openrouter` adapter, not 18b2's chain, and a list
  without `openrouter` leaves onboarding off. Beat: the chain as 18b2 built
  it, whose direct providers have had no live run yet. Temporary - wiring
  the chain in is a later change, and D155's order is unchanged.
- **Daily cap: 10 runs per site in a 24-hour window from the first, in
  memory** (the existing limiter's fixed window), counted
  only when a run starts. Beat: none (the plan names the limit, not the
  number); at the default 1,000 credits and ~30-40 credits a run, 10 a day
  leaves the monthly allowance as the binding limit.
- **Description: 10-2,000 characters after trimming.** Short enough to bound
  input tokens, long enough for a paragraph about a business.
- **Steps are numbered "of 2" until 18b5 adds step 3.** Beat: "of 3" with a
  step that does not exist yet.
- **Step 2 is `/start/about`, a GET from step 1** with the kind in the query.
  Beat: storing the kind server-side between steps (state with nowhere to
  live yet, and Back would need it).
- **Signup's emailed link lands on `/start`; sign-in still lands on `/admin`.**
  Beat: `/admin` bouncing to `/start` while offered, which would trap someone
  who chose Start blank instead until they publish (no stored "chose blank"
  yet). 18b4's Home is the way back.
- **Signing in may return to `/start`:** `safeRedirect` follows `/start`
  paths as well as `/admin`. Beat: losing the step on sign-in (journey 6).
- **A suspended site is not offered a run.** Beat: letting a site the
  operator took down for abuse keep spending AI credits.
- **The gate runs as the layout's middleware, not a loader** (autopilot, Step 5): loaders do not run for a POST, so step 2's action and the wait's retry would otherwise start runs for a site with published content. Beat: the loader the spec named.
- **The wait polls every 2 seconds with `useRevalidator`.** Beat: a stream or
  SSE (D154), and a meta refresh (a full reload every time, losing focus).

## Production needs

None new. Production still needs `OPENROUTER_API_KEY` (already listed for
18b1); the Anthropic and OpenAI variables are not used by the app until the
chain is wired in. No migration, no new variable: `AI_PROVIDERS` gains the value `fake`,
which production must never set and cannot - startup refuses it unless
`PLATFORM_URL` is loopback or `*.localhost`.

## Behaviour changes

- New capability `onboarding`: with AI on, pressing Confirm my email on signup's link lands the new admin on What do you want to create? - Step 7
- New capability `onboarding`: `/start` and its steps send to the admin when AI is off, the site is suspended or anything is published, and are Not Found to a member who is not an admin - Step 4
- New capability `onboarding`: Tell us about it refuses a description under 10 or over 2,000 characters, keeping the text and starting no run - Step 5
- New capability `onboarding`: Build my site starts a run and opens its page, which shows the draft's page titles once it succeeds, without a reload - Step 6
- New capability `onboarding`: a site out of this month's allowance is refused with the date it renews, and no run starts - Step 5
- New capability `onboarding`: runs started from onboarding go to OpenRouter alone, never to a fallback provider, even when `AI_PROVIDERS` lists one - Step 2
- New capability `onboarding`: an 11th run in 24 hours for one site is refused, and no run starts - Step 3
- New capability `onboarding`: while a site's run is in progress, step 1 and step 2 open that run's page - Step 5
- New capability `onboarding`: a failed run's page offers Try again with the same description, except a refused run, which offers only Change the description - Step 6
- New capability `onboarding`: another site's run is Not Found - Step 6
- New capability `onboarding`: signing in from a signed-out `/start` returns to `/start` - Step 4
- Changes `ai.1` from "with no key for the first provider in `AI_PROVIDERS` (`OPENROUTER_API_KEY` by default) the app starts with AI off" to "with no key for the first provider in `AI_PROVIDERS` (`OPENROUTER_API_KEY` by default) the app starts with AI off; `fake`, which needs no key, turns it on" - Step 1
- Changes `ai.2` from "an unknown or repeated name in `AI_PROVIDERS`, a malformed `AI_CREDITS_PER_MONTH` or price, or a listed provider missing its key, model or price while AI is on, stops the app at startup with a message naming the variable" to "an unknown or repeated name in `AI_PROVIDERS`, `fake` listed with another provider or with a `PLATFORM_URL` that is not loopback or `*.localhost`, a malformed `AI_CREDITS_PER_MONTH` or price, or a listed provider missing its key, model or price while AI is on, stops the app at startup with a message naming the variable" - Step 1

## Notes

- `inSite` + `site_id` in every query (D151); `findRun` already does both.
- AI output stays untrusted: the placeholder renders page titles as text
  through React, never HTML.
- The runner is a module singleton: one per process holds D154's two-run
  limit. Import it only from server files.
- Every POST here is covered by root's `refuseCrossSiteRequests`; nothing new.
- Never log or put in a URL the description itself (`from=` carries the run
  id, not the text).
- Pending, empty, error and success states follow `design.md`'s *Conventions
  carried over*; semantic HTML per `coding-standards.md` (`fieldset`/`legend`
  for the cards, `label` for the textarea, `ul` for the titles).
- React Router 8 docs in `node_modules/react-router/docs/` decide the
  `useRevalidator` and middleware patterns.
- F-251 (flaky CI browser tests): the new spec seeds states instead of
  waiting on timers wherever it can, for that reason.
