---
name: context
description: "Validate the two planning docs and generate `blueprint/context/project-overview.md` from them - the AI-facing source of truth loaded every session. Checks the plans for shape problems first (placeholder text, a build plan that is not a checklist, features that contradict the stack) and proposes fixes before generating. Use when the user runs `context`, has just finished writing or editing the plans, asks to regenerate the overview, or after any plan change that affects direction, data, or stack."
---

# context - generate the source of truth from the plans

**Writes:** `blueprint/context/project-overview.md`

Where this sits:

    `blueprint/project-plan.md` + `blueprint/build-plan.md` -> context -> `blueprint/context/project-overview.md`

You own the two planning docs. This distills them into one file the agent loads
every session. The direction is one-way on purpose: **edit the plans and
regenerate, never hand-edit the overview.** A hand-edit is lost on the next run
and, worse, silently disagrees with the plans until then.


> **Multi-part project:** `blueprint/project-plan.md` and
> `blueprint/context/quality-bar.md` (the bar the whole product is held to -
> `architect` writes it at the root, not per part) live at the **product
> root**, not this part. Resolve it from `AGENTS.md`'s `Product root:` field.
> Everything else here is this part's own.

## Before you start

**If `blueprint/project-plan.md` or `blueprint/build-plan.md` does not exist, stop
and say to run `ideate` first.** This skill distils the plans; it does not write
them.

**Two sections of `blueprint/project-plan.md` must hold real content, not the
seeded instruction text, because Step 3 generates directly from them:**

- **6. Architecture** - filled by `architect`, which now runs first
- **5. Tech** - filled by `stack`, against that architecture

The loop is `ideate -> architect -> stack -> layout -> scaffold -> ci -> context`, so by the
time this runs legitimately both have happened. Checking it here costs nothing and
**a gap is not a contradiction** - Step 2 stops only on plans that disagree with
themselves, so without this a plan that is merely *unfinished* passes straight
through it.

**How to tell a section is unfilled: the seeded instruction sentence is still
present**, whatever has been added around it. **Do not use length or
non-emptiness** - a plan can carry real content *underneath* the seeded text
(genuine constraints on a stack nobody has chosen yet) and still be unfilled,
because the decision Step 3 generates from has not been made; a length test
reads that as filled and generates a Stack section describing no stack.

**Check both sections before stopping, and report every unfilled one in a single
stop, in loop order** - `architect` before `stack`. In the normal case they are
unfilled together, because neither skill has run: stopping at the first sends the
user away, and stops them again on the second when they return.

**Read both plans anyway and give Step 2's findings alongside the stop, as
advisory.** The stop already costs a round trip; it should buy everything this
skill can see rather than one sentence. A build plan that is not a checklist is
readable now, and discovering it on the next run is a second trip for something
that was on screen the first time.

Step 2 checks the plans for shape problems and is the second gate - a half-template
plan generates an authoritative-looking overview full of nothing, and every skill
downstream reads that file as the source of truth.

## Step 1 - read both plans

Read `blueprint/project-plan.md` and `blueprint/build-plan.md` in full. Also read
`blueprint/context/project-overview.md` if it already exists, so you can report what your regeneration
changes.

## Step 2 - validate the shape, before generating anything

Generating a confident overview from a plan that is still half template produces
an authoritative-looking file full of nothing. Check for:

- **Placeholder text.** Sections still holding the seeded instructions rather
  than the user's own content.
- **A build plan that is not a checklist.** If items are plain bullets with no
  `- [ ]`, the loop cannot track progress. Propose the checkbox version.
- **Items that are not item-sized.** "Auth, billing, and dashboard" on one line
  is three items. "Make it nice" is not an item at all.
- **Contradictions.** A feature the stack cannot support, data in the model that
  no feature reads or writes, an architecture describing a platform the Tech
  section does not name.
- **The plan against the repository.** A version, image tag, service or command
  the plan names that the lockfile, compose file, config or `AGENTS.md`
  Environments disagrees with - or a fact about a server that a later skill
  checked and found false. The repository is usually right and the plan line
  stale. **Report it as a contradiction, not as "none":** it is one, with the
  repository on the other side.
- **A data model the stack already owns.** The model is written before the stack
  now, so a library chosen later may create and migrate tables the plan also
  specifies by hand - an auth library owning users and sessions is the common
  case, and a plan written earlier almost always describes a `User` table with
  columns. **Two of them drift, and the bug arrives at the second migration.**
  `stack` is meant to reconcile this when it chooses; check it did, because
  nothing else looks.
- **Missing decisions the build will immediately need.** No stack at all, or no
  data model while half the features store things.

Report what you found. For anything mechanical - checkbox conversion, splitting
an oversized item - propose the exact replacement text and get approval before
writing it.

**A contradiction the user has to resolve stops this skill.** Do not generate an
overview from plans that disagree with themselves, and do not pick a side on
their behalf. Say what conflicts and ask.

