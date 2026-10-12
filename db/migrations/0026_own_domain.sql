-- Own domains, adding and verifying (item 21c, D153): the columns a site's
-- admin flow needs on `site_domains`, and the app role's column-level grants.
-- 0015 left the app role able to read and delete rows only, "item 21 grants
-- insert when it needs it"; this is that grant, and no wider.
--
-- verification_token is the value the owner publishes in a DNS TXT record to
-- prove they control the domain; last_checked_at is when the app last looked.
-- Both are null on site 1's seeded row, which is verified already.
--
-- Additive: two nullable columns, and grants. The previous release never reads
-- them, so a release rollback by symlink is safe.
--
-- Grants are by column on purpose: the app may insert a row naming only the
-- domain, its site and the token (never `verified_at`, so a row cannot be born
-- verified), and may update only the verification columns (never `site_id` or
-- `domain`, so a claim cannot be moved or renamed). db/roles.sql repeats them
-- after its blanket grant so a re-run neither widens nor drops them (F-270).
--
-- Reversible by hand, losing whatever 21c has written:
--   revoke insert (domain, site_id, verification_token) on site_domains from habre_cms_app;
--   revoke update (verified_at, verification_token, last_checked_at) on site_domains from habre_cms_app;
--   alter table site_domains drop column last_checked_at;
--   alter table site_domains drop column verification_token;

alter table site_domains
  add column verification_token text,
  add column last_checked_at timestamptz;

grant insert (domain, site_id, verification_token) on site_domains to habre_cms_app;
grant update (verified_at, verification_token, last_checked_at) on site_domains to habre_cms_app;
