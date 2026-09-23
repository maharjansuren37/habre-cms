---
name: architect
description: "Turn the problem, users, features and constraints already in `blueprint/project-plan.md` into a concrete structure, before any technology is chosen: routes and pages for a web app or PWA, screens and navigation for a mobile app, or a page list for a website - plus the data model, where logic lives, the auth boundary, and any third-party service a feature actually needs. Sized to the project's real scope. In a product with parts, also splits the build plan into each part. Proposes exact edits to the plan's Architecture section and stops for approval before writing. Use when the user runs `architect`, has a plan and needs structure before choosing a stack, or asks how to structure a new project."
---

# architect - design the structure before you build

**Writes:** `blueprint/project-plan.md` · `blueprint/context/quality-bar.md` · `blueprint/build-plan.md` · `dev-notes/decisions.md` · `blueprint/context/needs-you.md`

Where this sits:

    `ideate` -> architect -> `stack` -> `layout` -> `scaffold` -> `ci` -> `context`

Run this once `blueprint/project-plan.md`'s problem, users, and features have real
content - **before `stack` chooses a technology, and before `scaffold` installs
anything.** Architecture is the design of the system; technology is how it gets
implemented, chosen *against* that design. Reversed, the architecture becomes
whatever the chosen technology makes easy, and the questions that should have
ruled a technology in or out get asked afterwards, when the answer is a rewrite
rather than a choice. `stack` and `layout` both stop on a placeholder Architecture
section, so this cannot be skipped.

**But it is short for a small project, and short is the correct outcome - not a
sign it went wrong.** For most things that is: six no's to the questions in Step
2, one line saying so, one application, a data model, and a four-line quality bar
that says "tens of users, down until I notice". Step 3 says "system design does
not apply" and stops. **That is a complete run**, and it takes minutes.


