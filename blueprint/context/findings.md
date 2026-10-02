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

### F-166 [P1] fixed - Section settings cannot be opened for a section whose first block is an image, button, line or space
File: app/features/blocks/document-editor.client.tsx:587-597, :713

### F-167 [P2] open - Copying or cutting a selection that holds an image throws, so the editor never handles it
File: app/features/blocks/document-editor.client.tsx:163 (`ImageNode`, no `renderHTML`)

### F-168 [P2] open - A palette insert from a gap cursor lands after section 1's first block, not in the cursor's column
File: app/features/blocks/palette-insert.ts:76-80

### F-169 [P2] open - Two spec files seed a page with the same address and can fail each other
File: e2e/document-editor.spec.ts:976; e2e/document-render.spec.ts:229

### F-170 [P2] open - `document-render.spec.ts` resets the shared settings row after every test, widening F-103
File: e2e/document-render.spec.ts:32

### F-171 [P3] open - "Enter did not submit the entry form" cannot fail
File: e2e/document-editor.spec.ts:1544

### F-172 [P3] open - Enter in Button text saves the page, and the panel's no-`name` comment is wrong
File: app/features/blocks/settings-panel.client.tsx:193, :263, :327

### F-173 [P3] open - The edit loaders run two independent queries in turn
File: app/features/content/page-edit.tsx:43-44; post-edit.tsx:40-41; page-new.tsx; post-new.tsx

### F-174 [P3] unverified - A malformed stored `mediaId` would answer 500 on public and edit routes
File: app/features/public-site/document-media-ids.ts:6

### F-175 [P3] open - Stale comment and R2 test counts
File: app/features/media/media-picker-dialog.module.css:1-2; blueprint/context/needs-you.md:170; AGENTS.md (ci row)

### F-176 [P2] open - Close or Escape on a section panel opened over an image or button shows that block's panel instead of hiding
File: app/features/blocks/document-editor.client.tsx:709-713 (`close`)

### F-177 [P2] open - Reducing Columns while an image in a removed column is selected swaps the section panel for the Image panel and drops focus
File: app/features/blocks/document-editor.client.tsx:698-703 (reset effect), :499-513 (`setColumns`)

### F-178 [P3] open - After the gear, clicking the already-selected image keeps the section panel
File: app/features/blocks/document-editor.client.tsx:698-707
