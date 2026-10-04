# Feature: Password reset by email

**From build plan:** item 15c
**Type:** Feature
**Verified:** 2026-10-04, 083986a07e34 (autopilot), every done-when proven except CI on the pull request, which needs a push (`ship`). Proof: `npm run verify` pass, 483 unit tests; full `npm run test:e2e` 324 passed locally with real R2, none skipped (16 in `password-reset.spec.ts`); the three step-3 mutations each seen red (the `used_at` guard only together with the live-link check, see Decisions); security log from the e2e server output shows `password_reset_requested` x15, `password_reset_completed` x4, `reset_rate_limited` ip and email, each with ids only and no email or token; p95 of 20 local reset completions 366 ms (median 230 ms), under the 1 s bar
**Reviewed:** 2026-10-04, 083986a07e34, current, every lens (independent `reviewer`, inside autopilot) - 0 blocking; 5 P3 raised (F-243 to F-247), none repaired

## Goal

A person who has forgotten their password can get a link by email, choose a
new password, and be signed in. Every other session they had ends. Until now,
the only way back in was to ask a site admin. With public signup, most sites
have one member, and that member has no one to ask. The plan's *Auth boundary*
sets the rules: the same answer whether or not the email has an account, a
single-use link that lasts an hour, and a completed reset bumps
`token_version`.

## In scope

- **The switch.** Reset by email is on exactly when email is configured
  (`SMTP_URL` and `EMAIL_FROM`), whatever `SIGNUP_MODE` is (plan *Switches*).
  When email is off, both pages are Not Found and the login page keeps today's
  "Ask an admin of this site to reset it". Setting only one of the two email
  variables now stops startup.
- **`/forgot-password`** - "Reset your password": one Email field and **Send
  me a link**. The answer is always the same. Behind it, a confirmed account
  with an active membership gets a 1-hour reset link, and any earlier unused
  reset links for that account stop working.
- **`/reset-password?token=…`** - "Choose a new password": one New password
  field. Opening the link changes nothing. Submitting it does four things in
  one transaction: uses the link, sets the password, bumps `token_version`
  (every other session signs out) and uses up the account's other reset links.
  It then signs this browser in and lands on `/admin`. An unknown, used or
  expired link shows "This link has expired or was already used", with a way
  to ask for a new one.
- **Login** - "Forgot your password?" becomes a link to `/forgot-password`
  when email is on.
- **Platform paths and reserved slugs** - `/forgot-password` and
  `/reset-password` are admin-host paths, like `/signup` and `/verify`, until
  item 16. Both become reserved page slugs.
- **Rate limits and security events** for reset requests and completions
  (plan *Auth boundary*).

## Out of scope

- **Changing your password while signed in** - 15e (*Your account*).
- **A site admin resetting a member's password** - unchanged
  (`/admin/users/:id`). The plan keeps it while each user belongs to one site.
- **Unconfirmed accounts.** They get no reset email (Decisions). They confirm
  through *Send it again* on `/signup/sent`, which signs them in without a
  password. F-233 (signup turned off strands them) stays in the backlog.
- **Backlog findings on the same code**, left as they are. A fix to only the
  reset copy would make the two paths differ:
  - F-234, a send failure logged with no cause. The reset failure log copies
    today's shape.
  - F-237, account pre-hijacking.
  - F-238, resend timing. Reset has the same small timing gap and accepts it
    for the same reason (Decisions).
- **A confirmation message after a reset.** The person lands on `/admin` like
  `/verify` does. The admin has no flash-message mechanism, and adding one is
  its own item.
- **HTML email.** Plain text, as in 15b.

## Design reference

- `design.md` *Navigation map*: "Forgot password" is a signed-out screen. The
  *Screens* row reads "Forgot password -> email -> reset -> signed in |
  item 15; the signup layout". Journey 7: "Reset your own password -> what
  happens to your session -> where you end up".
- **Not mocked, and new to the record.** Both pages use the layout of
  `/signup/sent` and `/verify` (`signup.module.css`, `.auth.single`): the
  brand mark, an `h1`, a lede, the kit's `Message` for success or error, one
  `Field`, and one primary `Button`.
  - `/forgot-password`:
    - `h1` "Reset your password";
    - lede "Enter the email you log in with and we'll send you a link to
      choose a new password.";
    - Email field, then **Send me a link**;
    - after a request, a success `Message`: "If an account uses <email>,
      we've sent a link to reset its password." / "It can take a minute to
      arrive. Check your spam folder too. The link works for 1 hour.";
    - a "Back to log in" link under the form.
  - `/reset-password`:
    - `h1` "Choose a new password";
    - a New password field (`autocomplete="new-password"`) with the hint "At
      least 12 characters", then **Save and log in**;
    - the expired state: `h1` "Reset your password", an error `Message` "This
      link has expired or was already used.", and a link "Ask for a new link"
      to `/forgot-password`. It is a link because it goes somewhere.
  - Step 4 records both pages in `design.md`'s *Screens* row.

