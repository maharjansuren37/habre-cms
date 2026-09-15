---
name: deploy
description: "Deploy the project to one named environment, and roll a bad release back. Checks readiness first - production build, environment variables, migrations - then deploys behind an explicit gate, verifies it is actually serving, and reports. Production always needs its own approval; approval for staging is never approval for production. With `rollback`, restores the previous known-good release immediately. Use when the user runs `deploy`, wants a release out, or needs to undo one that went wrong."
---

# deploy - put it out there, and take it back if it goes wrong

**Writes:** `dev-notes/status.md` · `blueprint/context/findings.md`

Where this sits:

    preflight -> host -> deploy -> monitor

> **Multi-part project:** `blueprint/project-plan.md` and
> `blueprint/context/quality-bar.md` (the bar the whole product is held to -
> `architect` writes it at the root, not per part) live at the **product
> root** - a part has no `project-plan.md` of its own, so an unqualified read
> finds nothing. Resolve the root from `AGENTS.md`'s `Product root:` field.
> Everything else here is this part's own.

`host` created the places this runs. This puts code into one of them.

**Two modes:** deploying a release, and rolling one back. Both are here because
they use the same target, the same credentials, and the same platform knowledge.

## Before you start

Name which of these has not happened, rather than proceeding quietly past it:

- **`preflight` has never run** and this is the first release - say so and
  recommend it. It is the one step people skip, and it is the only one that asks
  whether this can face real users at all.
- **`ci` is not set up** - the checks about to gate this release only ever ran on
  someone's laptop.
- **`host` has not provisioned this environment** - there is nowhere for this to
  go, and finding that out mid-deploy leaves a half-released state.
- **In a multi-part product, `integrate` has not run since the last part
  shipped** - each part can be individually correct and the product still broken.

## Input

- *(no argument)* - deploy to the default non-production environment, if one
  exists. Otherwise ask which target.
- **an environment name** - deploy there.
- **`rollback`** - restore the previous known-good release. Skip to the rollback
  section.

**Always name the target out loud before doing anything.** Most deployment
accidents are a right action against a wrong environment.

## Step 1 - readiness

Check, and report only what blocks:

- the **production build** succeeds - not the dev server, the real build - and
  **it was not built on the target.** Three legitimate shapes, and you must say
  which this is:
  - **CI built it** from the commit being deployed, and this step ships that
    artifact. The default when there is a build, and the only shape where
    *the thing that was tested is the thing that ships* is verifiable.
  - **The platform builds it** - Vercel, Netlify, a host building a Dockerfile.
    Acceptable: it builds from a commit, not from someone's working tree. But
    **say plainly that the tested artifact and the shipped artifact are different
    builds of the same source**, because that is what it costs.
  - **There is no build** - a script, an interpreted app, a static tree already
    in the repository. Then this does not apply; say so rather than inventing a
    step.

  **What is never acceptable is building on the machine that serves traffic.**
  It puts a toolchain and the dev dependencies - where most advisories live - on
  production, turns a build failure into an outage at the worst moment, and
  quietly makes every check upstream advisory, since `verify`, `review` and
  `preflight` all examined a different binary.
- the **verification command** passes
- **every environment variable** the code reads is set in the target, with no
  development default reaching it
- **migrations** that need to run are known, reversible, and understood. A
  destructive one gets called out by name, before anything ships.
- **the build and start commands, and the environment variables by name, come
  from the Deployment section of `blueprint/project-plan.md`** - not from
  recollection and not from what worked locally. That section is written across
  `stack`, `architect` and `scaffold` precisely so this step is reading rather
  than reconstructing.
- **the target is a row in the Environments table in `AGENTS.md`.** If the name
  the user gave is not in that table, stop: either it does not exist yet and
  `host` creates it, or the table is stale, and deploying to an environment
  nobody recorded is how a staging release reaches production
