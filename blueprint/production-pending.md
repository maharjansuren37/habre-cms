# Production pending

## 12a-hero-section

- [ ] No new environment variables, no migration, no external service.
- [ ] **Rollback boundary:** once a page is saved with a hero, the items 10-11 release cannot render it (it reads `data.children` on every section) - symlink rollback is unsafe after such a save. Deploy 12a-12c together, or accept that boundary knowingly.

## 12b-cta-section

- [ ] No new environment variables, no migration, no external service.
- [ ] **Rollback boundary, as 12a:** once a page is saved with a hero or call to action, code from before 12a cannot render it. Deploy 12a-12c together.

## 12c-image-text-section

- [ ] No new environment variables, no migration, no external service. Images are served from the existing `R2_PUBLIC_URL`, already allowed by the content security policy.
- [ ] **Rollback boundary, as 12a-12b:** once a page is saved with a hero, call to action or image and text section, code from before 12a cannot render it. 12c is the last piece: deploy 12a-12c together.
