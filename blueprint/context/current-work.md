# Feature: Users and roles

**From build plan:** item 8
**Type:** Feature
**Status:** built and reviewed, no findings

## Goal

An admin can add editors and authors, change anyone's role, reset a password,
and deactivate or reactivate an account - all from `/admin/users`, enforced on
the server. This is the last unchecked item on the MVP build plan.

## In scope

- `/admin/users` - list every user (all roles, including deactivated), admin only.
- `/admin/users/new` - create a user: email, name, role, password (the admin
  sets it directly - password reset by email is explicitly deferred, D-scope).
- `/admin/users/:id` - change role, reset password, deactivate/reactivate.
  Read-only email and name (editing an existing user's name/email is not in the
  plan's list of admin actions).
- A "Users" entry in the admin-shell nav, admin only, matching how each
  previous section added its own (D35).
- Logging role changes, deactivations, reactivations and password resets
  (`fundamentals.md` Logging; the project-plan's own Auth boundary section
  commits to logging "role changes, deactivations, password resets").
- A guard so an admin cannot change their own role or deactivate their own
  account (see *Decisions* - this is what keeps the product from ever reaching
  zero active admins, without a separate count check).

## Out of scope

- Editing an existing user's name or email - not listed as an admin action in
  project-plan.md's routes table; a later item if ever wanted.
- Password reset by email, self-service signup, "must change password on first
  login" - all deferred in project-overview.md's Scope section already.
- Any change to the `users` table - `0001_users.sql` already has every column
  this item needs (its own comment says so). No migration step.
- A "last active admin" count check - proven unnecessary below (Decisions);
  adding one anyway would be an untestable guard against a state the code
  cannot reach.

## Build steps

- [x] **Step 1 - Data layer and validation** - Add to
  `app/features/users/users.server.ts`: `listUsers()` (every user, all roles,
  ordered by name - no author-style ownership scoping, matching the plan's
  admin-only permission for this whole area); `updateUserRole(id, role)`,
  `setUserPassword(id, passwordHash)`, `deactivateUser(id)`, `reactivateUser(id)`
  - each a single atomic `update ... returning` (matching `saveEntry`'s D42
    precedent), the first three also bumping `token_version` in the same
    statement (project-plan.md's Auth boundary: role changes, deactivations and
    password resets all "take effect immediately"). Add to
    `app/features/users/user-input.ts`: `createUserSchema` (`newUserSchema`
    extended with a `role` field validated against the existing `roles` tuple)
    and an exported `roleSchema` for the role-change form to reuse. Extend the
    `SecurityEvent` union in `app/lib/security-log.server.ts` with
    `role_changed` (`userId`, `fromRole`, `toRole`, `actorId`),
    `user_deactivated` / `user_reactivated` (`userId`, `actorId`), and
    `password_reset` (`userId`, `actorId`) - the file's own leading comment
    already names these three as item 8's job. Type every role-carrying field
    as `Role`, imported from `./roles.ts`.
  *Done when:* `npm test` passes, including new unit tests in
  `user-input.test.ts` for `createUserSchema` (rejects a role outside the
  three, accepts each of the three, still enforces the existing email/name/
  password rules); `npm run typecheck` passes with the new functions unused
  by anything yet.

- [x] **Step 2 - List users** - `app/features/users/user-list.tsx`
  (`requireRole(["admin"])`, matching `page-list.tsx`'s and `settings.tsx`'s
  shape), registered as `admin/users` inside the admin-shell layout in
  `app/routes.ts`. A table (name, email, role, status - "Active" or
  "Deactivated" from `deactivatedAt`), a "New user" link to `/admin/users/new`.
  No search or pagination - the scale bar is ~10 admin users
  (`quality-bar.md`), the smallest table in the app. Add a "Users" nav entry to
  `app/features/admin-shell/layout.tsx`, shown only for `user.role === "admin"`
  (matching the existing Settings entry), with its own icon function
  (matching the file's existing icon pattern).
  *Done when:* logged in as admin, the sidebar shows "Users" and `/admin/users`
  lists every seeded user with the right role and status, including a
  deactivated one; logged in as editor or author, there is no "Users" link and
  visiting `/admin/users` directly answers 404 (same shape `require-role.server.ts`
  already gives `/admin/pages*` and `/admin/settings*`).

- [x] **Step 3 - Add a user** - `app/features/users/user-new.tsx`
  (`requireRole(["admin"])`), registered as `admin/users/new`. A form (email,
  name, role - a `<select>` of the three roles, password) using the existing
  `Field` component; the action validates with `createUserSchema`, hashes the
  password (`hashPassword`, already built for `create-admin.ts`), calls
  `createUser`, and on `{ ok: false, reason: "email_taken" }` re-renders the
  form with the typed values and an inline error on the email field (matching
  how `login.tsx` already surfaces a field-level auth error). On success,
  redirects to `/admin/users/:id?created=1`.
  *Done when:* creating a user with a fresh email lands on their detail page
  with a success banner, and they appear in the list with the chosen role; a
  duplicate email re-shows the form with the typed name/role and a
  "that email is already in use" message, nothing created; a non-admin gets
  404 from both the page and a direct POST.

- [x] **Step 4 - Manage a user: role, password, deactivation** -
  `app/features/users/user-edit.tsx` (`requireRole(["admin"])`), registered as
  `admin/users/:id`. A `requireUserId` guard mirrors `post-edit.tsx`'s
  `requirePostId` (a non-UUID answers 404 rather than reaching the database).
  Shows the user's email and name read-only, then three independent `<Form>`s,
  each carrying its own hidden `intent` field routed by one `action()`:
  `change-role` (a role `<select>` plus Save), `reset-password` (a new
  password field plus Save, reusing `newPasswordSchema`), and
  `deactivate`/`reactivate` (one button, whichever applies to the user's
  current state). **Self-guard:** when `params.id === actor.id`, the
  role-change and deactivate forms are replaced with a short explanatory line
  ("You can't change your own role." / "You can't deactivate your own
  account.") - password reset stays available for your own account. The
  `action` re-checks the identical guard for `change-role` and
  `deactivate`/`reactivate` regardless of what a request claims, refusing with
  a rendered `problem` (400), the same `ActionResult`-with-`problem` shape
  `settings.tsx` already uses. Each successful intent calls its Step 1
  function, logs the matching security event with the acting admin's id, and
  redirects back to `/admin/users/:id?updated=<intent>` for a success banner.
  *Done when:* an admin changes another user's role and it applies on that
  user's very next request (D6 - role is read from the database, not the
  token); resetting a user's password lets them log in with the new password
  and not the old one; deactivating a user logs them out immediately (next
  request to any admin route redirects to login) and blocks
  `/admin/login`; reactivating restores login; a crafted POST with
  `intent=change-role` or `intent=deactivate` against your own id is refused
  with the explanatory message and nothing changes in the database; all three
  saves measure comfortably under the quality bar's 1 s p95 for an admin save
  (`quality-bar.md`, which names "user" saves explicitly) - checked the same
  informal way item 7's saves were, not a repeated-run measurement.

## Files and areas

- `app/features/users/users.server.ts`, `user-input.ts` (+ its `.test.ts`) -
  extended, not replaced.
- `app/features/users/user-list.tsx`, `user-new.tsx`, `user-edit.tsx` - new.
- `app/lib/security-log.server.ts` - extended union.
- `app/features/admin-shell/layout.tsx` - one nav entry, one icon.
- `app/routes.ts` - three new routes inside the existing admin-shell `layout()`.
- `e2e/manage-users.spec.ts` - new (Testing, below).

## Data and contracts

None - `0001_users.sql` already has every column this item touches
(`role`, `token_version`, `deactivated_at`), by design (its own leading
comment: "the full shape from the plan, so users and roles (item 8) need no
schema change"). No migration step.

`createUserSchema` (`user-input.ts`) is the one new shape:
`{ email, name, password, role }` - locked here since Step 3 builds the form
against it and Step 1 supplies it.

## Testing

- Unit: `user-input.test.ts` gets `createUserSchema` cases (Step 1).
- Browser (`e2e/manage-users.spec.ts`, matching `manage-posts.spec.ts` and
  `manage-settings.spec.ts`'s shape): admin creates a user; admin changes
  another user's role and the change is visible on that user's next login;
  admin resets another user's password and the old password stops working;
  admin deactivates a user and their existing session is refused on the next
  request, and `/admin/login` refuses them too; reactivating restores login;
  an editor and an author both get 404 on every `/admin/users*` route; a
  crafted self-role-change or self-deactivation POST is refused. These are the
  behaviours nothing else in the suite exercises, the same reasoning F-17
  already recorded for auth.

## Decisions

- **No "last active admin" count check.** Every route here requires
  `requireRole(["admin"])`, so whoever performs a role change or deactivation
  is themselves an active admin. Self-role-change and self-deactivation are
  refused outright (below), so the actor's own admin status never changes as
  a side effect of managing someone else. That means before any action on a
  *different* user, at least two active admins already exist (the actor, plus
  whoever admin status is about to be removed from) - so at least one (the
  actor) always remains afterward. A separate count query would be defending
  against a state the guard already makes unreachable, and it could never be
  exercised by a test. Beats: counting active admins and refusing at zero,
  which is real code with no reachable branch to prove it against.
- **Self-role-change and self-deactivation are refused; self password-reset is
  allowed.** The first two would either strip your own access or lock you out
  mid-session with no other admin needing to act - both better done by a
  different admin, and refusing them is also what makes the point above true.
  Password reset has no such asymmetry: it is your own credential. Note the
  one side effect - resetting your own password bumps `token_version` the same
  as anyone else's, which revokes every session including the one you just
  used to submit the form, so you land back at the login page immediately
  after. Not special-cased: it is the same "takes effect immediately" rule
  every other token-revoking action here already follows (D6), and a person
  resetting their own password is not surprised to be asked to log back in
  with it. Beats: exempting self-reset from the token bump, which would make
  self-service password resets behave differently from admin-performed ones
  for no stated reason.
- **The admin sets the initial password directly on creation; no forced
  change on first login.** Matches `create-admin.ts`'s existing pattern
  exactly (script sets a real password, no flag), and password reset by email
  is already recorded as deferred (project-overview.md Scope). Adding a
  "temporary password" flag and a forced-change screen would be new schema
  and a new flow for a case the plan does not ask for.
- **Not fixing F-84 in this pass, though it touches the same union.** F-84
  asks for the pre-existing `request_refused`/`role` event's `role: string` to
  become `Role`. This item's new events are typed `Role` from the start (the
  right type for new code), but widening the *existing* line is an adjacent
  fix to code this item does not otherwise touch - flagged for `build` to pick
  up in the same diff only if it wants to close F-84 outright, not folded in
  by default (`ai-interaction.md`: refactoring is its own item, never a
  passenger).

## Notes

- Reuse `requirePostId`'s exact shape (`z.uuid().safeParse`, 404 on failure) as
  `requireUserId` in `user-edit.tsx` - `post-delete.tsx`'s comment says a
  third use is what earns extraction into a shared module; this would be the
  second (`fundamentals.md`, Duplication).
- `deactivateUser`/`reactivateUser` update `deactivated_at` unconditionally
  rather than guarding on the current state - a double click lands on the same
  final state either way, and a `where deactivated_at is null` guard would add
  a silent no-op branch nothing needs.
- Widen the existing `needs-you.md` line "Screen-reader and keyboard pass over
  `/admin/login` and the admin shell" to cover the users list, the add-user
  form, and the manage-user screen's three intents, plus the new "Users" nav
  entry - matching how items 6a, 7a and 7b each widened it. Done as part of
  this spec (see the edit alongside this file).
- This is the last unchecked item on the MVP build plan (project-overview.md,
  *Current state*). `ship`-ing it closes out the first version; what comes
  next is `ideate --rescope` or a fresh `spec`, not an existing queued item.
