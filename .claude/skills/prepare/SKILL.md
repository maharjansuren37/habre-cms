---
name: prepare
description: "Report the work only a person can do - accounts, spend, system software, hardware, manual checks, decisions and access - separating what blocks progress right now from what is needed later. Reads blueprint/context/needs-you.md plus the plan, the stack and the environments table, and reconciles them against what is actually installed and configured. Read-only; it never buys, installs, or decides. Use when the user runs `prepare`, asks what they need to do or get, is about to start a session and wants to know what to have ready, or when work has stalled on something an agent cannot do."
---

# prepare - what needs you, and what can wait

**Writes:** nothing

Where this sits:

    any point in the loop -> prepare -> you do it -> back to the loop

> **Multi-part project:** `blueprint/project-plan.md` and
> `blueprint/context/quality-bar.md` (the bar the whole product is held to -
> `architect` writes it at the root, not per part) live at the **product
> root** - a part has no `project-plan.md` of its own, so an unqualified read
> finds nothing. Resolve the root from `AGENTS.md`'s `Product root:` field.
> Everything else here is this part's own.

**Everything else in this workflow reports what the code is doing. This reports
what is waiting on a human.** Those are different questions and the second one
had no home: the rules were spread across every skill that stops, so the only
way to discover you needed a paid account was to run the skill that spends
money and watch it refuse.

**Three skills answer "what is the state of this?" and this is a fourth
question.** `progress` - *where am I, what is next?* `review` - *is the code
sound?* `preflight` - *can this face real users?* This one is **whose turn is
it, and what do I need to have ready?** If you want to know what to do next,
run `progress`; it names an action and says whether it is yours.

## When to run this

**It costs seconds and it is read-only, so the cost of running it is never the
question.** The cost of *not* running it is a session that stalls at the worst
moment - halfway through `scaffold` with a half-installed project, or at `host`
with a card you do not have. So the rule is: **run it before anything that would
be expensive to interrupt.**

The moments where it pays:

- **Starting a session**, before picking work up. If `progress` says the next
  action is yours, this is the full list rather than the one line.
- **Right after `stack`** - the earliest point the account obligations are
  knowable at all, and the cheapest time to discover that a chosen service needs
  a paid tier.
- **Before `scaffold`** - toolchains and SDKs. Finding out about a missing SDK
  partway through leaves a half-built project, and `scaffold` will not install
  one.
- **Before `host`** - the money step. Everything it will ask for should already
  be a line here.
- **Before a release**, alongside `preflight` - what is still open that stops
  this going live.
- **Whenever anything has stalled** on something an agent cannot do.

**Early in a project the record is thin**, because skills write it as they run
and few have run. That is expected, and it is why Step 2 exists - the sources
that state a requirement ahead of time are doing most of the work at that stage.
Later the record carries it.

## What this never does

**It does not buy, install, sign up, or decide.** It reports. That boundary is
the same one `host` and `scaffold` already draw, and it is what makes the report
trustworthy - a skill that could quietly resolve its own findings would have an
incentive to under-report them.

It also does not repair the record. If something in `needs-you.md` is already
done, say so in the report and let the skill that owns it update the line.

## Step 1 - read what is recorded

Read `blueprint/context/needs-you.md`. It is the durable record: skills write a
line the moment they find something they cannot do.

**If it does not exist or is empty, say so and continue.** An empty file means
either nothing is needed or nothing has been recorded, and those are very
different - Step 2 is what tells them apart. Never report "nothing needed" on
the strength of an empty file alone.

## Step 2 - find what was never recorded

The record is written by skills as they run, so it is only as complete as the
skills that have run so far. Check the sources that state a requirement ahead of
time:

