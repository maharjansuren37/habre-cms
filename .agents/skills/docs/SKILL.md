---
name: docs
description: "Write and maintain the documentation a project actually needs: a real README, API docs where there is an API, and dev-notes - the decision record explaining why the project is shaped this way, the status file for picking it up cold, and the hand-run equivalent of every automated command. With --check, audits what is already written against what is actually true and reports the rot read-only, changing nothing - a question nothing else in this workflow asks. Use when the user runs `docs`, wants to know whether the documentation is still accurate, when the README is still boilerplate, after a decision worth recording, or when preflight flags documentation as a blocker."
---

# docs - write down what the code cannot say

**Writes:** `dev-notes/decisions.md` · `dev-notes/status.md` · `CHANGELOG.md` · `blueprint/context/findings.md` · `blueprint/findings/`

Where this sits:

    any point in the loop -> docs -> the record survives the session

    `ship` (a release) -> docs -> `CHANGELOG.md`

Two audiences, and they need different things:

- **People using or running it** - the README, and API docs if there is an API.
- **Whoever picks this up later, including you after a break** - `dev-notes/`.

The second is the one that gets skipped, and it is the one that saves the most
time. Code shows *what*; only a written record shows **why**, and why is what you
lose first.

> **Multi-part project:** `blueprint/project-plan.md` and
> `blueprint/context/quality-bar.md` (the bar the whole product is held to -
> `architect` writes it at the root, not per part) live at the **product
> root** - a part has no `project-plan.md` of its own, so an unqualified read
> finds nothing. Resolve the root from `AGENTS.md`'s `Product root:` field.
> Everything else here is this part's own.

## Input

| Argument | Mode | Writes |
|---|---|---|
| *(none)* | write and update what the project needs | the docs |
| `--check` | **audit what is already written against what is true** | nothing |

`--check` is read-only. It answers a different question from the rest of this
skill: not "is anything missing" but **"is what is written still true"** - which
nothing else in this workflow asks. `preflight` checks a README exists and is not
a placeholder; it does not open it and test its claims.

## Step 1 - see what is actually there

Read the README, `dev-notes/`, `blueprint/project-plan.md`, the decisions already recorded, and the
recent commits. Identify:

- a README that is **still the scaffolder's default** - the most common finding,
  and a `preflight` blocker
- decisions visible in the code with no record of why
- reasoning **buried in the wrong file** - a plan section explaining a trade-off
  is decision-record material in the wrong place
- automated commands with no hand-run equivalent written down

## Step 2 - the README

For someone who has never seen this project:

- **what it is**, in a sentence or two, and who it is for
- **how to run it** - the real commands, copied from `AGENTS.md`, including
  prerequisites and environment setup
- **how to build and test it**
- **how it is deployed**, or that it is not yet
- **how the project is organised** - enough to find things, and **point a
  newcomer at `AGENTS.md`**. It is the orientation for anyone joining, not only
  for tools, and the README is the only place a person is ever told that. The
  template ships with that pointer; rewriting the README without it silently
  removes the one signpost a human has.

Keep it short. A README nobody finishes is a README nobody reads. Detail belongs
in `dev-notes/` or in the code.

## Step 3 - `dev-notes/decisions.md`

One numbered entry per decision, in the format the file describes. Record a
decision when:

- there was a real alternative, and something was chosen over it
- the choice constrains what can be done later
- someone would otherwise reasonably ask "why is it like this?"

Each entry says **what was chosen, what lost, and what the choice costs.** The
cost line is the one that matters - every real decision has one, and writing it
down is what stops it being a surprise later.

**Numbers are permanent, and a superseded entry is marked rather than deleted.**
The reasoning stays useful even when the conclusion stops being true, and knowing
what was already tried and rejected saves the next person from re-treading it.

`stack` and `architect` add entries as they go. This skill catches what they
missed, and moves reasoning that ended up in the wrong file.

## Step 4 - `dev-notes/status.md`

Written to be read **first**, after a break or a cleared context:

- **where this stands** - what works, what is in progress
- **verified** - what has actually been proven, and how. Not what should work.
- **open** - known gaps, untested paths, deliberate deferrals. **Be complete
  here.** This section only earns its keep if it is honest.
- **running it by hand** - see below
- **recommendations** - judgment rather than fact, kept separate on purpose

For the live view - ticked steps, git state, drift - `progress` is better. This
file is the slower-moving picture.

## Step 5 - how to run it by hand

