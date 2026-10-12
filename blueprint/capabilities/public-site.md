# Capability: public-site

- **public-site.1** - public pages carry no entry ids and no share image id or key, and no settings beyond the title, logo, menu, language, site description, main address, brand colour and style *Since:* fixes/tidy-findings-backlog · *Changed:* features/18a1-brand-colour-and-style
- **public-site.2** - public pages, the public 404 and the error page are light whatever the device's setting unless the site's dark mode is on, then they follow the device (D168, amended by item 20) *Since:* features/13b-the-new-look · *Changed:* features/20-simple-and-pro
- **public-site.3** - pages and posts render as sections of columns, which stack when their container is narrower than 40rem *Since:* features/14a1-the-document
- **public-site.4** - a page's main heading is its only `h1`, else its title is; a post's title is always its `h1` *Since:* features/14a1-the-document
- **public-site.5** - an empty paragraph or heading renders no element, and neither does a section in which nothing renders (only empty text, spaces, empty buttons or deleted images) *Since:* features/14a1-the-document · *Changed:* features/14a2-image-button-line-and-space
- **public-site.6** - an image renders as an `img` named once by its alt text, with a `srcset` of its sizes and `sizes` from its section's column count; the first on a page loads at once with high priority, the rest lazily *Since:* features/14a2-image-button-line-and-space · *Changed:* features/17b-optimised-images
- **public-site.7** - a button renders as a link; a button without text or a destination, and an image whose file was deleted, render nothing *Since:* features/14a2-image-button-line-and-space
- **public-site.8** - a hero renders as a two-column section with its columns centred vertically, a call to action on a band background *Since:* features/14c1-ready-made-sections
- **public-site.9** - a page never downloads an image more than one size above its displayed width, at a 390 px phone and a 1280 px desktop *Since:* features/17b-optimised-images
