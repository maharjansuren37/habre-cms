---
name: progress
description: "Read-only report on where the project stands and whether the workflow itself is healthy: build-plan progress, the current spec's ticked and unticked steps, open findings, git state, overview freshness, missing setup, drift from the loop, and the single next action to take. Writes nothing. Use when the user runs `progress`, asks where things stand or what is next, is picking work back up after a break or a context clear, or suspects something is set up wrong."
---

# progress - where things stand, and what to do next

**Writes:** nothing

Where this sits:

    any point in the loop -> progress -> the next skill it names

Read-only. This writes nothing, changes nothing, and runs nothing that could.

Its job is to answer two questions completely: **where are we**, and **what is
the single next thing to do**. It is the right first move after a context clear,
after a break, or when something feels off.


> **Multi-part project:** `blueprint/project-plan.md` and
> `blueprint/context/quality-bar.md` (the bar the whole product is held to -
> `architect` writes it at the root, not per part) live at the **product
> root**, not this part. Resolve it from `AGENTS.md`'s `Product root:` field.
> Everything else here is this part's own.

## Three skills answer "what is the state of this?" - this is the fast one

They are not interchangeable, and running the wrong one gives a confident answer
to a question you did not ask:

| | Answers | Cost | Writes |
|---|---|---|---|
| **`progress`** | *Where am I, what is next?* | seconds | nothing |
| **`review`** | *Is the code sound?* | minutes | the findings ledger |
| **`preflight`** | *Can this face real users?* | longer | findings, as blockers |

`progress` reads plan and git state. **It does not read the code**, so a green
progress report says nothing about whether the code is any good - that is
`review`. And it says nothing about whether the project is fit to be live, which
needs backups, config, and operations that only `preflight` looks at.

**Run this one constantly.** Run the other two deliberately.

**In a multi-part project this reports one part - the one you are in.** For the
view across parts, what is blocked, and what is safe to start next, that is
`orchestrate`.

**But read the board anyway and lead with it if this part is blocked or the
contract is not frozen and this part is not its owner** - in a git worktree,
resolve the board under the main checkout, as `orchestrate` says. Being told what is next in a part that must not start
is worse than being told nothing - and this is the skill people run first.

## Step 1 - read the state

Read the project's state before acting:

- `blueprint/context/project-overview.md` - the source of truth for what this project is
- `blueprint/context/coding-standards.md` - the conventions this project's code follows
- `blueprint/context/current-work.md` - the one item in flight, if any
- `blueprint/context/findings.md` - open review findings against the current work

Also read `blueprint/project-plan.md`, `blueprint/build-plan.md`, and the archives under
`blueprint/history`, plus the git branch, working-tree state, and recent log.

## Step 2 - work out where things are

- **Plan progress** - how many items are checked off, which is next, whether any
  parent item has unchecked sub-items.
- **Work in flight** - does `blueprint/context/current-work.md` hold a real spec or the stub?
  If real: which steps are ticked, which is next, and what its done-when is.
- **Findings** - anything `open` or `fixed`, by ID and severity. Call out
  explicitly whether any P0 or P1 would block `ship`.
- **Git** - the current branch, whether it matches the spec's expected branch
  name, uncommitted changes, and how it stands against `main`.
- **Freshness** - was `blueprint/context/project-overview.md` generated *after* the last edit to either
  planning doc? If not, it is stale and everything reading it is working from
  old information. **A timestamp cannot tell "regenerated" from "touched"** - a
  hand edit to the overview makes it look fresh while its content still predates
  the plans, and an overview `context` has never generated at all looks freshest
  of the three. So check the content agrees with the plans, not only the order of
  the dates, and where they disagree say the overview is stale regardless of what
  the timestamps claim.

## Step 3 - check the workflow itself is intact

Report only what is actually wrong:

- Missing required files, or a context file still holding its install stub.
- **Always-loaded context over its budget.** Add up the bytes of every file
  `CLAUDE.md` imports with `@`; `AGENTS.md` states the budget. Over it, name the
  three largest and what in each could move out - closed entries, history,
  detail a line and a link would carry. Every session pays for these files
  before the user types a word: a real project reached 160 KB this way, most of
  it closed findings and prose restating other files.
