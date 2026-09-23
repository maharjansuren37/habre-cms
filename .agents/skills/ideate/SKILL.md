---
name: ideate
description: "Turn a rough idea into a filled-in project plan by interviewing about what you are building, who it is for, and what the first version must do - then writing `blueprint/project-plan.md` and a starting build-plan.md checklist. Pushes back on scope that is too big for a first version, and names what is deliberately not being built. Says plainly when an idea is not ready to build yet, rather than only cutting scope inside one assumed worth building, and records the project's non-negotiable commitments in `blueprint/context/principles.md`. With --rescope, changes the scope of a project that has already built things, carrying completed items and their history across rather than overwriting the plan. Use when the user runs `ideate`, is starting something new and has only a rough notion of it, asks whether an idea is worth building, asks how to plan a project, or needs to change what an existing project is for."
---

# ideate - turn a rough notion into a plan you can build from

**Writes:** `blueprint/project-plan.md` · `blueprint/build-plan.md` · `blueprint/context/principles.md` · `dev-notes/decisions.md`

Where this sits:

    ideate -> `architect` -> `stack` -> `layout` -> `scaffold` -> `ci` -> `context`

This is the very start. It normally runs in a project that has the workflow but
no code, no stack, and empty planning docs. **It decides what to build; `stack`
decides what to build it with.** Keep those separate - choosing a framework
before the problem is clear is how projects end up shaped by their tools.

It also runs when a project that already exists needs to become something else -
see *Rescoping* below, which is the same interview against a plan that is not
empty.


> **Multi-part project:** `blueprint/project-plan.md` and
> `blueprint/context/principles.md` live at the **product root**, not this
> part - like `blueprint/context/quality-bar.md`, which `architect` writes
> there next. Resolve the root from `AGENTS.md`'s `Product root:` field.
> Everything else here is this part's own.

## Before you start

**If `blueprint/project-plan.md` still holds the seeded instruction text**, this
is a fresh project: run the interview below and write both plans.

**If it is already filled in, stop and report what exists** before proposing
anything - how many build-plan items are checked, whether `blueprint/history/`
holds archived work, and whether `current-work.md` has an item in flight. Then
name `ideate --rescope` and wait for the user to ask for it.

**Never rewrite a filled plan without that argument.** The default path proposes
a whole new build plan, and someone approving one in good faith erases the
`- [x]` marks that are the entire resume mechanism: `build` continues from the
first unchecked step, so a rewritten plan makes every finished item look unbuilt.
The plan is cheap to regenerate. **The record of what was actually built is not.**

## Input

| Argument | When | What it does |
|---|---|---|
| *(none)*, plan still seeded | a new project | the interview below; writes both plans |
| *(none)*, plan already filled | arrived here by habit | **stops** and reports what exists |
| `--rescope` | the project is now for something else | the interview, reconciled against what is already built |

## Step 1 - understand the idea

Ask about the idea itself, not its implementation. Most of these can be answered
in a sentence:

- **What is it, in one sentence?** If that sentence is hard, the idea is not
  clear yet - and the interview is more useful than the plan.
- **What problem does it solve, for whom?** Be specific enough that it rules
  something out. "For everyone" describes nothing.
- **Who uses it** - just the user, or other people with accounts?
- **What does it need to do to be useful at all?** Not the full vision: the
  smallest thing that would actually get used.
- **What does it store**, if anything?
- **Constraints** - a deadline, a budget, something it must work with, a
  platform it must run on.
- **Anything this project will never do or trade away, even under pressure?**
  Different in kind from a constraint: a constraint is a fact about the
  situation, this is a commitment the project holds itself to regardless of
  the situation - "no ads, ever", "nothing leaves this machine", "one person
  maintains this, so no dependency that needs a team to run". Real answers are
  rare and short; "none" is a real answer too. This is what gets proposed and
  written into `blueprint/context/principles.md` below.
- **What already exists?** A prototype, a spreadsheet, a manual process it
  replaces. Existing things carry decisions worth knowing about.
