# Fix: terms of service and privacy policy pages (F-428)

**Type:** Fix
**Verified:** 2026-10-13, autopilot - every done-when proven by browser tests against the served app (e2e/legal.spec.ts, 9 pass); full `npm run test:e2e` 691 passed, 2 failed - the known F-399 and F-230, both in the editor, untouched here
**Reviewed:** 2026-10-13, autopilot (independent reviewer, scope current) - no P0/P1; F-437 to F-441 raised; repaired by build the same day (F-437, F-438, F-441 closed; F-439, F-440 fixed)

## Goal

Open signup (`SIGNUP_MODE=open`, owner 2026-10-13) makes Habre the host of
strangers' sites and their visitors' messages, so a terms of service and a
privacy policy must be live, and agreed to at signup, before the v1 deploy
(F-428). The agent drafts both texts from what the code actually does; **the
owner edits them, fills every placeholder and stands behind them** - the agent
is not a lawyer, and the drafts say nothing the code does not do.

## In scope

- Two pages on the platform host, signed out or in: `/legal/terms` and
  `/legal/privacy`.
- A draft of each text, every fact traced to the code or the environment
  table, with `[OWNER: ...]` placeholders where only the owner knows the answer.
- On `/signup`, directly above **Create my website**: "By creating an account
  you agree to the Terms of service and Privacy policy.", both linked.
- On `/admin/login`, under the form: links to both pages.
- Each policy page links to the other and back to `/signup`.

## Out of scope

- A footer across Habre's admin screens - there is no platform footer today;
  the design row "Footer privacy, terms, contact" is narrowed to these links,
  and a real footer waits for a marketing site.
- A privacy notice on customers' sites for their contact-form visitors - each
  site owner's responsibility; the terms say so.
- Recording which version of the terms someone agreed to, or asking existing
  members to re-agree - no members exist yet (production starts empty).
- A cookie banner - Habre sets only strictly necessary cookies (below).
- The licence (AGPL or MIT) - not needed until the code is public.
- Legal review - the owner's.

## Build steps

- [x] **Step 1 - the paths** - `isPlatformPath` (`app/lib/content-security-policy.ts`)
  takes any path under `/legal/`, and `app/routes.ts` gets
  `route("legal/:document", "features/legal/legal-page.tsx")` with a
  placeholder module that returns Not Found for every document. *Done when:*
  unit tests in `content-security-policy.test.ts` and `host-routing.test.ts`
  show `/legal/terms` is a platform path, is allowed on the platform host,
  redirects from a site host to the platform's `/legal/terms`, and that
  `/legal` and `/privacy` alone are not platform paths (a site's page called
  `privacy` or `legal` is untouched); `npm run verify` passes.

- [x] **Step 2 - the documents as data** - `app/features/legal/legal-documents.ts`
  exports `LEGAL_DOCUMENTS`, keyed `terms` and `privacy`, each
  `{ title, updated: "YYYY-MM-DD", intro: string[], sections: { id, heading,
  paragraphs: string[], list?: string[] }[] }` - plain strings, no HTML, so
  editing the text never touches markup (D28-D30). Both drafts written here
  (content below). *Done when:* `legal-documents.test.ts` passes, asserting for
  each document: `updated` is a real date, section ids are unique and
  kebab-case, no string is empty; and that the privacy policy names
  OpenRouter, Resend, Cloudflare, Stripe and Oracle Cloud, and not Anthropic or
  OpenAI, which the app never calls (F-438; owner, 2026-10-13: OpenRouter only).

- [x] **Step 3 - the page** - `legal-page.tsx` renders the document for
  `params.document`, 404 for any other value (the project's
  `data("Not Found", { status: 404 })`). The signup layout's brand mark (its own CSS module - no import of `signup.module.css` across features), then
  `main` > `article`: one `h1` (the title), "Last updated" as a `<time
  dateTime>`, the intro, each section an `h2` with its `id`, paragraphs as `p`,
  a list as `ul`; running text at `--size-measure`; links to the other policy
  and to `/signup` at the end. Title `<Terms of service | Privacy policy> -
  Habre`. Light and dark from the existing tokens. *Done when:*
  `e2e/legal.spec.ts` shows each page's `h1` by role, its "Last updated" date,
  every section heading as a level-2 heading, and that `/legal/other` is a 404;
  at 390px wide the page has no horizontal scroll.

