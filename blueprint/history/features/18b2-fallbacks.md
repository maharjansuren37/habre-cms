# Feature: Fallbacks

**From build plan:** item 18b2
**Type:** Feature
**Verified:** 2026-10-07, 8a0aebc967fa, 9 of 9 proven against the amended spec (the 4 live direct-provider checks moved to needs-you, owner 2026-10-07). Proven: `npm run verify` (865/865 tests, steps 1-5 and the four repairs); `npm start` refuses naming ANTHROPIC_API_KEY; OpenRouter alone succeeded through the chain (38 credits); 401 failed `broken` with no move; unreachable OpenRouter (dead HTTPS proxy, no source edit) logged openrouter -> anthropic with the run id; ai:measure with OpenRouter, 4 of 4 succeeded, 4 of 4 expand cleanly, mean 31.8 credits
**Reviewed:** 2026-10-07, 8a0aebc967fa, current (ec70ea9), every lens (accessibility n/a), via reviewer - 0 blocking (F-343, F-344, F-346-F-349 stay closed; F-350, F-351 P3 open; F-352 P3 unverified)

## Goal

A run keeps working when its first provider is down. Anthropic and OpenAI
direct join OpenRouter as adapters behind the one `AiAdapter` interface. Each
is priced from its reported tokens and a price set in configuration, and
`AI_PROVIDERS` sets the order. A run moves to the next provider only when the
current one is unavailable, and every move is logged. A refusal, a 400 or a
401 never moves on (D155, D372). An operator script measures each configured
model's cost and output, so the owner can pick the models and the Free
allowance from real numbers (D150, D164).

## In scope

- **Configuration** - `anthropic` and `openai` become valid names in
  `AI_PROVIDERS`. Each direct provider has three variables: `<P>_API_KEY`,
  `<P>_MODEL` and `<P>_PRICE`. The AI switch follows the first provider
  listed.
- **Pricing** - a pure function that turns reported tokens and a configured
  price into US dollars. The run's credits then come from that cost, the
  same way they come from OpenRouter's reported cost.
- **The OpenAI direct adapter** - the `openai` SDK at OpenAI's own address,
  sharing the chat-completion reading and error sorting with OpenRouter. The
  shared module is renamed from `openrouter-response.ts` and takes a
  provider name and a cost source.
- **The Anthropic direct adapter** - `@anthropic-ai/sdk`, installed and
  pinned exactly. It uses structured output (`output_config.format`), puts a
  cache mark on the instructions, and sorts its own errors.
- **The fallback chain** - one `AiAdapter` that tries the configured
  adapters in order. It moves on only for `unavailable`, gives every
  provider except the last its own time limit, and logs each move.
- **Wiring** - one factory that builds the chain from `AiSettings`.
  `ai:try` uses it, and so will 18b3.
- **`npm run ai:measure`** - runs a fixed set of descriptions against each
  configured provider on its own. It prints cost, tokens, duration and
  whether each proposal expands cleanly, and writes every proposal to a
  gitignored folder so a person can judge the quality.

## Out of scope

- Any screen. `/start`, the wait and the allowance refusal are **18b3**.
- Choosing the models and the Free allowance. That is the owner's decision,
  made from `ai:measure`'s output (`needs-you.md`, *Free plan limits*).
  This item supplies the numbers but does not change the defaults.
- Anthropic's server-side refusal fallback, which is dropped (Decisions).
- Model-specific tuning, such as `effort` or reasoning settings. Each
  provider runs at its default unless measurement shows otherwise, and that
  change would be a follow-up decision.
- A per-day AI rate limit per site (plan *Auth boundary*). It belongs with
  the screens that start runs, **18b3**.

## Build steps

