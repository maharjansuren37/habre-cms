# Feature: Delete your account

**From build plan:** item 15e2
**Type:** Feature
**Verified:** 2026-10-05, 6957e99a0e97, 29 of 29 proven
**Reviewed:** 2026-10-05, 9af7776c8841, repair commit 5d85c66 (re-review of F-263, F-265), every lens - 0 blocking

## Goal

Anyone signed in can delete their own account from Your account, without
asking an admin. Strangers sign up now (15b), so a person must be able to
leave and take their details with them. A member who is not the site's last
active admin leaves, and their posts, pages and images stay on the site,
credited to "Deleted account". The last active admin takes the site with
them: its content, images, settings and every other member's account.
Deletion is immediate (owner, 2026-10-05). Item 16 adds hosts and later
items add tables, so this item also sets the one place a site is deleted.

## In scope

- **A Delete account section on Your account** (`/admin/account`): an `h2`,
  one line saying what deleting does, and a **link** (it goes somewhere)
  "Delete your account" to the confirm screen.
- **The confirm screen, `/admin/account/delete`** (shell, every role). Its
  loader works out which of three cases applies; the page names what goes:
  - **Leaving** (not the site's last active admin): "You'll be signed out and
    can't sign in again. Your posts, pages and images stay on *address*,
    credited to Deleted account." One field: the current password. A
    danger button, **Delete my account**, and a Cancel link back to Your
    account.
  - **Taking the site** (the site's last active admin): "Your site *address*
    is deleted with your account: *n* posts, *n* pages, *n* images, and the
    accounts of *names* (or: no other members)." Two fields: **Type
    *address* to confirm** (trimmed, compared case-insensitively) and the
    current password. The same button and Cancel.
  - **Refused** (the last active admin of the **oldest site**, which the
    public domain serves until item 16): no form. "This is the platform's
    main site, so it can't be deleted yet. Make another member an admin
    first, then delete your account." A POST is refused the same way.
- **The current password** goes through 15e1's `withCurrentPassword` gate:
  one `passwordCheckSlots` slot, and a wrong one counts against
  `emailLoginLimiter` (the 15e1 messages, below the field or as the form
  error).
- **The form says which case it was loaded as** (`expect=leave|site`). The
  transaction checks again under a lock on the site's row and refuses when
  the case has changed ("Something changed on your site. Check what will be
  deleted and try again.", nothing deleted). Without that check, a page
  loaded as *leaving* could delete a whole site without the address being
  typed. It also settles two admins deleting at once: the second finds it
  is now the last one and is refused.
- **Leaving, one transaction** (inside `inSite`): lock the site row and the
  user row, check again, delete the membership (0014's foreign keys clear
  `entries.author_id` and `media.uploaded_by`), delete the user (their
  `email_tokens` cascade).
- **Taking the site, one transaction** (inside `inSite`): lock the site row,
  check again, read the other members' ids, names and emails, then delete
  the site's `site_settings`, `entries`, `media` (returning the storage
  keys), every `site_members` row, every member's `users` row and the
  `sites` row. The address can be taken again straight away.
- **After the commit:**
  - the R2 objects of the deleted media are removed. This does not hold up
    the response. Each failure is logged with its key, which names only the
    site's id.
  - with email on, every other member gets a notice: their site at
    *address* was deleted by its admin, and their account with it.
- **Afterwards**, the session cookie is cleared and the person lands on
  `/login?deleted=1`, where a `role="status"` banner says "Your account is
  deleted." The query value is a fixed flag, never text from the URL.
- **"Deleted account" wherever an author or uploader is shown:**
  - the posts and pages lists, and Media's "uploaded by" line, show
    "Deleted account";
  - the public post byline shows only the date when its author is deleted;
  - the five queries that inner-join `users` become left joins, so a
    deleted author's entries and images stay listed and stay public.
- **Security log:** `account_deleted` with `userId`, `siteId` and
  `siteDeleted`. A wrong password uses 15e1's `account_password_refused`.
  `email_send_failed` gains the purpose `site_deleted_notice`. Never an
  address.

## Out of scope

- **A grace period or restore** - deletion is immediate in v1 (owner,
  2026-10-05). A grace period would be its own item.
- **An export before deleting** - no export exists. It would be its own item.
- **An admin deleting another member's account** - admins keep deactivate
  (D159). This item is only about your own account.
- **Handing the site to another member** - the last admin can promote
  someone on Users first. There is no transfer flow.
- **A notice to the person deleting** - they are on the screen. A notice
  would go to an address whose account is gone.
- **Sweeping R2 for objects a failed delete left behind** - logged only.
  `optimise-media` (17b) or a later script can sweep `sites/<id>/`.
- **Deleting the oldest site** - refused until item 16 serves sites by host.
- **The account menu** - item 21, as in 15e1.

## Design reference

No mockup. The confirm screen has the shape of Media's delete confirmation
(`app/features/media/media-delete.tsx`): a heading naming the thing, what
happens, one danger button and a Cancel link. Its fields are 15e1's (labels,
errors below the field, `aria-invalid` / `aria-describedby`, "Deleting…"
while pending). The danger button is `button.module.css`'s `.danger`, red
from `--color-danger` (design.md: Delete must not look like Save). The Your
account section follows 15e1's sections. The login banner is the existing
`Message` with `tone="success"`. design.md's *Screens* row records the
screen (spec, 2026-10-05), and Step 3 marks delete **built**.

Journeys: **9** (delete something -> a confirmation naming it -> where you
land: here, the login page with its banner), **8** (a form error beside the
field, input kept, except the password) and **6** (signed out,
`/admin/account/delete` -> sign in -> back to it).

## Build steps

- [x] **Step 1 - migration `0014_deleted_accounts.sql`** (run `migrate`):
  - `entries.author_id` and `media.uploaded_by` become nullable;
  - `entries_author_member_fkey` and `media_uploaded_by_member_fkey` are
    re-added with `on delete set null (author_id)` and `on delete set null
    (uploaded_by)`, keeping their names. The column-list form clears only
    the reference, never `site_id`, as 0010 did for settings;
  - the header holds the reversal, possible only while no entry or media
    row has a null author.

  *Done when:*
  - `npm run db:migrate` applies it on the development database;
  - in `psql` as the app role inside `set_config('app.site_id', ...)`,
    deleting a membership that has an entry and a media row leaves both rows
    with a null author or uploader and their `site_id` unchanged;
  - `npm run verify` passes.
- [x] **Step 2 - "Deleted account" in every read** - `entries.server.ts`'s
  `listEntries`, `findPublishedEntry` (the slug query) and `findHomePage`,
  and `media.server.ts`'s `listMedia` and `findMediaForUser`, left-join
  `users`. `authorId`, `uploadedBy` and the name fields become nullable in
  their types. One `DELETED_ACCOUNT` label, "Deleted account", is shown by
  the posts list, the pages list and Media. The public post's byline drops
  the name and its separator when the author is null.

  *Done when:* `e2e/deleted-account.spec.ts` sets up a member with a
  published post, a published page chosen as the home page, and a media
  row, then removes the membership through the owner connection
  (`removeMembership` changes to leave the rows: its `deleteMemberRows` is
  no longer needed for that):
  - as the site's admin, the posts list, the pages list and Media each show
    "Deleted account" for those rows;
  - the admin can still open and save the post;
  - the public post answers 200 with its date and no author name;
  - `/` still shows the home page.
- [x] **Step 3 - the confirm screen and leaving** -
  `features/account/account-delete.tsx` (route `admin/account/delete` in the
  shell layout), `account-delete-input.ts` (+ test: the fields, `expect`, the
  address comparison, the body cap), and in `account.server.ts`
  `findDeletion(userId)` (which case, the counts, the other members' names)
  and `deleteAccount(userId, expect)`, leaving case only. Until Step 4 the
  last active admin sees the refused state ("can't be deleted yet"), so the
  app never offers a deletion it cannot do. Your account gains
  the section and link. Login reads `?deleted=1`. design.md's *Screens* row
  is marked built.

  *Done when:* `e2e/account-delete.spec.ts`, on a site with two active
  admins and an author who has a post:
  - the author opens the screen from Your account's link, sees the leaving
    text naming the address, gives a wrong password and is refused below
    the field with nothing deleted, then the right one, and lands on
    sign-in with "Your account is deleted.";
  - the author can no longer sign in, and the admin's posts list shows the
    post by "Deleted account";
  - one admin leaves the same way while the other still signs in and sees
    the site;
  - a second browser context signed in as the author lands on sign-in at
    its next request after the deletion;
  - five wrong passwords bring "Too many attempts." and a sixth with the
    right one deletes nothing;
  - signed out, `/admin/account/delete` leads to sign-in and back to it
    (journey 6);
  - `account-delete-input.test.ts` passes.
- [x] **Step 4 - the last admin takes the site** - `deleteAccount` gains the
  site case and the oldest-site refusal. The screen shows the counts, the
  names and the address field. Which case applies is a pure
  `deletionCase({ isLastActiveAdmin, isOldestSite })` in
  `account-delete-input.ts`, used by both the loader and the transaction.

  *Done when:*
  - `account-delete-input.test.ts` covers all four combinations of
    `deletionCase`, the oldest site's last admin giving `refused`;
  - `verify` walks the refusal by hand on the development database, signed
    in as site 1's admin while they are its only active admin: no form,
    and a POST built by hand deletes nothing. No browser test can, because
    `createAdmin` makes site-1 admins in parallel in every other spec; `e2e/account-delete.spec.ts`, on a site with one active
  admin, a deactivated admin, an editor, entries, a home page and two media
  rows (`insertTestMediaRow`, so no R2 is needed):
  - the screen names the address, the counts and both other members;
  - a wrong address is refused beside the field with what was typed kept,
    and nothing is deleted;
  - the right address and password land on sign-in with the banner, and
    through the owner connection the site has no `sites`, `site_settings`,
    `entries`, `media` or `site_members` row and none of its three users
    remain;
  - the editor cannot sign in;
  - a new site can take the freed subdomain;
  - a page loaded as *leaving* is refused once the other admin is
    deactivated before submitting, with nothing deleted;
  - two admins of one site submitting at once (two contexts,
    `Promise.all`) leave exactly one of them deleted and the site in place;
  - the action's server time for a site with 50 entries and 50 media rows,
    over 20 deletions on the development machine against the production
    build, is under **1 s at p95** (quality-bar *Admin saves*; R2 is not
    awaited).
- [x] **Step 5 - after the commit: R2 and the members' notice** -
  `site-deleted-notice.ts` (+ test: the address, plain text, no markup from
  a name), the send after commit for every other member when email is on,
  and the R2 removals after commit with each failure logged.

  *Done when:* `e2e/account-delete.spec.ts`:
  - on the primary server (email on), the editor of a deleted site has the
    notice in Mailpit, and the person who deleted it gets nothing;
  - on the email-off server, deleting a site with a member sends nothing
    and still succeeds;
  - in CI (fake R2) the deletion succeeds, and a failed R2 delete is
    logged, not raised;
  - **locally only** (`test.skip(skipWithoutStorage)`), an image uploaded
    through Media answers 404 at its public URL after the site is deleted;
  - `site-deleted-notice.test.ts` passes.

- [x] **Repair F-263 - after a 409 "Something changed" the delete screen stays
  stale** - the screen reloads its case after a 409, so the person sees what
  will now be deleted. *Done when:* the "loaded as leaving" test in
  `e2e/account-delete.spec.ts` also sees the site case's text and address
  field after CHANGED, failing with the repair reverted.
- [x] **Repair F-265 - the deletion runs while holding a password slot** -
  the password is checked inside `withCurrentPassword`, and `deleteAccount`
  runs after the slot is released (Notes' order). *Done when:* a browser test
  holding the site row locked with two deletions waiting on it still lets a
  sign-in through, failing ("Busy") with the repair reverted.

## Files and areas

- **New:**
  - `db/migrations/0014_deleted_accounts.sql`;
  - in `app/features/account/`: `account-delete.tsx`,
    `account-delete-input.ts` + test, `site-deleted-notice.ts` + test;
  - `e2e/deleted-account.spec.ts`, `e2e/account-delete.spec.ts`.
- **Changed:**
  - `app/routes.ts`;
  - `app/features/account/account.tsx` (the section) and
    `account.server.ts` (`findDeletion`, `deleteAccount`);
  - `app/features/auth/login.tsx` (the banner);
  - `app/features/content/entries.server.ts`, `post-list.tsx`,
    `page-list.tsx`;
  - `app/features/public-site/post.tsx`;
  - `app/features/media/media.server.ts`, `media-list.tsx`;
  - `app/lib/security-log.server.ts`;
  - `e2e/helpers/users.ts` (`removeMembership`);
  - `blueprint/context/design.md` (*Screens* row).
- **Read, reused unchanged:**
  - `account.server.ts`'s `withCurrentPassword`;
  - `media/r2.server.ts` (`deleteObject`);
  - `lib/email.server.ts`, `lib/email-env.server.ts`;
  - `auth/session-cookie.server.ts` (`serializeClearedSessionCookie`);
  - `public-site/public-site.server.ts` (the oldest-site rule, matched
    inside the transaction);
  - `lib/ui/*`;
  - `e2e/helpers/{users,sites,media,mail}.ts`.
- **Check while building:** `app/features/content/` has no other
  `join users`. `grep` found only these five.

## Data and contracts

- **`entries.author_id`, `media.uploaded_by`: nullable.** Null means
  "Deleted account". Their composite foreign keys to `site_members` set only
  that column to null when the membership is deleted. **Load-bearing:**
  code that reads an author or uploader must handle null. Ownership filters
  (`author_id = actor.id`) never match null, so an author never sees a
  deleted person's rows as their own.
- **Memberships and users are deleted only by `deleteAccount`.** Everywhere
  else they are still deactivated (D159).
- **`deleteAccount` is the one place a site is deleted.** **Load-bearing:**
  every later site-owned table and service adds its own cleanup there:
  `site_domains` (16), image variants' R2 keys (17b), `ai_runs` (18),
  `contact_submissions` (19), and **cancelling the Stripe subscription**
  (21).
- **Deleting other members' accounts with the site rests on
  `site_members`' `unique (user_id)`** (D159, one site per user).
  **Load-bearing:** at Level 2 a member of several sites keeps their account
  and loses only this membership.
- **Routes:** `GET/POST /admin/account/delete`. The form fields are
  `expect` (`leave` | `site`), `address` (site case only) and
  `currentPassword`. `GET /login?deleted=1`.
- **Security events:** `{ event: "account_deleted"; userId; siteId;
  siteDeleted: boolean }`, and `email_send_failed.purpose` gains
  `site_deleted_notice`.

## Testing

- **Unit** (`npm test`, inside `verify` and CI): `account-delete-input.test.ts`
  and `site-deleted-notice.test.ts`.
- **Browser** (`npm run test:e2e`, locally and in CI's `e2e` job, which has
  the database and Mailpit): `e2e/deleted-account.spec.ts` and
  `e2e/account-delete.spec.ts`.
  - Every test makes its own users and site (`createSite`,
    `createSiteAdmin`), never site 1. **No browser test deletes site 1 or
    makes another site the oldest**: the public-site specs read the oldest
    site. The oldest-site refusal is proven by the unit test and a manual
    `verify` walk (Step 4).
  - A test that trips the login limiter uses its own email (F-231's lesson).
- **R2:** media rows come from `insertTestMediaRow`, so CI deletes them
  against fake R2 and must log rather than fail. Only the public-URL 404
  check needs real R2, and it skips in CI.
- **The p95 in Step 4** is measured locally against the production build by
  `verify`, not in CI.

## Decisions

- **Deleting your account is immediate - no grace period, no restore**
  (owner, 2026-10-05). The safeguards are the confirm screen naming what
  goes, the current password, and for the last admin the typed address.
  Beat: a 30-day schedule (a sweeper, a restore path, a pending state
  everywhere, for an invite-only beta).
- **A member who is not the last active admin leaves; their content stays,
  credited to "Deleted account"**: a nullable author, cleared by the foreign
  key. Beat: a placeholder "Deleted account" user per site (a fake row that
  can sign in, a fake email, and one per site to create).
- **The last active admin's deletion takes the site and every member's
  account; with email on, each member is told** (owner, 2026-10-05). Beat:
  keeping their accounts (no site, cannot sign in, and their email is stuck
  until Level 2).
- **The last admin of the oldest site cannot delete their account until
  item 16** (owner, 2026-10-05). Until then the public domain serves the
  oldest site (`findPublicSiteId`), so deleting it would put a stranger's
  site on it.
- **The last admin types the site's address; everyone gives their current
  password, checked like a login** (owner, 2026-10-05). Beat: the password
  alone (a whole site goes).
- **The form carries the case it was loaded as, and the transaction refuses
  a different one under a lock on the site row.** This stops a site being
  deleted without the address typed, and two admins leaving a site with no
  admin. Beat: no lock (two simultaneous deletions orphan the site).
- **R2 objects are removed after the commit and the response does not wait
  for them**, with failures logged. Beat: awaiting them (seconds for a full
  site), and a background job (D154 runs only AI).
- **A deleted site's address is free again at once.** Beat: holding it
  (needs a table, and nothing yet serves addresses - item 16).
- **`e2e/deleted-account.spec.ts` runs on site 1** (build, Step 2): the public
  post and `/` are served only from the oldest site until item 16, so they can
  be checked nowhere else. It deletes only its own rows and puts site 1's
  `home_page_id` back, but shares that row with `home-page.spec.ts` (F-103).
  Site deletion stays off site 1, as *Testing* says.
- **Afterwards the person lands on `/admin/login?deleted=1`** (build, Step 3):
  the app's sign-in route is `admin/login`; `/login` in this spec means it.
- **`findDeletion(siteId, userId)` and `deleteAccount(siteId, userId, expect)`
  take the session's `siteId` first** (build, Step 3), as the coding standards
  ask of site-owned data functions; `inSite` needs it.
- **A refused or changed POST answers 409** with the message on the page
  (build, Step 3).
- **`withCurrentPassword` only verifies the password; the transaction runs
  after it returns, with the slot released** (build, Step 3; repaired,
  F-265): a wrong password counts even when the case is refused, and a right
  one never does.
- **The password field behaves as 15e1's do** (build, Step 3): uncontrolled,
  so the browser keeps what was typed after a refusal. Journey 8's "except
  the password" is not enforced here, nor in 15e1.
- **The confirm screen names every other member, active or deactivated**,
  ordered by name, as "A, B and C" (build, Step 4).
- **The typed address is checked against the loader's address before the
  limiter** (build, Step 4); a case that changed after that is caught by the
  transaction as "changed".
- **`insertTestMediaRow` takes an optional `siteId`** (build, Step 4), so a
  test site can hold media without R2; site 1 stays the default.
- **The after-commit work lives in `site-deleted-cleanup.ts`** (build, Step 5):
  `removeStorageObjects` and `notifyMembers` take R2, the mailer and the logger
  as parameters and never reject. No browser test can read the server's log,
  so its unit test proves "a failed R2 delete is logged, not raised".
- **The members' notices are not awaited either** (build, Step 5), unlike
  15e1's email-changed notice: the person deleting is signed out and cannot
  be told of a failure. A failure logs `email_send_failed` with the
  deleter's `userId`. Deactivated members are told too.
- **`DELETED_ACCOUNT` lives in `app/lib/deleted-account.ts`** (build, Step 2):
  browser components show it, so it cannot sit in a `.server.ts` file.
- **The public byline shows only the date for a deleted author; the admin
  shows "Deleted account".** Beat: "Deleted account" on a customer's public
  post.

## Production needs

- Migration `0014_deleted_accounts.sql`, additive: it relaxes two columns.
  It runs with the v1 deploy's other migrations, and the release cannot be
  rolled back by symlink once a deleted author exists.
- No new environment variables. The members' notice needs email on in
  production (`SMTP_URL`, `EMAIL_FROM` - the Resend line in `needs-you.md`);
  without it, members are not told.
- The privacy policy (`needs-you.md`) should say that deleted accounts stay
  in the nightly backups until those age out. `deploy/backup-db.sh` keeps 7
  days locally. The R2 bucket's own retention is not known.

## Behaviour changes

- Adds to `accounts`: anyone signed in who is not their site's last active admin can delete their account with their current password; they are signed out everywhere and cannot sign in again - Step 3
- Adds to `accounts`: a deleted member's posts, pages and images stay on the site, shown in the admin as by "Deleted account" and publicly with no author name - Step 2
- Adds to `accounts`: a wrong current password when deleting counts toward the same lock as a failed sign-in - Step 3
- Adds to `accounts`: the last active admin's deletion, after typing the site's address, deletes the site, its content, images and settings, and every member's account, and frees its address - Step 4
- Adds to `accounts`: the last active admin of the oldest site cannot delete their account (until item 16) - Step 4
- Adds to `accounts`: a deletion is refused, deleting nothing, when who is the last active admin changed after the confirm screen loaded - Step 4
- Adds to `accounts`: with email on, every other member of a deleted site is emailed that it was deleted - Step 5

## Notes

- **Order inside the action follows 15e1:**
  1. validate the form (the address match included);
  2. check the limiter;
  3. take a slot and verify the password, releasing the slot in `finally`;
  4. run the transaction;
  5. after the commit, the emails and R2.
- **Lock order:** the site row first, then the user row. 15e1's confirm
  locks the user before its tokens and never takes the site, so no cycle.
- All of this runs in `inSite(siteId, ...)` with the session's own
  `siteId`, and names `site_id` in every query (D151's two guards). The
  user id always comes from the session, never the form. Platform tables
  (`sites`, `site_members`, `users`) are scoped by `site_id` explicitly.
- **Delete order in the site case:**
  1. `site_settings` (its foreign keys point at entries and media);
  2. `entries`;
  3. `media`;
  4. `site_members`;
  5. `users`;
  6. `sites`.

  `email_tokens` cascade from users, and `invites.used_by_site_id` sets
  itself null.
- Form bodies are capped like `user-input.ts`'s 8 KB. The origin check
  already covers the POST.
- Emails are plain text with no character a mail client could read as
  markup (`reset-email.ts`'s pattern). Never log an address.
- A residual race is accepted. One person deletes their account in one tab
  while demoting the only other admin in another. The demote passed its
  check before the deletion committed, so the site can end with no active
  admin. Closing it would need a "last admin" guard on role changes, which
  Users does not have today. It goes in Review as a known gap, not a step.
- `design.md` exists. Journeys 6, 8 and 9 apply and are done-whens above.

## Findings

### 15e2-delete-your-account/F-263 [P2] closed - After a 409 "Something changed" the delete screen stays stale, so every retry is refused
File: app/features/account/account-delete.tsx:96 (409 return; no `shouldRevalidate`)

# F-263 - After a 409 "Something changed" the delete screen stays stale, so every retry is refused

**Found:** 2026-10-05 by review (scope: current; lens: every lens; via reviewer)
**Why it matters:** React Router 8 Framework Mode does not revalidate loaders after a 4xx action (installed docs, `how-to/optimize-revalidation.md:29`). After CHANGED the page keeps the old case text and hidden `expect`, so following "check what will be deleted and try again" gets 409 every time until a manual reload. It fails safe, since nothing is deleted.
**Suggested fix:** export `shouldRevalidate` returning true when `actionStatus === 409` (or redirect the 409 paths back to the screen with a fixed-flag banner). Extend `e2e/account-delete.spec.ts:322` to assert the page then shows the site case and the address field.
**Resolution:** fixed by build, 2026-10-05: `account-delete.tsx` exports `shouldRevalidate` (true on `actionStatus === 409`). The "loaded as leaving" test in `e2e/account-delete.spec.ts` now asserts the site-case text and address field after CHANGED, then completes the deletion. Red without the repair and again with it reverted (`getByText('is deleted with your account:')` not found); green with it.

Closed by review (via reviewer), 2026-10-05, on `ed94638..5d85c66`: the `shouldRevalidate` contract was checked against the installed docs (`route-module.md`, `optimize-revalidation.md`). Only this route's loader reruns, and only on a 409. A 400/429/503 keeps the old data, which is fine because the transaction re-checks. `actionData` survives the revalidation, and the test asserts the site case, CHANGED and a successful retry. Nothing new introduced.

### 15e2-delete-your-account/F-265 [P2] closed - The deletion transaction runs while holding a password slot, against the spec's order, and worsens F-231
File: app/features/account/account-delete.tsx:86-89

# F-265 - The deletion transaction runs while holding a password slot, against the spec's order, and worsens F-231

**Found:** 2026-10-05 by review (scope: current; lens: every lens; via reviewer)
**Why it matters:** The spec's Notes put the transaction (4) after the slot is released (3). The code calls `deleteAccount` inside `withCurrentPassword`'s work, so a deletion waiting on the site-row lock holds one of only two slots (`createInFlightLimit(2)`). The concurrent test holds both, and another worker's login can then answer 503 (F-231).
**Suggested fix:** verify the password inside `withCurrentPassword` only, then call `deleteAccount` after it returns ok. Keep "a right password is never counted" as it is.
**Resolution:** fixed by build, 2026-10-05: `withCurrentPassword` only verifies the password, and `deleteAccount` runs after it returns. New test "a deletion waiting on the site's lock does not hold a password slot": an owner connection holds the site row locked while two deletions wait (`pg_locks`), and a third user must sign in. Red without the repair and again with it reverted (`Received: "busy"`); green with it.

Closed by review (via reviewer), 2026-10-05, on `ed94638..5d85c66`: `withCurrentPassword` is unchanged, so a wrong password counts and a right one is forgiven before `deleteAccount`. The slot is released in `finally` before the transaction, which uses the same session user. The order now matches Notes. The test's `finally` releases the lock and connection on every path. New weakness raised separately as F-268.
