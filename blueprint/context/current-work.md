# Feature: Sites and memberships

**From build plan:** item 15a
**Type:** Feature
**Verified:** not yet
**Reviewed:** not yet

## Goal

Make every post, page, image, setting and member belong to a site, and make
it impossible for one site to read or write another's rows. The app enforces
this, and PostgreSQL row-level security enforces it again (D151, D152). Today's
installation becomes site 1, with its users as members in their current roles
(D162). This is the tenancy foundation that signup (15b), subdomains (16) and
every later per-site feature build on. It adds no screen and no signup.

## In scope

- **Two database roles (D152).** The owner role `habre_cms` keeps owning the
  tables and runs migrations. A new app role, `habre_cms_app`, can read and
  write rows but cannot change the schema, and is subject to row-level
  security. `DATABASE_URL` becomes the app role's connection string. A new
  `DATABASE_OWNER_URL` is used by `npm run db:migrate` and the browser tests'
  database helpers.
- **`db/roles.sql`**, run as the superuser, creates the app role and its grants.
  It is idempotent and used in four places: `db/dev/init.sh` (a new
  development volume), the CI `e2e` job, `deploy/setup-server.sh` (a fresh
  server), and once by hand on an existing database (the dev machine, and
  production at the v1 deploy).
- **The schema, as expand then contract:**
  - **`0010_sites.sql`** (expand):
    - creates `sites` and `site_members`;
    - creates site 1 and copies every user's role and deactivation into a
      membership;
    - adds `site_id` to `entries`, `media` and `site_settings`, filled with
      site 1, with the keys that already hold for today's rows.
    Each new `site_id` column gets site 1's id as a **temporary default**,
    `users.role` becomes nullable, and `site_settings.id` stops being the key.
    Code not yet converted keeps working, and a second site can exist in
    tests.
  - **`0011_site_isolation.sql`** (contract):
    - gives any user still without a membership one, from `users.role`;
    - adds the foreign keys through `site_members`;
    - drops the temporary defaults;
    - drops `users.role` and `users.deactivated_at`;
    - drops `site_settings.id`;
    - enables row-level security on `entries`, `media` and `site_settings`.
- **`inSite(siteId, run)`** in `app/lib/db.server.ts`: one transaction that
  sets `app.site_id` for the transaction only, then runs every query inside
  it. Every site-owned query goes through it **and** also filters on
  `site_id` itself (the two guards of D151).
- **The admin scoped by membership.** Every admin request already loads the
  user. It now loads their membership too, and the role and site come from the
  membership. Login and the session check refuse anyone without an active
  membership. `SessionUser` gains `siteId`.
- **Every site-owned data function takes the site:**
  - `entries.server.ts` (14 functions)
  - `media.server.ts` (5)
  - `settings.server.ts` (2)
  - `document-media.server.ts` (1)

  Each takes `siteId` first. Admin routes pass the member's site; public routes
  pass the public site.
- **Users screens work on this site's members:** list, add, change role, reset
  password, deactivate and reactivate. A member of another site is Not Found.
  Adding a member creates the user and the membership in one transaction, and
  an email already in use anywhere is refused, as today (D159).
- **`create-admin`** makes the new account an admin member of site 1.
- **The public host serves site 1** until item 16 resolves sites by host.
- **New uploads are stored under `sites/<site id>/`** in R2. Existing objects
  keep their keys.
- **Tests that use two sites** (quality bar, D151): at the database level and
  through the browser.

## Out of scope

- Signup, verification, invites, choosing an address, and the email module.
  These are 15b.
- Password reset by email (15c) and the storage cap (15d).
- `site_domains`, host resolution, the wildcard certificate and
  `suspend-site`. These are 16, and so is D162's `surenmaharjan.fyi` domain
  row: 15a has no table to put it in, and nothing reads it until 16.
- `email_tokens` and `invites`, which arrive with 15b and 15c.
- Billing columns on `sites` (21) and `site_settings`' later columns (17, 18a,
  20).