- [x] **Step 1 - configuration for the direct providers** -
  `app/lib/ai-env.server.ts` makes these changes:
  - `KNOWN_PROVIDERS` becomes `openrouter`, `anthropic`, `openai`.
  - New variables, documented in `.env.example`: `ANTHROPIC_API_KEY`,
    `ANTHROPIC_MODEL`, `ANTHROPIC_PRICE`, `OPENAI_API_KEY`, `OPENAI_MODEL`,
    `OPENAI_PRICE`.
  - A price is `input=<n>,output=<n>,cache_read=<n>,cache_write=<n>`, in US
    dollars per million tokens. All four keys are required, each a decimal
    from 0, with no repeats.
  - **AI is on when the first provider in `AI_PROVIDERS` has its key.** With
    the default order that is still `OPENROUTER_API_KEY`.
  - When AI is on, every listed provider needs its key, and a listed direct
    provider also needs its model and price. A missing one stops startup
    with a message naming the variable.
  - A malformed price stops startup even when AI is off. This is 18b1's
    "validated either way" rule.
  - Direct models have no default, because a price belongs to one model.
  - `AiSettings` becomes `{ providers: ProviderSettings[]; creditsPerMonth }`.
    Each entry in `providers` is either `{ name: "openrouter", apiKey,
    model }` or `{ name: "anthropic" | "openai", apiKey, model, price }`, in
    order.

  *Done when:* unit tests show all of the following:
  - The defaults are unchanged: OpenRouter alone, AI off without its key.
  - `AI_PROVIDERS=anthropic` with only `ANTHROPIC_API_KEY` set refuses,
    naming `ANTHROPIC_MODEL`.
  - `openrouter,openai` with no `OPENAI_API_KEY` refuses, naming it.
  - A price with a missing, repeated, unknown or negative key refuses,
    naming `ANTHROPIC_PRICE` and never its value.
  - `anthropic,openrouter` with no Anthropic key is AI off.
  - A full three-provider configuration parses into the order given.

  Also, `npm start` with `AI_PROVIDERS=openrouter,anthropic`, an
  OpenRouter key and no Anthropic key exits, naming `ANTHROPIC_API_KEY`.
- [x] **Step 2 - cost from tokens** - add `app/features/ai/pricing.ts`, a
  pure function `costFromUsage(usage, price)`. It locks `Usage.input` as
  **every input token, cache reads and writes included** (OpenRouter's
  `prompt_tokens` already counts this way). The cost is:

  ```
  ((input - cacheRead - cacheWrite) × price.input
    + cacheRead × price.cacheRead
    + cacheWrite × price.cacheWrite
    + output × price.output) / 1,000,000
  ```

  A usage whose cache counts exceed `input` is refused.

  *Done when:* unit tests show worked examples. Opus 5.5's price with 2,000
  input tokens (1,800 of them cache reads) and 1,500 output tokens comes to
  US$0.03116, which is 32 credits through `creditsFromCostUsd`. A zero usage
  costs 0, and inconsistent cache counts are refused.
