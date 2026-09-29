# Fix: write control characters as escapes, so git can diff the link allowlist (F-115)

**Type:** Fix
**Status:** built

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
- [x] **Step 2 - Escape the test strings' NULs** - in `media-input.test.ts`,
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

## Findings

### escape-control-characters/F-48 [P2] closed - The three inline toolbar buttons have no perceivable focus indicator, and the spec asked for one
File: app/features/content/entry-form.module.css:192

**File:** app/features/content/post-form.module.css:135-136
**Found:** 2026-09-21 by review (independent `reviewer` agent; scope: current; lens: accessibility)
**Why it matters:** Editor.js 2.31.6's only focus affordance on a popover item is a background swap (`.ce-popover-item--focused{background:var(--color-background-item-focus)}` - there is no `outline` rule for `.ce-inline-tool` or `.ce-popover-item` anywhere in the bundle). This item maps that variable to `--color-surface-hover`, and maps `--color-background-item-hover` to **the same value** on the line above. Computed from the project's own tokens (`app/app.css:13-15`): `--color-surface-hover` on `--color-surface` is **1.11:1 light** (`#f1f3f6` on `#ffffff`) and **1.09:1 dark** (`#1e232a` on `#171b20`). So a keyboard user tabbing through Bold / Italic / Link - controls this item introduces - gets an indicator at ~1.1:1, indistinguishable from hover. The spec's own *Design reference* required the opposite: "the toolbar, **its buttons** and the link input must meet the measured contrast … and show the 2px accent focus outline". Only `.ce-inline-tool-input` got the outline (`:171-174`); step 5's evidence measures the icon and its **hover**, never focus, so the record does not support the requirement it was written against. **WCAG 2.2 level AA, 2.4.7 Focus Visible** - the project's recorded bar (`design.md`). Editor.js's own default was also near-invisible, so it is not a regression - but 2b is what made these controls keyboard-reachable. **Computed from the tokens and the bundle's CSS, not rendered.**
**Suggested fix:** Add the outline the spec already specified, beside the existing input rule: `.canvas :global(.ce-popover-item--focused) { outline: 2px solid var(--color-focus); outline-offset: -2px; }`, then measure it in the browser. If it is to be deferred instead, say so on the `needs-you.md` manual-pass line rather than leaving `design.md` implying the bar is met.

**Resolution:** Repaired 2026-09-21 by build. One rule in `post-form.module.css` - `.canvas :global(.ce-popover-item--focused)`, 2px solid `--color-focus`, inset. **The browser corrected the fix:** the buttons never take DOM focus (`document.activeElement` stays on the paragraph while Editor.js moves a `--focused` class along the items, placing it on the `.ce-inline-tool` button for Italic and Link and on the `.ce-popover-item` button for Bold), so the `:focus-visible` companion selector written first was dead and was removed. Measured in Chromium against the production build, tabbing through all three: each `2px solid`, outline against the toolbar surface **6.45:1 light / 7.76:1 dark**, against a 3:1 bar. Focus and hover are now distinguishable - hovering Bold while Link is focused gives the hovered one `3px none` and the focused one `2px solid`. Screenshots: `blueprint/reference/2b-inline-toolbar/toolbar-focus-{light,dark}.png`. `design.md` records the ring and its numbers. **The rule is guarded by a browser test** - the focused item has a 2px solid outline, a hovered unfocused one has none - **shown to fail** with the rule deleted; `npm run test:e2e` -> 31 passed. Status `fixed`.

**Closed 2026-09-29 by review (scope: full; all lenses).** The rule is at `app/features/content/entry-form.module.css:192` (the file was renamed from `post-form.module.css`), and its guard `e2e/inline-formatting.spec.ts:201-203` passed in this pass: `npm run test:e2e` -> 99 passed.

### escape-control-characters/F-22 [P2] closed - The app now believes any client's `X-Forwarded-Host` and `X-Forwarded-Proto`
File: server/app.ts:17 (`{ trustProxy: true }`)

