# Findings

> **Generated file.** The findings ledger: review findings raised by the `review`
> skill against the work in progress, each with a durable ID, a severity (P0-P3),
> and a status. `build` marks a repaired finding `fixed`; only a later `review`
> pass moves it to `closed`. **A finding no code fixes** - raised by `preflight`
> or `host`, such as missing backups or a leaked secret - is marked `fixed` with
> evidence by whichever skill repairs it, and `preflight` re-checks and closes it.
> `ship` refuses to merge while any P0 or P1 finding
> is `open` or `fixed`, then archives resolved findings with the work item and
> resets this file.

### F-86 [P3] open - `public-site.spec.ts`'s home-page "newest first" test is a second instance of F-78's race, on a different query

**File:** e2e/public-site.spec.ts:23-37 ("the home page lists only published posts, newest first")
**Found:** 2026-09-23 by review (scope: current, item 6b; lens: tests) - reproduced twice while proving item 6b's own tests, not part of this item's diff
**Why it matters:** `listPublishedPosts` (the home page's query) is unscoped by author - by design, every visitor sees every published post - so it reads whatever any concurrently-running spec file has published at that instant. This test asserts the home page's link list is exactly `["Newer Published", "Older Published"]`; under Playwright's default `workers: 2` it failed twice in this pass with a third title present (`"My published post"`, confirmed by grep to come from `manage-posts.spec.ts:34`, a different file running at the same time). Same root cause F-78 already named for `manage-posts.spec.ts`'s "All" tab count - an unscoped query racing against another file's own test data - just a second location it reaches. Not introduced by item 6b: `listPublishedPosts` and this test both predate it (item 4b); item 6b only added its own, correctly-isolated page tests to the same file. Reproduced: `npx playwright test` (full suite) failed it twice across two runs in this pass; `npx playwright test e2e/public-site.spec.ts e2e/manage-posts.spec.ts --workers=1` passed every test in both files.
**Suggested fix:** Same shape F-78 already proposes: assert a lower bound or the delta this test itself created rather than an exact global list, or serialize this test relative to other files' publishing tests. Worth fixing alongside F-78 in one pass rather than separately, since both are the identical pattern.
**Resolution:**

### F-84 [P3] open - `SecurityEvent`'s new `role` field is a bare `string`, though `requireRole` always has the real `Role` type in hand

**File:** app/lib/security-log.server.ts:16; app/features/auth/require-role.server.ts:27
**Found:** 2026-09-22 by review (scope: current, item 6a; lens: quality) - found while re-examining the F-82 repair
**Why it matters:** `requireRole` calls `logSecurityEvent({ ..., role: user.role, ... })` where `user.role` is already typed `Role` (imported in the same file), but the event's own field is declared `role: string`, discarding that. The same observation F-81 made about `bannerRedirect`'s `target` applies here: `fundamentals.md`'s Types section asks for typing the boundary, and this is one call site away from being exact for free.
**Suggested fix:** `import type { Role } from "#app/features/users/roles.ts"` in `security-log.server.ts` and change the new variant's `role: string` to `role: Role`.
**Resolution:**

### F-83 [P3] unverified - Item 6a's pages screens reproduce three pre-existing unverified/open posts accessibility findings

**File:** app/features/content/page-list.tsx:69-98 (filter tabs, search form); app/features/admin-shell/layout.tsx:39-61 (nav)
**Found:** 2026-09-22 by review (scope: current, item 6a; lens: accessibility)
**Why it matters:** `page-list.tsx` was deliberately copied from `post-list.tsx` (item 6a's own Decisions), and the copy carries three patterns already recorded against the posts screen, none of them yet checked against a rendered page: **F-62** - the search input has no visible or accessible submit control, reproduced verbatim in `page-list.tsx`'s search form. **F-63(a)** - the sidebar's `NavLink` (now including the new "Pages" entry) and the active filter tab both carry `aria-current="page"`, so a screen reader gets two "this is current" signals on one screen; the new Pages nav item adds a second location where this now happens. **F-63(b)** - the success banner shown after publish/unpublish/delete on `page-list.tsx` (`<Message tone="success" role="status" .../>` via the shared `Message` component) is populated before the live region exists, the same as the posts list's own banner. None of these are new defects - they are the identical, already-recorded pattern reaching a second screen - but F-62 and F-63 are scoped by file and line to `post-list.tsx` and would not be re-examined against `page-list.tsx` by a future pass that reads those entries literally.
**Suggested fix:** No code change from this finding alone. When F-62/F-63 are addressed for posts, apply the same fix to `page-list.tsx` in the same pass rather than rediscovering it there later - or close this entry alongside them if the two lists are revisited together.
**Resolution:**

### F-79 [P3] unverified - A captioned image's alt text is announced twice in a row by a screen reader

**File:** app/features/blocks/render.tsx:38-52 (the `image` case)
**Found:** 2026-09-22 by review (scope: current, item 5c; lens: accessibility)
**Why it matters:** The image keeps its `alt={media.altText}` and the new `<figcaption>` right after it renders that exact same string visibly. Browsers do not treat `<figcaption>` as an image's accessible name or description - there is no automatic association - so a screen reader announces the alt text once as the image's own accessible name and then again, unchanged, as the next block of text it reads. This is a deliberate, reasoned tradeoff recorded in the spec itself (`current-work.md`'s Decisions, carried into the archived spec at `ship`): a second caption field was rejected because alt text is already one value per file (D55) and the admin editor's own preview already shows the same duplication. **Not a WCAG 2.2 AA violation** - SC 1.1.1 is satisfied by the alt text alone, and there is no success criterion against redundant announcement - so this is a UX rough edge, not a confirmed defect, and P3 rather than higher. **Unverified** because nobody has actually heard it: the project's own open `needs-you.md` line for a screen-reader pass over the public site now covers this case too, and this entry exists so the residual survives in the durable ledger once `ship` resets `current-work.md` - the spec's own Decisions section does not.
**Suggested fix:** None unless the upcoming screen-reader pass finds it genuinely confusing. If it does, the smallest change is emptying the image's `alt=""` and relying on the visible `<figcaption>` alone (a legitimate pattern when a caption already serves as the description) - not adding a second data field.
**Resolution:**

### F-78 [P3] open - `manage-posts.spec.ts`'s "editor sees all posts" count races against every other spec file's own test data under parallel workers

**File:** e2e/manage-posts.spec.ts:29-53 ("the list is scoped by role, and the tabs' counts match")
**Found:** 2026-09-22 by review (scope: current, item 5b; lens: tests) - discovered incidentally while re-running the full suite after F-77's repair, not part of item 5b's own diff
**Why it matters:** Once `author` is promoted to editor, the test asserts an exact system-wide count (`"All3"`) - but an editor's post list is intentionally unscoped by author (plan section 6, Permissions: editors see every post), so the assertion is only true while no other spec file has an entry sitting in the `entries` table at that instant. Reproduced directly: `npx playwright test e2e/manage-posts.spec.ts -g "tabs' counts match"` passes every time in isolation; a full `npx playwright test` run (Playwright's own `workers: 2`) failed it once with `"All4"` - a fourth post, created by a concurrently-running file's own `createDraftFor` call, briefly existed in the same window this test reads the "All" tab. A second full run passed. Not a product bug - `listEntries`'s own unscoped-for-editors behavior is correct and intentional - this is the test's own assumption of exclusive access to the table, which `workers: 2` does not give it.
**Suggested fix:** Either assert a lower bound (`toContainText` a count `>= 3`) instead of an exact one, or give this one test `test.describe.configure({ mode: "serial" })` / move it to its own file if the suite ever adds `test.describe.parallel`. Cheapest fix is probably scoping the assertion to what this test can actually guarantee - the delta it created - rather than the whole table.
**Resolution:**

### F-72 [P2] fixed - Item 4c's env-var rename breaks the proven symlink-only rollback for this specific release

**File:** /etc/systemd/system/habre-cms.service on `ocwebserver`; deploy/habre-cms.service in the repo
**Found:** 2026-09-21 by preflight (milestone audit before deploying items 4a-4c to production)
**Why it matters:** Rollback was proven 2026-09-16 as "repoint the `current` symlink back, restart" - 5 seconds, no other change. That proof assumed the systemd unit's `Environment=` lines stay constant across releases. Item 4c's own code change removes `APP_URL` entirely and requires `PUBLIC_URL`/`ADMIN_URL` instead, and the live unit on `ocwebserver` still reads `Environment=APP_URL=https://cms.surenmaharjan.fyi` (checked directly, 2026-09-21) - so deploying `4165637` requires editing that file too. If this release is later rolled back by symlink alone (matching the proven procedure), the restored release (`0ad8300`, item 3) would start against `PUBLIC_URL`/`ADMIN_URL` and never read the `APP_URL` it actually needs, if the unit file is not *also* rolled back with it - or the reverse, a same-release-only symlink rollback leaving a mismatched unit. The previous three releases never faced this because none of them changed which environment variables the code reads.
**Suggested fix:** Before editing the live unit file for this deploy, copy it aside (e.g. `sudo cp /etc/systemd/system/habre-cms.service /etc/habre-cms/habre-cms.service.pre-4c`) so a rollback to `0ad8300` can restore both the symlink and that exact prior unit file together, not just the symlink. Record this as part of the release note in `dev-notes/status.md` so the next person rolling back knows to check for a paired unit-file change, not just assume the proven symlink-only procedure still applies.
**Resolution:** Repaired 2026-09-21 by deploy, exactly as suggested: before touching the live unit, `sudo cp /etc/systemd/system/habre-cms.service /etc/habre-cms/habre-cms.service.pre-4c` (mode 600), confirmed present before the new unit was installed. Rolling back to `0ad8300` now means restoring both together - `sudo ln -sfn /srv/habre-cms/releases/0ad8300 /srv/habre-cms/current && sudo cp /etc/habre-cms/habre-cms.service.pre-4c /etc/systemd/system/habre-cms.service && sudo systemctl daemon-reload && sudo systemctl restart habre-cms` - recorded in `dev-notes/status.md`'s rollback line for this release. Status `fixed` for `preflight` to re-check and close.

### F-70 [P2] open - Host-routing refusals are silent - no security event is logged for a wrong-host admin attempt or an unrecognized host

**File:** app/root.tsx:23-40 (`routeByHost`)
**Found:** 2026-09-21 by review (scope: current, item 4c; lens: security)
**Why it matters:** `routeByHost` throws a bare 404 for two cases and logs neither: a non-GET/HEAD request to an admin path on the public host, and a request whose host matches neither `PUBLIC_URL` nor `ADMIN_URL`. The second case should be unreachable in production - F-22's evidence confirms only Caddy reaches the app, on 127.0.0.1 with the other ports closed, and Caddy forwards only the two configured hostnames - which is exactly why it is worth logging rather than silently swallowing: if it ever fires, the network assumption behind the whole security model has been violated, and nothing here would tell anyone. Compare `refuseCrossSiteRequests` two lines below, in the same middleware array, which logs every refusal via `logSecurityEvent({ event: "request_refused", reason: "cross_site", ... })` - the new middleware sits right next to that pattern and does not follow it. `fundamentals.md`'s Logging section: "Log the security-relevant events: failed authentication, access denied, and anything that changes permissions... Detection you never wrote is the one gap no later audit can close retroactively." OWASP Top 10:2025 A09, Logging & Alerting Failures. Not exploitable on its own - the request is correctly refused either way - so this is a detection gap, not a bypass.
**Suggested fix:** Call `logSecurityEvent` with a new reason (e.g. `"wrong_host"`) before throwing the 404 in `routeByHost`, mirroring `refuseCrossSiteRequests`'s shape (`method`, `path`, `ip`, plus the host that was actually requested).
**Resolution:**

### F-71 [P3] open - A cookie comment now describes a reality the hostname split already removed

**File:** app/features/auth/session-cookie.server.ts:9-12
**Found:** 2026-09-21 by review (scope: current, item 4c; lens: quality)
**Why it matters:** The comment reads "`path: '/'`... The public site receives it but never reads it." That was accurate when public and admin shared one origin (pre-item-4c): a `/`-scoped cookie on a single host really did reach every public path too. Once `PUBLIC_URL` and `ADMIN_URL` are genuinely different hosts (production, and the two-hostname test server added in this item), the session cookie is host-only with no `Domain` attribute, so it is never sent to the public site's origin at all - "receives it but never reads it" describes a risk that no longer exists there, replaced by a stronger guarantee the comment doesn't mention. `fundamentals.md`, Comments: "A comment that has drifted from the code is worse than none, because it is believed" - a future reader could take this line to mean the public site is still in the cookie's blast radius and needs care it no longer needs. Still true today only because development runs `PUBLIC_URL === ADMIN_URL`.
**Suggested fix:** Reword to note the split: e.g. "In development, where `PUBLIC_URL === ADMIN_URL`, the public paths on that one host receive it too but never read it; once the hostnames differ (production), the cookie is host-only and never reaches the public site at all."
**Resolution:**

### F-48 [P2] fixed - The three inline toolbar buttons have no perceivable focus indicator, and the spec asked for one

**File:** app/features/content/post-form.module.css:135-136
**Found:** 2026-09-21 by review (independent `reviewer` agent; scope: current; lens: accessibility)
**Why it matters:** Editor.js 2.31.6's only focus affordance on a popover item is a background swap (`.ce-popover-item--focused{background:var(--color-background-item-focus)}` - there is no `outline` rule for `.ce-inline-tool` or `.ce-popover-item` anywhere in the bundle). This item maps that variable to `--color-surface-hover`, and maps `--color-background-item-hover` to **the same value** on the line above. Computed from the project's own tokens (`app/app.css:13-15`): `--color-surface-hover` on `--color-surface` is **1.11:1 light** (`#f1f3f6` on `#ffffff`) and **1.09:1 dark** (`#1e232a` on `#171b20`). So a keyboard user tabbing through Bold / Italic / Link - controls this item introduces - gets an indicator at ~1.1:1, indistinguishable from hover. The spec's own *Design reference* required the opposite: "the toolbar, **its buttons** and the link input must meet the measured contrast … and show the 2px accent focus outline". Only `.ce-inline-tool-input` got the outline (`:171-174`); step 5's evidence measures the icon and its **hover**, never focus, so the record does not support the requirement it was written against. **WCAG 2.2 level AA, 2.4.7 Focus Visible** - the project's recorded bar (`design.md`). Editor.js's own default was also near-invisible, so it is not a regression - but 2b is what made these controls keyboard-reachable. **Computed from the tokens and the bundle's CSS, not rendered.**
**Suggested fix:** Add the outline the spec already specified, beside the existing input rule: `.canvas :global(.ce-popover-item--focused) { outline: 2px solid var(--color-focus); outline-offset: -2px; }`, then measure it in the browser. If it is to be deferred instead, say so on the `needs-you.md` manual-pass line rather than leaving `design.md` implying the bar is met.

**Resolution:** Repaired 2026-09-21 by build. One rule in `post-form.module.css` - `.canvas :global(.ce-popover-item--focused)`, 2px solid `--color-focus`, inset. **The browser corrected the fix:** the buttons never take DOM focus (`document.activeElement` stays on the paragraph while Editor.js moves a `--focused` class along the items, placing it on the `.ce-inline-tool` button for Italic and Link and on the `.ce-popover-item` button for Bold), so the `:focus-visible` companion selector written first was dead and was removed. Measured in Chromium against the production build, tabbing through all three: each `2px solid`, outline against the toolbar surface **6.45:1 light / 7.76:1 dark**, against a 3:1 bar. Focus and hover are now distinguishable - hovering Bold while Link is focused gives the hovered one `3px none` and the focused one `2px solid`. Screenshots: `blueprint/reference/2b-inline-toolbar/toolbar-focus-{light,dark}.png`. `design.md` records the ring and its numbers. **The rule is guarded by a browser test** - the focused item has a 2px solid outline, a hovered unfocused one has none - **shown to fail** with the rule deleted; `npm run test:e2e` -> 31 passed. Status `fixed`.

### F-49 [P3] fixed - F-47 closed U+0000 but not its class: a lone surrogate still answers 500

**File:** app/features/blocks/inline-runs.ts:43-46 (`runSchema.text`), reached from app/features/content/entries.server.ts:103 (`sql.json`); same hole on `blockId` (app/features/blocks/blocks.ts:16)
**Found:** 2026-09-21 by review (independent `reviewer` agent; scope: current; lens: security)
**Why it matters:** Measured against this build: `parseInlineHtml("a\uD800b")` returns `ok: true` with the surrogate intact, `runsSchema.safeParse([{text:"a\uD800b"}])` succeeds, `JSON.stringify` emits `"a\ud800b"` (well-formed stringify escapes rather than drops it), and the development database refuses that jsonb: `ERROR: invalid input syntax for type json / DETAIL: Unicode low surrogate must follow a high surrogate.` So an authenticated crafted save - the same reachability F-47 was filed for - still throws out of `createDraft`/`updateDraft` and answers 500 through the error boundary, losing what is in the editor. The **title is not affected**: Node encodes a lone surrogate to U+FFFD on its way to a `text` parameter. P3 for the same reasons F-47 was: only an authenticated user reaches the action and the editor cannot produce the character. OWASP Top 10:2025 A10, Mishandling of Exceptional Conditions.
**Suggested fix:** Widen the two existing U+0000 guards to "characters jsonb cannot hold" - one predicate (`text === text.toWellFormed()`, Node 20+, which covers U+0000 separately) shared by `runSchema.text` and `blockId`, with the same message. Extend the existing NUL unit test rather than adding a file.

**Resolution:** Repaired 2026-09-21 by build. `inline-runs.ts` exports `isStorableText` (`!text.includes("\u0000") && text.isWellFormed()`), used by `runSchema.text`, `isSafeHref` and `blocks.ts`'s `blockId` - the three values that reach the same `jsonb` column; U+0000 keeps its own check because it is well-formed. The parser is deliberately unchanged: it strips U+0000 as before and lets the schema refuse a lone surrogate, because `toWellFormed()` would silently rewrite a writer's text to U+FFFD, against D27. Evidence: `fromEditorJs` with a lone surrogate now returns `Block 1 could not be saved: a character that cannot be stored.` instead of reaching the insert; two unit tests (text, href, a real emoji pair still accepted, and a crafted block id) **shown to fail** with the well-formed half dropped, file restored byte-identical. `npm run verify` -> exit 0, 140 tests. Status `fixed`.

### F-50 [P3] open - The stored shape is less canonical than the contract says it is

**File:** app/features/blocks/inline-runs.ts:56-71 (`runsSchema`); blueprint/context/current-work.md *Data and contracts* and step 1
**Found:** 2026-09-21 by review (independent `reviewer` agent; scope: current; lens: quality)
**Why it matters:** Step 1 says "`runsSchema` applies … the canonical-form rules … so a payload that skips the parser cannot store what the parser would refuse", and *Data and contracts* is labelled load-bearing for item 4, item 5 and the page builder. The schema enforces three of the four rules - non-empty, no identical neighbours, marks only when true - but **not whitespace collapsing**, which the parser does enforce: `runsSchema.safeParse([{text:"  a  b  "}])` succeeds (measured), and the parser can never produce it. Consequence: a run stored as `[{text:" leading"}]` opens in the editor and a save with no edit stores `[{text:"leading"}]` - content changed by a save the writer did not make - and the deep-equality the browser test relies on (`e2e/inline-formatting.spec.ts:89`) holds only for parser-produced seeds. Two stored shapes for one text is what the flat-runs decision was chosen to avoid.
**Suggested fix:** Either add a `superRefine` refusing `text !== text.replace(/\s+/g, " ")` plus a leading space on the first run and a trailing one on the last; or delete the over-claim from step 1 and *Data and contracts* and say canonical form is the parser's guarantee only. Pick one before item 4 reads whichever the record says.

### F-51 [P3] open - An empty list block refuses the whole save, with a raw Zod message

**File:** app/features/blocks/blocks.ts:38 (`items: z.array(runsSchema).min(1)`), with the empty item dropped at :166
**Found:** 2026-09-21 by review (independent `reviewer` agent; scope: current; lens: correctness)
**Why it matters:** A writer adds a List block, types nothing and clicks Save draft. `@editorjs/list` defines no `validate()` and Editor.js's `Block.validate` defaults to true, so the empty block **is** submitted as `items: [{content: ""}]`. Measured against this build: `fromEditorJs` returns `{"ok":false,"message":"Block 1 could not be saved: Too small: expected array to have >=1 items."}` - the whole post is refused and the writer is shown a Zod sentence that says nothing they can act on, against `design.md` *Words* and `fundamentals.md` (an error says what happened and what to do). **Pre-existing:** v1 had the identical `.min(1)` and the identical drop, so 2b did not cause it - but 2b rewrote this exact path, so it is recorded here rather than rediscovered at item 3.
**Suggested fix:** Drop an all-empty list block instead of refusing the save (`if (items.length === 0) continue;` before the block is pushed), matching how Editor.js drops empty paragraphs. One unit test: a list whose only item is `""` produces no list block.

### F-52 [P3] unverified - F-43's "native Ctrl+B does nothing" rests on one manual observation, and the mechanism argues against it

**File:** app/features/blocks/editor.client.tsx:52-58; e2e/inline-formatting.spec.ts:115-140
**Found:** 2026-09-21 by review (independent `reviewer` agent; scope: current; lens: tests)
**Why it matters:** Editor.js binds inline-tool shortcuts per tool - `CMD+B` is a getter on the Bold tool class, registered only when Bold is among that block's inline tools. Removing Bold from `header` therefore also unregisters Ctrl+B there, so Ctrl+B in a heading falls through to Chromium's native contenteditable `execCommand("bold")` - exactly what F-43 measured producing `<span style="font-weight: normal">`. F-43's evidence records that it "changes nothing", observed once by hand; nothing tests it, so the claim decays the moment the browser changes. **Unverified:** read from the bundle's source, not re-driven in a browser by this pass.
**Suggested fix:** Two lines in the existing heading test - after the Ctrl+I assertions, press `Control+b`, save, and assert the stored runs are unchanged. The block, the login and the `save()` helper are already there.

### F-53 [P3] fixed - `design.md` asserts a boundary contrast that was never measured

**File:** blueprint/context/design.md, *Inline formatting*
**Found:** 2026-09-21 by review (independent `reviewer` agent; scope: current; lens: accessibility)
**Why it matters:** The line reads "The toolbar's background differs from the page by only 1.07:1 - its border and icons identify it." The 1.07 checks out. The border does not: `--color-border` against the toolbar's own surface is **1.29:1 light** (`#dfe3e8` on `#ffffff`) and **1.30:1 dark** (`#2a3038` on `#171b20`), computed from the tokens. Of the two things the record says identify the toolbar, only the icons (14-16:1, measured in step 5) do. Probably still conformant - WCAG 2.2 1.4.11 asks 3:1 of what is *required* to identify a component, and the icons carry that - but an unmeasured claim in a record `preflight` reads is the thing this ledger exists to catch.
**Suggested fix:** Reword to "its icons identify it; the border is decorative at 1.3:1", or raise the popover border to `--color-border-control` (3.32:1 light / 3.70:1 dark against the surface, already used by the link field).

**Resolution:** Repaired 2026-09-21 by build. `design.md` *Inline formatting* now says the border is decorative at 1.29 / 1.30 against the toolbar's own background and that the icons identify it at 16.75 / 14.07 - every number in the sentence measured. Reworded rather than raising the border to `--color-border-control` (3.32 / 3.70, which would also pass): the icons already carry WCAG 2.2 1.4.11, so the honest record is the cheaper fix. Status `fixed`.

### F-41 [P3] fixed - `flattenListItems` recurses without a depth bound, so a crafted body answers 500

**File:** app/features/blocks/blocks.ts:88-101, called at :141
**Found:** 2026-09-16 by review (independent `reviewer` agent; scope: current; lens: security)
**Why it matters:** The recursion added by the F-32 repair has no depth limit, and the call sits outside any `try` - `post-form-input.ts:35` wraps only `JSON.parse`. Measured directly against the module: depth 1,000 (36 KB) is refused cleanly by Zod, depth 5,000 (180 KB) and depth 20,000 (720 KB) both throw `RangeError: Maximum call stack size exceeded`, which becomes a 500 through the error boundary. All are inside the 1 MB body cap, so the cap does not contain it. Small - only an authenticated user can reach the action and the editor cannot produce such a body with `maxLevel: 1` - but it is **new, introduced by a repair**, which is why it is recorded rather than waved through. OWASP Top 10:2025 A10.
**Suggested fix:** Bound it - `function flattenListItems(items, depth = 0)` returning `[]` past depth 8. The format holds one level of nesting anyway.
**Resolution:** Repaired 2026-09-16 by build: `flattenListItems` takes a depth and returns `[]` past 8 levels, deeper than any list a person writes and shallow enough that a crafted body cannot exhaust the stack. Evidence: a unit test builds 5,000 levels of nesting and asserts the mapper returns a result instead of throwing - **shown to fail** (`RangeError`) with the bound removed. Status `fixed`.
**Extended 2026-09-16 after the third review pass: the depth bound was right and three other shapes were still unguarded**, measured against the module - a 150,000-item child exhausted the stack through `flat.push(...flattenListItems(...))` (600 KB body, inside the 1 MB cap, depth bound blind to it because the nesting is one level); `items: [null]` threw a `TypeError` from an **82-byte** body, because `typeof null === "object"` passed the string check and `.content` was read off it; and a non-array `items` was iterated as a string and stored as that many single-character list items. Repaired together: the spread became a push loop, `null` and non-objects are skipped by name, the argument is `Array.isArray`-checked at every level, and a 500-item cap bounds the work. Unit tests cover the null and non-array cases and were **shown to fail** without their guards (19/1 each); the wide case passes with or without the item cap, because the push loop is what removes the throw - the cap bounds work rather than correctness, and the code comment says so rather than implying a test covers it. Status `fixed`.
**Closed 2026-09-16 by review (independent `reviewer` agent, fourth pass)**, which re-ran every hostile shape against this build: deep 5,000 -> ok; wide child 150,000 and wide top-level 250,000 -> refused; `null`/`undefined` items -> refused; non-array `items` -> refused; nine levels of a thousand items -> refused. No throw, no unbounded work, nothing over 4 ms. **The width cap stays, and is now distinguishable by a test:** a list whose items record when their `content` is read shows the mapper stopping at item 500 of 2,000 - it fails when the cap is removed, so the line is no longer untested. A getter that throws and a `Proxy` do escape the guards, and are unreachable: `fromEditorJs` is only ever called with `JSON.parse` output, which can express neither - guarding them would be defensive code for a requirement nobody has. **One optional residual, P3:** a crafted `content` that is an object is still `String()`-ed to `"[object Object]"` and stored; the editor cannot produce it, and one line (`typeof listItem.content === "string"`) would close it.

### F-38 [P3] open - Duplicate block ids are accepted, and ids are unconstrained

**File:** app/features/blocks/blocks.ts:16, 45
**Found:** 2026-09-16 by review (independent `reviewer` agent; scope: current; lens: security)
**Why it matters:** Editor.js generates unique ids, but a hand-crafted POST can repeat one or use any characters. The shape is load-bearing: item 4 will key a rendered list on `block.id`, and a page builder will reference children by id, so duplicates become a data migration later. An unconstrained id also ends up in an HTML attribute in item 4.
**Suggested fix:** Reject duplicates with a `superRefine` on `blocksSchema`, and constrain `blockId` to `/^[A-Za-z0-9_-]+$/` now, while nothing depends on it.

### F-39 [P3] open - The body cap and the block limits disagree, and the refusal destroys the draft

**File:** app/features/content/post-form-input.ts:7, app/features/content/post-edit.tsx:37
**Found:** 2026-09-16 by review (independent `reviewer` agent; scope: current; lens: correctness)
**Why it matters:** The schema permits 200 blocks of 20,000 characters (about 4 MB) while the body cap refuses anything over 1 MB, so a post that is valid by the project's own rules is rejected - and the rejection `throw`s, replacing the page with the error boundary and losing everything typed. OWASP Top 10:2025 A10.
**Suggested fix:** Return the 413 as a rendered `problem`, the way the 400 path already does, so the editor stays on screen; or lower the block limits to fit the cap so the two agree.

### F-40 [P3] fixed - `updateDraft` does not enforce that the entry is a draft

**File:** app/features/content/entries.server.ts:89-98
**Found:** 2026-09-16 by review (independent `reviewer` agent; scope: current; lens: quality)
**Why it matters:** The name promises something the `where` clause does not enforce. Harmless while every entry is a draft; item 4 introduces published rows and will hand them to this function.
**Suggested fix:** Add `and status = 'draft'`, or rename the function to say what it actually does.

**Resolution:** Repaired 2026-09-21 by build (item 4a, step 1). Renamed to `saveEntry`, which now honestly describes what it does: it saves content for any entry, draft or published, and optionally carries a status transition in the same atomic update. No `and status = 'draft'` guard was added - the data rules already say saving a published entry updates the live page, so that constraint would have been wrong, not missing. `npm run verify` -> exit 0, no behavior change to the plain-save path. Status `fixed` for `review` to close.

### F-29 [P2] open - The writing area has no accessible name

**File:** app/features/blocks/editor.client.tsx:68
**Found:** 2026-09-16 by review (scope: current; lens: accessibility)
**Why it matters:** The title input carries a visually-hidden label, but the editor's container is a bare `<div>` holding Editor.js's `contenteditable` region, which exposes a textbox role with **no name**. A screen-reader user tabbing from the title hears an unlabelled edit area and has to infer what it is. **WCAG 2.2 level A, 4.1.2 Name, Role, Value** - the project's recorded bar is AA, which includes every level A criterion (`design.md`, Accessibility bar). Checkable statically, unlike focus order, which still needs the manual pass in F-18.
**Suggested fix:** Give the holder `role="region"` and `aria-label="Post content"`, or label it from a visually-hidden heading. Confirm in the manual pass that Editor.js does not override it.
**Resolution:** Repaired 2026-09-16 by build. The container is now `<section aria-label="Post content">` - a real landmark rather than a div with a role, which is what Biome`s `a11y/useSemanticElements` asked for when the first attempt used `role="region"`. **Statically fixed only:** whether a screen reader announces it usefully is still the manual pass in F-18. Status `fixed`.
**Re-opened 2026-09-16 by review, on rendered evidence - the repair is partial.** Measured in Chromium with the editor mounted: the landmark is there (`getByRole("region", { name: "Post content" })` visible), but **the control itself is still unnamed**. Focusing the title and pressing Tab lands on `DIV contenteditable=true` with `aria-label=null`, and every `[contenteditable]` on the page reports `aria-label: null`. So a screen-reader user now hears the region on entering it, then an unnamed edit area - better orientation, same unnamed control, and WCAG 2.2 4.1.2 still applies to the control. This is the case the ledger`s `fixed` rule exists for: the repair looked right in the diff and is incomplete in the browser.
**Smallest remaining fix:** after `editor.isReady`, label the block editables (`holder.querySelectorAll("[contenteditable]")` -> `aria-label`), reapplying as blocks are added - or judge in F-18`s manual pass whether the named region is enough for a multi-block editor, and record that decision here rather than leaving it implied.
**Independent view, 2026-09-16 (`reviewer` agent):** the named region is **probably enough for SC 4.1.2**, and 4.1.2 is not where the real AA risk sits. Editor.js's editable surfaces expose no `textbox` role - measured, they are generic elements in an editable subtree - so there is no named-role control left unnamed, and what a screen reader announces on entering an editable region is decided by the region's name, which now exists. Adding `aria-label` to each `contenteditable` would be noise on nodes this project does not own. **The unmeasured risk is the two custom popovers** - the + toolbox and the block settings menu, both keyboard- and focus-managed by the library - where SC 2.1.1 (keyboard), 2.4.3 (focus order) and 2.4.11 (focus not obscured, new in 2.2) are far likelier to fail than a missing label. **Do not close this by asserting conformance:** widen the manual pass in `needs-you.md` to name both menus, and have `design.md` show the editor as *not yet verified* rather than met, since `preflight` reads that line.

### F-31 [P3] unverified - The editor placeholder may never appear

**File:** app/features/blocks/editor.client.tsx:42 (`placeholder: "Write your post…"`)
**Found:** 2026-09-16 by review (scope: current; lens: quality)
**Why it matters:** Editor.js renders its placeholder through a `data-placeholder` attribute on the first empty block, and on a freshly opened `/admin/posts/new` every `[contenteditable]` reports `data-placeholder: null`. That suggests the option is not reaching the paragraph tool - in this version it is usually set on the tool's own config rather than at the top level. If so, a writer opens an empty white canvas with no prompt, which is the opposite of the "obvious next action" the design record asks for (`design.md`, Direction). **Unverified** because I checked the attribute, not what is painted: a placeholder drawn another way would not show up this way.
**Suggested fix:** Look at the screen. If there is no prompt, move the option onto the paragraph tool's config for the installed Editor.js version, and assert the prompt in the browser test that opens a new post.

### F-25 [P2] open - Two people starting the same-titled post at once can get a 500

**File:** app/features/content/entries.server.ts:44-66 (`createDraft`)
**Found:** 2026-09-16 by review (scope: current; lens: correctness)
**Why it matters:** The free address is chosen by reading the taken ones and then inserting, with no transaction between the two. Two saves racing with the same title both read the same taken list, both pick `hello-world-2`, and the second violates `entries_type_slug_key` - an unhandled `23505` becomes the "Oops! An unexpected error occurred." page, and the writer's text is still in their editor but their save is lost. Narrow window and a handful of editors (`quality-bar.md`), so it is not a P1, but the failure is ugly and the fix is small.
**Suggested fix:** Catch `23505` on the insert in `createDraft` and retry with the next free address, two or three times before giving up. A unit test cannot reach this without a database, so it belongs with F-17's CI database or a browser test that inserts a clashing row first.

### F-26 [P3] open - `/admin/posts/new` has no loader, so a client-side navigation skips the auth check

**File:** app/features/content/post-new.tsx:9
**Found:** 2026-09-16 by review (scope: current; lens: security)
**Why it matters:** `requireUser` is route middleware, and `admin-shell/layout.tsx:11` documents the pattern: the loader is what makes a client-side navigation call the server, so the middleware runs on those too. This route has no loader, so a client-side navigation to it renders the editor without a server check. **Nothing leaks** - the page has no data, and the action re-checks on save - so this is a P3 about consistency, not an open door. It becomes a real gap the moment this route loads anything.
**Suggested fix:** Give it a loader returning `null` (or the user, once the screen shows who is writing), matching the admin shell.

### F-27 [P3] open - The address lookup scans rather than using the index

**File:** app/features/content/entries.server.ts:46-48
**Found:** 2026-09-16 by review (scope: current; lens: performance)
**Why it matters:** `slug like 'base%'` cannot use `entries_type_slug_key` under the database's default collation - a prefix `LIKE` needs `text_pattern_ops` - so every new post scans the entries table. At the recorded scale (a few thousand entries, `quality-bar.md`) this is microseconds and well inside the 1 s save bar (measured p95 105 ms), so it is a note for when the table grows, not a problem today.
**Suggested fix:** When it matters, add `create index entries_slug_prefix_idx on entries (type, slug text_pattern_ops)`, or select the exact candidates instead of a prefix match.

### F-22 [P2] unverified - The app now believes any client's `X-Forwarded-Host` and `X-Forwarded-Proto`

**File:** server/app.ts:17 (`{ trustProxy: true }`)
**Found:** 2026-09-16 by review (scope: current; lens: security)
**Why it matters:** `trustProxy` makes `request.url` come from `X-Forwarded-Proto` and `X-Forwarded-Host` whenever they are present, with no check on who sent them. In production that is safe only while **Caddy overwrites both on every request** and nothing but Caddy can reach the app - the second half is verified (127.0.0.1, ports dropped in both firewalls), **the first half is not**. If Caddy passes a client-supplied `X-Forwarded-Host` through, a visitor controls both sides of React Router's own CSRF comparison (`node_modules/react-router/dist/production/lib/actions.js:25` compares the `Origin` header to `request.url`), disabling that layer. **Impact is contained, which is why this is P2 and not higher:** this project's own check (`app/root.tsx:22`) compares `Origin` against `APP_URL` from the environment, which a header cannot change, and nothing builds an absolute URL from the request host - the three readers of `request.url` (`login.tsx:83`, `require-user.server.ts:36`, `root.tsx:28`) take only a path, and `safeRedirect` allows `/admin` paths only. So the practical loss is one of two CSRF layers, not an open redirect or a poisoned link. Also note the option is on in **development and the browser tests** too, where the app is reachable directly - there a local process can forge its own client address and evade the login rate limit. OWASP Top 10:2025 A05 Security Misconfiguration.
**Suggested fix:** After the fix deploys, check what Caddy actually forwards: `curl -sS -o /dev/null -H 'X-Forwarded-Host: evil.example' -H 'X-Forwarded-Proto: http' https://cms.surenmaharjan.fyi/admin/login` and confirm from the app's behaviour and journal that it still treats the request as `https://cms.surenmaharjan.fyi`. If Caddy does pass client values through, the smallest fix is `header_up X-Forwarded-Host {host}` and `header_up X-Forwarded-Proto {scheme}` in `deploy/caddy/habre-cms.caddy`. A test asserting a forged `X-Forwarded-Host` cannot change the origin the server believes in belongs with whichever change closes this.
**Production evidence, 2026-09-16 by deploy (release `52c2670`), against `https://cms.surenmaharjan.fyi`:** a POST carrying `X-Forwarded-Host: evil.example` with a matching `Origin: https://evil.example` was refused with the 11-byte "Bad Request" and a CSRF abort in the journal - so Caddy replaced the forged host and the app still read its origin as `cms.surenmaharjan.fyi`. A POST carrying `X-Forwarded-Proto: http` with the genuine https `Origin` reached the action normally, so Caddy overwrote that header too. **Caddy's `reverse_proxy` does not pass client-supplied `X-Forwarded-Host` or `X-Forwarded-Proto` through**, which was the unverified half. **What remains true:** the option is still on in development and the browser tests, where the app is reachable directly and a local process can forge its own client address to evade the login rate limit - a local-only concern on a single-user dev machine. Left `unverified` for `review` to judge: the production risk is disproven, and only `review` sets `invalid`.

### F-23 [P3] open - The proxied test port is written twice

**File:** e2e/forwarded-proto.spec.ts:8-9, playwright.config.ts:6
**Found:** 2026-09-16 by review (scope: current; lens: quality)
**Why it matters:** `PROXIED_PORT` is defined in the config and the port is hardcoded again as `3101` in two string constants in the spec. Changing it in one place points the test at a server nobody started; the failure is loud (connection refused) rather than silent, so this is a tidiness finding, not a bug. `coding-standards.md`: one concept, one place.
**Suggested fix:** Export the port from a small shared module both import, or read it from an environment variable the config sets.

### F-24 [P3] open - `@react-router/node` may now be an unused dependency

**File:** package.json:24
**Found:** 2026-09-16 by review (scope: current; lens: dependencies)
**Why it matters:** After this change nothing imports it - the only occurrence left in the tree is a comment in `server/app.ts:8`. It may still be required by `@react-router/dev`'s build for the node server target, and it is where the `@remix-run/node-fetch-server` version range comes from, so removing it blindly could break the build or float the transitive version. An unused direct dependency is still code shipped and maintained (`fundamentals.md`, Dependencies).
**Suggested fix:** Its own small change, not this one: remove it, run `npm run verify` and `npm run test:e2e`, and keep it with a comment saying why if the build needs it.

### F-16 [P2] closed - The backup has never been restored

**File:** deploy/backup-db.sh:1
**Found:** 2026-09-16 by preflight (first-release audit)
**Why it matters:** The quality bar promises at most 24 h of data loss and a rebuild in under an hour, and both rest on a restore nobody has performed. The mechanism is proven as far as it can be today - one run dumped, verified with `pg_restore --list`, uploaded, and the object's size was re-read from the bucket - but production's database has **0 tables** (migrations have never run there), so the dump is an empty database and restoring it proves nothing about the schema the code needs. Not a P1 only because there is no content to lose yet; it becomes one the moment anyone writes a post.
**Suggested fix:** `host`, immediately after the first `deploy` runs migrations: restore the newest dump into a scratch database and start the app against it (the dump is mode 600 root, so copy it for the `postgres` user first), then record the evidence here.
**Resolution:** Repaired 2026-09-16 by deploy, after release `52c2670` and with the schema in place. A fresh nightly backup ran (`habre_cms-20260916T024823Z.dump`, 7314 bytes, unit result `success`), was restored into a scratch database `habre_cms_restore_test` owned by the app's role, and **the application itself was started against that copy** - not merely opened in a database client, which only proves the file parses. Evidence: the restored copy holds `users` and `schema_migrations` with `0001_users.sql` recorded; `scripts/create-admin.ts` created an account against it; the app answered `/healthz` `{"status":"ok","database":"up"}`; a wrong password returned the form's own error (400) and **the right password returned 302 to `/admin`** - a real session issued from restored data. The scratch database was dropped and the throwaway account went with it. Recovery time for this data volume is seconds; the untested part that remains is a restore onto a **fresh server**, which is the D9 hour-long rebuild path. Status `fixed` for `preflight` to re-check and close.

**Closed 2026-09-21 by preflight** (milestone audit before deploying items 4a-4c). Re-checked against the live server rather than re-running the original test: `habre-cms-backup.timer` has fired nightly without interruption since the original fix - `journalctl` shows successful uploads on 2026-09-19 (`...T024004Z.dump`, 7504 bytes), 2026-09-20 (`...T023041Z.dump`, 7504 bytes) and 2026-09-21 (`...T023218Z.dump`, 7504 bytes), each logging `uploaded ... - no BACKUP_HEARTBEAT_URL set` (the missing heartbeat is F-15, separately accepted). The database now holds real schema (`users`, `entries`, `schema_migrations`, migrations `0001`-`0003` applied) rather than the empty one the original test restored, and the backup mechanism has not changed since. **Residual, unchanged from the original resolution:** a restore onto a genuinely fresh server (the full D9 rebuild path) is still untested - closing this only confirms the restore-and-start proof continues to hold for the mechanism itself. Status `closed`.

### F-17 [P2] open - The browser tests that cover login never run automatically

**File:** .github/workflows/ci.yml, package.json:22 (`verify` = typecheck, lint, unit tests, build)
**Found:** 2026-09-16 by preflight (first-release audit)
**Why it matters:** `e2e/auth.spec.ts` holds 10 tests covering the item-1 behaviours nothing else asserts end to end - rate limiting, the cross-site refusal, deactivated users, session revocation, logout. They need a database, CI has none, and `verify` excludes them, so they run only when someone remembers locally. A regression in any of those reaches `main` with every gate green.
**Suggested fix:** `ci` - add a job with a PostgreSQL service container that runs `npm run test:e2e`, or state in `AGENTS.md` that these are a manual pre-release gate and run them as part of `deploy`.

### F-18 [P2] accepted - Keyboard and screen-reader behaviour has never been checked

**File:** blueprint/context/design.md (Accessibility bar: WCAG 2.2 AA, listed unchecked)
**Found:** 2026-09-16 by preflight (first-release audit)
**Why it matters:** The project holds itself to WCAG 2.2 AA, and the only two screens that exist - `/admin/login` and the admin shell - have never been driven by keyboard alone or heard through a screen reader. No automated check hears what is announced; the open line in `needs-you.md` has been there since item 1's spec. Contrast was measured in `design.md`, so this is about focus order, focus visibility, labels and announcements.
**Suggested fix:** The user, from item 1's `verify --manual` walkthrough (NVDA, VoiceOver or Orca); `verify` records the result and closes the `needs-you.md` line.
**Resolution:** **Accepted 2026-09-21 by the owner**, for this release specifically (items 4a-4c to production): shipping without a manual keyboard/screen-reader pass, same as the prior three releases. The scope has grown since this was first found - it now covers the admin shell, the block editor's two popovers, and (new in item 4b) the public site - and none of it has had a manual pass. Not closed: the three open lines in `needs-you.md` (block editor, admin shell/login, public site) stay open, and `preflight` reports this again at the next milestone audit until one actually happens.

### F-19 [P3] open - The one migration has no reverse, and nothing says that is intended

**File:** db/migrations/0001_users.sql:1
**Found:** 2026-09-16 by preflight (first-release audit)
**Why it matters:** The runner applies `.sql` files forward only and no migration carries a down path. That is a defensible choice for a project whose rollback story is "restore the backup", but it is nowhere recorded, so the next person adding a destructive migration has no stated policy to follow and may assume one exists.
**Suggested fix:** `migrate` or a decision entry - write the policy down (forward-only, reverse by restore) or add down paths. Then this becomes an accepted risk rather than an omission.

### F-20 [P3] open - Root can still log in over SSH with a key

**File:** ocwebserver `/etc/ssh/sshd_config` (`permitrootlogin without-password`)
**Found:** 2026-09-16 by preflight (first-release audit)
**Why it matters:** Password authentication is off and the firewalls are tight, so this is a hardening gap rather than a hole: any key in root's `authorized_keys` is a direct root session with no sudo record. Deploys use the `ubuntu` user with sudo and never need root over SSH.
**Suggested fix:** `host`, with the user's yes: set `PermitRootLogin no`, reload `sshd`, and confirm the `ubuntu` session still works before closing the old one.

### F-07 [P3] fixed - Without X-Forwarded-For every login shares one rate-limit bucket

**File:** app/features/auth/client-ip.ts:10
**Found:** 2026-09-15 by review (scope: current; lens: security)
**Why it matters:** A request with no `X-Forwarded-For` is keyed as `unknown`. If production ever receives requests without it (a Caddy config that strips it, or the app reachable other than through Caddy), all visitors share one IP bucket and 20 failed logins from anyone lock everyone out for 15 minutes. Caddy's `reverse_proxy` sets the header by default, so this depends on deployment config not yet written - hence unverified.
**Suggested fix:** `host`: confirm the Caddy site file sets `X-Forwarded-For` and the app stays on 127.0.0.1; `preflight` checks it. Optionally log a warning once when a login arrives without the header in production.
**Resolution:** Partly repaired 2026-09-16 by build (spec step "Repair F-07"). The login action warns once per process, in production only, when a login arrives without `X-Forwarded-For`. Evidence: production build, two logins without the header -> exactly one warning line; a fresh process, a login with the header -> none; `npm run verify` exit 0. The finding's main check stays open for `host`/`preflight`: confirm the Caddy site file sets the header and the app listens only on 127.0.0.1. Status set to `fixed` so `preflight` re-checks and closes it.
Code part re-checked 2026-09-16 by independent review (reviewer agent): production build, 2 logins without the header (one 302, one 400) -> the warning exactly once, with no request data. Stays `fixed`: `preflight` closes it after `host` confirms the Caddy site file sets `X-Forwarded-For` and the app listens only on 127.0.0.1.
Deployment evidence, 2026-09-16 by deploy (release `48e5052`): a POST to `/admin/login` through `https://cms.surenmaharjan.fyi` was logged as `{"event":"request_refused",...,"ip":"180.150.113.140"}` - the real client address, not `127.0.0.1` and not `unknown`, so Caddy's `reverse_proxy` does set `X-Forwarded-For` and the app reads it correctly. The app binds `127.0.0.1` only (`server.js:10`), and ports 3000 and 5432 are dropped from outside. Both halves now have evidence; `preflight` can close this.

### F-13 [P3] unverified - One host with a routed IPv6 /48 still gets tens of thousands of rate-limit keys, so it can hold both password slots

**File:** app/features/auth/client-ip.ts:28 (`/64` key), app/features/auth/login-rate-limit.server.ts:25 (`createInFlightLimit(2)`); F-11's accepted residual
**Found:** 2026-09-16 by review (scope: current; lens: security)
**Why it matters:** F-11's accepted residual named only "an attacker with many IPv4 addresses (~600-1800 per 15 min)". Per-/64 keys give one machine with a routed /48 65,536 keys (~1.3 M counted attempts per 15 min) - a /48 is free from IPv6 tunnel brokers and standard at many hosts - far above the 600-1800 keys needed to keep both scrypt slots busy (a /56 gives 256 keys, 5,120 attempts: short of that but a large budget). So the slot-holding attack that makes real logins get 503 needs one machine, not a botnet, if the CMS hostname is reachable over IPv6; that reachability is the unverified part (`host` has not recorded it). The residual was accepted on an understated description. OWASP Top 10:2025 A06 Insecure Design.
**Suggested fix:** Correct F-11's residual wording to "many IPv4 addresses, or one IPv6 /48 if the CMS is served over IPv6" and have the user re-confirm. `host`: record whether the CMS hostname has an AAAA record; the cheapest mitigation is serving it over IPv4 only. Otherwise accept explicitly, or also count failures under a /48 key with a higher limit.
**Resolution:** Checked 2026-09-16 by build: `cms.surenmaharjan.fyi` is a CNAME to `surenmaharjan.fyi`, which has A `161.33.89.75` and no AAAA, so the hostname does not resolve over IPv6 today. Still unverified: DNS is not an access control - if the VPS has a public IPv6 address and Caddy listens on it, a client can connect to that address directly with the CMS hostname. `host` must check `ip -6 addr` on `ocwebserver` and Caddy's bind addresses, and note that an AAAA added to the root domain also applies to `cms` through the CNAME.
Evidence from the user, 2026-09-16, on `ocwebserver`: `ip -6 addr show scope global` is empty and there is no IPv6 default route; Caddy listens on `*:443` and `*:80` with no `bind`. With no public IPv6 address and no AAAA record, the CMS cannot be reached over IPv6, so the /48 attack is not possible on today's deployment. It becomes valid again if the VM gets IPv6; recorded for `host` in `project-plan.md` section 8 (put `bind 0.0.0.0` in `habre-cms.caddy`, or re-check this finding then). Status left `unverified`: marking it `invalid` is a `review` verdict or the user's call, not build's.

### F-54 [P3] fixed - Four bare element selectors in `post-list.module.css` leak out of the CSS Module

**File:** app/features/content/post-list.module.css:90,96,105,111,115
**Found:** 2026-09-21 by review (independent `reviewer` agent; scope: current; lens: quality)
**Why it matters:** CSS Modules scope class names, not element selectors. `table`, `th`, `td`, `tr:last-child td` and `tbody tr:hover` are emitted verbatim into the global stylesheet - confirmed in the built chunk (`build/client/assets/post-list-*.css`): `table{border-collapse:collapse;width:100%;…}th{padding:…}td{…}`. Every other CSS Module in the project scopes under its own class; this is the only one that does not. Harmless while one table exists. It bites the moment another admin table renders on a page that still has this chunk loaded (client-side navigation keeps stylesheets around) - item 5's media library or item 8's users list would silently inherit this table's width, padding and border rules.
**Suggested fix:** Prefix all five with `.list` (`.list table`, `.list th`, `.list td`, `.list tr:last-child td`, `.list tbody tr:hover`) - the markup already nests the table inside `.list`.
**Resolution:** Repaired 2026-09-21 by build. All five rules prefixed with `.list`. Evidence: the built chunk now reads `._list_18e61_82 table{…}` etc. for every one of the five - no bare element selector left in the chunk; a screenshot (`repair-f54-list.png`) shows the table rendering identically. `npm run verify` -> exit 0, 148 tests. Status `fixed`.

### F-55 [P3] open - The list's "Last changed" date is formatted in the server's timezone, not the reader's

**File:** app/features/content/post-list.tsx:175-181 (`formatUpdatedAt`)
**Found:** 2026-09-21 by review (independent `reviewer` agent; scope: current; lens: quality)
**Why it matters:** `toLocaleDateString` with no `timeZone` option uses the *runtime's* zone. Measured: a row stored at `2026-09-20T23:30:00Z` rendered `21 Sept 2026` from a server in `Australia/Adelaide` and `20 Sept 2026` from a UTC browser (checked both with `TZ=… node`). Two consequences: a React 19 hydration mismatch for any row whose date crosses midnight between the two zones (logged, and React re-renders that subtree); and, with JavaScript off - D10's own premise - the reader is permanently shown the *server's* date, never their own. Production runs UTC while the owner is UTC+5:45, so a post saved before ~05:45 local shows the previous day.
**Suggested fix:** Format the date in the loader with an explicit `timeZone: "UTC"` (or leave formatting to the client only, inside a `<time dateTime={…}>` with `suppressHydrationWarning`) so server and browser agree.

### F-56 [P3] open - A page number past the last page shows "no matches" with no way back

**File:** app/features/content/post-list.tsx:94-118
**Found:** 2026-09-21 by review (independent `reviewer` agent; scope: current; lens: correctness)
**Why it matters:** Verified live: with 26 posts, `/admin/posts?page=9` answers 200 and renders "No posts match this filter or search." - untrue, since no filter or search is active - because the branch only checks `list.entries.length === 0`, not whether `query.page` is actually within `totalPages`. The pagination block (and its only way back, "Previous") sits inside the `entries.length > 0` branch, so there is no way back from this page except editing the URL. Reachable without crafting: bookmark page 2, then delete posts until fewer than 20 remain, and open the bookmark.
**Suggested fix:** In the loader, when `query.page > list.totalPages && list.total > 0`, redirect to the last real page (`listHref({...query, page: list.totalPages})`).

### F-58 [P3] open - `requireUser` runs twice on the delete confirmation route

**File:** app/features/content/post-delete.tsx:11
**Found:** 2026-09-21 by review (independent `reviewer` agent; scope: current; lens: quality)
**Why it matters:** `post-delete.tsx` is a child of the admin-shell layout, which already exports `requireUser` as middleware covering every route inside it (confirmed against the installed React Router docs: parent middleware runs before child, for document and `.data` requests). This route additionally declares its own `requireUser` on line 11, so every request runs two JWT verifications and two `findUserById` database reads. Harmless - the redundancy is defensive, not wrong - but it is an inconsistency: `post-list.tsx` sits in the same layout and correctly declares nothing.
**Suggested fix:** Drop line 11 and a comment noting the layout already guards it - or, if the explicitness is wanted, add the same line to `post-list.tsx` so the convention is one thing, not two.

### F-59 [P3] open - Every login costs an extra redirect hop through `/admin`

**File:** app/features/auth/safe-redirect.ts:1, app/features/auth/login.tsx:29
**Found:** 2026-09-21 by review (independent `reviewer` agent; scope: current; lens: performance)
**Why it matters:** `DEFAULT_DESTINATION` and the already-logged-in redirect both still point at `/admin`, which `home.ts` then 302s to `/admin/posts`. Verified: `POST /admin/login` -> `302 /admin` -> `302 /admin/posts`. Worse than a wasted round trip: `/admin` sits inside the guarded layout, so that hop also runs `requireUser` and the layout's own loader (another database read for the user) before throwing the second redirect. Small at this project's scale, but it is a needless doubling of exactly the request every session starts with.
**Suggested fix:** Point both at `/admin/posts` directly; or move the `admin` route outside `layout(...)` in `routes.ts` so the redirect resolves for free, before the guard runs.

### F-60 [P3] fixed - The list's SQL fragments use unqualified column names inside a JOIN

**File:** app/features/content/entries.server.ts:46-48 (`ownedBy`), 146-147 (`statusFilter`, `searchFilter`)
**Found:** 2026-09-21 by review (independent `reviewer` agent; scope: current; lens: quality)
**Why it matters:** `ownedBy` emits `and author_id = …`, and the new `statusFilter`/`searchFilter` emit `and status = …` / `and title ilike …` - all unqualified, while `listEntries`'s row and total queries join `entries e` to `users u`. Unambiguous today only because `users` happens to own no `author_id`, `status` or `title` column. A future column on `users` with one of those names (item 8, "deactivate a user", is a plausible source of a `users.status`) turns this into a runtime `column reference "status" is ambiguous` on the posts list - not a compile error, since raw SQL has no static check.
**Suggested fix:** Qualify the three fragments as `e.author_id` / `e.status` / `e.title`, and alias `entries` as `e` in `findEntryForUser` and `updateDraft` too so every caller of `ownedBy` is consistent.
**Resolution:** Repaired 2026-09-21 by build. `ownedBy`, `statusFilter` and `searchFilter` now all qualify to `e.`; every call site (`findEntryForUser`, `updateDraft`, `deleteEntry`, and all three of `listEntries`'s internal queries) aliases `entries` as `e`. **The repair caught its own instance of the bug while landing** - `listEntries`'s tab-count query had no `e` alias and would have thrown `missing FROM-clause entry for table "e"` the moment `ownedBy` required one; found by re-reading every call site, not by the error occurring. Smoke-tested against the dev database: every function (list in three modes, find, update, delete, both cross-author checks) returns identical results to before. `npm run verify` -> exit 0, 148 tests; `npm run test:e2e` -> 39 passed. Status `fixed`.

### F-61 [P3] open - Deleting a post loses the reader's place in the list

**File:** app/features/content/post-delete.tsx:43
**Found:** 2026-09-21 by review (independent `reviewer` agent; scope: current; lens: quality)
**Why it matters:** The redirect after a delete is always the bare `/admin/posts?deleted=…`, so an author on page 3 of the Drafts tab with a search active lands back on page 1 of All. Minor, but the confirm screen already has the referring list's state available and simply does not carry it.
**Suggested fix:** Carry `status`/`q`/`page` through the confirm screen as hidden form fields and append them to the redirect target alongside `deleted`.

### F-62 [P3] open - The search box has no submit control

**File:** app/features/content/post-list.tsx:81-93
**Found:** 2026-09-21 by review (independent `reviewer` agent; scope: current; lens: accessibility)
**Why it matters:** Enter submits the form (valid HTML - one non-hidden field allows implicit submission), but there is no visible or accessible button, so speech-input and switch-access users have no target to activate. Confirmed in the rendered screenshot (`verify-list.png`): a bare input with no adjacent control. Not a hard WCAG failure on its own, but it is the only interactive control on the page with no operable element besides the field itself.
**Suggested fix:** Add a submit button - an icon button with visually-hidden text ("Search") is enough, matching the search icon convention elsewhere in the mockups.

### F-63 [P3] unverified - Two possible screen-reader gaps in the new list and delete flow

**File:** app/features/content/post-list.tsx:61-67 (filter tabs), app/features/admin-shell/layout.tsx:36-43 (nav)
**Found:** 2026-09-21 by review (independent `reviewer` agent; scope: current; lens: accessibility)
**Why it matters:** Reasoned from the markup, **not measured with a screen reader** - flagged as unverified rather than a confirmed failure. (a) Both the sidebar's `NavLink` and the active filter tab carry `aria-current="page"`, so a screen reader has two things asserting "this is the current page" on one screen; the tabs are a filter state, not a location, so `aria-current="true"` would be more accurate there. (b) The post-delete success `Message` uses `role="status"`, but the element arrives already populated - inserted with its content on client navigation, or present at load with JavaScript off - and a live region populated that way is unreliably announced, with no focus moved to it. A screen-reader user may get no confirmation that a delete succeeded.
**Suggested fix:** Change the tabs' `aria-current` to `"true"`. For the delete confirmation, verify with an actual screen reader as part of the existing widened `needs-you.md` line before treating either half as settled.

### F-64 [P3] open - Two screenshots in the reference folder show a stale, pre-filter version of the list

**File:** blueprint/reference/3-manage-posts/list-light.png, list-dark.png
**Found:** 2026-09-21 by review (independent `reviewer` agent; scope: current; lens: quality)
**Why it matters:** These two were captured after Step 2 (no filter tabs, no search box, no Delete column) and left in place after Steps 3 and 4 added all three; `verify-list.png` in the same folder shows what actually shipped. Two screenshots of the same screen disagreeing with each other in one reference folder is the same failure F-44 was raised for: a record that shows something untrue is believed by the next reader who has no way to tell which one is current.
**Suggested fix:** Delete `list-light.png` and `list-dark.png`, or rename them `step2-list-*.png` so they read as history rather than the current state.

### F-69 [P2] open - `createRequestHandler` is never given a mode, so every error is sanitized in development too - root's own dev-mode stack trace has never been reachable

**File:** server/app.ts:6 (`createRequestHandler(() => import("virtual:react-router/server-build"))`)
**Found:** 2026-09-21 by review (out-of-scope discovery, while verifying the F-66 fix; scope: current; lens: quality)
**Why it matters:** React Router's `createRequestHandler(build, mode)` defaults `mode` to `"production"` whenever the second argument is not a recognized mode string (`lib/server-runtime/server.js`: `let serverMode = isServerMode(mode) ? mode : "production";`), and single-fetch's error encoding only skips sanitization `serverMode === "production" ? sanitizeError(...) : value` - i.e. it sanitizes **unless** mode is explicitly `"development"` or `"test"`. `server/app.ts` calls `createRequestHandler` with one argument, so this project has run in React Router's production error mode on every request since item 1, **regardless of `NODE_ENV` or `npm run dev`**. Confirmed directly: a deliberate `throw new Error("deliberate test bug")` in `home.tsx`'s loader, hit via `npm run dev`, arrived at the `ErrorBoundary` as a `SanitizedError` with the generic message "Unexpected Server Error" and no stack - not the real message, not `error.stack`. This means `root.tsx`'s own `import.meta.env.DEV` branch (showing `error.message` and `error.stack` for debugging) has **never actually shown anything but the generic message**, on any route, in any environment, since it was written - `import.meta.env.DEV` is a Vite build-time flag, unrelated to React Router's own separate `serverMode` concept, and the two were never connected. No end-user impact: production is supposed to sanitize, and does. The loss is entirely developer-facing - local debugging has been quietly worse than the code implies for the life of the project.
**Suggested fix:** Pass the mode explicitly: `createRequestHandler(() => import("virtual:react-router/server-build"), process.env.NODE_ENV === "development" ? "development" : "production")` (or reuse `server.js`'s existing `DEVELOPMENT` constant). Then re-verify `root.tsx`'s dev branch actually renders a message and stack trace for a deliberately-thrown error, the same way this finding did.
