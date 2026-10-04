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

### F-218 [P2] fixed - `sites.spec.ts` writes site 1's shared settings row, so specs running alongside can fail
File: e2e/sites.spec.ts:309,344,357-364

### F-219 [P3] open - The isolation spec never tests the pooled-connection claim or cross-site update and delete
File: e2e/site-isolation.spec.ts

### F-220 [P3] open - Production instructions put the app-role password on the psql command line
File: dev-notes/status.md:453; blueprint/context/current-work.md (Notes)

### F-221 [P3] open - The documented by-hand run of CI's `e2e` job fails at the new roles step
File: dev-notes/status.md:624

### F-222 [P3] open - `setup-server.sh` writes the env file before checking `roles.sql` is present
File: deploy/setup-server.sh:108,122-145,168,174-178

### F-223 [P3] open - The web process is given the owner's database credentials
File: deploy/setup-server.sh:139-141

### F-224 [P3] open - The app role can write `schema_migrations`
File: db/roles.sql:24,30

### F-225 [P3] open - The isolation spec's `afterAll` assumes its setup succeeded
File: e2e/site-isolation.spec.ts:57-63

### F-226 [P3] open - The member-creating function kept the name `createUser`; the spec says `createMember(siteId, ...)`
File: app/features/users/users.server.ts:73

### F-227 [P3] open - "A 2-column section ... stacks at 390px" fails about 1 run in 8
File: e2e/document-editor.spec.ts:670-692 (assertion at :689)

### F-228 [P3] unverified - Deleting the chosen home page or the logo's image through the app under row-level security is untested
File: db/migrations/0011_site_isolation.sql; app/features/content/entries.server.ts (deleteEntry); app/features/media/media.server.ts (deleteMedia)
