# Project Name

<!-- Replace everything down to "How this project is built" - that section is
     worth keeping, and points whoever joins next at their orientation. The
     `docs` skill will help, and `preflight` treats a README that is still
     boilerplate as a blocker before going live. -->

One or two sentences: what this is, and who it is for.

## Running it

    <install command>
    <dev command>

## Building it

    <build command>
    <test command>

## How this project is built

This project uses a spec-driven workflow: plan first, spec before code, one
small reviewed step at a time, review gates before anything merges.

**New here? Read `AGENTS.md` first.** The name says agents, but it is the
orientation for anyone joining - which file holds what, who writes each one, and
how to pick up work that was interrupted. Then run `progress`, which reports
where things stand and what is next without reading the code.

- `blueprint/` - the workflow's state: plans, the current spec, findings, history
- `dev-notes/` - why it is shaped this way, and where it stands
- `AGENTS.md` - how work is done here. Every AI tool reads it; so should you
