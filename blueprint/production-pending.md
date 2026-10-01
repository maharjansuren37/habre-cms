# Production pending

## 12a-hero-section

- [ ] No new environment variables, no migration, no external service.
- [ ] **Rollback boundary:** once a page is saved with a hero, the items 10-11 release cannot render it (it reads `data.children` on every section) - symlink rollback is unsafe after such a save. Deploy 12a-12c together, or accept that boundary knowingly.
