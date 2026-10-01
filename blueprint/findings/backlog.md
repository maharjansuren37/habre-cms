# Findings backlog

> Unresolved P3s moved out of the loaded index - by `ship`, or in the one-off
> migration to the index format (2026-09-23). Not loaded. Each entry is
> `blueprint/findings/<ID>.md`; `review` still closes them here, and `spec`
> offers a tidy item at five or more.

### F-86 [P3] open - `public-site.spec.ts`'s home-page "newest first" test is a second instance of F-78's race, on a different query
File: e2e/public-site.spec.ts:23-37 ("the home page lists only published posts, newest first")

### F-84 [P3] open - `SecurityEvent`'s new `role` field is a bare `string`, though `requireRole` always has the real `Role` type in hand
File: app/lib/security-log.server.ts:16; app/features/auth/require-role.server.ts:27

### F-83 [P3] unverified - Item 6a's pages screens reproduce three pre-existing unverified/open posts accessibility findings
File: app/features/content/page-list.tsx:69-98 (filter tabs, search form); app/features/admin-shell/layout.tsx:39-61 (nav)

### F-79 [P3] unverified - A captioned image's alt text is announced twice in a row by a screen reader
File: app/features/blocks/render.tsx:38-52 (the `image` case)

### F-78 [P3] open - `manage-posts.spec.ts`'s "editor sees all posts" count races against every other spec file's own test data under parallel workers
File: e2e/manage-posts.spec.ts:29-53 ("the list is scoped by role, and the tabs' counts match")

### F-71 [P3] open - A cookie comment now describes a reality the hostname split already removed
File: app/features/auth/session-cookie.server.ts:9-12

### F-50 [P3] open - The stored shape is less canonical than the contract says it is
File: app/features/blocks/inline-runs.ts:56-71 (`runsSchema`); blueprint/context/current-work.md *Data and contracts* and step 1

### F-51 [P3] open - An empty list block refuses the whole save, with a raw Zod message
File: app/features/blocks/blocks.ts:38 (`items: z.array(runsSchema).min(1)`), with the empty item dropped at :166

### F-52 [P3] unverified - F-43's "native Ctrl+B does nothing" rests on one manual observation, and the mechanism argues against it
File: app/features/blocks/editor.client.tsx:52-58; e2e/inline-formatting.spec.ts:115-140

### F-38 [P3] open - Duplicate block ids are accepted, and ids are unconstrained
File: app/features/blocks/blocks.ts:16, 45

### F-39 [P3] open - The body cap and the block limits disagree, and the refusal destroys the draft
File: app/features/content/post-form-input.ts:7, app/features/content/post-edit.tsx:37

### F-31 [P3] unverified - The editor placeholder may never appear
File: app/features/blocks/editor.client.tsx:42 (`placeholder: "Write your post…"`)

### F-26 [P3] open - `/admin/posts/new` has no loader, so a client-side navigation skips the auth check
File: app/features/content/post-new.tsx:9

### F-27 [P3] open - The address lookup scans rather than using the index
File: app/features/content/entries.server.ts:46-48

### F-23 [P3] open - The proxied test port is written twice
File: e2e/forwarded-proto.spec.ts:8-9, playwright.config.ts:6

### F-19 [P3] open - The one migration has no reverse, and nothing says that is intended
File: db/migrations/0001_users.sql:1

### F-20 [P3] open - Root can still log in over SSH with a key
File: ocwebserver `/etc/ssh/sshd_config` (`permitrootlogin without-password`)

### F-07 [P3] fixed - Without X-Forwarded-For every login shares one rate-limit bucket
File: app/features/auth/client-ip.ts:10

### F-13 [P3] unverified - One host with a routed IPv6 /48 still gets tens of thousands of rate-limit keys, so it can hold both password slots
File: app/features/auth/client-ip.ts:28 (`/64` key), app/features/auth/login-rate-limit.server.ts:25 (`createInFlightLimit(2)`); F-11's accepted residual

### F-55 [P3] open - The list's "Last changed" date is formatted in the server's timezone, not the reader's
File: app/features/content/post-list.tsx:175-181 (`formatUpdatedAt`)

### F-56 [P3] open - A page number past the last page shows "no matches" with no way back
File: app/features/content/post-list.tsx:94-118

### F-58 [P3] open - `requireUser` runs twice on the delete confirmation route
File: app/features/content/post-delete.tsx:11

