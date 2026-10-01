---
name: setup
description: "Tune the freshly installed workflow to this actual repository: detect the real stack and commands, rewrite `blueprint/context/coding-standards.md` to match the code that exists, fill in the Commands section of AGENTS.md, set up a test runner and a verification command if wanted, and report what is missing. Also handles an existing project with shipped features by generating the planning docs from the code that is already there. Use when the user runs `setup` after installing, asks to configure or adopt the workflow, or says the standards do not match this project."
---

# setup - make the workflow match this repo

**Writes:** `blueprint/context/coding-standards.md` · `blueprint/context/needs-you.md` · `blueprint/context/quality-bar.md` · `blueprint/project-plan.md` · `blueprint/build-plan.md`

Where this sits:

    install -> setup -> fill in the plans -> `ci` -> `context` -> `prototype` (with a UI) -> `spec`

The workflow installs with sensible defaults that are deliberately generic - they
have to be, since they ship before anyone has seen your code. This replaces them
with what is actually true here.

Run it once after installing. Run it again whenever the stack changes materially.


> **Multi-part project:** `blueprint/project-plan.md`,
> `blueprint/context/quality-bar.md` (the bar the whole product is held to -
> `architect` writes it at the root, not per part), and
> `blueprint/context/principles.md` (never this skill's to write - see Step 3)
> live at the **product root**, not this part. Resolve it from `AGENTS.md`'s
> `Product root:` field. Everything else here is this part's own.

## What this owns, and what `scaffold` owns

**`scaffold` creates. `setup` discovers.** `scaffold` builds a new project from
the plan and installs the stack it names. This reads a project that already
exists and records what is truly there.

Neither creates what the other should: `setup` never installs a framework, and
`scaffold` never guesses at a stack it did not put there.

## Step 1 - read the repo, do not guess

Look at what is really there:

- the package manifest and lockfile - and **branch on the ecosystem**:
  `package.json` for Node, `pubspec.yaml` for Flutter, `pyproject.toml` or
  `requirements.txt` for Python, `go.mod` for Go, an Xcode project or Gradle
  build for native mobile. Read the **resolved** versions from the lockfile, not
  the ranges in the manifest.
- the **exact framework, language, and runtime versions** in use. Record them in
  `AGENTS.md`. **An old version is a constraint to work within, never a defect to
  fix on the way past** - never silently upgrade anything to make a
  recommendation fit.
- the config files: language, build tool, linter, formatter, test runner
- the directory layout, and the conventions the existing code actually follows
- the git state: is this a repo at all, what is the default branch, is there a
  remote
- any CI workflow already configured, and what it runs
- **standards this project has already written down**, which is the thing most
  easily missed because it is not code: `CONTRIBUTING.md`, a style guide,
  `docs/` conventions, architecture decision records, a `README` section on how
  to work here, comments in the linter config explaining a rule. **A project
  that has agreed something in writing has already answered questions this skill
  is about to ask**, and answering them again from the code produces a confident
  second version that quietly disagrees with the team's own.
- whether real product code already exists, or this is a fresh scaffold

**Report what you found before changing anything.** If something is ambiguous -
two test runners configured, a framework you cannot identify - ask rather than
picking.

## Step 2 - is this a fresh scaffold or an existing project?

- **Fresh scaffold** - little or no product code. Continue to Step 3; the
  planning docs get filled in by the user afterwards.
- **Existing project with shipped features** - the plans cannot be written from
  nothing, but they should not be invented either. Survey what the code does,
  then **ask the user for the intent the code cannot reveal**: who it is for,
  what problem it solves, what is deliberately not built. Propose
  `blueprint/project-plan.md` and a `blueprint/build-plan.md` whose already-built items are
  checked off. Stop for approval before writing either. Then run
  `context`.

  **Fill sections 5. Tech and 6. Architecture of the plan from the code** - on
  this route `stack` and `architect` never run, and `context` stops while either
  still holds its seeded instruction text. Tech is the stack as detected in Step
  1, versions as installed; Architecture is what the code already is - the
  deployable parts, routes or screens, the data model as the schema or models
  define it, where the logic lives, the auth boundary. **Replace every seeded
  paragraph in each section, not only the first one** rather than writing beneath
  it: `context` tells a section is unfilled by seeded text still being there,
  whatever surrounds it. Section 5 ends with a note that it is filled in after
  section 6, and section 6 with a note that `layout` adds the directory tree -
  **those go too.** They sit below the sentence that obviously had to go, they
  describe skills that never run on this route, and leaving either one has
  `context` stop and send the user to `architect` and `stack` for a section that
  is in fact filled.
  Both are discovered, like the quality bar - mark anything the code does not
  show as unknown rather than choosing it.

Never present a reconstruction of an existing project as fact. Say which parts
came from the code and which came from the user.

## Step 3 - rewrite the coding standards against the real code

Also write `blueprint/context/quality-bar.md`, which `architect` produces for a
new project. Here it is **discovered, not chosen**: what does this thing already
do under load, what does it already handle, what already happens when it is down.
Record what is true and mark anything unmeasured as unmeasured - inventing a
target the project has never met makes every later check fail against fiction.

**Do not write `blueprint/context/principles.md`, and say so.** Unlike the
quality bar, a non-negotiable commitment cannot be discovered by reading the
code - the fact that a codebase happens to have no ads today does not mean the
project has committed to never having any. If the file does not exist, report
it as unrecorded and point at `ideate`, which is the only skill that writes
one - plain `ideate` while the plans are still empty, since it writes this file
with them, and `ideate --rescope` once they are filled, since plain `ideate`
stops on a filled plan. Do not infer commitments from current behavior and do not leave the
absence unmentioned.

**The standards are two files, and only one is yours to write.**
`blueprint/context/fundamentals.md` is the pack's - what holds regardless of
stack, refreshed on every install, so **an edit there is lost.** Leave it alone.

`blueprint/context/coding-standards.md` is this project's and is never
overwritten. It ships as prompts; fill them in with the conventions this project
actually follows - **the ones in the code, not the ones you would recommend.**

**Where this project already has standards, merge with them - do not replace
them, and do not restate them.** This is the common case in a real repo and it
has three shapes:

- **A rule a tool already enforces** - formatting from Prettier or `gofmt`, lint
  rules, `.editorconfig`, a strict compiler flag. **Name the tool and its config
  file; never restate the rule in prose.** A written copy of a rule a tool
  enforces is a second source that drifts the moment someone edits the config,
  and the tool is the one that actually wins.
- **A rule written down somewhere the project maintains** - `CONTRIBUTING.md`, a
  style guide, an ADR. **Point at it and record only what it does not cover.**
  Copying it here creates two versions of a rule with two owners, which is the
  failure this workflow keeps finding everywhere else. If it is thin or stale,
  say so rather than silently superseding it.
- **A convention the code follows but nothing states** - this is what the file is
  for. Write it down, and say it was inferred from the code rather than agreed,
  because those are different kinds of claim and a later reader cannot tell them
  apart otherwise.

**Say where every recorded rule came from** - a tool, a document, or the code.
A standards file whose rules have no provenance cannot be maintained: nobody can
tell which lines are load-bearing agreements and which were one session's guess.

**If this file has its own "Part 1" or its own copy of the fundamentals, merge it
and say what you did.** A project set up before the two files were split carries
one, and the installer will have reported it - it cannot merge it itself, because
telling a duplicated rule from a deliberately different one takes reading both.
Go rule by rule:

- **Already covered by `fundamentals.md`, and says the same thing** - drop it.
  Two copies of a rule is how the two stop agreeing.
- **Says something different, or narrower, or was corrected because the generic
  version was wrong here** - **keep it**, under the project section, with the
  reason. This file wins where they disagree, so that is how a project overrides
  a fundamental, and the reason is what stops it reading as an oversight later.
- **Not in `fundamentals.md` at all** - keep it; it was project-specific.

**Report the count both ways** - dropped as duplicated, kept as deliberate. A
merge that only says "reconciled" gives nobody a way to check it.
Add anything this stack needs that the prompts do not mention, and delete a
prompt only when the project genuinely has no such thing.

Where the existing code is inconsistent, say so and ask which way is intended
rather than silently picking a winner.

**If the code already contradicts something in `fundamentals.md`**, that is a
finding to report, not a rule to quietly ignore. Record the project's own version
in `coding-standards.md` with the reason - it wins where the two disagree, and
that is the supported way to disagree with a fundamental. Deleting it from the
pack's file does not work: the next install puts it back.

## Step 4 - fill in the commands

Update the Commands section of `AGENTS.md` with the project's real commands: dev
server and its URL, build, test, lint. Take them from the manifest's scripts, not
from convention.

Then settle the **verification command**: one command that runs the checks this
project actually has. Preferred order is typecheck, then tests, then build.

**Never invent a check to fill it in.** If the project has only a build, the
verification command is the build. If a project script would be the natural home
for it, propose adding one - and stop for approval, since that edits a file the
user owns.

## Step 5 - offer the optional gates

Ask, do not assume. Each of these is a real choice with a cost:

- **A test runner**, if none is configured. Adding one means picking the
  stack-native runner, adding one real example test, and folding it into the
  verification command. If the user declines, say plainly that logic-bearing
  steps will ride on build and screenshot evidence instead.
- **Automatic checks on push**, if there is a remote and no CI. **Do not write
  the workflow here - say that `ci` is the next skill to run, and why.** It picks
  the format for the host actually in use (a GitHub Actions file is not a GitLab
  or Forgejo one, and the wrong one gets rewritten rather than adapted), pins the
  runtime to what `AGENTS.md` records rather than the newest, proves the exact
  sequence locally from a clean install so the lockfile is validated too, and for
  a multi-part product checks the generated contract is current. **A one-line
  version written from here is a thinner answer to a question that has its own
  skill** - and until now nothing on the brownfield route reached that skill at
  all.
- **Ignore rules**, if generated or local files are not covered.

**Record what only a person can do in `blueprint/context/needs-you.md`.** A
brownfield audit turns these up constantly - no backup story, an account nobody
has, a decision never written down, a toolchain missing - and reporting them only
in conversation means the next session finds them again. `prepare` reads that
file; a finding left in a report is a finding nobody can act on later.

## Step 6 - record which standards apply

Ask which external standards this project should be held to, and write them into
`blueprint/context/coding-standards.md` under a **"Standards this project
follows"** heading. `review` audits against exactly what is recorded there.

Offer what fits the project rather than everything that exists - OWASP Top 10:2025
for anything on the web, OWASP MASVS for mobile, WCAG 2.2 AA where there is a UI,
Twelve-Factor for config and secrets, Conventional Commits, Semantic Versioning
where something is released.

**Recording none is a legitimate answer** for a personal tool. A bar nobody
intends to meet produces findings nobody acts on, which is worse than no bar at
all.

## Step 7 - report

Say what changed, what was left alone, and - most usefully - **what is still
missing**: no test runner, no verification command, no remote, an empty project
plan. Then name the next actions **in the order of the chain at the top of this
file**: fill in the two planning docs if they are still empty, then `ci` if Step
5 found a remote with no automatic checks, then `context`.

**And `prototype`, if the project has a UI and no `blueprint/context/design.md`**:
after `context`, and before any `spec`, which stops without it. On an app that
already has a look it records the existing one rather than proposing a new one.

**And `principles.md`, if Step 3 found none** - name it in that list, not only in
Step 3's report: `ideate` writes it, as part of the plans when they are still
empty and through `--rescope` when they are filled. It is the one file here this
skill may not write, so nothing else will bring it back up.

**Name every one that is still to do, not only the first.** A report that names
one next step reads as the whole list, and the rest are dropped as soon as the
conversation moves on to something else - an adoption that followed "run
`context`" had run neither three days later.

## Rules

- **Read the repo; never assume a stack.** A default that does not match is worse
  than no default, because it looks authoritative.
- **`AGENTS.md`, the plans, and the context files belong to the user.** Show the
  exact change and get approval before writing to any of them.
- **Never invent a check, a test runner, or a script** just to have something to
  put in a field.
- **Never push, and never change a remote setting.**
- **Report gaps as gaps.** A missing test runner is information, not a failure to
  paper over.

## Formatting

Match `blueprint/context/ai-interaction.md` when it exists; otherwise keep output short, scannable, and direct.