- Moving existing R2 objects under `sites/1/`. Their keys stay valid, and
  `storage_key` stays unique across all sites.
- F-103, browser specs sharing one `site_settings` row. It is now site 1's row
  and the race is unchanged. It goes away once specs can use their own site
  through a host (16).
- Any change to what a screen shows. No copy changes, and no site name in the
  admin.

## Build steps

- [x] **Step 1 - The app role** - add `db/roles.sql`, a psql script run as the superuser with `-v app_password=...`. It does four things:
  - creates `habre_cms_app LOGIN` if absent, using `\gexec`, so a second run changes nothing;
  - grants it `CONNECT` on the database and `USAGE` on schema `public`;
  - grants it `SELECT, INSERT, UPDATE, DELETE` on all tables and `USAGE, SELECT` on all sequences in `public`;
  - runs `ALTER DEFAULT PRIVILEGES FOR ROLE habre_cms IN SCHEMA public`, so tables made by later migrations are granted too.

  Wire it into four places:
  - **`db/dev/init.sh`:** a new `HABRE_APP_DB_PASSWORD` variable, set in `compose.yaml` from `DEV_APP_DB_PASSWORD`.
  - **CI's `e2e` job:** run it after `init.sh`, with the throwaway password in the workflow. `DATABASE_URL` becomes the app role's URL, and `DATABASE_OWNER_URL` is added.
  - **`deploy/setup-server.sh`:** generate a second password and write both URLs to `production.env`.
  - **`.env.example`:** add `DATABASE_OWNER_URL` and `DEV_APP_DB_PASSWORD`, and say what each URL is for.

  `db/migrate.ts` connects with `DATABASE_OWNER_URL`, through its own Zod schema; the web app never requires it. `e2e/helpers/users.ts` `withDatabase` connects with `DATABASE_OWNER_URL`. `AGENTS.md`'s Commands and Environments rows name both URLs. *Done when:*
  - Run as the app role, `psql "$DATABASE_URL" -c 'create table t (x int)'` fails with *permission denied for schema public*, and `select count(*) from entries` succeeds.
  - A second `db/roles.sql` run against the dev database prints no error and changes nothing.
  - `npm run db:migrate` reports no pending migrations as the owner.
  - `npm run verify` and the full `npm run test:e2e` pass, with the app connected as `habre_cms_app`.
- [x] **Step 2 - Sites, memberships and `site_id` (expand)** - add `db/migrations/0010_sites.sql`, following *Data and contracts*:
  - creates `sites` and `site_members`;
  - inserts site 1 with the subdomain `surenmaharjan` (see Decisions) and copies each user's `role` and `deactivated_at` into a membership of site 1;
  - adds `site_id uuid not null` to `entries`, `media` and `site_settings`, filled with site 1's id and given it as a temporary default (set through a `DO` block, since the id is generated);
  - changes `entries` unique `(type, slug)` to `(site_id, type, slug)`;
  - adds `unique (site_id, id)` to `entries` and `media`;
  - makes `site_id` the primary key of `site_settings`, drops its `id = 1` check, and makes `id` nullable with no default. Site 1's row keeps `id = 1`, so an unconverted `where id = 1` query reaches only site 1, and a test site's row has none;
  - re-points `logo_media_id` and `home_page_id` at `(site_id, …)`, with `on delete set null (column)`;
  - drops `not null` from `users.role`, so step 3 can create a user without it.

  The foreign keys through `site_members` wait for step 8, because `create-admin` still makes users without a membership until step 3. Nothing reads the new columns yet. *Done when:*
  - After `npm run db:migrate` on a dev database holding users, entries and media, `select count(*) from users` equals `select count(*) from site_members where site_id = <site 1>`, and every membership's role and deactivation match its user's.
  - No row of the three tables has a `site_id` other than site 1's.
  - A second `sites` row with its own `site_settings` row can be inserted, and `update site_settings set site_title = 'x' where id = 1` changes only site 1's row (statements in the step's notes).
  - `npm run verify` and the full `npm run test:e2e` pass, unchanged.
