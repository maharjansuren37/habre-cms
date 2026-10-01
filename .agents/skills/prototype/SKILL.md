---
name: prototype
description: "Settle how the app or website looks and works before building it. Recommends a visual direction and a navigation structure, mocks it from the pack's design kit as throwaway static HTML, and records the decisions in design.md; for an app that already has a look, records the existing one instead. Required before the first `spec` in any project with a UI. Use when the user runs `prototype`, wants to see the screens and how they look before any code is written, wants to explore the look and feel or the navigation, asks for UI or UX recommendations, or is unsure what the interface should be."
---

# prototype - settle the look and the navigation before you build them

**Writes:** `blueprint/context/design.md`

Where this sits:

    `layout` -> `scaffold` -> `ci` -> `context` -> prototype -> `spec` -> `build`

Deciding what something should look like *while* building it is expensive: every
change touches real components, real state, and real tests. Deciding it first, in
throwaway HTML, costs almost nothing to redo.

**It starts from the pack's design kit, not a blank page.**
`blueprint/design-kit/` holds a neutral set of tokens, every component an app
or website needs in every state, and a UX checklist. This skill recommends how
to change the kit for this product, shows it, and records what was decided.
Left to invent tokens and components from nothing, every project gets a
different, partial set - and the parts nobody thought of, like an empty state
or a focus ring, are the parts that ship missing.

The mockups are disposable by design. The decisions are not.

**It is required wherever there is something to see.** `spec` stops on a
project with a UI and no `blueprint/context/design.md`, because without the
record every item answers the same design questions again, differently. A CLI,
a library or an API with no UI skips it.


> **Multi-part project:** `blueprint/project-plan.md` and
> `blueprint/context/quality-bar.md` (the bar the whole product is held to -
> `architect` writes it at the root, not per part) live at the **product
> root**, not this part. Resolve it from `AGENTS.md`'s `Product root:` field.
> Everything else here is this part's own.

## Before you start

- **`blueprint/context/project-overview.md` does not exist** - `context` has not
  run. Stop and say so. This skill mocks the real screens, and that file is what
  says what they must show.
- **`blueprint/design-kit/` is missing** - the project predates the kit. Say so
  and give the command that adds it: `install.sh --target <this project>` from
  the pack. Do not recreate it from memory; a kit written freehand is exactly
  the partial set it exists to replace.
- **The plan's UI/UX section is empty** - say so, then recommend in Step 1
  rather than stopping. It is the direction `ideate` was meant to capture, so
  **the user decides; you propose**. Never proceed on an unstated direction.
- **The app already has a look and there is no `design.md`** - a project
  adopted through `setup`, or UI built before this skill was required. Do not
  mock a new direction over it: **record the one that exists**, as *Recording a
  look that already exists* below says. `spec` stops on a UI project with no
  record, so this is the route that lets an adopted app reach it.
- **`blueprint/context/design.md` already exists** - stop and say so before
  mocking anything. The mockups here are disposable and `ship` deletes them, but
  `design.md` is not: `review` measures the built UI against it, and `spec` and
  `architect` read it. **A second run that writes a fresh `design.md` can leave
  it describing a look the code does not have**, and `review` then reports a
  clean result against a bar nobody built to. Say whether this is a deliberate
  redesign - in which case the shipped theme is what has to change, and the
  mockups are the cheap place to decide how - or an accident, and stop.

## Step 1 - classify the product, then recommend a direction

Read `blueprint/project-plan.md` - the UI/UX section and who the users are - and
`blueprint/context/project-overview.md`. Then:

**Name the product type** from section 1 of `blueprint/design-kit/ux-checklist.md`:
web app, content website, store or booking, mobile app, mixed, or a one-screen tool. It decides the
navigation pattern and the screens in Step 2, so say which and why.

**Recommend, do not just ask.** Propose two or three directions, each stated as
the **token changes** it makes to the kit - never as adjectives alone:

| | Direction A (recommended) | Direction B |
|---|---|---|
| Brand hue | the one colour that means "this product" | ... |
| Neutral | the kit's slate, or a warmer or cooler grey | ... |
| Font | the kit's system stack, or one named web font | ... |
| Radius | `--radius-md` 8px, or sharper or rounder | ... |
| Density | control height and spacing: compact, default, roomy | ... |
| Modes | light, dark, or both following the OS | ... |