- [x] **Step 3 - the shared chat-completion reader and the OpenAI adapter**:
  - Rename `openrouter-response.ts` (and its test) to `chat-completion.ts`
    with `git mv`.
  - `readCompletion(response, source)` takes the provider name and either
    `{ reported: true }` (OpenRouter's `usage.cost`, as now) or
    `{ price }`, which computes the cost with `costFromUsage`.
  - `sortChatError(error, provider)` names the provider in its message.
  - New `openai.server.ts`: one `chat.completions.create` at OpenAI's
    default address with the configured model, the instructions as the
    system message (OpenAI caches long prefixes itself), the same strict
    `json_schema` response format, `max_tokens` 8000, `maxRetries` 2 and
    the attempt's signal. It sends no OpenRouter fields and records the
    served `response.model`.
  - Errors sort as for OpenRouter: 429, 5xx, connection and abort are
    `unavailable`; other 4xx are `broken`; `refusal` or `content_filter` is
    `refused`; `length` or bad JSON is `invalid`.

  *Done when:*
  - The existing OpenRouter tests pass unchanged apart from imports.
  - New unit tests show an OpenAI-shaped completion (`prompt_tokens`
    including `cached_tokens`, no `usage.cost`) priced from its tokens with
    `provider: "openai"`.
  - A priced completion with no `usage` fails as `invalid`.
  - Constructed `openai` SDK errors sort with "OpenAI" in the message.
  - The OpenRouter adapter still gives a succeeded `npm run ai:try` run.
- [x] **Step 4 - the Anthropic adapter** - install `@anthropic-ai/sdk`,
  pinned exactly (0.131.0 at spec time; record what is installed). Add
  `anthropic.server.ts` for the call and `anthropic-response.ts`, pure, for
  reading and sorting.

  The request is one `messages.create` with:
  - the configured model and `max_tokens` 8000;
  - `system` as one text block holding the instructions, marked
    `cache_control: { type: "ephemeral" }`;
  - `userMessage(input)` as the user turn;
  - `output_config: { format: { type: "json_schema", schema:
    providerJsonSchema() } }`;
  - `maxRetries` 2 and the attempt's signal;
  - no `fallbacks` (Decisions).

  Reading the response:
  - `stop_reason` `refusal` is `refused`, with the category logged and
    never the text.
  - `max_tokens` is `invalid`.
  - The first `text` block is parsed as JSON; unparseable is `invalid`.
  - Usage: `input` = `input_tokens + cache_read_input_tokens +
    cache_creation_input_tokens`, `cacheRead` = `cache_read_input_tokens`,
    `cacheWrite` = `cache_creation_input_tokens`, `output` =
    `output_tokens`, priced with `costFromUsage`.

  Errors: 429, 529 and other 5xx, connection, connection timeout and abort
  are `unavailable`; 400, 401, 403, 404 and any other 4xx are `broken`,
  logged with the status.

  *Done when:* unit tests read a constructed success (usage summed and
  priced, served model recorded), a refusal, a `max_tokens` stop, a
  response with no text block and one with unparseable text into the right
  results. Constructed SDK errors for 429, 529, 500, 400, 401 and a
  connection error sort correctly. `npm run typecheck` passes with the SDK
  installed.
- [x] **Step 5 - the fallback chain** - add `fallback-chain.ts`, pure, as
  `createFallbackChain(entries, options)`, where each entry is
  `{ name, adapter }`.
  - It tries the entries in order.
  - An `AiError` with code `unavailable` moves to the next entry. Every
    other outcome is final: success, `refused`, `broken`, `invalid` or a
    non-`AiError` throw.
  - When the run's own signal has fired it stops without trying the next.
  - Every entry but the last runs under its own limit,
    `ATTEMPT_TIMEOUT_MS` = 150 s, combined with the run's signal. When that
    limit fires the attempt counts as `unavailable` and the chain moves on.
    The last entry gets whatever is left of the run's 5 minutes.
  - Each move logs one JSON line, `{ event: "ai_provider_unavailable",
    runId, from, to, reason }`, where `reason` is the `AiError` message and
    never the description. `to` is `null` when the last provider fails, and
    the chain then rethrows its error.
  - `GenerateInput` gains `runId`, which the runner passes in and the
    adapters ignore.

  *Done when:* unit tests with fake adapters show all of the following:
  - The first `unavailable` moves to the second, and the second's result is
    returned with its provider.
  - A `refused`, `broken` or `invalid` from the first never calls the
    second.
  - All `unavailable` rethrows the last error and logs a move for each.
  - A first adapter that never settles is abandoned at its attempt limit (a
    short limit injected in the test) and the second runs.
  - An aborted run signal calls no later adapter.
  - A chain of one behaves exactly as its adapter.
  - Each log line has `runId`, `from` and `to`, and no description text.
- [x] **Step 6 - wiring and `ai:try`** _(amended 2026-10-07, owner: narrowed to what runs without the Anthropic and OpenAI keys; the live direct-provider runs moved to `needs-you.md`)_ - add `providers.server.ts`,
  `createAiAdapter(settings: AiSettings)`, which builds each configured
  adapter in order and wraps them in the chain. `scripts/ai-try.ts` uses it
  and drops its direct OpenRouter import. Its "AI is off" message names the
  first provider's key variable.

  *Done when* (local, not CI; only `OPENROUTER_API_KEY` is real, and the
  Anthropic fallback is configured on the command line with a dummy key):
  - `AI_PROVIDERS=openrouter` gives a succeeded `npm run ai:try` run
    through the chain, recording provider `openrouter`, served model,
    tokens, a cost and credits.
  - `AI_PROVIDERS=openrouter,anthropic` with an invalid
    `OPENROUTER_API_KEY` gives a failed `broken` run and no
    `ai_provider_unavailable` line (a 401 does not move on).
  - With OpenRouter unreachable for one run (its traffic sent to a dead
    proxy, no source edit), the output has one `ai_provider_unavailable`
    line, `from` openrouter, `to` anthropic, with the run id, and
    Anthropic's API answers (a dummy key's 401 sorts `broken`).

  *Moved to `needs-you.md`:* succeeded runs with `anthropic` and `openai`
  alone, and Anthropic cache reads on a second run (F-352: the
  instructions may be under the model's minimum cacheable prefix).
- [x] **Step 7 - `npm run ai:measure`** _(amended 2026-10-07, owner: measured with OpenRouter alone; the three-provider measurement moved to `needs-you.md`)_ - add `scripts/ai-measure.ts`,
  `app/features/ai/measure-samples.ts` (four fixed descriptions, one per
  kind) and `app/features/ai/measure-summary.ts` (pure).
  - It parses only the AI variables and needs no database or site.
  - For each configured provider on its own (not the chain), it runs each
    sample `--repeat` times (default 1), one after another, under the run's
    5-minute limit.
  - Each attempt records: outcome or error code, duration, tokens, cost,
    credits, served model, page and section counts, and whether every page
    expands to a document `parseDocument` accepts.
  - It writes each proposal and its record as JSON under
    `--out` (default `ai-measurements/<UTC timestamp>/`, added to
    `.gitignore`).
  - It prints one table per provider and model: runs, failures by code,
    median and slowest duration, mean and highest cost, mean credits, and
    runs per 1,000 credits.
  - It exits 1 only on a configuration error. A failed attempt is a result,
    not a crash.

  *Done when:*
  - Unit tests show the summary's medians, means, failure counts and runs
    per 1,000 credits from fixed records, including an all-failed provider.
  - With `AI_PROVIDERS=openrouter`, `npm run ai:measure` completes,
    prints the OpenRouter table and writes 4 proposal files.
  - The table is copied into this spec's Decisions, with the date and
    model.

  *Moved to `needs-you.md`:* the same run with all three providers
  configured (12 proposal files), and the tables for the owner's choice of
  models and the Free allowance.
- [x] **Repair F-344 - the chain logs a move that never happens when the run times out** - log `to: null` when the run's signal has fired. *Done when:* a test with a run aborted during a non-last attempt shows `to: null` and no later call, failing with the repair reverted.
- [x] **Repair F-346 - `ai:measure` records a 5-minute timeout as `unavailable`** - check the run's abort before the `AiError` branch. *Done when:* a test shows an aborted attempt recorded as `timeout`, failing with the repair reverted.
- [x] **Repair F-348 - the chain leaves a listener on the run's signal per attempt** - remove both run-signal listeners in `finally`; call `generate` inside the `try`. *Done when:* a test shows the run signal has no listener left after an attempt, and a synchronously throwing adapter leaves none either, failing with the repair reverted.
- [x] **Repair F-349 - `ai:measure` doesn't show which proposals fail to expand** - "expands cleanly: n of m" in the summary and table; expansion and tokens on the per-attempt line. *Done when:* a test shows the count from fixed records and in the formatted table, failing with the repair reverted.

## Files and areas

- `app/lib/ai-env.server.ts` (+ test), `.env.example`
- `app/features/ai/`:
  - new: `pricing.ts`, `openai.server.ts`, `anthropic.server.ts`,
    `anthropic-response.ts`, `fallback-chain.ts`, `providers.server.ts`,
    `measure-samples.ts`, `measure-summary.ts`, with tests beside them
  - renamed: `openrouter-response.ts` becomes `chat-completion.ts`
  - changed: `openrouter.server.ts`, `run-generation.ts` (`runId` in
    `GenerateInput`)
- `scripts/ai-try.ts`, new `scripts/ai-measure.ts`
- `package.json`: the `ai:measure` script and the `@anthropic-ai/sdk`
  dependency
- `.gitignore`: `ai-measurements/`
- `AGENTS.md`: the *Environments* rows and *Stack and versions*.
  `dev-notes/` is left to `docs`.

## Data and contracts

**No schema change.** `ai_runs.provider` already holds any text, and
`cost_usd` was planned for direct providers' worked-out cost (0020's
comment).