**File:** server/app.ts:17 (`{ trustProxy: true }`)
**Found:** 2026-09-16 by review (scope: current; lens: security)
**Why it matters:** `trustProxy` makes `request.url` come from `X-Forwarded-Proto` and `X-Forwarded-Host` whenever they are present, with no check on who sent them. In production that is safe only while **Caddy overwrites both on every request** and nothing but Caddy can reach the app - the second half is verified (127.0.0.1, ports dropped in both firewalls), **the first half is not**. If Caddy passes a client-supplied `X-Forwarded-Host` through, a visitor controls both sides of React Router's own CSRF comparison (`node_modules/react-router/dist/production/lib/actions.js:25` compares the `Origin` header to `request.url`), disabling that layer. **Impact is contained, which is why this is P2 and not higher:** this project's own check (`app/root.tsx:22`) compares `Origin` against `APP_URL` from the environment, which a header cannot change, and nothing builds an absolute URL from the request host - the three readers of `request.url` (`login.tsx:83`, `require-user.server.ts:36`, `root.tsx:28`) take only a path, and `safeRedirect` allows `/admin` paths only. So the practical loss is one of two CSRF layers, not an open redirect or a poisoned link. Also note the option is on in **development and the browser tests** too, where the app is reachable directly - there a local process can forge its own client address and evade the login rate limit. OWASP Top 10:2025 A05 Security Misconfiguration.
**Suggested fix:** After the fix deploys, check what Caddy actually forwards: `curl -sS -o /dev/null -H 'X-Forwarded-Host: evil.example' -H 'X-Forwarded-Proto: http' https://cms.surenmaharjan.fyi/admin/login` and confirm from the app's behaviour and journal that it still treats the request as `https://cms.surenmaharjan.fyi`. If Caddy does pass client values through, the smallest fix is `header_up X-Forwarded-Host {host}` and `header_up X-Forwarded-Proto {scheme}` in `deploy/caddy/habre-cms.caddy`. A test asserting a forged `X-Forwarded-Host` cannot change the origin the server believes in belongs with whichever change closes this.
**Production evidence, 2026-09-16 by deploy (release `52c2670`), against `https://cms.surenmaharjan.fyi`:** a POST carrying `X-Forwarded-Host: evil.example` with a matching `Origin: https://evil.example` was refused with the 11-byte "Bad Request" and a CSRF abort in the journal - so Caddy replaced the forged host and the app still read its origin as `cms.surenmaharjan.fyi`. A POST carrying `X-Forwarded-Proto: http` with the genuine https `Origin` reached the action normally, so Caddy overwrote that header too. **Caddy's `reverse_proxy` does not pass client-supplied `X-Forwarded-Host` or `X-Forwarded-Proto` through**, which was the unverified half. **What remains true:** the option is still on in development and the browser tests, where the app is reachable directly and a local process can forge its own client address to evade the login rate limit - a local-only concern on a single-user dev machine. Left `unverified` for `review` to judge: the production risk is disproven, and only `review` sets `invalid`.
**Resolution:** fixed by build, 2026-09-28, on `fix/security-hardening` (step 6). Both `reverse_proxy` blocks in `deploy/caddy/habre-cms.caddy` now set `header_up X-Forwarded-Host {host}` and `header_up X-Forwarded-Proto {scheme}`. The app's origin therefore comes from the real request whatever the main Caddyfile's `trusted_proxies` says; that file is not this repo's (D17). Not validated locally, because `caddy` is not installed on the dev machine. Before the reload, `deploy` must run `caddy validate`, then rerun this entry's two forged-header curl probes against production. The development and browser-test residue (`trustProxy` on where the app is directly reachable) is unchanged and out of scope; `review` judges whether this entry closes with it.
**Re-examined by review, 2026-09-28; stays `fixed`.** The `header_up X-Forwarded-Host {host}` / `X-Forwarded-Proto {scheme}` pins in both site blocks are the right, smallest repair. But nothing has parsed this file: `caddy` is not installed locally, and it is not deployed. Close once `deploy` records `caddy validate` passing and the two forged-header probes on production. The dev/test `trustProxy` residue is unchanged and was scoped out by the spec.
**Production evidence, 2026-09-28 by deploy (release `8d6afba`):** the pinned site file is installed at `/etc/caddy/sites/habre-cms.caddy`, and `caddy validate` passed before the reload. After the reload, against `https://cms.surenmaharjan.fyi/admin/login`: a POST with a forged `X-Forwarded-Host: evil.example` and a matching `Origin: https://evil.example` got a 400 with the 11-byte "Bad Request" and a CSRF abort ("`request.url` origin does not match `origin` header") in the journal. A POST with a forged `X-Forwarded-Proto: http` and the genuine `Origin` reached the login action normally. Stays `fixed`; a later `review` closes it.

