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
- [ ] `PLATFORM_URL` and `SITES_URL` in `/etc/habre-cms/production.env`, and `PUBLIC_URL` / `ADMIN_URL` removed from the systemd unit (this release's `deploy/habre-cms.service` no longer sets them). Interim values (fix/interim-domain-noindex): `https://app.surenmaharjan.fyi` and `https://habre.page`.
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
  `cms.surenmaharjan.fyi` keeps its record. Interim (fix/interim-domain-noindex):
  `*.habre.page` on Cloudflare, DNS only; `app.surenmaharjan.fyi` at
  Porkbun, which keeps `surenmaharjan.fyi`'s DNS.
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

## features/18a2-your-logo

- [ ] Run migration `0019_media_colours.sql` (additive, default `'{}'`; no data change).
- [ ] The admin's Content-Security-Policy gains `img-src blob:`; Caddy sets no CSP of its own, so nothing on the server changes. No new environment variables, accounts or dependencies.

## features/18b1-the-run-with-openrouter

- [ ] Run migration `0020_ai_runs.sql` (new table and the `fail_interrupted_ai_runs()` function; no data change).
- [ ] `OPENROUTER_API_KEY` (a production key with a credit limit on OpenRouter), optionally `AI_PROVIDERS`, `OPENROUTER_MODEL`, `AI_CREDITS_PER_MONTH`, in `/etc/habre-cms/production.env`.
- [ ] `openai` in the release's `node_modules`.

## features/18b2-fallbacks

- [ ] `@anthropic-ai/sdk` 0.131.0 in the release's `node_modules`.
- [ ] In `/etc/habre-cms/production.env`, entered by the owner: `AI_PROVIDERS` (e.g. `openrouter,anthropic,openai`, or the order chosen); for each listed direct provider `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `ANTHROPIC_PRICE` and `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_PRICE` - production keys, each with a spend limit in its provider's console.
- [ ] Before listing a direct provider in production, the live runs owed by `needs-you.md` (D392) have succeeded locally. No migration.

## features/19a-receiving-a-message

- [ ] Run migration `0021_contact_submissions.sql` (additive, a new table; the previous release never reads it, so a symlink rollback is safe; no data change).
- [ ] No new environment variable; uses `JWT_SECRET`, already required.

## features/19c-messages-and-the-email

- [ ] Run migration `0022_contact_notify_email.sql` (additive, one nullable column; the previous release never reads it, so a symlink rollback is safe; no data change).
- [ ] No new environment variable. Without `SMTP_URL` and `EMAIL_FROM` the notification is skipped and Messages says so; sending needs the Resend account and domain records in `needs-you.md`.

## features/20-simple-and-pro

- [ ] Run migration `0023_level_and_dark_mode.sql` with the v1 deploy: two additive columns on `site_settings` (`level` default `simple`, `dark_mode` default `false`), so every site reads as Simple and light; a symlink rollback is safe, the previous release never reads them.

## features/21a-plans-and-limits

- [ ] Run migration `0024_billing_columns.sql` with the v1 deploy: four additive nullable columns on `sites`; the previous release never reads them, so a symlink rollback is safe.
- [ ] Optional: `LAUNCH_STORAGE_LIMIT_MB` and `LAUNCH_AI_CREDITS_PER_MONTH` in `/etc/habre-cms/production.env`; defaults (10240, 6000) apply when unset. A value below Free's stops startup.

## features/21b-pay-for-launch

- [ ] Run migration `0025_stripe_events.sql` with the v1 deploy (additive; a symlink rollback is safe).
- [ ] Billing stays off unless all four are set in `/etc/habre-cms/production.env`: `STRIPE_SECRET_KEY` (restricted: Checkout, Customers, Subscriptions, Prices read, Billing Portal), `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY`; optional `BILLING_TRIAL_DAYS` (14 unless set). D150: off through the beta.
- [ ] In Stripe (owner): a Launch product with a monthly and a yearly price; a webhook endpoint `https://app.<platform domain>/webhooks/stripe` for `checkout.session.completed` and `customer.subscription.created`, `.updated`, `.deleted`; the Customer Portal configured; Billing's retry schedule ending in cancel.
- [ ] Check `deploy/caddy/habre-cms.caddy` does not block `/webhooks/stripe`.

## features/21c-own-domain

- [ ] Run migration `0026_own_domain.sql` as the owner with the v1 deploy (additive: two columns on `site_domains` and narrow insert/update grants; a symlink rollback is safe).
- [ ] Host change, the owner's yes (`host`): add `on_demand_tls { ask http://127.0.0.1:3000/_caddy/ask }` to the server's main Caddyfile global options, then reload Caddy. Until then own domains verify but get no certificate.
- [ ] Run `deploy/setup-server.sh` so it installs `habre-cms-own-domains.caddy`, then `caddy validate` (never run here).
- [ ] No new environment variables.

## fixes/2026-10-12-interim-domain-noindex

- [ ] `SEARCH_INDEXING=off`, `PLATFORM_URL=https://app.surenmaharjan.fyi` and `SITES_URL=https://habre.page` in `/etc/habre-cms/production.env`.
- [ ] `/etc/caddy/habre-cms.env`: `HABRE_PLATFORM_DOMAIN=surenmaharjan.fyi`, `HABRE_SITES_DOMAIN=habre.page`, and a Cloudflare token with DNS edit on the `habre.page` zone only, filtered to the server's IP, with an expiry (`needs-you.md`).
- [ ] DNS (done 2026-10-12): `*.habre.page` A `161.33.89.75`, DNS only; `app.surenmaharjan.fyi` answered by Porkbun's `*` CNAME. Before the deploy, add the `sectigo.com` CAA records (`needs-you.md`, F-435).
- [ ] After the deploy: `curl -sI https://surenmaharjan.fyi/robots.txt` and a `<address>.habre.page` page show `Disallow: /` and `X-Robots-Tag: noindex, nofollow`; the `*.habre.page` certificate is the wildcard.