> **Multi-part project:** `blueprint/project-plan.md`,
> `blueprint/context/quality-bar.md` (the bar the whole product is held to -
> `architect` writes it at the root, not per part), and
> `blueprint/context/principles.md` (the product's own, from `ideate`) live at
> the **product root**, not this part. Resolve it from `AGENTS.md`'s
> `Product root:` field. Everything else here is this part's own.

## Before you start

If `blueprint/project-plan.md` does not exist, or its problem and features
sections are still placeholder text, **stop and say to run `ideate` first.** This
skill designs structure for a defined idea; it does not invent the idea, and a
structure designed for a problem nobody has stated is shaped by whatever the
designer already had in mind.

**So the Tech section will be empty, and that is correct.** Do not stop for it,
and do not guess at it - `stack` fills it in next, against what this skill
decides.

**One thing genuinely does depend on the technology, and it is not architecture:
where files physically sit.** A "flat" layout is right in one ecosystem and
breaks in another - a .NET `.csproj` globs everything beneath it. **That belongs
to `layout`**, which runs after `stack` and knows the framework's own
conventions. This skill decides **how many deployable parts there are and why**;
`layout` decides what the directories are called and where config lives.

Say that split out loud when it comes up, because the two look like one question
and are not: *"two parts because they deploy separately"* is architecture,
*"`web/` and `api/` with a workspace root"* is a framework convention.

**If the Architecture section is already filled and code exists in that layout,
say what changing it costs before proposing anything.** This skill proposes and
stops, so nothing moves without approval - but approval given without the cost
stated is not informed. **Re-deciding the parts after `scaffold` has run moves
every file**, and if the change is one application becoming several it is a
conversion of the whole repository: a board and status files appear, and each
part is scaffolded separately afterwards. `convert-to-parts.sh` performs that
split; do not hand-move the tree. Git makes it recoverable, not cheap.

Small additions are not this. Adding a route, a screen or a table to a settled
architecture is ordinary work - say the cost only when the *shape* changes. A
change to the directory names alone is `layout`'s, not this skill's.

## Input

No argument. Reads `blueprint/project-plan.md`, `blueprint/build-plan.md`, and
`blueprint/context/principles.md` if it exists.

## Step 1 - read what is already decided

Pull the problem, users, features, UI/UX and Constraints from
`blueprint/project-plan.md`, and the item list from `blueprint/build-plan.md` if it
has entries. The Tech section is still empty - `stack` fills it after this.

**Read `blueprint/context/principles.md` too, if `ideate` wrote one.** It holds
what the project will never trade away - not a number to hit, like the quality
bar this skill writes next, but a commitment the structure itself must not
quietly violate. A structure that would cost one of them - "one person
maintains this" ruling out a service that needs its own on-call, say - is a
finding to raise here, not a detail to route around in silence.

That is the brief. Do not re-ask questions it already answers.

## Step 2 - size the design to the project

**Answer these six first.** They decide the shape of the system, and `stack`
reads them next to rule technologies in and out - "work outside a request" makes
a job runner a requirement rather than a preference, before anyone is attached to
a framework that has none.

- more than one **deployable service**?
- work that must happen **outside a request**?
- data that must stay **consistent across more than one write**?
- a **dependency whose failure is not acceptable**?
- **real load, or a hard latency target**?
- an **external API that is rate-limited or unreliable**?

**On the third question, be precise about what a yes settles.** It is a
*transaction* requirement, and every relational database provides transactions -
single-file ones included. **On its own it rules out no storage engine.** What
bears on that is **concurrent writers**, which is the fifth question. Say both
answers to `stack` rather than the third alone, or it will reject an option for a
reason that is not true.

**Six no's is the common answer and a complete one.** Say so in a line, record it
in the plan's Constraints, and design the small thing the answers license. It is
also the answer that licenses the simplest technology, which is why `stack`
needs it before it recommends rather than after.

Then judge the real complexity from the feature list.
**A handful of CRUD screens is not a system that needs service boundaries, a
message queue, or a diagram with more than six boxes.** Match the depth of the
design to what is actually being built.

Say explicitly when something does not apply - "no background jobs needed" -
rather than staying silent or inventing scope to fill a heading.

Design only what the project needs, from:

- **How many deployable parts** - and why. **This is an architectural decision,
  not a directory choice**: parts exist because they deploy separately, scale
  separately, or are owned separately. **Not because two languages were chosen** -
  that reasoning runs backwards, and it is what picking the technology first
  produces. `layout` decides what the directories are called, using the
  framework's own conventions, once `stack` has chosen one.

  Three shapes, and they are not equally likely:
  - *One application* - a single source root, usually `src/`. **This is the
    default and most projects should take it**, including anything with server
    routes inside the same framework. Splitting is easy to do and expensive to
    undo.
  - *Two parts in one repository* - a front end and a separate backend, because
    they deploy or scale separately. (They often also end up in different
    languages, but that is a consequence of the split, not a reason for it.)
    **Name each part and say what it is for**, **how they share types across the
    boundary**, how both run together in development, and whether they deploy
    together or apart. That last question is the one people forget and then
    discover at deploy time.

    **Name them; do not place them.** Whether that is `web/` and `api/` or
    `apps/web` and `apps/api` is a framework convention and belongs to `layout`,
    which runs after `stack`. `convert-to-parts.sh` below takes the names, and a
    name is all it needs.
  - *Separate repositories* - only when the parts genuinely release on
    independent cycles or different people own them. For a solo project this is
    almost always wrong: it doubles the tooling and makes a change spanning both
    a two-repository dance.

  **Config files stay at the root of whichever part owns them**, because that is
  where their tools look.

  **Choosing more than one part means choosing coordination.** Each part gets its
  own loop and its own state so parallel sessions cannot collide, and they
  coordinate through the board that `orchestrate` maintains. Say so here, and say
  who owns the contract - usually the backend, because it is the part that can
  break it.

  **If this project is currently single-part, choosing parts is a conversion, and
  it does not happen by itself.** Splitting a project by hand goes wrong quietly:
  the product plan has to move up, the board and the status files have to be
  created at the product root, each part's `AGENTS.md` needs its `Part:` and
  `Product root:` fields, and the product root needs its own copy of the skills
  or there is nowhere to run `orchestrate` from. Miss any one and every file
  still looks correct while the coordination silently does not work.

  So **stop here and say what has to be run** - the pack's
  `convert-to-parts.sh`, from wherever the pack itself is installed:

      convert-to-parts.sh --parts web,api --existing web

  `--existing` names the part this project becomes; everything currently here
  moves into it, and nothing is deleted. It refuses on a dirty tree, because the
  whole conversion should be one diff that can be thrown away. **Do not attempt
  the move by hand instead** - and do not carry on designing against parts that
  do not exist yet.

  **This is cheap here and expensive later**, which is the reason this skill runs
  before `stack` and `scaffold`. Right now the project is planning files and nothing else, so
  the conversion moves a handful of markdown. After scaffolding it moves an
  installed framework, its lockfile and its dependency directory - and then each
  part still has to be scaffolded separately anyway. Convert first, scaffold
  into the parts second.

  **Whenever the product has parts, split the build plan across the parts - this
  does not happen by itself** - whether they came from this conversion or from
  `new-project.sh --parts`. A conversion moves everything part-local into
  `--existing` and seeds the others empty, so every item `ideate` wrote lands in
  one part. A product created with parts has no build plan at its root at all, so
  `ideate` there leaves the first version as the features in the product plan and
  **every** part's plan is empty. Either way `spec` run in a part reports
  *nothing is queued* while its entire surface is unbuilt. And the items describe
  the **product**: "record a loan" is a form *and* an endpoint, and left whole it
  is an item one part cannot finish.

  So rewrite each product item - or, with no build plan yet, each first-version
  feature - as the part-sized items it implies, in each part's own
  `<part>/blueprint/build-plan.md`, and say which came from which. Show the split
  with Step 5's proposal and write it in Step 6. A part whose plan already has
  items keeps them, ticks included; add only what is missing. **`ideate` is the
  only skill that writes an initial item set and it runs once, at the product
  root** - after the split, nothing else will do this. Check the same way for
  anything else written before there were parts: open
  `blueprint/context/needs-you.md` lines move to that file in the part that uses
  the tool, and `dev-notes/decisions.md` entries that are
  product-wide belong at the root. The conversion script lists what it moved for
  exactly this reason.

- **When the two parts do not share an ecosystem** - a React front end with an
  ASP.NET, Django, or Rails backend - three things that are free within one
  ecosystem become real work, and **each needs an answer here rather than at
  deploy time**:
  - *Sharing types* - there is no package both can import. Generate from a
    contract instead: the backend emits an OpenAPI document, the front end
    generates its client from it, and **the generation runs as part of the
    build** rather than by hand. Hand-writing the types on both sides drifts
    silently the first time a field changes.
  - *One verification command* - an npm script cannot run `dotnet test`. Put
    something ecosystem-neutral above both - a `Makefile` or a small script -
    with each part keeping its own native command underneath.
  - *Running both in development* - no workspace tooling spans them. A process
    runner, `docker compose`, or two terminals. **Two terminals is a legitimate
    answer**; leaving it unstated is not.

  Also decide **which part owns the contract** and write it as `Owner:`. Usually
  the backend, because it is the one that can break it. `orchestrate` and `spec`
  both gate on that field: the owner specs and builds first, and a placeholder
  there means there is no freeze to make.

  **And say where it lives, by name.** The contract goes in `contracts/` at the
  **product root** - not inside the owning part, because a file inside `api/`
  reads as `api`'s private business when it is the one thing both parts are
  bound by.

  **Fill every line of that block, by its own name** - the block is read field by
  field, and a paraphrase reaches nothing:

  - `File:` - the actual filename (`contracts/openapi.yaml`,
    `contracts/schema.graphql`), not "the contract file".
  - `Kind:` - `generated` or `hand-written`. It is the field `ci` branches on
    when it decides whether there is a regeneration to check.
  - `Regenerate:` - the command, and the directory it runs from. `ci` and
    `integrate` both run it and fail on a difference.
  - `Generate clients:` - the command each consuming part runs to generate its
    client, and where each runs. A generated client goes stale exactly the way
    the contract does, and `ci` checks it the same way.

  A hand-written contract has no regenerate command, so say `hand-written`
  rather than leaving the line empty: the checks are genuinely weaker then, and
  the block is where that gets admitted.

  **A contract nobody can name is a contract nobody checks.** `integrate` and
  `ci` both regenerate it and fail on a difference; neither can do that against
  "the contract file" in the abstract. Write the paths into `AGENTS.md` with the
  other commands.

  **And say what it covers: every boundary the plan's features cross, now** -
  each route or operation and the shape it carries, taken from the routes and
  data model above, not only what the owner's first item needs. `orchestrate`
  refuses to freeze while an open item would still change the contract, so a
  contract that grows one item at a time keeps every consuming part waiting for
  the owner's entire plan. Written whole, the owner's later items implement the
  contract instead of extending it. **A generated contract** cannot be written
  ahead of the code that emits it, so make the owner's first item the one that
  stubs every planned route - the document it generates is then whole, and the
  freeze follows that item rather than the whole plan.

- **Inside a source root** - say how it is organised, because "we will see"
  becomes a different answer in every file:
  - *Flat* - a handful of modules beside each other. Right for something small;
    do not build folders for four files.
  - *By feature* - `bookmarks/`, `folders/`, each holding its own UI, logic, and
    types. Scales with the number of features and keeps a change in one place.
  - *By layer* - `components/`, `hooks/`, `lib/`, `types/`. Familiar, but a
    single feature ends up scattered across every folder.

  Pick one, name it, and say when it should change. **Starting flat and moving to
  features when it hurts is a legitimate and common answer** - just say that,
  rather than leaving it undecided.

- **Structure** - branch on the platform - web app, PWA, mobile app, website - as
  the plan's features, UI/UX and Constraints describe it. **It is not in the Tech
  section yet**; if the plan does not say, ask rather than guess, and record the
  answer in Constraints so `stack` does not ask again. In a
  two-part project, apply this per part - the front end has routes or screens,
  the backend has endpoints.
  - *Web app or PWA* - routes and pages, following the framework's own
    conventions. For a PWA, the service worker's cache strategy and offline
    fallback belong here too: they are structure, not a later addition.
  - *Mobile app* - screens and navigation structure, not routes. Name any device
    capability a feature actually needs - camera, location, notifications,
    local storage - and only those.
  - *Website* - often just a page list and where it is hosted. Say that outright
    rather than forcing a routing design onto six static pages.
- **Data model** - the core entities, their fields, and how they relate, at the
  level of detail someone could write a schema from. Not full DDL.
- **Where logic lives** - and why. On web, the choice between server-side
  handlers, API routes, or nothing at all for a static site. On mobile, there is
  almost always a real API to call, so name what the client talks to and where
  that backend runs.
- **Auth boundary** - if there are users: where authentication happens and what
  is gated behind it. "None" is a valid answer for a single-user tool.
- **Integration points** - third-party services a feature in the plan actually
  requires. Only those. A payments integration for a project with no paid feature
  is scope invented by the architecture.

## Step 3 - system design, only if the project crosses a line

Everything above is **application** architecture, and for most projects it is the
whole job. This step asks whether more is genuinely needed.

**Ask whether any of these is true:** more than one deployable service · work
that must happen outside a request · data that must stay consistent across more
than one write · a dependency whose failure is not acceptable · real load or a
hard latency target · an external API that is rate-limited or unreliable.

**If none of them is, say so explicitly and stop here.** "Single process, one
database, no background work" is a complete and correct system design for most
things, and stating it prevents a speculative queue or cache being added to a
project that needs neither.

If any is true, decide:

- **Async and background work** - what runs outside the request, what triggers
  it, and what happens if it fails or runs twice. Idempotency belongs here.
- **Failure modes** - for each external dependency, what happens when it is down
  or slow: retry with backoff, degrade, queue, or fail loudly. Choose, deliberately.
- **Caching** - what is cached, where, for how long, and **how it is
  invalidated**. Invalidation is the part that gets skipped and the part that
  causes the bugs.
- **Consistency** - which operations must be atomic, where a transaction is
  needed, and what may briefly be out of date.
- **Rate limits** - both directions: what the APIs you call impose on you, and
  what you must enforce on your own callers.
- **Service boundaries** - only with more than one deployable unit: what each
  owns, how they talk, and what happens when one is unavailable.
- **Scaling limits** - what breaks first, and roughly at what load. An honest
  ceiling beats an architecture that pretends to be infinite.
- **What must be measurable** - the few signals that would reveal each failure
  mode above. **This is the direct input to `monitor`**, and `preflight` later
  checks whether they were actually wired up, so observability gets designed
  rather than retrofitted after the first outage.

**Write down what does not apply, with the reason.** Silence is what lets an
invented queue creep in, and equally what lets a real failure mode go
unconsidered.

## Step 4 - record the quality bar

Step 3 asked whether this project has real load or a hard latency target. **Write
the answer down as a number, including when the answer is "no".** Asking the
question and discarding the answer is why `review`'s performance lens can only
report generic smells - `N+1`, unbounded collection - and can never say *this
exceeds what the project said it would accept*.

Write `blueprint/context/quality-bar.md`. Keep it short; every line must be
something a person or a command could check:

- **Performance** - the one or two numbers that matter, and **where they are
  measured**: on the server, or as the user experiences it in their browser or on
  their device. "Search results under 500ms at p95", with the place named, is a
  bar. "Fast" is not. **Where is a decision, not a detail - ask the user which
  they mean.** It rules technology in and out by itself: a server-side number is
  one a page rendered in the browser cannot produce, and a user-experienced one
  is not. An example here once said "measured server-side", and projects that
  never discussed it copied the phrase - deciding the question for them.
- **Scale** - the load this is actually built for. "One user, a few hundred rows"
  is a real and useful answer, and it is the honest one for most projects. It
  licenses simple choices later instead of leaving them looking careless.
- **Security posture** - what this handles and what that obliges. Whether there
  is authentication, whether any data is personal or regulated, whether secrets
  go anywhere but environment variables.
- **Availability** - what happens when it is down, and for how long that is
  tolerable. For most personal projects "it is down until I notice" is correct;
  say it, so nobody builds failover nobody wanted.

**Accessibility belongs in `blueprint/context/design.md`, not here** - `prototype`
owns that bar and records the contrast values it actually measured. Point at it
rather than restating it, so there is one owner per concern.

**A bar nobody can check is worse than none**, because it reads as rigour while
resolving no argument. If a number cannot be justified, write "not measured, no
target" - `preflight` treats that as a knowingly-accepted risk, which is a real
outcome, rather than pretending a target exists.

**This bar is written before any technology exists, and that is the point.**
`stack` runs next and reads it: the bar is what rules options in and out, so it
has to be a number on the page before anyone is attached to a framework. A bar
written afterwards only ever ratifies the choice already made.

**Write it as what the project requires, never as what something can do.** "Under
300ms at p95, as the user experiences it" is a requirement. "Fast enough for SQLite"
is a technology decision wearing a bar's clothes, and it forecloses the next
step's job.

Re-run this step whenever the answer changes. `setup` writes this file for a
project that already existed, by measuring what is true rather than choosing it.

## Step 5 - stop for approval

Show the proposed structure and the exact text you would add to
`blueprint/project-plan.md`'s Architecture section. Wait.

On pushback, adjust and re-show the whole section rather than applying it
partially.

## Step 6 - write the approved edit

Write only the approved text, only into the Architecture section. Leave the
problem, users, features, UI/UX, and deployment sections alone - those are the
user's own planning pass. **In a product with parts, also write each part's
build plan** from the approved split in Step 2.

**Everything from Steps 2 and 3 goes *inside* section 6, under `###`
sub-headings.** The plan's sections are numbered and other skills address them by
number - `context` checks "6. Architecture" and "5. Tech" by heading. **A `##`
heading written between two numbered sections silently changes where section 6
ends**, so a reader or a skill taking "the Architecture section" gets the wrong
span. Step 3's system design is the block most likely to be written this way,
because it is long enough to feel like a section of its own. It is not.

**Start the Deployment section with what the structure just decided.** This skill
runs before `stack`, so the section is usually empty and this is what opens it -
how many things deploy, storage a feature needs, a health check path if something
serves requests, and for a multi-part project, whether the parts deploy together
or separately. **That last one is the question people discover at deploy time**,
and it is settled here.

**Do not name a host, a build command or a start command.** Those need the
framework and are `stack`'s to add next; a placeholder written here is a guess
that reads like a decision to `host`.

Write `blueprint/context/quality-bar.md` from Step 4 at the same time, and say in
your report that you did - it has readers in `spec`, `verify`, `review` and
`preflight`, and an unwritten one silently removes the project's own standard from
all four.

**In a multi-part product that is `<product root>/blueprint/context/quality-bar.md`,
and there is one.** This skill runs at the product root, so an unqualified
`blueprint/` here is already the root's - but every one of those four readers runs
*inside a part*, where the same string means that part's own directory. Say the
qualified path in your report so nobody looks in the wrong place, and **do not
write a copy into each part**: scale, security posture and availability are facts
about the product, and two copies of a bar is how two parts end up held to
different standards. Where a number genuinely differs per part - a latency budget
for the API, a render budget for the front end - say so per part inside the one
file.

**Record the reasoning where it will be found.** When a structural choice had a
real alternative and a real why, add a numbered entry to `dev-notes/decisions.md`
saying what was chosen, what lost, and what it costs. A trade-off buried in a
plan section is one nobody will read.

Then say what is next. **`stack` comes next in every case.** It chooses the
technology against what this skill just decided - the shape questions, the part
count and the quality bar - which is the whole reason this runs first. Hand it
those answers explicitly rather than leaving it to re-read them.

`layout` follows `stack`, and turns the part count into real directory names
using the framework's conventions; `scaffold` then installs into them, and `ci`
and `context` follow that.

Then **branch on whether this project has a UI worth settling before the build
loop starts**:

- **It has real screens** - name `prototype` after `context` and before the first
  `spec`. It reads `blueprint/context/project-overview.md` for what the screens
  must show, and `context` is what generates that, so it cannot usefully run
  earlier. Deciding what something looks like *while* building it is expensive;
  deciding it first in throwaway HTML costs almost nothing to redo. Skipping it is
  a legitimate choice, but it should be a choice, not something nobody mentioned.
- **It has little or no UI** - an API, a CLI, a library - go straight from
  `context` to `spec` and say why `prototype` does not apply.

## Rules

- **Size it to the project.** The most common failure here is designing for a
  scale the project will never reach. Fewer boxes.
- **Say what does not apply.** An explicit "no queue needed, this is one user"
  is more useful than silence, and stops the question being re-litigated later.
- **Only what a planned feature needs.** If nothing in the plan calls for it, it
  is not in the architecture.
- **Never write outside the Architecture section**, except what Step 6 names:
  the Deployment opening, the quality bar, decisions, and each part's build plan.

## Formatting

Match `blueprint/context/ai-interaction.md` when it exists; otherwise keep output short, scannable, and direct.
