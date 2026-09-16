---
name: scaffold
description: "Create the actual application from the stack recorded in the project plan - the framework plus everything else it implies: database client, auth, styling, test runner, linting. Handles scaffolding into a directory that already holds the workflow files, which every framework CLI refuses to do. Then audits what landed against the plan and reports anything missing, records the real installed versions and commands, and proves the app starts. Use when the user runs `scaffold`, has chosen a stack and needs the project created, or is adding something to an existing stack."
---

# scaffold - stand the whole stack up, then check your own work

**Writes:** `blueprint/context/coding-standards.md` · `blueprint/context/needs-you.md` · `dev-notes/decisions.md`

Where this sits:

    `stack` -> `layout` -> scaffold -> `ci` -> `context` -> `spec`

`stack` decided what to build with. This builds it. **It is bigger than running
the framework's CLI** - a stack of "Next.js, Postgres, Prisma, Auth.js, Tailwind,
Vitest" is six installs, a schema init, an environment file, and a test script.


> **Multi-part project:** `blueprint/project-plan.md` and
> `blueprint/context/quality-bar.md` (the bar the whole product is held to -
> `architect` writes it at the root, not per part) live at the **product
> root**, not this part. Resolve it from `AGENTS.md`'s `Product root:` field.
> Everything else here is this part's own.

## Before you start

Read the Tech section of `blueprint/project-plan.md`. If it is empty or still
placeholder text, **stop** and say to run `stack` first. This skill installs a
decision; it does not make one.

**Read the layout `layout` decided**, and build into it. This skill installs a
framework into a shape that has already been chosen; it does not choose one.

**If the Architecture section names parts but no layout has been recorded, stop
and say to run `layout` first.** Installing a framework into a directory
structure that is about to change is the expensive way round - every config file
points at paths, and moving them afterwards means editing what the scaffolder
generated, which is its own class of silent failure. That determines whether
this skill scaffolds once or twice and into which directories, so it is not
optional detail - it is the shape of everything below. It may also name an
integration that needs a client library.

**If the Architecture section is missing, treat the layout as one application**
and say so. That is the right default and most projects take it.

**But stop if the plan clearly implies more than one part and nothing has decided
the layout** - a Tech section naming a separate backend language, say. Scaffolding
into a guessed layout means installing a framework, a lockfile and a dependency
directory into a directory that is about to move. Say to run `architect` first;
it is a few minutes there against a full reinstall here.

## Step 1 - work out everything the stack implies

Expand the recorded decision into the complete list. For each piece, know the
command and the version it will install. Cover:

- the **framework** and its scaffolder
- the **language** and runtime version
- **database** client, ORM or query builder, and its init step
- **auth** library
- **styling**
- **test runner**, plus whatever it needs to run the project's kind of tests
- **linter and formatter**
- anything an **integration** in the plan requires

**Pin versions rather than taking a floating latest**, so this project is the
same if scaffolded again next month.

**Then check the runtime can actually run them, before installing anything.**
Compare the installed runtime version against what each package requires -
**never trust the installer's exit code**: on a real run, Node 20.18.1 with a
floating `latest` pulled a framework requiring `^20.19.0`, npm reported that as
a warning, exited 0, and installed anyway, and the failure only surfaced later
as an unreadable "cannot find native binding" error at build time.

**A missing `engines` field means unknown, not compatible** - Expo declares
none, so when the metadata is silent, **run the framework's own health check**
(`expo-doctor`, `flutter doctor`) instead, which knows things a manifest does not.

So: if the runtime is below what a package requires, **stop and say so before
installing**. The options are to upgrade the runtime or to pin the package to a
version the current runtime supports - and the second is usually right, because
the plan already named a version.

**Unless the plan is what named the impossible version** - and then neither
option is available here. `stack` checks the runtime before recording a version,
but a plan written before that check, or one whose machine has changed since,
can name a current stable the runtime cannot run. Pinning "to what the plan
said" then makes it worse, and pinning to something else is re-deciding the
stack in the middle of installing it.

**Route back to `stack`.** Say which package, which version the plan named, what
the runtime is, and what it requires. That is a technology decision surfacing
one step late, and it is the same call `architect` makes when the quality bar
needs something the stack cannot give - cheap to redo in the plan, expensive to
unpick from an installed dependency tree. **Do not choose a replacement version
yourself**: the plan records versions with reasons, and a version changed here
arrives with none.

