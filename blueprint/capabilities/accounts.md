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
- **accounts.12** - anyone signed in can change their name on Your account, and the shell shows the new name at once *Since:* features/15e1-your-account
- **accounts.13** - changing your password needs the current one, keeps you signed in on this browser and signs you out everywhere else *Since:* features/15e1-your-account
- **accounts.14** - a wrong current password on Your account counts toward the same lock as a failed sign-in *Since:* features/15e1-your-account
- **accounts.15** - with email off, a new email takes effect at once after the current password, and the old one no longer signs in *Since:* features/15e1-your-account
- **accounts.16** - a new email that is already yours or another account's is refused beside the field *Since:* features/15e1-your-account
- **accounts.17** - with email on, asking for a new email changes nothing until the link sent to that address is confirmed, and only the newest link works *Since:* features/15e1-your-account
- **accounts.18** - confirming a new email changes it once and within 24 hours, tells the old address, and stops reset links sent before it *Since:* features/15e1-your-account
- **accounts.19** - anyone signed in who is not their site's last active admin can delete their account with their current password; they are signed out everywhere and cannot sign in again *Since:* features/15e2-delete-your-account
- **accounts.20** - a deleted member's posts, pages and images stay on the site, shown in the admin as by "Deleted account" and publicly with no author name *Since:* features/15e2-delete-your-account
- **accounts.21** - a wrong current password when deleting counts toward the same lock as a failed sign-in *Since:* features/15e2-delete-your-account
- **accounts.22** - the last active admin's deletion, after typing the site's address, deletes the site, its content, images and settings, and every member's account, and frees its address *Since:* features/15e2-delete-your-account
- **accounts.24** - a deletion is refused, deleting nothing, when who is the last active admin changed after the confirm screen loaded *Since:* features/15e2-delete-your-account
- **accounts.25** - with email on, every other member of a deleted site is emailed that it was deleted *Since:* features/15e2-delete-your-account
- **accounts.26** - the last active admin of any site can delete their account, and the site's domains go with it *Since:* features/16a-sites-by-host
- **accounts.27** - taking the site also deletes its AI runs *Since:* features/18b1-the-run-with-openrouter
- **accounts.28** - deleting a site's last account removes the site's contact submissions with it *Since:* features/19a-receiving-a-message
- **accounts.29** - deleting an account that takes a site cancels its subscription first, and is refused when Stripe cannot cancel it *Since:* features/21b-pay-for-launch

## Removed
- accounts.23 - removed by features/16a-sites-by-host
