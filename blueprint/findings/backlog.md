# Findings backlog

> Unresolved P3s moved out of the loaded index - by `ship`, or in the one-off
> migration to the index format (2026-09-23). Not loaded. Each entry is
> `blueprint/findings/<ID>.md`; `review` still closes them here, and `spec`
> offers a tidy item at five or more.

### F-207 [P3] fixed - The section and block drag paths share `startDrag` through casts the compiler cannot check
File: app/features/blocks/block-drag.client.tsx:326-327,361,365,370,399,406,474

### F-86 [P3] fixed - `public-site.spec.ts`'s home-page "newest first" test is a second instance of F-78's race, on a different query
File: e2e/public-site.spec.ts:23-37 ("the home page lists only published posts, newest first")

### F-84 [P3] closed - `SecurityEvent`'s new `role` field is a bare `string`, though `requireRole` always has the real `Role` type in hand
File: app/lib/security-log.server.ts:16; app/features/auth/require-role.server.ts:27

### F-83 [P3] unverified - Item 6a's pages screens reproduce three pre-existing unverified/open posts accessibility findings
File: app/features/content/page-list.tsx:69-98 (filter tabs, search form); app/features/admin-shell/layout.tsx:39-61 (nav)

### F-79 [P3] closed - A captioned image's alt text is announced twice in a row by a screen reader
File: app/features/blocks/render.tsx:38-52 (the `image` case)
Deferred to: spec (item 14a) - the code it names is replaced in items 14a-14c (D165, D169, D170); 14a's review closes it once that code is gone. 14a's spec carries the requirement: a captioned image is not announced twice (owner, 2026-10-02)

### F-78 [P3] fixed - `manage-posts.spec.ts`'s "editor sees all posts" count races against every other spec file's own test data under parallel workers
File: e2e/manage-posts.spec.ts:29-53 ("the list is scoped by role, and the tabs' counts match")

### F-71 [P3] fixed - A cookie comment now describes a reality the hostname split already removed
File: app/features/auth/session-cookie.server.ts:9-12

### F-50 [P3] closed - The stored shape is less canonical than the contract says it is
File: app/features/blocks/inline-runs.ts:56-71 (`runsSchema`); blueprint/context/current-work.md *Data and contracts* and step 1
Deferred to: spec (item 14a) - the code it names is replaced in items 14a-14c (D165, D169, D170); 14a's review closes it once that code is gone (owner, 2026-10-02)

### F-51 [P3] closed - An empty list block refuses the whole save, with a raw Zod message
File: app/features/blocks/blocks.ts:38 (`items: z.array(runsSchema).min(1)`), with the empty item dropped at :166
Deferred to: spec (item 14a) - the code it names is replaced in items 14a-14c (D165, D169, D170); 14a's review closes it once that code is gone (owner, 2026-10-02)

### F-52 [P3] closed - F-43's "native Ctrl+B does nothing" rests on one manual observation, and the mechanism argues against it
File: app/features/blocks/editor.client.tsx:52-58; e2e/inline-formatting.spec.ts:115-140
Deferred to: spec (item 14a) - the code it names is replaced in items 14a-14c (D165, D169, D170); 14a's review closes it once that code is gone (owner, 2026-10-02)

### F-38 [P3] closed - Duplicate block ids are accepted, and ids are unconstrained
File: app/features/blocks/blocks.ts:16, 45
Deferred to: spec (item 14a) - the code it names is replaced in items 14a-14c (D165, D169, D170); 14a's review closes it once that code is gone (owner, 2026-10-02)

### F-39 [P3] closed - The body cap and the block limits disagree, and the refusal destroys the draft
File: app/features/content/post-form-input.ts:7, app/features/content/post-edit.tsx:37
Deferred to: spec (item 14a) - the code it names is replaced in items 14a-14c (D165, D169, D170); 14a's review closes it once that code is gone. 14a's spec carries the requirement: a refused save never loses the draft (owner, 2026-10-02)

