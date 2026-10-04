# Capability: sites

- **sites.1** - an admin of one site gets Not Found for another site's post, page, image or member opened by id, and sees none of its rows in any list *Since:* features/15a-sites-and-memberships
- **sites.2** - with no site set, the database returns none of `entries`, `media` or `site_settings` to the app, and refuses a write into another site *Since:* features/15a-sites-and-memberships
- **sites.3** - two sites can each have a page at the same address *Since:* features/15a-sites-and-memberships
- **sites.4** - a person can sign in only while they hold an active membership, and their role is the membership's *Since:* features/15a-sites-and-memberships
- **sites.5** - a new upload is stored under `sites/<site id>/` *Since:* features/15a-sites-and-memberships
- **sites.6** - the public site shows the oldest site's content (until item 16) *Since:* features/15a-sites-and-memberships
