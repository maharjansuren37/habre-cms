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
File: app/features/content/entries.server.ts:138-192 (`createDraft` / `insertDraft`)


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


### F-251 [P2] open - Two browser tests fail intermittently in CI under the full suite
File: e2e/block-toolbar.spec.ts:687; e2e/sites.spec.ts:56


### F-252 [P2] open - The confirm test's sign-in helper reads the URL before the login answers, so "the old address no longer signs in" can pass vacuously
File: e2e/account.spec.ts:452-465 (`signIn`), used at :487-488


### F-264 [P2] open - The "two admins at once" test can pass without the site-row lock
File: e2e/account-delete.spec.ts:337-362


### F-269 [P2] fixed - A client-sent `Forwarded: host=` header may override the pinned `X-Forwarded-Host`, and the host now picks the site and the platform
File: server/app.ts:16 (`trustProxy: true`); deploy/caddy/habre-cms.caddy:29-32

### F-298 [P2] open - An animated WebP is flattened to its first frame, and a long one is refused as over 40 megapixels
File: app/features/media/optimise-image.server.ts:44-45


### F-299 [P2] open - The "upload itself is not kept" browser assertions cannot fail
File: e2e/media-optimise.spec.ts:105-107


### F-300 [P2] open - The refusal for an upload that only fails the storage limit after resizing has no test
File: app/features/media/store-upload.server.ts:94 (moved from media-list.tsx in 18a2)


### F-309 [P2] unverified - Peak memory resizing a 40-megapixel image on the 954 MB server is unmeasured
File: app/features/media/optimise-image.server.ts (MAX_INPUT_PIXELS)


### F-310 [P2] unverified - sharp's prebuilt x64 binary needs x86-64-v2, which the server is not checked for
File: deploy/setup-server.sh:47

### F-313 [P2] open - deriveBrandShades only darkens, so a dark surface silently gets failing shades
File: app/features/brand/brand-colours.ts:138-149

### F-326 [P2] open - Shrinking to the 64px sample blends wordmark strokes with an opaque background, giving washed-out or near-white colours
File: app/features/media/optimise-image.server.ts:64

### F-354 [P2] closed - The wait's live region is removed when the draft succeeds, so "Your draft is ready" is never announced
File: app/features/onboarding/start-wait.tsx:78-89

### F-355 [P2] open - Journey tests assert "Building your site" against a 1-second fake, so they can flake on a slow runner
File: e2e/onboarding.spec.ts:493-495 (`expectDraft`), :520-526

### F-363 [P2] fixed - "Two signups at once" can get "Signup is busy" instead of "is taken" when other tests hold the password-check slots
File: e2e/signup.spec.ts:272; app/features/signup/signup.server.ts:64

### F-364 [P3] open - The review badges the first page "Home page", but Use this draft makes p1 the home page
File: app/features/onboarding/start-wait.tsx:167; app/features/ai/apply-plan.ts:61

### F-365 [P3] open - Home trusts status 'succeeded' without the parse rule: an unreadable draft is offered as waiting, an unreadable applied one reads "0 pages"
File: app/features/ai/runs.server.ts:139,151; app/features/admin-shell/home.tsx:97,127

### F-366 [P3] open - On /start the kit's large button loses to the base button rule; Use this draft is 44px beside a 52px link that wraps at 390px
File: app/features/onboarding/onboarding.module.css:198-209; app/features/onboarding/start-wait.tsx:231

### F-367 [P3] open - The "two applies at once" test proves the claim only when the two POSTs happen to overlap
File: e2e/onboarding.spec.ts:710-728

### F-368 [P3] open - The 1-second apply timings are hard assertions in CI too
File: e2e/onboarding.spec.ts:725, :738

### F-369 [P3] open - "Shows an alert and creates nothing" never looks for the alert, and the alert points at a Try again the review lacks
File: e2e/onboarding.spec.ts:761-771; app/features/onboarding/start-wait.tsx:86-92, :228-229

### F-370 [P3] open - An apply that loses an address race with a concurrent page create answers 500
File: app/features/ai/apply-run.server.ts:36, :52

### F-371 [P2] unverified - A page published between the gate and the apply transaction has its menu and home page replaced by drafts
File: app/features/onboarding/start-layout.tsx (gate); app/features/ai/apply-run.server.ts

### F-372 [P3] unverified - Home's loader opens up to nine inSite transactions per load against a pool of five
File: app/features/admin-shell/home.tsx (loader); app/lib/db.server.ts:5