- [x] **Step 3 - Sign-in from the membership** - change `users.server.ts`: `findUserById` and `findUserByEmail` return the user joined to their one membership (`siteId`, `role`, `deactivatedAt`, read from `site_members`). A user without a membership is returned as having none. The other Users functions move to the membership in the same step - `listUsers` reads the role and deactivation from `site_members`, `updateUserRole`, `deactivateUser` and `reactivateUser` write it there, and `createUser` takes the creating admin's `user.siteId` and makes the membership in the same transaction - because sign-in reading the membership while the Users screen still wrote `users.role` would break role changes and deactivation between steps 3 and 4 (found at build).

  `checkSessionUser` refuses a missing membership (reason `no_membership`) as well as a deactivated one, and `SessionUser` gains `siteId`. Login's `checkCredentials` refuses a user with no membership the same way it refuses a deactivated one: same message, same scrypt work, logged as `login_failed` with reason `no_membership`. `scripts/create-admin.ts` makes the account an admin member of site 1, the oldest site, with the user and the membership in one transaction.

  Add `e2e/helpers/sites.ts`, connecting as the owner:
  - `createSite(subdomain)` makes the site and its settings row;
  - `createSiteAdmin(siteId)`;
  - `deleteSite(siteId)` removes rows in dependency order.

  The e2e helpers `setRole` and `deactivateUser` write to `site_members`, and `deleteTestUser` deletes the membership first. *Done when:*
  - Unit tests on `checkSessionUser` show that a missing membership, a deactivated membership and a stale `token_version` are each refused, and that an active one returns the membership's role and site.
  - A browser test: a user whose membership is removed, and one deactivated through `site_members`, can no longer log in or use an open session.
  - An admin of a second site, made by `createSiteAdmin`, can log in.
  - The existing login, logout and roles browser specs pass, and logging in from a protected page lands back on it.
- [x] **Step 4 - Users screens on this site's members** - `listUsers`, `updateUserRole`, `deactivateUser`, `reactivateUser`, `setUserPassword` and a find-member-for-edit function take `siteId` and act only on that site's members (step 3 already moved them onto `site_members`). Each one that changes access bumps `users.token_version`. `createUser` becomes `createMember(siteId, ...)`: the user and the membership in one transaction, with an email already in use anywhere refused, as today. The users routes pass `user.siteId`. *Done when:*
  - A browser test: a site-2 admin opening `/admin/users/<site-1 member id>` gets Not Found, posting a role change for that id changes nothing, and their Users list shows only site 2's members.
  - A member added by a site-2 admin belongs to site 2 only.
  - The existing users browser specs pass.
- [x] **Step 5 - `inSite` and entries scoped** - add `inSite<T>(siteId: string, run: (tx: TransactionSql) => Promise<T>): Promise<T>` to `app/lib/db.server.ts`. It calls `sql.begin`, then `select set_config('app.site_id', ${siteId}, true)`, then `run(tx)`.

  Every function in `entries.server.ts` takes `siteId` first, runs inside `inSite`, and filters on `e.site_id = ${siteId}` (or the unaliased form). Specifically:
  - `createDraft` inserts `site_id`, and its slug search is per site;
  - `findPublishedEntry`'s home-page subquery and `findHomePage`'s join read `site_settings` by `site_id`, not `id = 1`;
  - `saveEntry`'s stale-or-missing follow-up runs in the same transaction.

  Add `app/features/public-site/public-site.server.ts`, whose `findPublicSiteId()` returns the oldest site's id (`order by created_at, id limit 1`), with a comment that item 16 replaces it with a lookup by host. Public routes use it, and admin routes use `user.siteId`. *Done when:*
  - A browser test with two sites shows that a site-2 admin opening `/admin/posts/<site-1 post id>` and `/admin/pages/<site-1 page id>` (the edit routes; the spec first said `/edit`, corrected at build) gets Not Found, and that their posts and pages lists show none of site 1's.
  - A site-1 page and a site-2 page can share the slug `about`.
  - The public `/about` shows site 1's page.
  - Every existing content and public-site browser spec passes.
