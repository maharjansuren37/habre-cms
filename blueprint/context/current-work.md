# Feature: Suspend and the server

**From build plan:** item 16b
**Type:** Feature
**Verified:** not yet
**Reviewed:** not yet

## Goal

The operator can take an abusive site off the web with one command and put it
back with another (D158, quality-bar *Abuse*). The site's members see why
their site went dark. And the server gets the Caddy file that makes item 16a's
hosts reachable: the platform host, a wildcard certificate for every site
address, and redirects from the platform's apex, its `www` and
`cms.surenmaharjan.fyi` (D153). Without that file nothing built in 16a can be
reached in production.

## In scope

- **`npm run suspend-site -- --address <address>`** and
  **`npm run unsuspend-site -- --address <address>`**, run on the server like
  `create-invite`, as the app role (`DATABASE_URL`):
  - suspend sets `sites.suspended_at` to now. Unsuspend clears it.
  - The address is lowercased before the lookup.
  - An unknown address prints that no site has it, changes nothing and exits 1.
  - A site that is already suspended (or already not suspended) is left as it
    is. The command prints so and exits 0, and the original `suspended_at`
    is kept.
  - It takes effect on the next request, with no restart: 16a's host lookup
    already refuses a suspended site, on its subdomain and on its own domains.
- **Members keep their access** (owner, 2026-10-06). A suspended site's
  members still sign in, edit and can delete their account. Every admin
  screen shows a standing notice: **"This site is suspended."** with the line
  **"Visitors see Not Found instead of its pages."** The notice goes away once
  the site is unsuspended.
- **The Caddy file** (`deploy/caddy/habre-cms.caddy`), rewritten for D153:
  - the platform host `app.<platform domain>` proxies to the app. Its access
    log is its own file.
  - `<platform domain>` and `www.<platform domain>` answer a 301 to the same
    path on the platform host.
  - `*.<sites domain>` proxies to the app on one wildcard certificate,
    obtained by a DNS challenge through the Cloudflare DNS module. The token
    comes from Caddy's environment. The sites get their own access log.
  - `surenmaharjan.fyi` proxies to the app (site 1's own domain, 16a's seed
    row). `www.surenmaharjan.fyi` still answers a 301 to it.
  - `cms.surenmaharjan.fyi` answers a 301 to the same path on the platform
    host.
  - the two domains come from Caddy environment variables, because neither
    is bought yet (`needs-you.md`). Nothing in the repository names them.
  - every `reverse_proxy` pins `X-Forwarded-Host` and `X-Forwarded-Proto` as
    today, **and removes any client-sent `Forwarded` header** (F-269).
- **Server wiring in `deploy/setup-server.sh`**:
  - a systemd drop-in for `caddy.service` that loads `/etc/caddy/habre-cms.env`.
  - that file, created once, mode 600, owned by root. It holds empty
    placeholders for the two domains and `CLOUDFLARE_API_TOKEN`, and is never
    overwritten.
  - before installing the site file, the script refuses with a message
    naming what is missing if:
    - Caddy lacks the `dns.providers.cloudflare` module;
    - either domain is empty in the env file;
    - the token is empty.
  - validation runs with that env file loaded, before the reload.

## Out of scope

- **`delete-site`** (D158 names it). No build-plan item holds it yet. See
  Notes.
- **One main address per site, redirects to it, and the canonical link**
  (D173) - **item 17**. Until then site 1 answers on both its subdomain and
  `surenmaharjan.fyi`.
- **On-demand certificates for own domains** - **item 21**. They need a global
  option in the main Caddyfile, which the repository does not own.
- **The sites domain's apex and `www`**: nothing serves them, as in 16a. They
  have no Caddy block, so no certificate is issued for them.
- **`media.<sites domain>`** is R2's custom domain, served by Cloudflare and
  never by this server (`needs-you.md`). Its own DNS record wins over the
  wildcard's.