## Step 2 - check the toolchain is actually installed *and usable*

**Installed, running, and usable are three different things**, and a database is
where they come apart. A server can be installed, listening on its port, and
still refuse you because there is no role for your user - which reads as a
connection error at the moment you first try to write a schema, several steps
after you would have wanted to know.

**Prove the connection, do not infer it from the process.** Create the
development database and connect to it as the user the app will use, before
anything is installed. `pg_isready` answering is not the same as `createdb`
succeeding.

**And this is one of the things `scaffold` does not do for you.** Creating a role
or a database cluster is system configuration, usually needs a superuser, and is
the user's decision the same way installing an SDK is. Report the exact command
that would fix it and stop; do not run it and do not work around it by quietly
choosing a different database.

**An SDK is not one thing, and the piece you need may be packaged separately.**
Checking the toolchain answers only that *a* toolchain is there. Check the
specific runtime, target or component the chosen framework needs:

- **.NET** splits into separate packages on most Linux distributions, and
  **running and building need different ones.** `dotnet --version` and
  `dotnet new console` succeed while `dotnet new webapi` fails to build with
  `NETSDK1226: Prune Package data not found ... Microsoft.AspNetCore.App` -
  the ASP.NET *runtime* is not enough, building needs the **targeting pack**
  too. On Arch that is three packages: `dotnet-sdk`, `aspnet-runtime`,
  `aspnet-targeting-pack`. Check `/usr/share/dotnet/packs/` for a `.Ref` entry,
  not just `dotnet --list-runtimes`.
- **A browser automation tool downloads browsers, and that is the slow part.**
  Installing the package is seconds; fetching its browser binaries is a few
  hundred megabytes and can fail on a slow link long after the install looked
  done. Run its own install step explicitly, and **prove one browser launched**
  rather than trusting the package manager - a harness that cannot start a
  browser is exactly as blind as no harness, and `verify` will believe it has
  one. Where the download fails, say so and record it in
  `blueprint/context/needs-you.md`: it is a real blocker on every visual check,
  and the project runs fine without it right up until someone needs to see a page.
- **Python** can have a working interpreter and no `pip` - several distributions
  strip it from the system install deliberately, so check `python3 -m pip`
  itself, not just the interpreter.

  **And `import venv` succeeding is not `venv` working.** Debian and Ubuntu
  ship the module in the standard library and `ensurepip` in a separate
  package, so `python3 -m venv` can fail at the last step with *"ensurepip is
  not available"* even though the import passes. **Create a throwaway venv and
  run `pip` inside it** - the only check that catches both, and it costs a
  second.
- **Mobile** needs a platform SDK and often a licence accepted, neither of which
  the language toolchain implies.

**The generic form: build and run something in the shape the project will
actually take**, not the version command - and note those are two checks, not
one. A toolchain that can run an application cannot necessarily compile one, and
the piece that compiles is routinely packaged separately. A version number proves an executable exists and nothing about
whether the specific thing you need is present - and the failure surfaces later,
as a build error that reads like a broken project rather than a missing package.

**A project with no framework still has a toolchain** - the language runtime and
its package manager - and it gets the same check. What it does not have is a
scaffolder, so there is nothing to fetch on demand and nothing to verify beyond
the runtime.

**Not every scaffolder can be fetched on demand.** `npx` pulls `create-vite` and
`create-expo-app` when needed, so Node is the only prerequisite. Flutter is
different: `flutter create` needs the full SDK installed system-wide first, and
so do the native mobile paths, which need Xcode or Android Studio.

Before proposing anything, check what the chosen stack requires is present:

- **Node ecosystem** - `node` and a package manager. `npx` handles the rest.
- **Flutter** - `flutter --version`. Without it, nothing here can run.
- **Native iOS / Android** - Xcode or Android Studio, and their command-line
  tools.
- **Python, Go, Rust** - the toolchain and its package manager.

**If it is missing, stop and say so, with what installing it involves** - roughly
how large, how long, and whether it is a system-wide change. Then let the user
install it and come back.

**Never install a language toolchain or SDK yourself.** Adding project
dependencies is what this skill does; installing multi-gigabyte system software
is a different kind of decision, and it belongs to the user.

