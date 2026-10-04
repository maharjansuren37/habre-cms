# Feature: Signup

**From build plan:** item 15b
**Type:** Feature
**Verified:** 2026-10-04, 9e60f7655568, 31 of 31 proven (Confirm pressed twice shows "already confirmed" - owner accepted 2026-10-04, see Decisions; CI on PR #33, run 37173326493: verify pass, e2e 302 passed / 6 R2 skipped, all 23 signup.spec.ts tests ran and passed)
**Reviewed:** 2026-10-04, 9e60f7655568, current, every lens (independent `reviewer`) - 0 blocking; 10 P3 raised (F-233 to F-242)

## Goal

A stranger with an invite code can create an account and a site of their own:
they choose the site's address, get an emailed link, and the link confirms their
address and signs them in as the admin of their new, empty site (D161). This is
the front door of platform v1 and the first time Habre sends email.

## In scope

- **Schema:** `users.email_verified_at`, and the `email_tokens` and `invites`
  tables from plan section 6, *Data model*.
- **The email module:** `nodemailer` over SMTP (D156), configured by
  `SMTP_URL` and `EMAIL_FROM`. Development and CI send to **Mailpit**, a local
  SMTP catcher, so no Resend account is needed to build or test.
- **The signup switch** `SIGNUP_MODE` (`off` | `invite` | `open`, default
  `off`), plan *Switches*. When signup is on and email is not configured, the
  app does not start.
- **`npm run create-invite`**, an operator command (D158). It prints a
  single-use code once, and only the code's hash is stored.
- **`/signup`** - name, email, password, the site's address and, in `invite`
  mode, the invite code. One transaction creates the user (unconfirmed), the
  site, the admin membership, the site's settings row and a verification
  token, and uses up the invite. The email is sent after the commit.
- **`/signup/sent`** - "Check your email", with **Send it again**. It also
  shows "We couldn't send the email" when the send failed (plan *Failure modes*).
- **`/verify`** - the emailed link opens a confirm page. Pressing **Confirm my
  email** confirms the address, signs the person in and lands on `/admin`.
- **Login refuses an unconfirmed account.** A correct password on an
  unconfirmed account goes to `/signup/sent` instead of signing in. While signup
  is on, the login page links to `/signup`.
- **Platform paths on the admin host.** `/signup*` and `/verify` route, take
  the admin CSP area and use Habre's look like `/admin/*`, until item 16 adds
  the platform host. `signup` and `verify` become reserved page slugs.
- **Rate limits and security events** for signup and resend (plan *Auth
  boundary*).
- Users made by `create-admin` and by an admin on `/admin/users/new` are
  confirmed when created, as they are able to sign in today.

## Out of scope

- **Password reset by email** - 15c. It reuses `email_tokens` (`purpose`
  `reset`) and `sendEmail`, both locked here.
- **The storage cap** - 15d.
- **Serving a site at its address**, and the `.habre.page` suffix beside the
  address field - item 16. No sites domain is configured yet. The field shows
  no suffix, and its hint says the address can't be changed later.
- **Onboarding `/start`** - item 18. Confirming lands on `/admin` until then.
- **Terms and Privacy links** under the form. The texts don't exist yet; that
  is already in `needs-you.md`. The line is left out rather than linking
  nowhere.
- **HTML email.** Plain text only (Decisions).
- **Cleaning up signups that are never confirmed.** An unconfirmed account
  keeps its email and address indefinitely. Someone who signed up with another
  person's email blocks that person from signing up until an operator removes
  the account. The planned `delete-site` command covers it; it is not in this
  item.
- **"Your account" (name, email, password, delete account)** - 15e, added at
  this spec's gate.

## Design reference

- `prototypes/signup.html` - the layout, the field order, the error summary
  ("One thing to fix") with the error beside the field, and the address-taken
  error with two suggestions. The `.auth` layout already exists in
  `app/features/auth/login.module.css` (item 13b). Signup reuses it, including
  the from-1024px aside "What happens next" with the mockup's three lines.
- **Not mocked, and new to the record:** "Check your email" (`/signup/sent`)
  and the confirm page (`/verify`), including its expired and used states. Each
  is the `.auth` layout with a heading, one paragraph, the kit's `Message` for
  an error, and one primary button. `ship` adds both to `design.md`'s Screens
  table.
- Copy differs from the mockup in one place. The mockup's foot says "Sign in",
  but the login page is titled and labelled "Log in", so signup's foot reads
  "Already have an account? Log in" until both are renamed together.

## Build steps

- [x] **Step 1 - Migration 0012: a fresh start, confirmed emails, email tokens, invites** - add `db/migrations/0012_signup.sql`, following *Data and contracts*. **v1 starts with no accounts (owner, 2026-10-04).** The migration deletes every entry, media row, membership and user, empties every site's menu, and keeps the sites and their settings rows. No user is backfilled as confirmed. `createUser` sets `email_verified_at = now()`, which covers `create-admin` and `/admin/users/new`, so the first admin after the migration comes from `create-admin`. `e2e/helpers/sites.ts` `createSiteAdmin` inserts users as confirmed. `deleteSite` needs no change, because `email_tokens` cascade with their user and `invites.used_by_site_id` is set to null. *Done when:*
  - `npm run db:migrate` applies 0012 against the dev database.
  - Afterwards, `users`, `site_members`, `entries` and `media` are empty, and `sites` and `site_settings` keep their rows with `navigation = '[]'` and no logo or home page.
  - `npm run create-admin` makes a confirmed admin of site 1, who can log in.
  - As the app role, `insert` and `select` on `email_tokens` and `invites` succeed. The default privileges from `db/roles.sql` cover the new tables.
  - `npm run verify` and the full `npm run test:e2e` pass unchanged.
- [x] **Step 2 - The email module and the switches** - install `nodemailer` and `@types/nodemailer`, each pinned exactly (D156). Add `app/lib/email.server.ts` exporting `sendEmail({ to, subject, text })`, with a transport made once from `SMTP_URL` and 10-second connection, greeting and socket timeouts. `env.server.ts` gains:
  - `SIGNUP_MODE`, default `off`;
  - `SMTP_URL`, `smtps://` or `smtp://`, where `smtp://` is accepted only for a loopback host such as `127.0.0.1`, `localhost` or `::1`, because a plain connection over the internet would carry sign-in links in clear;
  - `EMAIL_FROM`.

  Signup `invite` or `open` without both email variables stops startup with a message naming the missing variable. Add Mailpit to `compose.yaml` with its image tag pinned, SMTP on `127.0.0.1:1025` and its web UI and API on `127.0.0.1:8025`. Add `SMTP_URL`, `EMAIL_FROM` and `SIGNUP_MODE` to `.env.example`, with the Resend form `smtps://resend:<key>@smtp.resend.com:465`. *Done when:*
  - `node --test` covers the rules in `env.server.ts`'s schema:
    - signup off with no email variables parses;
    - `invite` without `SMTP_URL` throws naming `SMTP_URL`;
    - `smtp://mail.example.com` is refused;
    - `smtp://127.0.0.1:1025` and `smtps://…:465` parse.
  - With `docker compose up -d`, a one-off `node -e` call to `sendEmail` against Mailpit shows the message, with the right sender, subject and text, in Mailpit's UI. `verify` reproduces this.
- [x] **Step 3 - Invite codes and `create-invite`** - add `app/features/signup/invite-code.ts`, pure functions:
  - generate a code of 12 characters from Crockford base32 (no `0 O 1 I L`), shown as three groups of four (`7K2Q-M9XD-HC4V`);
  - normalise what a person types (trim, uppercase, drop spaces and dashes);
  - hash it with SHA-256.

  Add `scripts/create-invite.ts` (`npm run create-invite -- --note "for Lena"`), modelled on `create-admin.ts`. It connects with `DATABASE_URL`, inserts the hash and the note, prints the code once and never prints the hash. *Done when:*
  - `node --test` shows that:
    - codes match the format;
    - 1,000 generated codes are distinct;
    - `"7k2q m9xd-hc4v "` normalises to the same hash as `7K2Q-M9XD-HC4V`.
  - Running the command prints one code, and `select code_hash, note from invites` shows the hash, not the code.
- [x] **Step 4 - Platform paths on the admin host** - in `host-routing.ts`, `/signup`, `/signup/*` and `/verify` are platform paths, treated like `/admin*`: allowed on the admin host, and redirected from the public host (GET/HEAD) or refused (other methods). `areaForPath` gives them `admin`, so `root.tsx` serves Habre's look and not the site scope. Add `signup` and `verify` to `RESERVED_PAGE_SLUGS`. *Done when:*
  - `host-routing.test.ts`, `content-security-policy.test.ts` and `slug.test.ts` gain these cases and pass.
  - A page titled "Signup" gets the slug `signup-2`, as the existing reserved slugs do.
- [x] **Step 5 - Site address rules and signup input** - add `app/features/signup/site-address.ts`:
  - **validation:** 3-63 characters, lowercase letters, digits and hyphens; no hyphen first or last; not starting `xn--`; not in the reserved list in *Data and contracts*;
  - **normalisation:** trim and lowercase;
  - **`addressSuggestions(address, name)`:** an ordered list of valid candidates. Its order is the person's name joined (`lenanovak`), then `<address>-site`, `<address>-web` and `<address>-2` to `-9`, with the address itself and invalid or reserved candidates removed. The server keeps the first two that are free.

  Add `app/features/signup/signup-input.ts`, a Zod form schema reusing `nameSchema`, `emailSchema` and `newPasswordSchema`. The invite code is required only when the mode is `invite`. Per-field messages are in the mockup's voice. The body is limited to 8 KB, as the user form is. *Done when:*
  - `node --test` covers each address rule, with a message per rule.
  - `node --test` covers suggestion order and filtering.
  - `node --test` shows the invite field required in `invite` and ignored in `open`, and an oversized body refused.
- [x] **Step 6 - The signup page** - add `app/features/signup/signup.tsx` at `/signup`, registered in `routes.ts`. It follows `prototypes/signup.html` in the `.auth` layout, with the aside. The loader returns 404 when `SIGNUP_MODE` is `off` and redirects a signed-in person to `/admin`. The action runs the step-5 schema and returns field errors with the summary, the error beside each field and the input kept (never the password). A valid submit has nothing to create yet and answers "Signup isn't ready yet" (removed in step 7). Mode `off` stays the default, so production is unaffected. The login page shows "New to Habre? Create your website" linking to `/signup` while the mode is not `off`. *Done when:*
  - **Playwright, the primary e2e server:** `playwright.config.ts` sets `SIGNUP_MODE=invite`, `SMTP_URL=smtp://127.0.0.1:1025` and `EMAIL_FROM`.
    - `/signup` shows the five fields by label.
    - Submitting with an invalid address and a short password shows "2 things to fix", each error beside its field linked by `aria-describedby`, and the name, email and address kept (journey 8).
  - **The host-split server**, signup off: `/signup` answers 404.
  - At 390 px and 1280 px, the page matches the mockup's layout. Screenshots are kept for `verify`.
- [x] **Step 7 - Creating the account and site** - add `app/features/signup/signup.server.ts`. `createSignup` generates the site's UUID in the app and runs one `inSite(siteId, …)` transaction that:
  - inserts the site;
  - inserts the user, with `email_verified_at` null;
  - inserts the admin membership;
  - inserts `site_settings` with `site_title` = the address;
  - in `invite` mode, uses up the code with `update invites … where code_hash = … and used_at is null returning id`;
  - inserts a verify token, 24 hours (`email-tokens.server.ts`: 32 random bytes in base64url, stored as SHA-256).

  It maps the unique violations `sites_subdomain_key` and `users_email_key` and a missing invite row to field errors. The address-taken error names two free suggestions from one query. After the commit it sends the verification email (`verification-email.ts`, a pure function returning subject and text with the `${ADMIN_URL}/verify?token=…` link), sets the pending-email cookie and redirects to `/signup/sent`, adding `?failed=1` when the send threw.

  Signup shares `passwordCheckSlots` with login. When none is free it answers "Signup is busy, try again in a minute", 503. The per-IP limiter (10 attempts an hour) answers 429. It logs `signup_created` `{userId, siteId, ip}`, `signup_rate_limited` and `email_send_failed` `{purpose, userId}`. *Done when:*
  - `node --test` covers `verification-email.ts`: link, expiry wording, no HTML.
  - Playwright (`e2e/signup.spec.ts`, with `e2e/helpers/mail.ts` reading Mailpit's API by recipient):
    - **The account and its email:** a signup with a fresh code creates the site, membership and settings, which the owner can see in the database. Mailpit holds one email to that address whose link carries a token, and the database stores only its hash.
    - **A used invite:** reusing that code shows "That invite code isn't valid or has been used" beside the field, and no second site or user exists.
    - **A taken address:** shows "…is taken. Try a or b", with both suggestions free, and the input kept.
    - **A taken email:** shows "An account with this email already exists", with a "Log in" link.
    - **A reserved address:** `www` is refused.
    - **Two signups at once** for the same address: one succeeds, and the other shows the address-taken error, not a 500.
    - **The per-IP limit:** the 11th signup attempt from one `X-Forwarded-For` within the hour answers 429, and no account is created.
  - With Mailpit stopped, a signup lands on "We couldn't send the email" with Send it again. `verify` checks this by hand; CI's Mailpit service cannot be stopped mid-run.
  - **Timing (quality bar, admin saves):** `verify` times 20 local signups against Mailpit, and the p95 is under 1 s server-side.
- [x] **Step 8 - Check your email, and Send it again** - add `app/features/signup/signup-sent.tsx` at `/signup/sent`. It shows "We sent a link to <email>" from the signed pending-email cookie (`createCookie`, `JWT_SECRET` as its secret, httpOnly, SameSite=Lax, 1 day), or an email field when the cookie is absent. With `?failed=1` it shows the error `Message`. **Send it again** gives the same answer every time: "If <email> is waiting to be confirmed, we've sent a new link." Behind that answer, for an unconfirmed user only, it marks their unused verify tokens used, issues a new one and sends it. It is limited to 5 an hour per IP and 3 an hour per email, and logs `verification_resent` `{userId}` or `email_send_failed`. *Done when:*
  - **Playwright, sending it again:**
    - after signup, Send it again puts a second email in Mailpit;
    - the first email's link no longer confirms;
    - the second one does.
  - **Playwright, the neutral answer:** for an address with no account, and for a confirmed account, the reply text is identical and Mailpit receives nothing.
  - The fourth resend for one email within an hour is refused with "Too many requests, wait an hour", and Mailpit holds no fourth email. `node --test` covers the limiter wiring if it is a pure helper. Otherwise Playwright does.
- [x] **Step 9 - Confirming, and login for unconfirmed accounts** - add `app/features/signup/verify.tsx` at `/verify`.
  - **GET** shows "Confirm your email" with one **Confirm my email** button and changes nothing, so an email scanner that opens the link does not use it up.
  - **POST** atomically marks the token used (`update email_tokens set used_at = now() where token_hash = … and purpose = 'verify' and used_at is null and expires_at > now() returning user_id`). It then sets `email_verified_at`, issues the session cookie as login does, logs `email_verified` `{userId}` and redirects to `/admin`.
  - An unknown, used or expired token shows "This link has expired or was already used", with a form to get a new link. A user who is already confirmed is told so, with "Log in".

  `login.tsx`: after a correct password, an unconfirmed user is not signed in. Login logs `login_failed` with `reason: "unverified"`, resets the login limiter as it does for a success, sets the pending-email cookie and redirects to `/signup/sent`. `findUserByEmail` returns `emailVerifiedAt`. *Done when:* Playwright shows:
  - **Journey 1, as far as this item reaches:** sign up with a code, take the link from Mailpit, open it, Confirm my email, and arrive at `/admin/posts` on a full page load. The new site's posts and pages lists are empty while site 1 has content (`sites.1` holds). The admin sees their own site's title, the address.
  - **Before confirming:** logging in with the right password lands on "Check your email" and gives no session (`/admin` redirects to login).
  - **The link opened twice:** a scanner-style GET followed by the person's Confirm still signs them in.
  - **Confirm pressed twice:** the second press shows "Your email is already confirmed" with Log in (owner, 2026-10-04).
  - **An expired token** (expiry set in the past by the owner in the database) shows the expired-or-used state and confirms nothing.
- [x] **Step 10 - CI, docs and the record** - in `.github/workflows/ci.yml`, the `e2e` job gains a Mailpit service at the same pinned tag, with ports 1025 and 8025. `AGENTS.md`: the Commands section says `docker compose up -d` also starts Mailpit, the `development` and `ci` Environments rows name `SIGNUP_MODE`, `SMTP_URL` and `EMAIL_FROM`, and `create-invite` is listed. The production row is left to `deploy`. *Done when:*
  - `npm run verify` passes, and the full `npm run test:e2e` passes locally with real R2, none skipped.
  - The CI run on the pull request is green on both jobs, with `signup.spec.ts` running in `e2e`, not skipped.

## Files and areas

- `db/migrations/0012_signup.sql` - new.
- `app/lib/email.server.ts`, `app/lib/env.server.ts` (+ test for the env rules).
- `app/features/signup/` - new feature: `invite-code.ts`, `site-address.ts`,
  `signup-input.ts`, `verification-email.ts` (each with a `.test.ts`),
  `email-tokens.server.ts`, `signup.server.ts`,
  `pending-email-cookie.server.ts`, `signup-rate-limit.server.ts`,
  `signup.tsx`, `signup-sent.tsx`, `verify.tsx`, `signup.module.css` if the
  login module's classes are not enough.
- `app/features/auth/login.tsx` - unconfirmed accounts, the signup link.
- `app/features/users/users.server.ts` - `createUser` confirms;
  `findUserByEmail` returns `emailVerifiedAt`.
- `app/lib/host-routing.ts`, `app/lib/content-security-policy.ts`,
  `app/features/content/slug.ts` (+ their tests).
- `app/lib/security-log.server.ts` - the new events.
- `app/routes.ts` - `signup`, `signup/sent`, `verify`.
- `scripts/create-invite.ts`; `package.json` (`nodemailer`,
  `@types/nodemailer`, `create-invite` script).
- `compose.yaml`, `.env.example`, `playwright.config.ts`,
  `.github/workflows/ci.yml`, `AGENTS.md`.
- `e2e/signup.spec.ts`, `e2e/helpers/mail.ts` - new;
  `e2e/helpers/sites.ts` - confirmed users, cleanup of tokens and invites.

## Data and contracts

**Load-bearing:** 15c, 18 and 19 build on these shapes.

**Migration `0012_signup.sql`** (owner role; the app role's default privileges
cover the new tables):

    -- A fresh start (owner, 2026-10-04): v1 begins with no accounts. In
    -- dependency order; the settings' logo and home page clear themselves
    -- through their foreign keys' "on delete set null".
    delete from entries;
    delete from media;
    update site_settings set navigation = '[]'::jsonb;
    delete from site_members;
    delete from users;

    alter table users add column email_verified_at timestamptz;

    create table email_tokens (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references users (id) on delete cascade,
      purpose text not null check (purpose in ('verify', 'reset')),
      token_hash text not null unique,      -- SHA-256 hex; the token is only in the email
      expires_at timestamptz not null,      -- verify 24 hours, reset 1 hour (15c)
      used_at timestamptz,
      created_at timestamptz not null default now()
    );
    create index on email_tokens (user_id);

    create table invites (
      id uuid primary key default gen_random_uuid(),
      code_hash text not null unique,       -- SHA-256 hex of the normalised code
      note text not null default '' check (length(note) <= 200),
      created_at timestamptz not null default now(),
      used_at timestamptz,
      used_by_site_id uuid references sites (id) on delete set null
    );

- Both are platform tables: no `site_id`, no row-level security (plan
  *Sites and tenancy*).
- **Not reversible: it deletes data.** Every user, membership, entry and media
  row is gone, and their R2 objects are left behind unreferenced, which is
  harmless (plan *Data rules*). The rollback is the pre-deploy backup, as for
  the rest of v1 (D163). It is a destructive migration with its own yes at the
  v1 deploy (`needs-you.md`). The schema half alone would reverse with
  `drop table invites; drop table email_tokens; alter table users drop column email_verified_at;`.
- `users.email_verified_at` stays nullable with **no default**: every insert
  path says whether the person is confirmed.

**Configuration** (`env.server.ts`):

| Variable | Values | Required |
|---|---|---|
| `SIGNUP_MODE` | `off` \| `invite` \| `open`, default `off` | no |
| `SMTP_URL` | `smtps://user:pass@host:port`, or `smtp://` to a loopback host only | when `SIGNUP_MODE` is not `off` |
| `EMAIL_FROM` | `Name <address>` | when `SIGNUP_MODE` is not `off` |

**`sendEmail({ to, subject, text }): Promise<void>`** throws on failure. The
caller decides what the person sees. It never logs the address or the text.

**Reserved site addresses:** `www`, `app`, `admin`, `api`, `media`, `mail`,
`smtp`, `imap`, `pop`, `ftp`, `cdn`, `static`, `assets`, `help`, `support`,
`status`, `blog`, `docs`, `habre`, `dev`, `test`, `staging`, `beta`, `root`,
`email`, `webmail`, `account`, `accounts`, `login`, `signup`, `billing`,
`security`.

**Routes:** `/signup` (GET, POST), `/signup/sent` (GET, POST resend), `/verify`
(GET confirm page, POST confirm). All three are on the admin host until item 16.

**Security events** added to `SecurityEvent`: `signup_created`,
`signup_rate_limited` `{scope: "ip" | "server", ip}`, `email_verified`,
`verification_resent`, `resend_rate_limited` `{scope: "ip" | "email", ip}`,
`email_send_failed` `{purpose: "verify", userId}`, and `login_failed` reason
`"unverified"`. None of them carries an email address, a token or a code.

## Testing

- **Unit (`npm test`, inside `verify` and CI's `verify` job, no database):**
  - the env rules;
  - invite codes;
  - address rules and suggestions;
  - the signup schema;
  - the verification email's text;
  - host routing, CSP area and reserved slugs.
- **Browser (`npm run test:e2e`):** `e2e/signup.spec.ts`.
  - It needs the dev database and Mailpit (`docker compose up -d`). The
    primary server runs with `SIGNUP_MODE=invite`. The host-split server keeps
    the default `off`, which is the 404 check.
  - In CI it runs in the `e2e` job against a Mailpit service (step 10). It
    uploads nothing, so it is not skipped there.
  - Each test uses its own random email, finds its message in Mailpit by
    recipient, so `workers: 2` cannot cross messages, and removes its site in
    `afterEach` with `deleteSite`.
  - Each test sends its own random `X-Forwarded-For`, the suite's existing
    pattern (`auth.spec.ts`), so the per-IP limits never trip across tests.
  - Invites come from a helper that inserts a hashed code as the owner.
- **Seen failing first:**
  - the unused-invite check, by dropping `and used_at is null`;
  - the single-use token, by dropping `used_at is null` in the confirm update;
  - unconfirmed login, by removing the check.
  `build` records each red run.
- **By hand, in `verify`:** the Mailpit-stopped failure path, and the step-7
  timing.

## Decisions

- **The emailed link opens a confirm page, and a POST confirms.** It beat
  confirming on GET. Mail scanners, Outlook's Safe Links among them, open links
  before the person does, and a single-use link opened by a scanner would be
  used up before the person clicks. D161 holds: the link confirms and signs in,
  with one press.
- **`SMTP_URL` plus `EMAIL_FROM`.** It beat separate host, port, user and
  password variables: one secret, in the form every provider documents.
  `smtp://` is refused unless the host is loopback, so sign-in links never
  cross the internet in clear.
- **`SIGNUP_MODE` defaults to `off`**, and turning it on without email
  configured stops startup (plan *Switches*). A self-hosted copy and today's
  production keep working with no new variables.
- **Mailpit for development and CI email.** It beat nodemailer's JSON
  transport in tests, which exercises no SMTP, and Resend test keys, which need
  an account and network access from CI. Resend is needed only to deploy.
- **Plain-text emails in v1.** No HTML to escape, render or test across mail
  clients. HTML comes when the emails need branding.
- **Signup says plainly that an email is already in use.** It beat a neutral
  reply plus a "you already have an account" email. The beta is invite-only,
  signup is rate-limited per IP, and a neutral reply would leave a person who
  mistyped with no explanation. The resend form stays neutral, because it needs
  no invite.
- **Site address rules:** 3-63 characters, a DNS label, not `xn--`, and the
  reserved list above, with a minimum of 3 so that one- and two-letter names
  stay free for later.
- **A new site's title is its address** until onboarding (item 18) sets a
  real one. `site_title` is required, and the address is the only name the
  person has given the site at that point.
- **Invite codes:** 12 Crockford base32 characters (60 bits), shown in three
  groups, stored as SHA-256, used once. With signup rate-limited per IP,
  guessing a code is not practical.
- **Rate limits:** signup 10 attempts an hour per IP; resend 5 an hour per IP
  **and 3 an hour per email**. The per-email limit goes beyond the plan's
  per-IP rule. It protects a person's inbox and Resend's 100-a-day free cap
  from one address being targeted from many IPs. Signup shares login's two
  password-hash slots.
- **v1 starts with no accounts** (owner, 2026-10-04). Migration 0012 deletes
  today's users, along with their memberships, entries and media. This beat
  backfilling them as confirmed: nothing from the single-site build needs to
  survive, and production's content is already test data (14a1's `0009`).
- **Users made by an admin or `create-admin` are confirmed when created.** The
  admin vouches for them, as today.
- **The email is sent inside the request, after the commit,** with a
  10-second timeout. It beat a background send: there is no queue (D154 keeps
  the one in-process job for AI), and the person must be told at once when the
  send failed.
- **Sending a new link marks the earlier unused ones used**, so only the
  newest link works.
- **`/signup*` and `/verify` are admin-host paths until item 16** makes the
  platform host. They need the session cookie, which is host-only on the admin
  host.
- **Confirming lands on `/admin`** until item 18 builds `/start`.
- **Settled while building (autopilot, 2026-10-04):**
  - Blank email and signup variables count as unset, so `.env.example`'s
    empty lines keep signup `off` (step 2).
  - `EMAIL_FROM` accepts `Name <address>` or a bare address (step 2).
  - The invite alphabet is 30 characters (`2-9`, `A-Z` without `I L O U`),
    so a code holds about 59 bits, not 60. Guessing is still impractical
    under the per-IP limit (step 3).
  - Signup form field names are `name`, `email`, `password`, `address`,
    `invite`. The invite field is capped at 100 characters. The address
    reports the first rule it breaks (step 5).
  - `isPlatformPath` in `content-security-policy.ts` is the one test for
    admin-host paths, used by both the CSP area and host routing (step 4).
  - The signup transaction inserts the site, then uses up the invite, then
    inserts the user. Without a valid code the invite error comes before any
    email check, so only an invited person learns that an email is taken,
    which is the condition the plain-email decision above rests on (step 7).
  - The per-IP signup limit counts every POST that reaches the form, valid
    or not, and is never reset by a success. 429 reads "Too many attempts.
    Wait an hour, then try again." The "Log in" link for a taken email sits
    in the error summary, since `Field` takes text only (step 7).
  - **Send it again does not wait for the mail server.** Waiting would make
    a real unconfirmed account answer slower than a missing one, and reveal
    it. A failed resend is logged as `email_send_failed` and the reply stays
    neutral. Only signup itself shows "We couldn't send the email" (step 8).
  - On `/signup/sent` the pending-email cookie wins over a typed address; the
    email field shows only when there is no cookie. A refused resend is not
    counted, so a block cannot extend itself (step 8).
  - **Owner's yes, 2026-10-04:** a used link whose account is confirmed shows
    "Your email is already confirmed" with Log in, so Confirm pressed twice
    shows that and not the expired-or-used state step 9's done-when names. A
    link can reach a confirmed account only once used, so the other reading
    would leave the "already confirmed" state unreachable. The expired-or-used
    state covers unknown, expired and superseded links. Reverting is one
    `used_at is null` condition in `verify.tsx` (step 9).
  - Login checks an unconfirmed email last, after the password, membership
    and deactivation checks, so those refusals are unchanged. Sessions are
    issued only by login and `/verify`, so `requireUser` does not re-check
    confirmation. `/verify` has no rate limit: its token is 256 random bits
    (step 9).

## Production needs

- **Migration `0012_signup.sql`**, with the v1 deploy (D163), on its own yes.
  It deletes every user, membership, entry and media row. Straight after it,
  run `npm run create-admin` on the server for site 1's first admin.
- **`SIGNUP_MODE`** in `/etc/habre-cms/production.env`: leave it unset (`off`)
  until the beta opens, then set it to `invite` (D150).
- **`SMTP_URL` and `EMAIL_FROM`** in `production.env` before signup is turned
  on. That needs a Resend account with an API key and a sending domain with
  SPF, DKIM and DMARC records (`needs-you.md`). The sending domain depends on
  the platform domain still to be bought.
- `nodemailer` is copied with `node_modules`, as every other package is. It
  has no native code.

## Behaviour changes

- New capability `accounts`: with signup on invite, a person with an unused invite code can create an account and a site, choosing its address - Step 7
- New capability `accounts`: an invite code works once - Step 7
- New capability `accounts`: a taken or reserved address is refused beside the field, a taken one with two free suggestions, and the form keeps what was typed - Step 7
- New capability `accounts`: with signup off, `/signup` is Not Found - Step 6
- New capability `accounts`: asking for a new link gives the same answer whether or not the address is waiting to be confirmed, and only the newest link works - Step 8
- New capability `accounts`: the emailed link confirms the address and signs the person in as the admin of their new, empty site, once and within 24 hours - Step 9
- New capability `accounts`: opening the emailed link changes nothing until the person presses Confirm my email - Step 9
- Changes `sites.4` from "a person can sign in only while they hold an active membership, and their role is the membership's" to "a person can sign in only while they hold an active membership and their email is confirmed, and their role is the membership's" - Step 9

## Notes

- **D151's two guards apply to the signup transaction.** It runs inside
  `inSite(newSiteId, …)`, and the `site_settings` insert names `site_id`. The
  site's UUID is generated in the app so that `inSite` can be entered before
  the site row exists.
- **Never render the password back**, and never put the email, token or code
  in a log line (`fundamentals.md`, *Logging*). The token travels only in the
  email and in the `/verify` query string.
  - Caddy's access log records the query string, so an unused token can sit in
    that log until it is used or expires. Accepted: the log is readable only by
    the server's operator, and the token dies at first use.
- **Semantic HTML** (`coding-standards.md`): one `main` and one `h1` per page,
  a `label` for every field, the aside as `aside` with a label, and the error
  summary as the kit's `Message`. Every action is a `button` in a `form`; the
  confirm page works without JavaScript.
- **Install pins:** `nodemailer`, `@types/nodemailer` and the Mailpit image tag
  are pinned exactly to what is installed. Record them in `AGENTS.md`'s *Stack
  and versions* and in plan section 5. That plan edit is shown to you before it
  is written.
- **React Router 8:** the installed docs decide `createCookie` secrets and
  `data()` status handling.
- **No new runtime dependency besides `nodemailer`**, which D156 already
  decided.
- `blueprint/findings/backlog.md` is long. It was not offered as a tidy item
  because this run named an item.

## Findings

None resolved in this item. F-231 (P2) stays in the ledger; F-232 to F-242
(P3) moved to `blueprint/findings/backlog.md` at ship.

## Prototypes kept

- `prototypes/signup.html` - removed: consumed by this item; the built `/signup` is the signup layout.
- `prototypes/start.html`, `start-brand.html` - kept for item 18 (onboarding, your brand).
- `prototypes/home.html` - kept for item 18 (Home after the AI draft).
- `prototypes/editor.html`, `site-home.html`, `components.html`, `theme.css`, `components.css`, `checks/`, `fonts/` - kept: items 16-20 still build screens from them (`design.md` *Screens*).