- **`blueprint/project-plan.md`** - the Tech section names the hosting, the
  database and the monitoring chosen at `stack`; section 8, Deployment, names
  the target host, the environment variables by name, and where it ships.
  Anything there that needs an account or a card is a candidate - **but check
  whether it already exists before reporting it as needed.** A plan says what was
  decided, not what has since been done, and a plan reading "Neon or Supabase"
  can sit above a database that was provisioned months ago and is in daily use.
  Connect, run the tool, look at the config: **reporting a requirement that is
  already met wastes the reader's time and teaches them the list is guesswork.**
  This is the mirror of the rule below about never reporting a requirement as
  satisfied without checking - both directions need the same evidence.
- **`AGENTS.md`** - the **Environments** table. An environment listed with a
  config source that does not exist yet is work for you. So is any environment
  holding real data with no backup named.
- **`blueprint/context/quality-bar.md`** - a bar that can only be measured on a
  real device, or under real load, needs hardware or access.
- **`blueprint/build-plan.md`** - unchecked items that obviously need a service,
  a key, or a device. Say which item, so it can be got ready before that item
  rather than during it. **And check the file is usable at all**: a plan whose
  next item belongs to a different product, or that has no real items left, is
  itself work waiting on a person - it is their file, nobody else may edit it,
  and the loop cannot move until they do. That is exactly this skill's question,
  and it is easy to miss because it is not a resource to acquire.
- **The toolchain** - what the stack requires against what is actually
  installed **and usable**. Installed is not usable: a database server can be
  running and have no role for your user, which surfaces as a connection error
  several steps after you wanted to know.

**Do not re-derive what is already recorded.** If a line exists, use it. Adding
a second line for the same thing is how a list stops being read.

## Step 3 - separate blocking from upcoming

Two groups, and the split is the whole value of the report:

- **Blocking now** - something cannot proceed until you do this. Name what is
  stopped: the skill, the item, or the part.
- **Needed later** - name *when*. "Before `deploy`", "before item 4", "before
  the first release."

**A list where everything is urgent gets read once.** If nothing is blocking,
say that plainly and first - it is the most useful sentence in the report.

**But earn it before you say it.** "Nothing is blocking" is the strongest claim
this skill makes and the easiest to get wrong, because the blockers that do not
look like resources are the ones missed: a user-owned file nobody else may edit,
a decision nobody has taken, an approval nobody has given. **Ask what the next
step in the loop actually needs, not only what is listed here** - a plan that
cannot be spec'd blocks everything, and it appears in no list of accounts or
tools. Getting this line wrong is worse than a noisy report: it tells someone
their attention is not needed when it is the only thing that will move the
project.

## Step 4 - report

For each line: **what it is, why it is yours, what it blocks or when it is
needed, and the smallest concrete next step.** Where a command would do it, give
the command. Where it is a signup, name the service and what tier is enough.

Group by blocking-now then needed-later, not by kind - the kinds are for
recording, the timing is for acting.

Then say what you checked and could not settle, rather than leaving it out. "The
plan names a managed Postgres but no provider is chosen, so I cannot say what it
costs" is useful; silence reads as "nothing to worry about".

**Never invent a price.** Say what tier is needed and that the current price has
to be read off the provider's own page - a number recalled from training is how
a budget conversation starts wrong.

## Rules

- **Read-only.** This skill writes nothing, including `needs-you.md`. The skill
  that discovers a requirement records it; this one reports.
- **Never buy, install, sign up, or decide.** Those are the point of the file.
- **Never report a requirement as satisfied without checking.** "Installed" is
  checked by running it, not by the plan saying so.
- **An empty record is not proof that nothing is needed.** Say which it is.
- **Do not moralise about cost or scope.** Report what is needed and what it
  blocks; whether it is worth it is the user's call.
- **Report what is wrong elsewhere, and say who owns it.** Reconciling these
  sources turns up state that contradicts itself - an Environments row claiming
  no real data above a hosted database, a plan section describing a decision as
  open when it was settled. This skill writes nothing, including corrections, so
  say what is wrong, which file holds it, and **which skill writes that file** -
  `scaffold` and `host` for the Environments table, `stack` and `architect` for
  the plan. A correction with no owner named reads as commentary and is lost,
  which is the read-only rule costing more than it saves.