### F-31 [P3] closed - The editor placeholder may never appear
File: app/features/blocks/editor.client.tsx:42 (`placeholder: "Write your post…"`)
Deferred to: spec (item 14a) - the code it names is replaced in items 14a-14c (D165, D169, D170); 14a's review closes it once that code is gone (owner, 2026-10-02)

### F-26 [P3] closed - `/admin/posts/new` has no loader, so a client-side navigation skips the auth check
File: app/features/content/post-new.tsx:9

### F-27 [P3] open - The address lookup scans rather than using the index
File: app/features/content/entries.server.ts:46-48

### F-23 [P3] fixed - The proxied test port is written twice
File: e2e/forwarded-proto.spec.ts:8-9, playwright.config.ts:6

### F-19 [P3] fixed - The one migration has no reverse, and nothing says that is intended
File: db/migrations/0001_users.sql:1

### F-20 [P3] open - Root can still log in over SSH with a key
File: ocwebserver `/etc/ssh/sshd_config` (`permitrootlogin without-password`)

### F-07 [P3] fixed - Without X-Forwarded-For every login shares one rate-limit bucket
File: app/features/auth/client-ip.ts:10

### F-13 [P3] unverified - One host with a routed IPv6 /48 still gets tens of thousands of rate-limit keys, so it can hold both password slots
File: app/features/auth/client-ip.ts:28 (`/64` key), app/features/auth/login-rate-limit.server.ts:25 (`createInFlightLimit(2)`); F-11's accepted residual

### F-55 [P3] open - The list's "Last changed" date is formatted in the server's timezone, not the reader's
File: app/features/content/post-list.tsx:175-181 (`formatUpdatedAt`)

### F-56 [P3] fixed - A page number past the last page shows "no matches" with no way back
File: app/features/content/post-list.tsx:94-118

### F-58 [P3] fixed - `requireUser` runs twice on the delete confirmation route
File: app/features/content/post-delete.tsx:11

### F-59 [P3] open - Every login costs an extra redirect hop through `/admin`
File: app/features/auth/safe-redirect.ts:1, app/features/auth/login.tsx:29

### F-61 [P3] fixed - Deleting a post loses the reader's place in the list
File: app/features/content/post-delete.tsx:43

### F-62 [P3] fixed - The search box has no submit control
File: app/features/content/post-list.tsx:81-93

### F-63 [P3] unverified - Two possible screen-reader gaps in the new list and delete flow
File: app/features/content/post-list.tsx:61-67 (filter tabs), app/features/admin-shell/layout.tsx:36-43 (nav)

### F-64 [P3] fixed - Two screenshots in the reference folder show a stale, pre-filter version of the list
File: blueprint/reference/3-manage-posts/list-light.png, list-dark.png

### F-93 [P3] fixed - The settings form silently shows and re-saves stale defaults if `useRouteLoaderData`'s hardcoded route id ever stops matching
File: app/features/settings/settings.tsx:59-60

### F-95 [P3] fixed - A page deleted after being linked reverts its row to "No page" with no visible warning, and blocks Save on a row the admin never touched
File: app/features/settings/settings.tsx:222-231 (the page `<select>`'s `defaultValue={row.pageId}`); app/features/settings/navigation-form-input.ts:102-104 (`draftRowsToNavItems`'s "neither" refusal)

### F-96 [P3] fixed - `navigation` is trusted as `NavItem[]` on read with no format guard, unlike `blocks` - a malformed value would 500 the one page that could fix it
File: app/features/settings/settings.server.ts:19-32 (`getSiteSettings`); app/features/settings/navigation-form-input.ts:11-17 (`navItemsToDraftRows`); app/features/public-site/layout.tsx:16-23 (`resolveNavigation`)

### F-98 [P3] fixed - `README.md` describes the project as it was after item 3, and does not mention items 4-8 at all
File: README.md:9-13

### F-99 [P3] fixed - `CHANGELOG.md` stops at the item-3 release; item 4's production deploy and items 5-8 are unrecorded
File: CHANGELOG.md:7-12