- **Installing anything on `ocwebserver`**: a Caddy build with the Cloudflare
  module, the token, DNS records, the env file's values. Those belong to
  `host`, with their own yes, at the v1 deploy (D163). This item writes the
  files and the guards only.
- **Uptime checks** on a site subdomain and on `surenmaharjan.fyi` (F-113) -
  `monitor`, after the v1 deploy.
- **A reason or note stored with a suspension**: `sites` has only
  `suspended_at`, and no item needs more.

## Design reference

The notice is a new use of an existing pattern (design.md *Conventions*:
banners). It is **not an action's outcome**, so it is **not a live region**:
no `role="alert"`, which would interrupt on every page load, and no
`role="status"`. It is static text, read in order. It has the error banner's
look and colours, which are already measured in design.md's contrast table:
`Message`'s `error` tone and its icon. It sits at the top of the shell's main
area, before the page's `h1`, on every admin screen. Its title is a `p`, not a
heading, so the page's outline is unchanged. Step 2 records this in
design.md's *Screens* (Admin shell row).

## Build steps

- [x] **Step 1 - `suspend-site` and `unsuspend-site`**:
  - `scripts/suspend-site.ts` and `scripts/unsuspend-site.ts`, in
    `create-invite.ts`'s shape;
  - one shared `setSiteSuspended(address, suspended)` in
    `app/features/sites/suspend-site.server.ts`. It returns
    `{ outcome: "changed" | "unchanged" | "unknown" }`, plus `suspendedAt`
    when the site is suspended;
  - the two `package.json` scripts, and a line for each in AGENTS.md's
    *Commands*.

  *Done when:* `npm run test:e2e` passes a new `e2e/suspend-site.spec.ts`
  that runs the real scripts through `execFileSync` (the `e2e/helpers/users.ts`
  pattern), on a site made by `createSite` and never site 1:
  - a site that answers 200 at its address answers 404 on the very next
    request after `suspend-site` exits 0, with no restart;
  - it answers 200 again after `unsuspend-site`;
  - a second `suspend-site` exits 0, says the site is already suspended, and
    leaves `suspended_at` unchanged (read as the owner role);
  - an unknown address exits 1 and changes no row;
  - `--address LENA` finds `lena`;
  - with no `--address`, the command prints the usage and exits 1.

  `e2e/host-routing.spec.ts`'s suspended test keeps setting `suspended_at`
  directly, because it tests routing and not the command.
- [x] **Step 2 - The suspended notice in the admin**:
  - `findSubdomain` becomes one query returning the subdomain and whether the
    site is suspended. It is still one query by primary key, so the shell
    loader gains no query.
  - the shell renders the notice from *Design reference*: `Message` gains a
    `notice` tone with the error look and no role.
  - design.md's Admin shell row says where the notice sits and why it has no
    role.

  *Done when:* `npm run test:e2e` passes tests in `e2e/suspend-site.spec.ts`
  showing that the admin of a suspended second site:
  - signs in on the platform host;
  - sees "This site is suspended." on `/admin` and on `/admin/pages`, as a
    full page load and after client-side navigation;
  - finds the notice has no `role` attribute;
  - sees the page's single `h1` unchanged.

  After `unsuspend-site` the notice is gone. `e2e/contrast.spec.ts` passes
  with a suspended site's admin page added to what it measures.
- [x] **Step 3 - The Caddy file**: `deploy/caddy/habre-cms.caddy` rewritten
  as *In scope* lists:
  - `{$HABRE_PLATFORM_DOMAIN}` and `{$HABRE_SITES_DOMAIN}` stand for the two
    domains;
  - `{env.CLOUDFLARE_API_TOKEN}` is read at runtime, so the token never
    appears in the adapted config;
  - the proxy settings shared by every proxied block go in one snippet;
  - the file's header comment says where each value comes from, and that it
    is installed only with the v1 deploy (see Production needs).

  *Done when:*
  - a Caddy 2.11.4 built locally with `github.com/caddy-dns/cloudflare` (in
    Docker, from `caddy:2.11.4-builder` with `xcaddy`; nothing installed on
    the machine) runs `caddy adapt` on the file, with the three variables
    set to test values, and exits 0;
  - the adapted JSON shows the six host blocks;
  - every `reverse_proxy` in the JSON deletes `Forwarded`;
  - the token's test value does not appear in the JSON (`grep -c` shows 0);
  - the command and output are shown.
