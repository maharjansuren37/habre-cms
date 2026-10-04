# Feature: Your account

**From build plan:** item 15e1
**Type:** Feature
**Verified:** 2026-10-05, ad62564ab3b6, 6 of 6 proven (browser tests against the production build; Step 3 p95 861 ms over 20 saves; journey 6 and the revoked-session click walked live; full suite 350 passed, 1 failed = F-230, editor untouched)
**Reviewed:** 2026-10-05, ad62564ab3b6, current (main...HEAD from d6886d7), every lens, reviewer subagent - 0 blocking; F-252 P2 and F-253..F-262 P3 open

## Goal

Anyone signed in can change their own name, password and email from one
page, **Your account**, without asking an admin. Strangers sign up now
(15b), so a person must be able to keep their own details right - and an
email typed wrong at signup is the address every reset link goes to.
Deleting the account is 15e2.

## In scope

- `/admin/account`, **Your account**, inside the admin shell, for every role,
  reached from a **Your account** link at the shell's foot under the person's
  name.
- **Name:** change it; no password asked. The shell shows the new name at once.
- **Password:** current password and a new one (`newPasswordSchema`, 12-200).
  Saving signs the person out everywhere else and keeps them signed in on this
  browser (a fresh cookie on the new `token_version`), as reset does (D271-D283).
- **Email:** a new address and the current password.
  - **Email on** (`isEmailOn`): nothing changes yet. A link goes to the **new**
    address; the page shows "We sent a link to *new address*. It works for 24
    hours." until it is used or expires. Only the newest link works.
  - `/confirm-email?token=` (signup layout, outside the shell, like `/verify`):
    GET changes nothing; **Confirm new email** (POST) makes the change, once and
    within 24 hours, then lands on Your account with "Your email is now
    *address*." (signing in first if this browser is signed out - journey 6). No
    session is issued here (D270). Confirming uses up the person's unused reset
    links, which went to the old address, and sends the **old** address a
    notice saying the email changed and what to do if it was not them.
  - **Email off:** the change happens at once on Save, `email_verified_at`
    stays set. `/confirm-email` is Not Found.
  - Refused beside the field, input kept (journey 8): the current address
    ("That's already your email."), an address another account uses ("That
    email is already used by another account." - the same fact D159's
    add-member already tells an admin; it is asked again at Confirm, since
    someone can sign up with it in between).
