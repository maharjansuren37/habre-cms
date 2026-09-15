---
name: migrate
description: "Change the database schema safely - write the migration, work out whether existing data needs backfilling, check the change is reversible, and apply it to one environment at a time. Treats a destructive change as needing its own explicit approval, and separates the schema change from the code that depends on it so a rollback stays possible. Use when the user runs `migrate`, needs a schema change, is adding a field or table, or when a build step requires the data model to change."
---

# migrate - change the shape of the data without losing any

**Writes:** `dev-notes/decisions.md` · `dev-notes/status.md` · `blueprint/context/findings.md`

Where this sits:

    architect (the data model) -> spec -> migrate -> build -> ship -> deploy

> **Multi-part project:** `blueprint/project-plan.md` and
> `blueprint/context/quality-bar.md` (the bar the whole product is held to -
> `architect` writes it at the root, not per part) live at the **product
> root** - a part has no `project-plan.md` of its own, so an unqualified read
> finds nothing. Resolve the root from `AGENTS.md`'s `Product root:` field.
> Everything else here is this part's own.

`architect` designed the data model. This changes it, later, without losing what
is already stored.

**This is the most irreversible thing in the whole workflow.** Code can be
reverted from git; a dropped column cannot be reverted from anything but a backup.

## Before you start

**If the project has no database, stop and say so** - check the Tech section of
`blueprint/project-plan.md`. If it has one but no data model in the Architecture section, `architect`
has not run and there is no agreed shape to migrate towards.

Know which environment you are targeting, and **say it out loud**. Take it from
the Environments table in `AGENTS.md`, and **read that row's real-data column** -
that is the field this whole skill turns on. A schema change against an empty
development database is trivial; the identical change against real rows is the
most irreversible thing in this workflow.

**If the row says it holds real data, or the environment is not in the table at
all, treat it as holding real data.** An unrecorded environment is not a safe
one, it is an unknown one.

For anything other than local development, confirm **a backup exists and is
recent** before touching the schema. If there is no backup, stop - getting one is
`host`'s job and it comes first.

## Step 1 - work out what actually needs to change

From the current spec or the data model in `blueprint/project-plan.md`:

- what is being **added** - a table, a column, an index
- what is being **changed** - a type, a constraint, a default
- what is being **removed** - and this is the dangerous one

Then the question that matters most: **does existing data need to change too?**
A new non-null column on a table with rows needs a value for every one of them.
A renamed column needs its data moved. **A migration that only changes the schema
and forgets the data is the most common way this goes wrong.**

## Step 2 - make it reversible, or say that it is not

For each change, know how to undo it:

- **Adding** - reversible. Drop it.
- **Changing a type or constraint** - usually reversible, sometimes lossy. Say
  which. Narrowing a type loses whatever did not fit, permanently.
- **Removing** - **not reversible.** The data is gone.

**Expand and contract, when data matters.** Rather than renaming in one step:

1. add the new column
2. write to both, backfill the old rows
3. move readers to the new column
4. remove the old one, later, once nothing reads it

That is several deploys rather than one, and it means **no single step is
destructive** - each one can be rolled back on its own. Use it whenever the table
holds data someone would miss.

## Step 3 - propose it, then stop

Show:

- the migration, as it will run
- the **reverse** migration, or a plain statement that there is not one
- any **backfill**, and how long it will take on the real row count
- whether the table is **locked** while it runs, and what that means for a live app
- what a deployed application would do if it ran **against the new schema without
  the new code**, and the other way round

**A destructive change needs its own explicit approval**, naming what will be
lost. Never fold "and this drops the old column" into a longer list and treat
silence as consent.

## Step 4 - apply it, one environment at a time

**Development first, always.** Then staging if it exists. Production last, and
only after the earlier environments worked.

For each: run it, confirm the schema matches what was intended, confirm the
backfill covered every row, and run the verification command.

**Migrations run before the code that depends on them**, as their own step, so
that a code rollback does not leave the application talking to a schema it does
not understand.

## Step 5 - record it

- what changed, in which environments, when
- whether it is reversible, and how
- anything left for later - the contract half of an expand-and-contract

Update `dev-notes/status.md`, and add a `dev-notes/decisions.md` entry when the
change was a real decision rather than a mechanical addition.

## Platform notes

- **An ORM with its own migration tool** - use it. Generated migrations still get
  read before running: they guess at intent, and sometimes guess wrong.
- **No migration tool** - keep numbered SQL files in the repository and a record
  of which have run. Never change one that has already run anywhere.
- **Mobile with a local database** - migrations run **on the user's device**, on
  a version you do not control, possibly several versions behind. It must handle
  every version still in the wild, and **it cannot be rolled back at all** once
  shipped.

**When this skill repairs a finding** - a `preflight` blocker such as a schema change with no way back - **set it to `fixed`** in `blueprint/context/findings.md`, with the evidence in its **Resolution** line: the down migration ran against a copy and the data survived it. **Never `closed`**: `preflight` re-checks it and closes it, because a repair is examined by something other than what made it. Left `open`, it blocks every later `ship` in this part.

## Rules

- **Name the environment before acting.**
- **Never run a destructive migration without approval that names what is lost.**
- **Never change a migration that has already run** anywhere. Write a new one.
- **Back up before touching an environment with real data.**
- **Schema first, then code.** Separate steps, always.
- **Test the reverse**, not just the forward.

## Formatting

Match `blueprint/context/ai-interaction.md` when it exists; otherwise keep output short, scannable, and direct.
