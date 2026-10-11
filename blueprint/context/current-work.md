# Feature: Messages and the email (19c)

**From build plan:** item 19c
**Type:** Feature
**Verified:** not yet
**Reviewed:** not yet

## Goal

A site's owner sees what visitors sent. `/admin/messages` lists the site's
contact submissions (read / unread), and each new one is emailed to the
address the owner chose in Settings, or to every active admin of the site by
default. The message is saved first; the email is a notification that may
fail without losing anything (plan section 7, system design).

## In scope

- Migration `0022_contact_notify_email.sql`: `site_settings.contact_notify_email`
  (null = every active admin).
- Settings: a **Send messages to** field (admins), saved with the form.
- The notification: sent after the insert, never awaited by the visitor's
  request; `notified_at` set when at least one recipient accepted it.
- `/admin/messages`: newest first, paginated, Unread badge, Mark as read /
  Mark as unread (a form post, works without JavaScript), empty state, the
  "email failed" line, a line when the install has no email.
- The **Messages** nav entry (admins only).
- Journey 10 (design.md): a visitor sends the form -> it appears in Messages
  and arrives by email.

## Out of scope

- Deleting a message, replying from the admin, search, an unread count on the
  nav entry, export - not in the plan line; a message leaves with its site
  (19a). Deleting one is the first thing to add if owners ask.
- Retrying a failed email (the message is on screen; the owner reads it
  there).
- Per-member notification preferences; Messages for editors or authors (plan
  section 7: admin only).

## Design reference

`blueprint/context/design.md`: Messages is "the kit's list and empty state"
(*Screens*); journey 10. `blueprint/design-kit/components.html`: the list
rows, `.badge`, the empty state, `Message`'s notice tone. No new component:
the Unread badge and the buttons are existing ones. The email is plain text
(D156), so it has no design.

## Build steps