**Closed 2026-09-29 by review (scope: full; all lenses).** The two `header_up` pins are in both site blocks (`deploy/caddy/habre-cms.caddy`), and the 2026-09-28 production probes above show forged `X-Forwarded-Host`/`-Proto` no longer change the origin the app believes. The development/test `trustProxy` residue is a local-only concern and was scoped out; it is not tracked further.

### escape-control-characters/F-49 [P3] closed - F-47 closed U+0000 but not its class: a lone surrogate still answers 500
File: app/features/blocks/inline-runs.ts:43-46 (`runSchema.text`), reached from app/features/content/entries.server.ts:103 (`sql.json`); same hole on `blockId` (app/features/blocks/blocks.ts:16)

**File:** app/features/blocks/inline-runs.ts:43-46 (`runSchema.text`), reached from app/features/content/entries.server.ts:103 (`sql.json`); same hole on `blockId` (app/features/blocks/blocks.ts:16)
**Found:** 2026-09-21 by review (independent `reviewer` agent; scope: current; lens: security)
**Why it matters:** Measured against this build: `parseInlineHtml("a\uD800b")` returns `ok: true` with the surrogate intact, `runsSchema.safeParse([{text:"a\uD800b"}])` succeeds, `JSON.stringify` emits `"a\ud800b"` (well-formed stringify escapes rather than drops it), and the development database refuses that jsonb: `ERROR: invalid input syntax for type json / DETAIL: Unicode low surrogate must follow a high surrogate.` So an authenticated crafted save - the same reachability F-47 was filed for - still throws out of `createDraft`/`updateDraft` and answers 500 through the error boundary, losing what is in the editor. The **title is not affected**: Node encodes a lone surrogate to U+FFFD on its way to a `text` parameter. P3 for the same reasons F-47 was: only an authenticated user reaches the action and the editor cannot produce the character. OWASP Top 10:2025 A10, Mishandling of Exceptional Conditions.
**Suggested fix:** Widen the two existing U+0000 guards to "characters jsonb cannot hold" - one predicate (`text === text.toWellFormed()`, Node 20+, which covers U+0000 separately) shared by `runSchema.text` and `blockId`, with the same message. Extend the existing NUL unit test rather than adding a file.

**Resolution:** Repaired 2026-09-21 by build. `inline-runs.ts` exports `isStorableText` (`!text.includes("\u0000") && text.isWellFormed()`), used by `runSchema.text`, `isSafeHref` and `blocks.ts`'s `blockId` - the three values that reach the same `jsonb` column; U+0000 keeps its own check because it is well-formed. The parser is deliberately unchanged: it strips U+0000 as before and lets the schema refuse a lone surrogate, because `toWellFormed()` would silently rewrite a writer's text to U+FFFD, against D27. Evidence: `fromEditorJs` with a lone surrogate now returns `Block 1 could not be saved: a character that cannot be stored.` instead of reaching the insert; two unit tests (text, href, a real emoji pair still accepted, and a crafted block id) **shown to fail** with the well-formed half dropped, file restored byte-identical. `npm run verify` -> exit 0, 140 tests. Status `fixed`.

