# Capability: limits

- **limits.1** - an upload whose stored sizes would take a site's media past its plan's storage limit (Free `STORAGE_LIMIT_MB`, 500 MB unless set; Launch `LAUNCH_STORAGE_LIMIT_MB`, 10 GB unless set) is refused with a message naming the limit, and no media row is added *Since:* features/15d-storage-cap · *Changed:* features/21a-plans-and-limits
- **limits.2** - the Media screen shows the site's storage used out of its limit with a meter, and says when it is full *Since:* features/15d-storage-cap
- **limits.3** - deleting an image lowers the storage the Media screen shows as used *Since:* features/15d-storage-cap
- **limits.4** - with `STORAGE_LIMIT_MB=none` no upload is refused for storage and Media shows only the space used *Since:* features/15d-storage-cap
- **limits.5** - an invalid `STORAGE_LIMIT_MB` stops the app at startup with a message naming the variable *Since:* features/15d-storage-cap
- **limits.6** - `LAUNCH_*` values below Free's stop the app at startup *Since:* features/21a-plans-and-limits
