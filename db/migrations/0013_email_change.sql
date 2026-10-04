-- Changing your email (item 15e1): a third token purpose that carries the new
-- address until the link sent to it is confirmed.
--
-- Additive: no row changes. Existing tokens are 'verify' or 'reset' with no
-- new_email, which both new checks accept.
--
-- Reversible; only pending email changes are lost (their links stop working):
--   delete from email_tokens where purpose = 'email_change';
--   alter table email_tokens drop constraint email_tokens_new_email_purpose_check,
--     drop constraint email_tokens_new_email_lower_check, drop column new_email,
--     drop constraint email_tokens_purpose_check,
--     add constraint email_tokens_purpose_check check (purpose in ('verify', 'reset'));
--
-- Any later purpose widens email_tokens_purpose_check the same way, and says
-- whether it carries new_email.

alter table email_tokens
  drop constraint email_tokens_purpose_check,
  add constraint email_tokens_purpose_check
    check (purpose in ('verify', 'reset', 'email_change')),
  add column new_email text,
  -- Stored as the account's email is: lowercased (users_email_key compares it).
  add constraint email_tokens_new_email_lower_check check (new_email = lower(new_email)),
  -- Present exactly when the token is an email change.
  add constraint email_tokens_new_email_purpose_check
    check ((purpose = 'email_change') = (new_email is not null));
