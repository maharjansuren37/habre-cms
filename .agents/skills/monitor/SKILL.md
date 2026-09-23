---
name: monitor
description: "Set up and read the signals that tell you whether the live project is healthy - error tracking, uptime checks, logs, and enough usage data to know if anyone is using it. Wires up the specific signals architect said would reveal each failure mode, rather than collecting everything and reading none of it. Also used to investigate a live problem. Use when the user runs `monitor`, has just deployed, asks how to know when something breaks, or is looking into a live production incident - the site down or slow, an alert that fired, errors users are hitting right now."
---

# monitor - know when it breaks, before someone tells you

**Writes:** `dev-notes/status.md` · `blueprint/context/findings.md` · `blueprint/findings/`

Where this sits:

    deploy -> monitor -> (a problem) -> debug -> spec -> build

> **Multi-part project:** `blueprint/project-plan.md` and
> `blueprint/context/quality-bar.md` (the bar the whole product is held to -
> `architect` writes it at the root, not per part) live at the **product
> root**, not this part. Resolve it from `AGENTS.md`'s `Product root:` field.
> Everything else here is this part's own.

Two jobs: **set the signals up**, and **read them when something is wrong**.

## Before you start

**If nothing is deployed yet, say so and stop.** There is nothing to watch, and
signals wired against an environment that does not exist look configured while
reporting nothing - which is worse than no monitoring, because it retires the
question.

`architect` records the failure modes worth watching. **If that is missing, say
which signals you are choosing and why**, rather than collecting everything and
reading none of it.

## Input

- *(no argument)* - set up, or report on what is already set up.
- **a description of a problem** - investigate it. Skip to the investigating
  section.

## Step 1 - work out what actually needs watching

**Read what `stack` already chose**, in the plan's Tech section - the tool and,
more importantly, **where an alert goes.** This skill wires a decision; it does
not make one. If the plan says "nothing, I will look at it when I notice", that
is a decision and this skill's job is to say what that leaves uncovered, not to
overturn it.

**If the plan is silent, say so and settle it here rather than picking quietly** -
a monitoring service is an account and a recurring cost, and choosing one on the
user's behalf months after `stack` ran is how a project acquires a dependency
nobody agreed to.

**Start from `architect`'s system design, not from a vendor's feature list.** If
it named failure modes and the signals that would reveal them, those signals are
the requirement. This is where that decision gets cashed in - or found to have
been skipped.

If there is no such list, derive a short one now:

- what breaks first, and what it looks like from outside
- what a user would notice, in what order
- which external dependency failing would be worst

Then the four that almost every project needs:

- **Is it up?** An uptime check against a real endpoint.
- **Is it erroring?** Unhandled exceptions, with a stack trace and enough context
  to find the cause.
- **Is it slow?** Response times, at least at the slower end - an average hides
  everything that matters.
- **Is anyone using it?** Enough to tell "no errors because it is healthy" from
  "no errors because nobody came."

**Collect what will be read.** A dashboard nobody opens is worse than nothing,
because it feels like coverage.

## Step 2 - propose the setup, with its cost

Say what you would use, per signal, and what it costs - including the free tier's
real limits and what happens when they are crossed. Prefer what the host already
provides over a new service; one fewer account is worth a slightly worse tool.

**Stop for approval before creating any account or installing anything.**

## Step 3 - wire it up

- Add the client, and confirm errors actually arrive - **trigger a test error and
  see it land.** An error tracker nobody has tested is a guess.
- **Scrub sensitive data** before it is sent: no tokens, no passwords, no
  personal data in error context. This is a real leak path.
- Set the environment name, **taken from the Environments table in `AGENTS.md`
  so it matches what `deploy` reports**, and staging noise is not mistaken for
  production. Two skills spelling the same environment differently is how an
  alert gets ignored.
- Point the uptime check at an endpoint that **exercises the database**, not a
  static page that responds while everything behind it is down.
- **On a server you own, watch the box as well as the app**: disk (releases and
  logs fill it quietly, and the first symptom is a deploy that cannot write),
  memory, and **certificate expiry as a dated alert rather than a hope**. A
  managed platform hides these; here nothing else is looking.
- Keep logs structured enough to search, and **never log a secret**.

## Step 4 - decide what is worth waking up for

**Alert on what a person would act on, and nothing else.** An alert that fires
often and means nothing trains people to ignore the one that matters.

For most projects that is a very short list: the site is down, errors have spiked
well above normal, the database is nearly out of space or connections.

