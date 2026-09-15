# Build Plan

> The other planning doc you own. Write it yourself or with the AI's help.

The items that make up this project, high level and in rough build order, one
line each, no detail. Rough is fine at first, but before the `context` skill runs
this should be a checkbox list the loop can track.

Run the `spec` skill with no argument to spec the **next unchecked** item, or
name a number or title to pick a specific one. Completed items get checked off
here, so this doubles as the progress tracker. A big item gets split into
sub-items (4a, 4b, ...) when it is spec'd.

## Format

Checkboxes. Each item is an outcome sized to one review cycle - not a loose task,
not a whole product area.

Good:

    - [ ] 1. **Submit a link** - paste a URL, save it with its title
    - [ ] 2. **Browse saved links** - list, filter, and open them
    - [ ] 3. **Tags** - add tags on save, filter the list by tag

Avoid:

    - Upload stuff
    - Database
    - Make it look nice
    - Auth, billing, dashboard, and deploy

Scaffolding the app and prototyping the look are pre-build steps, not items.
Start with the first real slice of functionality.

A common order that works: build the core UI against placeholder data first,
then wire up real data, then auth, then integrations. Add deployment readiness
when the thing is worth shipping.

## Continuing after the first release

This is a living roadmap, not a plan that freezes. Keep completed items checked
and append new unchecked ones as the project grows. Optional `## MVP` and
`## Later` headings keep a long plan readable without changing how the next
unchecked item is found.

Do not renumber completed items - archived specs refer back to those numbers.
Continue with the next unused number. If a new item materially changes the
product direction, users, data, stack, or deployment, update
blueprint/project-plan.md too, then regenerate the overview.

## Items

<!-- Real items go here, one per line, in the shape shown under Format above.
     `ideate` writes the first set from the plan.

     Nothing is listed below on purpose. Placeholder items used to ship here as
     live checkboxes, and every skill that reads this file treats an unchecked
     box as real work: `spec` with no argument specs the first one, `progress`
     counts it as remaining, `prepare` files a requirement for whatever service
     it mentions. A project that never deleted them had its workflow quietly
     pointed at a product that does not exist. An empty section stops the loop
     with "nothing is queued", which is true and obvious; two fake items send it
     confidently in the wrong direction. -->

_No items yet. Run `ideate` to write them from the plan._
_In a part of a multi-part product, run `architect` at the product root instead -
it splits the product's features into each part's items._
