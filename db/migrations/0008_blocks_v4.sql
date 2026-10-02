-- Entries can now be stored as blocks_format 'v4' (item 14a1, D169): one
-- ProseMirror document per post or page (app/features/blocks/document.ts).
-- Nothing is rewritten here - v2 and v3 rows stay as they are and still render;
-- only the check that refused 'v4' changes. The default stays 'v2'.
--
-- Reversible while no row is 'v4':
--   alter table entries drop constraint entries_blocks_format_check;
--   alter table entries add constraint entries_blocks_format_check
--     check (blocks_format in ('v2', 'v3'));
-- Once a row is saved as 'v4', code from before this migration refuses to read
-- it (assertKnownFormat), so a rollback by symlink needs those rows gone first.
alter table entries drop constraint entries_blocks_format_check;
alter table entries add constraint entries_blocks_format_check
  check (blocks_format in ('v2', 'v3', 'v4'));