**Detection without delivery is not monitoring.** A check that notices a problem
and writes it to a log nobody reads has moved the failure, not caught it - and it
is worse than no check, because the setup exists and looks like coverage. **Name
the channel and prove one message arrives through it**, the same way a backup is
not a backup until a restore has been tried.

This is where a self-managed box differs sharply from a managed platform: the
platform has somewhere to send things and a box has nothing until you give it
one. A local check with no mail transport, no webhook and no push service **can
detect everything and tell no one.**

Say where alerts go, and **be honest that a solo project usually has no
escalation** - it goes to one person, who may be asleep. That is a real
constraint worth writing down rather than pretending otherwise.

**And say what the monitoring cannot see.** A check that runs on the box being
watched cannot report that the box is off - which is the most total failure
available. Either accept it explicitly or put one check somewhere else.

## Step 5 - report

- what is watched, and what is not
- what would fire an alert, and where it goes
- the cost
- **the gaps** - the failure modes from Step 1 with no signal covering them.
  Naming them is more useful than a dashboard.

Record it in `dev-notes/status.md`.

## Investigating a live problem

1. **What is the actual symptom?** What a user sees, when it started, whether it
   is still happening.
2. **Was it a deploy?** Compare the start time against the last release. If they
   match, **roll back first** with `deploy rollback` and investigate afterwards.
3. **Gather evidence** - error rate and the traces behind it, response times, the
   dependency health, recent changes.
4. **Say what you know and what you are guessing.** In a live incident the
   distinction matters more than usual.
5. **Hand off:** `debug` to isolate it properly, then `spec` and `build` to fix
   it through the normal loop. **Never patch production directly** - an
   unreviewed fix under time pressure is how the second outage starts.

## Reading the signals when nothing is broken

**This is the half of monitoring that gets skipped**, and it is the only place
this workflow learns anything from the outside. Every other loop here is closed
between the plan and the code: `spec` reads the plan, `build` reads the spec,
`review` reads the code, `ship` updates the plan. **Reality only ever gets in
through this step.** Without it the project can be perfectly executed against a
plan nobody has checked against use.

Run it deliberately - after a release has settled, or on whatever rhythm suits -
and ask four questions of the signals already collected:

- **What is anyone actually using?** A feature with no traffic is either
  undiscoverable, unwanted, or unfinished, and those need different responses.
  It is also the cheapest thing to *remove*, which `rollback` exists for.
- **Where does it hurt?** The slowest real path, the most common error, the thing
  people retry. Compare against `blueprint/context/quality-bar.md`: a path missing
  the project's own recorded number is a plan item, not a vague concern.
- **What are people asking for or working around?** Support messages, repeated
  manual steps, a spreadsheet someone keeps alongside the app.
- **What is costing money, and is it worth it?** Usage against the bill.

**Then turn it into plan items, or say plainly that there is nothing to change.**
Propose each as one item-sized line for `blueprint/build-plan.md` and hand off to
`spec`, which owns the plan-addition gate - it will check whether the item changes
direction, data or stack, and stop for approval before writing. **Do not edit the
build plan from here.**

**Distinguish the three, because they route differently:** something *broken* goes
to `debug`; something *slower than the bar* is an item for `spec`; something the
users want that was never planned is a change to the plan itself, and if it moves
the project's shape it belongs back at `architect` rather than in a spec.

**"The signals say nothing worth acting on" is a real and common result.** Record
it and move on. Inventing work from a quiet dashboard is worse than reading
nothing, because it spends the project's remaining attention on noise.

**When this skill repairs a finding** - a `preflight` blocker such as no error tracking, or a check with nowhere to deliver its alert - **set it to `fixed`** in `blueprint/context/findings.md`, with the evidence in the **Resolution** line of its entry, `blueprint/findings/<ID>.md`: a test error reached the tracker and the alert arrived where it was sent. **Never `closed`**: `preflight` re-checks it and closes it, because a repair is examined by something other than what made it. Left `open`, it blocks every later `ship` in this part.

## Rules

- **Watch what was designed to be watched.** Signals come from the failure modes,
  not from what a tool makes easy.
- **Test that a signal works** before trusting it.
- **Never send or log a secret or personal data.**
- **Alert only on what someone would act on.**
- **Never fix production directly.** Roll back, then go through the loop.
- **Report gaps honestly.** Unmonitored is a fact worth knowing.

## Formatting

Match `blueprint/context/ai-interaction.md` when it exists; otherwise keep output short, scannable, and direct.