- **The current password, for email and password changes,** is checked like a
  login: it holds a `passwordCheckSlots` slot ("Busy, try again in a
  minute.", 503) and a wrong one counts a failure against
  `emailLoginLimiter` for the account's current email. At the limit the form
  says "Too many attempts. Try again in 15 minutes." and checks nothing. A
  right one does not reset the counter (only a reset or a login does).
- **Sending the link** is limited per new address (3 an hour) and per IP (5 an
  hour) with a third `createResendLimits()` instance - it is otherwise a way
  to email any inbox from your own account. A failed send says "We couldn't
  send the email. Try again." and is logged `email_send_failed`.
- Security log events (`security-log.server.ts`): `password_changed`,
  `email_change_requested`, `email_changed`, `email_change_rate_limited`, and
  `account_password_refused` (wrong current password, with the IP);
  `email_send_failed` gains purposes `email_change` and `email_changed_notice`.
  Never an address.

## Out of scope

- **Deleting the account** - 15e2.
- **The account menu** (Your account, Plan, Sign out, design.md *Navigation
  map*) - Plan arrives with item 21; until then the foot holds a link and the
  existing Log out button. The "Log out" -> "Sign out" wording is not changed
  here.
- An admin's own row on Users (`/admin/users/:id`) keeps its reset-password
  form; whether that should send an admin to Your account instead is not
  decided here.
- Changing the site's address - item 16 owns addresses.
- Using up reset links on a **password** change - a live reset link still
  works afterwards, and completing it ends every session (accounts.9).

## Design reference

No mockup: the screen is the Users edit screen's shape
(`app/features/users/user-edit.tsx`), which design.md's conventions already
cover. `h1` "Your account"; three `section`s each with an `h2` - **Name**,
**Email**, **Password** - each its own `form` with one primary button (Save
name, Send a confirmation link / Save email when email is off, Save
password). Success is a `role="status"` banner on this page after a redirect
(`?saved=name|email|password|link`, a fixed set - never text from the URL);
field errors below the field with `aria-invalid` / `aria-describedby`;
pending labels "Saving…" / "Sending…". `/confirm-email` follows `/verify`
(D251, D269): a heading, one paragraph, one primary button, and an
expired-or-used state with a link back to Your account. design.md's *Screens*
row records this (spec, 2026-10-05); Step 2 marks it **built**.

## Build steps

- [x] **Step 1 - migration `0013_email_change.sql`** (run `migrate`) -
  `email_tokens.purpose` also allows `email_change`; a nullable
  `new_email text` column, lowercased by check, present exactly when the
  purpose is `email_change`. Reversal written in the header. *Done when:*
  `npm run db:migrate` applies it on the development database; in `psql` an
  `email_change` row without `new_email`, and a `reset` row with one, are each
  refused by a check; `npm run verify` passes.
- [x] **Step 2 - the page, the name, the shell link** - `features/account/`:
  `account.tsx` (route `admin/account` in the shell layout),
  `account-input.ts` (+ test: which form was sent, the name rule, the body
  cap), `account.server.ts` (`changeName(userId, name)`). The shell's foot
  gains the Your account link. design.md's *Screens* row is marked built.
  *Done when:* `e2e/account.spec.ts`: an **author** opens Your account from
  the shell link, saves a new name, sees "Your name is saved." and the new
  name at the shell's foot; a blank name is refused below the field with
  "Enter a name." and the field keeps what was typed; signed out,
  `/admin/account` leads to sign-in and back to it.
- [x] **Step 3 - change password** - `changePassword(userId, currentPassword,
  newHash)` in one transaction (`for update` on the user), the limiter and
  slot handling in the action, a new session cookie. *Done when:*
  `e2e/account.spec.ts`: signed in in two browser contexts, changing the
  password in the first keeps it on Your account with "Your password is
  saved." while the second's next request lands on sign-in; the old password
  is then refused at sign-in and the new one accepted; a wrong current
  password is refused below its field and changes nothing; five wrong ones
  bring "Too many attempts." and a sixth with the right password is refused
  too; and the action's server time for a password save, over 20 saves on the
  development machine, is under **1 s at p95** (quality-bar *Admin saves*).
- [x] **Step 4 - change email, the checks and email off** -
  `account-input.ts` gains the email rule (`emailSchema`, not the current
  one); `changeEmailNow(userId, newEmail)` catches `users_email_key`. *Done
  when:* `e2e/account.spec.ts` on the email-off server (`HOST_SPLIT_PORT`,
  admin on `localhost`): a member changes their email with the right password,
  signs out, cannot sign in with the old address and can with the new; the
  current address, another account's address and a wrong password are each
  refused below their field with the input kept; `account-input.test.ts`
  covers the new rule.
- [x] **Step 5 - email on: send the link** - `email-change-email.ts` (+ test:
  the link, 24 hours, no markup from the name) and
  `requestEmailChange(userId, newEmail)` in `account.server.ts` (uses up the
  user's earlier `email_change` tokens, issues one with `new_email`, returns
  the token; the email goes after commit); the loader reads the pending
  address; the send limit. Step 4's refusals run before anything is sent.
  *Done when:* `e2e/account.spec.ts` on the primary
  server: Send a confirmation link puts one email in Mailpit addressed to the
  new address, the page shows the pending line naming it, and signing in with
  the new address still fails; a fourth request for one address in an hour is
  refused with "Too many emails to that address. Try again later." and sends
  nothing; the current address and another account's are refused below the
  field here too, with nothing sent; `email-change-email.test.ts` passes.
- [x] **Step 6 - `/confirm-email` and the notice** - `confirm-email.tsx`
  (route added to `app/routes.ts` and to `areaForPath` in
  `app/lib/content-security-policy.ts` as an admin-host page),
  `confirmEmailChange(token)` (one transaction: lock the user first, as
  F-243's order; use the token atomically; refuse when the membership is
  deactivated; update the email, catching `users_email_key` as a "taken"
  state; use up the user's other `email_change` and `reset` tokens), and
  `email-changed-notice.ts` (+ test) sent to the old address after commit.
  *Done when:* `e2e/account.spec.ts`, primary server, through Mailpit:
  opening the link changes nothing until **Confirm new email** is pressed;
  pressing it lands on Your account with "Your email is now *address*.";
  sign-in works with the new address and not the old; the old address has
  the notice; the link a second time, a link older than the newest, and a
  link whose address another account took in between, and a link used
  after the member was deactivated each show their state and change
  nothing (a refused confirm uses nothing up - the transaction rolls back);
  a reset link requested before the change no longer works; with email off,
  `/confirm-email` is Not Found.

## Files and areas

- New: `db/migrations/0013_email_change.sql`; `app/features/account/`
  (`account.tsx`, `account.module.css` if the users form styles cannot be
  reused as they are, `account-input.ts` + test, `account.server.ts`,
  `confirm-email.tsx`, `email-change-email.ts` + test,
  `email-changed-notice.ts` + test); `e2e/account.spec.ts`.
- Changed: `app/routes.ts`; `app/features/admin-shell/layout.tsx` (+ its CSS);
  `app/lib/content-security-policy.ts` (+ its test); `app/lib/security-log.server.ts`;
  `app/features/signup/resend-rate-limit.server.ts` (a third instance);
  `app/features/signup/email-tokens.server.ts` (`EmailTokenPurpose`, and
  `new_email` when issuing an `email_change` token);
  `blueprint/context/design.md` (*Screens* row).
- Read, reused unchanged: `users/user-input.ts` (`nameSchema`, `emailSchema`,
  `newPasswordSchema`), `auth/password.server.ts`,
  `auth/login-rate-limit.server.ts`, `auth/session-*.server.ts`,
  `lib/email.server.ts`, `lib/email-env.server.ts`, `lib/ui/*`,
  `e2e/helpers/mail.ts`, `e2e/helpers/users.ts`.

## Data and contracts

- **`email_tokens`** (platform table, no `site_id`, no row-level security):
  `purpose` in `('verify', 'reset', 'email_change')`;
  `new_email text null`, `check (new_email = lower(new_email))`,
  `check ((purpose = 'email_change') = (new_email is not null))`. An
  `email_change` token lives 24 hours. **Load-bearing:** 15e2 deletes a user's
  tokens through the existing `on delete cascade`, and any later purpose
  extends the same check.
- **No change to `users`.** The email changes in place; `email_verified_at`
  is set to `now()` by a confirmed change.
- **Routes:** `GET/POST /admin/account` (shell, every role; the form field
  `intent` is `name`, `email` or `password`); `GET/POST /confirm-email`
  (admin host, email on only). `?saved=` values: `name`, `email`, `password`,
  `link`.
- **Security events** as listed in *In scope*; the `SecurityEvent` union
  grows by those members.

## Testing

- Unit (`npm test`, inside `verify` and CI): `account-input.test.ts`,
  `email-change-email.test.ts`, `email-changed-notice.test.ts`,
  `content-security-policy.test.ts` (the new path).
- Browser (`npm run test:e2e`, locally and in CI's `e2e` job, which has the
  database and Mailpit): `e2e/account.spec.ts` - the primary server (email
  on) and the host-split server (email off). Nothing here uploads to R2, so
  nothing is skipped in CI. Each test makes its own user and site
  (`e2e/helpers/users.ts`), so the two workers never share an account; a test
  that trips the login limiter uses its own email so it cannot lock another
  test out (F-231's lesson).
- The p95 in Step 3 is measured locally against the production build
  (`npm run build && npm start`) by `verify`, not in CI.

## Decisions

- **Your account is `/admin/account`, in the shell, for every role,** linked
  from the shell's foot until item 21's Plan makes the account menu. Beat: a
  menu for one entry.
- **Changing email or password asks for the current password, checked like a
  login** - a wrong one counts against `emailLoginLimiter` for that account
  and takes a `passwordCheckSlots` slot. Beat: no re-check (a borrowed,
  unlocked laptop could take the account); a separate counter (two budgets
  of guesses for one password).
- **With email on, a new email takes effect only from a link sent to it;
  the old address is told afterwards** (owner, 2026-10-05). The pending
  address lives on its `email_tokens` row (`purpose = 'email_change'`,
  `new_email`), 24 hours, newest only, Confirm by POST (D251), no session
  issued (D270), and confirming uses up reset links sent to the old address.
  Beat: changing at once (a typo loses the reset path); a pending column on
  `users` (read on every request for a rare state).
- **With email off, the change is immediate** after the current password -
  there is no way to send a link, and an operator made the account.
- **A password change keeps this browser signed in and ends every other
  session**, as reset does.
- **A taken address is said beside the field** - behind a signed-in session
  and the current password, and D159's add-member already says it.
- **The confirmation link is limited per new address (3 an hour) and per IP
  (5 an hour)**, the resend limits' numbers. Beat: no limit (the page would
  email any inbox).

## Production needs

- Migration `0013_email_change.sql` (additive; runs with the v1 deploy's
  other migrations).
- No new environment variables. The link and the notice need email on in
  production (`SMTP_URL`, `EMAIL_FROM` - the Resend line in `needs-you.md`);
  without it the change is immediate.

## Behaviour changes

- Adds to `accounts`: anyone signed in can change their name on Your account, and the shell shows the new name at once - Step 2
- Adds to `accounts`: changing your password needs the current one, keeps you signed in on this browser and signs you out everywhere else - Step 3
- Adds to `accounts`: a wrong current password on Your account counts toward the same lock as a failed sign-in - Step 3
- Adds to `accounts`: with email off, a new email takes effect at once after the current password, and the old one no longer signs in - Step 4
- Adds to `accounts`: a new email that is already yours or another account's is refused beside the field - Step 4
- Adds to `accounts`: with email on, asking for a new email changes nothing until the link sent to that address is confirmed, and only the newest link works - Step 5
- Adds to `accounts`: confirming a new email changes it once and within 24 hours, tells the old address, and stops reset links sent before it - Step 6

## Notes

- Every query here is on platform tables (`users`, `email_tokens`,
  `site_members` for the active-membership check), outside row-level
  security, and is scoped by the session's user id - never an id from the
  form.
- Form bodies are capped like `user-input.ts` (`isUserFormBodyAllowed`, 8 KB)
  and the origin check already covers the POSTs.
- Order inside the actions follows reset: validate the form, check the
  limiter, take a slot, verify, hash, write, release the slot in `finally`.
- Emails are plain text and never carry a character a mail client could read
  as markup (`reset-email.ts`'s pattern); never log an address.
- Lock order for the confirm transaction: the user's row before their
  tokens (F-243).
- `design.md` exists; journeys 6, 7 (the session part, for a change rather
  than a reset) and 8 apply and are done-whens above.
