-- Brand colour and style (item 18a1, D167, D171): the two inputs a site's
-- look is derived from. Only the inputs are stored; shades are derived on
-- each render.
--
-- brand_color:  ''  no colour, the neutral ink look;
--               else exactly '#rrggbb', lowercase. The app parses to this
--               shape before saving and again before rendering (CSS
--               injection, D171); this check is the middle guard.
-- style_preset: the font pair and corners, 'modern' matching today's look.
--
-- Additive: existing rows take the defaults and render as before.
--
-- Reversible:
--   alter table site_settings drop column brand_color, drop column style_preset;
--   delete from schema_migrations where filename = '0018_brand.sql';

alter table site_settings
  add column brand_color text not null default ''
    check (brand_color = '' or brand_color ~ '^#[0-9a-f]{6}$'),
  add column style_preset text not null default 'modern'
    check (style_preset in ('classic', 'modern', 'friendly'));
