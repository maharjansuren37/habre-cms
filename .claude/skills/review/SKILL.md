---
name: review
description: "Read-only code audit that records what it finds in the ledger at blueprint/context/findings.md. Reviews the current work (`current`), the changed files (`changed`), a named path, or the whole project (`full`), through every lens or one focused lens: quality, security, performance, or tests. Findings get durable IDs, a severity from P0 to P3, and a status; an open or fixed P0 or P1 blocks the merge at `ship`. Writes nothing but the ledger - never edits source, installs, or commits. Use when the user runs `review`, asks for a code review, security review, performance check, or test-quality pass, or before closing out an item."
---

# review - audit the code, and record what you find

**Writes:** `blueprint/context/findings.md`

Where this sits:

    `build` -> review -> repairs -> review again -> `ship`

> **Multi-part project:** `blueprint/project-plan.md` and
> `blueprint/context/quality-bar.md` (the bar the whole product is held to -
> `architect` writes it at the root, not per part) live at the **product
> root**, not this part. Resolve it from `AGENTS.md`'s `Product root:` field.
> Everything else here is this part's own.

`verify` proves the *behavior* matches the spec. This checks the *code*:
whether it is safe, consistent, and worth building on.

It changes nothing except blueprint/context/findings.md. It never edits source, installs a
dependency, commits, merges, or starts product work.

## What this is not

**`progress`** answers *where am I and what is next* from plan and git state, in
seconds, without reading the code. **`preflight`** asks whether the whole project
is fit to be live - backups, configuration, operations, documentation - and
returns a go or no-go.

This skill asks one thing: **is the code sound.** `review full` audits every
source file and is still not a launch check, because a project can have
faultless code and no backups.

## Before you start

**The standards are two files** - `blueprint/context/fundamentals.md` (the
pack's) and `blueprint/context/coding-standards.md` (this project's). Audit
against both, and **where they disagree the project's own file wins**: it
describes a real project and the other describes every project.

**Follow the standards file out to what it points at.** Where it names a tool as
the authority for a rule, the tool's config is the standard - check against that,
not against a prose paraphrase, and do not report a rule as unrecorded because it
is recorded somewhere the file deliberately did not copy. Same for a
`CONTRIBUTING.md` or style guide it references.

**If `coding-standards.md` is still unfilled prompts, say so before reporting.**
The fundamentals are always checkable, but the quality lens also checks drift
from *this project's* recorded conventions, and there is nothing to drift from -
so a clean result there means "not checked", not "consistent".

**Check "Standards this project follows" specifically.** It is what Step 3 audits
security and accessibility against, and an empty one means those lenses can report
generic smells and nothing checkable. Say that rather than letting a short finding
list read as a clean bill.

Same for the accessibility lens against a missing `blueprint/context/design.md`,
and the performance and security lenses against a missing
`blueprint/context/quality-bar.md`, which `architect` writes.

Report that as an unverified area in the summary rather than letting silence read
as a pass.

## Input

Scope and lens are separate controls, and either can be omitted.

**Scope** - what to look at:

| Argument | Reviews |
|---|---|
| *(none)* | the current work if there is any, else local changes, else everything |
| `current` | the active spec, the branch's commits from its merge base, and uncommitted work |
| `changed` | staged, unstaged, and untracked source files, plus nearby code |
| `full` | all project-owned source, tests, and config |
| a path | that area, plus the tests and callers needed to understand it |

**Lens** - what to look for: `quality`, `security`, `performance`, `tests`,
`accessibility`, `dependencies`, or all of them when unspecified. Multiple lenses review their union and report each
separately.

`full` is a scope, never a lens. If the scope is ambiguous, take the smallest
useful one and say which you took.

## Step 1 - gather context

Read the project's state before acting:

- `blueprint/context/project-overview.md` - the source of truth for what this project is
- `blueprint/context/coding-standards.md` - the conventions this project's code follows
- `blueprint/context/current-work.md` - the one item in flight, if any
- `blueprint/context/findings.md` - open review findings against the current work

Also read `blueprint/build-plan.md` when ordering matters, the branch and working-tree
state, and the source files in scope.

For `current`, resolve the comparison base **without network access**: a base
branch named by the spec, else the recorded remote default, else a local `main`
or `master`. Find the merge base, inspect the committed delta through `HEAD`,
then add staged, unstaged, and untracked work. Never fetch or pull to find a
base. If no reliable base exists, say so and review the spec plus local changes -
and never claim the committed work was fully covered.

For `full`, state the excluded paths before starting, so generated code,
dependencies, and build output do not consume the review.

## Step 2 - run the signals that already exist

Use the project's existing commands. **Do not install tools.** Run only what the
chosen lens needs: lint and typecheck where relevant, the test command for the
tests lens, the build when the lens needs compiled evidence.

A useful check the project does not have is a **gap to report**, not a reason to
add one.

## Step 3 - review the code

