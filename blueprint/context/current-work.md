# Feature: The run, with OpenRouter

**From build plan:** item 18b1
**Type:** Feature
**Verified:** not yet
**Reviewed:** not yet

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
  allowance is passed by at most one run, a failed run costs no credits, a run a
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

- [ ] **Step 1 - `ai_runs` and its deletion** - migration
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
- [ ] **Step 2 - AI configuration** - `app/lib/ai-env.server.ts` in
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
- [ ] **Step 3 - the proposal and its expansion** -
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
- [ ] **Step 4 - credits** - `app/features/ai/credits.ts` (pure):
  credits = a cost in US dollars / US$0.001, rounded up; the start of the
  current UTC month; `mayStartRun(usedCredits, allowance)`. *Done when:*
  unit tests show worked examples (US$0.0421 is 43 credits), that any
  non-zero cost is at least 1 credit and a zero cost 0, that a negative or
  non-finite cost is refused, a run starting with 1 credit left is
  allowed, at 0 left refused, and `none` never refuses.
- [ ] **Step 5 - the run's lifecycle** - `app/features/ai/run-generation.ts`
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
- [ ] **Step 6 - the database store, the startup sweep and `ai:try`** -
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
- [ ] **Step 7 - the OpenRouter adapter** - install `openai`, pinned
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
- **`max_tokens` 16000, not streamed** - output is bounded well under
  that; model-specific settings such as reasoning effort wait for 18b2's
  measurement. Beat: streaming, which a background run does not need.

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
- Adds to `ai`: a run that fails - provider unavailable, refused, invalid output or over 5 minutes - records its reason and costs no credits - Step 5
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
