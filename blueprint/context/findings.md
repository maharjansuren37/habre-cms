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

### F-29 [P2] deferred - The writing area has no accessible name
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

### F-143 [P2] open - The current admin nav entry is marked by hue alone
File: app/features/admin-shell/layout.module.css:56-78

### F-144 [P3] open - The left edge of Log out's focus ring is clipped on wide screens
File: app/features/admin-shell/layout.module.css:107-110 (with :9-16)

### F-145 [P3] open - No test proves the site scope overrides each role
File: e2e/theme.spec.ts:62-73; e2e/contrast.spec.ts:103-111

### F-146 [P3] open - Two theme tests reuse the fixed slug `a-published-post-about-gardens`
File: e2e/theme.spec.ts:131,144

### F-147 [P3] open - Stale contrast figures and test counts in comments and docs
File: app/features/content/entry-list.module.css:218,224; app/features/users/user-list.module.css:86; app/features/content/entry-delete.module.css:28; app/features/media/media-delete.module.css:35; app/app.css:4-5; AGENTS.md:267; blueprint/context/needs-you.md:171

### F-148 [P3] open - The heading font is applied rule by rule, with no global rule
File: app/app.css (no h1-h4 rule); prototypes/components.css:436

### F-149 [P3] unverified - The production build polyfills `light-dark()`, so a `color-scheme` set outside Vite's CSS will not switch roles
File: app/app.css (`:root` roles); build output

### F-150 [P3] unverified - The font face declares only `format("woff2-variations")`
File: app/app.css:13-19

### F-151 [P2] unverified - A percent-encoded admin path (`/%61dmin/...`) may route to an admin screen while host routing, the CSP and the site scope see a public path
File: app/lib/content-security-policy.ts (`areaForPath`); app/lib/host-routing.ts; app/root.tsx