## Build steps

- [x] **Step 1 - The switch, the paths and the slugs**
  - `app/lib/email-env.server.ts`:
    - gains `isEmailOn(env)`, true when both `SMTP_URL` and `EMAIL_FROM` are
      set;
    - gains a rule that `SMTP_URL` and `EMAIL_FROM` are both set or both
      unset. One alone stops startup with a message that names the missing
      variable, never a value. `envSchema` applies it with
      `requireEmailForSignup`.
  - `isPlatformPath` (`content-security-policy.ts`) adds `/forgot-password`
    and `/reset-password`, so both pages get the admin CSP area and Habre's
    look. Host routing redirects them from the public host, through the same
    function.
  - `RESERVED_PAGE_SLUGS` adds `forgot-password` and `reset-password`.
  - The host-split server in `playwright.config.ts` sets `SMTP_URL=` and
    `EMAIL_FROM=` explicitly. Otherwise, locally it would pick them up from
    the developer's `.env`, which `--env-file` does not override, while CI has
    none. Blank counts as unset, so that server is email-off in both places.
  - `.env.example`'s comment says the two email variables go together and
    also turn on password reset.

  *Done when:* `node --test` shows:
  - `email-env.server.test.ts`: `SMTP_URL` alone throws naming `EMAIL_FROM`;
    `EMAIL_FROM` alone throws naming `SMTP_URL`; neither parses with signup
    off; `isEmailOn` is true only with both;
  - `content-security-policy.test.ts` and `host-routing.test.ts`: both paths
    are platform paths, and `/forgot-passwords` is not;
  - `slug.test.ts`: a page titled "Forgot password" gets `forgot-password-2`.

  `npm run verify` passes.

- [x] **Step 2 - Asking for a reset link**
  - Add `app/features/signup/reset-email.ts`, a pure function like
    `verification-email.ts`. It returns:
    - subject "Reset your Habre password";
    - a link to `${ADMIN_URL}/reset-password?token=…`;
    - "works once and for 1 hour";
    - "If you didn't ask for this, ignore this email. Your password has not
      changed."
    - It exports `RESET_LIFETIME_HOURS = 1`.
  - Add `app/features/signup/password-reset.server.ts` with
    `issueResetToken(email)`. It runs one transaction:
    - select the user `for update` where the email matches,
      `email_verified_at is not null`, and the user has a membership with
      `deactivated_at is null`;
    - if there is one, mark that user's unused `reset` tokens used;
    - issue a new token through `issueEmailToken(tx, id, "reset", 1 hour)`;
    - return `{ userId, name, token }`, or null.
  - Add `app/features/signup/forgot-password.tsx` at `/forgot-password`,
    registered in `routes.ts`. It follows *Design reference*.
    - The loader and the action answer 404 unless `isEmailOn(env)`.
    - The action limits the body with `isSignupBodyAllowed`, then validates
      with `emailSchema`. An invalid email shows its error beside the field,
      with the typed value kept.
    - It counts the request in `resetRequestLimits`: a second instance of
      `createResendLimits()`, exported from `resend-rate-limit.server.ts`,
      with its own counters, 5 an hour per IP and 3 an hour per email. A
      refusal answers 429 with "Too many requests, wait an hour."
    - Then it calls `issueResetToken`. When that returns a user, it sends the
      email without awaiting it, as Send it again does.
    - The reply text is identical for every address.
  - Security events:
    - `password_reset_requested` `{userId}`;
    - `reset_rate_limited` `{scope: "ip" | "email", ip}`;
    - `email_send_failed` widens to `purpose: "verify" | "reset"`.

    None carries an email address or a token.
  - `e2e/helpers/mail.ts`: `tokenFromMail` takes the link's path
    (`/verify` or `/reset-password`).

  *Done when:*
  - `node --test` covers `reset-email.ts`: the link, the 1-hour wording, and
    no HTML.
  - Playwright, in a new `e2e/password-reset.spec.ts` on the primary server.
    Each test uses its own site from `createSite` + `createSiteAdmin`, a
    random `X-Forwarded-For`, and `deleteSite` in `afterEach`.
    - **A confirmed admin:** the request shows the neutral reply. Mailpit
      holds one email to that address with a `/reset-password?token=` link.
      In the database, the token's row has `purpose = 'reset'`, stores only
      the SHA-256 of the token, and `expires_at` is about an hour away
      (between 59 and 61 minutes).
    - **The neutral answer:** for an email with no account, for an
      unconfirmed user and for a deactivated member, the reply text is
      identical to the confirmed admin's, and Mailpit receives nothing for
      them.
    - **A second request:** the first token's row now has `used_at` set, and
      the second's does not.
    - **Per email:** a fourth request for one email within the hour answers
      429, and Mailpit holds three emails, not four. Each request uses a
      different `X-Forwarded-For`.
    - **Per IP:** a sixth request from one `X-Forwarded-For`, for different
      emails, answers 429.
    - An invalid email shows "Enter an email address like
      name@example.org." beside the field, linked by `aria-describedby`.
  - The host-split server (email off): `/forgot-password` answers 404.
  - Screenshots at 390 px and 1280 px are kept for `verify`.