### F-101 [P3] fixed - Two security-event log lines still record the raw `.data` path
File: app/root.tsx:50, app/features/auth/require-role.server.ts:26

### F-102 [P3] fixed - The CSP browser test is described as covering more screens than it visits
File: app/lib/zod-jitless.client.ts:8-9; e2e/content-security-policy.spec.ts:148

### F-104 [P3] closed - `post.tsx` still has its own copy of the image lookup that `resolvePageMedia` now shares
File: app/features/public-site/post.tsx:21-34
Deferred to: spec (item 14a) - the code it names is replaced in items 14a-14c (D165, D169, D170); 14a's review closes it once that code is gone (owner, 2026-10-02)

### F-107 [P3] fixed - A Save with no `homePageId` field silently resets `/` to the latest posts
File: app/features/settings/settings.tsx:57

### F-108 [P3] fixed - Public loader data now carries entry ids and the home page's id, including a draft's
File: app/features/content/entries.server.ts:317-326; app/features/public-site/layout.tsx:30

### F-111 [P3] fixed - The placeholder's site-title test uses the default title, which is also the code's fallback, so it cannot catch a broken title lookup
File: e2e/public-site.spec.ts:44-57; app/features/public-site/home.tsx:39-41

### F-117 [P3] fixed - The settings save reads a request body of any size
File: app/features/settings/settings.tsx:53-54

### F-118 [P3] fixed - The home placeholder keeps its own "Habre CMS" fallback beside the helper's constant
File: app/features/public-site/home.tsx:42

### F-120 [P3] fixed - A page editor opened before the deploy cannot save, and its message says nothing to do
File: app/features/blocks/blocks.ts (`fromEditorJsSections`, `UNREADABLE_SHAPE`)

### F-121 [P3] fixed - The design record says focus lands on the next section after a remove; the code lands on the previous one when the last is removed
File: blueprint/context/design.md (*Sections*); app/features/blocks/sections-editor.client.tsx (`remove`)

### F-127 [P3] closed - The hero parser's "character that cannot be saved" refusal has no test
File: app/features/blocks/blocks.ts (`heroFromFields`, now `slotSectionFromFields`; applies to the call to action too)
Deferred to: spec (item 14a) - the code it names is replaced in items 14a-14c (D165, D169, D170); 14a's review closes it once that code is gone (owner, 2026-10-02)

### F-128 [P3] closed - Hero-named identifiers now serve both ready-made kinds
File: app/features/blocks/blocks.ts:456-458; app/features/blocks/sections-editor.client.tsx (HERO_FIELDS, HeroForm); sections-editor.module.css (.hero*)
Deferred to: spec (item 14a) - the code it names is replaced in items 14a-14c (D165, D169, D170); 14a's review closes it once that code is gone (owner, 2026-10-02)


### F-138 [P3] open - A settings post without `homePageId` still leads to clearing the home page one Save later
File: app/features/settings/settings.tsx:79,89

### F-139 [P3] open - The 16 KB settings cap can refuse a valid save with non-Latin labels
File: app/features/settings/settings-input.ts:24; app/features/settings/navigation-input.ts:36

### F-140 [P3] open - The F-95 note vanishes after any add/move/remove, and is not tied to its select
File: app/features/settings/settings.tsx:372

### F-144 [P3] open - The left edge of Log out's focus ring is clipped on wide screens
File: app/features/admin-shell/layout.module.css:107-110 (with :9-16)

### F-145 [P3] open - No test proves the site scope overrides each role
File: e2e/theme.spec.ts:62-73; e2e/contrast.spec.ts:103-111

### F-146 [P3] open - Two theme tests reuse the fixed slug `a-published-post-about-gardens`
File: e2e/theme.spec.ts:131,144

### F-147 [P3] fixed - Stale contrast figures and test counts in comments and docs
File: app/features/content/entry-list.module.css:218,224; app/features/users/user-list.module.css:86; app/features/content/entry-delete.module.css:28; app/features/media/media-delete.module.css:35; app/app.css:4-5; AGENTS.md:267; blueprint/context/needs-you.md:171

