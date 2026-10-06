-- SEO basics (item 17, D173): what search engines and social sites read. An
-- entry gets its own title, description and share image; the site gets a
-- description and a language. An empty string means "not set" and the app
-- falls back (item 17, Step 7); the language list itself is the app's.
--
-- Additive, with defaults, so every existing row reads ''/''/null and ''/'en'.
-- The share image is the logo's pattern (0010): a composite key through
-- (site_id, id), so another site's image cannot be referenced, and deleting
-- the image clears only the reference. No index on the new foreign key, as
-- 0010 added none for the logo's: the lookup runs only when a media row is
-- deleted, which is rare and bounded by the per-site storage cap.
--
-- Reversible (dropping the columns drops their constraints):
--   alter table entries drop column seo_title, drop column seo_description,
--     drop column social_image_media_id;
--   alter table site_settings drop column site_description, drop column language;

alter table entries
  add column seo_title text not null default ''
    constraint entries_seo_title_check check (length(seo_title) <= 200),
  add column seo_description text not null default ''
    constraint entries_seo_description_check check (length(seo_description) <= 300),
  add column social_image_media_id uuid,
  add constraint entries_social_image_media_id_fkey
    foreign key (site_id, social_image_media_id) references media (site_id, id)
    on delete set null (social_image_media_id);

alter table site_settings
  add column site_description text not null default ''
    constraint site_settings_site_description_check check (length(site_description) <= 300),
  add column language text not null default 'en'
    constraint site_settings_language_check check (language ~ '^[a-z]{2,3}(-[A-Z]{2})?$');
