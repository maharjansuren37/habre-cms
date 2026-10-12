# Fix: terms of service and privacy policy pages (F-428)

**Type:** Fix
**Verified:** not yet
**Reviewed:** not yet

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
  OpenRouter, Anthropic, OpenAI, Resend, Cloudflare, Stripe and Oracle Cloud.

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

- [ ] **Step 4 - agreeing at signup, and the login links** - the sentence above
  Create my website on `/signup`, and "Terms of service · Privacy policy" under
  the login form. *Done when:* the links show with signup in any mode and with email on or off; `e2e/legal.spec.ts` follows each link from
  `/signup` and from `/admin/login` to the right page by its `h1`, and the
  existing signup and login specs still pass (`npm run test:e2e`, locally with
  the development database; CI's `e2e` job runs the same spec).

- [ ] **Step 5 - the owner's edit** (owner, not an agent) - the owner reads both
  drafts, changes what they will not stand behind, and replaces every
  `[OWNER: ...]` placeholder; ideally someone qualified reads them. *Done when:*
  `grep -c "\[OWNER" app/features/legal/legal-documents.ts` prints `0`, and the
  owner says the text is final; `updated` is that day.

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
  which passes it to the model provider it routes to, and on fallback to
  Anthropic or OpenAI directly; AI output is a draft the member reviews.
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
  provider it routes to), Anthropic, OpenAI, Stripe.
- Retention and deletion: an account is deleted at once by its owner from Your
  account; the last admin deleting takes the site, its content, images,
  messages and AI runs; a deleted member's posts stay on the site with no
  name. Deleted data stays in backups up to 7 days on the server and
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

- None in the environment. The owner's Step 5 must be done before the v1
  deploy (F-428); `preflight` checks the placeholders are gone.

## Behaviour changes

- New capability `legal`: the terms of service and the privacy policy are at
  `/legal/terms` and `/legal/privacy` on the platform host, signed out or in,
  each with a Last updated date - Step 3
- Adds to `legal`: on a site's own host, `/legal/terms` and `/legal/privacy`
  redirect to the platform's, while a site page called `privacy` or `legal` is
  still the site's - Step 1
- Adds to `accounts`: the signup form says creating an account agrees to the
  terms of service and privacy policy, linking both, and the login page links
  both - Step 4

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