- [x] **Step 4 - agreeing at signup, and the login links** - the sentence above
  Create my website on `/signup`, and "Terms of service · Privacy policy" under
  the login form. *Done when:* the links show with signup in any mode and with email on or off; `e2e/legal.spec.ts` follows each link from
  `/signup` and from `/admin/login` to the right page by its `h1`, and the
  existing signup and login specs still pass (`npm run test:e2e`, locally with
  the development database; CI's `e2e` job runs the same spec).

- [x] **Step 5 - the owner's edit** _(moved out by the owner, 2026-10-13: the drafts ship as drafts for testing, not public; tracked in `needs-you.md` and `production-pending.md`)_ (owner, not an agent) - the owner reads both
  drafts, changes what they will not stand behind, and replaces every
  `[OWNER: ...]` placeholder; ideally someone qualified reads them. *Done when:*
  `grep -c "\[OWNER" app/features/legal/legal-documents.ts` prints `0`, and the
  owner says the text is final; `updated` is that day.

- [x] Repair F-437 - `/legal/` answers 500, and every site host redirects there
- [x] Repair F-438 - the privacy policy names direct AI providers the app never calls (owner: OpenRouter only)
- [x] Repair F-439 - local backups live about 9 days, not the 7 the policy states
- [x] Repair F-440 - smaller gaps between the legal drafts and the code
- [x] Repair F-441 - the policy pages link to /signup even when signup is off

## Files and areas

- `app/lib/content-security-policy.ts` (+ test), `app/lib/host-routing.test.ts`
- `app/routes.ts`
- `app/features/legal/legal-documents.ts` (+ test), `legal-page.tsx`,
  `legal-page.module.css` - new feature directory
- `app/features/signup/signup.tsx`, `signup.module.css`;
  `app/features/auth/login.tsx`, `login.module.css`
- `e2e/legal.spec.ts` (new)
- `blueprint/context/design.md` - the "Footer privacy, terms, contact" row

## Data and contracts

- No schema change, no migration, no environment variable.
- `LEGAL_DOCUMENTS` shape above; section `id`s become page anchors
  (`/legal/privacy#ai`), so changing one breaks a link - keep them once
  published.
- Paths `/legal/terms` and `/legal/privacy` are load-bearing: emails and a
  future marketing site will link to them.

## What the drafts say (facts the code backs)

**Privacy policy** - who: `[OWNER: legal name or trading name, ABN if any,
contact email]`, Australia. What is collected and why:
- members: name, email, a password stored only as a slow hash (scrypt), the
  site's address and settings, content and images they upload; to run the
  account and the site.
- onboarding: the description typed at `/start` and the site name, stored in
  `ai_runs` with the result, token counts and cost; **sent to OpenRouter**,
  which passes it to the model provider it routes to (the app calls OpenRouter
  alone, D405 - F-438); AI output is a draft the member reviews.
- visitors who use a site's contact form: name, email, message, stored for that
  site and emailed to its owner; Habre handles them on the site owner's behalf.
- billing (when on): Stripe holds card details - they never reach Habre; Habre
  keeps the Stripe customer and subscription ids and the plan.
- logs: the web server's access logs (IP address, time, address requested,
  browser) in rolling files of 10 MB, the last 3 kept; the app's log records
  failed sign-ins and security events.
- Cookies: a session cookie (7 days, httpOnly) after signing in, and
  one holding the email being confirmed during signup (24 hours) - both
  strictly necessary; no analytics, no advertising, no tracking.
- Where: the server is Oracle Cloud `[OWNER: region]`; images and nightly
  database backups in Cloudflare R2; email sent through Resend.
- Processors list: Oracle Cloud, Cloudflare, Resend, OpenRouter (and the
  provider it routes to), Stripe.
