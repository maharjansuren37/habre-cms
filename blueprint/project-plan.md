# Project Plan

> One of the two planning docs you own. Answer each section in a line or two -
> a worksheet, not an essay. Draft it yourself, or let the AI help you sharpen
> it; either way the content is yours to direct. When it is filled in, run the
> `context` skill to generate the project overview from this plus
> blueprint/build-plan.md.

## 1. Problem - what are we solving?

The problem this project solves, and its main purpose.

## 2. Users - who is this for?

The kind of people who will use it. Be specific enough that it rules something
out.

## 3. Features - what does the first version need?

High-level list, one line each. No detail - that comes per item, later.

## 4. Data - what are we storing?

The things that need to persist, e.g. users, projects, sessions. "Nothing" is a
valid answer.

## 5. Tech - what stack are we using?

Filled in by the `stack` skill, or by you. Framework, language, styling,
database, testing, **monitoring and where its alerts go**, hosting. Include the
platform: web app, content website, PWA, mobile app, command-line tool, library,
or a service with no UI.

**This is filled in after section 6, not before it.** A technology is chosen
against a structure and a quality bar; chosen first, it decides them instead.

## 6. Architecture - how is it structured?

Filled in by the `architect` skill, or by you, **before section 5**. How many
deployable parts there are and why, routes or screens, the data model in enough
detail to write a schema from, where logic lives, the auth boundary, and any
third-party service a feature actually needs.

`layout` adds the directory tree here once the framework is known - where the
files physically sit is a framework convention, not an architectural decision,
and it is recorded beneath the part count it implements.

## 7. UI/UX - how should it look and feel?

The look, the feel, and any reference you are working from. Link examples.

Filled in by the `ideate` skill from what you say, or by you. `prototype` reads
this as its starting direction, so "no strong opinion, keep it plain" is a
useful answer and an empty section is not.

## 8. Deployment - where and how does it ship?

Target host if known. App type, build and start commands, env vars by name,
database or storage needs, health check path, domain notes.

Started by `architect` with what the structure implies - how many things deploy,
and what each one needs - filled in by `stack` with the concrete host, build and
start commands, and corrected by `scaffold` to the commands that actually
landed. **`host`, `deploy` and `preflight` all read this section**,
so a blank line here is a question asked at the most expensive possible moment.

**"Runs from source, not published anywhere" is a complete answer** - and it is
the one that stops `host` before it spends anything.

## 9. Money - how does this pay for itself? *(optional)*

Delete this section if it is a personal tool and the answer is "it doesn't."

## 10. Constraints - what is fixed before anything is chosen?

Anything that rules an option out rather than merely preferring one: a language
or framework you already know and want to keep, hosting it must run on, a hard
budget ceiling, a deadline, something it has to work with, app-store
distribution.

Filled in by the `ideate` skill from what you say, or by you. **`stack` Step 1
asks for exactly these**, so an empty section here is the same question asked
twice - and the answer lost between sessions rather than merely repeated.

"None" is a real answer and worth writing, because it licenses the simplest
choice instead of leaving one looking careless.

## 11. Deliberately deferred - what is not in the first version?

What was cut, and roughly when it comes back: **soon after** (real, wanted, not
needed on day one) and **later, or never** (named so it stops taking up room).

Filled in by the `ideate` skill, whose most valuable step is cutting scope.
Recording the cut is what makes it stay cut: an unwritten deferral is
re-litigated every time someone remembers it, and a first version that quietly
regrows is the most common way a project dies.