Give the reason for the recommendation in terms of this product: who uses it,
how long they stay, on what device, what the plan says it must feel like. **A
tool used all day wants density and calm; a site read once wants a roomy
measure and one strong accent.** If the user has a logo, brand colours or a
reference site, start from those and say what you took from each.

Then ask only what changes a token: brand colour or logo, a reference, light or
dark, density. **If they have no preference, the kit's baseline is the answer,
recorded as a choice** - not a gap. Do not improvise a visual identity nobody
chose.

## Step 2 - map the navigation and the screens

Before any pixel, write down **how someone gets around**:

- **The navigation map** - primary items, grouped sections, the account menu,
  the footer - using the pattern the product type calls for. Name items as the
  user would say them. Check it against the navigation rules in the checklist.
- **The screens** - every screen the plan needs, **plus** the required ones from
  checklist section 2 for this type: not found, error, empty and loading states,
  and the whole account family - sign in, sign out, reset password, session
  expired - if there are accounts. Mark each applies, not applicable with the
  reason, or deferred to an item.
- **The journeys** from checklist section 3 that apply. These become `spec`
  done-whens later; name them now so the screens they pass through exist.
- **Which two or three views to mock** - the ones carrying the most design
  decisions, not all of them. **A view is not always a screen.** A single-page
  app has one screen and three or four states, and there the states are the
  unit: an empty list and a populated one make almost every decision this step
  exists to settle, while a second screen would make none. Say which you are
  mocking and why, so nobody reads one file and assumes the rest were skipped.

Show the map and the screen list to the user before Step 3. A missing screen is
cheapest to find here.

## Step 3 - write the theme from the kit

Copy `blueprint/design-kit/tokens.css` to `prototypes/theme.css` and
`blueprint/design-kit/components.css` to `prototypes/components.css`. Then make
the direction's changes **in `theme.css` only, and only to values**:

- **Never rename or remove a token.** The components, the checks and the next
  project's habits all depend on the names.
- **Change roles, not components.** A new brand hue changes `--color-primary`
  and its neighbours for light and dark; a rounder look changes `--radius-*`.
  If a component needs a change a token cannot express, change it in
  `prototypes/components.css` and record why in Step 6.
- **Every colour change is re-measured**, in both modes. The kit meets WCAG AA
  as shipped; a new brand hue on white is the most common way to lose that.

This file is the deliverable that survives. The mockups exist to show it working.

### Where the theme lands depends on the platform

The mockups are HTML either way - they are the fastest way to see a layout - but
**what the tokens become in the real app is not always a stylesheet:**

- **Web, website, PWA** - a real CSS file, or the framework's theme config.
- **React Native / Expo** - a TypeScript theme object, or NativeWind's config,
  shaped like `tokens.json`. **There is no CSS to port into.**
- **Flutter** - a `ThemeData` in Dart.
- **Native** - a colour and type asset catalogue.

Name the destination now, in the terms the project actually uses. "Port
`theme.css` into the stylesheet" is meaningless advice on three of those four
platforms.

## Step 4 - mock the component sheet and the chosen views

**First the sheet.** Copy `blueprint/design-kit/components.html` to
`prototypes/components.html`, pointing its two stylesheet links at `theme.css`
and `components.css`. With the new theme it shows every component in every
state in this product's look - the fastest way to see a direction whole, and
the thing the user reacts to first.

**Then one standalone HTML file per chosen view** - a screen, or a state of the
only screen - each importing `theme.css` and `components.css` and using
**only** their tokens and component classes - no hardcoded colors or sizes, or
the theme is not really the source of truth. Build the navigation from Step 2's
map, with the current page marked.

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

## Step 5 - look at them, then review and iterate

**Open them yourself before showing anyone.** A mockup that has only been written
settles nothing - the whole reason this step exists is that seeing a layout
answers questions reading it cannot, and that applies to the person who wrote it
first. Rasterise them if there is no browser - at a phone width and a desktop
width, in light and dark if both are in scope. **If nothing here can render
them, say so plainly rather than presenting unviewed files as a settled
direction.**

The specific thing to check is that each element is actually **visible at a
sensible size**, not merely present in the file. An SVG or a canvas with no
intrinsic dimensions can occupy zero pixels while every attribute reads correctly.
Check hover and focus in dark mode too: a hover darker than the surface it sits
on reads as a hole.

