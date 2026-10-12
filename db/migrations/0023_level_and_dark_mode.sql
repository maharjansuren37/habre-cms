-- The editing level and dark mode (item 20, D166, D168, D172): two per-site
-- choices on the site's own settings row, so row-level security already covers
-- them. `level` is Simple or Pro; `dark_mode` lets the public pages follow the
-- visitor's device and applies at every level (D168, amended by item 20).
--
-- Additive: two columns with defaults, so every existing site reads as Simple
-- and light, which is how it looks today. The previous release never reads
-- them, so a release rollback by symlink is safe.
--
-- Reversible by hand, losing the saved choices:
--   alter table site_settings drop column dark_mode;
--   alter table site_settings drop column level;

alter table site_settings
  add column level text not null default 'simple'
    constraint site_settings_level_check check (level in ('simple', 'pro')),
  add column dark_mode boolean not null default false;