- [x] **Step 3 - Choosing the new password**
  - `password-reset.server.ts` gains two functions.
    - `isResetTokenLive(token)`, read only: an unused, unexpired `reset` token
      with this hash exists.
    - `completeReset(token, passwordHash)`, one transaction that:
      - marks the token used, with `update email_tokens set used_at = now()
        where token_hash = … and purpose = 'reset' and used_at is null and
        expires_at > now() returning user_id`;
      - checks that the user is still confirmed and has an active membership,
        and otherwise rolls back and returns null;
      - sets `password_hash` and `token_version = token_version + 1`;
      - marks the user's other unused `reset` tokens used;
      - returns `{ userId, tokenVersion }`.
  - Add `app/features/signup/reset-password.tsx` at `/reset-password`,
    registered in `routes.ts`. Both the loader and the action answer 404
    unless `isEmailOn(env)`.
    - **GET** cleans the token as `verify.tsx` does (non-empty, at most 200
      characters). It shows the form when `isResetTokenLive` holds, and the
      expired state otherwise. It changes nothing, so a mail scanner that
      opens the link leaves it working.
    - **POST** limits the body and validates the password with
      `newPasswordSchema`. An invalid password shows the error beside the
      field, and the token stays in the hidden field. The password itself is
      never rendered back.
    - It checks `isResetTokenLive` **before** any scrypt work, so a guessed
      token costs no hash.
    - It takes a `passwordCheckSlots` slot, the slots login and signup share.
      With none free, it answers "Busy, try again in a minute" with 503.
    - It hashes, then calls `completeReset`. Null shows the expired state.
      Success signs a session with the new `tokenVersion`, sets the cookie as
      `/verify` does, logs `password_reset_completed` `{userId}` and redirects
      to `/admin`.
    - There is no per-IP limit on the POST. The token is 256 random bits, as
      on `/verify`.
  - `login.tsx`: when `isEmailOn(env)`, the help line becomes "Forgot your
    password?", a link to `/forgot-password`. Otherwise it keeps today's text.

  *Done when:* Playwright (`password-reset.spec.ts`) shows the following.
  - **Journey 7, end to end:**
    - a site admin is signed in in browser context A;
    - in context B, log in page -> "Forgot your password?" ->
      `/forgot-password` -> their email -> Send me a link;
    - the link from Mailpit -> a new password -> Save and log in;
    - B ends on `/admin/posts`, on a full page load, showing their own site;
    - A's next navigation to `/admin/posts` lands on the login page (every
      other session ends);
    - logging in with the old password is refused, and with the new one
      succeeds.
  - **Scanner then person:** a GET of the link from a separate request
    context, then the person's submit, still resets.
  - **Used once:** submitting the same link again shows the expired state, and
    the password is unchanged from the first reset.
  - **Only the newest link:** after two requests, the first email's link shows
    the expired state on GET, and the second works.
  - **Expired:** a token whose `expires_at` the owner sets in the past shows
    the expired state on GET and on POST, and changes nothing.
  - **Deactivated after the request:** the owner deactivates the membership
    after the email is sent. Submitting then shows the expired state, the
    password is unchanged and there is no session.
  - **A short password:** shows "Use at least 12 characters for the password."
    beside the field, linked by `aria-describedby`. The link still works
    afterwards (journey 8).
  - **The login link:** the primary server's login page links "Forgot your
    password?" to `/forgot-password`. The host-split server's login page shows
    "Ask an admin of this site to reset it" and `/reset-password` answers 404.
  - **Security log, by hand in `verify`:** no browser test reads the server's
    output. A local `npm start` run through journey 7 prints
    `password_reset_requested` and `password_reset_completed` with the user's
    id, and no email, token or hash.

  **Seen failing first:**
  - dropping `used_at is null` from the completion update, which fails Used
    once;
  - dropping the `token_version` bump, which fails journey 7's context A;
  - dropping the membership check, which fails Deactivated after the request.

  `build` records each red run.
  **Timing (quality bar, admin saves under 1 s at p95, server-side):**
  `verify` times 20 local completions and reports the p95.

