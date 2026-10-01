# Coding Standards

> **This project's own conventions** - the linter, the import style, the shape of
> a test file, and the external standards it holds itself to. **Yours.** Nothing
> in the workflow overwrites this file once it exists.
>
> The universal half lives in `fundamentals.md` next to it, which the pack owns
> and refreshes. **Read both.** Where this file disagrees with that one, **this
> file wins** - it describes a real project and that one describes every project.
>
> Written against the real repo by `scaffold` (new project) or `setup` (existing
> code). Until then these are prompts, not standards. **Anything that could not
> be determined says so** - an invented convention is worse than an absent one,
> because `review` will enforce it.

# Part 2 - This project

Written by `scaffold` on 2026-09-15, against the freshly scaffolded repository.

## Where these rules come from

- **Enforced by a tool:** formatting and lint - Biome, `biome.json`. Types -
  TypeScript, `tsconfig.json`, `tsconfig.node.json`, `tsconfig.vite.json`. The
  server-only boundary - React Router's build. The configs win over any prose
  here.
- **Agreed in the plan:** layout, imports and the client/server marking -
  `blueprint/project-plan.md` section 6 *Layout*, D16. Dependencies - section 10
  and D10-D20.
- **Framework guidance:** React Router's installed docs,
  `node_modules/react-router/docs/`, and its agent skill in
  `.agents/skills/react-router/`. Where a React Router pattern is in question,
  the installed docs for 8.3.1 decide, not memory.
- **Inferred from a new codebase:** everything else below reflects the handful
  of files written at scaffold time. It is a starting convention, not a team
  agreement - change it here when the code shows a better one.

## Language and strictness

- TypeScript 7.0.2 everywhere; `server.js` is JavaScript type-checked through
  `checkJs` with JSDoc types.
- Enabled (root `tsconfig.json`): `strict`, `verbatimModuleSyntax`,
  `allowImportingTsExtensions`, `erasableSyntaxOnly`, `noEmit`, `checkJs`.
  `noUncheckedIndexedAccess` is **not** enabled.
- `erasableSyntaxOnly` is load-bearing: plain `node` strips types rather than
  compiling them, so **no `enum`, no `namespace`, no constructor parameter
  properties.** Use union types and `as const` objects.
- Target and lib ES2024. Browser code (`tsconfig.vite.json`) also has DOM types.

## Formatting and linting

- Biome 2.5.13, `biome.json`: recommended lint rules, 2-space indent, 100-column
  lines, double quotes, imports organised automatically.
- `npm run format` fixes; `npm run lint` checks and fails on any issue. Never
  argued in review.
- `.claude/` and `.agents/` are excluded; gitignored paths are skipped.

## File layout and naming

- By feature: `app/features/<feature>/` holds that feature's route modules,
  server code and components. `app/lib/` is only for code several features use.
  Every URL is listed in `app/routes.ts`.
- File names are kebab-case (`pending-migrations.ts`). Route modules are named
  for what they show (`home.tsx`, `healthz.ts`).
- **`*.server.ts`** for anything touching the database, secrets, JWT or R2 - the
  build fails if browser code imports one. **`*.client.tsx`** for browser-only
  code (Editor.js). Everything else may run in both.
- Logic worth unit-testing lives in `.ts` files, not in `.tsx` route modules:
  `node --test` cannot run JSX. `db/pending-migrations.ts` beside `db/migrate.ts`
  is the pattern - pure function separate from the code that does I/O.
- Resource routes (no UI) are `.ts` files exporting only `loader`/`action` and
  returning a `Response`.

## Imports

- Across directories: `#app/...` with the file extension
  (`import { sql } from "#app/lib/db.server.ts"`). Within a directory: relative
  with the extension (`./pending-migrations.ts`).
- **No `~/` alias** - plain `node` (tests, migrations, scripts) cannot resolve
  it.
- Type-only imports use `import type` (`verbatimModuleSyntax` requires it).
- Route types come from the generated `./+types/<route>` - never edit
  `.react-router/types`.
- No barrel (`index.ts`) files. Could not determine a preference beyond that
  from code this new.

## Error handling pattern

- **Configuration fails at startup:** `app/lib/env.server.ts` validates the
  environment with Zod when first imported and throws a message naming the
  variable and rule, never its value.