- [ ] **Step 6 - Media and settings scoped** - every function in `media.server.ts`, `settings.server.ts` and `document-media.server.ts` takes `siteId` first, runs inside `inSite` and filters on `site_id`. Specifically:
  - `insertMedia` inserts `site_id`;
  - `saveSiteSettings` keeps its one transaction, now `inSite`'s;
  - `getSiteSettings` reads by `site_id`.

  `generateStorageKey(siteId, extension)` returns `sites/<siteId>/<uuid>.<ext>`, with a unit test. The upload, delete and picker routes, the admin shell's layout loader and the public layout pass the site. *Done when:*
  - A browser test with two sites shows four things for a site-2 admin:
    - the media library and the editor's picker show none of site 1's images;
    - `/admin/media/<site-1 media id>/delete` is Not Found;
    - their Settings shows site 2's title, not site 1's;
    - saving site 2's settings leaves site 1's title unchanged.
  - A new upload's `storage_key` starts with `sites/<site id>/`, and the image renders on a published page. This needs real R2, so it runs locally and is skipped in CI with `skipWithoutStorage`.
  - Every existing media, settings and navigation browser spec passes.
- [ ] **Step 7 - Test helpers name the site** - every e2e helper that inserts or reads site-owned rows names `site_id` explicitly, so none relies on the temporary default. That covers `users.ts` (`createDraftFor`, `entriesBy`, `storedEntry`, …), `media.ts`, `site-settings.ts` (`where site_id = <site 1>`, not `id = 1`), `documents.ts`, `sites.ts`, and the specs that query directly: `home-page`, `site-navigation`, `document-render`. *Done when:* `grep -n "id = 1" e2e` finds no settings query, and the full `npm run test:e2e` passes.
- [ ] **Step 8 - Foreign keys and row-level security (contract)** - add `db/migrations/0011_site_isolation.sql`. It does seven things:
  - inserts a site-1 membership from `users.role` and `users.deactivated_at` for any user still without one: users made between steps 2 and 3, in any environment;
  - replaces `entries.author_id -> users` and `media.uploaded_by -> users` with `(site_id, author_id)` and `(site_id, uploaded_by) -> site_members (site_id, user_id)`;
  - drops the three temporary defaults;
  - drops `users.role` and `users.deactivated_at`;
  - drops `site_settings.id`, making `site_id` its primary key;
  - enables row-level security on `entries`, `media` and `site_settings`, without `FORCE` (see Decisions);
  - creates one policy per table, `site_isolation`, for all commands. Both `using` and `with check` are `site_id = nullif(current_setting('app.site_id', true), '')::uuid`.

  Add `e2e/site-isolation.spec.ts`, a database-only Playwright spec with no page, connecting as the app role with `DATABASE_URL`. *Done when:*
  - Inserting an entry whose `author_id` is not a member of its `site_id` fails with a foreign-key violation.
  - As the app role with no site set, `entries`, `media` and `site_settings` each return 0 rows while each holds rows of two sites.
  - With `app.site_id` set to site 2, only site 2's rows come back.
  - Inserting a row with site 1's `site_id` while site 2 is set fails with *new row violates row-level security policy*.
  - As the owner, every row is visible (backups and migrations).
  - The two-site browser tests from steps 3-6 and the full `npm run test:e2e` pass.
  - `npm run verify` passes.
