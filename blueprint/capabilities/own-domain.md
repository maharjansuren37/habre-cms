# Capability: own-domain

- **own-domain.1** - a Launch site's admin can add one own domain on `/admin/plan`, which shows the TXT and address records to create *Since:* features/21c-own-domain
- **own-domain.2** - a domain is verified only when its TXT record holds the site's token and every one of its addresses is the site's subdomain's *Since:* features/21c-own-domain
- **own-domain.3** - an unverified domain does not serve the site and does not change its main address *Since:* features/21c-own-domain
- **own-domain.4** - a domain that is the platform's, the sites domain's, under either, an IP, or held by another site is refused *Since:* features/21c-own-domain
- **own-domain.5** - a Free site cannot add a domain, and sees what Launch adds *Since:* features/21c-own-domain
- **own-domain.6** - an admin can remove their site's domain, and its subdomain serves it again *Since:* features/21c-own-domain
- **own-domain.7** - removing a verified domain asks for confirmation first, and the server refuses it without one *Since:* features/21c-own-domain
- **own-domain.8** - an admin of another site cannot see, check or remove a site's domain *Since:* features/21c-own-domain
- **own-domain.9** - Check now is refused after ten checks in an hour for one site *Since:* features/21c-own-domain
- **own-domain.10** - a waiting domain is re-checked without any click for 24 hours, and verifies as soon as its records hold *Since:* features/21c-own-domain
- **own-domain.11** - a domain that verifies is requested once over https so its certificate is ready before a visitor *Since:* features/21c-own-domain
- **own-domain.12** - `/_caddy/ask` answers only a loopback request, whatever the path's case, trailing slash or encoding *Since:* features/21c-own-domain
- **own-domain.13** - `/_caddy/ask` answers 200 only for a verified domain of an unsuspended site, and 404 for any request that came through the proxy *Since:* features/21c-own-domain