## Step 3 - show the whole plan, and stop

List every command in order, with one line on what each is for, and what the
resulting project will contain.

**This is the approval gate.** Scaffolding writes a lot of files and pulls a lot
from the network. Choosing a stack was not a yes to installing it. Wait.

**Commit the plans first, as part of that yes.** No skill before this one
commits: `ideate`, `architect`, `stack` and `layout` all write files and leave
them in the working tree, so on a real run four skills of decisions - both plans,
the quality bar, every decision entry - existed nowhere else when the installer
started writing across the tree. Say that the approval covers a `docs:` commit of
the planning files before anything installs, and make it: a scaffold that goes
wrong is then unpicked without taking the plans with it.

## Step 4 - create the project

**First: is there a scaffolder at all?** The rest of this step exists to work
around framework CLIs, and a project with no framework has none to work around.
Do not force one - a `create-*` command that fits badly leaves a web app's
scaffolding around something that is not a web app, and every one of those files
is then yours to explain or delete.

**No scaffolder** - a command-line tool, a library, a plain script, sometimes a
small service. This is a normal case, not a degraded one, and it is *simpler*
than the branch below rather than harder. Build it directly, in this order:

1. **The manifest**, written by hand at the repository root: name, the module
   system, the entry point, and the `engines` field or its equivalent. **Write
   `engines` even when nothing demands it** - it is what Step 2's check reads on
   every later run, and "unspecified" is not "compatible".
2. **The source root** - `src/`, unless the language's own convention says
   otherwise (`lib/` for a Ruby gem, the package path for Go). One directory, no
   scaffolding, no placeholder folders for structure the project has not needed
   yet.
3. **One entry point that actually runs**, however small - a CLI that prints its
   usage and exits 0, a service that answers one route, a library that exports one
   real thing. **Step 8 has to prove this project runs, and without an entry point
   there is nothing to run** - which is how a scaffold ends up "proved" by a
   typecheck alone. This is a first line of the product, not a placeholder: a file
   exporting `true` satisfies the letter of the step and none of its purpose, and
   the first real item deletes it anyway.
4. **The test runner**, installed and *proved on one real assertion*. A runner
   with no test is the setup that reports success forever - the same failure as a
   suite configured to pass with no tests.
5. **The scripts** the project will actually be driven by, including **one
   verification command** that runs the checks together. `ci` stops without one,
   and a project with no build step still needs a typecheck or a lint to have
   anything worth running.

Nothing is merged and nothing is moved, so the collision rules below do not
apply. Go to Step 5. **Say in your report that there was no scaffolder** - it is
a fact about the project, not an omission.

**There is a scaffolder** - continue here.

The directory already holds `AGENTS.md`, `CLAUDE.md`, `.claude/`, `.agents/`,
`blueprint/`, `dev-notes/`, `README.md`, and `.gitignore`. **Every common
framework CLI refuses to run in a non-empty directory**, so running it here fails.

Instead:

1. Run the scaffolder in a **temporary directory**, where it works normally.
2. **Check it actually produced something. Do not trust the exit code.** Run
   against a non-empty directory, `create-vite` prints "Operation cancelled",
   writes nothing, and **exits 0** - so a script checking only the status would
   report success on an empty result. Confirm the expected files exist before
   going further.
3. Move the result into the project.
4. **Never overwrite a workflow file.** `AGENTS.md`, `CLAUDE.md`, the two adapter
   directories, everything under `blueprint/` and `dev-notes/` are off limits.
5. **Never copy the scaffolder's `.git/` directory.** Several - `create-expo-app`
   among them - initialise their own repository. Copying it over the existing one
   destroys the project's history. Exclude it from the move entirely.
6. Where a file legitimately exists in both:
   - **`.gitignore`** - merge the framework's entries into the existing file.
     Never replace it; it already protects `.env`.
   - **`README.md`** - the project's own README stays. Keep anything genuinely
     useful from the framework's version by folding it into the Running section.
   - **`AGENTS.md` and `CLAUDE.md`** - a scaffolder may generate these too, and
     what they say can matter. `create-expo-app` writes an `AGENTS.md` saying the
     SDK has changed and to read the versioned docs before writing any code -
     the framework itself warning that your training is stale. **Keep the
     project's file and fold that content into it**, verbatim, under the stack
     and versions section. Never overwrite, and never silently discard.
   - **non-skill files inside an adapter directory** - `create-expo-app` writes
     `.claude/settings.json`. It collides with nothing, so keep it. The rule
     protects the skills, not the whole directory.
   - **anything else** - show both and ask. **Never resolve a conflict silently.**

