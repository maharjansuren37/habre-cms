-- Uploaded images (item 5a). Files live in R2; this row is the metadata and the
-- one place alt text is stored (spec's Decisions: captured once, at upload,
-- reused wherever the image is placed - no per-block alt field).
create table media (
  id uuid primary key default gen_random_uuid(),
  -- The R2 object key - generated (storage-key.ts), never derived from the
  -- client's filename, so it needs no sanitizing and cannot collide with one.
  storage_key text not null unique,
  -- The client's original name, kept for display only.
  filename text not null check (length(filename) between 1 and 255),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/gif')),
  -- Matches the 10 MB upload cap (quality-bar.md); the app checks this too, but
  -- a row the app itself could not have produced is worth refusing at the
  -- database as well.
  byte_size integer not null check (byte_size > 0 and byte_size <= 10485760),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  alt_text text not null check (length(alt_text) between 1 and 250),
  -- Authorship survives deactivation, matching entries.author_id.
  uploaded_by uuid not null references users (id) on delete restrict,
  created_at timestamptz not null default now()
);

-- Authors delete only their own uploads; every such check filters on this.
create index media_uploaded_by_idx on media (uploaded_by);
