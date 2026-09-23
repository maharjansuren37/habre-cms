---
name: layout
description: "Decide where the code physically lives - the source root, how each part maps to a directory, and where config files sit - using the chosen framework's own conventions rather than an imposed shape. Runs between `stack` and `scaffold`: a layout is knowable only once the framework is known, and installing into a shape that is about to move is the expensive way round. Records the decision in the plan's Architecture section so `scaffold` builds into it and every later skill resolves paths the same way. Use when the user runs `layout`, has a stack chosen and needs the directory shape before scaffolding, or asks where a file should go."
---

# layout - where the code physically lives

**Writes:** `blueprint/project-plan.md` · `dev-notes/decisions.md`

Where this sits:

    `architect` -> `stack` -> layout -> `scaffold` -> `ci` -> `context`

**`architect` decided how many deployable parts there are and why. `stack` chose
what they are built with. This decides where the files go** - and it sits here
because it is the first question that genuinely needs both answers.

A layout is **a framework convention, not an architectural decision**. The same
architecture takes opposite shapes in different ecosystems: a flat source root is
idiomatic in one and broken in another, because a .NET `.csproj` globs everything
beneath it and will silently swallow a sibling project. Deciding this before the
framework is known means deciding it twice; deciding it after `scaffold` has run
means moving every path that a generated config file points at.

> **Multi-part project:** `blueprint/project-plan.md` and
> `blueprint/context/quality-bar.md` (the bar the whole product is held to -
> `architect` writes it at the root, not per part) live at the **product
> root**, not this part. Resolve it from `AGENTS.md`'s `Product root:` field.
> Everything else here is this part's own.

## Before you start

**If the Tech section of `blueprint/project-plan.md` is still placeholder text,
stop and say to run `stack` first.** There is no convention to follow until there
is a framework, and a layout invented without one is the imposed shape this skill
exists to avoid.

**If the Architecture section is still placeholder text, stop and say to run
`architect` first.** The part count is the input: one application and three
deployable services are different questions, and only one of them is about
directories at all.

**If the parts already exist** - `new-project.sh --parts` and `convert-to-parts.sh`
create them as top-level directories before this skill runs - **take where they
are as the default** and decide the layout inside each part. When the framework
genuinely wants them elsewhere (`apps/web` in a JavaScript workspace), a part
cannot simply be renamed: its `AGENTS.md` `Product root:`, the root `AGENTS.md`
listing and the board all name it, and `architect` has already written its build
plan. Before any code exists, and after approval in Step 4, move it like this:

1. Copy the part's `blueprint/` and `dev-notes/` somewhere outside it, **and keep
   the text of its line in the root `AGENTS.md` listing.**
2. Delete its line from the root `AGENTS.md` listing, then its directory.
3. Seed the new path: `lib/seed-part.sh <product root> apps/web` - it writes the
   right `Product root:` and the listing, and keeps the board entry and status
   file, which are keyed on the part's name.
4. Copy the saved `blueprint/` and `dev-notes/` back into the new directory, then
   **write the part's description back onto its new listing line.** Step 3 seeds
   that line from the template, so what `architect` wrote about this part comes
   back as `<what this part is>` - a placeholder, in the file every session reads
   to learn what the parts are, and nothing in the move reports it.

`lib/seed-part.sh` refuses step 3 while the old path is still listed, because two
parts with one name would share a status file. Once code exists, moving a part is
the costly change the next paragraph describes.

**If a layout is already recorded and code exists in it, say what changing it
costs before proposing anything.** Every path in every config file, every import,
every CI step and the deploy target all point at the current shape. `scaffold`
installs into a layout; moving one afterwards is editing generated files, which
is where silent failures live. Small additions are not this - a new directory
inside a settled layout is ordinary work.

## Step 1 - read what is already decided

The part count and the reasons from the Architecture section; the framework,
language and versions from the Tech section. **Do not re-ask either.**

## Step 2 - take the framework's own shape

**Start from what the framework's own scaffolder produces**, and say which
convention that is. A framework's layout is not arbitrary - its build tooling,
its test discovery and its documentation all assume it, and an imposed shape
fights all three quietly.

Decide, and no more than this:

- **The source root** - and whether the framework expects one at all.
- **Where each part lives**, when `architect` said there is more than one.
  Name the directories, and **say which config file belongs to which part** -
  config lives at the root of the part that owns it, because that is where its
  tooling looks.
- **Where shared code goes**, if two parts share any. **Say how it is shared** -
  a workspace, a package, generated output - because "shared" without a mechanism
  becomes a copied file within a week.
- **What sits at the repository root** and what does not. The workflow's own
  files - `AGENTS.md`, `blueprint/`, `dev-notes/` - always live at the root, and
  in a multi-part product the root is not a part.

**Say what you are deliberately not deciding.** Where a test file goes next to
its subject is a convention `scaffold` will set; where the source root is, is not.

## Step 3 - check it against the ecosystem's traps

Every ecosystem has a shape that looks reasonable and is wrong in it. Ask
directly whether this layout hits one:

- **A project file that globs beneath itself** - .NET's `.csproj` takes every
  source file under its directory, so a sibling part inside that tree is compiled
  into it. Two parts need two directories, neither inside the other.
- **A package manager that only sees a manifest at the root** - a workspace has
  to be declared, and a part outside it is invisible to the tooling that is meant
  to run it.
- **A test runner discovering by path** - a layout that puts tests where the
  runner does not look produces a green run that executed nothing.
- **A build that copies a directory wholesale** - anything inside it ships,
  including things that should not.

**Name the one that applies, or say none does.** This step exists because these
are found at `scaffold` time otherwise, one approval too late.

**Check the layout against every tool that reads it, not the first one.** On this
skill's first real run it proved that the test runner could not resolve the
project's path alias, and chose colocated tests on that basis - correctly. It did
not check the **typechecker**, which rejects the import extension the runner
requires, so `scaffold` hit a second failure the same decision had caused.
**A layout verified against one tool is half verified.** The tools that read a
layout are usually the runner, the typechecker, the bundler and the build's file
tracing, and they disagree.

## Step 4 - stop for approval

Show the directory tree, one line per entry saying what it is for, and the
convention it follows. **Then wait.** This is the shape everything else is built
into, and it is cheap now and expensive later.

## Step 5 - record it

Write the layout into the **Architecture section** of
`blueprint/project-plan.md`, beneath the part count it implements - not into a
new file. `scaffold` builds into it, `ci` writes paths against it, and `deploy`
ships from it, and a layout recorded anywhere else is one three skills will not
find.

**Add a `dev-notes/decisions.md` entry when a real alternative was rejected** -
a monorepo over two repositories, a flat root over a nested one - with what it
costs. A layout that looks arbitrary later is one somebody will change without
knowing what it was protecting.

Then hand to `scaffold`, which installs the framework into this shape.

## Rules

- **Follow the framework, do not fight it.** An imposed layout costs something
  every day and buys nothing.
- **Decide directories, not architecture.** If a question is really about whether
  something is a separate deployable, it belongs to `architect`.
- **Never move an existing layout without saying what it costs.**
- **Record it where `scaffold` looks**, not in a file of this skill's own.

## Formatting

A tree, then the reasoning. Keep it to what was decided and why; this file is
read by people deciding where to put a file, not for pleasure.
