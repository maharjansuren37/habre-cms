-- Stripe events and the billing display columns (item 21b, D160, D175).
-- `stripe_events` is how a webhook is applied once: the event id is the key,
-- and a second delivery of the same id inserts nothing. `sites` gains the
-- time of the last applied event (a stale, out-of-order event is ignored) and
-- two display-only columns; limits never read them.
--
-- Both are platform tables, so there is no row-level security to extend and
-- no `site_id` (D151). The app role gets its grants from the default
-- privileges set in db/roles.sql.
--
-- Additive: the previous release never reads any of it, so a release rollback
-- by symlink is safe.
--
-- Reversible by hand, losing whatever 21b has written:
--   alter table sites drop column trial_ends_at;
--   alter table sites drop column billing_interval;
--   alter table sites drop column billing_event_at;
--   drop table stripe_events;

create table stripe_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now()
);

alter table sites
  add column billing_event_at timestamptz,
  add column billing_interval text
    constraint sites_billing_interval_check
      check (billing_interval in ('month', 'year')),
  add column trial_ends_at timestamptz;