- [x] **Step 4 - Prove the hosts through a local Caddy** - a throwaway run, not
  committed. The Step 3 Caddy runs in Docker (`--network host`) in front of
  `npm start`. It loads a test main Caddyfile that imports a copy of the real
  file. The copy differs **only** in its `tls` lines (`tls internal` instead
  of the DNS challenge), because the challenge cannot run here, and the diff
  between the two is shown. The domains are set to `habre.test` and
  `sites.test`, and `.env` points at the same hosts.

  *Done when:* each of these is shown with `curl -k --resolve`:
  - `app.habre.test/admin/login` answers 200;
  - `habre.test/x?y=1` and `www.habre.test/x` answer 301 to
    `https://app.habre.test/x?y=1` and `https://app.habre.test/x`;
  - `cms.surenmaharjan.fyi/admin/posts` answers 301 to
    `https://app.habre.test/admin/posts`;
  - `surenmaharjan.sites.test/` answers 200 with site 1's title;
    `surenmaharjan.fyi/` does too;
  - an unknown `nobody.sites.test/` answers 404;
  - **F-269:** `surenmaharjan.sites.test/` sent with
    `Forwarded: host=app.habre.test;proto=https` still answers 200 with site
    1's home page, not a platform answer;
  - `app.habre.test/` sent with `Forwarded: host=nobody.sites.test` still
    redirects to `/admin`.

  `build` marks F-269 `fixed` with this evidence.
- [ ] **Step 5 - `setup-server.sh` wiring**:
  - `deploy/caddy/caddy-habre-cms.conf`: the drop-in, `EnvironmentFile=`;
  - `install_caddy_site` installs the drop-in and runs `systemctl
    daemon-reload` when the drop-in changed;
  - it creates `/etc/caddy/habre-cms.env` only when absent;
  - it runs the three refusals from *In scope* before touching the site file;
  - it validates with the env file loaded (`caddy validate --envfile`, or
    exporting it for that one command if the flag is missing in 2.11.4).

  The refusals sit in a function that takes the env file and the
  `caddy list-modules` output as inputs, so they can run here.

  *Done when:*
  - `bash -n deploy/setup-server.sh` passes;
  - the refusal function, run locally against four temporary env files,
    prints a message naming the missing item and returns non-zero for each
    of: an empty platform domain, an empty sites domain, an empty token, and
    a module list without the Cloudflare module;
  - it returns zero for a complete file;
  - each run is shown.

  The full script runs only on the server at the v1 deploy; `verify` lists
  that as not provable here.
- [ ] **Step 6 - Records**:
  - AGENTS.md's production row names the Caddy env file and its three
    values;
  - the plan's *Deployment* notes for D153 say the domains come from
    Caddy's environment;
  - `.env.example` notes that `PLATFORM_URL` and `SITES_URL` must agree with
    Caddy's two domains on the server.

  *Done when:* `npm run verify` passes, and a grep for `cms.surenmaharjan.fyi`
  outside `blueprint/history/`, `dev-notes/` and `CHANGELOG.md` finds only the
  Caddy file's redirect and descriptions of it.

## Files and areas

- `scripts/suspend-site.ts`, `scripts/unsuspend-site.ts` (new);
  `app/features/sites/suspend-site.server.ts` (new); `package.json`
