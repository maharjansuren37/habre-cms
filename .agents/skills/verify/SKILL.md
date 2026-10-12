---
name: verify
description: "Prove the current work does what its spec says by running the real app - browser, CLI, or server - against the done-when criteria in blueprint/context/current-work.md, capturing evidence and reporting pass, fail, or could-not-verify per criterion. With --manual, writes a human walkthrough instead: what to start, where to go, what to click, what to expect. With --all, re-proves the archived done-whens of every feature already shipped, to catch a new item breaking an old one. Never edits source or commits. Use when the user runs `verify`, asks to confirm something works, wants proof before shipping, or asks how to test the change by hand."
---

# verify - prove it against the running app

**Writes:** `blueprint/context/findings.md` · `blueprint/findings/` · `blueprint/context/needs-you.md` · `blueprint/context/current-work.md` · `blueprint/capabilities/` · `blueprint/history/`

Where this sits:

    `build` -> verify -> `review` -> `ship`

> **Multi-part project:** `blueprint/project-plan.md` and
> `blueprint/context/quality-bar.md` (the bar the whole product is held to -
> `architect` writes it at the root, not per part) live at the **product
> root**, not this part. Resolve it from `AGENTS.md`'s `Product root:` field.
> Everything else here is this part's own.

`build` checks each step inline as it lands. This is the deeper gate for
when a done-when needs the *real running app* rather than a green build: a click
that triggers a download, a route that returns a file, a flow across screens.

A passing build proves the code compiles. This proves the thing the spec promised
actually happens.

## Before you start

- **`blueprint/context/current-work.md` holds a spec with none of its steps
  ticked** - there is nothing built to verify. Stop and say to run `build` first.
  Verifying an unbuilt spec produces a list of failures that describe the plan,
  not a defect.
- **It holds no spec** - not a stop. With no argument, verify the most recently
  archived item, as Step 1 says - `ship` resets the spec and then points here -
  and with `--all`, the archives. Stop only when there is no archive either.
- **A done-when names a number from `blueprint/context/quality-bar.md`** -
  measure it, do not assert it. "Under 500ms at p95" is proven with timings from a
  real run, and reporting it as met without them is a fabricated pass with a
  decimal point on it. If it cannot be measured here, that is could-not-verify.
- **The done-when criteria are not observable** - "works correctly", "is fast
  enough". Say so before running anything. This skill can only prove what someone
  wrote down as checkable, and a vague criterion is where a fabricated pass gets
  in.

## Input

| Argument | Mode |
|---|---|
| *(none)* | Prove every done-when in the current spec |
| a step, flow, or URL | Prove just that |
| `--manual` | Write a walkthrough for a person to follow, and run nothing |
| `--all` | Re-prove every **already shipped** feature from its archive, not the current spec |

`--manual` produces the guide someone uses to review the work themselves - before
approving a merge, or when they want to see it with their own eyes. It reads the
same spec and the project's real commands, then writes instructions. It proves
nothing on its own; it tells a person how to.

## Step 1 - build the checklist

Read `blueprint/context/current-work.md` and pull the observable *done when* criteria from its
build steps, plus any acceptance notes under Testing. Turn them into concrete
claims to prove - each one a specific observable behavior, never "it works".

If there is no current spec, check `blueprint/history/features` and
`blueprint/history/fixes` for the most recently archived work - by the commit
that added it (`git log -1 --format=%cd -- <file>`), since a feature's name
carries no date - and say that is what
you are verifying. If there is nothing at all, ask what to verify rather than
guessing.

**With `--all`, the source is every archive**, not the most recent one. Read each
file under `blueprint/history/features` and `blueprint/history/fixes`, pull the
done-when criteria each recorded, and build one checklist across all of them,
grouped by item and in ship order.

