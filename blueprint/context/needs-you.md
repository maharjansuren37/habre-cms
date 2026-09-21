# Needs you

> **Work only a person can do.** An agent adds a line here the moment it finds
> something it cannot do itself, rather than discovering it again three steps
> later. `prepare` reads this file; `progress` names the next item from it when
> the next action is yours; `preflight` treats anything still open and required
> as a blocker.
>
> **This is a record, not a guess.** The point of writing it down is that the
> answer stops being re-derived: a skill that stops for an account today and a
> skill that stops for the same account next week should be the same line, not
> two conversations.

## How to write a line

Four things, because a line missing any of them cannot be acted on:

- **What** - the specific thing, not the category. "A Postgres role for `appuser`",
  not "database access".
- **Why it is yours** - spend, credentials, a decision, physical hardware, or
  system software. If an agent could actually do it, it does not belong here.
- **What it blocks** - the item, the skill, or "nothing yet, needed by `deploy`".
  This is what separates *do it now* from *have it ready by then*.
- **Status** - `open`, `done`, or `dropped` with a reason.

**Blocking now and needed later are different, and both belong here.** An account
you will want at `deploy` is not urgent today, but finding out about it at deploy
time is how a release stalls. Say which it is rather than filing everything as
urgent - a list where everything is blocking gets read once.

## Closing a line

**The skill that would have needed it closes it, on its next run.** `host` opened
the line about an account, so `host` closes it once the account exists;
`scaffold` closes the toolchain it was waiting for; `verify` closes the manual
check once someone has done it. Whoever writes a line here is also the one that
finds out it is satisfied.

**Check before closing, the same as before opening.** "Installed" is proven by
running it, not by the plan saying so.

**`prepare` never closes anything** - it reports that a line looks satisfied and
names the skill that owns it. It reads this file and writes nothing, which is
what makes its report trustworthy.

**A file that only grows stops being read.** Nothing closed a line here for the
first two days this file existed, so every item stayed open forever - and
`preflight` treats an open required line as a blocker, which means a requirement
met months ago would have blocked a release permanently. Moving a line to Done is
not tidying; it is what keeps the open list true.

## Kinds

| kind | examples |
|---|---|
| **Spend** | hosting, a domain, a managed database, a paid tier, anything with a card |
| **Accounts and credentials** | a signup, an API key, an OAuth app, a token scope, an SSH key |
| **System software** | a language toolchain or SDK, a database server, Xcode, Android Studio - `scaffold` never installs these |
| **Hardware** | a real device, a simulator, a screen reader, a second machine |
| **Manual verification** | anything no test reaches: tab order, screen-reader output, "does this actually render" |
| **Decisions and approvals** | scope cuts, a destructive migration, a production deploy, a version number that can never be unpublished |
| **Access** | a repository setting, branch protection, a firewall or DNS rule, someone else's permission |

## Open

<!-- One line each. Newest last, so the file reads as it happened.

     - [ ] **Postgres role for `appuser`** - system software; needs a superuser.
           Blocks `scaffold` on `api`. Fix: `sudo -u postgres createuser -s appuser`
-->

- [ ] **Public URL for the R2 images bucket** - accounts/access; your Cloudflare
      account. Either the bucket's `r2.dev` address (rate-limited, meant for
      testing) or a custom domain such as `media.surenmaharjan.fyi`; goes in
      `R2_PUBLIC_URL`, which is still empty in the local `.env`. Blocks item 5
      (Images). `open` (architect, 2026-09-15; narrowed by host, 2026-09-16)
- [ ] **A production R2 token for images - and, recommended, a production
      bucket** - credentials; your Cloudflare account. The token in the local
      `.env` is development's; reusing it in production would put laptop test
      uploads beside real content and make a laptop leak a production leak.
      Goes into `/etc/habre-cms/production.env` on the server, entered by you.
      Needed when item 5 deploys, nothing blocked now. `open` (host, 2026-09-16)
- [ ] **Delete the `hone.surenmaharjan.fyi` DNS record** - access; your DNS.
      The hone app was removed from `ocwebserver` on 2026-09-15 (data archived
      to `~/backups/hone-2026-09-15.tar.gz`); the record now points at a server
      with no site for it. Blocks nothing. `open` (2026-09-15)
- [ ] **UptimeRobot account with an alert email** - account; free tier.
      Needed by `monitor`, nothing blocked yet. `open` (stack, 2026-09-15)