Load-bearing contracts:

- **`Usage.input` counts every input token, cache reads and writes
  included**, for every adapter. `costFromUsage` and the run's recorded
  `input_tokens` depend on it.
- **A price:** `{ input, output, cacheRead, cacheWrite }`, each in US
  dollars per million tokens, parsed from
  `input=…,output=…,cache_read=…,cache_write=…`.
- **`AiSettings`:**

  ```
  {
    providers: Array<
      | { name: "openrouter"; apiKey: string; model: string }
      | { name: "anthropic" | "openai"; apiKey: string; model: string; price: Price }
    >;   // at least one, in AI_PROVIDERS order
    creditsPerMonth: number | null;
  }
  ```

  It replaces 18b1's `settings.openrouter`. `env.AI` is still `null` when
  AI is off.
- **`GenerateInput`:** `{ runId: string; kind; description }`.
- **Log event** `ai_provider_unavailable`: `{ runId, from, to: string |
  null, reason }`.
- `AiAdapter`, `AiError` and `GenerateResult` are unchanged. The chain
  returns the result of whichever provider answered, so `ai_runs.provider`
  and `model` name that one.

## Testing

- **Unit** (`npm test`, inside `verify`, in CI): steps 1-5 and step 7's
  summary. These use constructed SDK responses and errors and fake
  adapters, with no network and no database.