**Those directories each contain a `README.md` that is not an archive** - the
template ships one in each, explaining the naming convention. **Skip it.**
An archive is named `NN-title.md` for a feature and `YYYY-MM-DD-title.md` for
a fix (`title.md` in a fix archived before the date was added); the
directory's own README describes the directory. Reading it as an archive yields
an item with no done-whens, which reports as either a silent extra or a
could-not-verify against a feature that does not exist - and both make the
checklist wrong in a way nobody would think to question.

**Skip an archive whose build-plan item is unchecked** - that is a feature rolled
back. `ship` keeps its archive under `blueprint/history/features` and unchecks the
item, adding one under `blueprint/history/rollbacks` that names it, so its
done-whens describe behaviour removed on purpose; proving them reports the
rollback as a regression. Name each one skipped, with its rollback archive. A
feature shipped again after its rollback is checked again, and counts.

**Where `blueprint/capabilities/` exists, it is the checklist.** Each file there
says what holds now - superseded, cut and rolled-back claims are already gone or
tombstoned - so prove its claims, grouped by capability, and do not judge
supersession again. (In a multi-part product the directory is the part's, like
the findings.) **An archive that has a `## Behaviour changes` section is covered
by it**; walk only the archives that lack one, as below.

**Those claims were proved once, when the item
shipped, and nothing in this workflow has looked at them since** - which is the
whole reason for this mode. Two judgments remain, and each needs saying rather
than quietly resolving:

- **A claim about a feature that has since been cut** is not a regression. If the
  `*Since:*` item, or an archive's item, no longer exists in
  `blueprint/build-plan.md` - after an `ideate --rescope`, say - report it as
  **no longer applicable** and name the item, rather than failing it or silently
  skipping it.
- **A claim that was never observable** - "the code is clean", anything without a
  concrete behavior. Those were weak done-whens when written; report them as
  **could not verify** and say why, which is more useful than a pass.

**An archive with no `## Behaviour changes` section is walked claim by claim**,
judging for each whether later work superseded it (item 2 said the list is
newest-first; item 6 made the order configurable - the old claim is not wrong,
it is stale; say which item changed it). **Then offer to seed.** Show every line
first - the claims that held, each as an `Adds to` or `New capability` line
ending `- seeded`, and each claim left out as a `Left out: <claim> - <why>`
line (superseded, cut, never observable) - and stop for a yes. On a yes, append
the section to that archive and run
`.agents/bin/merge-capabilities.sh <archive> <archive name>` (`features/03-auth`); show
the IDs it assigns. **Seeding is per archive and never blocks** - on a no, the
archive is walked again next time. A seeded claim has no recorded old text, so a
later `rollback` cannot restore it; say so when offering.

## Step 2 - get the app running

Use the project's real commands, from the Commands section of AGENTS.md.
Match the project type:

- **Web app** - start or reuse the dev server, then drive a real browser to the
  relevant routes. Prefer reusing a server that is already up over starting a
  duplicate on another port.

  **A served response is not a rendered page**, and this is the substitution to
  watch for. Fetching the HTML and finding the element in it proves the markup
  shipped, not that anyone can see it. **An element can be present, correctly
  labelled, reachable by keyboard, announced by a screen reader - and zero pixels
  tall.** That has happened here: an inline `<svg>` with a `viewBox` and no
  `width`/`height` has an intrinsic ratio but no intrinsic size, so `height: auto`
  resolved to nothing, and four passing verifications in a row all checked the
  markup.

  So for anything visual, **the evidence is an image, not a string match.** A
  screenshot from a browser is the standard. Where no browser is available, use
  whatever will rasterise the thing - an SVG renderer, a headless converter - and
  **look at the output**. Where nothing at all will render it, that is
  **could-not-verify, not a pass**, and the honest sentence is "I have not seen
  this."

  The mobile paths below already say this, because it was learned there first. It
  applies identically to the web.