For **native mobile** there is no CLI scaffolder. Say so, and give the Xcode or
Android Studio steps for the user to run, rather than pretending otherwise.

### A project with two parts is scaffolded twice

Once per part, each with its own scaffolder into its own directory - `create-vite`
into `web/`, `dotnet new` into `api/`. **Each part keeps its own config at its own
root.** Do not try to make one scaffolder produce both, and never put a
`package.json` above a part that is not a Node project.

Then, when the parts do not share an ecosystem, set up the pieces that bridge
them: **the contract file in `contracts/` at the product root**, at the path
`architect` recorded, plus its generation step, and the ecosystem-neutral
top-level command that runs both parts' checks. **Those are not optional extras** -
without them there is no way to verify the project as a whole, and the first
person to try will wire up something ad hoc.

**Put the contract at the product root, not inside the owning part.** It is the
one file both parts are bound by, `integrate` and `ci` both look for it there,
and a copy inside `api/` looks like `api`'s private business to everyone reading
`web/`. Record the regeneration command and each consumer's client-generation
command in `AGENTS.md`, with the directory each runs from.

## Step 5 - install the rest of the stack

**First, check what the scaffolder actually generated against what the plan asked
for.** Some accept no version flag at all: `create-expo-app` always generates for
its own current SDK, so a plan naming SDK 54 quietly gets SDK 57 with no error or
warning. If they differ, **say so and let the user choose** - accept what was
generated and update the plan, or pin the dependency afterwards. Never let that
gap pass unmentioned.

Everything from Step 1 that the framework scaffolder did not provide. Use the
real current command for each - `npm install`, `flutter pub add`, `pip install`,
whatever the ecosystem uses.

## Step 6 - wire it together so it actually works

Installed is not the same as usable:

- run the **ORM's init** and create the first schema file
- write **`.env.example`** naming every variable the project needs - **names
  only, never real values** - and confirm `.env` itself is gitignored.

  **Build that list from three places and merge them**, the same way `preflight`
  does much later: **the code's own reads**, **what the framework and ORM
  require without appearing in any source file** (a Next standalone server
  reads `PORT`, `HOSTNAME` and `NODE_ENV`, none of them in the source), and
  **anything already in `.env`**. `preflight` already mandates this merge;
  doing it only there guarantees the gap rather than catching it.

- **set the security headers the framework has a place for**, and **record the
  one you are not setting.** Where they live is framework-specific -
  `next.config.ts`, a middleware, a settings module - and this is the step that
  knows which. Set the uncontroversial ones: `X-Content-Type-Options`,
  `Referrer-Policy`, `X-Frame-Options`.

  **Do not invent a Content-Security-Policy here.** A CSP needs the application
  to exist, and a wrong one breaks it in ways that look like unrelated bugs.
  **Write down that it is not set and why**, in the plan's Deployment section, so
  `preflight` audits a decision instead of an absence. **An unset header nobody
  recorded and an unset header somebody chose look identical at the end and are
  not the same thing.**
- add the **scripts**: dev, build, test, lint
- **keep the pack's own directories out of every check you configure** -
  `prototypes/` above all, and `.claude/`, `.agents/` and `.opencode/`. `prototype`
  writes throwaway HTML there that no linter should pass: placeholder links failed
  a real project's lint, and would have failed CI on the commit that added them.
  Exclude them in each tool's own config, not with a flag on one script.
- define the **one verification command** that runs the checks this project now
  genuinely has. Preferred order: typecheck, tests, build. **Never invent a
  check just to fill it in.**

## Editing what the scaffolder generated

Wiring a scaffold means editing files a tool wrote, and that is where a whole
class of silent failure lives.

**Anchor on structure, never on a quoted string** - a generator's quote style
changes between versions (Django writes `path('admin/', ...)` with single
quotes), so a pattern anchored to one style finds, changes, and reports nothing
on the other. Use a pattern that tolerates either, or parse the file.