- [ ] **Step 9 - Prove the bar, and the docs** - time the public pages: 200 requests each to `/`, one published post and one published page against `npm start` on the dev machine, with server-side time from a `curl -w '%{time_starttransfer}'` loop, which is close enough for a single box. Then update the docs:
  - `dev-notes/status.md`'s release procedure: migrate uses `DATABASE_OWNER_URL`, and run `db/roles.sql` once before 0010;
  - `coding-standards.md`'s note on data modules: every site-owned query goes through `inSite` and names `site_id`.

  *Done when:*
  - The p95 of each route is under 500 ms (quality bar), recorded in the step's notes with the command.
  - `AGENTS.md`, `.env.example`, `status.md` and `coding-standards.md` name both database URLs and the `inSite` rule.

## Files and areas

- **New:**
  - `db/roles.sql`
  - `db/migrations/0010_sites.sql`, `db/migrations/0011_site_isolation.sql`
  - `app/features/public-site/public-site.server.ts`
  - `e2e/helpers/sites.ts`, `e2e/site-isolation.spec.ts`
  - a two-site browser spec (`e2e/sites.spec.ts`)
- **Database access:**
  - `app/lib/db.server.ts` (`inSite`)
  - `db/migrate.ts`
  - `app/lib/database-env.server.ts` (unchanged schema; migrate has its own)
- **Data modules:**
  - `app/features/content/entries.server.ts`
  - `app/features/media/media.server.ts`, `storage-key.ts`
  - `app/features/settings/settings.server.ts`
  - `app/features/public-site/document-media.server.ts`
  - `app/features/users/users.server.ts`
- **Auth:**
  - `app/features/auth/session-check.ts`, `require-user.server.ts`
  - `login.tsx` (`checkCredentials`)
- **Routes** that call those functions:
  - content: `post-*`, `page-*`
  - media: `media-list`, `media-delete`, `media-picker`
  - `settings.tsx`
  - users: `user-list`, `user-new`, `user-edit`
  - public site: `home`, `posts`, `post`, `page`, `layout`
  - `admin-shell/layout.tsx`
- **Scripts:** `scripts/create-admin.ts`
- **Setup and CI:**
  - `db/dev/init.sh`, `compose.yaml`
  - `.github/workflows/ci.yml`
  - `deploy/setup-server.sh`
  - `.env.example`
- **Tests:** e2e helpers (`users.ts`, `media.ts`, `site-settings.ts`, `documents.ts`) and three specs that query directly.
- **Docs:**
  - `AGENTS.md` (Commands, Environments)
  - `dev-notes/status.md`
  - `blueprint/context/coding-standards.md`

## Data and contracts