### F-148 [P3] open - The heading font is applied rule by rule, with no global rule
File: app/app.css (no h1-h4 rule); prototypes/components.css:436

### F-149 [P3] unverified - The production build polyfills `light-dark()`, so a `color-scheme` set outside Vite's CSS will not switch roles
File: app/app.css (`:root` roles); build output

### F-150 [P3] unverified - The font face declares only `format("woff2-variations")`
File: app/app.css:13-19

### F-156 [P3] open - A link with mixed formatting renders as several adjacent links
File: app/features/blocks/render.tsx:108-117 (`renderText`)

### F-159 [P3] open - The contract's caps are copied into several files
File: app/features/blocks/document.ts:28,34,47,52; inline-runs.ts:9; document-editor.client.tsx:26,28,623

### F-161 [P3] open - Two test gaps: the placeholder is untested, and the caps timing test moves the caret without settling
File: e2e/document-editor.spec.ts (no placeholder assertion; :816-817)

### F-163 [P3] open - An unreadable document opens as an empty, editable editor; the refusal comes only at Save and suggests a reload that cannot help
File: app/features/blocks/document-editor.client.tsx:212-235; app/features/content/entry-form.tsx:178-181

### F-171 [P3] open - "Enter did not submit the entry form" cannot fail
File: e2e/document-editor.spec.ts:1544

### F-172 [P3] open - Enter in Button text saves the page, and the panel's no-`name` comment is wrong
File: app/features/blocks/settings-panel.client.tsx:193, :263, :327

### F-173 [P3] open - The edit loaders run two independent queries in turn
File: app/features/content/page-edit.tsx:43-44; post-edit.tsx:40-41; page-new.tsx; post-new.tsx

### F-174 [P3] unverified - A malformed stored `mediaId` would answer 500 on public and edit routes
File: app/features/public-site/document-media-ids.ts:6

### F-175 [P3] fixed - Stale comment and R2 test counts
File: app/features/media/media-picker-dialog.module.css:1-2; blueprint/context/needs-you.md:170; AGENTS.md (ci row)

### F-178 [P3] open - After the gear, clicking the already-selected image keeps the section panel
File: app/features/blocks/document-editor.client.tsx:698-707

### F-180 [P3] open - Cut then paste of an image deletes it and pastes nothing
File: app/features/blocks/document-editor.client.tsx (`ImageNode`, no `parseHTML` by design)

### F-184 [P3] unverified - The toolbar is placed with its old size when its buttons change but its block does not move
File: app/features/blocks/block-toolbar.client.tsx:85-106

### F-185 [P3] open - The ring's browser test cannot fail if the selected-block decoration breaks; the selected-node rule is declared twice
File: e2e/block-toolbar.spec.ts:163-176; app/features/blocks/document-editor.module.css:303-315

### F-186 [P3] open - CI checks the admin policy for the toolbar and menu but not for the link dialog, picker or panel
File: e2e/content-security-policy.spec.ts:160

### F-187 [P3] unverified - A repeated announcement is probably not re-read by a screen reader
File: app/features/blocks/document-editor.client.tsx:460-465

### F-188 [P3] fixed - Comments still describe the removed format bar
File: app/features/content/entry-form.tsx:71; app/features/content/entry-form.module.css:20-21; app/features/blocks/document-editor.module.css:4

### F-189 [P3] open - "Main heading does nothing for a list, quote or atom" asserts only the atom
File: app/features/blocks/block-moves.test.ts (last test)

### F-190 [P3] fixed - needs-you.md and AGENTS.md give stale counts of the R2-only browser tests
File: blueprint/context/needs-you.md:172,176; AGENTS.md (ci row)

### F-191 [P3] open - No control converts existing text into a list or quote, or a quote back to text
File: app/features/blocks/block-toolbar.client.tsx (tools by kind)

