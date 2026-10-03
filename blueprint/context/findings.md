# Findings

> **Generated file.** The findings index, loaded every session: one heading per
> live finding - `### F-03 [P0] open - <title>` and a `File:` line under it -
> and nothing else. The full entry is `blueprint/findings/F-03.md`, read when
> acting on that finding; **status lives only here**, evidence in the entry's
> **Resolution**. `review` raises code findings; `build` marks a repair `fixed`;
> only a later `review` pass moves it to `closed` - except a P2 or P3 whose
> repair `build` saw a test fail without, which `build` closes itself. **A
> finding no code fixes** - raised by `preflight` or `host`, such as missing
> backups or a leaked secret - is marked `fixed` with evidence by whichever
> skill repairs it, and `preflight` re-checks and closes it. `ship` refuses to
> merge while any P0 or P1 finding is `open` or `fixed`, then archives resolved
> findings with the work item, moves unresolved P3s to
> `blueprint/findings/backlog.md`, and resets this file. A finding the user puts
> off rather than abandons is `deferred`, with a
> `Deferred to:` line naming the skill that will do it: it gates nothing, stays
> in the ledger through `ship`, and `preflight` reports it at every audit until
> that skill has run.

### F-72 [P2] fixed - Item 4c's env-var rename breaks the proven symlink-only rollback for this specific release
File: /etc/systemd/system/habre-cms.service on `ocwebserver`; deploy/habre-cms.service in the repo

### F-25 [P2] open - Two people starting the same-titled post at once can get a 500
File: app/features/content/entries.server.ts:44-66 (`createDraft`)

### F-69 [P2] open - `createRequestHandler` is never given a mode, so every error is sanitized in development too - root's own dev-mode stack trace has never been reachable
File: server/app.ts:6 (`createRequestHandler(() => import("virtual:react-router/server-build"))`)

### F-103 [P2] open - Browser specs share the one `site_settings` row, and two of them running at once can fail each other
File: e2e/home-page.spec.ts; playwright.config.ts:23 (`workers: 2`)

### F-113 [P2] open - UptimeRobot watches only the admin hostname; the public site and its certificate have no check
File: UptimeRobot account (owner's); dev-notes/status.md *Monitoring*

### F-115 [P2] fixed - The link allowlist's source file holds raw NUL and DEL bytes, so git and grep treat it as binary
File: app/features/blocks/inline-runs.ts:41; app/features/media/media-input.test.ts:43,45

### F-119 [P2] fixed - Section ids are not checked for uniqueness or for characters the editor's selector can take
File: app/features/blocks/blocks.ts (`sectionBlock`, `sectionsSchema`); app/features/blocks/sections-editor.client.tsx:96

### F-126 [P2] fixed - Release notes and entry-point docs do not describe items 10-11 or the live state
File: CHANGELOG.md (newest entry bded549); AGENTS.md (production row says "no release deployed yet")

### F-131 [P2] fixed - Entry-point docs say nothing merged is undeployed and that item 12 is next
File: dev-notes/status.md (*Where this stands*); README.md:18; CHANGELOG.md

### F-151 [P2] unverified - A percent-encoded admin path (`/%61dmin/...`) may route to an admin screen while host routing, the CSP and the site scope see a public path
File: app/lib/content-security-policy.ts (`areaForPath`); app/lib/host-routing.ts; app/root.tsx

### F-152 [P2] open - A keyboard selection in the new editor is sometimes never registered, so Bold applies to nothing
File: e2e/content-security-policy.spec.ts:133; app/features/blocks/document-editor.client.tsx

### F-204 [P2] fixed - Screen readers may read the editor's empty-text hints as content
File: app/features/blocks/document-editor.module.css:49, :323

### F-208 [P3] open - Escape, hold over 1 s, then release on the starting tile still clicks it
File: app/features/blocks/block-drag.client.tsx:308 (`swallowClick` fallback timer)

### F-209 [P3] open - The auto-scroll announcement tests do not check what is announced when scrolling stops
File: e2e/block-drag.spec.ts and e2e/section-drag.spec.ts (`expectSettledWhileScrolling`)

### F-210 [P3] open - The top-bar block test never checks that a section lies under the bar
File: e2e/block-drag.spec.ts ("releasing over the sticky top bar cancels and stores nothing, though a section lies under it")

### F-211 [P3] open - The over-the-bar tests wait a fixed 350 ms against a 300 ms hold, then read once
File: e2e/block-drag.spec.ts, e2e/section-drag.spec.ts (`waitForTimeout(350)` before `textContent()`)

### F-212 [P3] open - Nothing enforces the F-195 test's "within 1 second" condition
File: e2e/block-drag.spec.ts:416-434

### F-213 [P3] open - No test covers a touch on a section tile
File: app/features/blocks/palette.client.tsx:207 (`SectionTiles` touch guard)

### F-214 [P3] open - Three reworded comments still say something slightly untrue
File: app/features/content/entry-delete.module.css:28; app/features/media/media-delete.module.css:34; AGENTS.md (ci row); dev-notes/status.md:644-645

### F-215 [P3] open - Older unit tests compare a Transaction to null with `assert.equal`, which exhausts memory when one fails
File: app/features/blocks/palette-insert.test.ts:127,311,317,318,395,397,398; block-moves.test.ts:145,146,165,166,171,294,295; block-drops.test.ts:305,388

### F-216 [P3] unverified - A mouse overshooting the window's bottom while auto-scrolling now hides the gap and cancels on release
File: app/features/blocks/block-drag.client.tsx (`covered`: `elementFromPoint` is null outside the viewport)

### F-217 [P3] open - design.md's Announcements bullet does not record the 300 ms hold while auto-scrolling
File: blueprint/context/design.md ("Built in item 14b", *Announcements*)
