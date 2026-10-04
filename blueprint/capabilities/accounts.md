# Capability: accounts

- **accounts.1** - with signup on invite, a person with an unused invite code can create an account and a site, choosing its address *Since:* features/15b-signup
- **accounts.2** - an invite code works once *Since:* features/15b-signup
- **accounts.3** - a taken or reserved address is refused beside the field, a taken one with two free suggestions, and the form keeps what was typed *Since:* features/15b-signup
- **accounts.4** - with signup off, `/signup` is Not Found *Since:* features/15b-signup
- **accounts.5** - asking for a new link gives the same answer whether or not the address is waiting to be confirmed, and only the newest link works *Since:* features/15b-signup
- **accounts.6** - the emailed link confirms the address and signs the person in as the admin of their new, empty site, once and within 24 hours *Since:* features/15b-signup
- **accounts.7** - opening the emailed link changes nothing until the person presses Confirm my email *Since:* features/15b-signup
- **accounts.8** - with email configured, asking for a password reset link gives the same answer whether or not the email has an account, and only the newest link works *Since:* features/15c-password-reset
- **accounts.9** - the reset link sets a new password once and within an hour, signs the person in on that browser and signs them out everywhere else *Since:* features/15c-password-reset
- **accounts.10** - opening the reset link changes nothing until the person submits a new password *Since:* features/15c-password-reset
- **accounts.11** - with email not configured, `/forgot-password` and `/reset-password` are Not Found and the login page says to ask an admin *Since:* features/15c-password-reset
