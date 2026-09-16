---
name: autopilot
description: "Explicit opt-in only. Runs a named range of the workflow unattended - `autopilot architect..review` carries a planned idea to reviewed code, `autopilot spec..review` is one bounded pass on the current spec. Stops at the first question the plan does not answer, checkpoints every passing step, and ends with a review packet. Permanently blocked from anything git cannot undo: provisioning, production deploys, migrating real data, third-party accounts, and pushing. Use only when the user explicitly runs `autopilot`."
---

# autopilot - one bounded pass, then stop

**Writes:** `blueprint/status/`

Where this sits:

    `progress` -> autopilot -> human review -> `ship`

This runs the loop's middle without pausing at every gate. It exists for work
that is genuinely routine, when the user has decided the per-step review is not
worth its cost **this time**.

**Only ever run this when the user explicitly invoked it.** Never choose it as a
faster route through ordinary work, and never suggest it to skip a gate someone
is waiting at. The gates are the product; this is a deliberate, scoped exception
to them.


> **Multi-part project:** `blueprint/project-plan.md` and
> `blueprint/context/quality-bar.md` (the bar the whole product is held to -
> `architect` writes it at the root, not per part) live at the **product
> root**, not this part. Resolve it from `AGENTS.md`'s `Product root:` field.
> Everything else here is this part's own.

## Before you start

This is the only skill here that writes code without stopping for approval, so
its gate is Step 1's preflight rather than a short check - **it scales with the
range and any genuine miss stops the run before it begins.** Do not shorten it
because the range is small.

**If the user has not explicitly asked for `autopilot`, stop.** Arriving here from
another skill's handoff, or because a range looked convenient, is not opt-in.

## Input - the range it runs

    autopilot <from>..<to>

Named skills, inclusive. `autopilot architect..review` takes an idea that is
already written into the plan and carries it to reviewed code.

**Say which end a range starts at and what that assumes** - `stack..review` and
`architect..review` are both legitimate but not the same range, now that
`architect` runs before `stack`: the former starts *after* the system is
shaped, the latter carries an idea from the plan to code. With no range, it
runs `spec..review` on the current spec - the original bounded pass.

**A range resolves against the workflow's order**, which is:

    architect -> stack -> layout -> scaffold -> ci -> context -> prototype -> spec
          -> build -> verify -> review -> ship

So `stack..context` runs five skills, and `architect` comes **before** `stack`
because a technology is chosen against a shape, not the other way round.

**Where the range may start:** `architect`, `stack`, `layout`, `scaffold`,
`context`, `prototype`, `spec`, or **`build`**.

**`build` is a legal start, and it is the one people actually reach for.** It is
what a half-built item needs: `spec` has run, some steps are ticked, and the
remaining ones are mechanical enough not to want a stop each. **Resume from the
first unchecked step** in `blueprint/context/current-work.md` - never restart the
item, and never re-do a ticked step.

**`spec..review` cannot pick up a half-built item** - `spec` stops when
`current-work.md` holds an unfinished spec, correctly, since overwriting it
destroys the ticked steps. Starting at `build` is the only way back in.

**Two things are required to start here** rather than at `spec`:

- **`current-work.md` holds a real spec**, not the stub. There is nothing to
  build from otherwise, and this skill does not write one.
- **The branch already exists**, from the earlier `build`. Check it out; do not
  create a second one.

**Where it may end:** any of those, plus `verify`, `review`, and - opting in
explicitly - `ship`.

**`ideate` is never in range.** It is an interview about what to build and who for,
and there is no correct answer to invent when nobody is there to give one. Write
the plan first; autopilot starts once there is something to build *from*.

## The line, and why it is where it is

Three actions are **blocked in every range, permanently, regardless of what is
asked mid-run**. They are not blocked out of caution - they share one property:

**git cannot undo them.**

- **`host`** - provisions infrastructure and **spends money**. A wrong choice at
  3am is a bill and an account someone has to unpick.
- **`deploy` to production** - puts code in front of real people. Reverting is a
  second deploy, not a revert, and whatever happened in between already happened.
- **`migrate` against real data** - a dropped column comes back from a backup or
  it does not come back. Against a development database it is trivial; the
  environment is what makes it irreversible, not the skill.
- **`monitor`** - creates third-party accounts and sends data outward.

Everything permitted above is recoverable: `git reset`, `git checkout`, delete
the branch, delete the directory. **That is the whole test.** If the only way to
undo a step is a backup, an invoice, or an apology, it does not run unattended.

`ship` sits on the line and is therefore opt-in. Merging to `main` is recoverable
with git, so it is allowed - but only when named explicitly in the range, never
by default, and never with a push.

## The weakness worth knowing before you use it

**A long run reviews its own work.** `review` is in range, which means autopilot
writes code, then audits the code it wrote, then repairs its own findings. The
findings ledger exists precisely because a repair should be re-examined by
something other than whatever made it - and here it is the same agent in the
same run.