### F-192 [P3] open - The toolbar may cover content above the canvas or the sticky top bar
File: app/features/blocks/block-toolbar.client.tsx (place); block-toolbar.module.css (.toolbar z-index)

### F-193 [P3] fixed - A release over the sticky top bar while it auto-scrolls drops the block into a section hidden under the bar
File: app/features/blocks/block-drag.client.tsx:294,356 (`slotAt(measure(...))`); app/features/blocks/block-drops.ts:147-152; app/features/blocks/block-drag.client.tsx:186,458 (`sectionSlotUnder`, 14c2)

### F-195 [P3] fixed - The click blocker can outlive a cancelled drag and swallow the next unrelated click
File: app/features/blocks/block-drag.client.tsx:192-202 (`swallowClick`)

### F-196 [P3] fixed - Dragging a palette tile by touch is likely cancelled by the browser's own panning
File: app/features/blocks/palette.client.tsx:117; palette.module.css (`.tile`, no `touch-action`)

### F-197 [P3] fixed - During auto-scroll the status region is rewritten several times a second
File: app/features/blocks/block-drag.client.tsx:289-304 (`update`)

### F-198 [P3] fixed - Step 4's Image-tile test checks the canvas, not what is stored
File: e2e/block-drag.spec.ts:343-353

### F-203 [P3] fixed - New circular import between palette-insert.ts and block-moves.ts
File: app/features/blocks/palette-insert.ts:10; app/features/blocks/block-moves.ts:11

### F-205 [P3] unverified - A hero published without an image leaves an empty half-width column on the public site
File: app/features/blocks/render.tsx:65-77

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


### F-229 [P3] open - The media and settings `afterEach` in `sites.spec.ts` can leave site 3 behind after a failed setup
File: e2e/sites.spec.ts:305-312


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

### F-243 [P3] fixed - A reset completing at the same moment as a new link request can deadlock, and one side answers 500
File: app/features/signup/password-reset.server.ts (`completeReset`, `issueResetToken`)


### F-246 [P3] fixed - Two of the spec's claims are untested: the completion's expiry guard, and journey 7's "own site"
File: app/features/signup/password-reset.server.ts (`completeReset`, `expires_at > now()`); e2e/password-reset.spec.ts (journey 7)


### F-247 [P3] open - The reset form gives password managers no username to save the new password against
File: app/features/signup/reset-password.tsx (the form)


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


### F-266 [P3] unverified - A content write that lands during a site deletion likely ends in an unhandled 500
File: app/features/account/account.server.ts (`deleteAccount`); app/features/content/entries.server.ts (`createDraft`); media upload


### F-267 [P3] open - Known gap: delete in one tab while demoting the only other admin can leave a site with no admin, and then a memberless site
File: app/features/users/ (role change, deactivate); app/features/account/account.server.ts (`readDeletionFacts`)


### F-268 [P3] open - The slot test's lock poll counts waiting locks across the whole database, so the reverted code could pass it
File: e2e/account-delete.spec.ts:400-405

### F-284 [P3] open - The restart check falls back to a reload when caddy's start time cannot be parsed
File: deploy/setup-server.sh (`started=$(systemctl show -p ActiveEnterTimestamp ...)`, `date -d`)


### F-285 [P3] open - The root-run `chown` of Caddy's access logs follows symlinks
File: deploy/setup-server.sh (`CADDY_LOGS` loop in `install_caddy_site`)


### F-286 [P3] open - A Caddy refusal stops the whole setup script, so the backup step after it never runs
File: deploy/setup-server.sh (call order: `install_caddy_site` before `install_backup`)