Then show the user how to open them. Iterate on the tokens rather than on individual
mockups - a change made in `theme.css` shows up everywhere at once, which is the
whole point of the structure.

**Nothing durable is written until the user has seen them.** Every change made
here - a lighter grey, a larger title - changes a token, and a contrast value
measured before the change describes a colour that no longer exists.

**So an unattended run stops here.** Under `autopilot` there is nobody to show
the mockups to: report where they are and end, and leave Step 6 for a person.
A `design.md` written from mockups nobody saw records a look nobody chose.

## Step 6 - write the durable design record, once the direction is settled

**The mockups are throwaway. The decisions in them are not.**

`ship` deletes `prototypes/` once the look is built, and the tokens land in the
app's real theme. Everything else disappears with it. So write
`blueprint/context/design.md`, which **survives**:

- **The product type and the direction, in a sentence each.** What this app is
  trying to look like, so a later change can be judged against it rather than
  against taste.
- **The token changes from the kit**, each with its reason - and **any contrast
  value that was measured rather than chosen**. A muted grey and an unreadable
  grey look identical to someone with good vision on a good screen; without the
  number, someone will lighten it back.
- **The navigation map** from Step 2.
- **The screen list**, with every checklist line marked applies, not applicable
  (why), or deferred (to what).
- **The journeys** that apply - `spec` turns each into a done-when when the item
  that builds it comes up.
- **Components in use** - which of the kit's this product uses, and any it
  changed or added, with why. Only the ones that exist.
- **The accessibility bar actually met** - the standard, and what was checked
  against it. A bar met once and unrecorded is a bar that quietly slips.

Keep it short: a record of decisions, pointing at the kit for everything the
project did not change.

**Measure contrast against the tokens as they are now**, after the last
iteration - not a value carried over from a round the user changed.

**Commit the record and the mockups on `main`** - `design.md` and
`prototypes/`, as one `design: ...` commit, now that the user has approved the
direction. The first UI item ports the theme from them on its own branch;
uncommitted, they would be merged as part of that item instead of before it.

Then say explicitly what happens next:

- `spec` links the relevant mockups as the design reference for a UI item, and
  adds the journeys that item passes through as done-whens
- that item's **first build step** ports `theme.css` and `components.css` into
  wherever this platform keeps its theme - a stylesheet, a theme object,
  `ThemeData`, or an asset catalogue
- `ship` deletes prototypes once the look has been built

## Recording a look that already exists

For an app whose UI was built before any `design.md` - the case above. **The
record describes the code as it is**; proposing changes is a separate run of
this skill, after the record exists, and says that it is a redesign.

1. **Read the look from the code, not from memory of it** - the stylesheet or
   theme object, the component files, the rendered pages. Name each value
   against the kit's token that plays the same role (`--color-primary`, the
   radius, the type scale), so a later redesign has names to change.
2. **Measure contrast on the pairs the app actually draws**, in every mode it
   has. A value that fails is recorded as failing, with the number - and raised
   as a finding by `review`, not quietly corrected here.
3. **Map the navigation and the screens as they are built**, against sections 1
   to 3 of `blueprint/design-kit/ux-checklist.md`. A required screen the app
   does not have - no not-found page, no empty state - is marked **missing**,
   never "not applicable", and named in the report as a candidate item for
   `spec`.
4. **Write `design.md` with Step 6's sections**, saying at the top that it was
   recorded from existing code, on which date. Nothing is mocked and nothing
   under `prototypes/` is written. Commit it as Step 6 says.

Then hand to `spec`, which no longer stops on the missing record.

## Rules

- **Throwaway means throwaway.** No framework, no build step, no logic. A mockup
  that grows real behavior has become the app, badly.
- **Tokens only in the mockups.** A hardcoded color is a decision that will not
  survive the port.
- **Recommend with reasons; the user decides.** Never present one option as the
  only one, and never pick silently.
- **Do not touch the real app, or the kit.** This skill writes inside
  prototypes, `blueprint/context/design.md`, and - only when a check trips on
  the mockups - the exclusion in Step 4. The kit is the pack's and is refreshed
  on install.

## Formatting

Match `blueprint/context/ai-interaction.md` when it exists; otherwise keep output short, scannable, and direct.
