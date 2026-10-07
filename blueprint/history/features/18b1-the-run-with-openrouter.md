# Feature: The run, with OpenRouter

**From build plan:** item 18b1
**Type:** Feature
**Verified:** 2026-10-07, in build - every done-when run as stated (e2e, live ai:try, live OpenRouter); activity-page cost comparison open in needs-you
**Reviewed:** 2026-10-07, 1f1145defef2, current (c59b1aa after passes of c276064..849bf18), every lens (accessibility n/a) - 0 blocking

## Goal

The engine behind "Start from a description", with no screens yet: given a
site, a kind (Website, Blog, Business, Portfolio) and a description, the
server records an `ai_runs` row, asks the configured model through
OpenRouter for a **proposal** - pages made
of ready-made section kinds with plain-text slots, navigation, SEO text and a
suggested brand colour - validates it as untrusted input, prices it in
credits from the cost OpenRouter reports, and stores it on the run (D154,
D155 as amended, D164). 18b2 adds the
fallbacks, 18b3-18b5 the screens and applying a proposal. Building the
engine alone first keeps the riskiest part - untrusted output, money, a
background job - in one reviewable diff, provable with a fake provider.

## In scope

- **`ai_runs`** - the plan's columns plus `cache_write_tokens` and
  `cost_usd`, under
  row-level security; a security-definer function that fails interrupted
  runs across every site; taking the site (15e2) deletes its runs.
- **AI configuration** - the provider order (`AI_PROVIDERS`, only
  `openrouter` until 18b2), the switch (OpenRouter's key set or not), the
  model, and the monthly credit allowance; checked at startup. No price:
  OpenRouter reports each response's cost.
- **The proposal** - its Zod schema (load-bearing: 18b3-18b5 read it), and
  its expansion into v4 page documents with 14c1's templates, every
  document passing `parseDocument`.
- **Credits** - from a run's cost in US dollars as the provider reported
  it, rounded up to whole credits; the site's use this calendar month (UTC),
  summed from its runs; "may this site start a run?".
- **The run's lifecycle** - at most two at once per process (a third is
  refused as busy), a 5-minute limit over the whole run, all-or-nothing
  (a run writes only its own row), one run per site at a time, so the
  allowance is passed by at most one run, a failed run costs the credits of
  whatever cost the provider reported (none if it reported none), a run a
  restart interrupted is marked failed at startup.
- **One provider adapter interface**, a fake adapter for tests and the
  script, and the **OpenRouter adapter** through the `openai` SDK: one chat
  completion with a strict JSON-schema response format, only endpoints that
  honour it and store no data, the fixed instructions cache-marked, the
  reported cost and the served model recorded, errors sorted into
  unavailable, broken, refused and invalid.
- **`npm run ai:try`** - an operator script that runs one generation for a
  site and prints the run: the only way to start a run until 18b3.

## Out of scope

- Anthropic and OpenAI direct, token prices for them, moving on down
  `AI_PROVIDERS`, and the model-measuring script - **18b2**. Here an
  unavailable OpenRouter fails the run.
- `/start`, the wait, offering a run only while nothing is published, the
  allowance refusal's wording on screen - **18b3**.
- Applying a proposal (drafts, navigation, SEO, colour) and Home - **18b4**.
  This item expands sections into documents but writes no entry.
- Make it yours and the run starting during step 3 - **18b5**.
- Starter posts: the proposal holds pages only (Decisions).
- Images of any kind: the AI chooses none (plan *Data rules*).

## Build steps

