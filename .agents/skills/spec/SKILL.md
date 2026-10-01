---
name: spec
description: "Turn one work item into a buildable spec in blueprint/context/current-work.md. With no argument, specs the next unchecked item in `blueprint/build-plan.md`; with a number or name, that one; with a bug or small change described in prose, an ad-hoc fix; with --quick and a bug, a one- or two-file fix as a single test-first step; with --preview, explains an upcoming item without writing anything. Splits anything too big, writes small build steps with observable done-when criteria, red-teams its own draft, and stops at a review gate. Use when the user runs `spec`, names or numbers a feature, reports a bug to fix, asks to break down or start the next thing, or asks what an upcoming feature involves."
---

# spec - turn one item into something buildable

**Writes:** `blueprint/context/current-work.md` · `blueprint/context/needs-you.md` · `blueprint/build-plan.md` · `blueprint/project-plan.md` · `blueprint/context/design.md` · `blueprint/status/`

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
- **The project has a UI and `blueprint/context/design.md` does not exist** -
  stop and say to run `prototype` first. A UI means the plan's platform is one
  that renders: a web app, a content website, a PWA or a mobile app. **Design
  is not optional where there is something to see**: without the record, every
  item invents its own answer to the same questions - the empty state, the
  error message, the focus ring - and the first screen built becomes the look
  by accident. `prototype` also covers an app that already has a look: it
  records what is there rather than proposing something new.

  Three cases pass this: a CLI, a library or an API with no UI, where there is
  nothing to design - say so in one line; a **fix**, which repairs what exists
  and must not wait on design work - name the missing record in the spec's
  Notes instead; and `--preview`, which writes nothing.
- **`blueprint/context/coding-standards.md` is still unfilled prompts** while
  real code exists - mention it. `blueprint/context/fundamentals.md` still
  applies, being the pack's own and always present, but `build`
  is told to prefer that file over generic best practice, so unfilled prompts
  silently remove the project's own conventions from every step this spec
  produces. `scaffold` fills it for a new project, `setup` for one that already
  had code.

## Input

Six modes, chosen from the argument - a plan addition arrives two ways:

| Argument | Mode | Writes |
|---|---|---|
| *(none)* | Next unchecked item in `blueprint/build-plan.md` | the spec |
| a number or name | That specific planned item | the spec |
| prose describing a bug or small change | Ad-hoc fix, not a plan item | the spec |
| `--quick` *(with prose describing a bug)* | Quick fix - an ad-hoc fix on the short path, below | the spec |
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

### The quick path - `--quick`

**A fix too small to earn the whole loop gets a shorter one.** A one-line
repair taken through sizing, a red-team pass, a subagent packet, `verify` and
`review` spends more on ceremony than on the fix, and a loop that costs that
much for a typo teaches people to skip it altogether - which is worse than a
short loop. It qualifies only when **every** one of these holds, checked
against the code in Step 1, not against how the bug was described:

- **It is a fix** - it repairs what exists and adds no capability.
- **It changes at most two files outside `blueprint/`**, not counting their
  tests.
- **It changes no stored data, no contract, no dependency and no environment
  variable** - so the spec's Data and contracts, Decisions and Production needs
  are all "none".
- **Its Behaviour changes add a claim and nothing more** - the regression's
  claim, or "None". Changing or removing a claim is a decision about what the
  product does, and that is not a quick fix.
- **It touches nothing `blueprint/context/quality-bar.md` names** - a hot path,
  authentication, personal data - and no security boundary. Those always get
  `review`, however small the diff.
- **The defect can be reproduced** by a test the project's runner runs, or,
  with no runner, by one command whose output shows it.

**If any one fails, say which and spec an ordinary fix instead.** Never stretch
a criterion to keep the short path: the limits are what make skipping `review`
safe, and a quick fix that is not small is an unreviewed change with a label on
it.

What the short path changes: **one build step**, whose done-when is the
reproduction - the test that fails now and passes after the repair. Step 2 and
Step 4 are skipped; in their place, check the draft against the list above
once more. The spec carries a `**Quick:**` line, which is what `build` and
`ship` read. What it keeps: the spec in `current-work.md`, the gate in Step 5,
a branch, the test seen failing first, `ship`'s findings gate and one commit.

## Step 1 - pick the target and the mode

Read the project's state before acting:

- `blueprint/context/project-overview.md` - the source of truth for what this project is
- `blueprint/context/coding-standards.md` - the conventions this project's code follows
- `blueprint/context/fundamentals.md` - the pack's conventions; not loaded by default, so read it here
- `blueprint/context/current-work.md` - the one item in flight, if any
- `blueprint/context/findings.md` - open review findings against the current work

Then resolve what is being spec'd:

- **A number or name matching a build-plan item** - use it.
- **No argument** - read `blueprint/build-plan.md` top to bottom and take the first
  unchecked leaf (a plain item, or the first unchecked sub-item under one that has
  been split). Completed items are checked off, so the first unchecked item is
  always what is next. **If `blueprint/findings/backlog.md` holds five or more
  findings, offer a tidy item first** - one fix spec repairing them in a batch,
  grouped by file - and take the plan item if the user declines. The backlog is
  not loaded, so nothing else brings it back; a P3 left there forever is a
  finding that was deleted without anyone deciding to.
- **A bug or small change** - this is a fix. It gets a spec marked `Type: Fix`
  with no build-plan number, and nothing is added to the plan. A fix repairs or
  adjusts what exists; it does not add a product capability.
- **`--quick` with a bug** - check it against the quick path's list above
  before anything else, and read the files it would touch to do so. If it
  qualifies, it is a fix on the short path; if not, say which criterion failed
  and continue as an ordinary fix.