That is a real weakness, not a theoretical one. It does not make the range
useless: `review` still catches missing tests, unhandled errors, and drift from
the standards, because those are checkable facts rather than judgment. But it is
**much weaker at catching a wrong assumption**, because the same assumption
produced both the code and the review.

So: **a long autopilot run is a draft, not a finished piece of work.** The review
packet at the end is the thing a person reads before anything ships. Treat a
clean autopilot review the way you would treat a colleague marking their own
homework - useful, not conclusive.

## What it will not do

Non-negotiable, regardless of what is asked mid-run:

- **Never `host`, `monitor`, deploy to production, or migrate real data.** See
  the line above.
- **Never change the contract in a multi-part project.** If a run concludes it
  needs a new field, that is a decision affecting every other part: **stop and
  report**. It fails the same test as the rest - git can undo the edit, but it
  cannot undo three parts having built against different assumptions meanwhile.
- **Never push, force-push, rewrite history, or delete data.**
- **Never `ship` unless `ship` was named in the range**, and never push after it.
- **Never act on a rollback spec.** Reversing shipped work needs the dependency
  gates in `rollback` and the guards in `build`. If
  `blueprint/context/current-work.md` is `Type: Rollback`, stop and say so.
- **Never widen its own range.** New work discovered along the way is reported,
  never built.
- **Never mark its own repairs `closed`.** Only a later `review` does that, and
  in a single run that review is itself - so findings it repaired stay `fixed`
  and a person closes them.

## Step 1 - preflight

**Check only what the run needs but will not produce itself.** This is the rule
that makes a long range possible at all: an `architect..review` run has no overview
and no verification command when it starts, because `context` and `scaffold` are
the steps that create them. Demanding them up front blocks the exact range the
input syntax exists to allow.

So for every precondition: **if a skill in the range produces it, do not require
it - require it only of the steps that come before the range starts.**

**Any genuine miss stops the run before it begins** - report what is missing and
what would supply it.

**In a multi-part project, read the board first** - `orchestrate` maintains it at
the product root, and **in a git worktree, resolve it under the main checkout**
(`orchestrate` gives the command) - and **each of these is a stop**:

