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


### F-230 [P2] open - The block toolbar can overhang a 390px viewport after a resize, failing the editor's stacking test
File: e2e/document-editor.spec.ts:670; app/features/blocks/ (block toolbar positioning)


### F-231 [P2] open - Signup's concurrent-signup test can take both password slots and make another worker's login answer 503
File: e2e/signup.spec.ts ("two signups at once"); playwright.config.ts:15 (`workers: 2`)


### F-251 [P2] open - Two browser tests fail intermittently in CI under the full suite
File: e2e/block-toolbar.spec.ts:687; e2e/sites.spec.ts:56


### F-252 [P2] open - The confirm test's sign-in helper reads the URL before the login answers, so "the old address no longer signs in" can pass vacuously
File: e2e/account.spec.ts:452-465 (`signIn`), used at :487-488


### F-253 [P3] open - Your account's forms keep what was typed after a successful save, including both passwords
File: app/features/account/account.tsx:257-310


### F-254 [P3] open - `changePassword` holds a pool connection and the user's row lock across two scrypt runs
File: app/features/account/account.server.ts:29-42


### F-255 [P3] open - A blocked or busy current-password check on Your account logs no security event
File: app/features/account/account.server.ts:66 (`withCurrentPassword`)


### F-256 [P3] open - The old-address notice tells the reader to reply, which only helps if `EMAIL_FROM` is a monitored inbox
File: app/features/account/email-changed-notice.ts:18


### F-257 [P3] open - The `saved=email` banner names whoever is signed in, not the account that confirmed
File: app/features/account/account.tsx:63; app/features/account/confirm-email.tsx:61


### F-258 [P3] open - Your account's card draws an empty divider above the Name section
File: app/features/account/account.tsx:224; app/features/users/user-form.module.css:42-47


### F-259 [P3] open - "Back to Your account" sits flush against the error message on `/confirm-email`'s expired and taken states
File: app/features/account/confirm-email.tsx:100-114; app/features/signup/signup.module.css:22-25


### F-260 [P3] open - A failed confirmation-link send and the per-IP send limit have no test
File: e2e/account.spec.ts (none); app/features/account/account.tsx:150-169


### F-261 [P3] open - `issueEmailToken`'s optional `newEmail` type-checks pairings the database refuses
File: app/features/signup/email-tokens.server.ts:16-22


### F-262 [P3] open - `isPlatformPath`'s doc comment does not list `/confirm-email`
File: app/lib/content-security-policy.ts:3-7
