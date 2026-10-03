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

### F-181 [P3] open - The Text style menu can open with no item focused and then not close from the keyboard
File: app/features/blocks/block-toolbar.client.tsx:372-375,463-467

### F-182 [P3] open - Clicking the Text style button while its menu is open drops focus to the page body
File: app/features/blocks/block-toolbar.client.tsx:439-440

### F-183 [P3] open - The toolbar's tab stop is remembered by index across blocks and can land on Delete
File: app/features/blocks/block-toolbar.client.tsx:79,229

### F-184 [P3] unverified - The toolbar is placed with its old size when its buttons change but its block does not move
File: app/features/blocks/block-toolbar.client.tsx:85-106

### F-185 [P3] open - The ring's browser test cannot fail if the selected-block decoration breaks; the selected-node rule is declared twice
File: e2e/block-toolbar.spec.ts:163-176; app/features/blocks/document-editor.module.css:303-315

### F-186 [P3] open - CI checks the admin policy for the toolbar and menu but not for the link dialog, picker or panel
File: e2e/content-security-policy.spec.ts:160

### F-187 [P3] unverified - A repeated announcement is probably not re-read by a screen reader
File: app/features/blocks/document-editor.client.tsx:460-465

### F-188 [P3] open - Comments still describe the removed format bar
File: app/features/content/entry-form.tsx:71; app/features/content/entry-form.module.css:20-21; app/features/blocks/document-editor.module.css:4

### F-189 [P3] open - "Main heading does nothing for a list, quote or atom" asserts only the atom
File: app/features/blocks/block-moves.test.ts (last test)

### F-190 [P3] open - needs-you.md and AGENTS.md give stale counts of the R2-only browser tests
File: blueprint/context/needs-you.md:172,176; AGENTS.md (ci row)

### F-191 [P3] open - No control converts existing text into a list or quote, or a quote back to text
File: app/features/blocks/block-toolbar.client.tsx (tools by kind)

### F-192 [P3] unverified - The toolbar may cover content above the canvas or the sticky top bar
File: app/features/blocks/block-toolbar.client.tsx (place); block-toolbar.module.css (.toolbar z-index)
