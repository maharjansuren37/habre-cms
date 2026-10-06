-- Deleted accounts (item 15e2): a member can delete their own account, and
-- their posts, pages and images stay on the site.
--
-- entries.author_id and media.uploaded_by become nullable. Null means "Deleted
-- account". Code that reads an author or uploader must handle null, and an
-- ownership filter (author_id = actor.id) never matches it. The two composite
-- foreign keys to site_members now clear only the reference when the membership
-- is deleted: the column-list form of set null (PostgreSQL 15+), as 0010 did for
-- site_settings, never touches site_id. The constraint names are kept.
--
-- Additive: it relaxes two columns and changes two delete rules; no row changes.
-- Admins still deactivate members (D159); only deleting your own account
-- deletes a membership.
--
-- Reversible only while no entry or media row has a null author or uploader
-- (a deleted author's rows would have to be given to someone first):
--   alter table entries alter column author_id set not null,
--     drop constraint entries_author_member_fkey,
--     add constraint entries_author_member_fkey
--       foreign key (site_id, author_id) references site_members (site_id, user_id)
--       on delete restrict;
--   alter table media alter column uploaded_by set not null,
--     drop constraint media_uploaded_by_member_fkey,
--     add constraint media_uploaded_by_member_fkey
--       foreign key (site_id, uploaded_by) references site_members (site_id, user_id)
--       on delete restrict;
-- Once a deleted author exists, a release cannot be rolled back by symlink.

alter table entries
  alter column author_id drop not null,
  drop constraint entries_author_member_fkey,
  add constraint entries_author_member_fkey
    foreign key (site_id, author_id) references site_members (site_id, user_id)
    on delete set null (author_id);

alter table media
  alter column uploaded_by drop not null,
  drop constraint media_uploaded_by_member_fkey,
  add constraint media_uploaded_by_member_fkey
    foreign key (site_id, uploaded_by) references site_members (site_id, user_id)
    on delete set null (uploaded_by);
