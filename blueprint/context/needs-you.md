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

- [ ] **A custom domain for the R2 images bucket, before production** -
      accounts/access; your Cloudflare account. `R2_PUBLIC_URL` is now set to
      the bucket's `r2.dev` address for development, which is fine to build
      against but is rate-limited and not meant for real traffic - see
      `spec`'s note on item 5a. Swap it for a custom domain (e.g.
      `media.surenmaharjan.fyi`) before this ships to production. **Risk
      accepted by the owner, 2026-09-23: shipping on the `r2.dev` address for
      now, custom domain after the MVP is live.** Blocks nothing now; needed
      by `deploy` for item 5. `open` (architect,
      2026-09-15; narrowed by host, 2026-09-16; local value set, spec,
      2026-09-22; risk accepted, preflight, 2026-09-23)
- [ ] **A production R2 token and bucket, actually separate from development's** -
      credentials; your Cloudflare account. **Reopened by preflight,
      2026-09-23** - the line below was closed too early: all five `R2_*`
      variable *names* were present in `/etc/habre-cms/production.env`, but
      checking the actual values (hashed for comparison, never printed) shows
      `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID` and `R2_BUCKET` are byte-identical
      to the ones in the local `.env` - production is running on the exact
      development token and bucket, which is precisely what this line was
      opened to prevent (a laptop compromise or a dev mistake reaches
      production; test uploads sit beside real content). Create a second,
      separate-scoped token and bucket in Cloudflare and put *those* values in
      `/etc/habre-cms/production.env`. Directly blocks a real `deploy` of item
      5 (media) - the app will run fine either way, but it will not be
      isolated the way it's supposed to be. **Risk accepted by the owner,
      2026-09-23: shipping on the shared dev/production token for now, will
      separate them after the MVP is live.** (host, 2026-09-16; reopened by
      preflight, 2026-09-23; risk accepted, preflight, 2026-09-23)
- [ ] **Delete the `hone.surenmaharjan.fyi` DNS record** - access; your DNS.
      The hone app was removed from `ocwebserver` on 2026-09-15 (data archived
      to `~/backups/hone-2026-09-15.tar.gz`); the record now points at a server
      with no site for it. Blocks nothing. `open` (2026-09-15)

- [ ] **Screen-reader and keyboard pass over `/admin/login` and the admin
      shell** (NVDA, VoiceOver or Orca) - manual verification; no automated
      check hears what is announced. Covers the shell's nav (from item 3, the
      posts list's filter tabs and search and its delete confirmation screen;
      from item 6a, the same for the pages list, its editor and its delete
      confirmation, plus the "Pages" nav entry itself; from item 7a, the
      settings form and its logo picker dialog - the same dialog shape as
      the image block's, still itself unverified - plus the "Settings" nav
      entry; from item 7b, the settings screen's navigation editor - its
      add/remove/move-up/move-down buttons and the page/URL fields per row;
      from item 8, the users list, the add-user form, and the manage-user
      screen's three independent forms - change role, reset password,
      deactivate/reactivate - including the self-guard note shown in place of
      the role/deactivate controls on your own account, plus the "Users" nav
      entry; from item 9, the settings screen's Home page select and its
      "Not published" hint; from item 14a1, the new editor's writing area,
      format bar, link dialog, section chip and Add a section; from item
      14a2, the palette and its phone Add dialog, the settings panel for an
      image, a button and a section, and the media picker in the editor).
      Done during item 1's `verify`, from its `--manual` walkthrough.
      **Risk accepted by the owner, 2026-09-23: shipping items 5-8 to
      production without this; will do the accessibility pass after the MVP
      is live.** Blocks nothing now; `preflight` needs it (design.md lists it as
      unchecked). `open` (spec,
      2026-09-15; widened, item 3; widened, item 6a; widened, item 7a;
      widened, item 7b; widened, item 8; risk accepted, preflight, 2026-09-23;
      widened, item 9)