- **CLI** - run the actual commands with representative inputs.
- **Server or API** - start it and hit the endpoints.
- **Library** - exercise the public API through an example or the test command.
- **Mobile app (Expo / React Native)** - start the dev server and open the app on
  a **simulator or a real device**. A bundler that starts proves nothing; the app
  has to render. Capture screenshots from the simulator. Where no device is
  available, run the typecheck and `expo-doctor`, then **say plainly that nothing
  has run on a device** - that is an unverified result, not a pass.
- **Mobile app (Flutter)** - `flutter run` against a simulator or device, with
  `flutter analyze` as the static floor. Same rule when no device is available.
- **Native mobile** - build and run from Xcode or Android Studio. This usually
  needs the user; say what to run and what to look for rather than claiming it.

**On mobile, "it built" is not "it works."** The gap between a green build and a
working screen is wider there than anywhere else - layout, permissions, platform
differences, and device size all break things a compiler never sees.

**Use the browser automation tool the stack settled on**, if there is one.
`stack` decides it for any platform that renders and `scaffold` installs it, so
by the time this skill runs it is either present or was declined on the record.
Drive the real routes with it, and **look at what it captured** - a screenshot
that was taken and never opened proves nothing that the HTML did not.

**Do not add one from this skill.** It is a dependency and a few hundred
megabytes of browser binaries; this skill never edits the product - it writes
only workflow state, the files its Writes line names - and installing mid-verification is the wrong
moment. If a project that renders has no harness, say
so, name `stack` as where that gets decided, and carry on with what can be
observed.

**Where there is no harness, the fallback is a person:**

- **Someone is available** - `--manual` writes them a walkthrough and their
  eyes are the evidence. Better than a harness for judgement: whether it looks
  right, whether it is confusing. Worse for repetition: nobody re-checks item 1
  by hand when item 9 lands.
- **Nobody is available** - every visual claim is **could not verify**, honest
  and useless every time it happens - the case the harness exists for.

Never let a deferred manual check quietly become a pass. **"I have not seen
this" is the sentence**, and it belongs in the report whether it is waiting on a
person who has not looked yet or on a harness nobody installed.

## Step 3 - exercise each claim

Drive the app to each claim and capture evidence as you go:

- **Interact for real** - click, type, submit, download. Never assert from reading
  the code what the running app would have done.
- **Capture proof** - screenshots for visual claims, output for CLI and API
  claims.
- **Watch the console and the network.** A clean-looking screen with errors in the
  console is not a pass.
- **Where sign-in guards a page, walk the redirect both ways.** For each
  protected page this work adds or touches, and each action that ends or changes a
  session - signing out, a password or role change: start signed out, reach it
  by a full page load and through the app's own link or form, sign in, and check
  the final URL is where you started. A 404, or a URL still carrying the
  framework's data-request form (`.data`, `_data`, `_rsc`), fails. The full
  page load alone passes while the click fails: a client-side navigation's
  request URL is that form, and a redirect built from it sends the user there.

## Step 4 - report

One line per claim, with the evidence attached:

    [pass]  Download saves report-<slug>.pdf     file downloaded, opened, content correct
    [pass]  Both buttons show a loading state    screenshot: loading-state.png
    [fail]  PDF border missing                   printBackground not set; screenshot: pdf-no-border.png
    [skip]  Production render                    cannot verify locally - needs deploy

Then the bottom line: are all the done-whens proven, or not yet.

- **All proven** - say it is ready for `review`, then `ship`.
- **Anything failed** - hand back to `build` and name exactly what to fix. If the
  failure is one nobody can explain - the behavior contradicts the code, or the
  same criterion has now failed twice - route to `debug` first. `build` repairs a
  known cause; it is not where an unknown one gets found.
  Do not fix it here.
- **Anything unverifiable** - say so plainly and why. Never report it as a pass.

