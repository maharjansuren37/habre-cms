---
name: orchestrate
description: "Coordinate the parts of a multi-part project through the board at the product root. Reports what each part is doing, what is blocked and on what, and the next thing needing a person. Detects deadlock between parts, enforces the contract freeze before parallel work begins, and holds the cap on unreviewed work so unattended runs cannot outrun your ability to read them. The only skill that changes the contract line. Use when the user runs `orchestrate`, is deciding what to run next across parts, or wants to know why a part is waiting."
---

# orchestrate - the board, and what it is safe to start

**Writes:** `blueprint/orchestration.md`

Where this sits:

    architect (the parts and the boundary) -> orchestrate -> parallel part work

Agents here coordinate **through a file, not through each other**. There is no
supervisor process, no message passing, and no queue - the same premise as the
rest of this workflow: state lives in files, because conversation history
disappears.

`<product root>/blueprint/orchestration.md` holds the contract line and the
rules. Each part's live state is a **separate file** at
`<product root>/blueprint/status/<part>.md`.

**Both paths are relative to the product root, never to a part.** Take it from
`AGENTS.md`'s `Product root:` when this skill runs inside a part - an unqualified
`blueprint/` there means *that part's* blueprint, which is a different directory,
and the board is not in it. Reading the wrong one finds nothing; writing it puts
the contract line somewhere no part will ever look. This skill is the one that
spans every part, so it is the one where a path resolving to the wrong directory
does the most damage and shows the fewest symptoms.

**The board lives in the main checkout, even when a session runs in a git
worktree.** A worktree has its own copy of `blueprint/status/` and
`blueprint/orchestration.md`, and `Product root:` resolves into that copy - so
three worktrees would write three boards, this skill would read a fourth, and a
freeze written here would reach no worktree until it rebased. Every skill that
reads or writes the board resolves its directory like this (at the root itself,
`<product root>` is `.`):

    cd "<product root>"
    if common=$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null); then
      if [ "$(git config --file "$common/config" --type=bool core.bare)" = true ]; then
        echo "No main checkout: a worktree of a bare repository has no board to share." >&2
        false
      else
        main=$(git config --file "$common/config" core.worktree) \
          && main=$(cd "$common" && cd "$main" && pwd) || main=$(dirname "$common")
        echo "$main/$(git rev-parse --show-prefix)blueprint"
      fi
    else
      echo "$PWD/blueprint"
    fi

The main checkout is the shared git directory's parent - or, in a submodule,
where that directory's `core.worktree` points, because a submodule's git
directory lives inside the superproject's `.git/modules/` and its parent is not a
checkout at all. The prefix keeps the product root's place inside it. **Outside
git, or in the main checkout itself, that is the directory `Product root:`
already names** - nothing changes. A worktree's own copy of the board is never
read, edited or committed. **A worktree of a bare repository has no main
checkout**, so the command prints nothing and fails: stop and say so, rather than
picking a worktree whose removal would take the board with it.

**That separation is deliberate and load-bearing.** One file per part means no
file has two writers, so nothing is lost when sessions genuinely run at the same
time - which is exactly what happens when a subagent drives each part. A single
shared table would require every writer to rewrite the whole file, and two
finishing at the same instant would silently drop a row. The rule "writes only
its own row" is a convention; separate files are a guarantee.

Only for a multi-part project. In a single-part one, say so and point at
`progress` instead.

## Before you start

**If `blueprint/orchestration.md` does not exist at the product root, stop and say
so.** Either this is a single-part project - in which case there is nothing to
coordinate and `progress` is the skill that answers the question - or it is a
product that was never converted, and `convert-to-parts.sh` is what creates the
board, the status files and the root's own skills.

**Run this from the product root, never from inside a part.** Every path here is
relative to the root, and a part's own `blueprint/` is a different directory that
also exists - so running it in the wrong place reads a board that is not there
and reports nothing wrong.

## Step 1 - read the board and every part

