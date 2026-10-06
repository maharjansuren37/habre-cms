# Capability: limits

- **limits.1** - an upload whose stored sizes would take a site's media past its storage limit (`STORAGE_LIMIT_MB`, 500 MB unless set) is refused with a message naming the limit, and no media row is added *Since:* features/15d-storage-cap · *Changed:* features/17b-optimised-images
- **limits.2** - the Media screen shows the site's storage used out of its limit with a meter, and says when it is full *Since:* features/15d-storage-cap
- **limits.3** - deleting an image lowers the storage the Media screen shows as used *Since:* features/15d-storage-cap
- **limits.4** - with `STORAGE_LIMIT_MB=none` no upload is refused for storage and Media shows only the space used *Since:* features/15d-storage-cap
- **limits.5** - an invalid `STORAGE_LIMIT_MB` stops the app at startup with a message naming the variable *Since:* features/15d-storage-cap