- **the contract is frozen - unless this part owns it** (`Owner:` under *The
  contract* in the product root's `AGENTS.md`). Building against an unfrozen
  contract with nobody watching is the exact failure the freeze exists to
  prevent; but **the owner builds first**, because its contract-defining items
  are what there is to freeze. Only consuming parts wait.
- **this part is not blocked.** The board says so; starting anyway produces work
  that gets thrown away.
- **the review queue has room** - **two waiting packets across the product and
  this refuses to start.** Unattended work must not outrun the ability to read
  it, and three parts each producing a self-reviewed draft at once is the weakest
  state this system can be in.

Then claim this part by writing `<product root>/blueprint/status/<this part>.md` - relative to
`AGENTS.md`'s `Product root:`, not this part's own `blueprint/`:

    **State:** building
    **Item:** <the item this run is working>
    **Blocked on:** -
    **Review packet:** -
    **Updated:** <today>

**On finishing *or stopping early*, record which.** A status file still reading
`building` after a run has stopped looks like progress and is worse than no board
at all.

**And record *why* it stopped, in the field built for it.** A run that stops
because it needs another part writes:

    **State:** blocked
    **Item:** <the item this run is working>
    **Blocked on:** <part> - <what is needed>
    **Review packet:** -
    **Updated:** <today>

anything else that stops early writes `State: stopped`. This matters more here
than anywhere else in the workflow: **nobody watched this run.** The status file
is the only account of it that survives, and `orchestrate` finds deadlock, blocks
with no owner, and stale blocks by reading `Blocked on:` across the parts. An
unattended run that stops for a cross-part reason and does not write it leaves
the coordinator no way to know - it sees a part that simply went quiet.

**Always:**

- the range is valid, and every skill in it is permitted
- no unrelated uncommitted changes - an unattended run must be able to tell its
  own work from someone else's
- **a step marked `_(built, awaiting approval)_` is this item's work, and the
  user's to approve.** Its uncommitted files are not unrelated - but ticking it is
  the approval `build` was waiting for, so **ask once, before the run starts**:
  accept it as built, or rebuild it. Never tick it silently; a run that did made
  the right call only because the same session remembered the step.
- on a branch, not `main` - **only when `build` is not in the range.** If it is,
  `build`'s Step 2 creates the branch from the spec, and requiring one first is
  circular: `ship` deletes the branch when it merges, so a clean `main` is the
  normal state between items and exactly where `autopilot spec..review` is meant
  to start. Refusing there makes the documented usage unreachable.
- `blueprint/project-plan.md` filled in, not placeholder text
- no P0 or P1 finding already open

**If the range starts at or before `spec`:**

- the plan has at least one unchecked item, or a specific one was named
- the overview exists and is newer than the plans - **only when `context` is not
  in the range.** If it is, the run regenerates it, and requiring it first is
  circular.

**If the range includes `scaffold`:**

- every part's toolchain is installed - it cannot install an SDK
- **explicit approval to install from the network.** This is the one permitted
  step that pulls hundreds of megabytes and writes across the tree. Recoverable
  by deleting a directory, but not something to discover afterwards.

**If the range includes `build` or later:**

- a verification command is known and **passes right now** - **only when
  `scaffold` is not in the range.** If it is, there is no project yet to verify;
  the run creates the command, and it must pass **before the first `build` step**
  instead. That is the same guarantee, checked at the point it can be.

  When the check does apply, it matters: starting from a red baseline makes every
  later failure ambiguous.

**If the range includes `ship`:**

- `ship` was named explicitly in the range
- the working tree is otherwise clean and `main` has no divergence to resolve

## Step 2 - set the budget, and say it out loud

An unattended run needs a stopping point that is not "when it finishes".
Before starting, state:

- **how many items** it may take - default **one**. A range ending at `review`
  means one item spec'd, built, verified, reviewed. It does not mean the whole
  build plan.
- **the checkpoint policy** - a commit after every passing step, always. Long
  runs are only recoverable if there is something to rewind to.

## Step 3 - run the pass

Work the spec's build steps in order, following `build`'s rules -
smallest change per step, the verification command after each, tick the step off
when it passes. The difference is that it does not stop for approval between
steps.

Make a checkpoint commit after each passing step. They are the run's rollback
points, and the reason an unattended pass is recoverable.

**Stop the run immediately** if any of these happen, and report where it stopped:

- **a step produces an empty diff** - it did nothing, and a passing verification
  command says nothing about that. Unattended, this is the failure most likely to
  go unnoticed, because every signal looks green.
- a step fails twice in a row
- a step would touch something the spec does not cover
- the verification command fails and the cause is not obvious
- **anything requires a decision the plan does not already answer** - and over a
  long range this is the common one, not the rare one. A stack with no stated
  constraint, an ambiguous feature line, a choice between two reasonable data
  shapes. **Guessing is the failure mode.** Stop and ask.
- a finding appears that the range has no authority to repair
- **`architect` concludes the project is more than one part.** That is a
  conversion of the whole repository - every file moves, a board and status files
  appear, and each part is scaffolded separately afterwards. It is git-recoverable
  and still not autopilot's call: it changes what the project *is*, and every
  skill after it in range - `stack`, `layout`, `scaffold` - would otherwise be
  answering for a project of a different shape.
  Report the recommendation and stop.
- the budget from Step 1b is reached

Stopping early is the correct outcome in every one of those, not a failed run.
**A run that stops at the first real question has done its job.**

**Mark where the stop leaves the step.** A step stopped with its code in the
working tree gets `_(partly built, stopped: <reason>)_` after its bold title in
`blueprint/context/current-work.md`, so the next run - this skill or `build` -
knows those files are the step's own. Without it, re-running this range meets an
unchecked step with its files already present: the same state it would refuse
from anyone else.

## Step 4 - verify and review

Run `verify` against the spec's done-whens, then `review` scoped
to the code this run changed.

Repair confirmed **P0 and P1** findings that fall inside the spec's scope, as
extra steps through the same loop, and mark each `fixed`. Then re-run
`review` so the repairs can be assessed. Leave P2 and P3 findings, and
anything outside scope, recorded and untouched.

## Step 5 - stop with a review packet

Stop. Report:

- the branch, and every checkpoint commit made
- what changed, grouped by area
- every check run, and its result
- findings: raised, repaired, still open, by ID and severity
- anything discovered but deliberately not built
- where it stopped early, if it did, and why
- **every decision it made that the plan did not already answer** - listed
  separately, because over a long range these are the things most likely to be
  wrong and least likely to be noticed in a diff
- the next action

**In a multi-part project, post the packet** in
`<product root>/blueprint/status/<this part>.md` - resolved as in Step 1, from
`AGENTS.md`'s `Product root:` and under the main checkout in a git worktree -
exactly as `build` does:

    **State:** waiting
    **Item:** <the item this run worked>
    **Blocked on:** -
    **Review packet:** <where to read it>
    **Updated:** <today>

A run that stopped early and was recorded as `blocked` or `stopped` keeps that
state, and still fills `Review packet:` if it committed anything - that work is
unread too. **A finished run left at `building` with no packet is invisible to the
review cap** - it is the count that stops a third unattended run, and a packet
that lives only in this report counts as zero.

**Say plainly that nothing has been merged, pushed, or deployed**, and that the
work needs a real read before it ships - an unattended pass has had no human eyes
on the diffs, and this packet is where those eyes go. **The longer the range, the
more true that is**: a run from `architect` produced a system design, a stack
choice, a layout, a spec, code, and a review of its own code, and a person has
seen none of it.

## Formatting

Match `blueprint/context/ai-interaction.md` when it exists; otherwise keep output short, scannable, and direct.
