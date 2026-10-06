-- Own domains (item 16a, D153): a host that is not under the sites domain is
-- looked up here, and only a verified row serves its site. Items 17 (the main
-- address) and 21 (adding and verifying a domain) build on this table.
--
-- A platform table like sites: no row-level security, so app code scopes it by
-- site_id itself. The app role may read rows and delete them (deleteAccount
-- removes a site's domains before the site); item 21 grants insert when it
-- needs it.
--
-- Additive, plus one seed row: site 1 (subdomain surenmaharjan, named by 0010)
-- keeps answering on surenmaharjan.fyi. On an install without that site the
-- seed inserts nothing.
--
-- Reversible:
--   drop table site_domains;

create table site_domains (
  -- Lowercase hostname, no port, no trailing dot: the request's host is
  -- lowercased and matched against this exactly. At least two DNS labels.
  domain text primary key
    check (
      length(domain) <= 253
      and domain ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'
    ),
  -- Restrict, as 15e2 set for every site table: deleteAccount removes the rows
  -- explicitly before the site.
  site_id uuid not null references sites (id) on delete restrict,
  -- Null means not served: the host answers 404 until the domain is verified.
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create index site_domains_site_id_idx on site_domains (site_id);

-- roles.sql's default privileges grant all four on every new table.
revoke insert, update on site_domains from habre_cms_app;

insert into site_domains (domain, site_id, verified_at)
select 'surenmaharjan.fyi', id, now() from sites where subdomain = 'surenmaharjan';
