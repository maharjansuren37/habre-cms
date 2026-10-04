-- Signup (item 15b): a fresh start, confirmed emails, email tokens and invites.
--
-- v1 begins with no accounts (owner, 2026-10-04), so this deletes every entry,
-- media row, membership and user, and empties every site's menu. The sites and
-- their settings rows stay. No user is backfilled as confirmed.
--
-- NOT reversible: it deletes data. The rollback is the pre-deploy backup (D163).
-- The R2 objects of the deleted media are left behind, unreferenced, which is
-- harmless. The schema half alone reverses with:
--   drop table invites; drop table email_tokens; alter table users drop column email_verified_at;
--
-- email_tokens and invites are platform tables: no site_id, no row-level
-- security. users.email_verified_at stays nullable with no default, so every
-- insert path says whether the person is confirmed.

-- A fresh start (owner, 2026-10-04): v1 begins with no accounts. In
-- dependency order; the settings' logo and home page clear themselves
-- through their foreign keys' "on delete set null".
delete from entries;
delete from media;
update site_settings set navigation = '[]'::jsonb;
delete from site_members;
delete from users;

alter table users add column email_verified_at timestamptz;

create table email_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  purpose text not null check (purpose in ('verify', 'reset')),
  token_hash text not null unique,      -- SHA-256 hex; the token is only in the email
  expires_at timestamptz not null,      -- verify 24 hours, reset 1 hour (15c)
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index on email_tokens (user_id);

create table invites (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,       -- SHA-256 hex of the normalised code
  note text not null default '' check (length(note) <= 200),
  created_at timestamptz not null default now(),
  used_at timestamptz,
  used_by_site_id uuid references sites (id) on delete set null
);