- [x] **Step 1 - The column and the Settings field** -
  `db/migrations/0022_contact_notify_email.sql`: `alter table site_settings add
  column contact_notify_email text check (contact_notify_email is null or
  length(contact_notify_email) <= 254)`. Header says additive, rollback by
  symlink safe, reversible by `drop column`. `SiteSettings` gains
  `contactNotifyEmail: string` (`""` for null); `saveSiteSettings` writes it
  (blank -> null) in the same transaction as the rest; `settings-input.ts`
  gains a Zod `contactNotifyEmailSchema` (trimmed, empty allowed, the same
  email shape as the contact form's, 254 max, "Enter a valid email address,
  or leave it blank."). Settings shows a labelled **Send messages to** field
  with the hint "Leave blank to send to every admin of this site." - and,
  when the install has no email (`env.SMTP_URL` unset), the hint instead says
  "This installation can't send email, so messages are only kept in
  Messages." *Done when:* `settings-input.test.ts` covers blank, valid, no
  `@`, 255 characters; `e2e/manage-settings.spec.ts` saves an address, reloads
  and sees it, clears it and sees it empty, and an invalid one shows the
  error beside the field and changes nothing; `npm run db:migrate` applies
  `0022` on the development database.
- [ ] **Step 2 - Who gets it, and what it says** - pure code in
  `app/features/contact/`: `notification-email.ts`
  `contactNotificationEmail({ siteTitle, visitorName, visitorEmail, message,
  pageTitle, messagesUrl })` -> `{ subject, text }` (plain text; subject
  `New message from <name> on <site title>` with the name's whitespace and
  control characters collapsed to single spaces and the whole subject cut at
  120 characters; body: who, their address, the page, the message verbatim,
  then the Messages link and "Reply to this email to answer them."), and
  `notificationRecipients(setting, admins)` -> the one set address, or every
  active admin's address, de-duplicated, lower-cased. `sendEmail` gains an
  optional `replyTo`. *Done when:* `notification-email.test.ts` shows: a name
  with a newline and a 300-character name give a one-line subject of at most
  120 characters; the message and address appear unchanged in the body; no
  HTML is produced; `notificationRecipients` returns the setting when set,
  de-duplicated admins when blank, and `[]` for no admins.
- [ ] **Step 3 - Send after the save** - `contact-submit.ts`: after
  `insertContactSubmission` (which now returns the new row's id), start the
  notification without awaiting it - load the site title, setting and active
  confirmed admins inside `inSite`, send one email per recipient with
  `replyTo` the visitor, set `notified_at = now()` (naming `site_id` and the
  id) when at least one send succeeded; a failure is caught and logged as a
  new `SecurityEvent` `contact_notify_failed { siteId }` (never an address or
  text). No `SMTP_URL`: nothing is attempted and `notified_at` stays empty.
  The 303 answer is unchanged and does not wait for SMTP. *Done when:*
  `e2e/contact.spec.ts` (Mailpit on 127.0.0.1:8025, as the signup tests use
  it): a valid post to a site with two admins and no setting puts one email
  in Mailpit for each admin address, `Reply-To` the visitor's address, the
  row's `notified_at` set; with a setting, only that address gets it; the
  honeypot and an invalid post send nothing; with SMTP pointed at a closed
  port (a second server, or a unit test of the sender with a throwing
  `sendEmail`) the row exists, `notified_at` is null, and the answer is
  still `sent`.
- [ ] **Step 4 - Reading and marking** - `app/features/contact/messages.server.ts`:
  `listMessages(siteId, page)` (20 a page, newest first, `entries` left-joined
  for the page title, total count, inside `inSite`, naming `site_id`),
  `setMessageRead(siteId, id, read)` (update naming `site_id` and the id;
  returns whether a row matched). Pure `messages-query.ts` parses `?page=`
  like `media-list-query.ts`. *Done when:* `messages-query.test.ts` covers
  junk, below 1 and above the cap; `e2e/site-isolation.spec.ts` (app role)
  shows site A's `setMessageRead` for site B's message id changes nothing.
- [ ] **Step 5 - The screen and the nav entry** - route `admin/messages` in
  the admin layout of `app/routes.ts`, `features/contact/messages.tsx`,
  `requireRole("admin")` (404 for others, D69). `h1` Messages; an `ol` of
  `article`s: name, the visitor's email as a `mailto:` link, a `time` with
  `datetime`, "Sent from <page title>" (or "a page that has been deleted"),
  the message text with line breaks kept (rendered as text, never HTML), an
  **Unread** badge, and a **Mark as read** / **Mark as unread** button (a
  `Form` post to the same route; a stale id is a no-op that redirects back).
  Beyond 20, the same pagination as Media; a page past the end redirects to
  the last. Empty state: "No messages yet." with "Add a contact form to a
  page from the editor's palette, and what visitors send appears here." The
  "email failed" line - "We couldn't email this message to you." - on a row
  with `notified_at` null **and** email configured **and** older than two
  minutes (so a send still in flight is not reported as failed). With no
  email on the install, one `Message` notice at the top: "This installation
  can't send email, so messages are only kept here." The nav gains
  **Messages** (admins only, an icon like its neighbours, between Pages and
  Settings). *Done when:* `e2e/messages.spec.ts` (new): an admin sees an
  empty state with no messages; a seeded message shows with name, a mailto
  link, the page and Unread; Mark as read removes the badge and Mark as
  unread brings it back, with JavaScript off; 21 messages paginate 20 + 1
  and `?page=99` lands on page 2; a message from a deleted page shows the
  deleted-page text; a message older than two minutes with no `notified_at`
  shows the failed line and a fresh one does not; an editor and an author
  get 404 and see no Messages link; the page has one `h1`, a labelled `nav`,
  and all controls are reachable by `getByRole`.
- [ ] **Step 6 - The journey** - extend `e2e/contact-form.spec.ts` with
  journey 10 end to end: a visitor fills the published page's form, sees the
  thanks line; the site's admin signs in at the platform host, opens
  Messages through the nav, sees the message unread, marks it read; Mailpit
  holds the notification with the same text. *Done when:*
  `npm run test:e2e -- contact messages manage-settings site-isolation`
  passes, output shown, and `npm run verify` is green.

## Files and areas

- `db/migrations/0022_contact_notify_email.sql` (new)
- `app/features/settings/` (`settings.server.ts`, `settings-input.ts`,
  `settings.tsx`, tests)
- `app/features/contact/` (`notification-email.ts`, `messages.server.ts`,
  `messages-query.ts`, `messages.tsx`, `messages.module.css`, tests;
  `contact-submit.ts`, `contact-store.server.ts`)
- `app/lib/email.server.ts` (`replyTo`), `app/lib/security-log.server.ts`
- `app/routes.ts`, `app/features/admin-shell/layout.tsx`
- `e2e/messages.spec.ts` (new), `e2e/contact.spec.ts`,
  `e2e/contact-form.spec.ts`, `e2e/manage-settings.spec.ts`,
  `e2e/site-isolation.spec.ts`

## Data and contracts

- **Load-bearing:** `site_settings.contact_notify_email` (text, null = every
  active admin). `contact_submissions.notified_at` is set only by the
  notification, only after a send was accepted; `read_at` only by Messages.
- `contactNotificationEmail` and `notificationRecipients` are the only places
  that decide an email's text and addressees.
- The answer codes and form fields from 19a are unchanged.

## Testing

Unit: the email text and recipients, the settings schema, the page query.
Browser (needs the development database and Mailpit, both in CI's `e2e`
job, so CI runs all of it; none of it touches R2). `npm test` stays free of
a database. Quality bar: the Messages list is one indexed query
(`(site_id, created_at)`, 0021) and a Settings save stays under the 1 s
admin-save bar, which the existing settings tests already measure around.

## Decisions

- **The email is sent after the answer, not before it (not awaited).** Beats
  awaiting it: a down SMTP server would hold a visitor's form for up to the
  10 s timeout. Costs: a restart in that moment loses the email; the row then
  shows the failed line after two minutes, which is true.
- **One email per recipient**, not one with many addresses: no admin sees
  another's address, and one bad address does not fail the rest.
- **Reply-To is the visitor, From stays `EMAIL_FROM`**: replying works
  without sending as the visitor (which SPF and DMARC would reject).
- **Read state is explicit** (a button), not set by opening: the list shows
  whole messages, so there is no "opening" to hang it on.
- **The failed line waits two minutes**, so an in-flight send is not
  reported as failed.
- **Admins only** sees Messages, as plan section 7 says; visitors' personal
  data stays with the people who own the site.

## Production needs

- Migration `0022` (additive; rollback by symlink is safe).
- No new variable. `SMTP_URL` and `EMAIL_FROM` already exist; without them
  the notification is skipped and Messages says so. The notification needs
  the Resend account and sending-domain records already listed in
  `needs-you.md`.

## Behaviour changes

- Adds to `forms`: an admin sees the site's contact messages, newest first, in Messages, with read and unread state - Step 5
- Adds to `forms`: an admin marks a message read or unread, and it works with JavaScript off - Step 5
- Adds to `forms`: only an admin of the site reaches Messages; editors and authors get Not Found - Step 5
- Adds to `forms`: a message is emailed to the address set in Settings, or to every active admin when none is set, with Reply-To the visitor - Step 3
- Adds to `forms`: a message is kept and shown when its email fails, with a line saying so - Step 5
- Adds to `forms`: with no email on the installation a message is kept and Messages says so, and nothing is sent - Step 3
- Adds to `settings`: Settings sets where contact messages are emailed, blank meaning every admin of the site - Step 1

## Notes

- Never log a name, address or message text (19a's rule); the new event
  carries the site id only.
- The visitor's text is rendered as text in React (escaped) and as plain
  text in the email; `mailto:` links are built from an address the schema
  has already validated.
- The subject is built from visitor text, so it is collapsed to one line
  before it reaches the mailer (header injection), though nodemailer also
  encodes headers.
- Hosted free-tier note: 100 messages an hour per site (19a) can exceed
  Resend's 100 a day. The messages are still kept; only the emails stop,
  and the failed line says so.
- Settings is one form with one version check; the new field rides with
  it rather than saving separately.
