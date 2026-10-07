-- Logo colours (item 18a2): up to three colours counted from an image's
-- pixels when it is uploaded, most-used first. Settings offers them as brand
-- colour swatches; 18b preselects colours[0] at onboarding.
--
-- colours: '{}'  none counted (uploaded before 18a2, an animated GIF, or an
--                image with no strong colour);
--          else  one to three '#rrggbb', lowercase, no nulls, one dimension.
--                The joined string is matched for the shape, and its length
--                pins each element to 7 characters, so an empty element or
--                one holding a comma cannot pass as several (F-318).
--
-- Additive, no backfill: existing rows take '{}' and offer no swatches.
--
-- Reversible:
--   alter table media drop column colours;
--   delete from schema_migrations where filename = '0019_media_colours.sql';

alter table media
  add column colours text[] not null default '{}'
    check (
      cardinality(colours) <= 3
      and coalesce(array_ndims(colours), 1) = 1
      and array_position(colours, null) is null
      and length(array_to_string(colours, ',')) = greatest(8 * cardinality(colours) - 1, 0)
      and array_to_string(colours, ',') ~ '^(#[0-9a-f]{6}(,#[0-9a-f]{6}){0,2})?$'
    );