- Retention and deletion: an account is deleted at once by its owner from Your
  account; the last admin deleting takes the site, its content, images,
  messages and AI runs; a deleted member's posts stay on the site with no
  name. Deleted data stays in backups up to 9 days on the server (F-439) and
  `[OWNER: R2 backup retention]` in R2.
- Rights: access, correction, deletion, complaint to the OAIC; contact
  `[OWNER: email]`. No sale of data; no AI training by Habre.

**Terms of service** - who and agreement; eligibility `[OWNER: minimum age,
e.g. 18]`; your account and keeping the password safe; your content is yours,
with a licence to Habre only to host and show it; acceptable use (no illegal
content, malware, phishing, spam, infringement, abuse of other people) -
Habre may suspend a site (`suspend-site`) or remove content; contact forms on
your site: you are responsible to your visitors, including your own privacy
notice; AI drafts may be wrong - you review before publishing; plans and
limits: Free's storage and AI credits, a limit refuses the action, never takes
down the published site; paid plans (when on) through Stripe, cancel any time
via Manage billing, ends at the period's end; beta: provided as is, may
change; ending: delete your account any time, Habre may close accounts that
break the terms; liability limited `[OWNER: as far as Australian Consumer Law
allows]`; governing law `[OWNER: state], Australia`; changes to the terms,
with notice by email.

## Testing

- Unit (`npm test`, inside `verify`, needs nothing): path tests, the documents'
  shape test.
- Browser (`npm run test:e2e`, locally with the development database and in CI's
  `e2e` job, which has one): `e2e/legal.spec.ts`. No R2 needed, so not skipped
  in CI.

## Decisions

- **Policies live in the app, at `/legal/<document>`, on the platform host** -
  beat `/terms` and `/privacy`, which `isPlatformPath` would have taken from
  every customer site (a single-segment path redirects to the platform), and
  beat a hosted document elsewhere, which self-hosters could not ship.
- **Text as typed data, not markup or Markdown** - no new dependency (a
  Markdown renderer) and no raw HTML (D28-D30); the owner edits strings.
- **The drafts follow the code where the spec's notes did not** (build, Step 2) -
  the AI is sent the kind of site and the description, not the site name
  (`chat-completion.ts`); the policy also says uploaded images sit at a public
  address, and that the last admin deleting takes the other members' accounts.
  Two placeholders added: refunds (ACL) and cross-border disclosure (APP 8).
- **`tsconfig.node.json` includes `legal-documents.ts`** (build, Step 3) - the
  browser spec imports the documents so it checks every heading without a copy
  of them; the same pattern as the own-domain files.
- **Agreement is a statement above the button, not a checkbox** - the button is
  the act of agreeing; a required checkbox adds a field without adding
  consent. The owner may ask for the checkbox instead.

## Production needs

- The owner's Step 5, before signup opens to the public: every `[OWNER: ...]`
  placeholder in `app/features/legal/legal-documents.ts` filled (`grep -c "\[OWNER"`
  prints `0`), the text final, `updated` that day (F-428).

## Behaviour changes

- New capability `legal`: the terms of service and the privacy policy are at `/legal/terms` and `/legal/privacy` on the platform host, signed out or in, each with a Last updated date - Step 3
- Adds to `legal`: on a site's own host, `/legal/terms` and `/legal/privacy` redirect to the platform's, while a site page called `privacy` or `legal` is still the site's - Step 1
- Adds to `accounts`: the signup form says creating an account agrees to the terms of service and privacy policy, linking both, and the login page links both - Step 4

## Notes

- Fix for F-428 (open signup's policies half; the Resend half was done by the
  owner on 2026-10-13, `dev-notes/v1-deploy-prep-2026-10-13.md`).
- Semantic HTML rules in `coding-standards.md`: one `h1`, headings follow the
  outline, `time` with `datetime`, `article`, `ul`.
- Design: no mockup exists for a long-form platform page. It uses the signup
  layout's brand mark, the kit's type scale and `--size-measure`; Step 4
  updates `design.md`'s footer row to record that.