- [x] **Step 4 - CI, docs and the record** _(CI on the pull request not yet run: it needs a push, which autopilot never does - `ship` checks it)_
  - `AGENTS.md`'s *Environments* `development` row says the two email
    variables go together and turn on password reset.
  - `design.md`'s *Screens* row for "Forgot password" becomes **built**
    (item 15c), described as in *Design reference*.
  - CI needs no change: the `e2e` job already runs Mailpit, and this spec
    uploads nothing, so it is not skipped.

  *Done when:*
  - `npm run verify` passes;
  - the full `npm run test:e2e` passes locally with real R2, none skipped;
  - the pull request's CI run is green on both jobs, with
    `password-reset.spec.ts` run in `e2e`.

## Files and areas

- `app/lib/email-env.server.ts` (+ `email-env.server.test.ts`) - `isEmailOn`,
  the pair rule; `app/lib/env.server.ts` applies it.
- `app/lib/content-security-policy.ts`, `app/lib/host-routing.ts` (tests only,
  if the function is shared), `app/features/content/slug.ts` (+ tests).
- `app/lib/security-log.server.ts` - the new events.
- `app/features/signup/` - new: `reset-email.ts` (+ test),
  `password-reset.server.ts`, `forgot-password.tsx`, `reset-password.tsx`;
  changed: `resend-rate-limit.server.ts` (`resetRequestLimits`).
- `app/features/auth/login.tsx` - the link.
- `app/routes.ts` - `forgot-password`, `reset-password`.
- `playwright.config.ts`, `.env.example`, `AGENTS.md`,
  `blueprint/context/design.md`.
- `e2e/password-reset.spec.ts` - new; `e2e/helpers/mail.ts` - the token path.

## Data and contracts

- **No migration.** `email_tokens` from 0012 already allows
  `purpose = 'reset'` and is indexed on `user_id`. Reset tokens are 32 random
  bytes in base64url, stored as SHA-256 hex, and live for 1 hour
  (`RESET_LIFETIME_HOURS`).
- **Routes:**
  - `/forgot-password`: GET, and POST to request a link;
  - `/reset-password`: GET with `?token=` shows the form, POST with `token`
    and `password` sets it.

  Both are on the admin host until item 16, which moves platform paths to
  `app.<platform domain>`.
- **`isEmailOn(env): boolean`** - load-bearing. Item 19's contact-form
  notifications and 15e's change of email will read it too.
- **Configuration:** `SMTP_URL` and `EMAIL_FROM` are both set or both unset.
  This is new, and production has neither today.
- **Security events:** `password_reset_requested` `{userId}`,
  `password_reset_completed` `{userId}`, `reset_rate_limited`
  `{scope: "ip" | "email", ip}`, and `email_send_failed`'s `purpose` gains
  `"reset"`. The admin's `password_reset` `{userId, actorId}` is unchanged.

## Testing

