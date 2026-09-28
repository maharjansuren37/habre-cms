# Production pending

## 09-choose-the-home-page

- [ ] Migration `0006_site_settings_home_page.sql` applied to production (additive and nullable, so rolling back by symlink still works after it)
- [ ] After deploy, `/` shows the "This site is being set up" placeholder instead of the post list until the owner chooses a home page in Settings (D107; `needs-you.md`)