- **A genuinely new capability with no match in the plan** - follow the intake
  below. Never silently add scope to a file the user owns.

If the build plan is a plain list with no `- [ ]` boxes, treat every item as
unchecked, take the first, and offer to convert the list to a checklist so
progress is trackable from here on. Proceed either way.

State which item you are spec'ing, and in which mode, before going further.

**If `blueprint/history/abandoned/` holds a spec for this item**, say so, with its
reason and branch, and ask whether to resume from it - or write a new spec,
leaving the archive as the record of the first attempt.

To resume, **check out the branch before restoring anything.** The branch still
carries its own committed `current-work.md` and `findings.md`, so checking it out
brings the spec back with its ticks and the ledger back with it, and there is
nothing to copy. Writing the archive onto `main` first only makes the checkout
refuse: git will not overwrite a local change to that file. Restore from the
archive only when the branch is gone, and then **drop the `**Abandoned:**` and
`**Branch:**` lines and the whole `## Findings` section** that `ship --abandon`
appended - that is the record of the attempt, not part of the spec, and its IDs
are prefixed for the archive. Either way, remove the abandoned note from the
item's plan line.

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

**A quick fix skips this step** - it is one step by definition. Go to Step 3.

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
    **Quick:** yes - <files it touches; each criterion held>   (only for --quick)
    **Verified:** not yet
    **Reviewed:** not yet

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
    ## Decisions
    Choices this item makes that the plan does not already answer and later
    items will build on - an id type, a limit, a session rule - each with what
    it beat. `ship` records them in dev-notes/decisions.md. "None" is an answer.
    ## Production needs
    What production must have before this item can run there: new environment
    variables by name, migrations, external accounts or services, a changed
    host setting. `ship` carries it to blueprint/production-pending.md. "None"
    is an answer.
    ## Behaviour changes
    What this item adds to, changes in, or removes from what the product does
    now, against `blueprint/capabilities/` - one line each, below. `ship` merges
    it. "None" is an answer.
    ## Notes
    Conventions and constraints to respect.

**The Decisions section is how a choice outlives the item.** `ship` resets this
file, and the archive under `blueprint/history/` is not where anyone looks for why
the project is shaped the way it is. On a real run a spec settled UUID ids, a
password rule, logout on every device and a folder the layout never named - and
none of it reached `dev-notes/decisions.md`, because nothing carried it there.

**Production needs are how a release stops being a surprise.** The spec is the
one place that knows an item needs a new variable or a migration; unless it
says so, nothing carries that to the deploy, and several items can merge
before anyone notices production lacks them. Name every variable the item's code reads that did not exist
before, and every migration it adds.

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

**A done-when that needs a new kind of test says where that test runs.** A test
that needs a database, a browser, a device or a network service cannot run
wherever the others do. When a done-when asks for one, say which command runs
it and where that command runs - locally, inside `verify`, in CI - and check
that place has what the test needs. On a real run a spec asked for
database-backed unit tests while `npm test` sat inside `verify`, which CI runs
with no database: a done-when the project's own checks could never satisfy. If
the place does not have it, the spec either adds a step that provides it or
puts the test under a separate command and says CI does not run it.

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

**Every journey in `design.md` this item passes through is a done-when**, walked
end to end: from the first click to the final screen, checking the final URL
and what it shows, as a full page load and through the app's own navigation.
A screen that works on its own says nothing about the path through it - signing
in from a protected page, or resetting your own password, can end on a 404
while every screen involved passes. The journeys come from
`blueprint/design-kit/ux-checklist.md`; `prototype` records which apply.

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

**Behaviour changes are how what holds now stays written down.** Before writing
the section, list `blueprint/capabilities/` and open the files for the areas the
item touches; write the section against their current claims, not from memory.

    ## Behaviour changes
    - Adds to `accounts`: <claim> - Step 2
    - Changes `accounts.2` from "<old text>" to "<new text>" - Step 3
    - Removes `lists.4`: <why>
    - New capability `billing`: <claim> - Step 1

- **A claim is one observable behaviour** - the done-when standard.
- **Every added or changed claim names the build step whose done-when proves
  it**, so nothing enters a capability file that `verify` has not seen hold.
- **A change carries the old text and the new.** The capability file keeps only
  the current text; without the old one, `rollback` has nothing to restore.
- **By type:** a feature adds, changes and removes. A fix usually adds the
  regression's claim, and changes one only when the intended behaviour itself
  was wrong. A quick fix may add one, nothing more.
- **No capability files but existing archives in `blueprint/history/`:** say
  that `verify --all` would seed them, write the section for this item alone,
  and do not block.

## Step 4 - red-team your own draft

**A quick fix skips this step.** Check the draft against the quick path's list
instead, and if it no longer qualifies - the reproduction reached a third file,
or a stored shape - drop the `**Quick:**` line, say why, and run this step as
for any fix.

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
  it a vague "it works"? Make it concrete. Where does the test behind it run?
  Can the command that checks it actually run there?
- **Contradiction.** Does this item contradict a claim in
  `blueprint/capabilities/` that its Behaviour changes did not declare as
  changed or removed? Declare it, or change the item.
- **Visual fidelity.** If this is visual work, is a reference actually linked, or
  are we about to build a design blind from prose?

Apply the fixes to blueprint/context/current-work.md.

## Step 5 - stop at the gate

Present the spec, leading with a short **what the critique changed** note - the
splits, gaps, or scope cuts Step 4 produced, or "nothing, the draft held up."

That note is the point. It shows the gate working before a line of code exists.
**For a quick fix, lead with why it qualifies instead** - the files it touches
and each criterion it was checked against - and say that `build` will hand it
straight to `ship`, so the user can ask for the full loop now.

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