- **Unit (`npm test`, inside `verify` and CI's `verify` job, no database):**
  - the pair rule and `isEmailOn`;
  - platform paths;
  - reserved slugs;
  - the reset email's text.
- **Browser (`npm run test:e2e`):** `e2e/password-reset.spec.ts`.
  - It needs the dev database and Mailpit (`docker compose up -d`).
  - The primary server has email on. The host-split server is email-off
    through explicit blanks (step 1), which gives the 404 and login-text
    checks.
  - In CI it runs in the `e2e` job against its Mailpit service, and is not
    skipped.
  - Mail is found by recipient, so `workers: 2` cannot cross messages.
- **Seen failing first:** the three in step 3.
- **By hand, in `verify`:** the completion timing and the security-log lines.
  No browser test reads the server's output.

## Decisions

- **Reset is on exactly when email is configured,** whatever `SIGNUP_MODE`
  is. It beat tying it to signup: a self-hosted copy with `create-admin`
  accounts and SMTP should have reset, and the plan's *Switches* table
  already says so.
- **`SMTP_URL` and `EMAIL_FROM` must be set together.** It beat accepting one
  alone, which would silently leave reset off and the login page saying "ask
  an admin" on a server where email was meant to be on.
- **Only a confirmed account with an active membership is sent a link:** the
  same people who can log in. It beat sending to any account. A deactivated
  member could not sign in afterwards anyway. An unconfirmed account confirms
  through Send it again, which already signs the person in.
- **The link opens a form, and only the POST uses it,** as `/verify` does
  (D251), so mail scanners cannot use a link up. GET checks the token
  read-only, so a dead link says so before anyone types a password.
- **Completing a reset signs this browser in and every other session out:**
  `token_version` is bumped, and the person lands on `/admin`. This answers
  journey 7. It also uses up the account's other unused reset links. Every
  other refusal would show the same expired state.
- **The request does not wait for the mail server.** The reply is the same,
  and a failed send is logged (plan *Failure modes*: "Reset: the same neutral
  reply, failure logged"). A real account still costs one small transaction
  more than a missing one. That gap is accepted under the rate limits, as for
  Send it again (F-238).
- **Limits:** 5 reset requests an hour per IP and 3 an hour per email, on
  counters separate from Send it again's. The completion has no per-IP limit
  (256-bit token), checks the token before any scrypt work, and shares the
  password-hash slots with login and signup.
- **Reset lives in `app/features/signup/`,** as plan section 6 places it
  ("`signup` (signup, email verification, password reset)").
- **Settled while building (autopilot, 2026-10-04):**
  - `/forgot-password` keeps the typed email in the field after every answer,
    the neutral reply and a 429 included. A 429 reads "Too many requests, wait
    an hour." / "Then ask for a link again." (step 2).
  - The reset screenshots in `blueprint/reference/15c/` were taken once. The
    browser tests do not write them, so a test run never changes the
    repository (step 2).
  - **The `used_at is null` guard in `completeReset` is backed up by the
    live-link check before scrypt.** Dropping it alone turned no test red: a
    used link is refused before `completeReset` runs, so only two submits at
    once could reach it. With both removed, "a link works once" failed. No
    concurrent-submit test was added (step 3).
  - When both password-hash slots are taken, the reset form shows "Busy, try
    again in a minute." with the link kept, and nothing is logged (step 3).
  - `completeReset` rolls back by throwing inside the transaction, so a
    refused reset leaves the link unused. The deactivated-member test checks
    that (step 3).

## Production needs

- **None new.** Reset turns on in production when `SMTP_URL` and
  `EMAIL_FROM` are set in `/etc/habre-cms/production.env`. 15b's production
  needs and `needs-you.md`'s Resend line already list them.
- **New refusal:** setting only one of the two stops startup.

## Behaviour changes

- Adds to `accounts`: with email configured, asking for a password reset link gives the same answer whether or not the email has an account, and only the newest link works - Step 2 and Step 3
- Adds to `accounts`: the reset link sets a new password once and within an hour, signs the person in on that browser and signs them out everywhere else - Step 3
- Adds to `accounts`: opening the reset link changes nothing until the person submits a new password - Step 3
- Adds to `accounts`: with email not configured, `/forgot-password` and `/reset-password` are Not Found and the login page says to ask an admin - Step 2 and Step 3

## Notes

- **Never render the password back**, and never put an email, a token or a
  hash in a log line (`fundamentals.md`, *Logging*).
- **The token travels only in the email and the query string.**
  - Caddy's access log records the query string. That is the same accepted
    risk as `/verify`, with a 1-hour life.
  - `server.js` already sends `Referrer-Policy: strict-origin-when-cross-origin`,
    and the page loads nothing from another origin, so the token does not
    leak through `Referer`.
- **Semantic HTML** (`coding-standards.md`): one `main` and one `h1` per page;
  a `label` for every field; each action is a `button` in a `form`; "Back to
  log in" and "Ask for a new link" are `a`. Both pages work without
  JavaScript.
- **D151:** `users`, `site_members` and `email_tokens` are platform tables,
  outside row-level security, and these queries concern a user, not a site.
  No `inSite` is needed. The membership check in `completeReset` is what keeps
  a deactivated member out.
- **React Router 8:** the installed docs decide `data()` status handling and
  `redirect` with headers. Copy the patterns already in `verify.tsx`.
- **No new dependency.**
- **Accessibility:** both pages join `needs-you.md`'s admin screen-reader pass
  (widened by this spec).
