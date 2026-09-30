# Production pending

## 10-sections-on-pages

- [ ] Apply migration `db/migrations/0007_blocks_v3.sql` (relaxes the `blocks_format` check to `v2`/`v3`) before the release that saves a page as `v3`.
- [ ] **Not symlink-rollbackable:** once one page is saved as `v3`, older code throws on it and the check change cannot be undone by flipping `current`. Rolling back needs a database restore or converting `v3` pages to `v2` by hand.
- [ ] No new environment variables, services or accounts.

## 11-columns

- [ ] **Deploy with item 10**, never on its own: item 10's migration `0007_blocks_v3.sql` is still pending above.
- [ ] **Not symlink-rollbackable to item 10:** once a page is saved with a 2- or 3-column section, item 10's code (`layout` must be `"1"`) cannot read it. Rolling back needs converting those pages by hand or a database restore.
- [ ] No new migration, environment variables, services or accounts.
