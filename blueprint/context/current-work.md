# Feature: Review, apply and Home

**From build plan:** item 18b4a
**Type:** Feature
**Verified:** not yet
**Reviewed:** not yet

## Goal

A finished AI run stops being a list of page titles: the person reads what
the AI wrote, presses **Use this draft**, and the site gets those pages as
drafts - with its menu, home page, search text and the AI's colour - in one
transaction. They land on a real Home at `/admin`: "Your website is ready",
the pages to edit, and how much of this month's AI allowance is used. This
is "AI suggests, the user applies" made real; nothing is published.

## In scope

- **The review** - the succeeded state of `/start/:runId` (18b3's
  placeholder) shows each drafted page, its sections, its search text, the
  menu, the site description, the brand colour that will be applied, and how
  many photo places are empty. One persistent live region announces each
  state change, which repairs **F-354**.
- **Use this draft** - a POST on the run's page that, in one transaction:
  marks the run `applied` (only from `succeeded`, so a second or concurrent
  apply does nothing), creates one draft page per proposal page with an
  address from `nextFreeSlug` (never from the proposal, F-353's carry-forward)
  and the buttons pointing at those addresses, its search title and
  description, then writes the menu (the proposal's order, labels its
  titles), the home page (`p1`), the site description (only when empty) and
  the brand colour (only with no logo and no colour set).
- **Onboarding closes once a draft is used:** the gate also sends `/start*`
  to `/admin` when the site has an applied run.
- **Home at `/admin` for admins** - replaces the redirect to Posts; Home
  joins the sidebar first, for admins. Editors and authors still land on
  Posts. States:
  - a draft used, nothing published: "Your website is ready. What would you
    like to change?", the draft's page count, links to edit the home page,
    Settings for the logo and the menu;
  - onboarding offered, no draft used: **Start from a description**, or
    **Review your draft** when the latest finished run was never used - the
    way back 18b3 deferred here;
  - otherwise (something published, or AI off): no panel, just the cards.
  - **Your pages** - the site's pages with Draft / Published and an Edit
    link, first 20, link to Pages for the rest.
  - **This month** - the AI allowance as a percentage used and its renewal
    date (only while AI is on), and storage as Media shows it.
- `design.md` gains the review and Home as built.

## Out of scope

- **Preview and Publish website** - **18b4b** (approved split, 2026-10-08).
  Until then the ready panel's primary action is Edit the home page.
- Make it yours, step 3, and the run starting on step 2 - **18b5**. The
  colour applied here is the AI's or none.
- Editing the proposal before applying (renaming a page, dropping a
  section): the person edits the drafts in the editor afterwards.
- Applying a second draft to a site that has used one, or replacing
  drafted pages - not offered in v1 (Decisions).
- Home for editors and authors, the Messages card (item 19), Plan and
  "See the paid plan" (item 21), the account menu.
- Images: the AI chooses none (plan section 6); the review points at the
  empty slots.

## Design reference

- **Home:** `prototypes/home.html` - `.ready` panel (without its half-size
  preview, which is 18b4b's Preview), `.suggest-list`, `.card` grid with
  *Your pages* (`.list` rows: title, `.badge`, Edit with the title in
  visually-hidden text) and *This month*. Port only the classes used into
  `app/features/admin-shell/home.module.css` with `app/app.css`'s tokens -
  no new tokens. **Two deliberate differences from the mock:** the meters
  are `app/lib/ui/meter.tsx` (native `<meter>`, design.md *Added*), and the
  AI line shows a **percentage, never credits** (plan section 6, D164) - the
  mock's "4,120 of 5,000 left" is wrong on that point.
- **The review** (not mocked; specified here, recorded in `design.md`):
  the `.flow` page and kit, like the wait.
  - `h1` Your draft is ready; lede "Here is what Habre wrote from your
    description. Nothing is public until you publish it."
  - per page, in the proposal's order, a `section` with an `h2` of its
    title (and a "Home page" badge on the first); an `ol` of its sections,
    each "<kind>: <heading>" with the palette's names - Hero, Image and
    text, Call to action, Text; a `dl` with "Title in search results" and
    "Description" (design.md *Words*: no "SEO").
  - a `section` `h2` Menu - an `ol` of the titles in menu order.
  - a `section` `h2` Your site - Site description (only when it will be
    written) and Brand colour, a 44px swatch with its hex in text (only
    when it will be applied).
  - when any hero or image-and-text section is drafted: a `Message`
    (`notice` tone, no role) "N places for a photo are empty. Add your own
    from each page's editor."
  - actions: primary **Use this draft** (busy "Applying…", `aria-busy`),
    secondary link **Change the description**; the top bar keeps Start
    blank instead.
  - a draft that can no longer be used (its proposal fails to parse): the
    failed state with error `invalid` - "Something went wrong on our side.
    Try again, or start blank." and Try again.
- One persistent `<p role="status">` above the state branches: running
  "Writing your pages…" (and the 120-second wording), failed as 18b3,
  succeeded "Your draft is ready to review." (F-354).
- 44px controls, one primary per view, no horizontal scroll at 390px, light
  and dark following the device.

## Build steps

- [x] **Step 1 - the apply plan, pure** - new
  `app/features/ai/apply-plan.ts`: `planApply(proposal, site)` where
  `site = { takenPageSlugs, hasLogo, brandColor, siteDescription }`, returns
  `{ pages: [{ key, title, slug, seoTitle, seoDescription, document }],
  navigation: [{ key, label }], homeKey, siteDescription | null,
  brandColor | null }`. Slugs: `slugFromTitle` then `nextFreeSlug` against
  the taken slugs, `RESERVED_PAGE_SLUGS` and the slugs already handed to
  earlier pages of the same proposal. Documents from `expandProposal` with
  those slugs. `null` means "leave as is". Also `reviewSummary(proposal)`
  for Step 2 (sections as `{ kindName, heading }`, empty photo count).
  *Done when:* `node --test app/features/ai/apply-plan.test.ts` passes, each
  case seen failing first: two pages titled About get `about` and `about-2`;
  a page titled Start gets `start-2`, and one whose slug is taken gets the
  next free one; every document passes `parseDocument(…, "page")` and every
  button's `href` is `/` or `/<a planned slug>`; the menu follows
  `navigation` with titles as labels; `homeKey` is `p1`; the colour is
  `null` with a logo or a colour already set, else the proposal's; the
  description is `null` when one is set; the photo count counts heroes and
  image-and-text sections.
- [ ] **Step 2 - the review and the live region** - `start-wait.tsx`'s
  succeeded state renders the review from `reviewSummary` and from
  `planApply`'s colour and description (the loader reads `getSiteSettings`
  and passes no taken slugs - the review shows no addresses); a
  succeeded run whose result does not parse reads as failed `invalid` -
  `runView` takes whether it parses, so the loader and the retry action
  share the rule and Try again is allowed. One persistent `role="status"`
  element (F-354). No apply yet: the review has no Use this draft button.
  *Done when:* `node --test app/features/onboarding/run-view.test.ts` covers
  the unparseable case (seen failing first); in `e2e/onboarding.spec.ts` a
  seeded succeeded run (`e2e` owner connection, `test-proposal`'s shape)
  shows one `h1`, an `h2` per page, each section's kind and heading, the
  menu's titles in order, the search title and description, the photo
  notice with its count, and the colour's hex when the site has none; a
  site with a brand colour set shows no colour; a seeded row whose result
  is `{}` shows Couldn't build your site and Try again; updating a running
  row to succeeded changes the `role="status"` text to "Your draft is ready
  to review." without a reload (the region is the same element - located
  once, before the update); no horizontal scroll at 390px.
- [ ] **Step 3 - Use this draft** - `entries.server.ts` exports
  `insertPageDraftsIn(tx, siteId, authorId, pages)` (the insert columns
  `insertDraft` uses, inside a given transaction) and
  `listPageSlugsIn(tx, siteId)`; `settings.server.ts` exports an
  `applyDraftSettingsIn(tx, siteId, { navigation, homePageId,
  siteDescription, brandColor })` that sets only the non-null fields. New
  `app/features/ai/apply-run.server.ts`: `applyRun(siteId, runId, userId)`
  - one `inSite` transaction: `update ai_runs set status = 'applied' where
  id and site_id and status = 'succeeded' returning result` (no row ->
  `{ ok: false, reason: "not_succeeded" }`), parse the proposal (fails ->
  roll back, `"invalid"`), read slugs and settings, `planApply`, insert,
  write settings. Logs `ai_run_applied` (siteId, runId, page count).
  `start-wait.tsx`'s action gains `intent=apply`: success or
  `not_succeeded` -> `/admin`; `invalid` -> 400 with a `role="alert"`
  banner. The review gains **Use this draft**. *Done when:* in
  `e2e/onboarding.spec.ts`, as an admin of an empty site with a seeded
  succeeded run: pressing Use this draft redirects to `/admin` (which still
  forwards to Posts until Step 5), and the owner
  connection shows one `draft` page per proposal page with its title,
  address, search title and description and `blocks_format` `v4`, a hero
  button's `href` equal to its target page's `/<slug>`, the menu holding
  those pages in order, `home_page_id` the first page, the site description
  and brand colour written, and the run `applied`; with a logo or colour
  already set, the colour is unchanged; a page already at `/about` makes
  the draft's About `/about-2`; two POSTs of `intent=apply` sent at once
  (`Promise.all` through `page.request`) leave exactly one set of pages;
  the public `/` still shows the "being set up" placeholder and the draft
  page's address is Not Found on the site host; the apply POST answers in
  **under 1 s** (quality-bar *Admin saves*), timed in the test on the local
  run, recorded with its figure in verify's evidence.
- [ ] **Step 4 - onboarding closes after a draft is used** -
  `start-gate.ts` takes `applied` (the site has a run with status
  `applied`); `runs.server.ts` gains `hasAppliedRun(siteId)` and
  `findLatestFinishedRun(siteId)` (the newest `succeeded` or `applied` run,
  for Home). The layout's gate passes it. *Done when:*
  `node --test app/features/onboarding/start-gate.test.ts` covers `applied`
  (seen failing first); in `e2e/onboarding.spec.ts`, after a draft is used,
  `/start`, `/start/about?kind=blog` and the used run's page each go to
  `/admin`, and an `intent=retry` POST to another failed run of the site
  starts no run.
- [ ] **Step 5 - Home at `/admin`, and the landing** - `app/routes.ts`:
  `admin` points at a new `app/features/admin-shell/home.tsx` (the old
  `home.ts` deleted): its loader sends an editor or author to
  `/admin/posts`; an admin gets `h1` Home and the **Your pages** card (the
  first 20 pages through `listEntries`, each with Draft or Published and an
  Edit link, Pages for the rest; the empty state "No pages yet." with Add a
  page). The sidebar gains **Home** first, for admins. `home.module.css`
  from the mock (`.card`, `.list`, the grid). Update `e2e/helpers/auth.ts`
  and the specs that expect an admin to land on `/admin/posts`. *Done
  when:* `e2e/home.spec.ts` (new): an admin's `/admin` shows one `h1` Home
  and Your pages listing a seeded draft page with Draft and an Edit link
  that opens its editor; an editor and an author landing on `/admin` reach
  `/admin/posts`, and neither sees Home in the sidebar; the sidebar's Home
  is `aria-current="page"` on Home; no horizontal scroll at 390px;
  `e2e/content-security-policy.spec.ts`'s admin check covers `/admin`; the
  whole browser suite passes after the landing change.
- [ ] **Step 6 - Home's panel** - a pure
  `app/features/admin-shell/home-state.ts` picks it: `ready` (applied,
  nothing published), `review` (offered, the latest finished run succeeded),
  `start` (offered) or `none`. The loader adds the state (published?,
  `hasAppliedRun`, the gate's offer, `findLatestFinishedRun`, the applied
  run's page count). `ready`: the `.ready` panel - "Not published yet"
  badge, `h2` "Your website is ready. What would you like to change?",
  "We drafted N pages from your description. Look them over and change
  anything - nobody sees them before you publish.", primary **Edit the home
  page**; the `.suggest-list` with Add your logo and Change the menu (both
  Settings). `review`: "Your draft is waiting." with **Review your draft**.
  `start`: "Let Habre draft your site from a short description." with
  **Start from a description**. *Done when:*
  `node --test app/features/admin-shell/home-state.test.ts` covers each
  state (seen failing first); in `e2e/home.spec.ts`, after a draft is used
  Home shows Not published yet, the heading, the draft's N, and Edit the
  home page opens the first page's editor; an admin of an empty site gets
  Start from a description -> `/start`; with an unused succeeded run,
  Review your draft -> its page; a site with a published page, and the
  host-split server (AI off), show none of those.
- [ ] **Step 7 - This month: the AI meter** - a pure
  `app/features/ai/allowance-summary.ts`: `allowanceSummary(used,
  allowance, now)` -> `{ text, value, max }` - "N% of this month's AI
  allowance used. Renews on 1 November." (whole percent, rounded down, at
  most 100; `renewalDate` from `start-refusals.ts`); with no limit "No
  monthly AI limit." and no meter. Home's This month card: the AI meter
  only while AI is on (`runner !== null`), from `runStore.creditsUsedSince`
  and `env.AI.creditsPerMonth`; storage from Media's `storageSummary`.
  *Done when:* `node --test app/features/ai/allowance-summary.test.ts`
  (seen failing first): 0 used -> 0%; 999 of 1,000 -> 99%; 1,040 of 1,000
  -> 100%; no limit -> no meter; 31 December -> 1 January. In
  `e2e/home.spec.ts`, a site with seeded runs holding 250 credits this month
  (allowance 1,000) shows a `meter` named AI allowance with value 250 and
  "25% of this month's AI allowance used.", and no figure in credits or
  tokens anywhere on the page; on the host-split server (AI off) there is
  no AI meter and the storage meter remains.
- [ ] **Step 8 - from the emailed link to Home** - `design.md`: *Screens*'
  AI-drafting row gains the review as built, the Home row built (with the
  two differences from the mock), First run row updated; journey 1 notes
  Preview and Publish as 18b4b. *Done when:* `e2e/onboarding.spec.ts`'s
  journey walks, as full page loads and through the app's own links: sign
  up -> Mailpit -> Confirm my email -> `/start` -> Business -> Continue -> a
  description -> Build my site -> the review (its status line announced) ->
  Use this draft -> Home at `/admin` with "Your website is ready" and the
  fake proposal's page titles under Your pages -> Edit the home page ->
  the editor of the page whose title is the fake's first page, final URL
  `/admin/pages/<uuid>`. `npm run verify` and the full `npm run test:e2e`
  pass locally.

## Files and areas

- new `app/features/ai/apply-plan.ts`, `apply-run.server.ts`,
  `allowance-summary.ts`, tests
- `app/features/ai/runs.server.ts` - `hasAppliedRun`,
  `findLatestFinishedRun`
- `app/features/content/entries.server.ts` - `insertPageDraftsIn`,
  `listPageSlugsIn`
- `app/features/settings/settings.server.ts` - `applyDraftSettingsIn`
- `app/features/onboarding/start-wait.tsx`, `run-view.ts`,
  `start-gate.ts`, `start-layout.tsx`, `onboarding.module.css`
- `app/features/admin-shell/home.tsx` (replaces `home.ts`), `home-state.ts`,
  `home.module.css`, `layout.tsx` (Home in the nav)
- `app/routes.ts`
- `e2e/onboarding.spec.ts`, new `e2e/home.spec.ts`, `e2e/helpers/auth.ts`
  and the specs that expect an admin on `/admin/posts` after sign-in
- `blueprint/context/design.md`

## Data and contracts

- **No migration.** `ai_runs.status` already allows `applied` (0020);
  entries and `site_settings` columns all exist.
- **`planApply(proposal: Proposal, site: { takenPageSlugs: string[];
  hasLogo: boolean; brandColor: string; siteDescription: string }):
  ApplyPlan`** - pure; 18b5 passes the colour step 3 chose by setting
  `brandColor` before the call, so the "only when unset" rule stays in one
  place. Load-bearing for 18b4b and 18b5.
- **`applyRun(siteId, runId, userId): Promise<{ ok: true; pageIds:
  string[] } | { ok: false; reason: "not_succeeded" | "invalid" }>`** - the
  one writer of `applied`. 18b4b's Publish website publishes the pages of
  the site's applied run, found as the menu's pages (no new column).
- **`startGate({ aiOn, suspended, published, applied })`.**
- **Home's state:** `homeState({ published, applied, offered,
  latestFinished }) -> "ready" | "review" | "start" | "none"` - 18b4b adds
  Preview and Publish website to `ready`.
- Navigation items stay `{ label, pageId }`; no stored shape changes.

## Testing

- **Unit (`npm test`, inside `verify`, CI):** `apply-plan`, `run-view`,
  `start-gate`, `home-state`, `allowance-summary` - all pure, no database.
- **Browser (`npm run test:e2e`, locally and in CI's `e2e` job):**
  `e2e/onboarding.spec.ts` and new `e2e/home.spec.ts` on the primary server
  (`AI_PROVIDERS=fake`), seeding runs through the owner connection
  (`DATABASE_OWNER_URL`) so nothing waits on the fake's timer except the
  Step 8 journey. Tests that start a run stay in 18b3's `serial` block. The
  AI-off check uses the host-split server. No R2 upload, so nothing is
  skipped in CI.
- The database behaviour of `applyRun` - one transaction, the concurrent
  apply, slugs against stored pages - is proven in the browser tests, since
  `npm test` has no database (CI's `verify` job runs it without one).
- The 1-second apply timing is one local sample, not a p95; it is evidence
  that the transaction is not pathological, recorded as such.

## Decisions

- **Item 18b4 splits into 18b4a (review, apply, Home) and 18b4b (Preview
  and Publish website)** (owner, 2026-10-08). Beat: one item of ~10 steps;
  leaving Preview and Publish unplanned, which would leave journey 1
  without an end.
- **A site uses one AI draft in v1:** once a run is applied, onboarding is
  no longer offered. Beat: a second apply adding a second set of pages
  (`home-2`, `about-2`) and replacing the menu under the first. Before
  applying, Change the description and Try again remain.
- **Apply fills the site description and brand colour only when they are
  unset** (the colour also only with no logo, D167); **it replaces the menu
  and the home page.** Beat: overwriting what a person typed in Settings
  after choosing Start blank; keeping a menu that points at none of the new
  pages.
- **Home is the admin's landing; editors and authors keep Posts.** Beat:
  Home for every role, whose content (the draft, the AI allowance) is
  admin-only, leaving an empty screen for authors.
- **Page addresses come from titles through `nextFreeSlug`, never from the
  proposal** (F-353's carry-forward), and the first page (`p1`) is the
  home page (the instructions already say so).
- **The run is claimed first in the transaction** (`status = 'succeeded'`
  in the update's `where`): the row lock serialises concurrent applies, the
  loser sees no row and creates nothing. Beat: an advisory lock or a
  read-then-write check.
- **A succeeded run whose proposal no longer parses shows as failed
  `invalid` and may be retried.** Beat: a 500, or a review with nothing in
  it.
- **The AI meter shows a percentage used, rounded down, capped at 100**
  (plan: never tokens or credits). Beat: credits left (the mock).

## Production needs

None. No migration, no new variable. Production already needs
`OPENROUTER_API_KEY` (18b1) for any of this to be reached.

## Behaviour changes

- Changes `onboarding.4` from "Build my site starts a run and opens its page, which shows the draft's page titles once it succeeds, without a reload" to "Build my site starts a run and opens its page, which shows the draft's review once it succeeds, without a reload" - Step 2
- Changes `onboarding.2` from "`/start` and its steps send to the admin when AI is off, the site is suspended or anything is published, and are Not Found to a member who is not an admin" to "`/start` and its steps send to the admin when AI is off, the site is suspended, anything is published or the site has used an AI draft, and are Not Found to a member who is not an admin" - Step 4
- Adds to `onboarding`: the review lists each drafted page with its sections, search title and description, the menu, and the brand colour only when it will be applied - Step 2
- Adds to `onboarding`: a finished run whose draft no longer reads as a valid proposal shows Couldn't build your site and offers Try again - Step 2
- Adds to `onboarding`: Use this draft creates one draft page per drafted page with its search text, sets the menu in the draft's order and the first page as the home page, and publishes nothing - Step 3
- Adds to `onboarding`: using a draft twice, or twice at once, creates its pages once - Step 3
- Adds to `onboarding`: using a draft writes the site description only when it is empty, and the brand colour only when the site has no logo and no colour - Step 3
- Adds to `onboarding`: a drafted page never takes the address of an existing page or a reserved address - Step 3
- New capability `home`: an admin's `/admin` is Home; an editor's or author's goes to Posts - Step 5
- New capability `home`: Home lists the site's pages with Draft or Published and an Edit link - Step 5
- New capability `home`: after a draft is used and while nothing is published, Home says the website is ready, with the draft's page count - Step 6
- New capability `home`: while onboarding is offered, Home offers Start from a description, or Review your draft when the latest finished draft was never used - Step 6
- New capability `home`: while AI is on, Home shows this month's AI allowance as a percentage used and the date it renews, never credits or tokens - Step 7

## Notes

- `inSite` + `site_id` in every query (D151) - including the claim update,
  the slug read and the settings write, all on the one `tx`.
- AI output stays untrusted: the review renders proposal text through
  React as text; documents are re-checked by `parseDocument` in Step 1's
  tests and are the expansion of an already-parsed proposal at runtime;
  `applyRun` re-parses the stored result with `proposalSchema`, never
  trusting the row.
- Never log the description or page text; `ai_run_applied` carries ids
  and a count.
- The layout's gate middleware still guards the apply POST (nothing
  published, AI on, not suspended, admin) - nothing new needed for that.
- Every POST is covered by root's `refuseCrossSiteRequests`.
- F-355 (journey tests timed against the 1-second fake) touches Step 8's
  journey; keep its assertions to final states, not "Building your site".
- React Router 8's installed docs decide route-module patterns
  (`node_modules/react-router/docs/`).
- Semantic HTML (`coding-standards.md`): `section`/`h2` per page, `ol` for
  sections and the menu, `dl` for search text, `ul` for Your pages.
