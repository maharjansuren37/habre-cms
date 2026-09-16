-- Posts and pages in one table (D5): the two differ by `type`, not by shape, so
-- pages (item 6) need no schema change. Blocks are structured data, never HTML.
create table entries (
  id uuid primary key default gen_random_uuid(),
  -- A text check rather than an enum, matching users.role.
  type text not null check (type in ('post', 'page')),
  title text not null check (length(title) between 1 and 200),
  -- Derived from the title, unique within a type: two posts cannot share a URL,
  -- but a post and a page may (they are served from different paths).
  slug text not null check (slug <> ''),
  -- An ordered list of {id, type, data}. jsonb, so later items can query inside
  -- it - finding every entry using a deleted image, for instance.
  blocks jsonb not null default '[]'::jsonb,
  -- Versions the block format itself. 'v1' is plain text; item 2b introduces
  -- 'v2' with structured inline runs and migrates existing rows.
  blocks_format text not null default 'v1',
  status text not null check (status in ('draft', 'published')) default 'draft',
  -- Set when first published (item 4), and kept when unpublished, so a
  -- republished entry keeps its original date.
  published_at timestamptz,
  -- Authorship survives deactivation, so this is restricted, never cascading.
  author_id uuid not null references users (id) on delete restrict,
  -- Incremented on every save. A save carrying a stale version is refused
  -- rather than overwriting someone else's work.
  version integer not null default 1,
  created_at timestamptz not null default now(),
  -- Set by the application's update queries; no triggers.
  updated_at timestamptz not null default now(),
  unique (type, slug)
);

-- Authors list and open only their own entries; every such query filters on this.
create index entries_author_id_idx on entries (author_id);
