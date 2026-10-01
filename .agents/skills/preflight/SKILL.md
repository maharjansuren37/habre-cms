---
name: preflight
description: "The whole-project go-live audit: everything, once, before the first release and again before anything major. Checks security, data and backups, configuration, operations, observability, correctness, accessibility, documentation, and platform specifics across the entire project rather than a diff. It never fixes: it reports, writes each blocker to the findings ledger, and closes a non-code blocker once a re-run confirms the repair. Returns a go or no-go with blockers, knowingly-accepted risks, and what could not be verified. Use when the user runs `preflight`, is about to launch, or asks whether the project is ready for real users."
---

# preflight - is this ready to be live at all?

**Writes:** `blueprint/context/findings.md` · `blueprint/findings/` · `dev-notes/status.md`

Where this sits:

    ship -> preflight -> host -> deploy -> monitor
    (`ci` runs much earlier, right after `scaffold`)

> **Multi-part project:** `blueprint/project-plan.md`,
> `blueprint/context/quality-bar.md` (the bar the whole product is held to -
> `architect` writes it at the root, not per part), and
> `blueprint/context/principles.md` (the product's own, from `ideate`) live at
> the **product root**, not this part. Resolve it from `AGENTS.md`'s
> `Product root:` field. Everything else here is this part's own.

**There are two different questions, and the rest of the workflow only asks one.**
`ship` asks *"is this change safe to merge?"* - one item, one branch, one session.
`deploy` asks *"will this deployment succeed?"*. Neither asks **"is this product
ready for real people?"**

That is this skill, and it is a **milestone gate, not a per-deploy one**. Run it
before the first release, and again before anything major. It audits the whole
project. It never fixes: it reports, and the one file it writes is the findings
ledger.

## How this differs from the other two

**`progress`** is the daily check: where am I, what is next, in seconds.
**`review`** audits the code, including `review full` across the whole project.

This skill assumes both of those pass and asks the question neither does: **is
this fit for real users?** Faultless code with no backups, no rollback plan, and
a scaffold-default README is a no-go here and a clean bill of health there.

That is why it is a milestone gate rather than something run often.

## Step 1 - establish scope

Read `blueprint/project-plan.md`, `blueprint/context/project-overview.md`,
`blueprint/context/coding-standards.md`, `blueprint/context/principles.md` if
it exists, `blueprint/context/findings.md`, `dev-notes/`, and the real state of
the repository. Know the platform and the environments.

**Name the paths, do not say "the plan".** In a multi-part product the plan is the
**product's**, at the root recorded in `AGENTS.md`'s `Product root:`, while the
standards and the ledger are **this part's own** - so an unqualified "the plan"
has two answers and the wrong one is silently plausible.

**Before either, read section 8, Deployment, of `blueprint/project-plan.md` -
is a release planned at all?** "Runs from source, not published" is a complete
answer there, and `host` stops on it. Here it means there is no go-live to gate:
**say so first, and ask whether one is coming.** If one is, **`host` records
that** - the plan and the decision are its to change, not this skill's, whose
one write is the ledger - so route there and audit the release it will set up.
If not, audit what a release
would need and report it, but **write nothing to the ledger** - a P0 or P1 for a
release nobody plans blocks every later `ship` in this part for nothing.

**Then settle which of the two audits this is, and say so** - they ask different
questions and mixing them produces a report where half the findings are noise:

- **Before the first release.** Nothing is deployed. Configuration and Operations
  are about **whether the answers exist at all** - is there a deploy target, a
  backup plan, somewhere errors go - not whether they are correctly set in a
  running environment. "No environment exists yet" is the finding; do not file
  twenty separate could-not-verifies that all say the same thing once you strip
  them down. **Say it once, at the top of those sections.**
- **Before a major release of something already live.** There is a target, so
  every one of those becomes checkable against it, and "could not verify" means
  you tried.

**Then check the plan against reality.** The plan is the thing this project
claims to be; a milestone gate is the right moment to notice it no longer is:

- items marked done in `blueprint/build-plan.md` with nothing in
  `blueprint/history/` behind them, or the reverse
- **unchecked items that describe a different product entirely** - a plan reused
  from another project, or edited past the point of relevance. This is not
  cosmetic: every skill downstream reads that plan as the source of truth
- an overview older than the plan it was generated from

`progress` reports this drift routinely and cheaply. It is repeated here because
**a plan describing another product invalidates the rest of this audit** - you
would be checking readiness against the wrong definition of ready.

State what you are auditing and what you are not, before starting.

**At a product root, stop** - an `AGENTS.md` listing parts with no `Part:` field
of its own. This audit reads a part's overview, standards, ledger and history,
and writes its blockers to that ledger; the root has none of them. Name the parts
to run it in, and `integrate` for whether they agree.

## Step 2 - work through everything

**Security**

- no secret in the working tree **or anywhere in git history**
- every protected route gated **server-side** - a hidden button is not access control
- ownership never taken from client-supplied input
- input validated at the trust boundary
- dependencies checked against known advisories
- security headers, cookie flags, and CORS set deliberately rather than by default
- at the recorded standard, naming the category for each finding

**Data**

- migrations applied, and every one reversible or knowingly not
- **backups configured, and a restore actually tested** - an untested backup is a
  hope, not a backup
- test and seed data gone from anywhere real
- personal data: what is stored, why, for how long

**Configuration**

- every environment variable this project needs is set in the target. **Start
  from the list in the plan's Deployment section**, which is maintained by name
  through the build loop, then reconcile it against the code and the framework's
  own requirements below. A variable in the code and not in that section is
  either undocumented or forgotten, and both are findings. **Do not
  enumerate these by searching the source for `process.env` or its equivalent** -
  that finds the ones the project reads *explicitly* and misses every one a
  framework reads *for* it, which is usually the set that matters. A Next.js app
  with Prisma and NextAuth reads `NODE_ENV` in its own code and needs
  `DATABASE_URL`, `NEXTAUTH_SECRET` and `NEXTAUTH_URL` - none of which appear
  anywhere in the source. **Build the list from three places and merge them:**
  the code's own reads, the framework and ORM's documented requirements, and the
  keys already present in `.env` or `.env.example`. A grep-only answer reports
  clean config for a project that cannot start.
- **no secret with a development default that would still work in production** -
  a signing secret with a fallback is the one that matters, because the app boots
  happily and every session is forgeable
- **each environment in `AGENTS.md`'s Environments table has genuinely separate
  configuration** - compare the rows rather than asserting it. A staging database
  pointed at production data is not staging, and the table is where that is
  visible. **An environment that exists but has no row is itself a finding**: the
  skills that gate on it - `deploy` for its target, `migrate` for real data -
  cannot read what was never written down
- secrets in the environment, never the repository

**Operations**

Before the first release these ask *does an answer exist*; before a major release
they ask *does it work*. Both are real audits; say which you ran.

- a health check that exercises something real
- **on a server you own, the things a managed platform was doing for you**, each
  absent until someone set it up: a process manager that restarts it after a
  crash *and after a reboot*; certificate renewal, with an answer to "how would
  you know it had failed"; operating system patching; a firewall and key-only
  SSH. **Renewal, backups and patching fail silently and on their own schedule**,
  which is why they belong in a milestone audit rather than a deploy check
- **a rollback plan that has actually been tried**, not just written down. Before
  a first release, "there is no previous release to roll back to" is the correct
  answer - what is missing then is the *mechanism*, and that is `host`'s job
- who finds out when it breaks, and how
- domain, TLS, and certificate renewal
- **if a proxy terminates TLS in front of the app, that the app is built to sit
  behind it** - it reads the forwarded scheme, host and client address rather
  than the connection's own, and the proxy overwrites those headers rather than
  passing a visitor's through. **Nothing earlier in the loop exercises this**:
  the tests, CI and `verify` all talk to the app directly over http, where the
  scheme matches and the client address is real. On a real project the first
  deploy served every page correctly and rejected **every form post**, because
  the framework compared its own `http://` origin against the browser's
  `https://`. Ask for the evidence: a request through the proxy that reaches a
  state-changing action, and a forged forwarded header that does not.

**Observability**

- the signals `architect` said would reveal each failure mode: **are they wired
  up?** This is where that decision is cashed in, or found to have been skipped.
- errors reaching somewhere a person looks
- gaps named honestly

**Correctness**

- the suite green, CI green on the default branch
- **no P0 or P1 open anywhere in `blueprint/context/findings.md`** - read its
  *entries*. A ledger with
  no findings still contains the words "P0" and "P1" in the header explaining what
  they mean, so a naive search reports open blockers in an empty file, and the
  same search reports findings in a file whose entries are all `closed`
- **multi-part only:** `integrate` has been run and passed against the exact
  versions about to ship. **Every part passing its own checks is not evidence
  they work together**, and going live is the worst moment to find that out. A
  multi-part project with no integration run is a **blocker**, not a risk.
- the main flows verified against a production-like build, not the dev server
- **every shipped feature still does what it was proved to do.** `verify` runs
  once per item, against the spec in flight, and the done-whens it proved are
  archived under `blueprint/history/` and **never read again**. So a project can
  reach here with every item marked done and item 2 quietly broken by item 6,
  with nothing in the workflow having looked. `verify --all` re-proves the
  archive; **the automated suite is an acceptable answer only where it genuinely
  covers those claims**, and the ones it does not cover are usually the ones
  `verify` existed to check - a screen rendering correctly, a flow working end to
  end, anything whose evidence was a screenshot. Ask which claims the suite
  actually asserts rather than assuming it asserts them all.

  Not run, and not covered by tests, is **could not verify** - which is never a
  pass. This is the check most likely to be waved through on a project where
  everything looks green, because everything *is* green: the tests pass and the
  plan is all ticked. Neither of those has re-observed anything since the day it
  shipped.
- **the artifact that will run is the artifact that was checked.** Ask where the
  build happens - CI, the platform, or nowhere - and **if the answer is "on the
  target", that is a blocker, not a preference.** Everything this audit and every
  check before it examined would then be a different binary from the one serving
  requests, which makes the whole chain advisory. `deploy` names the three
  acceptable shapes

**Against the project's own bar**

Read `blueprint/context/quality-bar.md`. **Every line in it is a check here**:
does the running project meet the numbers it set for itself, with evidence. A bar
that says "not measured, no target" is a knowingly-accepted risk and belongs in
that section of the report, not silently omitted.

If the file does not exist, that is a finding in its own right - `architect`
writes it, and without it there is no standard to hold this to but a generic one
that may be far stricter or far looser than this project needs.

**Against the project's own principles**

Read `blueprint/context/principles.md`, if `ideate` wrote one. A live violation
of a stated commitment is a blocker at the same standing as a missed
quality-bar number - both are the project failing to meet a bar it set for
itself. Unlike the quality bar, **an absent file is not automatically a
finding**: `ideate` writes "none recorded" explicitly when there is nothing to
hold, so absence usually means `ideate` never ran on this project. Say which
case this is rather than treating silence as either a pass or a gap.

**Accessibility and performance**

- WCAG on the main flows: keyboard reachability, focus visibility, contrast,
  labels and alternative text
- the obvious killers: unpaginated queries, N+1s, unbounded payloads, missing
  indexes on what is filtered

**Documentation**

- a README that is **not the scaffolder's default**, and **whose commands
  actually run** - a README nobody has executed is the usual shape of this
  failure. `docs --check` does that properly; this is the shallow version
- for a project that already has users, **a `CHANGELOG.md` covering what shipped**
  - `docs` derives it from `blueprint/history/`, so the material exists whether or
  not anyone wrote it out. Absent is a finding, not a blocker, on a first release
- enough to run and deploy it without asking anyone
- a licence, and a privacy policy if personal data is collected

**Platform specifics**

- **Web / PWA** - error pages, redirects, caching, and for a PWA whether offline
  actually works
- **Mobile** - signing, version and build numbers, store metadata, permission
  strings, and review guidelines that commonly reject
- **Command-line tool** - the exit codes are the contract: **non-zero on failure,
  0 only on success**, since something will eventually gate a build on it. Plus
  what it does with no arguments, and whether it writes anything outside the paths
  it was given
- **Library or package** - the public surface is what ships. What is exported and
  what leaked; whether the published files match what the manifest claims; and
  **whether a breaking change is going out under a non-breaking version**, which
  is the one mistake consumers cannot defend against
- **Service with no UI** - the contract others build against, the versioning
  story for it, and what an unauthenticated request gets

## Step 3 - report a verdict

Sort everything into six buckets, and lead with the verdict:

- **Blockers** - must be fixed before going live. Each one goes into the findings
  ledger as P0 or P1, so the existing machinery carries it: a heading in the
  index, the entry in `blueprint/findings/<ID>.md`, in `review`'s format.

  **Every blocker is a ledger entry at P0 or P1, whatever `review`'s scale
  would call it** - this audit asks whether it is fit to go live, not how bad
  the code is. One filed at P2 gates nothing, so the report says no-go while
  `ship` merges past it; if it is not worth a P1, it is not a blocker. **A
  blocker whose repair is a person's** - an account, a manual check, an open
  `needs-you.md` line - **still goes in the ledger**, naming that line: the
  line says what to do, the finding is what gates, and without it the
  `preflight:` line has no ID to name.

  **A blocker only a release needs holds the build loop too.** A person trying
  it on a real device, an account, a backup - once `open` at P0 or P1, it
  blocks every later `ship` in this part, though the next item's code has
  nothing to do with it. **Say so, and offer the user `deferred`**, with
  `Deferred to:` the skill that releases - `host` or `deploy`. It stays in the
  ledger and in every audit until that skill runs; setting it is the user's
  call, never this skill's. **A check only the released copy can answer** - a
  phone against the hosted site - is `deploy, after release`: nothing before
  the release can satisfy it, so `deploy` runs it straight after.

  **On a re-run, close what was repaired.** A blocker no code fixes - backups, a
  host, a README, a rotated secret - is marked `fixed` with evidence by the skill
  that repaired it, and `review` has no code to re-examine, so **this skill is the
  one that closes it**: re-check the evidence against the real system, move it to
  `closed` with what you checked in **Resolution**, or back to `open` if it does
  not hold. Code findings are not yours to close - they wait for `review`.
- **Risks, accepted** - the user has decided to live with it. **Set it
  `accepted` in the ledger, with who accepted it and why in its entry** - an
  acceptance written only in `dev-notes/status.md` is one nothing that gates
  reads. Only they can put something here. **An accepted
  blocker counts as go** - it is a risk now, not a blocker - so a verdict of
  no-go with every blocker accepted is a go that names them.
- **Deferred, and to what** - every `deferred` finding in the ledger, with the
  skill or milestone named in it. These are risks the project carries *now*: a
  release goes out with them live, and the only difference from an accepted one
  is that something is meant to come back. Report them at every audit, never as
  resolved, until that skill has run. **But a finding deferred to the release
  this audit is for is due now**: when this audit gates a release and a
  finding's `Deferred to:` names `host` or `deploy`, put it under Blockers, not
  here - the release is the later it was put off to. **Except `deploy, after
  release`**: list it here as due straight after the release, since no repair
  before it can exist, and a Blocker nothing can clear is a no-go forever.
- **Backlog** - the count in `blueprint/findings/backlog.md`, naming any whose
  file this release changed. P3s gate nothing, but a backlog nobody counts is a
  deletion by another name.
- **Not applicable** - with the reason. "No personal data collected, so no
  privacy policy needed" is a real result.
- **Could not verify** - and what would be needed to verify it. **Never counted
  as a pass.** Before a first release, collapse everything blocked by the same
  missing thing into one line naming that thing. Fifteen entries all reading "no
  environment exists" bury the four findings someone can act on today, and a
  report nobody finishes reading fails in the same way a green tick does.

**Name the skill that fixes each blocker**, so the report is actionable rather
than a list of complaints: `ci` for missing automated checks, `docs` for a
scaffold-default README or absent dev-notes, `host` for backups and secrets,
`monitor` for absent error tracking, `migrate` for an unreversible schema change,
`spec` and `build` for anything needing code.

Then say **go** or **no-go**, plainly, in one line.

**Record the verdict in `dev-notes/status.md`**, replacing any earlier one, as a
`preflight:` line with the date and the commit audited -
`preflight: no-go, 2026-03-02, a1b2c3d - blockers F-12, F-14`, or `preflight: go,
2026-03-02, a1b2c3d - accepted F-12`. `deploy` gates
production on it, and a verdict said only in the conversation is gone when the
context is cleared.

**Then ask to commit what this run wrote**, on `main`, as its own
`chore: preflight` commit: `blueprint/context/findings.md`, the entries under
`blueprint/findings/`, and the `preflight:` line in `dev-notes/status.md`.
`deploy` refuses a dirty tree, so a verdict left uncommitted stops the very
release it cleared.

**This skill must be able to say no.** A readiness check that always passes is
worse than none, because it converts an unexamined risk into documented false
assurance. If the project is not ready, the entire value of this skill is saying
so.

**Check what the verification command actually enforces.** A project can have a
linter, a type checker and a test suite configured while the command everything
gates on runs only some of them - and the ones left out are invisible, because
nothing fails. Name the checks that exist but do not gate. This is not a blocker
on its own; it is the difference between "the checks pass" and "the checks that
run pass", and every later claim in this audit rests on which one is true.

**Read `blueprint/context/needs-you.md`, and check each open line is still
open.** Nothing closes a line automatically, so a requirement met months ago can
still read as outstanding - and treating a stale line as a blocker fails a
release for a reason that no longer exists, which is the same false answer as
missing a real one. Verify, then report; where a line is satisfied, say so and
name the skill that should close it. Anything genuinely still open and
required for this release is a **blocker**, not a risk, filed in the ledger
like any other - a launch waiting on an
account nobody has created is not ready, however good the code is. Anything
open but not needed yet belongs in the knowingly-accepted section with its
timing. `prepare` is the skill that reports that list in full.

## Rules

- **Never fix.** Report; the only file this writes is
  `blueprint/context/findings.md` - blockers in, re-checked non-code repairs
  closed. Repairs go through the skill named for each blocker.
- **Never claim compliance.** This checks against a standard; it certifies
  nothing. "Nothing found against the recorded bar" is the strongest true claim.
- **Unverifiable is never a pass.**
- **Only the user accepts a risk**, and the acceptance is recorded in the ledger with a reason.
- **Whole project, not a diff.** That is the entire point.

## Formatting

Match `blueprint/context/ai-interaction.md` when it exists; otherwise keep output short, scannable, and direct.
