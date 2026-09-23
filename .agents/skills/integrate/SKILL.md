---
name: integrate
description: "Prove the parts of a multi-part project actually work together. Regenerates the contract and fails on any difference, runs each part's own verification first, then starts the parts together and exercises one real path across the boundary. Also checks whether the backend can still serve client versions people are running. Reports what is proven and what is not, per part and across the boundary. Use when the user runs `integrate`, after a part ships, before anything deploys, or when two parts each work alone and something fails between them."
---

# integrate - prove the parts agree

**Writes:** nothing

Where this sits:

    ship (a part) -> integrate -> deploy

**Every part's `verify` proves that part.** Nothing else checks that the parts
agree, and that is exactly where parallel work fails: each side is individually
correct against its own copy of an assumption, and both are green.

Only for a multi-part project. In a single-part project, say so and stop.

## Before you start

**If this is a single-part project, stop and say so.** There is no boundary to
check; `verify` and `review` already cover everything this would.

**If any part has unshipped work in flight**, say which. Integrating against a
part mid-build proves the parts agreed at a moment that will not survive the next
commit.

## Step 1 - check the contract is current

**This is the check that catches the most, so do it first.**

The contract lives in **`contracts/` at the product root** - the path from
`AGENTS.md`'s `Product root:` when running inside a part, never that part's own
directory. `architect` records its name as `File:` and the command that rebuilds
it as `Regenerate:`, in the contract block there.
**If neither exists, stop and say so**: a contract this skill cannot locate is
one nothing has been checking, which is a finding in itself and not something to
work around by guessing.

Run `Regenerate:` from the directory it names - it belongs to whichever part
owns the contract, usually the backend, because it is the one that can break it -
and **compare against what is committed** at `File:`. Any difference is a
failure.

A stale contract is a runtime failure that **neither side's tests will catch**.
The backend is correct against its code. The client is correct against the
contract it generated from. They simply disagree, and nothing that runs on one
side alone can see it.

If they differ, stop here. Regenerating and committing is a change that goes
through a part's normal loop, not something to fix in passing.

### When the contract is hand-written

Not every project generates one. If there is no generator, **say plainly that
this check is weaker**, then do what can be done:

- **Does the owning part actually serve what the contract describes?** Call the
  real endpoints and compare the shapes that come back against it.
- **Does the consuming part only use what the contract offers?** A client reading
  a field the contract does not define is a break waiting for the next deploy.

This catches drift that has already happened. It cannot catch drift that is about
to - a generated contract fails the moment the source changes, a hand-written one
fails only once someone runs this. **Say which kind the project has**, because it
changes how much this report is worth.

## Step 2 - verify each part on its own, first

Run every part's own verification command before testing across the boundary.

**An integration failure is ambiguous when a part is already broken.** Ruling
that out first turns "something is wrong" into "the boundary is wrong", which is
a much smaller thing to debug.

Report any part that fails and stop. There is nothing to learn from integrating a
broken part.

## Step 3 - exercise one real path across the boundary

Start the parts together, the way `AGENTS.md` says to run them - a process
runner, `docker compose`, or two terminals.

Then drive **one real path end to end**: a request that leaves the front end,
reaches the backend, touches its data, and comes back. Not a health check, not a
mocked call - the actual thing, through the actual boundary.

One real path proves more than a dozen mocked ones. If a second path exercises a
genuinely different shape - a write rather than a read, an authenticated call
rather than an open one - add it. Do not add a third for symmetry.

Watch for what only appears at the boundary: CORS, auth headers that are dropped,
a date serialised one way and parsed another, a field the client requires and the
server omits.

## Step 4 - check version compatibility

**Only the deployed combination matters, not the one on your machine.**

- Can the currently deployed backend still serve the client version people are
  actually running?
- **On mobile this is the sharp one.** An old app version stays installed for
  months - people do not update, and some cannot. A backend change that breaks
  the previous client breaks real users who did nothing wrong.
- If a contract change is not backwards compatible, say so plainly and name what
  it breaks. That is a deployment-ordering problem, and it is better found here
  than by a user.

## Step 5 - report

Per part, and across the boundary:

- **each part's own verification** - passed, failed, or not run
- **the contract** - current, or differing and how
- **the path exercised** - what was driven, and what it proved
- **version compatibility** - which client versions the current backend serves
- **what was not covered.** The paths not exercised, the client versions not
  checked. **Name them**, because an integration report that lists only what
  passed reads as broader than it is.

Then the bottom line: **do the parts agree, or not.**

Then point at what is next:

- **`deploy`** if they agree and the project is live - deploying **the exact
  versions this run proved**. Agreement is a fact about specific commits, not
  about the parts in general, and `deploy` asks for those versions by name.
- the failing part's own **`spec`** or **`build`** if they do not. Nothing is
  repaired from here, and `integrate` runs again afterwards - a fix in one part
  is not evidence the boundary is sound.

## Rules

- **The contract check comes first**, and a difference stops everything.
- **Never fix a part from here.** Report it; the repair goes through that part's
  own loop.
- **Never mock the boundary.** Mocking the thing under test proves the mock.
- **Unexercised is not passed.** Say what was not covered.
- **Only the deployed combination counts** for version compatibility.

## Formatting

Match `blueprint/context/ai-interaction.md` when it exists; otherwise keep output short, scannable, and direct.