Ground every finding in reachable code and in this project's own expectations,
not in generic advice. Apply only the selected lenses.

**Audit against the standards this project actually recorded**, listed under
"Standards this project follows" in `blueprint/context/coding-standards.md` -
typically OWASP Top 10:2025 for web security, OWASP MASVS for mobile, WCAG 2.2 AA for
accessibility. **Name the edition, not just the standard** - OWASP renumbered in
2025 and added two categories (A03 Software Supply Chain Failures, A10
Mishandling of Exceptional Conditions), so a finding cited from a remembered 2021
list is checking the wrong bar and misses both. **Name the source on every
finding it applies to**: "OWASP Top 10:2025 A01,
broken access control" is checkable and arguable; "this seems insecure" is
neither.

Two limits on that. **An unrecorded standard is not a finding** - a personal tool
and a payment system need different bars, and imposing the stricter one produces
noise that trains people to ignore findings. And **never claim compliance**: this
checks against a standard, it certifies nothing. "Nothing found against the
recorded bar" is the strongest true statement available.

The lenses:

- **Quality** - duplicated logic, dead code, unreachable paths, oversized
  modules, abstractions that do not pay for themselves, a missing abstraction
  that is causing real repetition, drift from blueprint/context/coding-standards.md.
- **Security** - judged against the posture in `blueprint/context/quality-bar.md`
  where it exists: what this handles, and what that obliges. Missing
  authentication or authorization, ownership taken from
  client-supplied input, injection, unsafe parsing, exposed sensitive data,
  secret handling, insecure defaults, trust-boundary mistakes.
- **Performance** - repeated queries in a loop, redundant network work,
  unnecessary re-rendering, blocking work on a hot path, unbounded collections,
  missing pagination, oversized payloads. Mark anything without runtime evidence
  as a hypothesis, not a confirmed finding.
  **Check against `blueprint/context/quality-bar.md` where it exists.** A pattern
  that misses the project's recorded number is a finding with a severity; the same
  pattern in a project whose bar says "one user, a few hundred rows" is usually
  not a finding at all. Without that file this lens can only report generic
  smells, never a breach of what the project promised - say so rather than
  implying the bar was met.
- **Tests** - important logic with no coverage while a runner exists, assertions
  that cannot fail, tests that only restate the implementation, excessive
  mocking, shared state, order dependence, skipped or focused tests, swallowed
  failures. Never invent a coverage percentage.

- **Accessibility** - for anything with a UI, against WCAG 2.2 level AA.
  **Every check below is about a rendered page, not a parsed one.** Contrast
  between two tokens is arithmetic and can be computed from the stylesheet; focus
  visibility, keyboard reach and "is this actually on screen" cannot. An element
  can satisfy every attribute this lens looks for and be invisible - correct
  `aria-label`, correct role, correct contrast, zero pixels tall. **If the page
  has not been rendered, say the lens is unverified rather than reporting it
  clean.** Checks:
  everything reachable and operable by keyboard, focus visible and never trapped,
  contrast sufficient, every control labelled, images given text alternatives,
  motion respecting a reduced-motion preference, and errors identified in text
  rather than by colour alone. Applies to web, PWA, and mobile. Skip it honestly
  when the project has no UI.

  **If this item revised `design.md`, check the revision too** - that the record
  now matches what was built, and that the reason is written down rather than the
  value simply being different. A record edited to match the code without saying
  why is how a bar quietly lowers itself.

  **Check against `blueprint/context/design.md` where it exists**, not only the
  generic standard: it records the contrast values this project actually measured
  and the states it settled. A feature that invents a fourth kind of error
  message is drift worth reporting even when each version is individually fine.
- **Dependencies** - versions far enough behind that it matters, packages with
  known advisories, a lockfile that disagrees with the manifest, licences
  incompatible with how the project is distributed, and anything unused still
  being installed. **Report; never upgrade.** A major bump is feature-sized work
  that goes through `spec` and `build` like any other change - not a chore
  slipped into an unrelated diff.

Do not nitpick harmless style differences unless they signal real drift. **A
short list of real findings beats a long list of guesses.**

Do not broaden a focused pass because another lens looks interesting, and do not
imply the omitted lenses passed. If an obvious P0 turns up outside the selected
lens, record it as an out-of-lens critical risk - then stop searching that lens.

**Never quote a secret.** If one is found, report the category, file, line, risk,
and remediation, with the value redacted. Redact command output too.

## Step 4 - update the ledger

`blueprint/context/findings.md` is the durable record. A chat report does not survive a context
clear; the ledger does. It is the only file this skill writes. Create it with a
`# Findings` heading if it is missing.

**The ledger never scopes the review.** Review the code fresh in Step 3, then
record what you found. Working from the open findings as a checklist and
verifying only those is the exact failure this file exists to prevent - a repair
can introduce a defect no existing entry points at.