- The drafts must not promise what the code does not do. Anything uncertain
  becomes an `[OWNER: ...]` placeholder, not a guess.

## Findings

### 2026-10-13-legal-pages/F-437 [P2] closed - `/legal/` answers 500, and every site host redirects there
File: app/lib/content-security-policy.ts:21 (`startsWith("/legal/")`); app/routes.ts (`:slug`)

**Found:** 2026-10-13 by review (scope: current; autopilot build..review, independent reviewer)
**Why it matters:** `isPlatformPath("/legal/")` is true, so the platform host allows it; React Router drops the trailing slash and matches the public `:slug` route (`slug="legal"`), whose layout reads a site context the platform host never sets - "No value found for context", 500. `lena.habre.page/legal/` redirects to it, so a site page called `legal` visited with a trailing slash leaves the site. Reproduced on the built server (Host app.localhost:3000).
**Suggested fix:** require a segment after `/legal/` in `isPlatformPath`; unit cases for `/legal/` on both hosts; add `/legal/` to `e2e/legal.spec.ts`'s 404 test.
**Resolution:** `isPlatformPath` requires a segment after `/legal/` (content-security-policy.ts). Tests: content-security-policy.test.ts "/legal/ with nothing after it...", host-routing.test.ts "/legal/ is not found on the platform host...", and `/legal/` -> 404 in e2e/legal.spec.ts "an unknown document is Not Found". Red without the repair (unit: both fail; browser: Expected 404, Received 500), green with it (npm test 1238/0, legal.spec 10 passed). closed by build, 2026-10-13.

### 2026-10-13-legal-pages/F-438 [P2] closed - The privacy policy says drafts may go to Anthropic or OpenAI directly; the app never sends them there
File: app/features/legal/legal-documents.ts (AI drafting, processors); app/features/ai/providers.server.ts:35

**Found:** 2026-10-13 by review (scope: current; autopilot build..review, independent reviewer)
**Why it matters:** `pickRunAdapter` (`app/features/ai/providers.server.ts:35`) uses the fake provider or OpenRouter alone, never the fallback chain (D405). `legal-documents.ts` (AI drafting section and the processor list) states a disclosure the code does not make - against the spec's own rule. The spec and `legal-documents.test.ts` require both names, so the fix touches the test too.
**Suggested fix:** reword to "may in future also..." or name them only as listed, not current, processors; or the owner keeps it knowingly at Step 5.
**Owner, 2026-10-13:** stay on OpenRouter alone for now - so the fix is to drop the direct-to-Anthropic/OpenAI sentence and processor line (and the two names from the test), not to wire the fallbacks in.
**Resolution:** Owner chose OpenRouter only; the direct-provider sentence and the processor line are gone, and the spec's Step 2 done-when updated. Test: legal-documents.test.ts "the privacy policy names no AI provider the app never sends a description to" - red with the old text (Anthropic), green after. closed by build, 2026-10-13.

### 2026-10-13-legal-pages/F-441 [P3] closed - The policy pages link to /signup even when signup is off
File: app/features/legal/legal-page.tsx

**Found:** 2026-10-13 by review (scope: current; autopilot build..review, independent reviewer)
**Why it matters:** `legal-page.tsx` always shows "Create your website" -> `/signup`, a 404 under `SIGNUP_MODE=off` (the self-host default). Login already hides its signup link in that case.
**Suggested fix:** pass whether signup is open from the loader and hide the link, as `login.tsx` does.
**Resolution:** The loader returns `signupOpen` (as login does) and the page shows Create your website only when it is true. Test: e2e/legal.spec.ts "with signup off the policies do not link to signup (F-441)" on the host-split server - red (Expected 0, Received 1) without the repair, green with it. closed by build, 2026-10-13.

F-439 [P2] fixed stays in the index; F-440 [P3] fixed moved to the backlog; neither re-reviewed after the repair (owner shipped without a second review, 2026-10-13). F-428 stays deferred to `host`: its policies half is this fix, its placeholders are the owner's (`needs-you.md`).