**Closed 2026-09-29 by review (scope: full; all lenses).** `isStorableText` (`inline-runs.ts:27-29`) still refuses U+0000 and lone surrogates, guarded by `inline-runs.test.ts:177`; `npm test` -> 235 passed.

### escape-control-characters/F-53 [P3] closed - `design.md` asserts a boundary contrast that was never measured
File: blueprint/context/design.md, *Inline formatting*

**File:** blueprint/context/design.md, *Inline formatting*
**Found:** 2026-09-21 by review (independent `reviewer` agent; scope: current; lens: accessibility)
**Why it matters:** The line reads "The toolbar's background differs from the page by only 1.07:1 - its border and icons identify it." The 1.07 checks out. The border does not: `--color-border` against the toolbar's own surface is **1.29:1 light** (`#dfe3e8` on `#ffffff`) and **1.30:1 dark** (`#2a3038` on `#171b20`), computed from the tokens. Of the two things the record says identify the toolbar, only the icons (14-16:1, measured in step 5) do. Probably still conformant - WCAG 2.2 1.4.11 asks 3:1 of what is *required* to identify a component, and the icons carry that - but an unmeasured claim in a record `preflight` reads is the thing this ledger exists to catch.
**Suggested fix:** Reword to "its icons identify it; the border is decorative at 1.3:1", or raise the popover border to `--color-border-control` (3.32:1 light / 3.70:1 dark against the surface, already used by the link field).

**Resolution:** Repaired 2026-09-21 by build. `design.md` *Inline formatting* now says the border is decorative at 1.29 / 1.30 against the toolbar's own background and that the icons identify it at 16.75 / 14.07 - every number in the sentence measured. Reworded rather than raising the border to `--color-border-control` (3.32 / 3.70, which would also pass): the icons already carry WCAG 2.2 1.4.11, so the honest record is the cheaper fix. Status `fixed`.

**Closed 2026-09-29 by review (scope: full; all lenses).** `design.md:256` records the 1.29 / 1.30 border as decorative, with the icons carrying 1.4.11.

### escape-control-characters/F-41 [P3] closed - `flattenListItems` recurses without a depth bound, so a crafted body answers 500
File: app/features/blocks/blocks.ts:88-101, called at :141

**File:** app/features/blocks/blocks.ts:88-101, called at :141
**Found:** 2026-09-16 by review (independent `reviewer` agent; scope: current; lens: security)
**Why it matters:** The recursion added by the F-32 repair has no depth limit, and the call sits outside any `try` - `post-form-input.ts:35` wraps only `JSON.parse`. Measured directly against the module: depth 1,000 (36 KB) is refused cleanly by Zod, depth 5,000 (180 KB) and depth 20,000 (720 KB) both throw `RangeError: Maximum call stack size exceeded`, which becomes a 500 through the error boundary. All are inside the 1 MB body cap, so the cap does not contain it. Small - only an authenticated user can reach the action and the editor cannot produce such a body with `maxLevel: 1` - but it is **new, introduced by a repair**, which is why it is recorded rather than waved through. OWASP Top 10:2025 A10.
**Suggested fix:** Bound it - `function flattenListItems(items, depth = 0)` returning `[]` past depth 8. The format holds one level of nesting anyway.
**Resolution:** Repaired 2026-09-16 by build: `flattenListItems` takes a depth and returns `[]` past 8 levels, deeper than any list a person writes and shallow enough that a crafted body cannot exhaust the stack. Evidence: a unit test builds 5,000 levels of nesting and asserts the mapper returns a result instead of throwing - **shown to fail** (`RangeError`) with the bound removed. Status `fixed`.
**Extended 2026-09-16 after the third review pass: the depth bound was right and three other shapes were still unguarded**, measured against the module - a 150,000-item child exhausted the stack through `flat.push(...flattenListItems(...))` (600 KB body, inside the 1 MB cap, depth bound blind to it because the nesting is one level); `items: [null]` threw a `TypeError` from an **82-byte** body, because `typeof null === "object"` passed the string check and `.content` was read off it; and a non-array `items` was iterated as a string and stored as that many single-character list items. Repaired together: the spread became a push loop, `null` and non-objects are skipped by name, the argument is `Array.isArray`-checked at every level, and a 500-item cap bounds the work. Unit tests cover the null and non-array cases and were **shown to fail** without their guards (19/1 each); the wide case passes with or without the item cap, because the push loop is what removes the throw - the cap bounds work rather than correctness, and the code comment says so rather than implying a test covers it. Status `fixed`.
**Closed 2026-09-16 by review (independent `reviewer` agent, fourth pass)**, which re-ran every hostile shape against this build: deep 5,000 -> ok; wide child 150,000 and wide top-level 250,000 -> refused; `null`/`undefined` items -> refused; non-array `items` -> refused; nine levels of a thousand items -> refused. No throw, no unbounded work, nothing over 4 ms. **The width cap stays, and is now distinguishable by a test:** a list whose items record when their `content` is read shows the mapper stopping at item 500 of 2,000 - it fails when the cap is removed, so the line is no longer untested. A getter that throws and a `Proxy` do escape the guards, and are unreachable: `fromEditorJs` is only ever called with `JSON.parse` output, which can express neither - guarding them would be defensive code for a requirement nobody has. **One optional residual, P3:** a crafted `content` that is an object is still `String()`-ed to `"[object Object]"` and stored; the editor cannot produce it, and one line (`typeof listItem.content === "string"`) would close it.