One block per finding. The header line is a machine-readable contract and keeps
this exact shape; the prose below it is for people:

    ### F-03 [P0] open - Session cookie is readable from JavaScript

    **File:** src/auth/session.ts:41
    **Found:** 2026-08-31 by review (scope: current; lens: security)
    **Why it matters:** ...
    **Suggested fix:** ...
    **Resolution:**

IDs are sequential within the ledger, never reused and never renumbered while
their entries live there - not even after one closes. A bare ID is scoped to the
live ledger; `ship` archives resolved entries under the work item's
prefix, and that prefixed form is the permanent reference.

**Severity:**

- `P0` - data loss, a security break, or code that cannot ship
- `P1` - a likely bug, a broken contract, a missing guard
- `P2` - a maintainability problem worth fixing before the item closes
- `P3` - a small cleanup or a follow-up candidate

Use P0 or P1 only when a concrete code path, a violated boundary, or a failing
command confirms it. Incomplete evidence goes under **Unverified risks**, not
into a confirmed high severity.

**Status:**

| Status | Meaning | Blocks the merge (P0/P1) |
|---|---|---|
| `unverified` | Suspected, no confirming evidence yet | No |
| `open` | Confirmed, not repaired | **Yes** |
| `fixed` | Repaired, not yet re-reviewed | **Yes** |
| `closed` | Repaired, and re-checked by something other than what repaired it | No |
| `deferred` | Not now, by the user's explicit decision, **naming the skill or milestone that will do it** | No |
| `accepted` | Not fixing, by the user's explicit decision, reason recorded | No |
| `invalid` | Re-examination proved it wrong, evidence recorded | No |

`fixed` blocking is deliberate. A repair is not done when the change lands; it is
done when something other than what made it has looked at the result.

- **A code finding:** `build` marks the repair `fixed`; only a pass of this skill
  moves it to `closed`.
- **A finding no code fixes** - no backups, a leaked secret, a missing README,
  raised by `preflight` or `host`: the skill that does the repair (`host`,
  `deploy`, `docs`, `ci`, ...) marks it `fixed` with its evidence in
  **Resolution**, and **the auditor closes it** - `preflight`, on a re-run that
  re-checks the evidence. This skill does not close those; there is no code for it
  to re-examine.

Then:

- Append each new confirmed finding as `open`, with the next sequential ID.
- Record a risk worth tracking but unproven as `unverified`. It is a lead, and
  never gates a merge.
- Update entries this pass re-examined, noting the evidence in **Resolution**.
- Move `fixed` to `closed` only when all three hold: this pass's reviewed set
  included the file, re-examining the repaired code confirmed the defect is gone
  *and* introduced nothing new, and the report names it as closed. An unrelated
  new problem in the same file gets its own entry. **Never close implicitly.**
- Set `accepted` only on the user's explicit decision in this conversation, with
  their reason. Never accept one on their behalf.
- Set `deferred` the same way, and **only with a target**: a `Deferred to:`
  line naming the skill or milestone that will do the work. It is not
  `accepted` - the difference is whether the work is going to happen - and
  `accepted` was doing both jobs, which reads downstream as abandoned. A
  `deferred` finding stays in the ledger through `ship`, because the skill
  named in it has not run yet.
- Set `invalid` only when re-examination shows the finding was wrong, with the
  evidence recorded. It is a review verdict, never a shortcut past a blocked
  merge.

## Step 5 - report

Lead with the findings, most severe first, using the IDs the ledger assigned.
Then state:

- ledger changes this pass, by ID: added, updated, closed
- commands run, and what they said
- the scope and lens used
- for `current`: the base branch and commit range
- what was reviewed, and what was excluded
- checks that were unavailable
- a suggested repair order

If there are no findings, say so plainly for the selected lens, and name any
remaining risk or missing signal - "no test command declared", "the browser flow
was not exercised".

For `full`, say whether coverage was complete or partial. **Never call a partial
review a full-project audit.**

**Then say what comes next**, and it depends on what was found: **open P0 or
P1** goes back to `build` for repair, and `ship` will refuse the merge until it
is resolved. **Nothing blocking** means the item is ready for `ship`. Say which
of the two it is rather than leaving the report to be interpreted - a findings
list with no verdict reads as approval.

## Rules

- **The ledger is the only file this skill writes.** Never edit, format, install,
  commit, or delete anything else.
- **A focused lens is not a broad audit.** State what was not reviewed.
- **The ledger reports status; it never defines what to look at.**
- **Never reproduce a secret** in a finding or in pasted output.
- **Ground every finding in a path and line** where possible.
- **Recommend the smallest fix that removes the risk.** Avoid speculative
  rewrites, and respect existing patterns over generic advice.
- **The goal is not perfection.** It is code that is understandable, consistent,
  tested where it matters, and safe to keep building on.

## Formatting

Match `blueprint/context/ai-interaction.md` when it exists; otherwise keep output short, scannable, and direct.
