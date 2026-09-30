-- Pages can now be stored as blocks_format 'v3' (item 10, D114): a list of
-- sections instead of a flat list of blocks. Posts and pages not yet re-saved
-- stay 'v2', so nothing is rewritten here - only the check that refused 'v3'.
-- The default stays 'v2'; the application names the format on every write.
--
-- Not reversible by symlink: once a page is saved as 'v3', code from before this
-- migration refuses to read it (assertKnownFormat).
alter table entries drop constraint entries_blocks_format_check;
alter table entries add constraint entries_blocks_format_check check (blocks_format in ('v2', 'v3'));
