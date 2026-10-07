# Capability: media

- **media.1** - an uploaded image other than an animated GIF is stored as WebP at 480, 960, 1600 and 2400 px wide, never wider than the original, plus a social JPEG, and the uploaded file itself is not kept *Since:* features/17b-optimised-images
- **media.2** - a stored image carries no camera details, location included *Since:* features/17b-optimised-images
- **media.3** - an animated GIF is stored as uploaded *Since:* features/17b-optimised-images
- **media.4** - every stored image object is served with a one-year immutable cache header *Since:* features/17b-optimised-images
- **media.5** - deleting an image removes every stored size *Since:* features/17b-optimised-images
- **media.6** - an image that cannot be read, or is over 40 megapixels, is refused with a message and no media row is added *Since:* features/17b-optimised-images
- **media.7** - `npm run optimise-media` gives every image uploaded before item 17b its sizes, and a second run changes nothing *Since:* features/17b-optimised-images
- **media.8** - an SVG sent to the server is refused, from Media and from Settings, and no media row is added *Since:* features/18a2-your-logo