- **Live, local only, with `OPENROUTER_API_KEY` in `.env`:** step 3's
  OpenRouter regression run, step 6's runs and step 7's measurement. CI
  never calls a provider and has no keys. OpenRouter's runs cost
  US$0.02-0.04 each.
- **Not proven by this item:** a live run through Anthropic or OpenAI
  direct. Their request shapes, response reading and pricing are proven by
  unit tests on constructed SDK responses only; the live runs wait on
  `needs-you.md`'s AI provider accounts line, before the v1 deploy.
- **No browser test:** this item has no screen and no new database
  behaviour.

## Decisions

- **18b2 ships without a live run through Anthropic or OpenAI direct**
  (owner, 2026-10-07): the keys are not yet in hand. Steps 6 and 7 were
  narrowed to what runs with OpenRouter alone; the direct-provider runs and
  the three-provider `ai:measure` are a `needs-you.md` line, needed before
  the v1 deploy. Beat: holding the item open until the keys arrive.
- **Measured 2026-10-07, `npm run ai:measure`, OpenRouter alone, model
  `anthropic/claude-opus-5.5`, one run per sample:**

  | runs | failures | expands cleanly | median | slowest | mean cost | highest cost | mean credits | runs per 1,000 credits |
  |---|---|---|---|---|---|---|---|---|
  | 4 | none | 4 of 4 | 22,138 ms | 25,535 ms | US$0.031331 | US$0.037800 | 31.8 | 31.5 |

- **Anthropic's server-side refusal fallback is not used** (owner,
  2026-10-07) (`fallbacks`,
  beta `server-side-fallback-2026-07-01`). The `"default"` form routes a
  refusal to a model Anthropic chooses, whose price we do not have
  configured. Its tokens would then be priced at the wrong rate, and the
  allowance would no longer bound spend (D391). A refusal therefore fails
  the run with every provider, as it already does through OpenRouter
  (D372). This amends plan section 6, *Integrations*, *When it is not
  used*. Beat: the array form with a configured fallback model and a second
  price, which adds two more variables for a rare case.
- **AI is on when the first provider in `AI_PROVIDERS` has its key.** A
  listed fallback without its key, model or price stops startup instead of
  being skipped. A fallback that silently is not there is found only during
  an outage. Beat: AI on when any listed key is set, skipping the rest.
- **Direct providers have no default model or price.** A price belongs to
  one model, and a default price drifts out of date without anyone
  noticing. Beat: defaulting to Claude Opus 5.5 at US$4 / US$20.
- **A price has all four keys**, with `cache_write=0` where a provider does
  not charge for it (OpenAI). Beat: defaulting the cache prices from the
  input price, which hides the 10x difference between a cache read and an
  uncached input token.
- **`Usage.input` includes cached tokens for every provider**, so the stored
  `input_tokens` mean the same thing whichever provider ran. Beat: storing
  each provider's own convention (Anthropic's `input_tokens` excludes the
  cache).
- **Every provider but the last has 150 seconds, the last has what is left
  of the 5 minutes.** Without an attempt limit, a provider that hangs uses
  up the whole run and the fallback never runs. 150 s covers an 8,000-token
  answer at the measured ~70 tokens a second. An abandoned attempt reports
  no cost, so it is not charged, which is 18b1's accepted timeout gap.
  Beat: a fixed 100 s for every attempt, which would cut off a long answer
  from the sole provider.
