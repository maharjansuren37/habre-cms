# Feature: Pay for Launch

**From build plan:** item 21b
**Type:** Feature
**Verified:** 2026-10-12, 716c7dc6fbec, 9 of 9 proven, 1 could not verify (a live Stripe Checkout, Portal and webhook round trip; needs-you.md); re-run after the repairs: plan, storage-limit, logo, billing-webhook, account-delete and content-security-policy specs, 72 passed, 1 failed (F-399, known open P2, not this item's)
**Reviewed:** 2026-10-12, 716c7dc6fbec, current, every lens, read whole except the SDK's own files and the tests' bodies - 0 blocking (independent pass; F-410 closed, F-412 and F-413 raised as P3)

## Goal

A Free site's admin can try Launch free for a trial period, then pay for it monthly or yearly (yearly costing less than twelve months) through Stripe's hosted pages, manage or cancel it in Stripe's Customer Portal, and the plan follows the payment.
Stripe's webhooks are the only thing that sets `sites.plan` from a payment
(D160); a cancel, or a failed payment once Stripe's retries give up, drops the site to Free limits and keeps its content (D150); while Stripe is still retrying, the site keeps Launch. Billing is off unless Stripe is configured, so a
self-hosted copy and the invite-only beta behave exactly as 21a left them.

## In scope

- The pinned `stripe` SDK behind one module, `app/features/billing/`.
- Migration `0025`: `stripe_events` (an event is processed once) and on
  `sites` `billing_event_at` (a stale, out-of-order event is ignored),
  `billing_interval` and `trial_ends_at`.
- Our own billing settings, all in configuration (the owner changes them
  without a code change, like Launch's limits in 21a): the two Stripe price
  ids and the trial length. The billing switch: `STRIPE_SECRET_KEY`,
  `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY` -
  all set is on, none is off, a partial set stops startup.
  `BILLING_TRIAL_DAYS` (default 14, `0` = no trial).
- A free trial of Launch, once per site, card required up front.
- Monthly and yearly intervals chosen on `/admin/plan`; the amounts shown
  are read from the two Stripe prices, so there is no second copy to drift.
- `/webhooks/stripe`: POST on the platform host, signature-checked, bounded
  body, each event once, one transaction with the plan change.
- `/admin/plan`: an Upgrade button (Checkout) for a Free site and a Manage
  billing button (Customer Portal) for a site with a customer, both admin
  only; a failed-payment banner; the paid-until date.
- Deleting an account that takes a site with a live subscription cancels the
  subscription first (the cleanup `deleteAccount`'s comment reserves for 21).

## Out of scope

- Own domains: **21c**. Nothing on the plan page offers one.
- Prices in more than one currency, coupons, tax collection (Stripe Tax), an in-app screen for editing these settings (they are environment variables; an operator UI needs a settings table and belongs to a later item), switching between monthly and yearly (the Customer Portal does it, if switched on there), invoices in the app: Stripe's hosted pages cover what is
  needed; anything more is a later item (`needs-you.md`: GST).
- Turning billing on in production: a deploy decision (D150, D163).
- A fake Stripe server for CI: the live Checkout redirect is a manual check.

## Design reference

`blueprint/context/design.md` has no billing screen. The page is 21a's, with
buttons and one banner from existing components; no new component. Add one
line to `design.md` afterwards if the banner differs from the existing ones.

## Build steps

- [x] **Step 1 - Migration `0025`** - `stripe_events` (`id text primary key`,
  Stripe's event id; `type text not null`; `received_at timestamptz not null
  default now()`; no `site_id`, no row-level security - platform table, D151)
  and on `sites`: `billing_event_at timestamptz`, `billing_interval text` (check `month` | `year`), `trial_ends_at timestamptz`, all nullable. Additive, so a symlink
  rollback is safe. `migrate` skill. *Done when:* `npm run db:migrate` applies
  it on the development database; `\d stripe_events` and `\d sites` show the shapes; the interval check refuses `week`; the app role can insert into `stripe_events` and update
  `sites.billing_event_at`; a second insert of the same id fails on the key.
- [x] **Step 2 - The billing switch** - `app/lib/billing-env.server.ts`
  (parsed like `email-env.server.ts`, blank counts as unset): the four variables plus `BILLING_TRIAL_DAYS` (whole number 0-90, default 14), a refinement that stops startup naming the missing one, and `env.BILLING` (`null` off, else `{ secretKey, webhookSecret, priceMonthly, priceYearly, trialDays }`). The two prices must differ. `.env.example` lists them; the key must start `sk_` or `rk_`, the secret `whsec_`, a price `price_`. Install `stripe` pinned exactly (D160).
  *Done when:* unit tests (`npm test`): none set is off; all set is on; a partial set is refused naming the unset variable; a malformed prefix names its variable and never prints the value; equal prices, a negative or fractional trial and `91` are refused; the trial defaults to 14 and `0` is accepted.
- [x] **Step 3 - Events become plan changes, as a pure module** -
  `app/features/billing/billing-events.ts`: `planChangeFor(event)` takes a
  Stripe event and returns `null` (ignored type) or `{ match, plan,
  billingStatus, paidUntil, customerId, subscriptionId, eventAt }`. Handled:
  `checkout.session.completed` (matched by `client_reference_id` = site id,
  mode subscription, paid), `customer.subscription.updated`,
  `customer.subscription.created`, `customer.subscription.deleted`. (Built against the installed types: `invoice.payment_failed` is not handled, because the `past_due` status arrives on `subscription.updated` and the invoice's subscription id moved between API versions; `created` is added because it carries a trial's first state. A trial's checkout has `payment_status` `no_payment_required`, accepted with `paid`; the period end is on the subscription's items.) Rules: plan is `paid` while the subscription is `active`, `trialing` or `past_due` (the grace period is Stripe's own retry window, set in its dashboard; the app keeps no timer); `unpaid`, `canceled` and `incomplete_expired` give `free`; `billing_status` records `active`, `past_due` or `canceled` as Stripe says; a subscription set to cancel at
  period end stays `paid` until its `deleted` event; `paidUntil` is `current_period_end`; `billingInterval` is the item's price interval; `trialEndsAt` is the subscription's `trial_end` while its status is `trialing`, else null. *Done when:* unit tests over fixture events: each
  handled type and status maps as above (`past_due` stays `paid` with `billing_status` `past_due`; `unpaid` is `free`); an unhandled type is `null`; a
  `checkout.session.completed` without `client_reference_id` is `null`.
- [x] **Step 4 - Applying an event, once** -
  `app/features/billing/apply-event.server.ts`: one transaction that inserts
  the event id into `stripe_events` (`on conflict do nothing`; no row back is
  a duplicate, answered 200 and applied nowhere), looks the site up (by
  `billing_subscription_id`, then `billing_customer_id`, for a checkout by
  site id), skips a change whose `eventAt` is not after the site's
  `billing_event_at`, and writes plan, status, ids, `paid_until` and
  `billing_event_at`. An unknown site records the event and logs it. A
  failure rolls the transaction back, so Stripe's retry applies it. A plan
  change is logged with `logSecurityEvent` (site, old, new, event id).
  *Done when:* `e2e/billing-webhook.spec.ts` (needs the development
  database), calling the handler through the route with signed events: the
  same event twice changes the site once and returns 200 both times; an older
  event after a newer one changes nothing; a checkout sets `paid` and the
  ids; a `deleted` event sets `free` and leaves entries and media untouched; a `trialing` subscription is `paid` with `trial_ends_at` set, and the `active` event that follows clears it.
- [x] **Step 5 - `/webhooks/stripe`** - resource route, POST only, on the
  platform host (`app/routes.ts`; `isPlatformPath` and `classifyHost` allow
  it, a site host answers 404 as for any platform path). Billing off: 404.
  Reads at most 512 KB (refused 413 past it, while streaming - F-389),
  verifies `Stripe-Signature` with the SDK (`constructEventAsync`, its
  default five-minute tolerance), 400 on a bad or missing signature with a
  `logSecurityEvent` (no body in the log), then Step 4. No session, no
  cookie, no origin check: `same-origin.ts` exempts exactly `POST
  /webhooks/stripe` and nothing under or beside it, because the signature is
  the authentication. *Done when:* unit tests: `same-origin` allows exactly
  that path and method with no Origin and refuses `/webhooks/stripe/x`, GET
  elsewhere unchanged, and refuses it on a site host; `host-routing` allows
  it on the platform host and 404s it on a site host. Playwright: a
  correctly signed event is 200; a wrong secret, a missing header and a
  tampered body are 400 and change nothing; 513 KB is 413; with billing off
  (the host-split server) it is 404.
- [x] **Step 6 - Checkout and the Portal** -
  `app/features/billing/billing.server.ts`: `createBilling(stripe, config)`
  returning `startCheckout({ siteId, email, customerId, interval, trialEligible })`; `prices()` returns both prices' amount, currency and interval from Stripe, cached in the process for ten minutes and
  `openPortal({ customerId })`. Checkout: `mode: "subscription"`, one line item - `STRIPE_PRICE_MONTHLY` or `STRIPE_PRICE_YEARLY` as `interval` chooses (anything else refused) - and, when `BILLING_TRIAL_DAYS` is above 0 and the site has never had a subscription (`billing_subscription_id` and `billing_customer_id` null), `subscription_data.trial_period_days`, `client_reference_id` the site id, the existing
  customer when there is one, else `customer_email`; success URL
  `/admin/plan?checkout=done`, cancel URL `/admin/plan`, both built from
  `PLATFORM_URL`. Portal: return URL `/admin/plan`. The plan page's action
  (`intent` = `upgrade` | `manage`, admin only, origin-checked as every admin
  POST) redirects 303 to the returned URL. A site already `paid` cannot start
  Checkout; `manage` without a customer is refused. A Stripe error shows
  "Payment is unavailable right now. Try again in a minute." and logs the
  error's type, never its body. The plan is **not** set here or on the
  success URL. *Done when:* unit tests with a fake client: the session
  carries the site id, price and both URLs; an existing customer is reused;
  a paid site is refused; the monthly and yearly choices use their own price ids; the trial length is sent only when eligible and above 0; a site that has had a subscription gets none; an unknown interval is refused; `prices()` is fetched once inside ten minutes; a thrown client error becomes the refusal text and no URL.
- [x] **Step 7 - The plan page** - `/admin/plan` shows, billing on: for a Free site two choices in one `fieldset` / `legend` - "Monthly, <amount>" and "Yearly, <amount>", with "Save <n>% a year" computed from the two prices when yearly is lower - and a button "Start your <n>-day free trial" for a site eligible for one, else "Upgrade"; Manage billing (has a customer); "Your last payment didn't go through. Update your card in Manage billing to keep Launch." for `past_due` (still Launch limits), and "Your subscription ended after a failed payment. You're on Free limits." for a site that is Free with `billing_status` `canceled` after a failure; "Launch until <date>." for a cancelling
  subscription; "Payment received. Your plan updates in a moment." after `?checkout=done` while the site is still Free; "Free trial until <date>" while `trial_ends_at` is set, with the interval ("then billed yearly"). If the prices cannot be read (bounded to 3 s, no retry, remembered for a minute), the choices show without amounts - Checkout shows the real price - rather than being replaced. Billing off: the 21a page,
  unchanged ("Paid plans are coming soon."). Buttons are `button` in a
  `form`; one `h1`; the banner is a status line, not a toast. *Done when:*
  Playwright (`e2e/plan.spec.ts`): billing on shows both intervals and the trial button for a new Free site and "Upgrade" for one that had a subscription; a trialing site shows its end date; Manage billing for a site with a customer; a `past_due` site keeps Launch limits and shows the
  banner; billing off shows no button; an author gets 404; role-based
  locators only. Not run in CI against Stripe: the buttons are asserted
  present, not pressed.
- [x] **Step 8 - Deleting an account cancels the subscription** - in
  `deleteAccount`'s site-taking path, before the transaction deletes rows, a
  site with `billing_subscription_id` and billing on has its subscription
  cancelled immediately; Stripe unreachable refuses the deletion ("We
  couldn't cancel your subscription. Try again in a minute.") and deletes
  nothing. A canceled or absent subscription proceeds. *Done when:* unit test
  with the fake client: cancel is called once with the subscription id and
  deletion proceeds; a thrown error leaves the result `refused`; billing off
  never calls the client. Playwright (`e2e/account-delete.spec.ts`)
  existing cases still pass.
- [x] **Step 9 - Docs and production notes** - `AGENTS.md` stack and environments rows (the
  `STRIPE_*` variables, the webhook, `stripe` 22.6.2, what CI does with the fake
  key); `.env.example`; `playwright.config.ts` gives the primary test server
  fake `STRIPE_*` values and the other two none. The capability files are
  merged from *Behaviour changes* by `ship`, not edited by hand. *Done when:*
  `npm run verify` passes, and `npm run test:e2e` passes the new specs.

- [x] **Repair F-407 - one live subscription per site** - `canStartCheckout(facts)` in
  `billing-view.ts`: only a Free site with no subscription id, or whose status is
  `canceled`, may start Checkout; `startCheckout` refuses anything else
  (`has_subscription`); the plan page offers Manage billing, not Upgrade, to a
  Free site with a live subscription, and its notice for `unpaid` sends them
  there. Stripe's `paused` is recorded as `past_due`, not `canceled`, so it
  counts as live. *Done when:* unit tests: a Free site with a subscription id
  and status `past_due` or `active` is refused, one with `canceled` or no id is
  not, a paid site is refused; `paused` maps to Free with `past_due`; the
  Playwright plan spec shows Manage billing and no Upgrade for Free + `past_due`.
  The test is seen failing with the repair reverted.
- [x] **Repair F-408 - the limit messages follow the billing switch** -
  `upgradeHint(plan, billingOn)` in `app/features/plans/`: billing off keeps
  "Paid plans ... are coming soon."; billing on and Free says "An admin can
  upgrade on the Plan page for ..."; billing on and Launch says nothing. The
  storage refusal and the AI allowance refusal use it. *Done when:* unit tests
  for the three cases of the helper and of both messages; `storage-limit.spec.ts`
  and `logo.spec.ts` assert the billing-on wording for a Free site and none of
  the hint for a Launch site. Seen failing with the repair reverted.
- [x] **Repair F-410 - the admin policy lets a form go to Stripe** -
  `contentSecurityPolicy` takes `billing: boolean`; with it on, the admin area's
  `form-action` also allows `https://checkout.stripe.com` and
  `https://billing.stripe.com`, and no other area or directive changes.
  *Done when:* unit tests: off is unchanged for every area; on adds exactly those
  two origins to the admin `form-action` and nothing to public or preview;
  `e2e/content-security-policy.spec.ts` reads the header on `/admin/plan` from
  the billing-on server and from the billing-off server. Seen failing with the
  repair reverted.

## Files and areas

`db/migrations/0025_stripe_events.sql`; `app/lib/billing-env.server.ts`,
`env.server.ts`, `same-origin.ts`, `host-routing.ts`,
`content-security-policy.ts` (`isPlatformPath`); `app/features/billing/`
(new); `app/features/plans/plan-page.tsx`, `plan-view.ts`;
`app/features/account/account.server.ts`; `app/routes.ts`; `package.json`,
`package-lock.json`; `.env.example`; `playwright.config.ts`;
`e2e/billing-webhook.spec.ts` (new), `e2e/plan.spec.ts`.

## Data and contracts

- `stripe_events(id text pk, type text not null, received_at timestamptz not
  null default now())`. **Load-bearing:** the id is Stripe's event id; rows
  are never deleted by the app.
- `sites.billing_interval` (`month` | `year`) and `sites.trial_ends_at` are display only; limits never read them.
- `sites.billing_event_at timestamptz`. **Load-bearing for 21c and any later
  billing event:** every writer of the billing columns sets it from the
  event's `created`, and ignores an event not after it.
- `sites.plan` is written by exactly two things: `set-plan` and Step 4. 21c
  reads the plan only through `limitsFor` / `site.plan`.
- `planChangeFor(event): PlanChange | null` and the webhook's responses
  (200 applied or duplicate or ignored, 400 signature, 404 off, 413 size,
  500 retry) are the contract with Stripe's dashboard.
- Metadata Stripe holds about a site: its id (`client_reference_id`) and the
  customer's email. Nothing else leaves the app.

## Testing

- Unit (`npm test`, no database; `verify` and CI run it): billing env,
  `planChangeFor`, `same-origin`, `host-routing`, `createBilling` with a fake
  client, the deletion cancel with a fake client. Signatures are made with
  the SDK's `webhooks.generateTestHeaderString`, offline.
- Browser (`npm run test:e2e`, needs the development database; CI runs it
  with the fake `STRIPE_*` values and no network to Stripe):
  `e2e/billing-webhook.spec.ts`, `e2e/plan.spec.ts`.
- Not proven by any test, added to `needs-you.md`: a real test-mode Checkout
  and Portal round trip, and the webhook endpoint delivering from Stripe.

## Decisions

- **A subscription set to cancel at period end is recorded as `billing_status`
  `canceled` while the plan stays `paid`** (beats a new column for one flag:
  the page only needs to say "Launch until <date>", and `deleted` makes it
  Free). Free with `canceled` reads "Your Launch subscription has ended"; Free
  with `past_due` (Stripe's `unpaid`) reads "ended after a failed payment".
  A cancel and a payment-failure cancel are indistinguishable beyond that.
- **The plan page reads billing facts in its own query** (`findBillingFacts`),
  not through `findMemberSite`, which every admin request runs.

- **A subscription carries the site id in its metadata** (set at Checkout,
  Step 6), and `planChangeFor` matches on subscription, then customer, then
  that id (beats matching only what a checkout stored: `subscription.created`
  can arrive before the checkout event, and an event with no site would be
  dropped). Added in Step 3's module while building Step 4.
- **An event older than the site's last applied one is ignored, an equal
  second is applied** (Stripe's `created` has one-second resolution; beats
  `<=`, which would drop the second of two events in the same second).

- **`past_due` keeps Launch; Stripe's retries are the grace period** (beats dropping to Free on the first failed charge: an expired card mid-month would strip a paying customer's features, and beats an app-side timer, which would be a second clock beside Stripe's. D150's "a failed payment drops to Free limits" is read as the payment finally failing). Content is untouched either way. The owner sets the retry schedule and what happens when it runs out (cancel or mark unpaid) in Stripe; `unpaid` and `canceled` drop the site to Free, and paying restores Launch on the next `subscription.updated`.
- **Each event is applied against the site's `billing_event_at`** (beats
  trusting arrival order: Stripe does not guarantee it, and a late `updated`
  after `deleted` would resurrect a plan).
- **Webhooks have no origin check and are authenticated by signature alone**
  (beats a Stripe IP allowlist, which drifts); the path is matched exactly.
- **The success URL never sets the plan** (D160): it only says the payment
  is being processed.
- **Deleting an account refuses when Stripe cannot cancel** (beats deleting
  anyway, which leaves a customer charged for a site that is gone).
- **Checkout only; no in-app card form.** The trial is Stripe's own `trial_period_days`, card required (beats a card-less trial: it invites throwaway sites and AI spend, D150), once per site (beats once per card, which the app cannot see).
- **Prices live in Stripe and are read, not copied** (beats amounts in our configuration: a second number that drifts). Our configuration holds which prices and the trial length. A ten-minute cache keeps the read cheap. This amends *Rate limits* ("Stripe calls happen only on a user's click"): an admin's plan page view may also read prices.
- **Settings are environment variables, not a database table** (beats an operator screen: one operator, matches Launch's limits in 21a; a settings UI is a later item).

## Production needs

- Migration `0025_stripe_events.sql` (additive; runs with the v1 deploy's
  other migrations).
- New variables in `/etc/habre-cms/production.env`, all three or none:
  `STRIPE_SECRET_KEY` (a restricted key limited to Checkout, Customers, Subscriptions, Prices (read) and Billing Portal), `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY`. Left unset, billing stays off (D150). Optional: `BILLING_TRIAL_DAYS` (14 unless set, `0` for none).
- In the Stripe dashboard (owner): a Launch product with two recurring prices, monthly and yearly (yearly below twelve months - the app shows the saving but does not enforce it);
  a webhook endpoint `https://app.<platform domain>/webhooks/stripe` for
  `checkout.session.completed`, `customer.subscription.created`,
  `customer.subscription.updated`, `customer.subscription.deleted`; the Customer
  Portal configured (cancel, update card); Billing's retry schedule and its
  final action when retries run out set to cancel the subscription.
- `stripe` is copied with `node_modules` like every package; no native code.
- Caddy already proxies the platform host; no change expected - check the
  route is not blocked by `deploy/caddy/habre-cms.caddy`.

## Behaviour changes

- Adds to `plans`: a site with a live Stripe subscription cannot start a second Checkout - Step 6
- Adds to `plans`: with billing on, a Free site's admin can pay for Launch monthly or yearly through Stripe Checkout from `/admin/plan` - Step 7
- Adds to `plans`: a site that has never had a subscription is offered a free trial of the configured length at Checkout - Step 6
- Adds to `plans`: a trialing subscription has Launch limits until its trial ends - Step 4
- Adds to `plans`: a site's plan changes from a payment only through a Stripe webhook whose signature checks - Step 5
- Adds to `plans`: each Stripe event is applied once, and an older event never undoes a newer one - Step 4
- Adds to `plans`: a site keeps Launch while Stripe retries a failed payment, and returns to Free limits, keeping its pages, posts and images, when the subscription is cancelled or unpaid - Step 4
- Adds to `plans`: an admin with a subscription can manage or cancel it in Stripe's Customer Portal from `/admin/plan` - Step 7
- Adds to `plans`: with Stripe not configured, `/admin/plan` offers no way to pay - Step 7
- Adds to `plans`: with Stripe not configured, `/webhooks/stripe` is Not Found - Step 5
- Adds to `accounts`: deleting an account that takes a site cancels its subscription first, and is refused when Stripe cannot cancel it - Step 8

## Notes

- `stripe` 23.0.0 is the latest on npm today; the version is pinned at
  install. Read its installed docs and types, not memory (the SDK is newer
  than training), and check the version's age before pinning.
- Follow `coding-standards.md`: `*.server.ts` for Stripe calls, `#app/`
  imports with extensions, Zod only where a boundary needs it (the SDK types
  the event; the plan change is checked in `planChangeFor`).
- Stripe calls happen only on a user's click or a signed webhook (plan
  section 6, *Rate limits*): nothing on a public request.
- Plan section 6 and `AGENTS.md` already describe `stripe_events` with `id`,
  `type`, `received_at`; Step 1 matches it exactly.

## Findings

### 21b-pay-for-launch/F-407 [P2] closed - A Free site that still has a live Stripe subscription is offered Checkout and can end up with two
File: app/features/plans/plan-page.tsx (offer); app/features/billing/billing.server.ts (`startCheckout`)

# F-407 - A Free site that still has a live Stripe subscription is offered Checkout and can end up with two

**Found:** 2026-10-12 by review (scope: current; lens: security, quality)
**Why it matters:** `unpaid` and `paused` map to Free, but Stripe may keep the subscription. The page then offers Upgrade; a second Checkout for the same customer makes a second subscription, `coalesce` overwrites the stored id, and only that one is cancelled on account deletion (OWASP A06:2025, insecure design: money).
**Suggested fix:** Offer Upgrade only when the site has no subscription id or its status is `canceled`; for `past_due` on Free send them to Manage billing. Refuse the same case in `startCheckout`.
**Resolution:** Repaired 2026-10-12 by build. `canStartCheckout` (billing-view.ts) allows Checkout only for a Free site with no subscription id or status `canceled`; `startCheckout` refuses a live one (`has_subscription`); the plan page offers Manage billing instead; `paused` is now recorded `past_due`. Tests: `billing.test.ts` (unit) and `plan.spec.ts` "a Free site Stripe still holds a subscription for ..." (e2e). Seen failing with `canStartCheckout` reverted to "any Free site" (1 unit, 1 e2e failure) and passing with it back. closed by build.

### 21b-pay-for-launch/F-408 [P2] closed - The storage and AI refusals say "Paid plans are coming soon" even when billing is on
File: app/features/media/store-upload.server.ts:28; app/features/onboarding/start-refusals.ts:26

# F-408 - The storage and AI refusals say "Paid plans are coming soon" even when billing is on

**Found:** 2026-10-12 by review (scope: current; lens: quality)
**Why it matters:** with Stripe configured `/admin/plan` sells Launch, but the two refusals a site hits at its limit still say plans are coming soon, which sends the person nowhere (D150: a limit refuses the action and points to the plan).
**Suggested fix:** pick the closing sentence from `env.BILLING`: with billing on, "See Plan to upgrade." (a link where the refusal renders a banner); keep "coming soon" when off. Update `storage-limit.spec.ts` and the refusal unit tests.
**Resolution:** Repaired 2026-10-12 by build. `upgradeHint(plan, billingOn)` (plans/upgrade-hint.ts) drives the storage refusal (`storageRefusalMessage`) and the AI allowance refusal: billing off keeps "coming soon", billing on and Free says an admin can upgrade on the Plan page, billing on and Launch says nothing. Tests: `upgrade-hint.test.ts`, `storage-limit.spec.ts` (Free and a new Launch-at-limit case), `logo.spec.ts`. Seen failing with the billing-off branch forced (1 unit, 3 e2e failures) and passing with it back. closed by build.

### 21b-pay-for-launch/F-410 [P2] closed - The Upgrade and Manage forms redirect to Stripe under a `form-action 'self'` policy that no test has exercised
File: app/lib/content-security-policy.ts:70; app/features/plans/plan-page.tsx:action

# F-410 - The Upgrade and Manage forms redirect to Stripe under a `form-action 'self'` policy that no test has exercised

**Found:** 2026-10-12 by review (scope: current; lens: security, tests)
**Why it matters:** `content-security-policy.ts:70` sets `form-action 'self'` on every area, and Chrome applies it to a form POST's redirect targets. With JavaScript the redirect is followed by React Router, but a press before hydration (or with scripts off) posts natively and the 303 to `checkout.stripe.com` or `billing.stripe.com` is blocked. No test presses the buttons (no Stripe in CI), so nothing has seen either path work.
**Suggested fix:** allow `https://checkout.stripe.com https://billing.stripe.com` in the admin area's `form-action` only when billing is on, with a unit test in `content-security-policy.test.ts`; then do the manual test-mode round trip in `needs-you.md` with and without JavaScript.
**Resolution:** Repaired 2026-10-12 by build, in part. `contentSecurityPolicy({ billing })` adds `https://checkout.stripe.com https://billing.stripe.com` to the admin area's `form-action` only; `entry.server.tsx` passes `env.BILLING !== null`. Tests: `content-security-policy.test.ts` (2) and `content-security-policy.spec.ts` "names Stripe's hosted pages only when billing is on", seen failing with the entry.server line removed. Still unproven: a real Checkout/Portal redirect with and without JavaScript - the manual test-mode round trip in `needs-you.md`. Left `fixed` for `review`, not `closed`.

Closed 2026-10-12 by review (scope: current): re-read `content-security-policy.ts` (only `form-action`, only `area === "admin"`, only with `billing`), `entry.server.tsx`, both unit tests and the e2e spec; nothing else changed and nothing new introduced. The live redirect stays open in `needs-you.md`.
