-- Every entry is a v4 document from here on (item 14a1, D169): Editor.js and its
-- v2 / v3 formats are removed, and nothing stored in them is kept - the owner
-- chose a rebuild over a conversion (2026-10-02; the content is test data).
--
-- DESTRUCTIVE AND NOT REVERSIBLE. Every post and page is deleted, and the menu
-- is emptied. There is no down migration: the rows are gone, and no release
-- before item 14a1 can read the database afterwards (the check below refuses
-- the 'v2' it would write), so a rollback by symlink is impossible.
--
-- The chosen home page clears itself: site_settings.home_page_id references
-- entries `on delete set null` (0006). The menu's page links are JSON with no
-- foreign key (0005), so they are reset here rather than left pointing nowhere.
delete from entries;

update site_settings set navigation = '[]'::jsonb, updated_at = now();

alter table entries drop constraint entries_blocks_format_check;
alter table entries add constraint entries_blocks_format_check check (blocks_format = 'v4');
alter table entries alter column blocks_format set default 'v4';
