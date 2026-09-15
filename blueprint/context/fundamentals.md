# Fundamentals

> **This file belongs to the pack, not to your project.** It is refreshed every
> time the workflow is installed or updated, so improvements reach projects that
> already exist - which is exactly what did not happen before it was split out.
> **Edits here are overwritten.** Anything specific to this project goes in
> `coding-standards.md` next to it, which is yours and is never overwritten.
>
> Read alongside `coding-standards.md`: this is the part that holds regardless of
> language or framework, that one is the part that does not.
>
> **A rule you disagree with is changed or deleted in `coding-standards.md`**, by
> stating the project's own version there - `review` reads both and the project's
> own answer wins. A rule nobody intends to follow produces findings that train
> you to ignore findings.

## The bar

Code should be understandable, consistent with what is already around it, tested
where it matters, and safe to keep building on. Not perfect.

## Naming

- **Name for what it is, not how it is built.** `unpaidInvoices`, not
  `filteredArray2`.
- **A name that needs a comment to explain it is the wrong name.** Rename it
  instead of annotating it.
- Booleans read as assertions: `isExpired`, `hasAccess`, `canRetry`.
- **One concept, one word, everywhere.** Alternating `user`, `account` and
  `member` for a single thing makes the codebase unsearchable.
- Expand abbreviations except the ones the domain already uses. `id` and `url`
  are fine; `usrMgr` is not.
- **Length scales with scope.** `i` inside a two-line loop is clear; an exported
  name has to stand on its own in a file that never imported it.

## Functions and flow

- **One function, one job, at one level of abstraction.** A function that
  validates, saves and emails is three functions and a name that lies.
- **Guard clauses over nesting.** Handle the failures first and return early;
  the happy path belongs at the left margin.
- Nesting past three levels is a signal to extract, not to indent further.
- **A long parameter list is the function asking to be split** - or to take one
  well-named object.
- **Return a value or cause an effect, not both.** A function that looks like a
  question and quietly writes something is where surprises come from.

## Duplication and abstraction

- **Duplication is cheaper than the wrong abstraction.** The wrong one is paid
  for at every call site, by everyone, forever.
- Copy it the second time. **Extract on the third**, when the shape is known.
- **Extract when the reason to change is shared**, not when the code merely
  looks similar. Two functions that coincidentally match today will diverge, and
  the abstraction that joined them becomes a flag parameter.
- An abstraction with one caller and a boolean argument is usually two
  functions wearing a coat.

## Types and data

- Type the boundaries: function signatures, API responses, stored shapes.
  Internal locals can infer.
- **Define a shape once and import it.** Two definitions of the same thing
  drift, and nothing tells you when.
- **Validate at the trust boundary** - user input, request bodies, URL params,
  external API responses - not deep inside where the check is easy to miss.
- Make invalid states unrepresentable where the language allows it. A type that
  cannot hold a bad value beats a check that has to be remembered.

## State and mutation

- **Prefer values that do not change.** Reassignment is where "how did it get
  like that" bugs live.
- **Never mutate an argument the caller still owns.** Return a new value.
- **Module-level mutable state is shared by everything that imports it** -
  including your tests, which then pass or fail depending on their order.
- Keep state as close to where it is used as it will go.

## Errors

- Handle the failure that can actually happen here; let the rest propagate.
- **Never swallow an error to make a check pass.** An empty `catch` is a bug
  with a comment where the fix should be.
- An error a user sees says what happened and what to do about it. An error a
  developer sees carries the context needed to debug it - what was being done,
  to what.
- **Fail loudly at the boundary, not silently in the middle.** A default value
  substituted for a failed call hides the failure until it matters.
- Handle the exceptional path with the same care as the happy one - a partial
  write, a timeout mid-transaction, a retry that runs twice.

  *This section is **OWASP Top 10 2025 A10, Mishandling of Exceptional
  Conditions** - also new in 2025. Error handling stopped being purely a quality
  concern and is now a named security risk, because the state a system is left
  in after a half-completed operation is what gets exploited.*

## Async and concurrency

- **Every async operation has a failure path.** An unhandled rejection is an
  error you will never be told about.
- `await` inside a loop is sequential. That is sometimes right - say which it
  is, rather than leaving the reader to guess.
- **Anything acquired is released on every path**, including the error path:
  files, connections, locks, timers, subscriptions.
- Two things that can write the same record need an answer for what happens when
  they collide. "It probably will not" is not the answer.

## Security

- **Never trust a client-supplied identifier for ownership.** Scope user-owned
  queries by the authenticated user's id, server-side.
