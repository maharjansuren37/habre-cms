---
name: ship
description: "Close out finished work: run a final safety pass, archive the spec under `blueprint/history`, check the item off in `blueprint/build-plan.md`, reset `blueprint/context/current-work.md`, make one work-level commit, then squash-merge the branch with explicit approval. Refuses to merge while a P0 or P1 finding is open or fixed in blueprint/context/findings.md. Asks separately before pushing. With --abandon, sets an unfinished item aside instead: archives its spec, keeps its branch and leaves the plan item unchecked, so it is parked or dropped deliberately. Use when the user runs `ship`, or asks to finish, wrap up, merge, or close out the current item once it is built and reviewed."
---

# ship - log it, commit it, merge it

**Writes:** `blueprint/context/current-work.md` · `blueprint/context/findings.md` · `blueprint/findings/` · `blueprint/context/needs-you.md` · `blueprint/build-plan.md` · `blueprint/history/` · `dev-notes/decisions.md` · `blueprint/production-pending.md` · `blueprint/status/`

Where this sits:

    `build` -> `verify` -> `review` -> ship -> next item

`build` built the work on a branch, with optional per-step checkpoints.
This closes it: logs it, makes the single work-level commit, and squash-merges so
the item lands on `main` as one clean commit regardless of how many checkpoints
the branch carried.

Run it only when the work is done, verified, and reviewed.

## Input

| Argument | Mode |
|---|---|
| *(none)* | Close out finished work - Steps 1 to 4 |
| `--abandon` | Set an unfinished item aside, with the user's reason - *Abandoning or parking an item*, below, instead of Steps 1 to 4 |

## Before you start

**If `blueprint/context/current-work.md` holds no completed spec, stop** - unless
this is `--abandon`, which exists for the unfinished one. There is nothing to
close out, and resetting it destroys whatever is in flight.

Name which of these has not happened rather than merging past it - Step 1 turns
the ones that matter into a hard stop:

- **`verify` has not run** - the code compiles and nobody has watched it do the
  thing the spec promised.
- **`review` has not run** on this work - the merge gate reads the findings
  ledger, and an empty ledger because nothing looked is indistinguishable from an
  empty ledger because nothing was wrong.

## Step 1 - the safety pass

Before logging or committing anything, check each of these and **report only the
blockers**:

- `blueprint/context/current-work.md` holds a real spec, and every build step is ticked.
- The work is on a branch, not on `main` or `master`.
- The changed files belong to this spec, with no unrelated work mixed in. A dirty
  `blueprint/context/findings.md` is expected - `review` writes it.
- The project's verification command passed **in this session**. If none is
  declared, the build passed, and the tests passed when the project has a test
  command and this change touched logic.
- Behavioral done-whens have `verify` evidence. Do not merge on an
  unverified claim.
- **No P0 or P1 finding in `blueprint/context/findings.md` is `open` or `fixed`.**

That last one is the gate. `fixed` still blocks on purpose: the repair exists but
nothing has re-checked it - run `review` to close it out, or `preflight` for a
finding no code fixes. The only ways
past without more code are `deferred` (the user's decision to do it later, with
the skill that will do it named) or `accepted` (the user's explicit decision in this
conversation, with their reason recorded) or `invalid` (a `review`
verdict backed by evidence). **Never set either on the user's behalf.** A missing
ledger file means no findings.

**Evidence, or it didn't happen** - `AGENTS.md`'s rule applies here: name what
proves it, and "could not verify" beats a fabricated pass every time.

If required evidence is missing, **stop here.** Do not proceed to Step 2 and
mention it afterwards.

## Step 2 - log the work

Check what kind of item this is - the spec's `Type:` line - and archive
accordingly:

- **Feature** - archive `blueprint/context/current-work.md` to
  `blueprint/history/features/NN-name.md`, where NN is its build-plan number, and
  check it off in blueprint/build-plan.md. Check the parent item too, but only once
  every sub-item under it is checked.
- **Fix** - archive to `blueprint/history/fixes/name.md`. A fix is not a plan
  item, so nothing gets checked off.
- **Rollback** - archive to
  `blueprint/history/rollbacks/YYYY-MM-DD-NN-name.md`, **preserving the original
  feature's archive**. Uncheck the target item in `blueprint/build-plan.md` and append
  a short note to its line with the date and the rollback's archive path. Keep
  the item's number stable.

**Record the item's decisions in `dev-notes/decisions.md`** before the spec is
archived. Every entry under the spec's `## Decisions`, and every rule a repair
settled - a size cap, a concurrency limit - becomes a numbered entry in that file's
own format: what was chosen, what lost, what it costs. **Show them with the rest
of this step's changes**, since they land in the same commit. The archive keeps
the spec, but nobody reads an archive to learn why the project is shaped as it
is: on a real run eight decisions a later item depended on lived only there,
and `docs` was merely suggested.

