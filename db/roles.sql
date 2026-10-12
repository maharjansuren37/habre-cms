-- The app's database role (D152). Run as the PostgreSQL superuser, connected to
-- the app database, with the password given as a psql variable:
--
--   psql -v ON_ERROR_STOP=1 -d habre_cms -v app_password=... -f db/roles.sql
--
-- Why two roles: `habre_cms` owns the tables and runs migrations. A table
-- owner bypasses row-level security, so the web app connects as
-- `habre_cms_app`, which owns nothing and is subject to it. Why here and not in
-- a migration: the owner cannot create roles, and the password must not live
-- in the repository.
--
-- Safe to run again: the role is created only when absent, and GRANTs that are
-- already in place change nothing. It never grants CREATE, so the app role
-- cannot make tables (PostgreSQL 16: schema public belongs to the owner).

select format('create role habre_cms_app login password %L', :'app_password')
where not exists (select 1 from pg_roles where rolname = 'habre_cms_app')
\gexec

select format('grant connect on database %I to habre_cms_app', current_database())
\gexec

grant usage on schema public to habre_cms_app;
grant select, insert, update, delete on all tables in schema public to habre_cms_app;
grant usage, select on all sequences in schema public to habre_cms_app;

-- Tables and sequences made by later migrations (run as the owner) get the
-- same grants without another run of this script.
alter default privileges for role habre_cms in schema public
  grant select, insert, update, delete on tables to habre_cms_app;
alter default privileges for role habre_cms in schema public
  grant usage, select on sequences to habre_cms_app;

-- Narrower grants a migration set, put back after the blanket grant above so a
-- re-run (setup-server.sh refreshes grants) does not widen them (F-270).
-- site_domains (0015, 0026): the app reads and deletes; it may insert only a
-- domain, its site and a verification token (never verified_at) and update only
-- the verification columns (never site_id or domain). The column grants exist
-- only once 0026 has added verification_token, and this script can run first.
do $$
begin
  if to_regclass('public.site_domains') is not null then
    revoke insert, update on site_domains from habre_cms_app;
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'site_domains'
        and column_name = 'verification_token'
    ) then
      grant insert (domain, site_id, verification_token) on site_domains to habre_cms_app;
      grant update (verified_at, verification_token, last_checked_at) on site_domains to habre_cms_app;
    end if;
  end if;
end
$$;