- No verification command, or no test runner, when the project has real code.
- **Drift from the loop.** The signals worth naming:
  - work committed directly to `main`
  - a spec with every step ticked that was never shipped
  - a branch whose spec was already archived
  - checked-off plan items with no archive under `blueprint/history` - **compare
    by name, never by count.** A big item split into sub-items at `spec` (3a, 3b)
    archives once per sub-item, so more archives than checked items is normal and
    is not an anomaly. Counting produces a confident false finding.
  - product code changed on a branch with no spec in `blueprint/context/current-work.md`
  - an overview older than the plans it was generated from
  - **a `prototypes/` directory still present** after the look was built - `ship`
    should have deleted it, and this is exactly the drift that went unnoticed for
    thirteen features in a real project
  - **the spec disagreeing with git**: steps ticked that no commit or working-tree
    change accounts for, or committed work no step claims. **Report the
    disagreement; never pick a side** - the files and the repository are both
    evidence, and only the user knows which is right

Drift is not automatically a problem - a deliberate shortcut is fine. Name it,
say what it implies, and let the user decide.

## Step 4 - report

Lead with the state, in a form that reads at a glance:

    Plan       4 of 11 items done, next up: 5. Tag filtering
    In flight  4c. Route protection - 2 of 4 steps done
    Branch     feature/route-protection, 3 uncommitted files
    Findings   F-07 [P1] open - would block ship
    Overview   stale: build-plan.md edited more recently
    Needs you  2 open, 1 blocking - see prepare

Then **one** clear next action. Not a menu - the single most useful thing to do
now, with the reason in a few words. If something is genuinely blocked, say what
is blocking it and what would unblock it.

**When the plan is finished, most of that block collapses to "nothing", and the
report has to say what comes next anyway.** No item in flight, no branch, a stub
current-work: that is a project between pieces of work, not a broken one, and the
useful answer is what would start the next one - add an item and `spec` it,
`preflight` before a release, `monitor` if it is live. Say the plan is complete
rather than reporting four empty lines and leaving the reader to work out whether
something is wrong.

**And say what the project already knows it might build next.** Two lists exist
and neither is read by anything else:

- **Section 11 of `blueprint/project-plan.md`**, what `ideate` deferred and when
  it should come back. *"Editing and deleting sessions - soon after"* is an
  answer to "what next", written by someone who had thought about it.
- **Open findings in `blueprint/context/findings.md`.** P2s and P3s carried
  across merges are specs half-written: three views accepting any HTTP method is
  one item, not three.
- **What production is behind by** - the item sections still in
  `blueprint/production-pending.md`: "production is N items behind, and needs"
  the open lines. Merged is not live, and this is the only report that says so.
- **The backlog, `blueprint/findings/backlog.md`** - the P3s `ship` moved out of
  the index. Give the count; at five or more, name `spec`'s tidy item as an
  option.

Name a couple of the most useful, with their recorded reasons. **A deferred item
nobody re-reads is a decision that quietly became a deletion**, and this is the
only step positioned to notice.

**Report both sides of the work, because they finish independently.** The agent's
side is visible here - items checked, spec steps ticked, findings closed, the
branch merged. The person's side is in `blueprint/context/needs-you.md`, and
**nothing closes a line there automatically**, so say how many are open and
whether any blocks the next step. A project can be complete on one side and
stalled on the other, and reporting only the half this skill can see is how that
gets missed. `prepare` is the full list.

**The next action is often the user's, and saying so is part of the answer.**
Adding a plan item, deciding a direction, or getting an account is theirs -
naming it without saying whose it is reads as something about to be done for
them. `prepare` reports everything else waiting on them.

## Rules

- **Read-only, absolutely.** Never edit, commit, or run anything with side
  effects. A status check that changes state is not a status check.
- **One next action**, not a list of options - and **say whose it is.** If it
  needs an account, a card, system software, a device or a decision, it is the
  user's, and naming it as the next action without saying so reads as something
  the agent is about to do. Route to `prepare` for the full list of what is
  waiting on them, read from `blueprint/context/needs-you.md`.
- **Report gaps and drift honestly.** This skill exists to surface the things
  nobody wanted to look at.
- **Be brief.** This gets run constantly, often mid-task.

## Formatting

Match `blueprint/context/ai-interaction.md` when it exists; otherwise keep output short, scannable, and direct.
