-- What `/` shows (item 9). Null means the latest posts - the only encoding of
-- the default, so every existing install keeps today's behaviour with no
-- backfill. Deleting the chosen page falls back to the list for free.
-- The foreign key cannot tell a page from a post; the settings action checks
-- the id against the page list before saving (spec D-6).
alter table site_settings
  add column home_page_id uuid references entries (id) on delete set null;
