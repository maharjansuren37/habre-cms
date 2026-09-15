---
name: debug
description: "Reproduce and isolate a failing test, build, request, or behavior without editing product code, then hand the evidence to `spec` or `build` for the repair. Read-only with respect to the product: it investigates, narrows, and reports the root cause with proof. Use when the user runs `debug`, reports something broken or failing, or asks why something is not working."
---

# debug - find the cause before changing anything

**Writes:** nothing

Where this sits:

    something broken -> debug -> `spec` or `build` -> repair

Separating diagnosis from repair is the point. A change made while still guessing
at the cause fixes the symptom about half the time and hides it the rest.

**Most often this is reached mid-build**, not from a live incident: a step in
`build` that has failed twice, or a criterion in `verify` that fails for a reason
nobody can explain. It is equally reached from `deploy`, `monitor` and
`integrate` when something is already running.

This skill does not edit product code.

## Step 1 - reproduce it

Get the failure happening reliably before theorising. Establish:

- the exact command, URL, or interaction that triggers it
- the full error output, stack trace, or wrong result - verbatim, not summarised
- whether it is consistent or intermittent
- what changed recently: `blueprint/context/current-work.md`, the branch, `git status`, the
  recent log

**If you cannot reproduce it, say so and stop.** Ask for the exact steps, the
environment, or the input that produces it. A fix for a failure you never saw is
a guess.

## Step 2 - narrow it

Cut the search space in half at a time rather than reading everything:

- Find the last state where it worked - a commit, a config, an input - and diff
  against the broken one.
- Add temporary logging or run pieces in isolation to confirm where the data
  stops being right. Remove anything you added before finishing.
- Check the boring causes first: a stale build, a missing environment variable,
  a dependency version, a cache, the wrong branch checked out.

State each hypothesis before testing it, then say whether the result confirmed or
killed it. A hypothesis that survives because it was never tested is not
evidence.

## Step 3 - report the cause with proof

Report:

- **What happens** - the observable failure, with the exact output.
- **Why** - the root cause, pointed at a file and line.
- **How you know** - the evidence that confirms it, and what it rules out.
- **The smallest fix** that removes the cause - described, not applied.
- **Blast radius** - what else touches this code and might be affected.
- **Confidence** - and if it is not high, what would raise it.

Then hand off: `build` if there is already a spec covering this area, or
`spec` to spec the repair as a fix.

## Rules

- **Never edit product code here.** Temporary instrumentation is fine and gets
  removed before you finish; a fix does not.
- **Never report a cause you have not confirmed.** "The most likely explanation,
  unconfirmed" is honest and useful. A guess stated as a finding is neither.

**Evidence, or it didn't happen** - `AGENTS.md`'s rule applies here: name what
proves it, and "could not verify" beats a fabricated pass every time.

## Formatting

Match `blueprint/context/ai-interaction.md` when it exists; otherwise keep output short, scannable, and direct.
