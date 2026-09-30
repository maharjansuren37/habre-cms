# Production pending

## 10-sections-on-pages

- [ ] Apply migration `db/migrations/0007_blocks_v3.sql` (relaxes the `blocks_format` check to `v2`/`v3`) before the release that saves a page as `v3`.
- [ ] **Not symlink-rollbackable:** once one page is saved as `v3`, older code throws on it and the check change cannot be undone by flipping `current`. Rolling back needs a database restore or converting `v3` pages to `v2` by hand.
- [ ] No new environment variables, services or accounts.
