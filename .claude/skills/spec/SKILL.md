---
name: spec
description: "Turn one work item into a buildable spec written to blueprint/context/current-work.md. With no argument, specs the next unchecked item in `blueprint/build-plan.md`; with a number or name, specs that one; with a bug or small change described in prose, specs it as an ad-hoc fix; with --preview, explains an upcoming item without writing anything. Sizes the item, splits anything too big into sub-items, writes small build steps with observable done-when criteria, then red-teams its own draft before showing it. Stops at a review gate and never starts building. Use when the user runs `spec`, names or numbers a feature, reports a bug to fix, asks to break down or start the next thing, or asks what an upcoming feature involves."
---

# spec - turn one item into something buildable

**Writes:** `blueprint/context/current-work.md` · `blueprint/context/needs-you.md` · `blueprint/build-plan.md` · `blueprint/status/`

Where this sits:

    `blueprint/build-plan.md` -> spec -> `build` -> `verify` -> `ship`

One thin line of plan in, one reviewed spec out.

The build plan is deliberately thin - one line per item, no detail, no ordering
ceremony. Supplying that detail is this skill's job: take one item, read the full
context, and turn it into something a person could hand to anyone and have built
correctly.

This skill plans. It never writes product code.


> **Multi-part project:** `blueprint/project-plan.md` and
> `blueprint/context/quality-bar.md` (the bar the whole product is held to -
> `architect` writes it at the root, not per part) live at the **product
> root**, not this part. Resolve it from `AGENTS.md`'s `Product root:` field.
> Everything else here is this part's own.

## Before you start

`--preview` writes nothing, so only the first check below applies to it. For
every other mode, check what this skill reads and **name what is missing rather
than working around it**:

- **`blueprint/context/project-overview.md` does not exist** - `context` has not
  run. Stop and say so: a spec written against the plans' raw prose instead of the
  agreed source of truth drifts from what every other skill believes.
- **`blueprint/context/current-work.md` already holds an unfinished spec** - an
  item is in flight. Say which, and stop. Overwriting it destroys the ticked
  steps, which are the entire resume mechanism; finishing it or abandoning it
  deliberately is the user's call, not this skill's. `ship --abandon` is how it
  is set aside: it archives the spec and keeps its branch.
- **`blueprint/build-plan.md` has no unchecked items** and no argument was given -
  nothing is queued. Report that and ask, rather than inventing the next item.
- **The next unchecked item does not match what the plan says this product is** -
  stop. Placeholder items shipped in the template for a long time, and specing
  one produces a full, confident spec for a feature of a different product.
  **A plan with nothing queued is obvious; a plan queued with the wrong thing is
  not**, which is why this is a stop rather than a note.
- **`blueprint/context/coding-standards.md` is still unfilled prompts** while
  real code exists - mention it. `blueprint/context/fundamentals.md` still
  applies, being the pack's own and always present, but `build`
  is told to prefer that file over generic best practice, so unfilled prompts
  silently remove the project's own conventions from every step this spec
  produces. `scaffold` fills it for a new project, `setup` for one that already
  had code.

## Input

Four modes, chosen from the argument:

| Argument | Mode | Writes |
|---|---|---|
| *(none)* | Next unchecked item in `blueprint/build-plan.md` | the spec |
| a number or name | That specific planned item | the spec |
| prose describing a bug or small change | Ad-hoc fix, not a plan item | the spec |
| an observation from `monitor` - a slow path, an unused feature, a repeated request | Plan addition, gated | the plan line, then the spec |
| **a new feature described in prose** - something the plan does not have | Plan addition, gated | the plan line, then the spec |
| `--preview` *(optionally with a number or name)* | Read-only briefing | nothing |

**A new feature is a plan addition, not an ad-hoc fix.** The two look alike from
the outside - both arrive as prose - and they end up in different places. A fix
repairs something already built and needs no plan line. A feature is new scope:
it gets a numbered item in `blueprint/build-plan.md` **before** it is spec'd, so
`ship` can tick it, `progress` counts it, and the plan still describes the
product afterwards. Ask which it is when it is genuinely unclear; guessing "fix"
is the cheaper mistake to make and the harder one to notice, because the work
lands and the plan quietly stops being true.