- **What should it feel like to use?** Only if it has a UI, and one or two
  sentences is plenty: the overall feel, light or dark, and **anything the user
  is already working from** - an app whose feel they want, a screenshot, a brand
  they have to match. This is a product question, not a design exercise, and it
  is cheap to ask while they are describing the thing and expensive to
  reconstruct months later. Do not propose a visual identity here; capture
  theirs, or record that there is not one yet.

Ask only what is not already answered. If the user arrives with a clear
description, confirm your reading of it and move on rather than interrogating
them.

## Step 2 - decide whether this is worth building yet

Before cutting scope, decide whether there is a first version worth cutting
scope into. Say one of three things, out loud, before moving on:

- **Go.** There is a real problem, a real user, and nothing already answers it
  well enough that building this would be wasted effort. Move to Step 3.
- **Not yet - a real answer is missing first.** Usually no identifiable user
  ("everyone" from Step 1 left unresolved), or the problem turns out to already
  have a good-enough answer nobody checked. Say exactly what is missing and
  stop - do not invent an interview answer just to get past this step.
- **This does not clear the bar, and here is why.** State the reason plainly -
  the same posture `preflight` takes when it says no-go. **This is advisory,
  never a refusal**: if the user still wants to build it, say so and continue
  to Step 3. It is their project; the point of saying it is that the decision
  gets made on purpose, not skipped.

This is the same judgment the scope-cut step below already exercises, one step
earlier and blunter: instead of asking *how small can the first version be*, it
asks *is there a first version at all*.

## Step 3 - find the first version

**The most valuable thing this skill does is cut scope.** People describe the
finished product; the plan needs the first useful version.

Sort what you heard into:

- **The core** - without this, the thing does not work at all. Usually smaller
  than the user first said.
- **Soon after** - real, wanted, and not needed to be useful on day one.
- **Later, or never** - worth naming so it stops taking up room.

Show the split and **say plainly which parts you moved out of the first version,
and why.** If the user disagrees, they are right - it is their project. But an
unchallenged first version is almost always too big, and the cost of that is
paid later, in a build that never quite finishes.

## Step 4 - propose both plans, then stop

Draft the content for the two planning docs, and show it before writing anything.

**`blueprint/project-plan.md`** - the what and why:

- the problem, the users, and the features of the first version (sections 1-3)
- what data it stores, if any (section 4)
- **constraints** (section 10) - anything that rules an option out. **`stack`
  Step 1 asks for exactly these next**, so leaving them out of the file means
  asking the user the same question twice in one sitting, and losing the answer
  entirely between sessions.
- **what is deliberately deferred, and to when** (section 11) - the output of
  Step 3, which is the most valuable thing this skill does. A cut that is not
  written down is one that gets re-litigated.
- **the UI/UX section** (section 7), if it has a UI - the feel, and any
  reference given

Leave the Tech and Architecture sections alone - `stack` and `architect` fill
those in, and guessing at them here makes their interviews harder.

**UI/UX is the opposite: fill it in.** Nothing else writes that section, and
`prototype` reads it as the direction it starts from - so an empty one means the
look gets improvised much later, by whoever happens to be building the first
screen. A rough sentence and a link to something the user likes is enough. "No
strong opinion, wants it plain" is a real answer worth recording; blank is not.

**`blueprint/context/principles.md`** - the project's non-negotiable
commitments, from Step 1's own bullet. Short - most projects have zero to three
real ones. State each as a commitment, not a feature: "no ads, ever", not "an
ad-free experience". **"None recorded" is a real, complete answer** - do not
invent one to fill the section. This file is distinct from
`blueprint/context/quality-bar.md`, which `architect` writes next: that is
measurable numbers this project is held to, this is what it will not trade away
to hit them.

**`blueprint/build-plan.md`** - the checklist:

Turn the core into items sized to one review cycle each - a few days of work at
most, one outcome, testable on its own. Order them so each builds on the last,
and so something works as early as possible.

Good: `- [ ] 1. **Save a link** - paste a URL, store it with its title`
Not an item: `- [ ] Backend`, `- [ ] Make it good`

