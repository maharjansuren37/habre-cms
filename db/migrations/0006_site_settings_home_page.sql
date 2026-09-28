-- What `/` shows (item 9). Null means no home page chosen - `/` shows a
-- welcome placeholder (spec D-12) - and is the only encoding of the default,
-- so no backfill is needed. Deleting the chosen page falls back to the
-- placeholder for free.
-- The foreign key cannot tell a page from a post; the settings action checks
-- the id against the page list before saving (spec D-6).
alter table site_settings
  add column home_page_id uuid references entries (id) on delete set null;
