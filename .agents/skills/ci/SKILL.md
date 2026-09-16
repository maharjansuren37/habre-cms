---
name: ci
description: "Set up automatic checks that run on push and on pull requests, using the project's own verification command rather than an invented one. Detects the real stack and any existing workflow, writes one config file, runs the same checks locally first to prove they pass, and stops before pushing or changing any remote setting. Use when the user runs `ci`, wants checks to run automatically, asks about GitHub Actions or a pipeline, or when review finds that nothing runs on push."
---

# ci - make the checks run without being asked

**Writes:** `dev-notes/status.md` · `blueprint/context/findings.md`

Where this sits:

    `scaffold` -> ci -> `context` -> the build loop

**This runs early, right after `scaffold`, not at the end.** Its only input is the
verification command, which `scaffold` writes - so there is nothing to wait for,
and waiting costs the whole build. Local checks only help the person who
remembers to run them; every item built before this exists is an item nobody
checked automatically.

**Re-run it whenever the checks change.** A second pass is a change to the
existing config, never a replacement, so the small pipeline written here is meant
to grow rather than to be right forever.

**It writes a config file locally and stops.** Pushing it, and any change to a
remote setting, needs a separate yes.

## Before you start

There must be something worth running. Read the verification command from
`AGENTS.md`. **If there is no verification command, stop** and say to run `setup`
or `scaffold` first - CI that runs nothing is worse than no CI, because it turns
a green tick into a lie.

**One test and a typecheck is enough to start.** That is what a freshly
scaffolded project has, and it is the point: the pipeline exists before the code
does, so the first real item is the first thing it protects. Waiting for a suite
"worth protecting" means the suite grows unprotected.

Check whether a workflow already exists. If so, this is a change to it, not a
replacement, and the existing one is preserved.

## Step 1 - find out what is really here

- the verification command, and whether it passes **from a clean checkout** -
  not merely in the working tree you are sitting in. **A runner has only what is
  committed**, and generated files are usually gitignored: route types, compiled
  protobufs, a generated client, anything a framework emits into a build
  directory. Locally they are already there and the command passes; on the runner
  they are absent and it fails, reporting a missing *symbol* rather than a
  missing *step*, which reads as broken code.

  **Check it, do not reason about it.** Move the build directory aside and run
  the command again. Found this way on a real run: `npm run verify` passed in the
  working tree and failed on a clean checkout with `Cannot find name
  'LayoutProps'` - Next generates route types into a gitignored directory, and
  the fix was a generation step at the front of the verify command, not anything
  in the workflow file.

  **The fix belongs in the verification command, not the pipeline.** A generation
  step added only to the workflow makes CI pass while the same clean checkout
  still fails for a human.