**Carry the spec's `## Production needs` to `blueprint/production-pending.md`**,
unless it says none. Append it under a `## <archive name>` heading (create the
file with a `# Production pending` heading), one `- [ ]` line per need. The item
is merged, but it is not live until `deploy` has met every line - and this file
is the only place that says so.

**Archive the resolved findings with it.** Append a `## Findings` section to the
archive file holding every `closed`, `accepted`, or `invalid` finding at its
final status - its index heading followed by the body of its entry file,
`blueprint/findings/<ID>.md`, with `accepted` entries keeping their recorded
reason. **A `deferred` entry is not resolved and stays in the ledger**, with its
`Deferred to:` target: one archived as `accepted` was repaired an hour later by
the very skill it named, and the repair had to be written into an archive
nobody reads. Prefix each ID with the archive name so it stays unique forever:
item 12's `F-03` becomes `12/F-03`. Then remove those headings from the index
and delete their entry files.

**Move unresolved P3s to the backlog.** Every P3 still `open`, `fixed` or
`unverified` moves its index heading and `File:` line to
`blueprint/findings/backlog.md` (create it with a `# Findings backlog` heading);
its entry file stays where it is and keeps its ID. The backlog is not loaded:
`spec` offers a tidy item from it, and `review` still closes what it
re-examines there. **Name each one moved in the report.** On a real project the
index only grew - 100 findings raised, 26 P3s still open - and every session
paid for all of them.

Unresolved P0 to P2 entries and `unverified` leads above P3 stay in the index
with their IDs. They are never silently dropped. When nothing is left, reset
`blueprint/context/findings.md` to its stub - the template's file, header
included, because the header is where `docs`, `ci`, `deploy` and `monitor`
learn how a finding no code fixes gets closed:

    # Findings

    > **Generated file.** The findings index, loaded every session: one heading per
    > live finding - `### F-03 [P0] open - <title>` and a `File:` line under it -
    > and nothing else. The full entry is `blueprint/findings/F-03.md`, read when
    > acting on that finding; **status lives only here**, evidence in the entry's
    > **Resolution**. `review` raises code findings; `build` marks a repair `fixed`;
    > only a later `review` pass moves it to `closed` - except a P2 or P3 whose
    > repair `build` saw a test fail without, which `build` closes itself. **A
    > finding no code fixes** - raised by `preflight` or `host`, such as missing
    > backups or a leaked secret - is marked `fixed` with evidence by whichever
    > skill repairs it, and `preflight` re-checks and closes it. `ship` refuses to
    > merge while any P0 or P1 finding is `open` or `fixed`, then archives resolved
    > findings with the work item, moves unresolved P3s to
    > `blueprint/findings/backlog.md`, and resets this file. A finding the user puts
    > off rather than abandons is `deferred`, with a
    > `Deferred to:` line naming the skill that will do it: it gates nothing, stays
    > in the ledger through `ship`, and `preflight` reports it at every audit until
    > that skill has run.

    _No findings recorded._

**Move the Done lines out of `blueprint/context/needs-you.md`.** Append every
line under its `## Done` heading to `blueprint/history/needs-you-done.md`
(create it with a `# Needs you - done` heading), under a `## <archive name>`
heading, then leave `## Done` empty. Open lines are never touched. The file is
loaded every session, and closed lines left in it are what grew it to thirteen
kilobytes on a real project.

Then reset `blueprint/context/current-work.md` to its stub:

    # Current work

    > **Working file.** The one item in flight - a feature, a fix, or a rollback.
    > The `spec` skill writes it, `build` ticks its steps off as they land, and
    > `ship` archives it under blueprint/history and resets this file.

    _Nothing in progress. Run the `spec` skill to start the next item, or describe a
    bug to spec it as a fix._

**Both stubs are quoted here because by the time this skill runs they have been
overwritten** - "reset it to its stub" is an instruction with no source to
restore from, and the result is every project inventing slightly different
wording for the same state. `spec` and `progress` both read this file to decide
whether anything is in flight; two spellings of "nothing" is how that check
starts missing.

**Discard consumed prototypes, and confirm it worked.** If this item built the look from
prototypes - its design reference pointed there and an early step ported
the theme into the app - the tokens now live in the app's own theme, a stylesheet,
a theme object or `ThemeData` depending on the platform, and those mockups were
always throwaway. Skip this if the item did not consume them.

**Delete only the mockups nothing unbuilt still needs.** A look is built over
several items: a login item consumes the theme and one screen while the editor,
the list and the public page wait for items 2, 3 and 4. **Check each remaining
file against `blueprint/context/design.md` and every unchecked item in
`blueprint/build-plan.md` before removing it**, delete what is spent, and say
which files stayed and which item holds each. The whole directory goes only when
the last of them is consumed - on a real run a session had to keep it and explain
why, against this skill's own text.

