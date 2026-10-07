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

## features/16a-sites-by-host

- [ ] Migration `0015_site_domains.sql` (additive; runs with the v1 deploy's other migrations). Seeds `surenmaharjan.fyi` for subdomain `surenmaharjan`.
- [ ] `PLATFORM_URL` and `SITES_URL` in `/etc/habre-cms/production.env`, and `PUBLIC_URL` / `ADMIN_URL` removed from the systemd unit (this release's `deploy/habre-cms.service` no longer sets them). The values depend on the platform and sites domains still to be bought (`needs-you.md`).
- [ ] DNS and certificates for the platform and sites domains, and the Caddy file - item 16b and `host`. Without them, nothing reaches the new hosts.

## features/16b-suspend-and-the-server

- [ ] **A Caddy build with the Cloudflare DNS module on `ocwebserver`**, e.g.
  `caddy add-package github.com/caddy-dns/cloudflare`, which replaces the
  binary. It is `host`'s, with a yes. `setup-server.sh` refuses without it.
- [ ] **`/etc/caddy/habre-cms.env` filled in:** `HABRE_PLATFORM_DOMAIN`,
  `HABRE_SITES_DOMAIN`, `CLOUDFLARE_API_TOKEN` (`needs-you.md`'s token line).
  The domains must agree with `PLATFORM_URL` and `SITES_URL` in
  `production.env`.
- [ ] **DNS on Cloudflare:** `app.`, the apex and `www.` of the platform domain;
  `*.` of the sites domain; all pointing at `ocwebserver`.
  `cms.surenmaharjan.fyi` keeps its record.
- [ ] **Install the new Caddy file only with the v1 deploy** (D163). Until then the
  server keeps the current file: production still runs `8d82ce4`, which needs
  `cms.surenmaharjan.fyi` to serve the admin, not redirect it.
- [ ] **After the deploy:** `curl` a site subdomain and check that the certificate
  is the wildcard. That is the first proof the DNS challenge works.

## features/17-seo-basics

- [ ] Run migration `0016_seo.sql` (additive: `entries` gains `seo_title`, `seo_description`, `social_image_media_id`; `site_settings` gains `site_description`, `language`).
- [ ] No new environment variables. With the v1 deploy's `SITES_URL` set to `https://<sites domain>`, site 1's subdomain answers a 301 to `surenmaharjan.fyi` - expected, not a fault (D327).
- [ ] After the deploy, check a real share preview and the sitemap (`needs-you.md`).

## features/17b-optimised-images

- [ ] Run migration `0017_media_variants` (additive, reversible: `media.variant_widths integer[]`, `byte_size` check widened to 50 MB).
- [ ] `sharp` 0.35.5's native binary in `node_modules` - installed on the dev machine (`x86_64`, glibc) and copied; the server is `x86_64` Ubuntu 24.04 (glibc), which `setup-server.sh` checks. Also confirm the CPU supports x86-64-v2 (F-310). No new environment variable.
- [ ] Run `npm run optimise-media` once after the deploy. At the v1 deploy `0012` has already deleted every media row, so it should report 0.

## features/18a1-brand-colour-and-style

- [ ] Run migration `0018_brand.sql` (additive, defaults: `site_settings.brand_color`, `style_preset`; no data change).
- [ ] Public pages' Content-Security-Policy changes to `style-src 'self' 'nonce-…'`; Caddy sets no CSP of its own, so nothing on the server changes - confirm on a live public page after the deploy. No new environment variables, accounts or dependencies.
