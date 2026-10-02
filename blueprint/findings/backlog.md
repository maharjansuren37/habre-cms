# Findings backlog

> Unresolved P3s moved out of the loaded index - by `ship`, or in the one-off
> migration to the index format (2026-09-23). Not loaded. Each entry is
> `blueprint/findings/<ID>.md`; `review` still closes them here, and `spec`
> offers a tidy item at five or more.

### F-86 [P3] fixed - `public-site.spec.ts`'s home-page "newest first" test is a second instance of F-78's race, on a different query
File: e2e/public-site.spec.ts:23-37 ("the home page lists only published posts, newest first")

### F-84 [P3] closed - `SecurityEvent`'s new `role` field is a bare `string`, though `requireRole` always has the real `Role` type in hand
File: app/lib/security-log.server.ts:16; app/features/auth/require-role.server.ts:27

### F-83 [P3] unverified - Item 6a's pages screens reproduce three pre-existing unverified/open posts accessibility findings
File: app/features/content/page-list.tsx:69-98 (filter tabs, search form); app/features/admin-shell/layout.tsx:39-61 (nav)

### F-79 [P3] deferred - A captioned image's alt text is announced twice in a row by a screen reader
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

### F-147 [P3] open - Stale contrast figures and test counts in comments and docs
File: app/features/content/entry-list.module.css:218,224; app/features/users/user-list.module.css:86; app/features/content/entry-delete.module.css:28; app/features/media/media-delete.module.css:35; app/app.css:4-5; AGENTS.md:267; blueprint/context/needs-you.md:171

### F-148 [P3] open - The heading font is applied rule by rule, with no global rule
File: app/app.css (no h1-h4 rule); prototypes/components.css:436

### F-149 [P3] unverified - The production build polyfills `light-dark()`, so a `color-scheme` set outside Vite's CSS will not switch roles
File: app/app.css (`:root` roles); build output

### F-150 [P3] unverified - The font face declares only `format("woff2-variations")`
File: app/app.css:13-19
