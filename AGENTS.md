# AGENTS.md

Instructions for AI coding agents working in this project, and the entry point
every tool reads. Claude Code reads `CLAUDE.md`, which imports this file, so
there is one source of truth.

## Starting fresh?

**Assume you remember nothing, because you probably don't.** Every piece of state
in this project is a file, so a cold session is the normal case, not a degraded
one.

These are already loaded, before you read anything else:

| File | What it holds | Written by |
|---|---|---|
| `blueprint/context/project-overview.md` | what this project is | `context` |
| `blueprint/context/fundamentals.md` | conventions that hold regardless of stack | the pack - refreshed on every install, your edits are overwritten |
| `blueprint/context/coding-standards.md` | this project's own conventions and the standards it follows | `scaffold`, `setup` |
| `blueprint/context/ai-interaction.md` | how to communicate here, and when to stop | you |
| `blueprint/context/current-work.md` | the one item in flight, with its steps ticked | `spec`, `build`, `ship`, `rollback` |
| `blueprint/context/findings.md` | open review findings | `review`, `build`, `ship`, `verify`, `preflight`, `host`, `docs`, `ci`, `deploy`, `monitor`, `migrate` |
| `blueprint/context/needs-you.md` | work only a person can do - accounts, spend, system software, hardware, manual checks, decisions | `stack`, `scaffold`, `setup`, `spec`, `host`, `verify`, `build`, `architect` |

**These are not loaded. Read them when you need them:**

| File | What it holds | Written by |
|---|---|---|
| `blueprint/context/design.md` | the visual decisions, if this project has a UI | `prototype` |
| `blueprint/context/quality-bar.md` | the performance, scale, security and availability this project holds itself to | `architect`, `setup` |
| `blueprint/project-plan.md` | the what and why | `ideate`, `stack`, `architect`, `layout`, `setup` |
| `blueprint/build-plan.md` | the checklist | `ideate`, `architect`, `spec`, `ship`, `setup` |
| `blueprint/history/` | every completed item, archived | `ship` |
| `dev-notes/decisions.md` | why this project is shaped the way it is | `docs`, `architect`, `layout`, `scaffold`, `ideate`, `host`, `migrate` |
| `dev-notes/status.md` | where things stand, what is open | `docs`, `deploy`, `monitor`, `ci`, `host`, `migrate` |
| `CHANGELOG.md` | what changed, for people who use it | `docs` |
| `blueprint/orchestration.md` | the coordination board and its contract line - multi-part only, at the product root | `orchestrate` - the scripts list the parts |
| `blueprint/status/` | each part's live state - multi-part only, at the product root, never committed | `spec`, `build`, `ship`, `autopilot` |

**Every one of those has a named writer, and that is deliberate.** A file with
readers and nothing that writes it is the single most repeated defect in this
workflow's own history: it reads as configured, passes every check, and quietly
means nothing.

**Resuming interrupted work:** `current-work.md` records which build steps are
done with `- [x]`. Continue from the **first unchecked step**. Never start over,
never redo a ticked step.

**If anything is unclear, run `progress`.** It reports where things stand, what
is next, and any drift between what the files claim and what git shows.

**Checking the state of the project** - three skills, different questions:

- `progress` - *where am I, what is next?* Seconds, reads plan and git state, not
  the code. Run it constantly.
- `review` - *is the code sound?* Scoped to the current work by default;
  `review full` audits everything. Writes findings.
- `preflight` - *can this face real users?* Backups, config, operations, docs.
  Returns go or no-go. A milestone gate, not a routine check.
- `prepare` - *whose turn is it, what do I need to get?* Accounts, spend, system
  software, hardware, manual checks, decisions. Read-only; it never buys,
  installs or decides.

They are not interchangeable. Faultless code with no backups passes `review` and
fails `preflight`.

## What this is

<!-- `context` fills this in from the plans, in two or three sentences, and
     leaves it alone once there is prose here. Write it yourself if you would
     rather - it is your file. Every other placeholder in this file names the
     skill that fills it; this one did not, and for a long time nothing did. -->

## The loop

    ideate -> architect -> stack -> layout -> scaffold -> ci -> context (plan it)
         -> spec -> build -> verify -> review -> ship      (build it)
         -> preflight -> host -> deploy -> monitor         (run it)

Not everything is in that line. These are reached for when needed, and are just
as available:

- `prototype` - settle the look before building, in throwaway mockups
- `debug` - reproduce and isolate a failure, without editing code
- `migrate` - change the database schema safely
- `rollback` - reverse a completed feature
- `docs` - README, API docs, and `dev-notes/`
- `autopilot` - one bounded, unattended build pass; explicit opt-in only

**Changing a decision already made** is its own situation, and the skill that
made it is where you go:

- `ideate --rescope` - change what the project is for. Plain `ideate` **stops**
  when the plan is already filled, because proposing a fresh build plan and
  having it approved erases the `- [x]` marks that are the whole resume
  mechanism. The rescope mode carries finished items and their history across,
  and sends a cut item that already shipped to `rollback` - deleting the plan
  line does not delete the code.
- `architect` - re-deciding the parts after `scaffold` has run **moves every
  file**; it says so before proposing anything.
- `layout` - re-deciding directory names after `scaffold` has run means editing
  what the scaffolder generated: every config file points at paths. It says what
  that costs before proposing anything. **Which of `architect` and `layout` you
  want depends on the question** - how many things deploy is `architect`'s, what
  the directories are called is `layout`'s.
- `prototype` - a second run can leave `design.md` describing a look the code
  does not have, and `review` then measures against a bar nobody built to.
- `stack` - there is no skill that changes a stack once there is code, and that
  is deliberate: it is a rewrite. `stack` names the order to do it in.