**Keep `blueprint/context/design.md`.** The mockups go; the decisions in them
stay. Deleting the record along with the mockups is how the next UI item ends up
reinventing the loading state.

**Then check what you deleted is actually gone before continuing.** In a real
project built with an earlier version of this workflow, `prototypes/` survived
thirteen consecutive features because this step was an instruction with nothing
verifying it. An instruction with no check is a suggestion. If a file you meant
to remove is still there, say so and stop rather than reporting a clean finish -
and if the directory remains because later items still need it, say that too,
naming the items, so it reads as a decision rather than the same old oversight.

Do not commit yet. The next step makes one commit covering the code and this
bookkeeping together.

## Step 3 - the work commit

Stage everything on the branch - any uncommitted step work plus the Step 2
logging - and make **one** conventional commit: `feat: <name>`, `fix: <name>`,
`revert: roll back <name>`.

The project's verification command must pass first.

## Step 4 - merge, then stop

**If the repository has a remote and CI that runs on pull requests, offer that
route first.** A local merge lands the item on `main` without CI ever having run
on it: the branch was never pushed, so the only pre-merge check was this
machine's verification command, and CI first sees the code after `main` is
pushed. On a real run a login feature reached `main` that way. The pull-request
route is: push the branch, open a pull request, wait for its checks, then
squash-merge on the host and delete the remote branch - **the push is a push, so
it needs its own explicit yes**, like step 4 below. If the user declines, or there
is no remote or no CI, merge locally as below and **say that CI has not seen this
item** until `main` is pushed.

1. **Squash-merge the branch into `main`, only with the user's explicit
   go-ahead.** The item lands as one commit.
2. Delete the branch after a clean merge. **A squash-merge needs `git branch -D`,
   not `-d`** - squashing writes a new commit rather than recording the branch as
   merged, so git refuses the safe delete on work that is fully in `main`. Check
   the trees match (`git diff main <branch>` is empty) and then force it; do not
   reach for `-D` just because `-d` complained, and never on a branch you have
   not merged. Delete the remote branch too if it was pushed, or the pull request
   view keeps offering it.

**In a git worktree, merge from the main checkout.** `main` is checked out there,
so `git switch main` in the worktree refuses - and the path git's refusal names is
wrong inside a submodule. Find the main checkout with the board command
`orchestrate` gives, run from this repository's top level
(`git rev-parse --show-toplevel`) instead of the product root: it prints
`<main checkout>/blueprint`, and the directory above that is the one to merge in.
**Check that checkout's `git status` is clean first** - merging into someone's
uncommitted work mixes the two in one commit - and stop if it is not.

Then, from the main checkout, **`git worktree remove <this worktree>` before the
branch delete**: git refuses to delete a branch a worktree still holds. Removal
refuses a worktree with uncommitted or untracked files, and that is a stop, not a
reason for `--force` - the refusal is about work nothing has kept. Run it from
the main checkout, not from inside the worktree, which would delete the
directory this session is standing in.

**A worktree of a bare repository** has no main checkout - the command stops -
and `main` is checked out nowhere, so switch to it in the worktree and merge
there as usual; the worktree stays.
3. **Stop and ask** whether to push `main` to its upstream. Approval to merge is
   not approval to push, and neither is running this skill.
4. Push only after a separate, explicit yes **in this conversation**. If the repo
   has no remote, say so rather than guessing.

Then finish with a short **how to try it** note for the completed work - or, for
a rollback, how to confirm the removed behavior is gone plus one unaffected path
worth re-checking. If that would run past a couple of steps, point at
`verify` instead.

**In a multi-part project, clear this part's packet** in `<product root>/blueprint/status/<this part>.md`,
resetting every field rather than only the state - and leaving the rest of the
file alone:

    **State:** idle
    **Item:** -
    **Blocked on:** -
    **Review packet:** -
    **Updated:** <today>

The path is relative to `AGENTS.md`'s `Product root:`, and **in a git worktree,
resolve it under the main checkout** (`orchestrate` gives the command). Shipping is what closes a review, and a queue nothing empties
eventually blocks every unattended run in the product.

**Clearing `Item:` and `Blocked on:` matters as much as clearing the packet.** A
shipped part still naming the item it finished reads as work in flight, and a
block left behind after the thing it waited for shipped is the exact "stale
block" `orchestrate` has to go hunting for - and which stops another part from
starting for no reason at all.

Then point at what is next:

- **`ci`** only if it was never set up, or if this item changed what the checks
  are. It normally runs right after `scaffold`, long before here. A green suite that only
  runs when someone remembers is a suite that will eventually stop being run.
- **`docs`** if the README still does not describe what the project actually does
  now. Its decisions are already recorded - Step 2 did that.