- **With three providers, the third may get no time** (owner, 2026-10-07,
  F-345 accepted): two hung attempts of 150 s use the whole 5-minute run.
  Revisit when optimising AI cost and latency. Beat: sharing the time left
  across the providers left.
- **An `unavailable` attempt is charged nothing.** None of the three
  providers reports a cost for a 429, a 5xx, a dropped connection or an
  abort, so there is nothing to carry forward. Beat: summing the costs of
  every attempt.
- **OpenAI direct sends `max_completion_tokens` 8000, not `max_tokens`**
  (build, Step 3): the SDK marks `max_tokens` deprecated and OpenAI's
  reasoning models refuse it with a 400, which would sort as `broken` and
  never fall back. Beat: the spec's `max_tokens`.
- **The direct adapters take `Exclude<ProviderSettings, { name: "openrouter" }>`**
  (build, Step 3): the settings union has one member for both direct
  providers, so `Extract<…, { name: "openai" }>` is `never`. Beat: splitting
  the union into one member per provider.
- **`ai:measure` runs each provider on its own, not through the chain**, so
  every configured model gets measured. To compare another model, run it
  again with `<P>_MODEL` changed. Beat: a `--models` list, which would need
  a price per model on the command line.

## Production needs

- `@anthropic-ai/sdk` in the release's `node_modules`.
- In `/etc/habre-cms/production.env`, entered by the owner:
  - `AI_PROVIDERS=openrouter,anthropic,openai`, or whichever order the
    owner picks;
  - `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `ANTHROPIC_PRICE`;
  - `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_PRICE`;
  - production keys, each with a spend limit in its provider's console.
- No migration.

## Behaviour changes

- Changes `ai.1` from "with no `OPENROUTER_API_KEY` the app starts with AI off" to "with no key for the first provider in `AI_PROVIDERS` (`OPENROUTER_API_KEY` by default) the app starts with AI off" - Step 1
- Changes `ai.2` from "an unknown or repeated name in `AI_PROVIDERS`, or a malformed `AI_CREDITS_PER_MONTH`, stops the app at startup with a message naming the variable" to "an unknown or repeated name in `AI_PROVIDERS`, a malformed `AI_CREDITS_PER_MONTH` or price, or a listed provider missing its key, model or price while AI is on, stops the app at startup with a message naming the variable" - Step 1
- Adds to `ai`: a run whose provider is unavailable moves to the next provider in `AI_PROVIDERS`, and the run records the provider that answered - Step 5
- Adds to `ai`: a refusal, or a request or key error, from a provider fails the run without trying the next provider - Step 5
- Adds to `ai`: a run through OpenAI direct is charged credits from its reported tokens and the configured price - Step 3
- Adds to `ai`: a run through Anthropic direct is charged credits from its reported tokens and the configured price - Step 4

## Notes

- **The description is personal data.** It is sent and never logged, by the
  chain, the adapters and both scripts. Proposal files from `ai:measure`
  hold only the fixed samples' output.
- **AI output is untrusted.** Every provider's output goes through
  `proposalSchema` in the runner, as now. No adapter skips it.
- The Anthropic SDK has two dependencies, `standardwebhooks` and
  `json-schema-to-ts`, which D155 counted. Pin it exactly, as D197 does.
- Anthropic's JSON-schema support has limits of its own. If the provider
  schema's `anyOf` sections or nullable slots are refused, Step 4's live
  run finds out. Fix it in `provider-schema.ts` only if the change keeps
  OpenAI and OpenRouter working, and record it here.
- Opus 5.5 always thinks, and its thinking counts against `max_tokens`
  8000. If Step 6 or 7 shows `invalid` from cut-off answers, record it and
  stop for a decision (`effort`, or a higher limit) rather than tuning past
  the spec.
- Read `node_modules/@anthropic-ai/sdk` types after installing; don't guess
  names. The `claude-api` skill's TypeScript reference applies.
- Error sorting follows 18b1: a status this spec does not name is `broken`.

## Findings

### 18b2-fallbacks/F-343 [P2] closed - AGENTS.md was not updated for the direct providers

**Found:** 2026-10-07 by review (scope: 51e3566, fingerprint 67c2440053d3; lens: every lens; via reviewer)
**Why it matters:** The spec names AGENTS.md in *Files and areas*, but no commit touches it: `@anthropic-ai/sdk` 0.131.0 is not recorded; the development row still says `OPENROUTER_API_KEY` blank turns AI off, false when `AI_PROVIDERS` starts with `anthropic` or `openai`; the production row lacks the six new variables. `deploy` and `migrate` read these rows.
**Suggested fix:** Add the SDK pin, the first-provider-key switch, and `ANTHROPIC_*` / `OPENAI_*` to both rows.
**Resolution:** 2026-10-07, build: `AGENTS.md` records `openai` 7.30.0 and `@anthropic-ai/sdk` 0.131.0 under *Stack and versions*; the development row states the first-provider-key switch and the direct providers' model and price variables; the production row lists the six `ANTHROPIC_*` / `OPENAI_*` variables. Docs only, no test; for `review` to close. Closed by review, 2026-10-07 (scope: F-343 repair in f819fad; lens: quality): versions match `package.json` and installed packages (`openai` 7.30.0, `@anthropic-ai/sdk` 0.131.0); the switch, six variables, price format and startup rule match `app/lib/ai-env.server.ts` and `.env.example`; the `ci` row still holds (default order, no key, AI off).

### 18b2-fallbacks/F-344 [P3] closed - When the run times out during a non-last attempt, the chain logs a move that never happens

**Found:** 2026-10-07 by review (scope: 51e3566, fingerprint 67c2440053d3; lens: every lens; via reviewer)
**Why it matters:** If the run signal fires while provider 1 of 2+ is running, the chain logs `to: "<next>"` and then throws on `signal.aborted`; the next provider is never called and the run records `timeout`. Probe (three hanging fakes, 50 ms attempt, 100 ms run) logged `anthropic -> openai` with 0 OpenAI calls. The spec says `to` is null when nothing follows.
**Suggested fix:** Log `to: signal.aborted ? null : (next?.name ?? null)`, or check `signal.aborted` before logging.
**Resolution:** 2026-10-07. The move log line now says `to: null` when the run signal has fired (`to: signal.aborted ? null : (next?.name ?? null)`) in app/features/ai/fallback-chain.ts. Test: "a run aborted during a non-last attempt logs no move and calls no later provider" (three hanging adapters, run aborted during the first). Red before the repair (`to` was "openai", expected null); red with the repair reverted (same); green with it (12 pass, 0 fail); `npm run verify` exit 0. Closed by build.

### 18b2-fallbacks/F-345 [P3] accepted - With three providers, the attempt limits use up the whole run, so the third gets no time

**Found:** 2026-10-07 by review (scope: 51e3566, fingerprint 67c2440053d3; lens: every lens; via reviewer)
**Why it matters:** 150 s + 150 s = the 300 s run limit, so with `openrouter,anthropic,openai` and the first two hanging, OpenAI is never reached (and a move to it is logged, F-344). The spec's Decisions reason only about two providers.
**Suggested fix:** A spec decision: accept it, or cap each non-last attempt at `min(150 s, time left / providers left)` with the run's deadline passed in.
**Resolution:** accepted by the owner, 2026-10-07: with three providers the third may get no time when the first two hang; revisit when optimising AI cost and latency. Recorded in the 18b2 spec's Decisions.

### 18b2-fallbacks/F-346 [P3] closed - `ai:measure` records a 5-minute timeout as `unavailable`

**Found:** 2026-10-07 by review (scope: 51e3566, fingerprint 67c2440053d3; lens: every lens; via reviewer)
**Why it matters:** The timer aborts; the SDK throws `APIUserAbortError`, which every adapter sorts as `AiError("unavailable")`; the `instanceof AiError` branch runs before the `controller.signal.aborted ? "timeout"` fallback. Slow models read as outages in the table the owner picks models from.
**Suggested fix:** Check `controller.signal.aborted` first and record `timeout`, as `run-generation.ts:160` does.
**Resolution:** 2026-10-07. The decision is extracted to `classifyAttemptFailure(caught, aborted)` in app/features/ai/measure-summary.ts (used by scripts/ai-measure.ts); an aborted attempt is now `timeout` before the AiError code is read, keeping the error's model, usage and cost. Test: "an attempt whose own limit aborted it is a timeout even though the adapter said unavailable" (plus "an unavailable provider that was not aborted stays unavailable"). Red before the repair (actual unavailable, expected timeout); red with the repair reverted (same, 9 pass 1 fail); green with it (10 pass, 0 fail); `npm run verify` exit 0. Closed by build.

### 18b2-fallbacks/F-347 [P3] closed - The SDK clients take settings from the environment that the app never validates

**Found:** 2026-10-07 by review (scope: 51e3566, fingerprint 67c2440053d3; lens: every lens; via reviewer)
**Why it matters:** `new OpenAI(...)` / `new Anthropic(...)` read `OPENAI_BASE_URL` / `ANTHROPIC_BASE_URL` (request and key sent elsewhere), `ANTHROPIC_AUTH_TOKEN` (extra bearer token), and `OPENAI_LOG` / `ANTHROPIC_LOG=debug`, which logs request bodies - the customer's description - to the journal (`openai/client.js:832-839`), breaking the spec's never-logged note. OWASP A02, A09. P3: an operator must set one.
**Suggested fix:** Pin `baseURL` (`https://api.openai.com/v1`, `https://api.anthropic.com`), `logLevel: "warn"` on all three clients, and `authToken: null` for Anthropic.
**Resolution:** 2026-10-07, build: new `app/features/ai/client-options.ts` pins `baseURL`, `logLevel: "warn"` and (Anthropic) `authToken: null` for all three clients, used by the three adapters. Test `client-options.test.ts` sets `OPENAI_BASE_URL`, `OPENAI_LOG`, `ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_LOG` and builds real SDK clients: red before the repair (3 of 3 failed, e.g. baseURL `http://attacker.invalid/v1`), green after (3 of 3); removing `authToken: null` turned the Anthropic test red, restored. `npm run verify` exit 0; live `ai:try` through OpenRouter succeeded (42 credits). Closed by build.