- the **commit being deployed** is identified, and is what the user expects
- **that commit is on the default branch.** Deploying from a feature branch
  passes every other check here and leaves production running code that exists
  nowhere else. Three things follow, and none of them announces itself:
  **CI is testing something other than what is live** - it runs on the default
  branch; **the next deploy silently reverts production**, because the next
  person deploys from `main` in good faith; and **any fix in that branch is one
  `git branch -D` from gone**, including the ones that made this deployable.

  It happened on a real project: a P0 data-loss repair, the error pages and the
  login lockout all went live from an unmerged branch, and `main` had none of
  them. Every gate passed.

  **Not a refusal - a stop and a question.** A deliberate hotfix ahead of the
  merge is legitimate and sometimes necessary. Say plainly that this commit is
  not on the default branch, name what merging it would take, and **get the
  user's explicit go-ahead to deploy anyway** - then record it, because an
  unmerged production deploy is a thing the next person needs to know about and
  cannot see. Usually the right answer is to `ship` first; it is one step, and it
  is the step that makes the two agree.
- **for a multi-part project**: `integrate` passed against these exact versions,
  and the contract is current
- **for production only**: `preflight` has been run and returned go, or the user
  has explicitly accepted going without it

**A failing production build stops this.** Hand back to `build`.

## Step 2 - deploy, behind the right gate

**Non-production** - show what will happen and proceed on a normal yes.

**Production** - this needs its **own explicit approval, in this conversation.**
Not inherited from a staging deploy, not implied by running this skill, not
carried over from earlier. Say what is going live, from which commit, and what
changes for the people using it. Then wait.

**Migrations are applied by `migrate`, not here.** Check that every migration
this release needs is already applied to this environment - `migrate` applies
them one environment at a time, backs up first where there is real data, gets
the approval that names what a destructive change loses, and records it in
`dev-notes/status.md`. **A pending migration stops the deploy: route to
`migrate`**, then come back. A release approval is not a schema change's
approval, and a destructive migration run from here would skip both the backup
and the question. **The same holds where the platform runs migrations for you** -
a release command, a start script that migrates on boot: check each pending one
has been through `migrate` for this environment before triggering the release
that will run it.

## Step 3 - verify it is actually serving

A deployment that reports success is not the same as one that works:

- the **health check** responds
- **one real path** works end to end - loading a page is not enough; exercise
  something that touches the database
- **no error spike** in the first minutes
- the **version now serving** is the commit you deployed

**If any of these fail, roll back first and investigate afterwards.** A broken
production is not a debugging session.

## Step 4 - record it

- what was deployed, from which commit, to which environment, when
- migrations that ran
- the previous release, and **how to get back to it** - this is what makes
  rollback possible later

**Check what a returning visitor will actually get.** If the deployed filenames
are not content-hashed - `style.css`, `main.js`, `app.css` - a browser holding
the previous response has no reason to ask again, which presents as "it works
for me" and is close to undiagnosable from the server side. Either fingerprint
the filenames, or send an explicit `Cache-Control` - for a small static site
`no-cache` (revalidate every time, a 304 when unchanged) costs one round trip
and removes the problem.

**Check the monitoring still describes what is now deployed.** A content check
looks for a known string, and a deploy is precisely the thing that changes it -
so an intentional release can make the check fail forever, silently, on
something nobody did wrong (worse still with no alert delivery channel). **A
check that cries wolf is one nobody reads.** Whatever it compares against
belongs in configuration the deploy updates, not as a literal inside the script.

Update `dev-notes/status.md`. **Record the commit** - it is what makes both the
rollback and the next release's notes possible, since `docs` derives those from
everything archived since it.

Then point at `monitor` for whether it stays healthy. **For a production release
of a project other people use, also point at `docs` for release notes** - the
history archive holds what changed, and nobody outside the repository can read
it.

## Rolling back a release

Different from reverting a feature in the code, which is `rollback`'s job. **This
restores the previous release, now.** Understanding comes after.

1. **Identify the last known-good release** and confirm it is what you think.
2. **Restore it** - a promotion where deployments are immutable, a redeploy of
   the previous build where they are not.

**On a first release there is nothing to roll back to, and saying so is the
point.** The mechanism can be in place and the command written down, and it is
still an untested path. **A rollback plan that has never been run is a plan, not
a capability** - `preflight` asks for a *tried* one for exactly this reason. It
becomes real on the second deploy; until then, report it as untested rather than
as ready.
3. **Verify it is serving**, with the same checks as Step 3.
4. **Handle the data.** If the bad release ran a migration, reversing the code
   does not reverse the schema. Say clearly whether the restored release can run
   against the current database. **If it cannot, stop and say so** rather than
   restoring something that will fail differently.
5. **Record it** - what was rolled back, why, what the failed release did. Never
   erase it; the record of a bad release is worth keeping.
