-- Optimised images (item 17b, D174): the sizes an upload is stored at.
--
-- variant_widths, nullable:
--   null  uploaded before 17b, not yet optimised (one object at storage_key);
--   '{}'  stored as uploaded (an animated GIF, one object at storage_key);
--   else  the WebP widths, ascending; storage_key is the widest, and
--         social.jpg sits beside it.
--
-- byte_size becomes the sum of every object a row owns (up to five), so its
-- check widens from 10 MB to 50 MB. The 10 MB cap on the upload itself stays
-- in the app.
--
-- Additive: existing rows keep variant_widths null and stay valid.
--
-- Reversible; the down refuses (the check fails) if any row now exceeds 10 MB,
-- and drops the sizes column, leaving the extra objects in R2 unreferenced:
--   alter table media drop column variant_widths,
--     drop constraint media_byte_size_check,
--     add constraint media_byte_size_check check (byte_size > 0 and byte_size <= 10485760);
--   delete from schema_migrations where filename = '0017_media_variants.sql';

alter table media
  add column variant_widths integer[],
  drop constraint media_byte_size_check,
  add constraint media_byte_size_check check (byte_size > 0 and byte_size <= 52428800);
