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

### F-29 [P2] closed - The writing area has no accessible name
File: app/features/blocks/editor.client.tsx:68
Deferred to: spec (item 14a) - the code it names is replaced in items 14a-14c (D165, D169, D170); 14a's review closes it once that code is gone. 14a's spec carries the requirement: the new editor's writing area has an accessible name (owner, 2026-10-02)

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

### F-153 [P2] closed - The Text style select moves focus into the writing area on every change
File: app/features/blocks/document-editor.client.tsx:487-503 (`setTextStyle`, the select's onChange)

### F-154 [P2] closed - A stored document the editor's schema cannot read opens empty, and Save overwrites it
File: app/features/blocks/document-editor.client.tsx:190-207 (`useEditor`, no `enableContentCheck` / `onContentError`)

### F-155 [P3] open - Marks are not limited to one of each kind, so the stored shape is still not canonical
File: app/features/blocks/document.ts:58-78 (`markSchema`, `marks`, paragraph `content`)

### F-156 [P3] open - A link with mixed formatting renders as several adjacent links
File: app/features/blocks/render.tsx:108-117 (`renderText`)

### F-157 [P3] closed - The editor bundle loads Zod's core only to configure it
File: app/features/content/entry-form.tsx:7 (`import "#app/lib/zod-jitless.client.ts"`)

### F-158 [P3] closed - The editor's options are rebuilt on every render
File: app/features/blocks/document-editor.client.tsx:190-207 (`extensionsFor(...)`, `editorProps`)

### F-159 [P3] open - The contract's caps are copied into several files
File: app/features/blocks/document.ts:28,34,47,52; inline-runs.ts:9; document-editor.client.tsx:26,28,623

### F-160 [P3] closed - Comments still name code this item deleted
File: app/features/settings/logo-picker.client.ts:5; logo-picker.module.css:1; settings.tsx:216; app/lib/content-security-policy.ts:11,28; content-security-policy.test.ts:34

### F-161 [P3] open - Two test gaps: the placeholder is untested, and the caps timing test moves the caret without settling
File: e2e/document-editor.spec.ts (no placeholder assertion; :816-817)

### F-162 [P2] open - The F-154 repair locks the editor on documents the server stores: a text node with two marks of one kind
File: app/features/blocks/document-editor.client.tsx:222-225; app/features/blocks/document.ts (`markSchema`, `marks`)

### F-163 [P3] open - An unreadable document opens as an empty, editable editor; the refusal comes only at Save and suggests a reload that cannot help
File: app/features/blocks/document-editor.client.tsx:212-235; app/features/content/entry-form.tsx:178-181

### F-164 [P3] open - One more comment names the deleted editors
File: app/features/blocks/document-editor.client.tsx:198

### F-165 [P3] open - The Text style select's label is visually hidden
File: app/features/blocks/document-editor.client.tsx:520-522
