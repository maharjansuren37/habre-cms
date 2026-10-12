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
      image, a button and a section, and the media picker in the editor; from
      item 14a3, the block toolbar, the Text style menu, the move and delete
      announcements and the chip's section moves; from item 14b, the drag
      announcements - over a place, dropped, cancelled - the grip's name and
      Duplicate; from item 14c1, the Sections tiles, the dialog's "Add to the
      page" headings, the "added" announcement and the empty-text hints;
      from item 14c2, a section tile's drag announcements - "Hero: drop as
      section 2 of 4.", release to cancel, added, cancelled; from item 15c,
      `/forgot-password` with its neutral reply, `/reset-password` with its
      field error and expired state, and login's "Forgot your password?" link;
      from item 15d, Media's storage meter, its full line and the refusal;
      from item 15e1, Your account's three forms, their banners and field
      errors, the shell's Your account link, and `/confirm-email`; from item
      15e2, the Delete account section, `/admin/account/delete` in its three
      states, and login's "Your account is deleted." banner; from item 17,
      the editor's Search and sharing disclosure and its image picker, and
      Settings' Site description and Language; from item 18a1, Settings'
      Brand section - the colour swatches, Other colour, the Style cards and
      the preview's name; from item 18a2, Upload logo with its busy state and
      refusals, and the "from your logo" swatches; from item 18b3, `/start`'s
      kind cards, Tell us about it with its field error and refusal banners,
      and the wait's progress, its announced finish and failure states; from item 18b4a, the draft's review and its status line, Use this draft, Home's panel, Your pages and the AI meter; from item 18b4b, Publish website with its busy state, Preview's new-tab link, the published banner and View your site, and the preview's bar; from item 18b5, Make it yours - its Logo field, the colour row with Let the AI choose, the Style cards, Finish's busy state and its refusal banner, and Skip for now; from item 19b, the palette's Contact form tile, its settings' Button text and Thanks message, and the block's canvas view; from item 21a, `/admin/plan` with its two meters and the nav's Plan entry; from item 20, Settings' Editing level and Dark mode, and a locked Heading 5's style button with its "Switch to Pro to change." announcement).
      Done during item 1's `verify`, from its `--manual` walkthrough.
      **Risk accepted by the owner, 2026-09-23: shipping items 5-8 to
      production without this; will do the accessibility pass after the MVP
      is live.** Blocks nothing now; `preflight` needs it (design.md lists it as
      unchecked). `open` (spec,
      2026-09-15; widened, item 3; widened, item 6a; widened, item 7a;
      widened, item 7b; widened, item 8; risk accepted, preflight, 2026-09-23;
      widened, item 9; widened, item 14a3; widened, item 14b; widened, item 14c1;
      widened, item 14c2; widened, spec 15c, 2026-10-04; widened, spec 15d,
      2026-10-04; widened, spec 15e1, 2026-10-05; widened, spec 15e2, 2026-10-05; widened, spec 17, 2026-10-06; widened, spec 18a1, 2026-10-07; widened, spec 18a2, 2026-10-07; widened, spec 18b3, 2026-10-07; widened, spec 18b4a, 2026-10-08; widened, spec 18b4b, 2026-10-08; widened, spec 18b5, 2026-10-08; widened, spec 19b, 2026-10-12; widened, verify 20, 2026-10-12; widened, spec 21a, 2026-10-12; widened, verify 21b, 2026-10-12: `/admin/plan`'s Choose how to pay group, trial and Manage billing buttons and its banners)

- [ ] **Drag a block by its grip on a real phone** (iOS Safari and Android
      Chrome) - hardware and manual verification; the browser tests dispatch
      touch pointer events in Chromium, which is not a finger on glass. Check
      that the page does not scroll under the drag, that auto-scroll reaches
      the last section, and that the gap and ghost fit the screen. Also, on
      a landscape tablet (side panel showing), that a tap on a palette tile
      adds its block and never starts a drag (F-196). Blocks
      nothing now; `verify` of item 14b names it as not proven, and
      `preflight` needs it before the v1 deploy. `open` (spec, 2026-10-03;
      widened, drag tidy fix, 2026-10-04)

- [ ] **Screen-reader and keyboard pass over the public site** (NVDA,
      VoiceOver or Orca) - manual verification; nobody has looked at these
      screens with a screen reader, unlike the admin screens above. Covers
      the home page, one post (including inline bold/italic/link formatting
      rendered as real elements), one page (item 6b, once built - same
      typography and block rendering as a post, minus the byline), the
      header's navigation menu (item 7b), the
      404 page (item 4b), and a page with images and buttons (item 14a2), and one with a contact form (item 19b) - the form, its Name, Email and Message labels, and the status line after a send. **Risk accepted by the owner, 2026-09-23: shipping
      items 5-8 to production without this; will do the accessibility pass
      after the MVP is live.** Blocks nothing now; `preflight` needs it before a
      real release. `open` (spec, 2026-09-21; widened, item 6b; widened, item 7b;
      risk accepted, preflight, 2026-09-23; widened, spec 19b, 2026-10-12)

- [ ] **Fill `PLATFORM_URL`, `SITES_URL` and `JWT_SECRET` in your local `.env`** -
      credentials; it is your secrets file, so no agent writes to it. Item 16a
      replaces `PUBLIC_URL` and `ADMIN_URL` with `PLATFORM_URL`
      (`http://app.localhost:3000`) and `SITES_URL` (`http://localhost:3000`);
      a site is then at `http://<address>.localhost:3000`, site 1 at
      `http://surenmaharjan.localhost:3000`. Generate the secret with the
      command in `.env.example`. Blocks `npm run dev` and `npm start` locally
      once item 16a's Step 3 lands (the server refuses to start without
      them); the browser tests set their own. Production values are `host`'s.
      `open` (build, 2026-09-15; reworded for the `APP_URL` split, spec,
      2026-09-21; reworded for item 16a, spec, 2026-10-06)

