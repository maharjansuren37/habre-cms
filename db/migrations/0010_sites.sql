-- Sites and memberships (item 15a, D151, D162): the expand half of expand then
-- contract. Every entry, image and setting now belongs to a site, and today's
-- installation becomes site 1 with its users as members. 0011 contracts: it adds
-- the keys through site_members, drops the temporary defaults and the moved
-- columns, and turns row-level security on.
--
-- This migration carries real rows (every user becomes a membership), so
-- rehearse it on a restored production backup before the v1 deploy.
--
-- Reversible while 0011 has not run, and no second site exists:
--   alter table users alter column role set not null;
--   drop table site_members;
--   alter table site_settings drop constraint site_settings_logo_media_id_fkey,
--     drop constraint site_settings_home_page_id_fkey, drop constraint site_settings_pkey;
--   alter table site_settings alter column id set default 1, alter column id set not null;
--   alter table site_settings add primary key (id), add check (id = 1),
--     add constraint site_settings_logo_media_id_fkey foreign key (logo_media_id)
--       references media (id) on delete set null,
--     add constraint site_settings_home_page_id_fkey foreign key (home_page_id)
--       references entries (id) on delete set null;
--   alter table entries drop constraint entries_site_id_type_slug_key,
--     drop constraint entries_site_id_id_key, drop column site_id;
--   alter table entries add constraint entries_type_slug_key unique (type, slug);
--   alter table media drop constraint media_site_id_id_key, drop column site_id;
--   alter table site_settings drop column site_id;
--   drop table sites;

create table sites (
  -- UUIDs, the convention for every table. Ids appear in URLs and R2 keys, where
  -- a counter would show how many sites exist. "Site 1" is a name, not the id.
  id uuid primary key default gen_random_uuid(),
  -- The address under the platform's sites domain (item 16). Lowercase DNS label.
  subdomain text not null unique
    check (subdomain ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'),
  -- A text check rather than an enum, like users.role.
  plan text not null default 'free' check (plan in ('free', 'paid')),
  -- Set by suspend-site (item 16, D158), for abuse.
  suspended_at timestamptz,
  created_at timestamptz not null default now(),
  -- Set by the application's update queries; no triggers.
  updated_at timestamptz not null default now()
);

create table site_members (
  site_id uuid not null references sites (id) on delete restrict,
  user_id uuid not null references users (id) on delete restrict,
  role text not null check (role in ('admin', 'editor', 'author')),
  -- Members are deactivated, never deleted: authorship stays intact.
  deactivated_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (site_id, user_id),
  -- v1: one site per user (D159), so "the user's membership" is a single row by
  -- construction. Dropped at Level 2.
  unique (user_id)
);

-- Today's installation is site 1, the oldest site. Nothing serves its subdomain
-- until item 16; the site stays on its own domain.
insert into sites (subdomain) values ('surenmaharjan');

insert into site_members (site_id, user_id, role, deactivated_at, created_at)
select (select id from sites order by created_at, id limit 1), id, role, deactivated_at, created_at
from users;

alter table entries add column site_id uuid references sites (id);
alter table media add column site_id uuid references sites (id);
alter table site_settings add column site_id uuid references sites (id);

update entries set site_id = (select id from sites order by created_at, id limit 1);
update media set site_id = (select id from sites order by created_at, id limit 1);
update site_settings set site_id = (select id from sites order by created_at, id limit 1);

alter table entries alter column site_id set not null;
alter table media alter column site_id set not null;
alter table site_settings alter column site_id set not null;

-- Temporary: site 1's id as each column's default, so code not yet converted to
-- name its site keeps inserting. A default cannot be a subquery, so it is set
-- here with the generated id. 0011 drops all three.
do $$
declare
  site_one uuid := (select id from sites order by created_at, id limit 1);
  t text;
begin
  foreach t in array array['entries', 'media', 'site_settings'] loop
    execute format('alter table %I alter column site_id set default %L', t, site_one);
  end loop;
end
$$;

-- Slugs are unique per site, not across the platform.
alter table entries drop constraint entries_type_slug_key;
alter table entries add unique (site_id, type, slug);
-- The target of composite foreign keys, so a reference cannot cross sites.
alter table entries add unique (site_id, id);
alter table media add unique (site_id, id);

-- site_id replaces the fixed id = 1 as the key. Site 1's row keeps id = 1, so an
-- unconverted `where id = 1` query still reaches only site 1; a new site's row
-- has id null. 0011 drops the column.
alter table site_settings drop constraint site_settings_id_check;
alter table site_settings drop constraint site_settings_pkey;
alter table site_settings add primary key (site_id);
alter table site_settings alter column id drop not null;
alter table site_settings alter column id drop default;

-- Re-point both references through the site. The column-list form of set null
-- (PostgreSQL 15+) clears only the reference, never site_id. The constraint names
-- are kept: settings.server.ts detects these violations by name.
alter table site_settings drop constraint site_settings_logo_media_id_fkey;
alter table site_settings drop constraint site_settings_home_page_id_fkey;
alter table site_settings add constraint site_settings_logo_media_id_fkey
  foreign key (site_id, logo_media_id) references media (site_id, id)
  on delete set null (logo_media_id);
alter table site_settings add constraint site_settings_home_page_id_fkey
  foreign key (site_id, home_page_id) references entries (site_id, id)
  on delete set null (home_page_id);

-- The role now lives on the membership. New users are created without it
-- (item 15a step 3); 0011 drops the column.
alter table users alter column role drop not null;
