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


### F-232 [P3] open - "Check your email" says "We sent a link" above "We couldn't send the email"
File: app/features/signup/signup-sent.tsx (the `failed` state)


### F-233 [P3] open - Turning signup off strands unconfirmed accounts: login sends them to a 404
File: app/features/auth/login.tsx:83; app/features/signup/signup-sent.tsx:23; app/features/signup/verify.tsx:21


### F-234 [P3] open - An email send failure is logged with no cause
File: app/features/signup/signup.tsx:114; app/features/signup/signup-sent.tsx:69


### F-235 [P3] open - `SMTP_URL`'s query string can switch off TLS checks, getting round the never-in-clear rule
File: app/lib/email-env.server.ts:17


### F-236 [P3] open - One valid invite can probe any number of emails for an account; in `open` mode, anyone can
File: app/features/signup/signup.server.ts:77-85,126


### F-237 [P3] open - Account pre-hijacking: an invited signup can register someone else's email with a password the attacker knows
File: app/features/signup/verify.tsx:57-85


### F-238 [P3] unverified - Send it again may answer measurably slower for an unconfirmed account
File: app/features/signup/signup-sent.tsx:62; app/features/signup/resend.server.ts


### F-239 [P3] open - The signup error summary is not a list, and focus does not move to it
File: app/features/signup/signup.tsx:148-160


### F-240 [P3] open - Two signup e2e assertions are weaker than they read
File: e2e/signup.spec.ts:98, :404


### F-241 [P3] open - Plan section 5 does not record the new pins
File: blueprint/project-plan.md:131-178


### F-242 [P3] open - Failed invite codes leave no security event
File: app/features/signup/signup.server.ts:117