- the package manager and lockfile
- the runtime version - matched to what `AGENTS.md` records, not the newest
- any existing CI config, and what it currently runs
- whether there is a remote at all, and which host it is on. **This decides the
  file you write**, and there is no neutral format: GitHub Actions, GitLab CI and
  Forgejo Actions are different files in different places. **If there is no
  remote, stop and ask which host the repository will live on, before writing
  anything** - a config written for the wrong host is not adapted later, it is
  rewritten, and the user finds out when they first push. Recommend one, with
  the evidence (a logged-in CLI, the other projects' remotes), but let the user
  answer: "say which host you are assuming" was an instruction a real run
  skipped, writing a GitHub workflow and explaining it afterwards

**If the verification command fails locally, stop.** Setting up CI to run a
failing command just moves the failure somewhere less visible.

## Step 2 - decide what the pipeline does

Keep it to what the project actually has. For most projects that is one job:

1. check out the code
2. set up the recorded runtime version
3. install dependencies **from the lockfile**, not a fresh resolve
4. run the one verification command

**When the parts are in different ecosystems**, the pipeline sets up each
toolchain and runs each part's checks - Node plus the .NET SDK, `npm test` plus
`dotnet test`. Either one job doing both in sequence, or one job per part in
parallel.

**If a contract is generated between them, verify it is current**: regenerate it
and fail if the result differs from what is committed in `contracts/` at the
product root - `architect` records the filename and the regeneration command in
`AGENTS.md`. A stale contract is a
runtime failure that no unit test on either side will catch, because each part is
individually correct against its own copy.

**This job is the only check that runs without anyone asking.** `integrate`
makes the same check, but only when someone remembers to run it - so if the
contract check lives nowhere else, put it here.

**"Without anyone asking" is not "on every push".** The triggers below are pull
requests and pushes to the default branch, so **a feature branch gets nothing
until a pull request exists** - which is deliberate, and worth saying out loud
because it is the opposite of what a green local run suggests. Work the whole
build loop on a branch and CI has seen none of it. Say so when handing off, so
nobody reads a branch with no red marks as a branch that passed.

**If this project has a build, CI is where it happens.** Not a laptop, and not
the target. A developer's machine is not reproducible - it carries their runtime,
their environment and their uncommitted files, and "works on my machine" is
exactly this failure. The target is worse: see `deploy`.

Where there is a build worth keeping, add a second job that produces the artifact
**from the commit being tested** and stores it. That is what makes
"the artifact that was tested is the artifact that ships" a fact rather than a
hope - and it is the only version of that claim anyone can check afterwards.

Add a second job only when there is a real reason - that artifact, or a database
service the tests genuinely need.

**Branch on the platform:**

- **Web app, website, PWA** - the above, plus the production build if the verify
  command does not already cover it.
- **Expo / React Native** - typecheck and tests. A store build needs signing
  credentials, which belong in `deploy`, not here.
- **Flutter** - `flutter analyze` and `flutter test`. Same rule about builds.
- **Native mobile** - a CI runner needs the right OS image and signing setup;
  say what it would take rather than writing a config that cannot run.
- **Command-line tool, library, or service with no UI** - the four steps above
  and nothing else. There is no build to add unless the project genuinely has
  one, and **a typecheck or lint is not optional here even when there is no test
  suite**: for a project with no running app, static checks are the only thing
  standing between a push and a broken publish. For a library, run against every
  runtime version the plan says it must support - that is the one place a matrix
  earns its keep.

Do not add matrices, coverage gates, security scanners, or caching layers just
because they exist. Each one is a thing that can break and needs maintaining.
Start with one job that works.

## Step 3 - show the config, then write it

Show the whole file and what each part does. Explain any decision that was not
obvious - why that runtime version, why that trigger.

Then write it, with:

- triggers on **pull requests and pushes to the default branch**
- **read-only permissions by default**; add a permission only when something
  genuinely needs it
- the exact runtime version recorded in `AGENTS.md`
- a **timeout**, so a hung job does not run indefinitely

## Step 4 - prove it, then stop

Run the same command sequence locally, in the same order the pipeline will, and
confirm it passes. **From a clean checkout** - the same check as Step 1, run
again now that the command may have changed: remove the build and dependency
directories, install from the lockfile, and run the sequence. Anything still
present from earlier work is something the runner will not have.

**Add `ci` to the Environments table in `AGENTS.md`.** It is an environment: a
different machine, a pinned runtime, and no `.env`. Recording the pin there is
what stops someone later "tidying" the workflow to a floating version the
project's own dependencies do not support.

Then **stop**. Report:

- what the config runs, and when
- **every test command the project has that the pipeline does not run**, and
  why. A browser test tool `stack` chose is the usual one - it often needs a
  database service and a browser download, which is a real cost and the user's
  call. Record the answer in the `ci` row of the Environments table, so "CI is
  green" is never read as "the browser tests passed"
- that it passed locally
- **that nothing has been pushed**, and that pushing is the user's call
- what would still need doing on the remote by hand - requiring the check before
  merge is a repository setting, not a file

Record the verification command in `dev-notes/status.md` under running it by
hand, so the same checks can be run without the pipeline.

**Then say what comes next: `context`.** It generates the overview the build
loop reads, and it is the last planning step before `spec` starts on items.

**When this skill repairs a finding** - a `preflight` blocker such as no automated checks, or a verification command that skips some - **set it to `fixed`** in `blueprint/context/findings.md`, with the evidence in its **Resolution** line: the workflow ran and failed on a deliberately broken check. **Never `closed`**: `preflight` re-checks it and closes it, because a repair is examined by something other than what made it. Left `open`, it blocks every later `ship` in this part.

## Rules

- **Never push, and never change a remote setting.** Branch protection and
  required checks are the user's to configure.
- **Never invent a check.** CI runs what the project has; a gap is reported as a
  gap.
- **Check the verification command actually runs what the project has
  configured.** A linter, a formatter check, a type checker or a test suite that
  exists and is not in it is a check that gates nothing - it will be run by
  whoever remembers, which over time is nobody. Report it with what it would
  take to wire in, and **do not wire it in from here**: adding a gate can turn a
  green project red, which is a decision, not a detail. Say plainly which checks
  the pipeline enforces and which merely exist.
- **Preserve an existing workflow.** Change it deliberately, never overwrite it.
- **Never put a secret in the config.** Reference it by name from the host's
  secret store.
- **Prove it locally first.** A pipeline nobody has run is a guess. **Prove it
  the way CI will see it**: from a clean dependency install, and **without the
  local `.env`**. A project's `.env` supplies variables the runner will not have,
  so a proof that runs with it present says nothing about whether the pipeline
  works - it is the same shape as a test that passes because the fixture was
  already there.
- **Cache the dependency install** where the host offers it. Not correctness, but
  without it every run re-downloads the whole tree, and CI cost is paid on every
  push forever.

## Formatting

Match `blueprint/context/ai-interaction.md` when it exists; otherwise keep output short, scannable, and direct.