**Closed 2026-09-29 by review (scope: full; all lenses).** Status heading brought in line with the entry: the fourth-pass close above was never reflected in the backlog heading. `MAX_LIST_DEPTH` and `MAX_LIST_ITEMS` still bound `flattenListItems` (`app/features/blocks/blocks.ts:100-114`); `npm test` -> 235 passed.

### escape-control-characters/F-40 [P3] closed - `updateDraft` does not enforce that the entry is a draft
File: app/features/content/entries.server.ts:89-98

**File:** app/features/content/entries.server.ts:89-98
**Found:** 2026-09-16 by review (independent `reviewer` agent; scope: current; lens: quality)
**Why it matters:** The name promises something the `where` clause does not enforce. Harmless while every entry is a draft; item 4 introduces published rows and will hand them to this function.
**Suggested fix:** Add `and status = 'draft'`, or rename the function to say what it actually does.

**Resolution:** Repaired 2026-09-21 by build (item 4a, step 1). Renamed to `saveEntry`, which now honestly describes what it does: it saves content for any entry, draft or published, and optionally carries a status transition in the same atomic update. No `and status = 'draft'` guard was added - the data rules already say saving a published entry updates the live page, so that constraint would have been wrong, not missing. `npm run verify` -> exit 0, no behavior change to the plain-save path. Status `fixed` for `review` to close.

**Closed 2026-09-29 by review (scope: full; all lenses).** `saveEntry` (`app/features/content/entries.server.ts`) is the only save path, with the status transition in the same atomic update; no `updateDraft` remains.

### escape-control-characters/F-24 [P3] invalid - `@react-router/node` may now be an unused dependency
File: package.json:24

**File:** package.json:24
**Found:** 2026-09-16 by review (scope: current; lens: dependencies)
**Why it matters:** After this change nothing imports it - the only occurrence left in the tree is a comment in `server/app.ts:8`. It may still be required by `@react-router/dev`'s build for the node server target, and it is where the `@remix-run/node-fetch-server` version range comes from, so removing it blindly could break the build or float the transitive version. An unused direct dependency is still code shipped and maintained (`fundamentals.md`, Dependencies).
**Suggested fix:** Its own small change, not this one: remove it, run `npm run verify` and `npm run test:e2e`, and keep it with a comment saying why if the build needs it.

**Resolution:** Invalid as of 2026-09-29, by review (scope: full). It is no longer unused: `app/entry.server.tsx:3` imports `createReadableStreamFromReadable` from it, since `8d6afba` (the CSP nonce needed a custom entry). Nothing to remove.

