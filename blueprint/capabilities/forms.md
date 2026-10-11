# Capability: forms

- **forms.1** - a visitor's `POST /_contact` from a site's own address stores a submission (name, email, message, the page) for that site alone and answers 303 back to the page with `contact=sent` *Since:* features/19a-receiving-a-message
- **forms.2** - a post from any other origin, from the platform host, or with no origin evidence is refused and stores nothing; `/_contact` is the only state-changing path a site host accepts *Since:* features/19a-receiving-a-message
- **forms.3** - a post with the hidden field filled is answered `sent` and stores nothing *Since:* features/19a-receiving-a-message
- **forms.4** - a post sent under 3 seconds after its form was issued, or with a missing, forged or day-old token, stores nothing and answers `again` *Since:* features/19a-receiving-a-message
- **forms.5** - more than 5 posts an hour from one address to one site are answered `busy` and stored nowhere *Since:* features/19a-receiving-a-message
- **forms.6** - an empty or over-long field, a malformed email, an entry that is not a published entry of this site, or a body over 16 KiB stores nothing (`invalid`, or 413 for the body) *Since:* features/19a-receiving-a-message
- **forms.7** - one site's submissions are unreadable by every other site and by the app with no site set *Since:* features/19a-receiving-a-message