### 18b2-fallbacks/F-348 [P3] closed - The chain leaves one listener on the run's signal per attempt

**Found:** 2026-10-07 by review (scope: 51e3566, fingerprint 67c2440053d3; lens: every lens; via reviewer)
**Why it matters:** The reject-`stopped` abort listener is never removed (only `onRunAbort` is). Harmless with today's per-run signal; a longer-lived signal from 18b3 would pile listeners up. Also `adapter.generate` is called before the `try`, so a synchronous throw would leak the timer and listener.
**Suggested fix:** Name the reject handler and remove it in `finally`; move the `generate` call inside the `try`.
**Resolution:** 2026-10-07. app/features/ai/fallback-chain.ts: the reject-on-run-abort handler is now named (`onRunAbortReject`) and removed in `finally` beside `onRunAbort`; `adapter.generate(...)` moved inside the `try`, so a synchronous throw still clears the timer and listeners (a non-AiError is still rethrown). Tests: "the chain leaves no abort listener on the run signal after an attempt" and "a provider that throws synchronously leaves no abort listener and is rethrown" (`getEventListeners(signal, "abort")`). Red before the repair (listeners 1 and 2, expected 0); red with the repair reverted (both fail, 12 pass 2 fail); green with it (14 pass, 0 fail); `npm run verify` exit 0. Closed by build.