- [ ] **Screen-reader and keyboard pass over the public site** (NVDA,
      VoiceOver or Orca) - manual verification; nobody has looked at these
      screens with a screen reader, unlike the admin screens above. Covers
      the home page, one post (including inline bold/italic/link formatting
      rendered as real elements), one page (item 6b, once built - same
      typography and block rendering as a post, minus the byline), the
      header's navigation menu (item 7b), the
      404 page (item 4b), and a page with images and buttons (item 14a2). **Risk accepted by the owner, 2026-09-23: shipping
      items 5-8 to production without this; will do the accessibility pass
      after the MVP is live.** Blocks nothing now; `preflight` needs it before a
      real release. `open` (spec, 2026-09-21; widened, item 6b; widened, item 7b;
      risk accepted, preflight, 2026-09-23)

- [ ] **Fill `PUBLIC_URL`, `ADMIN_URL` and `JWT_SECRET` in your local `.env`** -
      credentials; it is your secrets file, so no agent writes to it. Item 4c
      splits the single `APP_URL` into two - set both to
      `http://127.0.0.1:3000` for local development (equal origins mean the
      app redirects nothing, per D22); generate the secret with the command in
      `.env.example`. Blocks `npm run dev`, `npm start` and `npm run test:e2e`
      locally (the server refuses to start without them); CI's `verify` needs
      none of them. Production values are `host`'s. `open` (build, 2026-09-15;
      reworded for the `APP_URL` split, spec, 2026-09-21)

- [ ] **Choose a home page in production's Settings right after item 9 is
      deployed** - decision; which page is the site's front door is yours.
      Item 9 makes `/` page-first (D-12): until a published page is chosen,
      `surenmaharjan.fyi/` shows a "This site is being set up" placeholder
      instead of today's post list. Blocks nothing now; needed straight after
      `deploy` of item 9. `open` (spec, 2026-09-29)

- [ ] **Make the `e2e` CI check required in GitHub branch protection** -
      access; a repository setting only you can change. Once the fix for F-17
      is merged, CI has two jobs (`verify`, `e2e`); unless `e2e` is a required
      check, a red run does not stop a merge. Blocks nothing now; do it after
      the first green `e2e` run. `open` (spec, F-17 fix, 2026-10-01)

- [ ] **Run the full browser suite locally, with real R2, before every deploy** -
      manual verification; CI skips the 27 tests that upload to R2 (`E2E_SKIP_R2=1`,
      F-17 fix), so images, the logo, the picker and image + text are covered only
      by `npm run test:e2e` on your machine with the real `.env` (expect 177
      passed, item 14a2). Nothing in `deploy` runs it. Blocks nothing now; needed before each
      `deploy`, until a fake R2 server brings the 26 into CI (`dev-notes/status.md`,
      next steps). `open` (ship, F-17 fix, 2026-10-01)

- [ ] **A Stripe account for the business, in Australia** - accounts and
      spend; your business details, bank account and identity checks. Test-mode
      keys are enough to build item 21; live keys are needed before it deploys.
      Also ask an accountant when to register for GST and what overseas sales
      would trigger (D149). Blocks nothing now; needed by item 21. `open`
      (2026-10-01)

- [ ] **A domain for the platform, and its name** - spend and a decision; your
      registrar and card. `surenmaharjan.fyi` is personal; sites need
      `<name>.<platform domain>`. **You are buying one (2026-10-01): leaning
      `habre.ai`** (appeared unregistered on 2026-10-01; ~US$80 a year, 2-year
      minimum; `habre.app` the cheaper fallback; `habre.com` is taken). Before
      paying, search the name - "Habre" results are dominated by Hissène
      Habré, former president of Chad - and IP Australia's trade mark
      register. Buy through Cloudflare Registrar if it sells the ending: a
      certificate covering every subdomain needs a DNS API token, and R2 is
      already there. **`architect` decided user sites need a second domain
      (D153, 2026-10-01): buy a sites domain too** (candidates `habre.page`,
      `habresites.com`; avoid `.site`), also on Cloudflare - sites live at
      `<name>.<sites domain>` and images at `media.<sites domain>`. Blocks
      nothing now; needed by item 16. `open` (rescope review, 2026-10-01;
      second domain, architect, 2026-10-01)