- `app/features/sites/find-site.server.ts` (`findSubdomain`'s return);
  `app/features/admin-shell/layout.tsx` (+ its CSS module if needed);
  `app/lib/ui/message.tsx` and `message.module.css` (the `notice` tone)
- `e2e/suspend-site.spec.ts` (new); `e2e/contrast.spec.ts`;
  `e2e/helpers/sites.ts` if a helper is shared
- `deploy/caddy/habre-cms.caddy` (rewritten); `deploy/caddy/caddy-habre-cms.conf`
  (new); `deploy/setup-server.sh`
- `AGENTS.md`, `.env.example`, `blueprint/project-plan.md` (Deployment notes,
  Step 6, already decided in D153), `blueprint/context/design.md` (Step 2)

## Data and contracts

- **No migration.** `sites.suspended_at` has existed since `0010`. The app role
  already has `update` on `sites` (`db/roles.sql`'s blanket grant). Step 1
  proves it by running the commands as that role.
- **`setSiteSuspended(address: string, suspended: boolean)`** returns
  `Promise<{ outcome: "changed" | "unchanged" | "unknown"; suspendedAt?: Date }>`.
  It is used by the two scripts only. `delete-site` and any later operator
  screen can call it.
- **`findSubdomain(siteId)`** becomes
  `findMemberSite(siteId): Promise<{ subdomain: string; suspended: boolean }>`.
  The shell is its only caller.
- **Caddy's environment** (load-bearing; `host` fills it, items 17 and 21 read
  it):
  - `/etc/caddy/habre-cms.env`, mode 600, root;
  - `HABRE_PLATFORM_DOMAIN`: the platform's registrable domain, e.g.
    `habre.ai`;
  - `HABRE_SITES_DOMAIN`: e.g. `habre.page`;
  - `CLOUDFLARE_API_TOKEN`: DNS edit on the sites zone only.
  - `PLATFORM_URL` must be `https://app.$HABRE_PLATFORM_DOMAIN`, and
    `SITES_URL` must be `https://$HABRE_SITES_DOMAIN`.

## Testing

- **Browser (`npm run test:e2e`, locally with the dev database, and in CI's
  `e2e` job, which has PostgreSQL):** Steps 1-2. The scripts run with
  `execFileSync` and `DATABASE_URL` from the test environment, as
  `create-admin` already does in `e2e/helpers/users.ts`. No R2 is needed, so
  nothing is skipped in CI.
- **No unit tests** for the commands: their logic is one `update` and three
  outcomes, all of which need the database. `npm test` runs inside `verify`
  with no database, so the browser suite is where they are proved.
- **Caddy (Steps 3-4):** local only, in Docker. Not committed, and not in CI:
  CI has no Caddy, and building one with a module on every run costs more than
  it proves. Building the image needs network access to the Go module proxy.
- **The shell guard (Step 5):** run by hand against temporary files and
  shown. It is not committed as a test, because the project has no shell-test
  runner.
- **Not provable before the v1 deploy:** the wildcard certificate being
  issued, the real DNS and `setup-server.sh` end to end. Production needs
  carries them.

## Decisions

- **Suspension hides the public site only; members keep the admin, with a
  standing notice** (owner, 2026-10-06). It beat locking members out: there
  is no support address to send them to yet, and a member could no longer
  delete their account. It also beat a silent public 404, which leaves an
  owner with no idea why their site went dark.
- **A standing notice has no live role.** It is a fact about the site, not an
  action's outcome. `role="alert"` on every page load would interrupt a screen
  reader on each navigation.
- **The commands take the address, not an id or an email.** An abuse report
  arrives as a URL. An own domain is looked up by hand until an item needs
  more.
- **Re-running a command changes nothing and exits 0**, keeping the original
  `suspended_at`. It beat failing: a repeated command is not an error, and
  the first time is the one worth keeping.
- **The platform and sites domains reach Caddy as environment variables**,
  not as names in the repository. Neither domain is bought yet. A self-hosted
  copy sets its own without editing the file (D148). The environment also
  already holds the token (D153).
- **The repository owns a systemd drop-in for `caddy.service`** and the
  placeholder env file. This is a narrow widening of D17, which said the
  repository owns only the site file. Doing it by hand on the server was the
  alternative, and it is not reproducible (D9). The drop-in adds one
  `EnvironmentFile=` line and never replaces Caddy's unit.
- **`Forwarded` is removed at Caddy** (F-269), not ignored in the app. Caddy
  already pins the two `X-Forwarded-*` headers the app trusts (D96, F-22).
  Removing the third header in the same place keeps one rule in one file.

## Production needs

- **A Caddy build with the Cloudflare DNS module on `ocwebserver`**, e.g.
  `caddy add-package github.com/caddy-dns/cloudflare`, which replaces the
  binary. It is `host`'s, with a yes. `setup-server.sh` refuses without it.
- **`/etc/caddy/habre-cms.env` filled in:** `HABRE_PLATFORM_DOMAIN`,
  `HABRE_SITES_DOMAIN`, `CLOUDFLARE_API_TOKEN` (`needs-you.md`'s token line).
  The domains must agree with `PLATFORM_URL` and `SITES_URL` in
  `production.env`.
- **DNS on Cloudflare:** `app.`, the apex and `www.` of the platform domain;
  `*.` of the sites domain; all pointing at `ocwebserver`.
  `cms.surenmaharjan.fyi` keeps its record.
- **Install the new Caddy file only with the v1 deploy** (D163). Until then the
  server keeps the current file: production still runs `8d82ce4`, which needs
  `cms.surenmaharjan.fyi` to serve the admin, not redirect it.
- **After the deploy:** `curl` a site subdomain and check that the certificate
  is the wildcard. That is the first proof the DNS challenge works.

## Behaviour changes

- Adds to `sites`: `npm run suspend-site -- --address <address>` takes the site's public pages off at once, on every host it is served at, and `unsuspend-site` brings them back; an unknown address changes nothing and exits 1 - Step 1
- Adds to `sites`: a suspended site's members still sign in and edit, and every admin screen says the site is suspended and that visitors see Not Found - Step 2
- Adds to `sites`: the platform's apex and `www`, and `cms.surenmaharjan.fyi`, answer a 301 to the same path on the platform host - Step 4
- Adds to `sites`: a client-sent `Forwarded` header does not change which host or site a request is served as - Step 4

## Notes

- **`delete-site` has no item.** D158 and plan section 6 list it as an operator
  command for a deletion request, but no build-plan line holds it. Today a
  site's last admin deleting their account does the same thing (15e2). The
  owner should decide whether it needs a line before the v1 deploy, rather
  than this item picking it up.
- **A suspended site's last admin can still delete their account**, which
  deletes the site. That follows from keeping members' access. Only the
  nightly backups keep the evidence.
- **Script shape:** `create-invite.ts`. Use `parseArgs` with `strict: true`, a
  `USAGE` line, `try`/`catch`/`finally` with `sql.end()`, and
  `process.exitCode`. Print the address and the outcome, never an id.
- **Caddy syntax:** `{$VAR}` is replaced when the Caddyfile is adapted, from
  the environment of the process that adapts it. `systemctl reload caddy`
  adapts inside the service, which has the drop-in's `EnvironmentFile`. A bare
  `caddy validate` from a root shell does not, which is why Step 5 loads the
  env file for it. Check `caddy validate --help` in the Step 3 build for
  `--envfile` before relying on it.
- F-275 and F-278 (dotted hosts) are already handled in the app. Caddy's host
  matchers do not match a trailing-dot host to these blocks, so nothing more
  is needed here. Step 4 may show it, but it is not a done-when.
- D22 is fully superseded once this ships: `ship` marks it.
- `ship` records the Decisions above in `dev-notes/decisions.md`. It notes the
  D17 widening against D17 itself.