### escape-control-characters/F-54 [P3] closed - Four bare element selectors in `post-list.module.css` leak out of the CSS Module
File: app/features/content/post-list.module.css:90,96,105,111,115

**File:** app/features/content/post-list.module.css:90,96,105,111,115
**Found:** 2026-09-21 by review (independent `reviewer` agent; scope: current; lens: quality)
**Why it matters:** CSS Modules scope class names, not element selectors. `table`, `th`, `td`, `tr:last-child td` and `tbody tr:hover` are emitted verbatim into the global stylesheet - confirmed in the built chunk (`build/client/assets/post-list-*.css`): `table{border-collapse:collapse;width:100%;…}th{padding:…}td{…}`. Every other CSS Module in the project scopes under its own class; this is the only one that does not. Harmless while one table exists. It bites the moment another admin table renders on a page that still has this chunk loaded (client-side navigation keeps stylesheets around) - item 5's media library or item 8's users list would silently inherit this table's width, padding and border rules.
**Suggested fix:** Prefix all five with `.list` (`.list table`, `.list th`, `.list td`, `.list tr:last-child td`, `.list tbody tr:hover`) - the markup already nests the table inside `.list`.
**Resolution:** Repaired 2026-09-21 by build. All five rules prefixed with `.list`. Evidence: the built chunk now reads `._list_18e61_82 table{…}` etc. for every one of the five - no bare element selector left in the chunk; a screenshot (`repair-f54-list.png`) shows the table rendering identically. `npm run verify` -> exit 0, 148 tests. Status `fixed`.

**Closed 2026-09-29 by review (scope: full; all lenses).** The list styles now live in `app/features/content/entry-list.module.css`; no bare element selector is left at the top level.

### escape-control-characters/F-60 [P3] closed - The list's SQL fragments use unqualified column names inside a JOIN
File: app/features/content/entries.server.ts:46-48 (`ownedBy`), 146-147 (`statusFilter`, `searchFilter`)

