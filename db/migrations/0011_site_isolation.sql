-- Site isolation (item 15a, D151, D152): the contract half of 0010. Authorship
-- now goes through site_members, the temporary defaults and the columns that
-- moved to the membership are gone, and row-level security is on for the three
-- site-owned tables.
--
-- This migration carries real rows (it creates memberships and drops
-- users.role), and once users.role is gone it cannot be rolled back by moving
-- the release symlink, the same as 0009: the previous release reads that
-- column. Rehearse it on a restored production backup before the v1 deploy.
--
-- Reversible only by hand, and only while a single site exists (then follow 0010's
-- recipe for the rest):
--   alter table users add column role text check (role in ('admin', 'editor', 'author')),
--     add column deactivated_at timestamptz;
--   update users set role = m.role, deactivated_at = m.deactivated_at
--     from site_members m where m.user_id = users.id;
--   alter table users alter column role set not null;
--   drop policy site_isolation on entries; drop policy site_isolation on media;
--   drop policy site_isolation on site_settings;
--   alter table entries disable row level security;
--   alter table media disable row level security;
--   alter table site_settings disable row level security;
--   alter table site_settings add column id integer default 1;
--   update site_settings set id = 1;
--   alter table entries drop constraint entries_author_member_fkey,
--     add constraint entries_author_id_fkey foreign key (author_id) references users (id)
--       on delete restrict;
--   alter table media drop constraint media_uploaded_by_member_fkey,
--     add constraint media_uploaded_by_fkey foreign key (uploaded_by) references users (id)
--       on delete restrict;
-- The three site_id defaults (0010) are not restored: the old release never
-- named a site, so set them again from the oldest site's id if it is needed.
-- Not reversible: users created without a role after 0010 have none to restore.

-- Users made after 0010 but before the code that creates memberships (in any
-- environment) have a role and no membership. Give them one in site 1, the
-- oldest site, which is where every installation's users belonged until now.
insert into site_members (site_id, user_id, role, deactivated_at, created_at)
select (select id from sites order by created_at, id limit 1), id, role, deactivated_at, created_at
from users
where role is not null
  and not exists (select 1 from site_members where site_members.user_id = users.id);

-- Authorship must be a member of the entry's own site. Memberships are
-- deactivated, never deleted (D159), so restrict costs nothing and authorship
-- survives. An existing row is valid only if its author is a member of the same
-- site, which the 0010 backfill and the insert above made true.
alter table entries drop constraint entries_author_id_fkey;
alter table entries add constraint entries_author_member_fkey
  foreign key (site_id, author_id) references site_members (site_id, user_id)
  on delete restrict;
alter table media drop constraint media_uploaded_by_fkey;
alter table media add constraint media_uploaded_by_member_fkey
  foreign key (site_id, uploaded_by) references site_members (site_id, user_id)
  on delete restrict;

-- Every insert now names its site (inSite and the data modules), so nothing may
-- fall back to site 1 by accident.
alter table entries alter column site_id drop default;
alter table media alter column site_id drop default;
alter table site_settings alter column site_id drop default;

-- The role and deactivation moved to site_members in 0010.
alter table users drop column role;
alter table users drop column deactivated_at;

-- site_id has been the primary key since 0010; id was kept only so an
-- unconverted `where id = 1` still worked.
alter table site_settings drop column id;

-- Row-level security, enabled but not forced: the owner (migrations, backups,
-- the test helpers) bypasses it and sees every row. The app never connects as
-- the owner, which is the point of D152.
alter table entries enable row level security;
alter table media enable row level security;
alter table site_settings enable row level security;

-- One policy per table. app.site_id is set only by inSite, transaction-local, so
-- a pooled connection never carries a site into the next request. With no site
-- set, current_setting is null or empty, nullif makes it null, the comparison is
-- never true, and the app sees no rows and can write none. The same expression
-- checks writes, so a row cannot be moved into or inserted into another site.
create policy site_isolation on entries for all
  using (site_id = nullif(current_setting('app.site_id', true), '')::uuid)
  with check (site_id = nullif(current_setting('app.site_id', true), '')::uuid);
create policy site_isolation on media for all
  using (site_id = nullif(current_setting('app.site_id', true), '')::uuid)
  with check (site_id = nullif(current_setting('app.site_id', true), '')::uuid);
create policy site_isolation on site_settings for all
  using (site_id = nullif(current_setting('app.site_id', true), '')::uuid)
  with check (site_id = nullif(current_setting('app.site_id', true), '')::uuid);