- **Authorize on the server.** A hidden button is not access control.
- Secrets come from the environment, never from source. Never log one, and never
  paste one into a commit, a comment, or a finding.
- Parameterise queries. Escape on output. Neither is optional because the input
  "comes from our own front end".
- Default to closed: a new route, field or file is private until something
  deliberately makes it public.

## Dependencies

- **Adding one is a decision, not a detail.** It is code you did not write,
  running with your permissions, that you now maintain.
- Prefer the standard library or something the framework already ships. A
  dependency for a few lines rarely repays its upgrade and supply-chain cost.
- **Pin versions.** A floating `latest` means the build is not reproducible and
  a version nobody chose can ship - this pack has already broken a build exactly
  that way.
- Check it is maintained, and that its licence fits how this project is
  distributed, **before** adding it rather than at release.
- **An upgrade is feature-sized work**, not a chore slipped into an unrelated
  diff.
- Commit the lockfile, and treat a lockfile that disagrees with the manifest as
  a broken build rather than a warning.

  *This section is **OWASP Top 10 2025 A03, Software Supply Chain Failures** -
  new in the 2025 edition, straight in at #3, and the category with the highest
  incidence rate measured. It covers dependencies, build systems and
  distribution, which is why pinning and lockfiles sit here rather than under
  tooling.*

## Tests

- **Test the logic that would be expensive to get wrong**: parsers, validators,
  money and dates, permission checks, anything with branches.
- Do not test the framework, and do not write a test that only restates the
  implementation.
- **Assert on the result, not on its shape.** A test checking `.length` passes
  for the wrong contents.
- **A test that cannot fail is worse than no test**, because it reports safety
  that does not exist. If you have not seen it fail, you have not tested it.
- Each test sets up what it needs and depends on no other test having run.
- Put a test next to the source it covers.
- Testing is opt-in per project. Where no runner is configured, UI and
  integration work rides on a screenshot plus a green build - **say so rather
  than implying coverage exists.**

## Logging

- Log what you would need at 3am: what happened, to what, and enough context to
  find it again.
- **Never log secrets, tokens, or personal data.** Redact at the call site, not
  in the log viewer.
- A log nobody reads is cost without benefit. Delete it or make it useful.
- **Log the security-relevant events**: failed authentication, access denied,
  and anything that changes permissions. Detection you never wrote is the one
  gap no later audit can close retroactively.

  *This section is **OWASP Top 10 2025 A09, Logging & Alerting Failures**. Note
  "alerting": a log written and never delivered to anyone is the failure, not
  the fix - the same point `monitor` makes about a check with no delivery
  channel.*

## Comments

- **Comment the why, never the what.** The code says what.
- A comment repeating the function name is noise. One explaining a non-obvious
  constraint, a workaround, or a decision earns its line.
- **Delete commented-out code.** Git remembers it and Git can search it.
- A comment that has drifted from the code is worse than none, because it is
  believed.

## Dead code and scope

- **Delete unused code rather than leaving it unreferenced.** Unreachable code
  still gets read, maintained and searched.
- **Do not build for a requirement nobody has stated.** Speculative generality
  is the most expensive kind of dead code, because it shapes everything around
  it.

## Performance

- **Correctness first, then measure, then optimise.** An optimisation without a
  measurement is a guess that costs readability.
- Judge against `blueprint/context/quality-bar.md` - the numbers this project
  actually promised - not against what would be impressive.

## Documentation

- **A change to behaviour someone depends on updates the docs in the same
  change.** Documentation corrected later is documentation that was wrong in
  between, and the reader who was misled has already gone.
- The README says what this is and how to run it. If a new step is needed to
  build or start the project, it goes there.
- **Write down the decision, not just the result.** `dev-notes/decisions.md` is
  where a choice and its reason live, so the next person does not re-litigate it
  or quietly reverse it.

---

## Where these came from

Part 1 is not invented here. It is the overlap between a few sources that have
already survived contact with large codebases, kept only where the rule is
checkable:

- **Google's engineering practices**, *What to look for in a code review* -
  design, functionality, complexity, tests, naming, comments, style,
  consistency, documentation. The framing that over-engineering and premature
  generality are defects rather than foresight comes from there, as does "will
  the tests actually fail when the code is broken?"
- **OWASP Top 10:2025** - the Security, Dependencies, Errors and Logging
  sections map onto named categories, marked in place above.
- This project's own `dev-notes/` - rules earned by something actually breaking
  are the ones worth keeping.

**Check the current edition rather than recalling one.** OWASP renumbered in
2025 and added two categories; an agent working from memory audits against the
2021 list and never looks for either. The same failure as pinning a dependency
to a remembered version instead of the one the project named.
