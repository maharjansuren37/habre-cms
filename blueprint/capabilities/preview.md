# Capability: preview

- **preview.1** - an admin's `/admin/preview` shows the site's home page in the site's look with a menu of its pages, drafts included, marked as a preview nobody else can see, and not indexed *Since:* features/18b4b-preview-publish
- **preview.2** - editors and authors get Not Found at `/admin/preview`, and a signed-out visitor is sent to sign in *Since:* features/18b4b-preview-publish
- **preview.3** - every page of the site, draft or published, has a preview at `/admin/preview/<its address>`, and another site's page is Not Found there *Since:* features/18b4b-preview-publish
- **preview.4** - in the preview, links to the site's pages stay in the preview and other links to the site go to the live site *Since:* features/18b4b-preview-publish
- **preview.5** - the preview bar is marked as English whatever the site's language *Since:* fixes/v1-journey-polish