### 18b2-fallbacks/F-349 [P3] closed - `ai:measure` doesn't show which proposals fail to expand

**Found:** 2026-10-07 by review (scope: 51e3566, fingerprint 67c2440053d3; lens: every lens; via reviewer)
**Why it matters:** A proposal passing `proposalSchema` but failing `parseDocument` shows as succeeded in the per-attempt line and the table; the spec's *In scope* says the script prints whether each expands cleanly, and its tokens. Only the JSON files have it.
**Suggested fix:** Add "expands cleanly: n of m" to `GroupSummary` and the table, and expansion and tokens to the per-attempt line.
**Resolution:** 2026-10-07. app/features/ai/measure-summary.ts: `GroupSummary` gains `succeeded` and `expandsCleanly` (counted out of the succeeded attempts, not all attempts); `formatSummary` prints "expands cleanly: n of m"; new pure `formatAttemptLine` (used by scripts/ai-measure.ts) shows expands cleanly / does not expand / no proposal, and tokens in/cached/out. Tests: "a succeeded attempt whose proposal does not expand is counted out of the succeeded ones" and "the per-attempt line shows whether the proposal expanded and its tokens". Red before the repair (expected 3, actual undefined; line lacked the new text); red with the repair reverted (2 fail, 10 pass); green with it (12 pass, 0 fail); `npm run verify` exit 0. Closed by build.