### F-287 [P3] open - The suspended-admin contrast test measures tokens, not the notice itself
File: e2e/contrast.spec.ts (suspended site's admin page tests)


### F-288 [P3] open - The notice's no-role check can pass without locating the banner
File: e2e/suspend-site.spec.ts (`notice.locator("xpath=ancestor::div[1]/..")`)


### F-289 [P3] open - The client-side navigation check does not show the notice is revalidated
File: e2e/suspend-site.spec.ts (Pages link click)


### F-290 [P3] open - Caddy's Cloudflare module prints the API token in its invalid-token error
File: deploy/setup-server.sh (validate failure hint: `caddy validate ... --envfile`)


### F-292 [P3] open - The Caddy env check reads only its three keys, so another line can still make systemd load something different
File: deploy/setup-server.sh:222-235 (`check_caddy_env`)


### F-294 [P3] open - The editor notice's client-side navigation check can pass on the shell's banner before the editor renders
File: e2e/suspend-site.spec.ts:183-186

### F-296 [P3] open - The main address's tie-break (earliest verified, then by name) has no test, though item 21 relies on it
File: app/features/sites/find-site.server.ts:6-10

### F-297 [P3] open - Content imports isForeignKeyViolation from the settings feature instead of app/lib
File: app/features/content/entries.server.ts:4; app/features/settings/settings.server.ts:158

### F-301 [P3] open - optimise-media's GIF branch can re-create an object for a row deleted meanwhile
File: scripts/optimise-media.ts:52-60

### F-302 [P3] open - optimise-media leaves the old original public if deleting it fails, and never retries
File: scripts/optimise-media.ts:89

### F-303 [P3] open - optimise-media needs the whole web-app environment, not only DATABASE_URL
File: scripts/optimise-media.ts:13-18; AGENTS.md *Commands*

### F-304 [P3] fixed - The plan's dependency line does not record sharp 0.35.5
File: blueprint/project-plan.md:168-169

### F-305 [P3] open - The media delete log line no longer says which object failed
File: app/features/media/media-delete.tsx:54

### F-306 [P3] open - The phone-viewport srcset checks fail only on a 2400 pick
File: e2e/image-srcset.spec.ts:123

### F-307 [P3] open - media-optimise.spec leaves R2 objects behind when it fails partway
File: e2e/media-optimise.spec.ts:22-24

### F-308 [P3] open - Each upload decodes the original five times
File: app/features/media/optimise-image.server.ts:49,56

### F-311 [P3] unverified - A year-long immutable cache may keep serving deleted images from a CDN edge
File: app/features/media/r2.server.ts (IMMUTABLE_CACHE_CONTROL)

### F-314 [P3] open - Other colour saves the wrong colour before hydration or without JavaScript
File: app/features/settings/settings.tsx:443,455-466

### F-315 [P3] open - The CSP walk's brand-preview colour assertion cannot fail
File: e2e/content-security-policy.spec.ts:264-266

### F-316 [P3] open - After a save, Settings' swatches keep the pre-save choice until a reload
File: app/features/settings/settings.tsx:292-303

### F-327 [P3] open - A real colour can be dropped against a segment whose end is itself a halo, so the palette can be empty
File: app/features/brand/logo-colours.ts:95-102

### F-328 [P3] open - design.md says the upload control is disabled while sending; the code uses aria-disabled on it, Choose and Remove
File: blueprint/context/design.md:165-168, :508 (*Pending*)

### F-331 [P3] open - The description can still close its own fence
File: app/features/ai/openrouter-response.ts:18

### F-332 [P3] open - The provider-schema drift test only checks one direction
File: app/features/ai/openrouter-response.test.ts:162-177; app/features/ai/provider-schema.ts

### F-333 [P3] open - Unexpected errors become `broken` with nothing logged
File: app/features/ai/run-generation.ts:156; app/features/ai/openrouter-response.ts:119; app/features/ai/openrouter.server.ts:56-62

### F-334 [P3] open - The security definer sweep's search_path omits `pg_temp`
File: db/migrations/0020_ai_runs.sql:70

### F-335 [P3] open - `openai` 7.30.0 is not in the recorded version lists
File: AGENTS.md (Stack and versions); blueprint/project-plan.md section 5

### F-336 [P3] unverified - OpenRouter's `finish_reason: "error"` lands as `invalid`, not `unavailable`
File: app/features/ai/openrouter-response.ts (readCompletion)

### F-338 [P3] open - The ai-runs browser spec can fail when the site-isolation sweep test runs alongside it
File: e2e/ai-runs.spec.ts:48-51; e2e/site-isolation.spec.ts:223-226

### F-339 [P3] open - An abandoned `running` row stays `running` until the next restart
File: app/features/ai/runs.server.ts:22-28

### F-340 [P3] open - The finish log still reports an outcome that was never saved
File: app/features/ai/run-generation.ts:197-210

### F-341 [P3] open - A timeout can still go uncharged through retries, failover or a slow configured model
File: app/features/ai/openrouter.server.ts:20,51 (`maxRetries: 2`); app/features/ai/run-generation.ts:158

### F-342 [P3] open - The spec understates the `max_tokens` trade-off
File: blueprint/context/current-work.md:199-201 (Step 10), :308-311 (Decision); app/features/ai/openrouter-response.test.ts:95-99

### F-350 [P3] open - The SDKs still read some settings from the environment, and the F-347 comment says they are all pinned
File: app/features/ai/client-options.ts:1-8

### F-351 [P3] open - A failed run through the chain does not record which provider failed
File: app/features/ai/chat-completion.ts:131-146; app/features/ai/anthropic-response.ts:86-101

### F-352 [P3] unverified - Step 6's "Anthropic shows cache reads on a second run" probably cannot pass
File: app/features/ai/anthropic.server.ts:31; app/features/ai/instructions.ts

### F-359 [P3] open - The host-split Playwright server pins only `OPENROUTER_API_KEY=`, not `AI_PROVIDERS=`
File: playwright.config.ts:57

### F-362 [P3] open - No unit test that `/start` is a platform path
File: app/lib/content-security-policy.test.ts; app/lib/host-routing.test.ts

### F-367 [P3] open - The "two applies at once" test proves the claim only when the two POSTs happen to overlap
File: e2e/onboarding.spec.ts:710-728

### F-368 [P3] open - The 1-second apply timings are hard assertions in CI too
File: e2e/onboarding.spec.ts:725, :738

### F-370 [P3] open - An apply that loses an address race with a concurrent page create answers 500
File: app/features/ai/apply-run.server.ts:36, :52

### F-372 [P3] unverified - Home's loader opens up to nine inSite transactions per load against a pool of five
File: app/features/admin-shell/home.tsx (loader); app/lib/db.server.ts:5

### F-373 [P3] open - design.md's AI-drafting row still says the first page is badged Home page and a failed apply is an alert banner
File: blueprint/context/design.md:240

### F-374 [P3] unverified - The 390px test is titled "the actions do not wrap", but the row probably does wrap; it checks only the link's own height
File: e2e/onboarding.spec.ts:504

### F-377 [P3] fixed - Home's action refuses a non-admin without logging it
File: app/features/admin-shell/home.tsx:103

### F-378 [P3] open - Publish website's gate and update are separate statements
File: app/features/admin-shell/home.tsx:106-111; app/features/content/entries.server.ts (`publishDraftPages`)

### F-387 [P3] open - Two step 3 assertions cannot fail on what they claim
File: e2e/onboarding.spec.ts:~1018 (choices kept), ~951 (Finish with Let the AI choose)

### F-388 [P3] open - The keyboard test focuses the radios by script, so keyboard reach is not shown
File: e2e/onboarding.spec.ts (step 3 keyboard test: `ai.focus()`, `modern.focus()`)

### F-392 [P3] open - The AI swatch's hex sits off-centre under its dot now that "Suggested by AI" is under it
File: app/features/settings/brand-fields.tsx:194-199; app/features/settings/brand-fields.module.css:100

### F-393 [P3] open - "Two starts for one site at the same moment" no longer checks the refusal's reason
File: app/features/ai/run-generation.test.ts:202-214

### F-397 [P3] open - The email-off notice, both Settings hints and the failed-SMTP path have no test
File: app/features/contact/messages.tsx; app/features/settings/settings.tsx; app/features/contact/notify-contact.server.ts