### F-59 [P3] open - Every login costs an extra redirect hop through `/admin`
File: app/features/auth/safe-redirect.ts:1, app/features/auth/login.tsx:29

### F-61 [P3] open - Deleting a post loses the reader's place in the list
File: app/features/content/post-delete.tsx:43

### F-62 [P3] open - The search box has no submit control
File: app/features/content/post-list.tsx:81-93

### F-63 [P3] unverified - Two possible screen-reader gaps in the new list and delete flow
File: app/features/content/post-list.tsx:61-67 (filter tabs), app/features/admin-shell/layout.tsx:36-43 (nav)

### F-64 [P3] open - Two screenshots in the reference folder show a stale, pre-filter version of the list
File: blueprint/reference/3-manage-posts/list-light.png, list-dark.png

### F-93 [P3] open - The settings form silently shows and re-saves stale defaults if `useRouteLoaderData`'s hardcoded route id ever stops matching
File: app/features/settings/settings.tsx:59-60

### F-95 [P3] open - A page deleted after being linked reverts its row to "No page" with no visible warning, and blocks Save on a row the admin never touched
File: app/features/settings/settings.tsx:222-231 (the page `<select>`'s `defaultValue={row.pageId}`); app/features/settings/navigation-form-input.ts:102-104 (`draftRowsToNavItems`'s "neither" refusal)

### F-96 [P3] open - `navigation` is trusted as `NavItem[]` on read with no format guard, unlike `blocks` - a malformed value would 500 the one page that could fix it
File: app/features/settings/settings.server.ts:19-32 (`getSiteSettings`); app/features/settings/navigation-form-input.ts:11-17 (`navItemsToDraftRows`); app/features/public-site/layout.tsx:16-23 (`resolveNavigation`)

### F-98 [P3] open - `README.md` describes the project as it was after item 3, and does not mention items 4-8 at all
File: README.md:9-13

### F-99 [P3] open - `CHANGELOG.md` stops at the item-3 release; item 4's production deploy and items 5-8 are unrecorded
File: CHANGELOG.md:7-12

### F-101 [P3] open - Two security-event log lines still record the raw `.data` path
File: app/root.tsx:50, app/features/auth/require-role.server.ts:26

### F-102 [P3] open - The CSP browser test is described as covering more screens than it visits
File: app/lib/zod-jitless.client.ts:8-9; e2e/content-security-policy.spec.ts:148

### F-104 [P3] open - `post.tsx` still has its own copy of the image lookup that `resolvePageMedia` now shares
File: app/features/public-site/post.tsx:21-34

### F-107 [P3] open - A Save with no `homePageId` field silently resets `/` to the latest posts
File: app/features/settings/settings.tsx:57

### F-108 [P3] open - Public loader data now carries entry ids and the home page's id, including a draft's
File: app/features/content/entries.server.ts:317-326; app/features/public-site/layout.tsx:30

### F-111 [P3] open - The placeholder's site-title test uses the default title, which is also the code's fallback, so it cannot catch a broken title lookup
File: e2e/public-site.spec.ts:44-57; app/features/public-site/home.tsx:39-41

### F-117 [P3] open - The settings save reads a request body of any size
File: app/features/settings/settings.tsx:53-54

### F-118 [P3] open - The home placeholder keeps its own "Habre CMS" fallback beside the helper's constant
File: app/features/public-site/home.tsx:42

### F-120 [P3] fixed - A page editor opened before the deploy cannot save, and its message says nothing to do
File: app/features/blocks/blocks.ts (`fromEditorJsSections`, `UNREADABLE_SHAPE`)

### F-121 [P3] fixed - The design record says focus lands on the next section after a remove; the code lands on the previous one when the last is removed
File: blueprint/context/design.md (*Sections*); app/features/blocks/sections-editor.client.tsx (`remove`)

### F-127 [P3] open - The hero parser's "character that cannot be saved" refusal has no test
File: app/features/blocks/blocks.ts (`heroFromFields`, now `slotSectionFromFields`; applies to the call to action too)

### F-128 [P3] open - Hero-named identifiers now serve both ready-made kinds
File: app/features/blocks/blocks.ts:456-458; app/features/blocks/sections-editor.client.tsx (HERO_FIELDS, HeroForm); sections-editor.module.css (.hero*)

### F-129 [P3] open - `render.tsx` keeps an import this item made unused
File: app/features/blocks/render.tsx:4