**At a product root** - `blueprint/orchestration.md` exists - there is no build
plan to write: the build loop belongs to the parts. Put the first version's items,
in build order, into the Features section, and say `architect` splits them into
each part's build plan.

**Stop for approval.** These are the user's files, and everything downstream
reads them - `principles.md` included, since `review` and `preflight` will
audit against whatever it says.

## Step 5 - write, and hand off

Write the approved content, including `principles.md`. **Write it even when the
answer was "none"** - say so explicitly, the same reason `quality-bar.md` writes
"not measured, no target" rather than leaving a line blank: an absent file and a
real "none" read the same to a later reader only if the file says which one this
is. Then say what comes next: `architect` to establish
the shape and the quality bar, then `stack` to choose the technology against
them, then `layout` and `scaffold` to build the project.

**Say why that order, because it surprises people:** the architecture is what a
technology gets evaluated against, so choosing the technology first makes the
architecture whatever that technology happens to make easy.

If anything was genuinely undecidable - a real fork the user needs to think
about - write it down as an open question in the plan rather than picking for
them.

## Rescoping a project that has already built things

`ideate --rescope`. The interview above still applies - the problem, the users,
the first version - but the output is **a change to a plan, not a new one**, and
three things have to survive it.

**Completed items keep their checkbox and their history.** A `- [x]` item has an
archive under `blueprint/history/` and a commit behind it. Carry the line across
unchanged even when the item is no longer central to the product: deleting it
does not un-build the code, it only removes the record that the code exists.

**Work in flight is finished or abandoned explicitly, never silently dropped.**
If `blueprint/context/current-work.md` holds an item, say so and ask which.
Finishing it through `ship` first is usually cheaper than unpicking a half-built
item afterwards.

**Every item leaving the plan is named, and shipped ones are somebody's problem.**
Say whether each one shipped. An unchecked item can simply go. **A checked one
left code behind, and removing that is `rollback`'s question, not this skill's** -
route to it rather than editing the plan to pretend the feature never existed.
A plan that disagrees with the code is worse than a plan that admits it.

Then:

- **Record it in `dev-notes/decisions.md` as superseding the original scope.**
  Numbers are permanent and a superseded entry is marked, never deleted - what a
  project stopped being explains as much as what it is.
- **Leave an existing `principles.md` alone unless the user raises it.** A
  rescope changes *what* the project is for, not what it will never trade away
  to build it - those are different questions, and revisiting one just because
  the other changed would re-litigate a settled commitment for no reason
  connected to it. If the new scope genuinely conflicts with an existing
  principle, say so and ask, rather than quietly picking a side.
- **When there is no `principles.md` at all, ask Step 1's commitment question
  and write one.** That is every project adopted through `setup`, which reports
  the file unrecorded and sends the user here - **this skill is its only
  writer, so "leave it alone" on a file that does not exist means it never gets
  written.** Leaving it alone is about not re-opening a settled commitment, not
  about declining to record a first one. "None" is still a real answer and
  still gets written as one.
- **Hand off to `setup` and `context`, not `stack` and `scaffold`.** There is
  code here already: `stack` refuses a project that has any, and `scaffold`
  installs a decision made long ago. `setup` re-reads what the repo actually is;
  `context` regenerates the overview from the changed plan.
- **If the stack itself no longer fits the new scope, say so and stop.** That is
  a rewrite rather than a rescope, and it is the user's call to make deliberately
  rather than something to discover halfway through.

## Rules

- **Decide what, not how.** No frameworks, no databases, no architecture. That
  is the next two skills' work, and doing it here makes them worse.
- **Cut scope, out loud.** Say what you moved and why. A first version that is
  too big is the most common way a project dies.
- **Never invent requirements.** If it was not said, it is a question, not a
  feature. Write unknowns down as unknowns.
- **Plain language.** The plan is read by a person deciding what to build, not
  only by an agent.

## Formatting

Match `blueprint/context/ai-interaction.md` when it exists; otherwise keep output short, scannable, and direct.