Each step is a skill: a plain markdown worksheet any capable agent can follow,
and any person can work through by hand. Cross-references use plain names, so
they read correctly in every tool.

**Every skill checks its inputs before it acts.** Each one opens with a
`## Before you start` section naming what must already be true and what to run
when it is not - `build` says to run `spec`, `deploy` names a `preflight` that
never happened. Two kinds:

- **Blocking** - the skill stops. Running it would produce confident output built
  on a placeholder, which is harder to catch than an error.
- **Advisory** - the skill says what is missing and continues. `review` reporting
  that `coding-standards.md` was never written is the difference between "checked
  and consistent" and "nothing to check against".

`ideate`, `setup`, `progress`, `preflight`, `prepare`, `debug` and `docs` have none by design:
they are the entry points and the reporters, and they work in any state.

- **Claude Code** - `.claude/skills/<name>/SKILL.md`, invoked as `/<name>`
- **Everything else** - `.agents/skills/<name>/SKILL.md`; Codex uses `$<name>`

Or just ask in plain language - "spec the next item", "run the review".

## Rules that hold regardless of skill

- **Never build on `main`.** Work happens on a branch.
- **Never commit code the user has not seen and approved.**
- **Never push, deploy, provision, or change a remote service** without a
  separate explicit yes in the current conversation. Approval to merge is not
  approval to push; approval to deploy to staging is not approval for production.
- **Never claim something passes without naming the evidence** - the command and
  its output, the screenshot, the response.
- **Never print or commit a secret.** Report the category, file, and line.
- **Follow the recorded versions, not remembered ones.** See below.

## Stack and versions

<!-- `scaffold` fills this in from what actually installed, read from the
     lockfile. `setup` fills it in for a project that already existed. -->

- Platform: <web app | website | PWA | mobile | other>
- Language(s): <and which part each covers>
- Framework and version: <exact major.minor as installed>
- Runtime version: <node / dart / python, as installed>
<!-- MULTI-PART MARKER - a multi-part install replaces this comment with:
       - Part: web
       - Product root: ..
     A single-part project leaves it as a comment and has nothing to delete.

     Where those fields are present, `blueprint/` always means THIS part's
     blueprint. These live at the product root instead, and a part has no copy
     of its own - an unqualified read from inside one finds nothing:

       <product root>/blueprint/project-plan.md
       <product root>/blueprint/orchestration.md
       <product root>/blueprint/status/
       <product root>/blueprint/context/quality-bar.md

     Never assume any of those paths - read the root from the fields above.
     The board - orchestration.md and status/ - resolves one step further: in
     a git worktree, to the same path under the main checkout, so every
     worktree shares one board. `orchestrate` gives the command.
     This list is the declaration check.sh rule 13 reads: every skill that
     names one of these files must also say where it resolves. Add a file here
     and the rule starts requiring it; leave one out and nothing checks it. -->

- Source layout: <one application | two parts in one repo | separate repos>
- Source directory: <where the code lives - list each part if there is more
  than one, e.g. `web/src` for the front end, `api/` for the backend>
- Organised: <flat | by feature | by layer>

Config files - `package.json`, `tsconfig.json`, the framework's config - live at
the root of whichever part owns them. They are not source.

**These are facts about this repository, and they beat recollection.** If a
pattern differs between major versions, the version recorded here wins. If it is
newer than you can speak about confidently, say so and check its documentation
rather than guessing.

## Commands

<!-- `scaffold` or `setup` fills these in from the real project. Never guess. -->

**One application:**

- Dev: <command, and the URL if it serves one>
- Build: <command>
- Test: <command, or "none configured">
- Verify: <the one command that runs the checks this project actually has>

**More than one part** - list each separately, and **say which directory each
runs from**, because that is the difference between a working instruction and a
confusing one:

    web/    dev: npm run dev (http://localhost:5173)   test: npm test
    api/    dev: dotnet watch (http://localhost:5080)  test: dotnet test

- Verify (everything): <one command above both - a Makefile target or a script.
  When the parts do not share a package manager, npm scripts cannot reach across
  the boundary, so this has to be ecosystem-neutral.>
- Run both in development: <a process runner, docker compose, or honestly "two
  terminals" - say which>

## Environments

<!-- Every place this code runs. `scaffold` writes `development`, `ci` adds
     itself if a pipeline exists, `host` adds the rest. Never guess one. -->

**`development` always exists** - it is created the moment there is code, not the
moment something is hosted. Listing it is what makes "no development default
reaching production" a comparison between two recorded things rather than a
figure of speech.

| Environment | What it is for | Config comes from | Holds real data |
|---|---|---|---|
| `development` | local work | <`.env`, a local file, nothing> | no |

Add a row per environment as it comes into existence. For each, say **where its
configuration comes from and where its secrets live** - never the repository -
and **whether it holds data anyone would miss**, which is the field `migrate`
reads before touching a schema.

**Rules that depend on this list being accurate:**

- `deploy` targets **one environment at a time**, named from this table.
  **Approval for one is never approval for another.**
- `migrate` treats an environment holding real data completely differently from
  one that does not. A wrong row here is how a destructive migration gets an
  easy yes.
- A staging database pointed at production data **is not staging**, and this
  table is where that is visible.
- `ci` is an environment too when it exists: a different machine, a pinned
  runtime, and no `.env`. The runtime pin belongs in the row, because a pipeline
  that installs a different version than this project supports fails in the one
  place nobody is watching.
- **Say which environment builds.** Normally `ci`, sometimes the platform, never
  the one serving traffic - because a target that rebuilds is running something
  no check ever examined. `deploy` reads this before it ships.