6. **Then investigate**, with `debug`, and fix it through the normal loop.

## What deploy and rollback actually mean here

**`host` recorded which shape of platform this is. That decides this whole
skill**, because "deploy" and "rollback" are different operations on each:

| Shape | Deploy is | Rollback is | The trap |
|---|---|---|---|
| **Static host / CDN** | uploading files | re-uploading the previous set | **the CDN cache** - the origin is updated and the world still sees the old thing |
| **Managed platform** | a push or a promote | promoting the previous release | the build happens *there*, so the tested artifact and the shipped one are different builds |
| **Container platform** | a new image tag | the previous tag | **a mutable tag** - `:latest` overwritten means the previous version no longer exists to go back to |
| **A server you manage** | see below | see below | everything is yours, including remembering to do it |
| **Serverless** | a new function version | an alias repointed | **state lives elsewhere** and does not roll back with the code |

**Verify through whatever the public actually hits**, not the thing you just
changed. A CDN, a proxy or a load balancer in front means the origin can be
perfectly correct and the site still wrong - and that is the case that looks like
success from every check you would naturally run.

## Platform notes

- **Web app, website, PWA** - a host deploy. Watch redirects, caching, and that
  the error pages actually work.
- **A server you own - VPS, home box.** This is the platform where building on
  the target is most tempting: `ssh`, `git pull`, `npm install`, `npm run build`,
  restart. **Do not.** It is the fourth shape from Step 1 - the machine serving
  traffic would be running something no check has examined, and a failed build
  leaves you with a half-updated live app and no way back.

  Ship a built artifact instead, and switch atomically:

  - **Releases go in their own directories** - `releases/<commit-sha>/` - and a
    `current` symlink points at the live one. Nothing is ever edited in place.
  - **The switch is repointing the symlink and restarting the service.** That is
    the deploy: everything before it is copying files nobody is serving yet, so a
    transfer that fails halfway changes nothing.
  - **Rollback is repointing the symlink back and restarting.** The previous
    release is still on disk. **This is genuinely better than most managed
    platforms** - seconds, no rebuild, no queue - and it is worth saying out loud,
    because it is the one place self-hosting is strictly ahead.
  - **Keep a few old releases and delete the rest**, or the disk fills quietly and
    the first symptom is a deploy that cannot write.
  - **Secrets are not in the release directory.** They live in one file the
    service user can read, referenced by path, and survive a release swap
    untouched.
  - **Verify against the public URL through the proxy**, not `localhost` on the
    box. A proxy still pointing at the old port serves the old release perfectly
    while the new one runs unreached.
- **Expo** - an over-the-air update for JavaScript-only changes; a store build
  when native code changed. **Know which one this is** - shipping a native change
  as an OTA update silently does nothing.
- **Flutter and native** - a store submission with signing, version and build
  numbers, and review time. **Rollback is not immediate**: submitting the
  previous build takes as long as review does, so say so plainly rather than
  implying it can be undone in minutes.
- **Library or package** - publishing to a registry. **A published version is
  permanent**: most registries refuse a re-publish of the same number and
  un-publishing is restricted or impossible, so there is no rollback here at all -
  only a new version. That makes this the one deploy where the version number
  itself needs its own approval.
- **Command-line tool** - however it is distributed, people keep old copies. Say
  what a user on the previous version experiences after this ships.
- **Service with no UI** - deploy as for a web app, but **consumers are code, not
  people**: they do not reload. A contract change needs the old shape served
  until they have moved, which `integrate`'s version check is what tests.

**When this skill repairs a finding** - a `preflight` blocker such as a rollback that has never been tried - **set it to `fixed`** in `blueprint/context/findings.md`, with the evidence in its **Resolution** line: the rollback ran against the target and the previous release came back. **Never `closed`**: `preflight` re-checks it and closes it, because a repair is examined by something other than what made it. Left `open`, it blocks every later `ship` in this part.

## Rules

- **Name the environment before acting**, every time.
- **Production needs its own yes**, in this conversation. Never inherited.
- **Verify it serves before calling it done.** A green deploy dashboard is not
  evidence.
- **Roll back first, investigate second.**
- **Never deploy uncommitted work**, and never from a dirty tree.
- **Never print a secret**, in a command, a log, or a report.

## Formatting

Match `blueprint/context/ai-interaction.md` when it exists; otherwise keep output short, scannable, and direct.