- [x] **Step 1 - `ai_runs` and its deletion** - migration
  `db/migrations/0020_ai_runs.sql` (written with `migrate`): the table with
  the plan's columns plus `cache_write_tokens` and `cost_usd`
  (`numeric(12,6)`, the provider's reported cost); `site_id` references `sites`
  on delete restrict, `user_id` references `users` on delete set null;
  checks on `kind` and `status`, `credits >= 0`, and `credits = 0` unless
  `status` is succeeded or applied; an index on (`site_id`, `created_at`);
  row-level security with the `site_isolation` policy of `0011`; grants to
  the app role; a `security definer` function
  `fail_interrupted_ai_runs()` owned by the owner, executable by the app
  role, that sets every `running` row to `failed` with error
  `interrupted` and returns the count. `deleteAccount`'s take-the-site
  branch deletes the site's runs before the site; leaving keeps them, the
  author nulled. *Done when:* `npm run db:migrate` applies it to the dev
  database; `e2e/site-isolation.spec.ts` with `ai_runs` added to its
  tables passes; a case added to `e2e/account-delete.spec.ts` takes a site
  that has a run and finds no `ai_runs` row left; the checks refuse a
  failed run with credits and an unknown kind, as the owner.
- [x] **Step 2 - AI configuration** - `app/lib/ai-env.server.ts` in
  `limits-env.server.ts`'s shape, spread into `env.server.ts`, documented
  in `.env.example`: `AI_PROVIDERS` (a comma-separated order; default
  `openrouter`, the only name accepted until 18b2), `OPENROUTER_API_KEY`
  (blank or unset: AI off), `OPENROUTER_MODEL` (default
  `anthropic/claude-opus-5.5`, confirmed in Step 7),
  `AI_CREDITS_PER_MONTH` (a whole number from 1, or `none`; default 1000,
  provisional - `needs-you.md`). `env.AI` is `null` when off, else the
  parsed settings. *Done when:* unit tests show the defaults, AI off
  without a key, and an unknown provider name, a repeated one or a
  malformed allowance refused with a message naming the variable and not
  its value; `npm start` with `AI_PROVIDERS=anthropic` exits naming it.
- [x] **Step 3 - the proposal and its expansion** -
  `app/features/ai/proposal.ts` (schema, bounds, types) and
  `expand-proposal.ts` (pure): a proposal expands to one v4 document per
  page through `sectionTemplate`, with the slots filled, the first page's
  first hero heading the page's main heading, and each button's target - a
  page of the same proposal, or none - resolved through a slug map the
  caller passes (18b4 gives it the real slugs). *Done when:* unit tests
  show every section kind expanding to a document `parseDocument` accepts;
  a proposal over each bound, with an unknown kind, a button pointing at a
  page that is not in it, a colour not exactly `#rrggbb`, or a control or
  NUL character in a slot is refused; a valid proposal of the largest
  allowed size expands within `MAX_SECTIONS` and `MAX_DOCUMENT_BLOCKS`.
- [x] **Step 4 - credits** - `app/features/ai/credits.ts` (pure):
  credits = a cost in US dollars / US$0.001, rounded up; the start of the
  current UTC month; `mayStartRun(usedCredits, allowance)`. *Done when:*
  unit tests show worked examples (US$0.0421 is 43 credits), that any
  non-zero cost is at least 1 credit and a zero cost 0, that a negative or
  non-finite cost is refused, a run starting with 1 credit left is
  allowed, at 0 left refused, and `none` never refuses.
- [x] **Step 5 - the run's lifecycle** - `app/features/ai/run-generation.ts`
  with the adapter interface and `fake-provider.ts`: takes a store and an
  adapter (no database import), checks the allowance, refuses a site that
  already has a run running, claims one of two slots, records the run as running, returns its id without waiting, and
  in the background calls the adapter under an `AbortSignal` that fires at
  5 minutes, validates the output with the proposal schema and finishes
  the run once - succeeded with tokens, model, provider and credits, or
  failed with an error code, zero credits and whatever tokens and cost
  were reported. The slot is released on every path. *Done when:* unit tests
  with an in-memory store and the fake adapter show: a third run while two
  are running is refused as busy and records nothing; a run past 5 minutes
  (mocked timers) fails as `timeout`; a second run for a site whose first
  is still running is refused as busy; output failing the schema fails as
  `invalid` with zero credits; each adapter error kind fails with its own
  code; a site at its allowance is refused before any row; a success
  stores the proposal and its credits.
- [x] **Step 6 - the database store, the startup sweep and `ai:try`** -
  `app/features/ai/runs.server.ts`: the store over `inSite`, every query
  naming `site_id`; the month's credits summed for a site; the sweep
  calling `fail_interrupted_ai_runs()` once when `server/app.ts` loads,
  logging how many it failed. `scripts/ai-try.ts` and
  `npm run ai:try -- --address <site> --kind <kind> --description "<text>"
  [--fake]`: runs one generation as the site's first active admin, waits,
  prints status, duration, tokens, credits and the page titles, exit 1 on a
  failed run. *Done when:* `npm run ai:try -- --address surenmaharjan
  --kind business --description "..." --fake` against the dev database
  prints a succeeded run with credits, and the row is there; a row set to
  `running` by hand is `failed`/`interrupted` after `npm start` starts;
  with `AI_CREDITS_PER_MONTH=1` the second fake run is refused.
- [x] **Step 7 - the OpenRouter adapter** - install `openai`, pinned
  exactly; `app/features/ai/openrouter.server.ts` and the fixed
  instructions in `instructions.ts`: `chat.completions.create` at
  `https://openrouter.ai/api/v1` with the configured model; the
  instructions as the system message, its text part cache-marked
  (`cache_control`, honoured for Anthropic models, ignored by others); the
  kind and description as the user message (the description fenced and
  labelled as the customer's words); `response_format` `json_schema`,
  `strict: true`, the proposal's shape; `provider: { require_parameters:
  true, data_collection: "deny" }`, OpenRouter's own upstream failover
  left on; `max_tokens` 16000, `maxRetries` 2, the run's signal; the
  `X-Title` header `Habre`. Records `usage.cost` as the run's cost, the
  token counts it reports (cache read from `prompt_tokens_details`, cache
  write when reported, else 0) and the served model (`response.model`).
  Error sorting: 429, 402 (OpenRouter out of credits, logged at error
  level), 5xx, connection and timeout -> `unavailable`; 400, 401, 403 ->
  `broken`, logged with the status; a `refusal` on the message or
  `finish_reason` `content_filter` -> `refused`; `finish_reason` `length`,
  unparseable JSON, or no `usage.cost` -> `invalid`. *Done when:* unit
  tests sort constructed `openai` SDK errors and refusal, filter, length
  and cost-less responses into the right codes; with the owner's key
  (locally, not CI) the default model id is confirmed on OpenRouter's
  models list as supporting structured outputs - or the default changed to
  one that does, and recorded here - and `npm run ai:try` gives a
  succeeded run for each of the four kinds, each under 120 seconds, its
  proposal expanding cleanly, its tokens, cost and credits recorded and the
  credits matching OpenRouter's activity page for that request.
- [x] **Step 8 - failed runs are charged (owner, 2026-10-07; F-330)** - a
  failed run that reported a cost is charged its credits, so the monthly
  allowance bounds what the provider bills for every run that reports a
  cost (Step 10 makes a timeout unlikely); a run that reported no cost
  (a timeout, an unreachable provider, an unpriceable cost) stays at 0.
  `0020_ai_runs.sql`'s credits check becomes `credits >= 0` and `credits =
  0` while `running` - amended in place, since 0020 has reached no
  environment but development, and the dev database's constraint replaced
  by hand to match (if the migration runner records checksums, a new
  `0021` instead). The runner's failed outcome carries
  `creditsFromCostUsd(costUsd)` when a cost was reported. *Done when:* unit
  tests show an `invalid` run and a `refused` run that reported a cost are
  charged its credits, and an `unavailable` run and a `timeout` with no
  cost are charged 0; the owner-side constraint test refuses a `running`
  row with credits and accepts a `failed` one; the dev database's
  constraint matches the migration.
- [x] **Step 9 - repair F-329: a run whose finish write fails blocks its site
  until a restart** - `hasRunningRun` ignores a `running` row older than
  the 5-minute limit plus a minute (`created_at > now() - interval '6
  minutes'`), so a lost finish blocks the site for at most six minutes;
  `ai:try` exits 1 unless the run it reads back succeeded. *Done when:* a
  browser-suite test (database, no browser) shows a site with a
  ten-minute-old `running` row may start a run and one with a fresh
  `running` row may not, failing with the age condition removed; `ai:try`
  exits 1 on a row left `running`.
- [x] **Step 10 - `max_tokens` 8000 (owner, 2026-10-07; F-337)** -
  `openrouter.server.ts`'s `MAX_TOKENS` 16000 becomes 8000, so the worst
  case ends in about two to three minutes, well inside the 5-minute limit,
  and an over-long answer fails as `invalid` with its cost charged rather
  than timing out uncharged. *Done when:* the constant is 8000; `npm run
  ai:try -- --address surenmaharjan --kind business --description "..."`
  gives a succeeded run with OpenRouter.

## Files and areas

- `db/migrations/0020_ai_runs.sql` - new
- `app/features/account/account.server.ts` - `deleteAccount` deletes runs
- `app/lib/ai-env.server.ts` (+ test), `app/lib/env.server.ts`,
  `.env.example`
- `app/features/ai/` - new: `proposal.ts`, `expand-proposal.ts`,
  `credits.ts`, `run-generation.ts`, `fake-provider.ts`,
  `runs.server.ts`, `instructions.ts`, `openrouter.server.ts`, tests beside
- `server/app.ts` - the startup sweep
- `scripts/ai-try.ts`, `package.json` (script, dependency)
- `e2e/site-isolation.spec.ts`, `e2e/account-delete.spec.ts`

## Data and contracts

**`ai_runs`** (load-bearing for 18b2-18b5): `id` uuid, `site_id`,
`user_id` (null after the member's account is deleted), `kind` (website |
blog | business | portfolio), `description` text, `status` (running |
succeeded | failed | applied), `result` jsonb (the validated proposal, null
unless succeeded or applied), `error` text (null, or one of `unavailable`,
`broken`, `refused`, `invalid`, `timeout`, `interrupted`), `provider`,
`model` (the model that served it, as reported), `input_tokens`,
`cached_input_tokens`, `cache_write_tokens`, `output_tokens`, `cost_usd`
(the provider's reported cost, or for 18b2's direct providers the cost
worked out from tokens), `credits` integer, `created_at`, `finished_at`.

**The proposal** (load-bearing; field names final here):

    {
      siteDescription: string           // 1-300, the site's SEO description
      brandColor: "#rrggbb" | null      // lowercase; null = no suggestion
      pages: [                          // 1-6; the first is the home page
        {
          key: string                   // "p1".."p6", unique, for references
          title: string                 // 1-80, also its menu label
          seoTitle: string              // 1-70
          seoDescription: string        // 1-300
          sections: [                   // 1-8
            { kind: "hero", heading, body, buttonLabel?, buttonTarget? }
            { kind: "image-text", heading, body }
            { kind: "cta", heading, body, buttonLabel, buttonTarget? }
            { kind: "text", heading, paragraphs: string[1..3] }
          ]
        }
      ]
      navigation: string[]              // page keys, 1-6, no repeats
    }

Headings 1-120, bodies and paragraphs 1-1200, button labels 1-40;
`buttonTarget` is a page key; a button without one links to the home page.
Text is plain - no markup, no URLs as links. `text` expands to the blank
template with a level-2 heading and its paragraphs. Image slots stay empty.
The schema sent to the provider is the shape only; the bounds are enforced
by our Zod parse afterwards, because structured output does not guarantee
every constraint.

**Adapter interface:** `generate({ kind, description }, signal)` resolves
`{ output: unknown, usage: { input, cacheRead, cacheWrite, output },
costUsd, provider, model }` or rejects with an `AiError` whose `code` is `unavailable`,
`broken`, `refused` or `invalid`, carrying any usage and cost reported. 18b2's direct adapters work out
`costUsd` from tokens and their configured price, so the run code never
knows which kind of provider ran.

## Testing

- Unit (`npm test`, in `verify`, in CI): steps 2-5 and the error sorting
  of step 7 - pure code, fake store, fake adapter, no network, no database.
- Browser (`npm run test:e2e`, local and CI's `e2e` job, with the
  database): step 1's isolation and deletion cases.
- Manual, local only: step 6's `ai:try --fake` against the dev database,
  and step 7's real runs, which need the owner's OpenRouter key in `.env`.
  CI never calls a provider.

## Decisions

- **The proposal holds pages only, no posts.** A Blog kind gets a home page
  pointing at the post list; starter posts would be content the person
  must delete. Beat: one or two starter posts.
- **Buttons link only to the proposal's own pages**, resolved to slugs we
  make; the AI never writes a URL. Beat: AI-written links through the
  allowlist - safe, but a link the person did not choose.
- **OpenRouter first, by default, in a configured order** - amends D155
  (owner, 2026-10-07): any model it serves is a setting, and credits come
  from the cost it reports rather than a price we keep up to date.
  Anthropic and OpenAI direct become optional fallbacks in 18b2. Costs:
  Anthropic's server-side refusal fallback is lost (a refusal fails the
  run, which D155's refusal rule already allows); OpenRouter is one more
  company in the description's path (`data_collection: "deny"`); its fee on
  buying credits. Beat: Anthropic first with a configured price per model.
- **A response with no reported cost fails the run as `invalid`**, logged:
  an unpriced run would be free. Beat: charging an estimate.
- **OpenRouter out of credits (402) counts as unavailable**, logged at
  error level, so 18b2's chain moves on rather than every run failing.
  Beat: treating it as broken.
- **The default allowance is 1,000 credits a month (US$1 of provider
  cost)**, provisional until 18b2 measures a run (D150 starts from "3
  generations"). Beat: no default.
- **Interrupted runs are swept by a security-definer function**, because
  the app role sees no `ai_runs` row without a site set. Beat: taking
  `ai_runs` out of row-level security.
- **`ai_runs.site_id` restricts deletion**, as every site-owned table does,
  and taking the site deletes runs explicitly. Beat: `on delete cascade`.
- **`max_tokens` 8000, not streamed** (16000 until Step 10, F-337) - the
  four live runs used 1,061-1,673 output tokens, and 8000 ends the worst
  case well inside the 5-minute limit, so an over-long answer is charged
  as `invalid` instead of timing out uncharged; a proposal near every
  upper bound would be cut off; model-specific settings such as reasoning effort wait for 18b2's
  measurement. Beat: streaming, which a background run does not need.

- **Every page's first hero heading is its main heading**, not only the
  first page's (build, Step 3): `parseDocument` refuses two level-1
  headings, and a page without a hero falls back to its title as the main
  heading (`render.tsx`). Beat: an h1 only on the home page.
- **A slot refuses every control character, newline and tab included**
  (Step 3), as well as lone surrogates and whitespace-only text; Step 7's
  instructions must tell the model so. Beat: allowing newlines in bodies.
- **Unknown extra fields in a proposal are stripped, not refused** (Step 3,
  Zod's default). Beat: `strict()`, which would fail runs over a harmless
  extra key.
- **Credits are worked out in whole micro-dollars**, then rounded up to
  credits (Step 4), so US$0.003 is 3 credits, not 4; reaching the allowance
  exactly refuses the next run. Beat: dividing floats.
- **Every AI variable is validated even when AI is off** (Step 2), so a
  malformed `AI_PROVIDERS` stops startup without a key; `none` is `null`, as
  `STORAGE_LIMIT_MB` does. Beat: ignoring them while off.

- **The two slots and one-run-per-site are claimed synchronously** in the
  runner before its first await (Step 5), with the store's running-row check
  as a second guard; order: busy, allowance, running row, insert. A store
  error, a non-`AiError` throw or an unpriceable cost fail the run (`broken`,
  `broken`, `invalid`). Beat: relying on the database check alone.
- **`start` returns `done`, a promise that never rejects** (Step 5), so
  `ai:try` and tests can wait for the run. Beat: polling the row.

- **The startup sweep is not awaited and never stops startup** (Step 6): a
  database failure is logged (`ai_runs_sweep_failed`), as `/healthz`
  reports one. Beat: refusing to start.
- **`ai:try` parses only the AI variables**, not the web app's whole
  environment, so `--fake` works with AI off. Beat: importing
  `env.server.ts`.

- **Any HTTP status the spec does not name is `broken`** except 429, 402
  and 5xx (Step 7) - a 404 or 422 is a request we got wrong; the run's own
  abort sorts as `unavailable`, which the runner turns into `timeout`.
  Beat: unknown statuses as `unavailable`.
- **The provider schema is a hand-written, shape-only mirror of the
  proposal** (`provider-schema.ts`, Step 7), sections as `z.union` so it
  emits `anyOf` (strict mode has no `oneOf`); a test checks a valid proposal
  passes both. Beat: deriving it from `proposalSchema` and stripping bounds.

- **Step 7's live check (2026-10-07):** `anthropic/claude-opus-5.5` is on
  OpenRouter's models list with `structured_outputs` and `response_format`
  (US$4 / US$20 per million input / output tokens), so the default stands.
  OpenRouter returned `usage.cost` and
  `prompt_tokens_details.cache_write_tokens` without asking; the schema was
  accepted in strict mode. Four runs, one per kind: 15-25 s each, US$0.022-
  0.041 (22-42 credits), every page expanding to a document `parseDocument`
  accepts; the instructions (1,821 tokens) were cached from the second run.
  Comparing those costs with OpenRouter's activity page is the owner's
  (`needs-you.md`).

- **A failed run is charged the cost the provider reported** (owner,
  2026-10-07, F-330) - replaces "a failed run costs no credits": otherwise
  a description written to break the bounds is billed by OpenRouter and
  costs the site nothing, so the allowance would not bound spend. Beat: a
  separate cap on summed `cost_usd`, or a daily cap on failed runs.

## Production needs

- Migration `0020_ai_runs.sql`.
- `OPENROUTER_API_KEY` (a production key with a credit limit on
  OpenRouter), optionally `AI_PROVIDERS`, `OPENROUTER_MODEL`,
  `AI_CREDITS_PER_MONTH`, in `/etc/habre-cms/production.env`.
- `openai` in the release's `node_modules`.

## Behaviour changes

- New capability `ai`: with no `OPENROUTER_API_KEY` the app starts with AI off - Step 2
- Adds to `ai`: an unknown or repeated name in `AI_PROVIDERS`, or a malformed `AI_CREDITS_PER_MONTH`, stops the app at startup with a message naming the variable - Step 2
- Adds to `ai`: every page of a valid proposal expands to a document the editor's save accepts, its buttons linking only to the proposal's own pages - Step 3
- Adds to `ai`: a third run while two are running is refused as busy and records nothing - Step 5
- Adds to `ai`: a site with no credits left this month cannot start a run - Step 6
- Adds to `ai`: a site runs one generation at a time; a second while its first is running is refused as busy - Step 5
- Adds to `ai`: a run that fails - provider unavailable, refused, invalid output or over 5 minutes - records its reason and is charged only the cost the provider reported - Step 8
- Adds to `ai`: a run left `running` for over six minutes no longer stops its site starting another - Step 9
- Adds to `ai`: a succeeded run records its proposal, tokens, provider, the model that served it, the reported cost and the credits worked out from it - Step 7
- Adds to `ai`: a run left running by a restart is marked failed when the server starts - Step 6
- Adds to `accounts`: taking the site also deletes its AI runs - Step 1

## Notes

- The provider schema comes from `z.toJSONSchema` of the proposal's
  shape. **Strict JSON schema needs every property required and
  `additionalProperties: false`**, so optional slots (`buttonLabel`,
  `buttonTarget`) are nullable in the provider schema; our Zod parse then
  applies the bounds. Check OpenRouter accepts the generated schema.
- The `openai` SDK's types do not know OpenRouter's `provider` field or
  `usage.cost`: pass the field as an extra body parameter and read the
  usage through a small Zod parse, never an `as` cast.
- OpenRouter's `usage.cost` is in its credits, which are US dollars; Step 7
  confirms that against the activity page.
- Reasoning models count their reasoning tokens as output and against
  `max_tokens`.
- A short system prompt may fall under a model's minimum cacheable
  prefix; caching is then a no-op, not an error.
- The description is personal data sent to OpenRouter and the upstream
  that serves the model (`quality-bar.md`);
  never log it. Log run id, site id, outcome, duration, model, tokens.
- AI output is untrusted: the proposal's Zod parse and then
  `parseDocument` are the two gates, as for an editor's save.
- D151's two guards on every `ai_runs` query: `inSite` and `site_id` in the
  query.
- `node --test` cannot run `.tsx`; everything testable here is `.ts`.

## Findings

### 18b1-the-run-with-openrouter/F-329 [P2] closed - A run whose finish write fails stays `running` and blocks its site until a restart
File: app/features/ai/run-generation.ts:169-185; app/features/ai/runs.server.ts:20-27; scripts/ai-try.ts:103

**Found:** 2026-10-07 by review (scope: current; lens: every lens; via reviewer)
**Why it matters:** `execute` frees the slot but the row keeps `status = 'running'`; `hasRunningRun` counts any running row, so every later start for the site is refused as busy until the next startup sweep. Killing `ai:try` mid-run does the same. The finish log line reports the unsaved outcome, and `ai:try` exits 0 on a row still `running`.
**Suggested fix:** Ignore running rows older than the 5-minute limit in `hasRunningRun` (`created_at > now() - interval '6 minutes'`); make `ai:try` exit 1 unless the run succeeded; optionally retry a minimal `failed` update once. Test that the site can start again.
**Resolution:** Step 9 (build, 2026-10-07): `hasRunningRun` ignores a `running` row older than six minutes; `ai:try` exits 1 unless the run succeeded. Test `e2e/ai-runs.spec.ts` runs the real store as the app role: with the age condition removed the ten-minute-old-row case failed (`Expected: false, Received: true`), restored `2 passed`. Closed by build. Re-examined by review (5855b1d..HEAD, 2026-10-07): the blocking is repaired - six-minute window holds (run life ~5 min plus database latency), `ai:try` exits 1 on a row left `running`. The unsaved-outcome log line was not repaired; split out as F-340. Closure stands for the blocking defect.

### 18b1-the-run-with-openrouter/F-330 [P2] closed - The monthly allowance does not bound provider spend: failed runs cost no credits
File: app/features/ai/run-generation.ts:102-108; app/features/ai/runs.server.ts:11-13; app/features/ai/openrouter-response.ts:79-88

**Found:** 2026-10-07 by review (scope: current; lens: every lens; via reviewer)
**Why it matters:** An `invalid` or `refused` run records `cost_usd` but 0 credits, and the allowance sums credits only, so a description engineered to break the bounds is billed by OpenRouter (up to ~US$0.32 a run) at no cost to the site, one run after another. Follows from the spec's "a failed run costs no credits"; exposed once 18b3 lets users start runs. Needs the owner's decision.
**Suggested fix:** Pick one and record it in the spec: charge credits for failed runs that reported a cost; a monthly per-site cap on summed `cost_usd`; or a per-site daily cap on failed runs. Until then the OpenRouter key's credit limit is the only backstop.
**Resolution:** Owner's decision (2026-10-07): a failed run is charged the cost its provider reported (spec Decisions, Step 8). `0020`'s check allows credits on any finished run; the runner charges `creditsFromCostUsd` on a failed run with a cost. `node --test app/features/ai/run-generation.test.ts` was red before (`pass 14, fail 5`) and green after; the owner-side constraint test was red against the old dev constraint, green after. Closed by build. Re-examined by review (5855b1d..HEAD, 2026-10-07): `invalid` and `refused` runs with a reported cost are charged, credits always agree with `cost_usd`. Timeouts and cost-less responses still cost 0; tracked as F-337.

### 18b1-the-run-with-openrouter/F-337 [P2] closed - A timed-out run may still be billed by OpenRouter but costs 0 credits
File: app/features/ai/run-generation.ts:158 (`failed("timeout")`); spec Step 8 and its Decision

**Found:** 2026-10-07 by review (scope: 5855b1d..HEAD; lens: every lens; via reviewer)
**Why it matters:** A non-streamed request aborted at 5 minutes is likely still generated and billed upstream, yet no `usage.cost` returns, so a description pushing maximum-length output (16,000 tokens, ~320 s on a slow model) could time out repeatedly at no cost to the site; a cost-less or oddly shaped response and an `interrupted` run leak the same way. Step 8's "the allowance bounds what the provider bills" holds only for failures that report a cost. Billing after abort not checked against OpenRouter.
**Suggested fix:** Owner's decision, recorded in the spec: charge a timeout a fixed or estimated number of credits; cap timeouts per site per day; lower `max_tokens` so the worst case ends well inside 5 minutes; or stream. At least correct Step 8's wording.
**Resolution:** Step 10 (build, 2026-10-07, owner's choice): `MAX_TOKENS` 16000 -> 8000 in `openrouter.server.ts`, so the worst case ends well inside the 5-minute limit and an over-long answer fails as `invalid` with its cost charged. Live `ai:try` (business) succeeded: 24 s, 1,741 output tokens, 45 credits. No test can show the timeout path against OpenRouter; left `fixed` for review. Cost-less responses and `interrupted` runs still charge 0, as recorded. Re-examined by review (c59b1aa, 2026-10-07): closed for maximum-length output on the default model, which now ends in ~110 s on one attempt; an over-long answer is sorted `invalid` (`openrouter-response.ts:85-87`) and charged (`run-generation.ts:113-118`). The residual - retries, failover, a slow configured model, cost-less and interrupted runs - is split out as F-341.