**Every automated path gets its hand-run equivalent written down**: the real
commands behind the verification command, how to build and run without the
scripts, how to do by hand what CI does on push, how to deploy manually if the
pipeline is broken.

**Anything that exists only as automation is one broken pipeline away from nobody
knowing how to do it.** This section is the insurance, and it is cheap to write
while the knowledge is fresh.

## Step 6 - API docs, where there is an API

Only for an interface someone else calls. For each endpoint: what it does, what
it takes, what it returns, what it errors with, and whether it needs auth.

Generate from the code where the project has a tool for it - **hand-written API
docs go stale**, and stale docs are worse than none because they are believed.

## Step 7 - release notes, once there are users

Only for a project that is deployed and that someone other than you runs. The
first two audiences here are people running it and people maintaining it; this is
the third - **people who already use it and want to know what changed.**

**Derive them, do not recall them.** `ship` archives every completed item under
`blueprint/history/` - `features/`, `fixes/`, `rollbacks/` - and `deploy` records
the commit of each release in `dev-notes/status.md`. So the material is already
written down: take everything archived since the previously released commit. A
changelog assembled from memory misses exactly the small fixes nobody remembers
shipping.

Write `CHANGELOG.md` at the project root, newest first, one section per release:

- **What changed, in the user's words, not the commit's.** "Search now matches
  partial names" - not "refactor query builder". If an entry cannot be phrased as
  something a user would notice, it probably belongs in `dev-notes/`, not here.
- **Anything that breaks or requires action** first and marked plainly - a
  changed URL, a setting that must be set, a migration that runs on start.
- **Fixes grouped and brief.** A user needs to know the thing they hit is gone,
  not how.
- **Nothing internal.** Refactors, dependency bumps and test changes belong in
  the git log.

**A release with nothing user-visible gets an honest one-line entry**, not a
padded list. Inflating a maintenance release trains people to stop reading the
notes, which costs you the one time it matters.

## `--check` - audit what is written against what is true

Read-only. Report; change nothing. Documentation rots silently: **nothing fails
when a README goes out of date**, which is why it needs a deliberate pass.

Work through these in order. The first is worth more than the rest combined:

1. **Run the commands the README gives.** Every one, as written, in a clean
   checkout if you can. **A README with commands nobody has tried is the standard
   failure**, and it is the one that greets a new person first. A command that
   needs a flag the README omits is as wrong as one that does not exist.
2. **Check every factual claim against the thing it describes.** Version numbers
   against the lockfile, file paths against the tree, counts against what is
   there, ports and URLs against the config. Claims about *quantity* rot fastest -
   "three scripts", "the four guides" - because nothing breaks when the number
   changes.
3. **Follow every link.** Internal ones must resolve to a file that exists;
   external ones are the user's to judge, but say which are unreachable.
4. **Look for what is described but no longer exists** - a directory that moved, a
   command that was renamed, a step for a tool the project stopped using. And the
   reverse: something significant the docs never mention.
5. **Check the docs against each other.** Two files describing the same thing
   differently is worse than one describing it badly, because the reader cannot
   tell which is current.
6. **Read `dev-notes/status.md` last, and hardest.** It is the first thing anyone
   reads after a break, so a stale line there misleads for longer than one
   anywhere else - and it is the file most likely to still describe the project as
   it was when someone last had time to update it.

**Report findings, do not fix them in this mode.** Then say plainly whether the
documentation can be trusted, because "mostly current" is what people assume by
default and it is usually wrong.

## Step 8 - report

What you wrote, what you moved, and what is still missing. Documentation gaps are
worth naming even when you did not fill them.

**When this skill repairs a finding** - a `preflight` blocker such as a scaffold-default README or absent dev-notes - **set it to `fixed`** in `blueprint/context/findings.md`, with the evidence in the **Resolution** line of its entry, `blueprint/findings/<ID>.md`: the README now says how to run the project, checked by following it. **Never `closed`**: `preflight` re-checks it and closes it, because a repair is examined by something other than what made it. Left `open`, it blocks every later `ship` in this part.

## Rules

- **Never document what is not true.** A README describing an intended state is
  actively harmful. Describe what the project does today.
- **Never invent a reason.** If why is not known, ask, or record that it is
  unknown - a guessed rationale is worse than an admitted gap.
- **Never put a secret in documentation**, including an example that looks real.
- **Keep judgment separate from fact.** Recommendations are labelled as such.
- **Short and true beats thorough and stale.**

## Formatting

Match `blueprint/context/ai-interaction.md` when it exists; otherwise keep output short, scannable, and direct.