**Then assert the edit applied** - not that the command exited 0, but that the
replacement actually changed the text - because **a formatter will erase the
evidence**: running `ruff format`, `prettier` or `gofmt` after a failed edit
normalises the quotes the edit was looking for, so the file ends up reading
exactly as though the edit had never been attempted.

**Verify by asking the program, not by reading the file.** `INSTALLED_APPS` is
what `django.apps.get_app_configs()` returns, not what the source appears to
say; a route exists if the resolver has it. **On one real project three
wirings failed exactly this way and passed every check that existed** - worst
was a database path silently left inside the release directory, which the next
deploy would have wiped.

## Step 7 - audit what landed

Walk the Tech and Architecture sections item by item and sort **every** named
piece into one of four buckets:

- **Installed and working** - with the evidence: the version, the passing command.
- **Needs a service that does not exist yet** - a hosted database, an auth
  provider account, a storage bucket. Not a failure. It is `host`'s job, and
  naming it here is what stops it being forgotten.
- **Deliberately deferred** - with the reason.
- **Missing** - it should be here and it is not. **Say so plainly.**

**A half-installed stack that reports success is the worst thing this skill can
do.** If something did not install, that is the headline, not a footnote.

**Then check each installed dependency has a call site**, and name the ones that
do not. **This audits *use*, not presence, and nothing else in the workflow
does** - an installed package satisfies every check here, in `ci`, and in
`review`, right up until `preflight` asks whether the capability exists.

A logger installed and imported nowhere is the shape to watch for: it reads as
"logging is handled" to everyone who looks at the manifest, and it is a
dependency pretending to be a capability. Found in a real project, where `pino`
sat in `package.json` with zero references while `architect` had named three
signals that had to be measurable.

**Either wire it now or record why not**, with the item that will. Both are fine
answers; silence is not.

## Step 8 - prove it runs

Install dependencies, then prove the project actually works. **What that means
depends on the platform:**

- **Web app, website, PWA** - run the production build, start the dev server, and
  confirm it responds.
- **Expo / React Native** - a dev server proves little without a device. Run the
  **typecheck** and **`expo-doctor`**, which checks the whole install for
  consistency. Then say plainly that nothing has run on a simulator or a real
  device yet.
- **Flutter** - `flutter analyze` and `flutter doctor`, with the same caveat.
- **Native mobile** - a build in Xcode or Android Studio, which is the user's to
  run.
- **Command-line tool** - **run the command**, with a real argument and with none,
  and show the output. There is no server to respond, so "it typechecks" is not
  evidence it runs.
- **Library or package** - typecheck, then run the one real test from Step 4. A
  library has no entry point to execute, so the test *is* the proof it loads.
- **Service with no UI** - start it and make one actual request against a real
  route. A process that boots without being called has not been shown to serve.

Then run the verification command. Report exactly what you ran and what happened.

**If it does not start, that is the result.** Do not describe a broken project
as scaffolded.

This step earns its place. On a real run it was the only thing that caught an
incompatible toolchain - the install had reported success, every file was in the
right place, and nothing was visibly wrong until the build was actually run.

## Step 9 - record reality

Fill in `AGENTS.md`:

- the **real** dev, build, test, and verification commands
- the **source layout that actually landed** - which shape (one application, two
  parts in one repo, separate repos), and the real directory for each part.
  `src/`, `lib/`, `app/`, `web/src` plus `api/` - whatever the framework and the
  architecture produced, or what Step 4 created directly when there was no
  scaffolder.
- **where the config lives.** In a two-part project each part has its own
  `package.json` and its own tooling, and knowing which root a command runs from
  is the difference between a working instruction and a confusing one.
- the **resolved versions**, read from the lockfile rather than from what you
  asked for. They are different facts.
- **the real build and start commands into the plan's Deployment section**, where
  `stack` wrote the intended shape. They are different facts, and `host` and
  `deploy` both read that section rather than this file's Commands block.
- **the `development` row in the Environments table.** It is the only environment
  that exists at this point and it exists *now* - created the moment there is
  code, not the moment something is hosted. Record where its configuration comes
  from (`.env`, a local file, or nothing) and that it holds no real data.
  **Leaving the table empty until `host` runs is what makes "no development
  default reaching production" a figure of speech instead of a comparison between
  two recorded things** - and `migrate` reads that last column before touching a
  schema.

