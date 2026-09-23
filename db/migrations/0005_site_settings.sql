-- One row for the whole site (item 7a). Singleton via a fixed id, matching
-- the plan's shape: title, logo, and a reserved navigation column item 7b
-- populates and reads - locked here now so this table needs one migration,
-- not two.
create table site_settings (
  id smallint primary key default 1 check (id = 1),
  site_title text not null check (length(site_title) between 1 and 200),
  -- A real foreign key, unlike a block's image reference (JSON, no FK,
  -- degrades silently at render per D61) - this is a plain column, so it can
  -- just stay valid for free instead of needing that same handling.
  logo_media_id uuid references media (id) on delete set null,
  -- {label, pageId | url}[] - item 7b's shape. Unread and unwritten until then.
  navigation jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

insert into site_settings (id, site_title) values (1, 'Habre CMS');
