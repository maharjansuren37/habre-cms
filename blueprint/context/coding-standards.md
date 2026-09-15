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

*Written against the real repo by `scaffold` (new project) or `setup` (existing
code). Until then these are prompts, not standards. **Anything that could not be
determined says so** - an invented convention is worse than an absent one,
because `review` will enforce it.*

## Where these rules come from

<!-- Fill this in when the project already had standards. Three kinds, and the
     difference matters when someone later wants to change a rule:

     - **Enforced by a tool** - name the tool and its config file. Never restate
       the rule here; the config wins and a prose copy drifts from it.
         e.g. Formatting: Prettier, .prettierrc. Lint: eslint.config.mjs.
     - **Agreed in a document this project maintains** - point at it, record only
       what it does not cover.
         e.g. CONTRIBUTING.md covers commits, branches and review.
     - **Inferred from the code**, agreed by nobody - the rest of this file.
       Say so, because "the code does this" and "the team decided this" are
       different claims and a later reader cannot tell them apart. -->

_Nothing recorded yet._

## Language and strictness

<!-- Language and version. Strictness settings actually enabled, read from the
     config rather than recalled - e.g. TypeScript `strict`, `noUncheckedIndexedAccess`. -->

## Formatting and linting

<!-- The formatter and linter, their config files, and the command that runs them.
     Formatting is automated and never argued about in review. -->

## File layout and naming

<!-- Where things go and what files are called, following the framework's own
     conventions. Whether the source root is organised flat, by feature, or by layer. -->

## Imports

<!-- Import style: path aliases, ordering, relative vs absolute, barrel files or not. -->

## Error handling pattern

<!-- The pattern this stack expects - exceptions, result types, framework error
     boundaries - and where errors are caught. -->

## Test runner and test shape

<!-- The test runner, what a test file is called, where it sits, and what a
     typical test looks like here. -->

## Standards this project follows

<!-- The external standards `review` audits against, named so a finding is
     checkable rather than an opinion. Typically OWASP Top 10:2025 for web security,
     OWASP MASVS for mobile, WCAG 2.2 AA for anything with a UI.

     Name only what this project actually holds itself to. `review` treats an
     unrecorded standard as not a finding, so an empty list here means those
     lenses can report generic smells and nothing else - and a personal tool and
     a payment system genuinely warrant different bars. -->

## Verify command

<!-- One command that runs the checks this project actually has, recorded under
     Commands in AGENTS.md. Preferred order: typecheck, tests, build. It is an
     umbrella over real checks - never invent a runner just to fill it in. -->