**Check the deferred list first.** Section 11 of `blueprint/project-plan.md` is
where `ideate` records what was cut and when it should come back - *"editing and
deleting sessions, soon after"*. **Nothing else reads that table**, so an item
sitting there stays there forever unless someone looks. If the feature is already
on it, **move it rather than adding a second line**, and say that is what you did:
the deferred entry carries the reason it was cut, which is context the new item
should inherit rather than lose.

**A finished plan is the normal case for this.** Every item checked means the
first version is done, not that the project is - and adding the next item is how
it continues. Do not treat a complete plan as a reason to route this into a fix.

`--preview` exists for deciding *whether* to build something. It reads the same
context and reports what the item is, what it depends on, what it will touch, how
big it is, and whether it will need splitting - then stops. Nothing is written, so
it is safe to run while thinking about ordering.

## Step 1 - pick the target and the mode

Read the project's state before acting:

- `blueprint/context/project-overview.md` - the source of truth for what this project is
- `blueprint/context/coding-standards.md` - the conventions this project's code follows
- `blueprint/context/current-work.md` - the one item in flight, if any
- `blueprint/context/findings.md` - open review findings against the current work

Then resolve what is being spec'd:

- **A number or name matching a build-plan item** - use it.
- **No argument** - read `blueprint/build-plan.md` top to bottom and take the first
  unchecked leaf (a plain item, or the first unchecked sub-item under one that has
  been split). Completed items are checked off, so the first unchecked item is
  always what is next.
- **A bug or small change** - this is a fix. It gets a spec marked `Type: Fix`
  with no build-plan number, and nothing is added to the plan. A fix repairs or
  adjusts what exists; it does not add a product capability.
- **A genuinely new capability with no match in the plan** - follow the intake
  below. Never silently add scope to a file the user owns.

If the build plan is a plain list with no `- [ ]` boxes, treat every item as
unchecked, take the first, and offer to convert the list to a checklist so
progress is trackable from here on. Proceed either way.

State which item you are spec'ing, and in which mode, before going further.

**If `blueprint/history/abandoned/` holds a spec for this item**, say so, with its
reason and branch, and ask whether to resume from it: restore it to
`blueprint/context/current-work.md` with its ticks, check out the branch it
names, and remove the abandoned note from the item's plan line - or write a new
spec, leaving the archive as the record of the first attempt.

**In a multi-part project, claim this part first** by writing
`<product root>/blueprint/status/<this part>.md` - the path from `AGENTS.md`'s `Product root:`, **not** this part's
own `blueprint/`, which is a different directory, and **in a git worktree, resolve
it under the main checkout** (`orchestrate` gives the command) so every session
writes one board. Read the board before you do. If this part is blocked, stop
and say so rather than spec'ing work that gets thrown away.

