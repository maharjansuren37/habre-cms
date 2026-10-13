# Production pending

What production still lacks after the v1 deploy (`d340758`, 2026-10-13). Every
other line for items 14a1-21c and the two fixes was met by that deploy
(`dev-notes/status.md`).

## features/15b-signup

- [ ] Signup is open (D504) while the terms and privacy policy still hold 14 `[OWNER: ...]` placeholders: fill them - `grep -c "\[OWNER" app/features/legal/legal-documents.ts` prints `0` - and deploy (F-428, accepted risk).

## features/15e2-delete-your-account

- [ ] The R2 backup bucket's lifecycle rule (prefix `habre_cms-`, delete after 30 days), which the privacy policy states - the owner adds it in Cloudflare and confirms (F-428).

## features/17-seo-basics

- [ ] Check a real share preview and the sitemap - once `SEARCH_INDEXING` is back on (`needs-you.md`).

## features/18b2-fallbacks

- [ ] Before listing a direct provider in `AI_PROVIDERS`: the live runs owed by `needs-you.md` (D392), then each provider's key, model and price in `production.env`. Today `AI_PROVIDERS` is unset (OpenRouter alone); the `ANTHROPIC_*` lines in `production.env` are unread.

## features/21b-pay-for-launch

- [ ] Billing is off (D150). To turn it on: all four `STRIPE_*` in `production.env`; in Stripe a Launch product with monthly and yearly prices, the webhook `https://app.<platform domain>/webhooks/stripe`, the Customer Portal, Billing's retry schedule ending in cancel; and the test-mode round trip in `needs-you.md`.

## features/21c-own-domain

- [ ] A real own-domain round trip (`needs-you.md`): the `ask` option and the own-domains import are installed and `caddy validate` passed on 2026-10-13, but no own domain has been issued a certificate yet.

## fixes/2026-10-12-interim-domain-noindex

- [ ] The `sectigo.com` CAA records (`needs-you.md`, F-435), so Caddy's ZeroSSL fallback can issue.
- [ ] Confirm the Cloudflare token is limited to the `habre.page` zone, filtered to the server's IP, with an expiry - the deploy saw only that it works (the wildcard was issued).
