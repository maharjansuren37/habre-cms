# Capability: seo

- **seo.1** - every public page carries a canonical link to its own path on the site's main address, `/` for the home page *Since:* features/17-seo-basics
- **seo.2** - the platform host's `/robots.txt` disallows everything; a site's allows everything and names its sitemap on the main address *Since:* features/17-seo-basics
- **seo.3** - a site's `/sitemap.xml` lists its published pages and posts at the main address, `/` only when a published home page is set and never that page's own slug, and no draft *Since:* features/17-seo-basics
- **seo.4** - the "This site is being set up" placeholder carries `noindex` *Since:* features/17-seo-basics
- **seo.5** - a site's public pages and its 404 carry the site's language on `<html lang>`; the admin stays `en` *Since:* features/17-seo-basics
- **seo.6** - a public page's title, description, Open Graph and Twitter tags come from its search title, description and image, else its title, the site description on `/` and `/posts` only, and no image *Since:* features/17-seo-basics
