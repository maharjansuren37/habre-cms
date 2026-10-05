# Production pending

## features/14a1-the-document

- [ ] Run migrations `0008_blocks_v4.sql` and `0009_entries_v4_only.sql` with the v1 deploy, on its own yes - `0009` deletes every page and post and empties the menu (test data, owner 2026-10-02: no backup). After it, no release before 14a1 can read the database, so rollback by symlink is impossible.

## features/15a-sites-and-memberships

- [ ] Run `db/roles.sql` once on `ocwebserver` as `postgres`, with a new generated app-role password, **before** `npm run db:migrate` applies 0010 (without putting the password on the command line - F-220).
- [ ] `/etc/habre-cms/production.env`: `DATABASE_URL` changes to the `habre_cms_app` role, and the new `DATABASE_OWNER_URL` takes today's value; the deploy runs `db:migrate` with `DATABASE_OWNER_URL`.
- [ ] Rehearse migrations `0010_sites.sql` and `0011_site_isolation.sql` on a restored production backup before the v1 deploy (D162, D163); neither rolls back by symlink once 0011 drops `users.role`.

## features/15b-signup

- [ ] Run migration `0012_signup.sql` with the v1 deploy (D163), on its own yes: it deletes every user, membership, entry and media row (D261). Straight after it, run `npm run create-admin` on the server for site 1's first admin.
- [ ] `SIGNUP_MODE` in `/etc/habre-cms/production.env`: leave it unset (`off`) until the beta opens, then set it to `invite` (D150).
- [ ] `SMTP_URL` and `EMAIL_FROM` in `production.env` before signup is turned on: a Resend account with an API key and a sending domain with SPF, DKIM and DMARC records (`needs-you.md`); the sending domain depends on the platform domain still to be bought.
- [ ] `nodemailer` is copied with `node_modules`, as every other package is; it has no native code.

## features/15c-password-reset

- [ ] Nothing new to install. `SMTP_URL` and `EMAIL_FROM` now go together - one alone stops startup (D272) - and setting both (the 15b line above) also turns on password reset by email (D271).

## features/15d-storage-cap

- [ ] `STORAGE_LIMIT_MB` is optional: unset gives 500 MB. Set it in `/etc/habre-cms/production.env` only if the owner picks another Free number (`needs-you.md`, *Free plan limits*); an invalid value stops startup. No migration.

## features/15e1-your-account

- [ ] Migration `0013_email_change.sql` (additive; runs with the v1 deploy's other migrations).
- [ ] No new environment variables. The confirmation link and the old-address notice need email on in production (`SMTP_URL`, `EMAIL_FROM` - the Resend line in `needs-you.md`); without it an email change is immediate.

## features/15e2-delete-your-account

- [ ] Migration `0014_deleted_accounts.sql` (additive: relaxes two columns; runs with the v1 deploy's other migrations). The release cannot be rolled back by symlink once a deleted author exists.
- [ ] No new environment variables. The members' notice needs email on in production (`SMTP_URL`, `EMAIL_FROM` - the Resend line in `needs-you.md`); without it, members are not told.
- [ ] The privacy policy (`needs-you.md`) says deleted accounts stay in the nightly backups until they age out (7 days locally per `deploy/backup-db.sh`; the R2 bucket's retention is not known).
