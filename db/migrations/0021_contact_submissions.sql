-- Contact submissions (item 19a, D157): one row per message a visitor sends
-- through a site's contact form. It records the site, the page the form was on,
-- what the visitor wrote, and when it was read or notified (both empty until
-- 19c). A message is a visitor's personal data, so only its own site reads it.
--
-- Additive: a new table and an index; no existing row changes.
-- Row-level security is the same `site_isolation` policy as 0011 and 0020, so
-- the app role sees no message without a site set.
--
-- `site_id` restricts deletion like every site-owned table; deleteAccount
-- removes a taken site's messages explicitly. `entry_id` is set null when the
-- page is deleted, so a message outlives its page.
--
-- Reversible by hand, losing the messages:
--   drop table contact_submissions;
-- The previous release never reads it, so a release rollback by symlink is safe.

create table contact_submissions (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites (id) on delete restrict,
  entry_id uuid references entries (id) on delete set null,
  name text not null
    constraint contact_submissions_name_check check (char_length(name) between 1 and 100),
  email text not null
    constraint contact_submissions_email_check check (char_length(email) between 1 and 254),
  message text not null
    constraint contact_submissions_message_check check (char_length(message) between 1 and 5000),
  created_at timestamptz not null default now(),
  notified_at timestamptz,
  read_at timestamptz
);

create index contact_submissions_site_created_idx on contact_submissions (site_id, created_at);

alter table contact_submissions enable row level security;
create policy site_isolation on contact_submissions for all
  using (site_id = nullif(current_setting('app.site_id', true), '')::uuid)
  with check (site_id = nullif(current_setting('app.site_id', true), '')::uuid);

-- roles.sql's default privileges grant select, insert, update and delete on
-- every new table to the app role; the grant is repeated so this migration does
-- not depend on them.
grant select, insert, update, delete on contact_submissions to habre_cms_app;
