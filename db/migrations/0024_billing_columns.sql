-- Billing columns on sites (item 21a, D150, D160, D175): where item 21b's Stripe
-- webhooks record a site's customer, subscription and paid-until date. Nothing
-- reads or writes them in 21a; the plan itself stays in `sites.plan`.
-- `sites` is a platform table, so there is no row-level security to extend.
--
-- Additive: four nullable columns, so every existing site reads null. The
-- previous release never reads them, so a release rollback by symlink is safe.
-- `billing_status` is a text check rather than an enum, like `plan`.
--
-- Reversible by hand, losing whatever 21b has written:
--   alter table sites drop column paid_until;
--   alter table sites drop column billing_status;
--   alter table sites drop column billing_subscription_id;
--   alter table sites drop column billing_customer_id;

alter table sites
  add column billing_customer_id text,
  add column billing_subscription_id text,
  add column billing_status text
    constraint sites_billing_status_check
      check (billing_status in ('active', 'past_due', 'canceled')),
  add column paid_until timestamptz;