**If an installed major version is newer than you can speak about confidently,
say so here and in your report**, and point at that version's own documentation
as the authority. A confidently wrong pattern from an older version is the most
likely way this workflow produces broken code.

Then fill in `blueprint/context/coding-standards.md`, which is **read by `build`,
`spec` and `review` as beating generic best practice**. It cannot do that while
it describes no particular project, and this is the moment the conventions stop
being guesses: the linter, the formatter, the test runner and the framework's own
layout are all now on disk.

**Do not touch `blueprint/context/fundamentals.md`.** That is the pack's, it
holds what is true regardless of stack, and it is overwritten on every install -
an edit there is lost and a project-specific rule there is lost with it. Anything
this project does differently is stated in `coding-standards.md`, which wins
where the two disagree.

`coding-standards.md` ships as prompts, and every one of them is a question this
step can now answer: the language and its
strictness settings, the formatter and linter, how files are named and where they
go, the import style, the error-handling pattern the framework expects, the test
runner and what a test file looks like here. Read the configs rather than
recalling defaults.

**Write the "Standards this project follows" section.** `review` audits against
what is named there and treats an unrecorded standard as not a finding - so
leaving it empty is what makes the security and accessibility lenses report
generic smells and nothing else. Name what this project actually holds itself to:
typically OWASP Top 10:2025 for a web project, OWASP MASVS for mobile, WCAG 2.2 AA for
anything with a UI, and honestly nothing beyond the fundamentals for a local
script. Take the bar from `blueprint/context/quality-bar.md` where `architect`
recorded one rather than choosing a stricter one here.

**Where the quality bar hands a standard to another file, point at that file.**
Accessibility is the common case: `architect` leaves it to
`blueprint/context/design.md`, which `prototype` writes *after* this skill runs.
Write "Accessibility: as recorded in `blueprint/context/design.md`", never "not
recorded yet" - nothing comes back to correct that line, and `review` decides what
its accessibility lens checks from it. On a real project it read "not recorded"
beside a `design.md` recording WCAG 2.2 AA.

**Anything you could not determine, say so in the file** rather than filling it
with a plausible convention nobody chose; an invented standard is worse than an
absent one, because `review` will enforce it.

In a two-part project each part gets its own standards - a C# backend and a React
front end share nothing here - written into that part's own
`blueprint/context/coding-standards.md`.

Then add a `dev-notes/decisions.md` entry for anything you chose during setup
that the plan had not already settled, with the reason.

**Then say what comes next: `ci`.** It runs here rather than later, and the
reason is this step: the verification command and the runtime version it needs
were both just written, so there is nothing to wait for. **Waiting until the
suite is "worth protecting" means the suite grows unprotected** - every item
built before CI exists was built with nothing running on push.

## Re-running this later

Safe and expected when the stack grows. **Install only what is missing**, leave
everything else alone, and re-run the audit. Never re-scaffold over a project
that already has code.

## Rules

- **Nothing installs before the approval gate.**
- **Never install a language toolchain or SDK.** Report it as missing instead,
  **and record it in `blueprint/context/needs-you.md`** with the command that
  installs it and what it blocks. Reporting it only in conversation means the
  next session rediscovers it - which is what happened with the Postgres role:
  installed, running, and unusable because no role existed for the user.
- **Never overwrite a workflow file**, and never silently resolve a conflict.
- **Never invent a check, a script, or a test runner** to fill in a field.
- **Never write a real secret** into any file, including `.env.example`.
- **Check the runtime against what you are installing, first.** An engine warning
  is a blocker, not a warning.
- **Never trust an exit code alone.** Confirm the files you expected exist.
  `create-vite` exits 0 after refusing to do anything; `create-expo-app` exits 1
  for the same refusal. The codes are not consistent, so check the files.
- **Never copy the scaffolder's `.git/`.**
- **Fold in the framework's own agent guidance.** Never overwrite ours with it,
  and never throw it away.
- **Report what is missing as missing.** Honest and incomplete beats complete-
  looking and wrong.

## Formatting

Match `blueprint/context/ai-interaction.md` when it exists; otherwise keep output short, scannable, and direct.