**If the contract is not frozen, stop - unless this part owns it** (`Owner:`
under *The contract* in the product root's `AGENTS.md`). **The owner specs and
builds first**: the items that define the contract are what there is to freeze,
so they cannot wait for the freeze. Only consuming parts wait for it.

Write **every field, not just `State:`**:

    **State:** spec'ing
    **Item:** <the build-plan number and name being spec'd>
    **Blocked on:** -
    **Review packet:** -
    **Updated:** <today>

A field left at `-` because nobody bothered is indistinguishable from one that is
genuinely empty, and `orchestrate` cannot tell the difference either.

**If spec'ing reveals this item cannot proceed** - it needs another part's
unshipped work, or a contract change - **record the block instead of just saying
it**:

    **State:** blocked
    **Item:** <the item being spec'd>
    **Blocked on:** api - the /orders endpoint this screen reads
    **Review packet:** -
    **Updated:** <today>

Then stop. **Naming the block in the conversation is not recording it**: the
transcript disappears, `orchestrate` reads the file, and a block that only ever
existed in a transcript is one the coordinator can never see, route around, or
detect as half of a deadlock. Clear it back to `-` on the next session that finds
the dependency landed.

**Every session claims, not just unattended ones.** A board that only reflects
`autopilot` runs reports a part as idle while a person is actively building in
it, which is worse than no board - it is a coordination file that quietly
misleads the coordinator.

### New-capability intake

1. Search checked and unchecked items for an existing or near-duplicate entry. If
   the request might just be a different name for something already planned, show
   the closest matches instead of creating new scope.
2. If it is genuinely new, propose one item-sized checkbox line and where it
   belongs. Preserve completed items and their numbering - archived specs refer
   back to those numbers. Use the next unused whole number.
3. Check whether it materially changes the product direction, users, data, stack,
   or deployment. If so, include exact proposed edits to the relevant
   `blueprint/project-plan.md` sections. An incremental addition normally touches only
   blueprint/build-plan.md.
4. **Stop for approval before editing either plan.** Show the complete proposed
   change, including any project-plan edits.
5. After approval, write the plan changes, run `context` to regenerate the
   overview, then continue from Step 2 with the new item as the target. If
   `context` surfaces a contradiction the user must resolve, stop there -
   do not spec against unresolved context.

## Step 2 - size it, and split if it is too big

Judge how big the item actually is:

- **Buildable and reviewable as one unit** - one spec. Continue to Step 3.
- **Too big for one reviewable spec** - split it. Propose a short list of
  sub-items (title plus one line each), let the user adjust, then write them back
  under the parent as an indented checklist (`4a`, `4b`, `4c`). Spec only the
  **first** sub-item now; the rest are picked up on later runs.

Two levels of breakdown, easy to confuse:

- **Sub-items** (here) - each is big enough to stand alone: its own branch, spec,
  review cycle, and archive entry.
- **Build steps** (Step 3) - small diffs *within* one item.

Worked example. "Authentication" is too big for one spec, so it splits:

    - [ ] 4. Authentication
      - [ ] 4a. Registration - sign-up page, create the account record
      - [ ] 4b. Login - sign-in page and session
      - [ ] 4c. Route protection - gate the private routes, plus sign-out

Within 4a, the *steps* are smaller still: the registration page UI, then the
submit handler with validation and redirect. The page and its logic are steps, not
separate items.

This sizing call belongs here, which is exactly why the build plan stays thin.

## Step 3 - write the spec

Write the spec to `blueprint/context/current-work.md`, filling every section:

    # <Feature | Fix>: <name>

    **From build plan:** item <n>        (omit for a fix)
    **Type:** Feature | Fix
    **Status:** not started

    ## Goal
    What this delivers, in a sentence or two, and why it matters.

    ## In scope
    ## Out of scope
    What it deliberately does not touch, and which later item picks it up.

    ## Design reference
    Only for visual work - see below. Omit otherwise.

    ## Build steps
    - [ ] **Step 1 - <name>** - what you build. *Done when:* <observable>.
    - [ ] **Step 2 - <name>** - what you build. *Done when:* <observable>.

    ## Files and areas
    ## Data and contracts
    Schema, types, or API shapes involved, or "none yet."

    ## Testing
    ## Notes
    Conventions and constraints to respect.

The build steps are a live checklist. `build` ticks each one off as it
lands, so a session that resumes after a context clear reads which boxes are
checked and continues from the first unchecked step. Write them to be read that
way.

**Read `blueprint/context/quality-bar.md` if it exists.** If this item touches
anything the bar names - a hot path, a query over a growing table, authentication,
anything handling personal data - **one of its done-whens must be the bar's own
number**, not "feels fast". A bar that no spec ever turns into a checkable
criterion is decoration. If the item breaches the bar and that is intended, say so
and route back to `architect`: changing the bar is an architecture decision, not
something a spec settles quietly.

**A design record can be wrong, and building is how you find out.** `prototype`
writes `design.md` from static mockups, which cannot show everything — a decision
that reads well in HTML can turn out to be unbuildable, or to contradict another
line in the same file. **When an item discovers that, say so in the spec and
update `design.md` as part of that item**, with the reason. The alternative is a
record the code has quietly diverged from, which is worse than no record: `review`
checks against it and would be measuring the wrong thing.

**This is the exception, not the routine.** Re-deciding the look while building is
what `prototype` exists to prevent. The bar is that the record is *wrong*, not
that it is inconvenient.

**For UI work, read `blueprint/context/design.md` if it exists** and build against
it - the states, the component conventions, the contrast values already measured.
It is there so each feature does not invent its own answer to questions this
project already settled. If the item needs something the record does not cover, a
new state or a new component, **say so in the spec**: that is a design decision,
and it belongs in the record afterwards rather than only in the code.

**A feature that changes stored data needs a migration step.** If this item adds
a field, a table, or an index - or changes the shape of something already stored -
say so in Data and contracts, and make the migration its **own build step, before
the code that depends on it**. Then point at `migrate` when that step is built.

This matters most on a project that is already live: a schema change against an
empty development database is trivial, and the same change against real rows is
the most irreversible thing in this workflow. Planning it as an afterthought is
how that gets discovered at the wrong moment.

**Visual work needs a visual reference.** If the item is "make it look like this"
- matching a mockup, recreating an existing design - prose underspecifies the
target and the build will approximate it wrong. Ask for a screenshot if none was
given, save it under blueprint/reference, and link it. If prototypes
exists, link the relevant mockups instead: they carry the exact tokens, so they
beat a flat image. Make porting the tokens into wherever this platform keeps its theme - a
stylesheet on web, a theme object in React Native, `ThemeData` in Flutter - the
**first** build step, before any component is built against it.

This is a draft. Do not present it yet.

## Step 4 - red-team your own draft

Turn on the spec and try to break it. Here, before any code exists, is the
cheapest place in the whole workflow to catch a scope problem or an oversized
step. Run the draft against each of these:

- **Coverage.** What does this need that no step delivers? Push on what a
  happy-path spec skips: empty, missing, or malformed input; error, loading, and
  empty states; the first-run case; failure of anything external it calls.
- **Step size.** Would any step's diff be too big to read in one sitting? Split it.
- **Order.** Does each step leave the app working, depending only on earlier
  steps and never a later one? Resequence if not.
- **Contracts.** Is any type, route, or stored shape that a later item will touch
  left undefined here? Lock it now and mark it load-bearing.
- **Scope honesty.** Is anything creeping in that belongs to a later item? Is
  anything pushed out of scope that this genuinely cannot ship without?
- **Done-whens.** Is each one observable and checkable by `verify`, or is
  it a vague "it works"? Make it concrete.
- **Visual fidelity.** If this is visual work, is a reference actually linked, or
  are we about to build a design blind from prose?

Apply the fixes to blueprint/context/current-work.md.

## Step 5 - stop at the gate

Present the spec, leading with a short **what the critique changed** note - the
splits, gaps, or scope cuts Step 4 produced, or "nothing, the draft held up."

That note is the point. It shows the gate working before a line of code exists.

Then tell the user to review and adjust, and that `build` is next. This
skill never starts building.

**A step only a person can do is recorded, not buried in the spec.** If an
item needs a real device, a screen reader, an API key, a decision you cannot
make, or an account nobody has yet, add a line to
`blueprint/context/needs-you.md` naming the item it blocks. The spec still
describes the step; the record is what makes it visible before `build`
reaches it and stops.

## Rules

**Small steps, each one reviewed.** Every step ends with the app working and a
diff small enough to read in full. If a diff is too big to read in one sitting,
the step was too big - split it. That review gate is the entire point of this
workflow; batching the work into one large diff defeats it.

**Build only what the spec says.** If the spec is wrong, thin, or missing a case,
stop and fix the spec first - do not improvise past it. Work that nobody spec'd
is work nobody reviewed.

- **The plans belong to the user.** Never edit `blueprint/build-plan.md` or
  `blueprint/project-plan.md` without showing the exact change and getting approval.
- **Lock data contracts early.** A shape a later item depends on gets defined
  here, not improvised then.
- **One item at a time.** If a parent has unchecked sub-items, spec the first
  one, not the parent.

## Formatting

Match `blueprint/context/ai-interaction.md` when it exists; otherwise keep output short, scannable, and direct.
