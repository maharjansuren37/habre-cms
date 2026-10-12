# v1 deploy prep - owner tasks, 2026-10-13

The four owner tasks that stood between `main` (`39f6d81`) and the v1 deploy
(`blueprint/production-pending.md`), done by the owner on the server and in
the Cloudflare, Porkbun and Resend dashboards. No secret is recorded here;
each one lives in the owner's password manager until `deploy` enters it on
the server.

## Decisions made today

- **Signup is `open`** (`SIGNUP_MODE=open`), not invite-only. So a terms of
  service and a privacy policy must be live before the deploy (F-428) - they
  can no longer be an accepted risk.
- **Production starts on a fresh database.** The live CMS (release `8d82ce4`,
  items 1-12) and its content are not kept: at the deploy the `habre_cms`
  database is dropped, recreated, and migrated 0001-0026 from empty - the path
  CI runs on every push. No production backup is copied and no migration
  rehearsal runs, so F-427 becomes moot. Dropping the database still needs its
  own yes at `deploy`.

## 1. Cloudflare API token - done

For Caddy to get the wildcard certificate for `*.habre.page` (D153).

- Created in Cloudflare > My Profile > API Tokens > *Edit zone DNS* template.
- Permissions: `Zone / DNS / Edit` **and** `Zone / Zone / Read` (the
  `caddy-dns/cloudflare` module needs both).
- Zone resources: `habre.page` only. Client IP filter: `161.33.89.75`
  (`ocwebserver`). Valid 2026-10-12 to **2027-10-12** - rotate before then, or
  certificate renewals fail.
- **Evidence:** `curl .../client/v4/user/tokens/verify` run on the server
  returned `"status":"active"`, `"expires_on":"2027-10-12T23:59:59Z"`.
- Still to do at `deploy`: put it in `/etc/caddy/habre-cms.env` as
  `CLOUDFLARE_API_TOKEN=`.

## 2. Caddy on `ocwebserver` - done

- Added the Cloudflare DNS module: `sudo caddy add-package
  github.com/caddy-dns/cloudflare` (old binary backed up under `/root/`).
- Added to `/etc/caddy/Caddyfile` (backed up first), as the **first** block:

  ```
  {
  	on_demand_tls {
  		ask http://127.0.0.1:3000/_caddy/ask
  	}
  }

  import /etc/caddy/sites/habre-cms.caddy
  ```

  The first attempt failed validation (`server block without any key is
  global configuration, and if used, it must be first`) because the existing
  `import` line sat above the new block; moving the `import` below fixed it.
- **Evidence:** `caddy validate` -> `Valid configuration`; after
  `systemctl restart caddy`, `caddy list-modules` lists
  `dns.providers.cloudflare` and `https://cms.surenmaharjan.fyi/healthz`
  returns `{"status":"ok","database":"up"}`.
- Gotchas: if Caddy came from apt, `sudo apt-mark hold caddy` stops an upgrade
  dropping the module (re-run `add-package` after any upgrade). `nano` over
  SSH failed with `Error opening terminal: foot` - fix with
  `export TERM=xterm-256color`, or `SetEnv TERM=xterm-256color` in
  `~/.ssh/config`.
- The `ask` option does nothing until the deploy imports
  `habre-cms-own-domains.caddy`, which `setup-server.sh` now will.

## 3. Production backup - dropped

Planned as a copy of the latest `/var/backups/habre-cms/` dump for rehearsing
migrations 0008-0026 (F-427). Dropped by the owner: the old content is test
data and production starts on a fresh database (above). The server's nightly
backups are untouched.

## 4. Resend - done

Sends signup verification, password reset and contact-form email.

- Domain `surenmaharjan.fyi` added in Resend; **sending on, receiving off**.
  Never `habre.page`, which is set up to send nothing (F-434).
- Records at Porkbun (Resend's current scheme - no MX):
  - `TXT resend._domainkey` - DKIM
  - `CNAME rsend` and `CNAME send` - SPF / return path
  - `TXT _dmarc` - `v=DMARC1; p=none;`
- **Evidence:** every record ticked and the domain **Verified** in Resend.
- API key `habre-cms-production` created with *Sending access* to
  `surenmaharjan.fyi`, saved in the password manager.
- Still to do at `deploy`, in `/etc/habre-cms/production.env`:
  `SMTP_URL=smtps://resend:<key>@smtp.resend.com:465` and
  `EMAIL_FROM=Habre <hello@surenmaharjan.fyi>` (the two go together).

## Still before the deploy

1. Terms of service and privacy policy: agent drafts both from what the app
   does, the owner edits and stands behind them; `/terms` and `/privacy` pages
   linked from signup and the footer (a `spec` fix).
2. The R2 backup bucket's retention (Cloudflare > R2 > bucket > Settings >
   Object lifecycle rules) - the privacy policy states it.
3. A production OpenRouter key with a credit limit.
4. `preflight`, then `deploy` (fresh database, `create-admin`).
5. Not blocking: the licence (AGPL or MIT), before the code goes public.
