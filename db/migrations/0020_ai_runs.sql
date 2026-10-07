-- AI runs (item 18b1, D154, D155, D164): one row per "describe your site"
-- generation. The run records who asked, the provider's answer once validated
-- (`result`, the proposal), what it used and what it cost. A site's AI use this
-- month is the sum of `credits` over its runs, never a counter.
--
-- Credits are what the provider billed: a succeeded run and a failed run that
-- reported a cost both carry them; only a run still `running` has none (F-330).
--
-- Additive: a new table, an index and a function; no existing row changes.
-- Row-level security is the same `site_isolation` policy as 0011, so the app
-- role sees no run without a site set. That is also why interrupted runs are
-- failed by a security definer function: at startup no site is set.
--
-- `site_id` restricts deletion like every site-owned table; deleteAccount
-- removes a taken site's runs explicitly. `user_id` is set null when the person's
-- account is deleted, so a run outlives its author.
--
-- Reversible by hand, losing the runs (and so the month's credit use):
--   drop function fail_interrupted_ai_runs();
--   drop table ai_runs;
-- The previous release never reads it, so a release rollback by symlink is safe.

create table ai_runs (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites (id) on delete restrict,
  user_id uuid references users (id) on delete set null,
  kind text not null
    constraint ai_runs_kind_check check (kind in ('website', 'blog', 'business', 'portfolio')),
  description text not null,
  status text not null
    constraint ai_runs_status_check check (status in ('running', 'succeeded', 'failed', 'applied')),
  result jsonb,
  error text
    constraint ai_runs_error_check check (
      error in ('unavailable', 'broken', 'refused', 'invalid', 'timeout', 'interrupted')
    ),
  provider text,
  model text,
  input_tokens integer,
  cached_input_tokens integer,
  cache_write_tokens integer,
  output_tokens integer,
  -- The provider's reported cost in US dollars (or, for a direct provider,
  -- worked out from tokens). Null until the run finishes.
  cost_usd numeric(12, 6),
  credits integer not null default 0
    constraint ai_runs_credits_check check (
      credits >= 0 and (status <> 'running' or credits = 0)
    ),
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create index ai_runs_site_created_idx on ai_runs (site_id, created_at);

alter table ai_runs enable row level security;
create policy site_isolation on ai_runs for all
  using (site_id = nullif(current_setting('app.site_id', true), '')::uuid)
  with check (site_id = nullif(current_setting('app.site_id', true), '')::uuid);

-- roles.sql's default privileges grant select, insert, update and delete on
-- every new table to the app role; the grant is repeated so this migration does
-- not depend on them.
grant select, insert, update, delete on ai_runs to habre_cms_app;

-- Run by the app once at startup, for every site: a run still `running` was cut
-- off by a restart and will never finish. Security definer runs as the owner,
-- which bypasses row-level security. The search path is fixed so a schema the
-- caller controls cannot stand in for `ai_runs`.
create function fail_interrupted_ai_runs() returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  failed integer;
begin
  update ai_runs
  set status = 'failed', error = 'interrupted', finished_at = now()
  where status = 'running';
  get diagnostics failed = row_count;
  return failed;
end
$$;

revoke all on function fail_interrupted_ai_runs() from public;
grant execute on function fail_interrupted_ai_runs() to habre_cms_app;