**Record the result in the spec's `**Verified:**` line**, replacing what is
there: the date, the work fingerprint, and the count -
`**Verified:** 2026-03-02, 6f06b62b2f2c, 4 of 5 proven, 1 could not verify`.
`ship` reads it; a report said only in the conversation is gone when the
context is cleared, and then the item is either verified again at the merge or
merged on a claim nothing can confirm. The fingerprint is the tree of every
file outside `blueprint/` and `dev-notes/`, committed or not, so a checkpoint
commit does not change it and any edit to the code does. Run it from where this
skill runs:

    i=$(mktemp) && rm -f "$i" && GIT_INDEX_FILE="$i" git add -A -- . ':!blueprint' ':!dev-notes' && GIT_INDEX_FILE="$i" git write-tree | cut -c1-12; rm -f "$i"

**With `--all`, the bottom line is a different sentence.** Nothing here is ready
for `review` or `ship` - no item is in flight. Report instead:

- **how many shipped items were re-proved, and how many claims each contributed.**
  A count of items alone hides that one item had eleven done-whens and another had
  one.
- **every regression, by the item that recorded the claim and, where you can tell,
  the item that broke it.** A regression's value is mostly in the second half:
  "item 2's list order is wrong" is a bug report, "item 6 changed the ordering and
  item 2 still asserts newest-first" is a fix.
- **what is no longer applicable, superseded, or was never observable** - counted
  separately, never folded into passes. A run reporting "18 of 20 pass" when four
  of those were unobservable claims nobody could have checked is worse than one
  reporting 14 passes and 4 unknowns.

**A regression does not go back to `build` the way a current-spec failure does.**
There is no spec for it. Raise it in `blueprint/context/findings.md` with a
severity, the same as `review` does - the heading there, the entry in
`blueprint/findings/<ID>.md` - and let `spec` pick it up as a fix - that is
the route a defect in shipped code already has, and this is one.

**Say what this run cost.** Re-proving every shipped feature by observation is
the most expensive check in this workflow and it grows with the project. It earns
that before a release, after a dependency upgrade, or when something feels off -
not every item. Saying the cost is what stops it being run out of habit and then
skipped when it matters.

**In every mode, not only `--manual`:**

**Every could-not-verify becomes a line in
`blueprint/context/needs-you.md`.** A criterion needing a screen reader, a
real device, or a person looking at the page is not a failure and is not a
pass - it is work waiting on a human, and unrecorded it reads as neither.
This is what stops "I have not seen this" from quietly becoming "this
works" by the time anyone reads the report.

**Widen an open manual check rather than adding a second one**, and count it:
the line carries `Widened: N`, raised by one each time an item adds to it.
**At 3, stop widening and ask** - do the check now, or accept the risk. An
accepted risk is `dropped` with the user's reason, and the next item starts a
fresh line. A check widened by every item and never done ends up accepted all
at once, at the end, as a single decision over screens nobody has looked at.

## Step 5 - the manual walkthrough (`--manual` only)

Instead of Steps 2-4, write a guide a person can follow with no further context:

1. **Start it** - the exact command, the URL, how to tell it is ready.
2. **Set up** - any account, seed data, or state needed first. Say how to get it.
3. **Walk the path** - numbered steps: where to go, what to click or type, what
   should happen at each point. One action per step.
4. **What good looks like** - the observable result for each done-when.
5. **What would count as wrong** - the specific failure modes worth watching for,
   including anything the automated checks cannot see.
6. **Gaps** - what this walkthrough cannot cover and why.

Write it for someone who has not read the spec.

## Rules

**Evidence, or it didn't happen** - `AGENTS.md`'s rule applies here: name what
proves it, and "could not verify" beats a fabricated pass every time.

- **Observe, do not change.** This skill runs the app and reports. It never edits
  source, never commits, never merges. Fixing belongs to `build`.
- **Check the spec, not vibes.** Verify against the done-whens in
  `blueprint/context/current-work.md`, so "works" means what the spec said it would do.

## Formatting

Match `blueprint/context/ai-interaction.md` when it exists; otherwise keep output short, scannable, and direct.
