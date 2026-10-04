# Production pending

## features/14a1-the-document

- [ ] Run migrations `0008_blocks_v4.sql` and `0009_entries_v4_only.sql` with the v1 deploy, on its own yes - `0009` deletes every page and post and empties the menu (test data, owner 2026-10-02: no backup). After it, no release before 14a1 can read the database, so rollback by symlink is impossible.

## features/15a-sites-and-memberships

- [ ] Run `db/roles.sql` once on `ocwebserver` as `postgres`, with a new generated app-role password, **before** `npm run db:migrate` applies 0010 (without putting the password on the command line - F-220).
- [ ] `/etc/habre-cms/production.env`: `DATABASE_URL` changes to the `habre_cms_app` role, and the new `DATABASE_OWNER_URL` takes today's value; the deploy runs `db:migrate` with `DATABASE_OWNER_URL`.
- [ ] Rehearse migrations `0010_sites.sql` and `0011_site_isolation.sql` on a restored production backup before the v1 deploy (D162, D163); neither rolls back by symlink once 0011 drops `users.role`.