- [ ] **A Cloudflare API token with DNS edit rights on the sites domain's zone
      only** - credentials; your Cloudflare account. Caddy uses it to get the
      wildcard certificate for every site (D153). It goes into Caddy's own
      environment on the server, never the repository. Blocks nothing now;
      needed by item 16 and by the v1 deploy. `open` (architect, 2026-10-01)

- [ ] **An email provider account: Resend, used over SMTP** (D156) - accounts
      and spend. Sends signup verification, password reset and contact-form
      notifications. Its free tier (3,000 a month, 100 a day) covers the beta;
      upgrade to Pro (US$20) if a batch of invites hits the daily cap. Also add
      its SPF, DKIM and DMARC records for the sending domain. **Blocks item
      15b** - signup cannot verify anyone without it - and item 19. Test
      credentials are enough to build. `open` (rescope review, 2026-10-01;
      provider chosen, architect, 2026-10-01)

- [ ] **Three AI provider accounts, each with an API key and a monthly spend
      limit: Anthropic (primary), then OpenAI and OpenRouter (fallbacks)**
      (D155) - accounts and spend. They power "start from a description". Set
      a spend cap in each provider's console as well as the app's per-site
      credit allowance. Blocks nothing now; Anthropic is needed by item 18,
      and the fallbacks can come last. `open` (rescope review, 2026-10-01;
      providers chosen, architect, 2026-10-01)

- [ ] **Free plan limits and the paid plan's price** - decision. How much AI
      use and storage Free allows, what the paid plan raises them to, and its
      price. AI use is a monthly allowance of credits, 1 credit = US$0.001 of
      provider cost (D164). Before setting them: confirm the Oracle account type (Always Free
      instances can be reclaimed when idle; pay-as-you-go removes that); pick
      the AI model from item 18's measured cost and quality; re-check Stripe's
      Australian fees (D149); ask your accountant about GST-inclusive prices.
      Starting points are in D150. Blocks nothing now; needed by item 21 (and
      the AI cap's number by item 18). `open` (rescope review, 2026-10-01)

- [ ] **Terms of service and a privacy policy** - decision; legal text only
      you can stand behind, ideally checked by someone qualified. Public signup
      makes you the host of strangers' content, and contact-form submissions
      are visitors' personal data. Blocks nothing now; needed before signup
      opens to the public (item 15's `deploy`). `open` (rescope review,
      2026-10-01)

- [ ] **The open-source licence** - decision; AGPL (a hosted fork must stay
      open) or MIT (anyone may close it). The repository is private, so nothing
      is published yet. Blocks nothing now; needed before the code is made
      public. `open` (rescope review, 2026-10-01)

- [ ] **Harden the deploy path before the v1 deploy** - decision; when to
      take it on, and a server change only you can approve. Today a release is
      a manual procedure written only as prose (`dev-notes/status.md`, the
      `deploy` skill), built on the laptop, and copied with
      `rsync --rsync-path="sudo rsync"`, so the deploy login is effectively
      root. In order: (1) a `deploy/release.sh` that builds from a clean
      clone, verifies, rsyncs, migrates, switches `current`, checks
      `/healthz` and rolls back on failure - a `spec` fix; (2) a dedicated
      deploy user whose sudo runs one activate command, plus closing root SSH
      login (F-20) - `host`, its own yes; (3) later, CI builds a tagged
      release artifact and deploy ships that file; (4) the separate production
      R2 token above. Not worth it: Docker, Kubernetes or a PaaS on this box
      (D14). Blocks nothing now; (1) and (2) are wanted before the v1 deploy,
      which carries item 14a's destructive migration. `open` (owner,
      2026-10-02)

- [ ] **Approve deleting every page and post at the v1 deploy** - decision.
      Item 14a1's migration `0009` deletes every entry and empties the menu,
      and cannot be rolled back by symlink. The content is test data and
      needs no backup (owner, 2026-10-02); this line is only the deploy's yes.
      Blocks nothing now; needed by the v1 `deploy`. `open` (spec, 2026-10-02)

## Done