- **Route loaders and actions** follow React Router's documented pattern:
  throw `data("Not Found", { status: 404 })` for a missing record (rendered by
  the nearest `ErrorBoundary`); return `data({ errors, values }, { status: 400 })`
  for a validation failure and render it from `actionData`. Not yet exercised by
  real code - item 1 is the first.
- **Unexpected errors** propagate to the route `ErrorBoundary` (`app/root.tsx`
  shows details only in development). `server.js` catches anything that escapes
  the framework, logs it with `console.error`, and answers 500.
- **Server errors are logged by `handleError`** in `app/entry.server.tsx`.
  It skips aborted requests and the 404s and 405s React Router generates
  itself (`isRoutineRefusal`, F-114): these are bot probes, and Caddy's access
  log records them. Every other error is logged, the same way React Router's
  default handler logs it.
- **Health and dependency checks** catch, log with context, and report the
  failure in the response (`/healthz` returns 503) rather than throwing.
- **Scripts** (`db/migrate.ts`) catch at the top level, log what failed, set
  `process.exitCode = 1`, and always release resources in `finally`.
- Logging is `console.*` to stdout/stderr, collected by the systemd journal in
  production. No logging library.

## Test runner and test shape

- **Unit:** `node:test` with `node:assert/strict`, run by `npm test`. Files are
  `<subject>.test.ts` beside the subject; Node discovers `**/*.test.ts`.
  Tests import the subject with a relative `.ts` path, one `test()` per
  behaviour, named as a sentence describing the result, asserting on values
  (`deepEqual`, `throws` with a message pattern). See
  `db/pending-migrations.test.ts`.
- **Browser:** Playwright 1.63.0, Chromium only, `e2e/<area>.spec.ts`, run by
  `npm run test:e2e`. It builds and starts the production server on port 3100
  and needs the development database running. Prefer role-based locators
  (`getByRole`). See `e2e/smoke.spec.ts`.
- **Never name a directory `test/`** - Node treats it as tests. Playwright's
  `testDir` is `e2e`, so it never collects `*.test.ts`.
- Both runners were shown to fail on deliberately broken code at scaffold time.

## Standards this project follows

- **Security: OWASP Top 10:2025**, as mapped in `fundamentals.md`, held to the
  security posture in `blueprint/context/quality-bar.md` (server-side
  authorization, structured content escaped on render, upload allowlist, secrets
  only in environment variables, logged security events).
- **Accessibility: WCAG 2.2 level AA**, as recorded in
  `blueprint/context/design.md` (its *Accessibility bar*, with measured
  contrast), to which `quality-bar.md` defers.
- **Semantic HTML on every page** - Habre's screens, the editor and customer
  sites (owner, 2026-10-02):
  - Landmarks: one `header`, `main` and `footer` per page, `nav` for each
    navigation (labelled when there is more than one); a post is an
    `article`.
  - One `h1` per page. A heading's level follows the outline, never the look:
    CSS sets the size.
  - The element that means the thing: `a` to go somewhere, `button` to do
    something, `ul` / `ol` for lists, `table` for tabular data, `form` with a
    `label` for every field and `fieldset` / `legend` for a group, `time` with
    `datetime` for a date, `figure` / `figcaption` for a captioned image.
  - No click handlers on a `div` or `span`. ARIA only where no native element
    exists (a toolbar, a live region), never to repeat what an element already
    says.
  - Content renders to its elements (D169): paragraph `p`, heading `h1`-`h6`,
    lists `ul` / `ol`, quote `blockquote`, line `hr`, image `img` with its alt
    text, section `section`; **a button block is a link (`a`)**, because it
    goes somewhere; a space is spacing only, with nothing announced.
  - Checked by `review`, and in the browser tests by role-based locators
    (`getByRole`), which fail when an element lacks its role. No automated
    HTML or accessibility checker is installed.
- **Performance, scale, availability:** the numbers in `quality-bar.md`; nothing
  stricter.

## Verify command

`npm run verify` - typecheck (`react-router typegen && tsc -b`), lint (Biome),
unit tests (`node --test`), build (`react-router build`). Browser tests are
separate (`npm run test:e2e`) because they need the development database.