- **`integrate`** if this project has more than one part. This part passing its
  own checks says nothing about whether it still agrees with the others - and
  agreeing is what breaks when parts are built in parallel.
- **`preflight`** before a first release, and before a milestone one. Merging
  proves this item is sound; it says nothing about whether the project can face
  users at all - backups, configuration, operations, a README that describes what
  this actually is. **`deploy` gates production on `preflight` having returned
  go**, so a loop that never names it here arrives at that gate with nothing
  behind it. It is allowed to answer no-go, and that is it working.
- **`deploy`** if this project is already live. Merging put the work on `main`;
  it did not put it in front of anyone. **This is the step most easily forgotten**,
  because the loop feels finished at the merge and the branch is gone.
- **`context`** whenever the overview's *Current state* is now wrong - which is
  **after every ship**, because this skill just ticked an item off
  `blueprint/build-plan.md` and reset the spec. The overview is the file every
  cold session loads, so a stale one starts the next session on a false picture:
  wrong item count, wrong next item, and any claim that has since changed. It is
  cheap and idempotent. **Nothing else refreshes it** - `spec` is named in that
  skill's re-run list and this one was not, so it silently went stale once per
  item.
- otherwise **`spec`** for the next item.

## Abandoning or parking an item - `--abandon`

For an item that should not be finished now: the direction changed, it was
spec'd wrong, or something more urgent needs `current-work.md`. **Only when the
user asked for it by name, with a reason** - an unfinished item is never set
aside because a skill found it inconvenient.

1. **Keep the branch.** It is what makes this parking rather than deleting: the
   code stays where `build` left it. **Commit any uncommitted work to it first**
   (`wip: <name>`), with the user's go-ahead, or leaving the branch loses it.
   **Stage new files too - `git add -A`, never `git commit -a`**, which commits
   modified files and leaves an untracked one behind while reporting success. On
   a real run the half-built step was a new file: the `wip:` commit said
   `1 file changed`, and the only work the step exists to save stayed untracked,
   to be carried onto `main` by Step 2 as a stray. **Check `git status` is clean
   before moving on** - an instruction with no check is a suggestion.
   Note the branch name and its last commit. Delete the branch only on a separate,
   explicit request.
2. **Move to `main`** - in a git worktree, the main checkout, as Step 4 describes.
   The record goes to `main`; the code does not.
3. **Archive the spec** to `blueprint/history/abandoned/YYYY-MM-DD-name.md`, read
   from the branch (`git show <branch>:<path to current-work.md>`) exactly as it
   stands, ticks included, followed by `**Abandoned:** <date> - <reason>` and
   `**Branch:** <name> at <commit>`. **Read this item's findings from the branch
   as well** (`git show <branch>:<path to findings.md>`, and each entry file the
   same way, `git show <branch>:blueprint/findings/<ID>.md`): Step 2 has just moved
   you to `main`, where the ledger is its stub, while the entries live on the
   branch beside the code they describe. Reading the ledger from where you are
   standing archives an empty section and reports it as done. Append them under
   `## Findings` at their current status - they are about code that never reached
   `main` - **each ID prefixed with the archive name**, so `F-01` becomes
   `2026-09-22-submit-a-link/F-01`: the entries are leaving the ledger, the next
   item's first finding will be `F-01` again, and the reason recorded above cites
   these by ID. **Leave the branch's own ledger as it is** - it is what `spec`'s
   resume brings back with the branch - and remove these entries from `main`'s
   ledger only where they are actually in it.
4. **Leave the item unchecked** in `blueprint/build-plan.md` and append a note to
   its line: `(abandoned <date> - blueprint/history/abandoned/<file>)`. A fix has
   no plan line.
5. **Check `current-work.md` and `findings.md` on `main` are the stubs** quoted in
   Step 2, and reset them if not.
6. **Commit the record on `main`** - `chore: abandon <name>` - with the user's
   go-ahead, naming its files so nothing else is swept in.
7. **In a multi-part project, reset this part's status file** as Step 4 does.

`spec` finds the archive when this item comes up again and offers to resume from
it - the spec with its ticks, and the branch it names.

## Rules

- **The item is the unit of history.** One squashed commit on `main` per feature,
  fix, or rollback, however many checkpoints the branch carried.
- **Never merge failing or unfinished work.**
- **Never merge past the findings gate.** The recorded ways through are
  `accepted` and `invalid`; both travel into the archive, never a silent drop.
- **A rollback preserves the original archive** and adds its own. Never rewrite
  history to make a feature look as though it never existed.
- **Merging and pushing are separate decisions, and both are the user's.**
- **One item per run.** A parent with unchecked sub-items stays unchecked.

## Formatting

Match `blueprint/context/ai-interaction.md` when it exists; otherwise keep output short, scannable, and direct.
