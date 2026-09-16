---
name: prototype
description: "Lock the visual direction before building, with throwaway static mockups: a theme file of design tokens plus a few standalone HTML pages showing the real screens. Runs before the build loop, and the output is deliberately disposable - the first UI item ports the tokens into the app's real stylesheet, and `ship` deletes the mockups. Use when the user runs `prototype`, wants to explore the look and feel before building, or is unsure what the interface should be."
---

# prototype - settle the look before you build it

**Writes:** `blueprint/context/design.md`

Where this sits:

    `layout` -> `scaffold` -> `ci` -> `context` -> prototype -> `spec` -> `build`

Deciding what something should look like *while* building it is expensive: every
change touches real components, real state, and real tests. Deciding it first, in
throwaway HTML, costs almost nothing to redo.

Everything this produces is disposable by design.


> **Multi-part project:** `blueprint/project-plan.md` and
> `blueprint/context/quality-bar.md` (the bar the whole product is held to -
> `architect` writes it at the root, not per part) live at the **product
> root**, not this part. Resolve it from `AGENTS.md`'s `Product root:` field.
> Everything else here is this part's own.

## Before you start

- **`blueprint/context/project-overview.md` does not exist** - `context` has not
  run. Stop and say so. This skill mocks the real screens, and that file is what
  says what they must show.
- **The plan's UI/UX section is empty** - say so before proposing anything. It is
  the direction `ideate` was meant to capture, and inventing one here means the
  user first sees a visual identity nobody chose. Ask for it, or record
  explicitly that there is no preference and you are choosing a plain default.
- **`blueprint/context/design.md` already exists, or the tokens have already
  shipped into the app's real stylesheet** - stop and say so before mocking
  anything. The mockups here are disposable and `ship` deletes them, but
  `design.md` is not: `review` measures the built UI against it, and `spec` and
  `architect` read it. **A second run that writes a fresh `design.md` can leave
  it describing a look the code does not have**, and `review` then reports a
  clean result against a bar nobody built to. Say whether this is a deliberate
  redesign - in which case the shipped theme is what has to change, and the
  mockups are the cheap place to decide how - or an accident, and stop.

## Step 1 - agree the direction first

Before any file, agree in words:

- the overall feel, and any reference the user is working from
- light, dark, or both
- how much personality: neutral and utilitarian, or distinctive
- which two or three **views** are worth mocking - the ones carrying the most
  design decisions, not all of them. **A view is not always a screen.** A
  single-page app has one screen and three or four states, and there the states
  are the unit: an empty list and a populated one make almost every decision this
  step exists to settle, while a second screen would make none. Say which you are
  mocking and why, so nobody reads one file and assumes the rest were skipped

Read `blueprint/project-plan.md`'s UI/UX section, and `blueprint/context/project-overview.md` for what the
screens actually need to show. Ask if the direction is not clear; do not
improvise a visual identity.

## Step 2 - write the theme

Create `prototypes/theme.css` holding the design tokens and nothing
else: colors including their dark-mode values, type scale, spacing scale, radii,
borders, shadows.

This file is the deliverable that survives. The mockups exist to show it working.

## Step 3 - mock the chosen views

One standalone HTML file per view in prototypes - **a screen, or a state of the
only screen** - each importing
`theme.css` and using **only** its tokens - no hardcoded colors or sizes, or the
theme is not really the source of truth.

Use realistic content. Placeholder text hides the layout problems that real
content exposes.

Keep them static: no build step, no framework, no dependency. They open in a
browser directly.

**Then run the project's verification command once.** Mockups are full of what a
linter rightly rejects in real code - placeholder `href="#"` links, repeated
markup - and a `prototypes/` directory inside the lint or format globs fails the
check locally and, once committed, in CI. `scaffold` excludes it when it
configures those tools; a project set up another way may not. **If the check now
fails on files under prototypes, exclude that directory in the tool's own
config** and say so - the one change outside prototypes this skill makes.

### Where the theme lands depends on the platform

The mockups are HTML either way - they are the fastest way to see a layout - but
**what the tokens become in the real app is not always a stylesheet:**

- **Web, website, PWA** - a real CSS file, or the framework's theme config.
- **React Native / Expo** - a TypeScript theme object, or NativeWind's config.
  **There is no CSS to port into.**
- **Flutter** - a `ThemeData` in Dart.
- **Native** - a colour and type asset catalogue.

Name the destination now, in the terms the project actually uses. "Port
`theme.css` into the stylesheet" is meaningless advice on three of those four
platforms.

## Step 4 - look at them, then review and iterate

**Open them yourself before showing anyone.** A mockup that has only been written
settles nothing - the whole reason this step exists is that seeing a layout
answers questions reading it cannot, and that applies to the person who wrote it
first. Rasterise them if there is no browser; **if nothing here can render them,
say so plainly rather than presenting unviewed files as a settled direction.**

The specific thing to check is that each element is actually **visible at a
sensible size**, not merely present in the file. An SVG or a canvas with no
intrinsic dimensions can occupy zero pixels while every attribute reads correctly.

Then show the user how to open them. Iterate on the tokens rather than on individual
mockups - a change made in `theme.css` shows up everywhere at once, which is the
whole point of the structure.

**Nothing durable is written until the user has seen them.** Every change made
here - a lighter grey, a larger title - changes a token, and a contrast value
measured before the change describes a colour that no longer exists.

## Step 5 - write the durable design record, once the direction is settled

**The mockups are throwaway. The decisions in them are not.**

`ship` deletes `prototypes/` once the look is built, and the tokens land in the
app's real theme. Everything else disappears with it: which states this app has,
what a button looks like here, the accessibility bar that was already met. The
next UI item then reinvents all of it, differently.

So write `blueprint/context/design.md`, which **survives**:

- **The direction, in a sentence.** What this app is trying to look like, so a
  later change can be judged against it rather than against taste.
- **Why the tokens are what they are** - the type scale, the neutral's hue bias,
  and **any contrast value that was measured rather than chosen**. A muted grey
  and an unreadable grey look identical to someone with good vision on a good
  screen; without the number, someone will lighten it back.
- **The states this app has** - loading, empty, error, and what each looks like.
  These are the ones every feature needs and every feature otherwise invents
  fresh.
- **Component conventions** - what a button, an input, a message looks like here.
  Only the ones that exist; do not invent a component library.
- **The accessibility bar actually met** - the standard, and what was checked
  against it. A bar met once and unrecorded is a bar that quietly slips.

Keep it short. This is a record of decisions, not a design system - and an
unmaintained design system is worse than none.

**Measure contrast against the tokens as they are now**, after the last
iteration - not a value carried over from a round the user changed.

Then say explicitly what happens next:

- `spec` links the relevant mockups as the design reference for a UI item
- that item's **first build step** ports the tokens into wherever this platform
  keeps its theme - a stylesheet, a theme object, `ThemeData`, or an asset
  catalogue
- `ship` deletes prototypes once the look has been built

## Rules

- **Throwaway means throwaway.** No framework, no build step, no logic. A mockup
  that grows real behavior has become the app, badly.
- **Tokens only in the mockups.** A hardcoded color is a decision that will not
  survive the port.
- **Do not touch the real app.** This skill writes inside prototypes,
  `blueprint/context/design.md`, and - only when a check trips on the mockups -
  the exclusion in Step 3.

## Formatting

Match `blueprint/context/ai-interaction.md` when it exists; otherwise keep output short, scannable, and direct.