**File:** app/features/content/entries.server.ts:46-48 (`ownedBy`), 146-147 (`statusFilter`, `searchFilter`)
**Found:** 2026-09-21 by review (independent `reviewer` agent; scope: current; lens: quality)
**Why it matters:** `ownedBy` emits `and author_id = …`, and the new `statusFilter`/`searchFilter` emit `and status = …` / `and title ilike …` - all unqualified, while `listEntries`'s row and total queries join `entries e` to `users u`. Unambiguous today only because `users` happens to own no `author_id`, `status` or `title` column. A future column on `users` with one of those names (item 8, "deactivate a user", is a plausible source of a `users.status`) turns this into a runtime `column reference "status" is ambiguous` on the posts list - not a compile error, since raw SQL has no static check.
**Suggested fix:** Qualify the three fragments as `e.author_id` / `e.status` / `e.title`, and alias `entries` as `e` in `findEntryForUser` and `updateDraft` too so every caller of `ownedBy` is consistent.
**Resolution:** Repaired 2026-09-21 by build. `ownedBy`, `statusFilter` and `searchFilter` now all qualify to `e.`; every call site (`findEntryForUser`, `updateDraft`, `deleteEntry`, and all three of `listEntries`'s internal queries) aliases `entries` as `e`. **The repair caught its own instance of the bug while landing** - `listEntries`'s tab-count query had no `e` alias and would have thrown `missing FROM-clause entry for table "e"` the moment `ownedBy` required one; found by re-reading every call site, not by the error occurring. Smoke-tested against the dev database: every function (list in three modes, find, update, delete, both cross-author checks) returns identical results to before. `npm run verify` -> exit 0, 148 tests; `npm run test:e2e` -> 39 passed. Status `fixed`.

**Closed 2026-09-29 by review (scope: full; all lenses).** Every `entries` query in `entries.server.ts` that composes `ownedBy`, `statusFilter` or `searchFilter` aliases the table as `e`; `npm run test:e2e` (list, filter and search specs) -> 99 passed.

### escape-control-characters/F-97 [P3] closed - The users list's Active/Deactivated badge is a new status-badge variant `design.md` doesn't record
File: app/features/users/user-list.tsx:60-70; app/features/users/user-list.module.css:76-101; blueprint/context/design.md:116-118

**File:** app/features/users/user-list.tsx:60-70; app/features/users/user-list.module.css:76-101; blueprint/context/design.md:116-118
**Found:** 2026-09-23 by review (scope: current, item 8; lens: accessibility/quality)
**Why it matters:** `design.md`'s *Status badges* line is explicit and closed: "pill with a leading dot; Draft = warning amber, Published = success green. **The only two content statuses**." Item 8's users list adds a third badge pair - Active (reusing the success-green token, measured 5.3:1 light / 8.4:1 dark) and Deactivated (`--color-text-muted` on `--color-surface-sunken`, measured 5.5:1 light / 8.1:1 dark elsewhere in `design.md:60`) - which is not a content status at all, so the recorded claim is now inaccurate the moment this shipped. Both token pairs reused here were already measured and compliant elsewhere in `design.md`, so there is **no WCAG 2.2 AA violation** - this is a documentation-drift finding, not a contrast defect: `fundamentals.md`'s Documentation section ("a change to behaviour someone depends on updates the docs in the same change") and the review skill's own accessibility-lens guidance ("a feature that invents a fourth kind of [pattern] is drift worth reporting even when each version is individually fine"). Item 8 was never run through `prototype`, so there was no mockup to deviate from - the gap is specifically that `design.md`'s existing sentence was not touched when a second badge system was added next to it.
**Suggested fix:** Add one line under *Status badges* noting the users list's Active/Deactivated pair and its token choice - e.g. "The users list adds a second, unrelated pair for account status: Active reuses the same success green, Deactivated is muted (`--color-text-muted` on `--color-surface-sunken`, 5.5:1 / 8.1:1) rather than a warning color, since a deactivated account is an administered state, not a problem." A one-line edit, not a rewrite.
**Resolution:** Repaired 2026-09-23: added the suggested sentence to `design.md`'s *Status badges* line, naming both the Active/Deactivated pair and the exact token pair and contrast numbers already measured elsewhere in the file. No code change - documentation only. Status `fixed` for a later `review` pass to close.

**Closed 2026-09-29 by review (scope: full; all lenses).** `design.md:120` records the Deactivated badge and its token pair.

### escape-control-characters/F-112 [P3] closed - Migration 0006's comment still says null means the latest posts, which D-12 changed
File: db/migrations/0006_site_settings_home_page.sql:1-3

**File:** db/migrations/0006_site_settings_home_page.sql:1-3
**Found:** 2026-09-29 by review (scope: current; lens: quality)
**Why it matters:** The migration is the schema's record of what `home_page_id = null` means. It says "the latest posts", and falling back "to the list". Since D-12, null means the welcome placeholder, and `/` never lists posts. Every other comment was updated in Step 9 (`grep -ri "latest posts" app` finds nothing else). This migration has not reached production yet, and `db/migrate.ts` keeps no checksum, so editing the comment now is free. After deploy it becomes a stale record.
**Suggested fix:** Reword lines 1-3 to say null means no home page chosen, which shows the placeholder (D-12). Do it before this item ships.
**Resolution:**
Repaired by build, 2026-09-29: lines 1-4 now say null means no home page chosen, so `/` shows the placeholder (D-12), and that deleting the page falls back to the placeholder. The change is to a comment only, so there is no test to see fail. It stays `fixed` for `review`. `db/migrate.ts` keeps no checksum, so the already-applied development database is unaffected.

**Closed 2026-09-29 by review (scope: full; all lenses).** `db/migrations/0006_site_settings_home_page.sql:1-4` now says null means no home page chosen and `/` shows the placeholder, which matches D-12 and `findHomePage`.