**Load-bearing** - 15b, 15c, 15d, 16 and 21 build on these shapes.

    sites
      id            uuid primary key default gen_random_uuid()
      subdomain     text not null unique
                    check (subdomain ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$')
      plan          text not null default 'free' check (plan in ('free', 'paid'))
      suspended_at  timestamptz
      created_at    timestamptz not null default now()
      updated_at    timestamptz not null default now()

    site_members
      site_id         uuid not null references sites (id) on delete restrict
      user_id         uuid not null references users (id) on delete restrict
      role            text not null check (role in ('admin', 'editor', 'author'))
      deactivated_at  timestamptz
      created_at      timestamptz not null default now()
      primary key (site_id, user_id)
      unique (user_id)        -- v1: one site per user (D159); dropped at Level 2

    entries        + site_id uuid not null references sites (id)
                   unique (site_id, type, slug)   -- replaces unique (type, slug)
                   unique (site_id, id)
                   foreign key (site_id, author_id) references site_members (site_id, user_id)
                   -- replaces the author_id -> users fk
    media          + site_id uuid not null references sites (id)
                   unique (site_id, id)
                   foreign key (site_id, uploaded_by) references site_members (site_id, user_id)
    site_settings  site_id uuid primary key references sites (id)   -- replaces id = 1
                   foreign key (site_id, logo_media_id) references media (site_id, id)
                     on delete set null (logo_media_id)
                   foreign key (site_id, home_page_id) references entries (site_id, id)
                     on delete set null (home_page_id)
    users          - role, - deactivated_at   (moved to site_members, 0011)

- **Every site has exactly one `site_settings` row, created with it.** 15b's
  signup creates both in its transaction, along with the membership. The
  `on delete set null (column)` form (PostgreSQL 15+) clears only the
  reference, never `site_id`.
- **Row-level security** applies to `entries`, `media` and `site_settings`.
  The policy is `site_id = nullif(current_setting('app.site_id', true), '')::uuid`
  for `using` and `with check`. With no site set, that is null, so no rows.
  Later site-owned tables (`contact_submissions`, `ai_runs`) get the same
  policy in the migration that creates them.
- **The setting `app.site_id`** is set only by `inSite`, and for one
  transaction only (`set_config(..., true)`). A pooled connection never
  carries it into another request.
- **`inSite(siteId, run)`** is the one way site-owned rows are reached from the
  app.
- **`SessionUser`** is `{ id, email, name, role, siteId }`. The role and site
  come from the membership on every request (D6).
- **The site of a request:** admin requests use `user.siteId`. Public requests
  use `findPublicSiteId()`, the oldest site, until 16.
- **Storage keys** for new uploads are `sites/<site id>/<uuid>.<ext>`.
- **Environment:**
  - `DATABASE_URL` is the app role's, read by the web app, `create-admin`, and
    the isolation spec.
  - `DATABASE_OWNER_URL` is the owner's, read by `db:migrate` and the e2e
    helpers.
  - `DEV_APP_DB_PASSWORD` is used by `compose.yaml` only.

## Testing

- **Unit tests (`npm test`, inside `verify`, no database):**
  - `checkSessionUser`'s membership cases;
  - `generateStorageKey`'s `sites/<id>/` prefix;
  - any pure helper the steps extract.
- **Browser tests (`npm run test:e2e`, locally and in CI's `e2e` job, which has
  the database):**
  - `e2e/sites.spec.ts`: two sites, each with an admin, checking every refusal
    in steps 3-6.
  - `e2e/site-isolation.spec.ts`: a database-only Playwright spec that opens no
    page, as the app role. It runs inside the existing `e2e` command, so CI
    runs it and `verify` does not need a database.
  - The upload-key test needs real R2, so it is skipped in CI with
    `test.skip(skipWithoutStorage)` and runs locally (needs-you's "Run the full
    browser suite locally").
- **Each two-site test makes its own site 2 and deletes it afterwards.** Site 1
  is never deleted.
- **Journey 2, Edit and publish (`design.md`),** is walked by the existing
  editor and publish browser specs at steps 5 and 8, both as a full page load
  and through the app's own navigation.
- **The whole existing suite passes at every step.** That is the regression
  proof that one site behaves exactly as before.
- **Steps 1 and 2 check migrations by hand** against the dev database, with the
  statements recorded in the step's notes. That is a migration's check, not a
  test file.

## Decisions

- **Site ids are UUIDs**, beating an integer "site 1". This follows 0001's
  convention, and ids appear in URLs and R2 keys, where a counter would show how
  many sites exist. "Site 1" is the name, not the id.
- **The app role is `habre_cms_app`, created by `db/roles.sql` run as the
  superuser, not by a migration.** The owner cannot create roles, and giving it
  `CREATEROLE` would hand the app's schema owner a power it never needs.
  Default privileges keep later tables granted without a migration naming the
  role.
- **`DATABASE_URL` stays the app's, and the owner gets a new
  `DATABASE_OWNER_URL`.** That beat renaming both: the web app's variable is
  unchanged, and only migrations and test setup need the owner.
- **Row-level security without `FORCE`.** The owner bypasses it, so
  migrations, backups and the test helpers see every row. The app never
  connects as the owner, which is the point of D152.
- **A transaction-local `app.site_id`, set by `inSite`.** It beat a
  session-level `SET`, which a pooled connection would carry into the next
  request, and a policy on a per-site database role, which means one role per
  site.
- **Every site-owned data function takes `siteId` as its first parameter**,
  and its query names `site_id` too. It beat putting the site on `Actor`,
  because public queries have no actor, and one signature rule for both sides
  is easier to review.
- **v1 enforces one membership per user with `unique (user_id)`.** It beat
  enforcing it only in code: with that index, "the user's membership" is a
  single row by construction. Level 2 drops the index.
- **Composite foreign keys through `site_members`.** An entry's author and a
  media's uploader must be members of that site. This beat the existing
  foreign keys to `users`, which would let a site's row name another site's
  member. Memberships are never deleted, so authorship survives deactivation
  as before.
- **Expand then contract (0010, then 0011).** Every build step leaves the app
  and the suite working. The temporary default exists only between steps 2 and
  8, on this branch. Nothing deploys before v1 is done (D163).
- **The public host serves the oldest site until item 16.** It beat an
  environment variable naming a site id, which would be one more production
  value for 16 to remove. 16 replaces `findPublicSiteId()` with a host lookup.
- **Existing R2 objects keep their keys, and only new uploads go under
  `sites/<id>/`.** It beat moving objects in a migration, which would be a
  script outside a transaction against a live bucket, for media 0009 already
  orphaned from content.
- **Site 1's subdomain is `surenmaharjan`.** Proposed: yours to change before
  `build`. Nothing serves it until item 16, and site 1 stays on its own domain.

## Production needs

- **Run `db/roles.sql` once on `ocwebserver`** as `postgres`, with a new
  generated app-role password, **before** `npm run db:migrate` applies 0010.
- **`/etc/habre-cms/production.env`:** `DATABASE_URL` changes to the
  `habre_cms_app` role, and the new `DATABASE_OWNER_URL` takes today's value.
  The deploy runs `db:migrate` with `DATABASE_OWNER_URL`.
- **Migrations `0010_sites.sql` and `0011_site_isolation.sql`** carry real rows
  (users into memberships). Rehearse both on a restored production backup
  before the v1 deploy (D162, D163). Neither can be rolled back by symlink once
  0011 drops `users.role`, the same as 0009.
- `pg_dump` runs as `postgres` and is unaffected.

## Behaviour changes

- New capability `sites`: an admin of one site gets Not Found for another site's post, page, image or member opened by id, and sees none of its rows in any list - Step 6
- New capability `sites`: with no site set, the database returns none of `entries`, `media` or `site_settings` to the app, and refuses a write into another site - Step 8
- New capability `sites`: two sites can each have a page at the same address - Step 5
- New capability `sites`: a person can sign in only while they hold an active membership, and their role is the membership's - Step 3
- New capability `sites`: a new upload is stored under `sites/<site id>/` - Step 6
- New capability `sites`: the public site shows the oldest site's content (until item 16) - Step 5

## Notes

- **`users` stays global, and `site_members` is a platform table without
  row-level security.** It is read at login, before a site is known. The app
  scopes it by `site_id` in every Users-screen query. Never let a Users
  function take a member id without a site id.
- **The site id never reaches a public page** (`public-site.1`), and neither
  does a membership.
- **`Promise.all` inside `inSite` runs on one connection.** postgres.js queues
  a transaction's queries, so `listEntries`'s three queries stay correct, just
  no longer concurrent. That is fine at this scale. Say so in a comment where
  it applies.
- **Migrations run as the owner, so they bypass row-level security.** The
  backfills in 0010 need that.
- **The dev machine needs `db/roles.sql` run once** against the existing
  volume, because `init.sh` only runs on a new one. Run it with
  `docker compose exec db psql -U postgres -d habre_cms -v app_password=...`
  after the `.env` values below exist (needs-you).
- **Unchanged:**
  - `requireRole` reads `user.role`, which now comes from the membership.
  - Its 404 refusal and logging (D69).
  - Security events. A role change already logs `role`, and adding `siteId` is
    left for 16, when there can be more than one live site.
- **React Router 8.4.0:** nothing here touches routing. Middleware and context
  are as today.
- **`erasableSyntaxOnly` holds.** Use no enums for roles or plans; use the
  existing union types.
