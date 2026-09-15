---
name: rollback
description: "Plan a safe reversal of a completed feature: find its archive and the exact commit that introduced it, review what has been built on top of it since, then write a guarded rollback spec to blueprint/context/current-work.md. Stops before any code changes. The reversal itself is applied by `build`, which reverses only the product diff and preserves the workflow's own history. Use when the user runs `rollback`, or asks to remove, undo, or revert a feature that was already completed and merged."
---

# rollback - plan the reversal before touching anything

**Writes:** `blueprint/context/current-work.md`

Where this sits:

    completed feature -> rollback -> `build` -> `ship`

Removing shipped work is riskier than adding it, because later work may quietly
depend on it. This skill does the whole dependency review **before** a line
changes, and writes a spec `build` can apply under guard.

It changes no code.

## Before you start

- **The feature is not actually shipped** - it is still on a branch, or still in
  `blueprint/context/current-work.md`. Say so: deleting the branch is the whole job, and none of
  this skill's dependency work applies.
- **Another item is in flight** in `blueprint/context/current-work.md` - stop.
  This skill writes a guarded spec of its own, and overwriting live work to
  remove old work is a bad trade.
- **This is a bad release rather than an unwanted feature** - that is `deploy`
  with a rollback, which restores the previous release now. This skill plans a
  considered reversal and is much slower. Say which one they mean - **and check
  before asking.** The Environments table in `AGENTS.md` and the plan's
  Deployment section answer it: a project that is not deployed anywhere cannot
  have a bad release, so the question has one available answer and asking it as
  though it were open wastes the user's time on a decision the files already
  made.

## Step 1 - identify the target exactly

Find the feature's archive under `blueprint/history/features` and, from it, the item
number and name. Then resolve the **exact commit** that introduced it, and record
its full SHA and its parent's.

Confirm before going further:

- the commit is an ancestor of `HEAD`
- it has the single parent you recorded
- the archive and the commit describe the same work - **and say at what level
  they match.** Agreeing on the feature is not agreeing on the diff: an archive
  names what was built, not every file that travelled with it, so this check
  passes while the commit still holds unrelated work. It is a sanity check on
  the target, not a substitute for reading the diff in Step 3.
- **any path the archive references still exists.** Archives rot - one cited a
  prototype file deleted long afterwards, and every check here passed anyway.
  Report a broken reference rather than working around it: it is evidence the
  record has drifted from the repository, which matters when the record is what
  the reversal is planned from.

**Stop on any mismatch.** A rollback aimed at the wrong commit is worse than no
rollback.

## Step 2 - review what was built on top

This is the step that makes rollbacks safe. Since that commit, find:

- code added later that calls into, imports from, or extends what is being
  removed
- data shapes, types, routes, or stored fields introduced by this feature that
  later work now depends on
- later features whose archives reference this item number

Report each dependency, and for each one say whether the reversal breaks it,
needs it changed too, or leaves it alone.

**If a later feature genuinely depends on this one, stop and ask** whether to
roll that one back first, keep the shared piece, or abandon the attempt. Do not
plan a cascade on your own judgment.

**This is a stop for a decision, not the end of the skill.** Once it is answered,
Step 3 writes the spec around that answer. The distinction matters because the
entangled case is the one this skill exists for - a feature with no dependents
barely needs a dependency review - so treating the stop as terminal makes the
guarded spec reachable only where it is least needed. **If the answer is
"abandon", say so and write nothing**: that is a real and often correct outcome,
and an unusable spec is worse than none.

## Step 3 - write the guarded spec

Write to `blueprint/context/current-work.md`, marked `Type: Rollback`, recording:

- the target item, its archive path, the full commit SHA, and its parent's
- **product paths only, and only the ones this feature actually owns** - the
  files the reversal may touch. **A commit usually contains more than its
  headline.** Check every product file in the diff against what the archive
  describes, and exclude anything unrelated that happened to travel with it. Not
  hypothetical: the commit that added folders to one project also added the
  application's only sign-out control, which "product paths only" happily admits
  and the archive never mentions - reversing the product diff would have deleted
  it. **List the excluded paths and why**, so the omission is a decision on the
  record rather than something noticed afterwards.
- the dependencies found in Step 2 and how each is handled
- **the data, separately from the code** - whether the commit contains a
  migration, what rows exist now in every environment that holds real data, and
  what happens to them. **Reversing code and reversing a schema are different
  operations**: dropping a table destroys rows that no `git revert` brings back,
  and a later migration built on this one is stranded by it. **`migrate` owns
  this** - name it, and treat a migration in the target commit as making that
  step mandatory rather than optional. Never sample or count real rows to find
  out; ask for the number.
- what should be gone afterwards, and one unaffected path worth re-checking
- build steps, same as any other spec: small, ordered, each with a done-when

The spec must state that the reversal applies only the product diff, excluding
the workflow's own files - `AGENTS.md`, `CLAUDE.md`, the adapter directories,
everything under `blueprint`, and any prototypes. The completed feature's commit
also contains the archive and plan bookkeeping, and `blueprint/context/current-work.md` now
holds this rollback spec. **Reversing the whole commit would destroy that state.**

## Step 4 - stop for approval

Show the plan: the target, the dependency review, the product paths, the steps.
Wait for approval, then hand off to `build`, which applies the reverse
patch under the guards this spec records.

## Rules

- **Never change code here.** Planning only.
- **Never plan around a real dependency** - report it and stop.
- **Never propose reverting the whole commit.** Product paths only.
- **Preserve the original archive.** `ship` adds a rollback archive
  alongside it. History records that the feature existed and was removed, not
  that it never existed.

## Formatting

Match `blueprint/context/ai-interaction.md` when it exists; otherwise keep output short, scannable, and direct.