Read `<product root>/blueprint/orchestration.md`, every
`<product root>/blueprint/status/<part>.md`, then each part's own
`<part>/blueprint/build-plan.md`, `<part>/blueprint/context/current-work.md` and
`<part>/blueprint/context/findings.md` - note the three are not in the same
directory, which is exactly the kind of thing a bare filename hides. Check what the board claims against what the parts actually show -
**a status file saying `building` while that part's spec is the untouched stub is
drift**,
and it means a session stopped without recording it.

**A missing status file reads as `idle`**, not as an error. Status files are
working state and are not committed, so a fresh clone has none until each part's
next session writes its own. Check that part's spec the same way: a missing file
beside a spec with ticked steps is the same drift.

## Step 2 - report where everything stands

Per part: current item, state, what it is blocked on. Then, across the product:

- **the contract**: frozen or not, and at which version
- **the review queue**: how many packets are waiting, and for how long
- **which parts are running unattended**

Lead with anything that needs a person. That is almost always a review packet,
because **reading them is the actual bottleneck** - not agent throughput.

## Step 3 - find the blocks that are really something else

**This entire step reads one field: `Blocked on:` in each part's status file.**
`spec`, `build` and `autopilot` write it when they stop for something another
part owns; `ship` clears it. Nothing below can be found without it.

So **check first that the field is being written at all.** A product where every
part reports `Blocked on: -` while parts are visibly waiting on each other does
not have zero blocks - it has sessions recording them in the conversation instead
of the file. Say that plainly rather than reporting all-clear: **an empty field
and an unwritten field look identical here**, and reporting the second as the
first is the most misleading thing this skill can do.

- **Deadlock** - two parts each waiting on the other. Report it as what it is: a
  **contract problem wearing a scheduling costume**. Two parts cannot each need
  the other to go first unless the boundary between them is wrong. The fix is in
  `architect` and the contract, not in scheduling.
- **A block with no owner** - a part waiting on something no part is building.
- **A stale block** - waiting on an item that already shipped. Report it and say
  which part can now start. **Do not clear it yourself** - that field belongs to
  the blocked part's own sessions, and the guarantee that no file has two writers
  is worth more than saving that part one edit.

## Step 4 - the contract freeze

**This is the only line on the board this skill writes, and the only genuinely
shared decision in the project.**

**Name the contract on that line** - the file in `contracts/` at the product
root, and its version. "Frozen" on its own is not a freeze anyone can check
against: a part builds against a specific file, and six weeks later the only
question that matters is *which* version was frozen. If `contracts/` is empty or
holds nothing the parts actually use, say that instead of freezing - there is
nothing to freeze, and recording one would be worse than recording nothing.

**If `Owner:` is still the placeholder**, there is no owner to build first and no
contract a freeze could name. Say so and route to `architect`, which decides it -
do not pick one here; which part can break the boundary is an architecture
decision.

**The owner builds first.** The part named as `Owner:` under *The contract* in
the product root's `AGENTS.md` may spec and build the items that define the
contract before any freeze - they are what produces the thing to freeze, so
making them wait for one is a deadlock. Say so when `contracts/` is empty: the
next step is the owner's first contract-defining item, not a freeze.

**Refuse to freeze** while any part has an open item that would change the
contract - in practice, until the owner's contract-defining items have shipped.
Freezing a contract that is about to change is worse than not freezing it,
because parts will build against it in good faith. **When the only thing holding
the freeze is owner items that add to the contract** - routes the plan already
names but the contract file does not yet describe - say that is the cause and
route to `architect` to write the whole planned boundary. Those items then
implement the contract rather than change it, and stop blocking every consuming
part.

**Refuse to move the consuming parts into parallel work while the contract is not
frozen.** The owner working alone before the freeze is sequential, not parallel.
Parallel work against an unfrozen contract is worse than working sequentially:
each part invents its own assumptions, all of them look correct alone, and none
of them find out until `integrate`.

**Unfreezing stops everything.** Every part in flight finishes its current step
and holds. A contract change should feel expensive, because it is.