- [ ] **Screen-reader and keyboard pass over the block editor** (NVDA, VoiceOver
      or Orca) - manual verification; no automated check hears what Editor.js
      announces, and `design.md` names the editor's blocks and block menu as the
      hardest part of the accessibility bar. Covers the + toolbox, the block
      settings menu, and - from item 2b - the inline toolbar (Bold, Italic,
      Link) and its link field. Done during item 2a's or 2b's `verify`.
      Blocks nothing now; `preflight` needs it. `open` (spec, 2026-09-16)

- [ ] **Screen-reader and keyboard pass over `/admin/login` and the admin
      shell** (NVDA, VoiceOver or Orca) - manual verification; no automated
      check hears what is announced. Covers the shell's first nav section
      (item 3) and, from item 3, the posts list's filter tabs and search, and
      the delete confirmation screen. Done during item 1's `verify`, from its
      `--manual` walkthrough. Blocks nothing now; `preflight` needs it (design.md
      lists it as unchecked). `open` (spec, 2026-09-15; widened, item 3)

- [ ] **Screen-reader and keyboard pass over the public site** (NVDA,
      VoiceOver or Orca) - manual verification; nobody has looked at these
      screens with a screen reader, unlike the admin screens above. Covers
      the home page, one post (including inline bold/italic/link formatting
      rendered as real elements), and the 404 page (item 4b). Blocks nothing
      now; `preflight` needs it before a real release. `open` (spec, 2026-09-21)

- [ ] **Fill `PUBLIC_URL`, `ADMIN_URL` and `JWT_SECRET` in your local `.env`** -
      credentials; it is your secrets file, so no agent writes to it. Item 4c
      splits the single `APP_URL` into two - set both to
      `http://127.0.0.1:3000` for local development (equal origins mean the
      app redirects nothing, per D22); generate the secret with the command in
      `.env.example`. Blocks `npm run dev`, `npm start` and `npm run test:e2e`
      locally (the server refuses to start without them); CI's `verify` needs
      none of them. Production values are `host`'s. `open` (build, 2026-09-15;
      reworded for the `APP_URL` split, spec, 2026-09-21)

## Done

- [x] **Private R2 bucket for database backups, and a token scoped to it** -
      accounts. `done` 2026-09-16: the owner created the bucket and put the
      credentials in `/etc/habre-cms/backup.env` on the server (root-only, mode
      600, not the app's file). Checked by host, values never printed: listing
      that bucket -> 200, listing all buckets -> 403, unsigned read -> refused;
      its name differs from the images bucket. One backup ran and the object is
      in the bucket. (architect, 2026-09-15; closed by host)
- [x] **R2 images bucket and an API token scoped to it, for development** -
      accounts. `done` 2026-09-16 (owner added `R2_ACCOUNT_ID`,
      `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` to the local
      `.env`). Checked by host with signed requests, values never printed:
      listing the bucket -> 200; listing all buckets in the account -> 403, so
      the token is limited to that bucket. (architect, 2026-09-15; closed by host)

- [x] **On `ocwebserver`: install Node 26 and PostgreSQL 16, then create the
      `habre_cms` database plus a role owning only it** - system software/access.
      `done` 2026-09-16 by `deploy/setup-server.sh`, run with the owner's yes
      (the owner installed `rsync` first). Checked: `node --version` -> v26.8.2;
      PostgreSQL 16.15 listening on localhost only; role `habre_cms` (not
      superuser, no createrole/createdb) owns only database `habre_cms` and logs
      in with the generated password. (architect, 2026-09-15; closed by host)
- [x] **Off-server location for nightly database backups** - decision. `done`
      2026-09-16: a private R2 bucket (D21); creating it is the open line
      above. (architect, 2026-09-15; closed by host)

<!-- Move lines here rather than deleting them. What was needed and when it was
     settled is worth keeping - it is the honest answer to "why did this take
     three days", and it stops the same question being asked again. -->

- [x] **DNS record for `cms.surenmaharjan.fyi` pointing at the VPS** -
      access; your DNS. `done` 2026-09-16 (user reported; checked by
      resolving it): `cms.surenmaharjan.fyi` is a CNAME to `surenmaharjan.fyi`,
      A `161.33.89.75`, no AAAA. Because it is a CNAME, adding an AAAA to the root
      domain would also put the CMS on IPv6 (see F-13). (architect, 2026-09-15;
      closed by build)
- [x] **Install Node 26 on this dev machine** - system software. `done`
      2026-09-15: `node --version` -> v26.8.1; `npm run verify` and the
      Playwright tests passed on it. (stack; closed by scaffold)
