-- Admin users. The full shape from the plan, so users and roles (item 8) need no
-- schema change. Users are deactivated, never deleted: authorship stays intact.
create table users (
  -- UUIDs, the convention for every table: ids appear in admin URLs.
  id uuid primary key default gen_random_uuid(),
  -- Stored lowercased, so plain unique means case-insensitive unique.
  email text not null unique check (email = lower(email) and email <> ''),
  name text not null check (length(name) between 1 and 100),
  password_hash text not null,
  -- A text check rather than an enum, so a role change needs no enum migration.
  role text not null check (role in ('admin', 'editor', 'author')),
  -- Bumped to revoke every session for the user (logout, role change, reset).
  token_version integer not null default 0,
  deactivated_at timestamptz,
  created_at timestamptz not null default now(),
  -- Set by the application's update queries; no triggers.
  updated_at timestamptz not null default now()
);