**Commit the contract line on its own, with the user's go-ahead** - in the main
checkout, naming the file so nothing else is swept in:
`git commit -m "chore: freeze <contract file> <version>" -- blueprint/orchestration.md`
(`unfreeze` for the reverse). The line is a decision, and it is committed like
one. The status files beside it are not, and never are - which is why this
commit names its one file.

## Step 5 - the cap on unreviewed work

**`autopilot` refuses to start a new unattended run while two packets are already
waiting for review.** Report the queue depth, and refuse to advise starting
another when the cap is reached.

The reasoning, worth restating rather than assuming:

Three parts each running unattended produce three self-reviewed drafts at once -
and **a long autopilot run already reviews its own work**. Three in parallel is
the weakest state this system can be put in: every gate technically satisfied,
and nobody has read anything. **The cap exists to make that state unreachable**,
not merely discouraged.

Unattended work must not outrun the ability to read it. That is the point of the
number.

## Step 6 - say what to run next

One recommendation, naming the part and the skill. If the honest answer is
"review the packet from `api` before starting anything else", say that - a queue
of unread work is a worse problem than an idle part.

## Driving the parts with subagents

One session can drive several parts by giving each its own subagent. **It works,
and it changes what the work is** - so name the trade rather than discovering it.

**A subagent running `build` is running `autopilot`.** `build`'s design is:
implement a step, show the diff, explain it, **wait for approval**. A subagent
cannot stop and ask the person - it reports to the session that launched it. So
delegating `build` does not parallelise the reviewed loop; **it converts it into
an unattended one.** That should be a deliberate choice.

**This is not the subagent `build` uses itself.** `build` hands one step's
implementation to a subagent and keeps the rest in the session the person is
in - reading the diff, explaining it, proving the done-when and waiting for the
yes - so its reviewed loop is intact. What converts it is handing the *whole
skill* to a subagent, which then has nobody to wait for.

**Give a subagent an `autopilot` range, not a bare skill.** `autopilot spec..review`
in one part is exactly the shape autopilot was built for: bounded, checkpointed,
stops at the first real question, ends with a packet a person reads. Every
protection still applies - the board checks, the permanent blocks, and the cap.

**Where subagents fit without changing anything:** read-only fan-out. `review
full` on a large codebase, `preflight`'s independent checks, surveying an
unfamiliar part. The output is a report, so no gate is skipped.

**Practical points that matter:**

- **Give each subagent its own git worktree.** Parts on separate branches in one
  working tree fight over the index; a worktree per part removes that entirely.
  **The board does not move with it** - every worktree resolves the board to the
  main checkout, as above, so the cap, the blocks and the freeze stay one set.
- **The cap counts across the product, not per subagent.** Three subagents each
  finishing a run is three packets waiting, and the third refuses to start. That
  is the mechanism working, not an obstruction.
- **A subagent still writes only its own part's status file.** This is why those
  are separate files.
- **Never give a subagent a range containing `host`, `deploy`, `migrate`, or a
  contract change.** The permanent blocks are permanent regardless of who is
  running.

**What cannot be delegated:** reading the diffs. The comprehension gate is the
point of the workflow, and a subagent reporting "done" is not a substitute for
having read what it did.

## Rules

- **Read-only over the parts.** The board's contract line is the only thing this
  skill writes, and the only thing it commits. Each part's status file belongs to that part's own sessions -
  including its `Blocked on:` field, even when the block is plainly stale.
- **Resolve every path against the product root**, from `AGENTS.md`'s
  `Product root:` when running inside a part. A bare `blueprint/` there is the
  part's, not the product's. **The board resolves one step further, to the main
  checkout**, when this is a git worktree.
- **Never start work in a part.** Say what to run; do not run it.
- **Never freeze a contract that is about to change.**
- **Never advise parallel work before the freeze.** Only the contract's owner
  works before it.
- **Report drift between the board and the parts** rather than trusting the
  board. It is a record of what sessions claimed, not of what is true.

## Formatting

Match `blueprint/context/ai-interaction.md` when it exists; otherwise keep output short, scannable, and direct.