**Never write a correction into the overview before it is in the plan.** An
overview carrying a fix the plan does not have disagrees with its own source, and
the next regeneration quietly reverts it. On a real run the overview was
generated with three corrected lines while the plan edits still waited for
approval. Propose the plan change, get the yes, write it, then generate.

**So does a gap in a section Step 3 generates from.** A contradiction and an
unfilled section both produce an overview that is wrong, and only one of them
looks wrong while you are writing it - which is why the Tech and Architecture
checks are preconditions above rather than entries in the list here. Reporting
"no stack yet" and then generating a Stack section anyway is the failure this
step exists to prevent, performed by the step itself.

## Step 3 - generate the overview

Write `blueprint/context/project-overview.md`, covering:

- **What this is** - the problem, in the user's own framing, and who it is for.
- **Scope** - what the first version includes, and what is explicitly deferred.
- **Stack** - the chosen technologies and the reasoning that survived from the
  plan. An agent reading this should not re-litigate a settled decision.
- **Architecture** - structure, where logic lives, the auth boundary, and the
  data model's entities by name. The fields, the endpoints and the decisions
  behind them stay in the plan: name the section instead.
- **Constraints** - anything that rules an approach out: hosting, budget, a
  platform requirement, an existing system it must fit.
- **Current state** - how many items are checked off, what is in flight, what
  is next. Three lines; `blueprint/build-plan.md` is the record.

Write it for an agent joining with no other context: concrete, never vague -
and **at most 8 KB**. Every session loads this file, so every kilobyte in it
is paid for again and again. It orients; it does not replace the files it
points at.

**Link, never restate.** Open findings, needs-you lines, shipped items,
decisions and the environments each have a file that is their record - name the
file, do not copy it here. On a real project the overview restated the findings
ledger and `needs-you.md` in prose and reached 29 KB; every change to either
made the overview stale, and 12 of 33 commits were regenerating it. **If a
section will not fit, it is restating something** - find what, and point at it.

**Measure it before reporting** (`wc -c`). Over 8 KB, cut and measure again.

Mark it as generated at the top, with the instruction to edit the plans instead.

**Then fill `AGENTS.md`'s `## What this is`** with the same problem statement,
cut to two or three sentences. It ships as a placeholder comment and **no other
skill writes it** - so without this the entry point every tool reads opens with
an empty section in a project whose plans have been complete for weeks.

It is not a duplicate of the overview. `CLAUDE.md` loads
`project-overview.md`, but every other tool reads `AGENTS.md` and may never open
the overview at all: this section is the only project description some agents
will ever see. Keep it short and replace it whenever the problem statement in
the plan changes - **but leave it alone if someone has already written prose
there**, since it is a user-owned file and a hand-written description beats a
regenerated one.

## Step 4 - report what changed

If an overview already existed, say what this regeneration changed - new items,
a changed stack, a resolved contradiction. If this is the first generation, say
so. **Give its size**, so a file creeping toward the cap is seen before it
passes it. **Say whether `AGENTS.md`'s `## What this is` was filled, left alone because
it already had prose, or updated** - it is a user-owned file, so a write to it
is never silent.

Then point at what is next:

- `architect` if the architecture section is still thin
- **`prototype` if the first item is a screen and no visual reference exists** -
  building a design from prose alone is how an approximation lands and then
  becomes what the app permanently looks like
- otherwise `spec` to start the first item

## When to re-run

- After editing either planning doc.
- After `spec` adds a new item to the build plan.
- **After every `ship`.** It ticks an item off the build plan and resets the
  spec, so *Current state* - the item count, what is next, what is in flight -
  is wrong the moment it finishes. This is the most frequent reason to re-run
  and was the one missing from this list.
- After anything that changes direction, users, data, stack, or deployment.

It is cheap and idempotent. Re-running it when nothing changed produces the same
file.

**Check the build plan describes *this* product before generating anything.**
Placeholder items shipped in the template for a long time, and a project that
never deleted them carries items for a product that does not exist. Every skill
reading that file treats an unchecked box as real work - `spec` specs the first
one, `progress` counts it as remaining, `prepare` files a requirement for a
service it names. **The tell is an item that does not match the plan's own
description of the product**, and the answer is to stop and say so rather than
generate an overview around it: an overview built on the wrong items is
confidently wrong in the one file every other skill trusts.

## Rules

- **Never invent content the plans do not support.** A gap in the plan is
  reported as a gap, not filled in with something plausible.
- **Never hand-resolve a contradiction.** Stop and ask.
- **The overview is generated, the plans are owned.** Never edit
  `blueprint/project-plan.md` or `blueprint/build-plan.md` without showing the exact change
  and getting approval first.

## Formatting

Match `blueprint/context/ai-interaction.md` when it exists; otherwise keep output short, scannable, and direct.
