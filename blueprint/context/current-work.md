# Fix: write control characters as escapes, so git can diff the link allowlist (F-115)

**Type:** Fix
**Status:** in progress

## Goal
`app/features/blocks/inline-runs.ts` and `app/features/media/media-input.test.ts`
hold raw control bytes: NUL and DEL in a regex, NUL in two test strings. So git
treats both files as binary, and `grep` skips them. `inline-runs.ts` holds
`isSafeHref`, the allowlist that keeps `javascript:` links off the public site,
and since item 2b (`12ff5e1`) no pull request has shown a line of it. Rewriting
those characters as escapes makes both files ordinary text again. Behaviour does
not change.

## In scope
- `inline-runs.ts:41`: the strip regex's character class, written as
  `[\u0000- \u007f]` instead of literal bytes.
- `media-input.test.ts:43,45`: the two literal NULs, written as `\u0000`.
- One new unit test that pins which characters the strip removes. The existing
  tests only reach it through a decoded `&#x09;` and a leading space, so nothing
  would catch the rewrite accidentally narrowing the class.

## Out of scope
- A check that stops raw control characters from coming back (a lint rule, a
  source-scanning test, `.gitattributes`). See *Notes* - it is a separate
  decision, not part of this repair.
- Any other change to `isSafeHref`'s rules, or to the other open findings in
  these files.

## Build steps
- [x] **Step 1 - Escape the allowlist's regex and pin its character class** -
  in `inline-runs.ts`, replace the literal bytes in the strip regex with
  `/[\u0000- \u007f]/g`. Keep the `biome-ignore
  lint/suspicious/noControlCharactersInRegex` line, because Biome also flags
  escaped control characters. Remove it only if `npm run lint` reports it as
  unused. In `inline-runs.test.ts`, add one test that calls `isSafeHref`
  directly with `/<c>/evil.example` for each edge of the class: `<c>` =
  `U+0001`, `U+001F`, `U+0020`, `U+007F`. Each must be refused, because
  stripping `<c>` leaves `//evil.example`. Use this shape, not a disguised
  `javascript:`: the scheme regex refuses `java\u007fscript:` whether or not
  the character is stripped, so that case cannot fail. Also assert that
  `\u0001#top` is accepted (stripped, it is a fragment link). *Done when:*
  `LC_ALL=C grep -caP '[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]' app/features/blocks/inline-runs.ts`
  prints `0`; `git diff --no-index --numstat /dev/null <file>` counts it as
  text lines (corrected while building: a diff *against* the committed binary
  version stays binary, so plain `git diff --numstat` shows line counts only
  from the commit after this one); the new test was
  **seen to fail** with `\u007f` temporarily dropped from the class, then passes
  with it restored; `npm test` passes.
- [ ] **Step 2 - Escape the test strings' NULs** - in `media-input.test.ts`,
  lines 43 and 45 become `"a\u0000b"` and `"a\u0000b.jpg"`. *Done when:* the
  same `grep -caP` prints `0` for that file; `git diff --no-index --numstat
  /dev/null <file>` counts it as text (same correction as Step 1);
  `npm run verify` exits 0; and a byte scan of every tracked
  text file (the `git ls-files` loop review used) finds no raw control
  characters anywhere.

## Files and areas
- `app/features/blocks/inline-runs.ts` (one line)
- `app/features/blocks/inline-runs.test.ts` (one new test)
- `app/features/media/media-input.test.ts` (two lines)

## Data and contracts
None. `isSafeHref` accepts and refuses exactly what it did before, and nothing
stored changes.

## Testing
- Unit, via `npm test` (inside `verify`, so CI runs it too; no database
  needed). The Step 1 test is the regression guard for the rewrite. It passes
  before and after, so the evidence that it can fail comes from narrowing the
  class on purpose, not from the old code. **Only a `/<c>/` or `<c>#` input
  shows whether `<c>` was stripped.** Any character left unstripped inside a
  scheme is already refused by the scheme regex, so a disguised `javascript:`
  passes whether the class is right or wrong.
- Browser tests are unaffected. Running `npm run test:e2e` is not required: no
  rendered path changes.

## Decisions
- **Control characters in source are written as escapes, never as raw bytes.**
  A raw one makes git treat the whole file as binary, which hides every later
  change from diff review. That beat keeping the literal and adding a
  `.gitattributes` `diff` override, which fixes git's view but not `grep`, other
  tools, or the next file that does the same. `ship` records this. It is also
  worth one line in `coding-standards.md`, which is the owner's file to change.

## Production needs
None. It is a source-only change with no behaviour difference, and it can
deploy with the next release.

## Notes
- **This has happened twice** (item 2b, then 5a's test), both times an agent
  writing the literal character. This spec only repairs it. A guard that stops a
  third time would be one of these, and you choose whether to add it as its own
  small fix:
  - a unit test that scans `app/`, `db/`, `server/`, `scripts/` and `e2e/` for
    C0/DEL bytes other than tab, LF and CR
  - lifting the `biome-ignore` rule project-wide in `biome.json`, which cannot
    tell raw from escaped and so does not help here
- The Biome suppression stays justified after the change. The rule's own docs
  say it flags `\u0000`-`\u001F` escapes as well as literals, and this regex
  matches control characters on purpose.
- When `build` sees the Step 1 test fail with the class narrowed, it can close
  F-115 itself (a P2 repair with a test seen failing, per the ledger rules).
  Otherwise it marks it `fixed` for `review`.