- [ ] **Choose a home page in production's Settings right after item 9 is
      deployed** - decision; which page is the site's front door is yours.
      Item 9 makes `/` page-first (D-12): until a published page is chosen,
      `surenmaharjan.fyi/` shows a "This site is being set up" placeholder
      instead of today's post list. Blocks nothing now; needed straight after
      `deploy` of item 9. `open` (spec, 2026-09-29)

- [ ] **Upload an SVG logo in Settings in Firefox and Safari** - manual
      verification; the browser tests run Chromium only, and older Safari
      tainted any canvas an SVG was drawn on, which would stop the SVG
      becoming a PNG. Upload `e2e/fixtures` SVG logo in each: it shows as the
      logo, "Saved as a PNG for the web." appears, and its colours are
      offered. Blocks nothing now; `verify` of item 18a2 names it as not
      proven, and `preflight` needs it before the v1 deploy. `open` (spec
      18a2, 2026-10-07)

- [ ] **Check a real share preview and the sitemap after the v1 deploy** -
      manual verification; no test reaches Facebook's, LinkedIn's or
      Google's own fetchers. Paste a published page's address into a share
      debugger (e.g. Facebook's Sharing Debugger) and Google Search
      Console's URL inspection: the title, description and image show, and
      `sitemap.xml` is read. Blocks nothing now; `preflight` names it after
      the v1 deploy. `open` (spec 17, 2026-10-06)

- [ ] **Make the `e2e` CI check required in GitHub branch protection** -
      access; a repository setting only you can change. Once the fix for F-17
      is merged, CI has two jobs (`verify`, `e2e`); unless `e2e` is a required
      check, a red run does not stop a merge. Blocks nothing now; do it after
      the first green `e2e` run. `open` (spec, F-17 fix, 2026-10-01)

- [ ] **Run the full browser suite locally, with real R2, before every deploy** -
      manual verification; CI skips the tests that upload to R2 - every
      `test.skip(skipWithoutStorage)` (`E2E_SKIP_R2=1`, F-17 fix) - so images,
      the logo, the picker and image + text are covered only by
      `npm run test:e2e` on your machine with the real `.env` (every test
      passes, none skipped). Nothing in `deploy` runs it. Blocks nothing now;
      needed before each `deploy`, until a fake R2 server brings those tests
      into CI (`dev-notes/status.md`, next steps). `open` (ship, F-17 fix, 2026-10-01)

- [ ] **A Stripe account for the business, in Australia** - accounts and
      spend; your business details, bank account and identity checks. Test-mode
      keys are enough to build item 21; live keys are needed before it deploys.
      Also ask an accountant when to register for GST and what overseas sales
      would trigger (D149). Blocks nothing now; needed by item 21. `open`
      (2026-10-01)

- [ ] **A real test-mode Checkout and Portal round trip** - manual
      verification; it needs your Stripe test-mode keys, a test product with a
      monthly price, a webhook endpoint (the Stripe CLI's `stripe listen
      --forward-to http://app.localhost:3000/webhooks/stripe` works locally)
      and the Customer Portal switched on. With the three `STRIPE_*` values in
      your local `.env`: Upgrade on `/admin/plan` with card 4242 4242 4242
      4242 shows Launch within seconds; Manage billing opens the Portal;
      cancelling there drops the site to Free when the period ends; once with JavaScript and once with it off (F-410: `form-action`); card
      4000 0000 0000 0341 on renewal gives the failed-payment banner. Blocks
      nothing now; `verify` of item 21b names it as not proven, and
      `preflight` needs it before billing is turned on. `open` (spec 21b,
      2026-10-12)

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

- [ ] **Caddy with the Cloudflare DNS module on `ocwebserver`, and its env
      file filled in** - system software and credentials; a change to the
      server's shared Caddy only you can approve (`host`). Item 16b's Caddy
      file needs `dns.providers.cloudflare` (e.g. `caddy add-package
      github.com/caddy-dns/cloudflare`) and `/etc/caddy/habre-cms.env` holding
      `HABRE_PLATFORM_DOMAIN`, `HABRE_SITES_DOMAIN` and the token above;
      `setup-server.sh` refuses without them. Blocks nothing now; needed by
      the v1 deploy, after both domains are bought. `open` (spec 16b,
      2026-10-06)

- [ ] **An email provider account: Resend, used over SMTP** (D156) - accounts
      and spend. Sends signup verification, password reset and contact-form
      notifications. Its free tier (3,000 a month, 100 a day) covers the beta;
      upgrade to Pro (US$20) if a batch of invites hits the daily cap. Also add
      its SPF, DKIM and DMARC records for the sending domain, which sits on
      the platform domain still to be bought. **No longer blocks building
      15b**: development and CI send to Mailpit. Needed before signup is
      turned on in production (`SMTP_URL`, `EMAIL_FROM`; item 15b's
      production needs) and by item 19. `open` (rescope review, 2026-10-01;
      provider chosen, architect, 2026-10-01; narrowed to deploy, spec 15b,
      2026-10-04)

- [ ] **Three AI provider accounts, each with an API key and a monthly spend
      limit: OpenRouter (primary), then Anthropic and OpenAI (fallbacks)**
      (D155) - accounts and spend. They power "start from a description". Set
      a spend cap in each provider's console as well as the app's per-site
      credit allowance. **Order changed (D155 amended, 2026-10-07):
      OpenRouter is now the primary, Anthropic and OpenAI direct the optional
      fallbacks. OpenRouter blocks item 18b1's Step 7**: buy a few dollars of
      OpenRouter credits, set a credit limit on the key, and put it in your
      local `.env` as `OPENROUTER_API_KEY` (no agent writes to it); a
      separate production key is needed by the v1 deploy. **18b2 shipped
      without the Anthropic and OpenAI keys (owner, 2026-10-07)**, so these
      live checks are still owed, before the v1 deploy: put
      `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` in your local `.env`, plus
      each one's model and price (`ANTHROPIC_MODEL`, `ANTHROPIC_PRICE`,
      `OPENAI_MODEL`, `OPENAI_PRICE` - formats in `.env.example`); then a
      succeeded `npm run ai:try` with `AI_PROVIDERS` set to `anthropic`
      alone and to `openai` alone, each recording its provider, model,
      tokens, cost and credits; a second Anthropic run, noting cache reads
      or why there are none (F-352: the instructions may be under the
      model's minimum cacheable prefix); and `npm run ai:measure` with all
      three configured (12 proposal files), whose tables feed *Free plan
      limits* below. Archived spec: `blueprint/history/features/18b2-fallbacks.md`. `open` (rescope review, 2026-10-01;
      providers chosen, architect, 2026-10-01; OpenRouter first and blocks 18b1 Step 7, spec 18b1, 2026-10-07; direct keys block 18b2 Steps 6-7, spec 18b2, 2026-10-07; moved past 18b2's ship, spec amendment, 2026-10-07)

- [ ] **Compare four AI runs with OpenRouter's activity page** - manual
      verification; it needs your OpenRouter login. Item 18b1's Step 7 made
      four runs on 2026-10-07 with `anthropic/claude-opus-5.5`, which stored
      costs of US$0.041465, 0.029836, 0.021908 and 0.034184 (42, 30, 22 and
      35 credits). Check the activity page shows the same four costs. Blocks
      nothing now; `verify` of item 18b1 names it as not proven, and
      `preflight` needs it before the v1 deploy. `open` (build 18b1,
      2026-10-07)

- [ ] **Free plan limits and the paid plan's price** - decision. How much AI
      use and storage Free allows, what the paid plan raises them to, and its
      price. AI use is a monthly allowance of credits, 1 credit = US$0.001 of
      provider cost (D164). Before setting them: confirm the Oracle account type (Always Free
      instances can be reclaimed when idle; pay-as-you-go removes that); pick
      the AI model from item 18's measured cost and quality; re-check Stripe's
      Australian fees (D149); ask your accountant about GST-inclusive prices.
      Starting points are in D150. Item 15d reads the storage number from
      `STORAGE_LIMIT_MB` (500 MB when unset); item 18b1 reads the AI number
      from `AI_CREDITS_PER_MONTH`, 1,000 (US$1) when unset, provisional
      until 18b2 measures a run. Blocks nothing now; needed by
      item 21 (the AI cap's number by item 18, the storage number by the v1
      deploy if not 500 MB). `open` (rescope review, 2026-10-01)

- [ ] **Terms of service and a privacy policy** - decision; legal text only
      you can stand behind, ideally checked by someone qualified. Public signup
      makes you the host of strangers' content, and contact-form submissions
      are visitors' personal data. It should also say that deleting an
      account is immediate and that deleted data stays in the nightly backups
      until they age out (7 days locally per `deploy/backup-db.sh`; the R2
      backup bucket's retention is not recorded - check it). Blocks nothing now; needed before signup
      opens to the public (item 15's `deploy`). `open` (rescope review,
      2026-10-01; widened, spec 15e2, 2026-10-05)

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

- [ ] **Approve deleting every page and post, every image and every account
      at the v1 deploy** - decision. Item 14a1's migration `0009` deletes
      every entry and empties the menu. Item 15b's `0012` then deletes every
      user, membership and media row, because v1 starts with no accounts
      (owner, 2026-10-04); `create-admin` makes the first admin afterwards.
      Neither migration can be rolled back by symlink. The content is test
      data and needs no backup (owner, 2026-10-02); this line is only the
      deploy's yes. Blocks nothing now; needed by the v1 `deploy`. `open`
      (spec, 2026-10-02; widened, spec 15b, 2026-10-04)

- [ ] **Check a contact-form notification in a real inbox, and the Messages
      screen with a screen reader** - manual verification; Mailpit is not
      Resend, and no test hears what is announced. After the v1 deploy,
      with `SMTP_URL` set: send the form from a published page, confirm the
      email arrives (not in spam) with the visitor as Reply-To. Then NVDA,
      VoiceOver or Orca over `/admin/messages`: the list, the Unread badge,
      Mark as read / unread, the empty state and the "email failed" line,
      and Settings' Send messages to field. Blocks nothing now; `preflight`
      needs it before the v1 deploy. `open` (spec 19c, 2026-10-12)

- [ ] **Name Heading 5 and Heading 6** - decision; item 20 ships them as the
      placeholders "Heading 5" and "Heading 6" (no mockup), and Simple's styles
      are words. Rename in `app/features/blocks/block-toolbar.client.tsx`
      (`STYLES`) and `block-moves.ts` (`kindName`). Blocks nothing; wanted before
      the v1 deploy. `open` (spec 20, 2026-10-12; the plan edits for dark mode
      at every level were approved and made the same day)

- [ ] **Caddy's on-demand TLS `ask` option on `ocwebserver`** - access; the
      server's main Caddyfile is not in the repository, so only you approve
      the change (`host`). Add `on_demand_tls { ask
      http://127.0.0.1:3000/_caddy/ask }` to its global options and reload
      Caddy; item 21c's catch-all block needs it. Blocks nothing now; needed
      by the v1 deploy, with the Caddy line above. `open` (spec 21c,
      2026-10-12)

- [ ] **A real own-domain round trip after the v1 deploy** - spend and manual
      verification; needs a spare domain and its DNS. On a Launch site add the
      domain at `/admin/plan`, create the TXT and address records, press
      Check now: it verifies; the first visit gets a certificate within
      seconds; the subdomain 301s to it; Remove puts the subdomain back. Also
      once with Cloudflare's proxy on, to see the "not pointing here yet"
      line. No test reaches Let's Encrypt. Blocks nothing now; `preflight`
      needs it before own domains are offered. `open` (spec 21c, 2026-10-12)

## Done
