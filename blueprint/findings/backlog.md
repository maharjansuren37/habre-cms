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

### F-49 [P3] fixed - F-47 closed U+0000 but not its class: a lone surrogate still answers 500
File: app/features/blocks/inline-runs.ts:43-46 (`runSchema.text`), reached from app/features/content/entries.server.ts:103 (`sql.json`); same hole on `blockId` (app/features/blocks/blocks.ts:16)

### F-50 [P3] open - The stored shape is less canonical than the contract says it is
File: app/features/blocks/inline-runs.ts:56-71 (`runsSchema`); blueprint/context/current-work.md *Data and contracts* and step 1

### F-51 [P3] open - An empty list block refuses the whole save, with a raw Zod message
File: app/features/blocks/blocks.ts:38 (`items: z.array(runsSchema).min(1)`), with the empty item dropped at :166

### F-52 [P3] unverified - F-43's "native Ctrl+B does nothing" rests on one manual observation, and the mechanism argues against it
File: app/features/blocks/editor.client.tsx:52-58; e2e/inline-formatting.spec.ts:115-140

### F-53 [P3] fixed - `design.md` asserts a boundary contrast that was never measured
File: blueprint/context/design.md, *Inline formatting*

### F-41 [P3] fixed - `flattenListItems` recurses without a depth bound, so a crafted body answers 500
File: app/features/blocks/blocks.ts:88-101, called at :141

### F-38 [P3] open - Duplicate block ids are accepted, and ids are unconstrained
File: app/features/blocks/blocks.ts:16, 45

### F-39 [P3] open - The body cap and the block limits disagree, and the refusal destroys the draft
File: app/features/content/post-form-input.ts:7, app/features/content/post-edit.tsx:37

### F-40 [P3] fixed - `updateDraft` does not enforce that the entry is a draft
File: app/features/content/entries.server.ts:89-98

### F-31 [P3] unverified - The editor placeholder may never appear
File: app/features/blocks/editor.client.tsx:42 (`placeholder: "Write your post…"`)

### F-26 [P3] open - `/admin/posts/new` has no loader, so a client-side navigation skips the auth check
File: app/features/content/post-new.tsx:9

### F-27 [P3] open - The address lookup scans rather than using the index
File: app/features/content/entries.server.ts:46-48

### F-23 [P3] open - The proxied test port is written twice
File: e2e/forwarded-proto.spec.ts:8-9, playwright.config.ts:6

### F-24 [P3] open - `@react-router/node` may now be an unused dependency
File: package.json:24

### F-19 [P3] open - The one migration has no reverse, and nothing says that is intended
File: db/migrations/0001_users.sql:1

### F-20 [P3] open - Root can still log in over SSH with a key
File: ocwebserver `/etc/ssh/sshd_config` (`permitrootlogin without-password`)

### F-07 [P3] fixed - Without X-Forwarded-For every login shares one rate-limit bucket
File: app/features/auth/client-ip.ts:10

### F-13 [P3] unverified - One host with a routed IPv6 /48 still gets tens of thousands of rate-limit keys, so it can hold both password slots
File: app/features/auth/client-ip.ts:28 (`/64` key), app/features/auth/login-rate-limit.server.ts:25 (`createInFlightLimit(2)`); F-11's accepted residual

### F-54 [P3] fixed - Four bare element selectors in `post-list.module.css` leak out of the CSS Module
File: app/features/content/post-list.module.css:90,96,105,111,115

### F-55 [P3] open - The list's "Last changed" date is formatted in the server's timezone, not the reader's
File: app/features/content/post-list.tsx:175-181 (`formatUpdatedAt`)

### F-56 [P3] open - A page number past the last page shows "no matches" with no way back
File: app/features/content/post-list.tsx:94-118

### F-58 [P3] open - `requireUser` runs twice on the delete confirmation route
File: app/features/content/post-delete.tsx:11

### F-59 [P3] open - Every login costs an extra redirect hop through `/admin`
File: app/features/auth/safe-redirect.ts:1, app/features/auth/login.tsx:29

### F-60 [P3] fixed - The list's SQL fragments use unqualified column names inside a JOIN
File: app/features/content/entries.server.ts:46-48 (`ownedBy`), 146-147 (`statusFilter`, `searchFilter`)

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

### F-97 [P3] fixed - The users list's Active/Deactivated badge is a new status-badge variant `design.md` doesn't record
File: app/features/users/user-list.tsx:60-70; app/features/users/user-list.module.css:76-101; blueprint/context/design.md:116-118

### F-98 [P3] open - `README.md` describes the project as it was after item 3, and does not mention items 4-8 at all
File: README.md:9-13

### F-99 [P3] open - `CHANGELOG.md` stops at the item-3 release; item 4's production deploy and items 5-8 are unrecorded
File: CHANGELOG.md:7-12
