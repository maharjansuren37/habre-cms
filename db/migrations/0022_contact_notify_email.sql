-- Where contact messages are emailed (item 19c): one optional address per
-- site. Null means every active admin of the site gets the email; a set
-- address replaces that list. The length check matches contact_submissions.email.
--
-- Additive: one nullable column; no existing row changes and no default is
-- backfilled. The previous release never reads it, so a release rollback by
-- symlink is safe.
--
-- Reversible by hand, losing the saved addresses:
--   alter table site_settings drop column contact_notify_email;

alter table site_settings
  add column contact_notify_email text
    constraint site_settings_contact_notify_email_check
      check (contact_notify_email is null or length(contact_notify_email) <= 254);
