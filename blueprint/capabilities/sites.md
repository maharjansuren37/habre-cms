# Capability: sites

- **sites.1** - an admin of one site gets Not Found for another site's post, page, image or member opened by id, and sees none of its rows in any list *Since:* features/15a-sites-and-memberships
- **sites.2** - with no site set, the database returns none of `entries`, `media` or `site_settings` to the app, and refuses a write into another site *Since:* features/15a-sites-and-memberships
- **sites.3** - two sites can each have a page at the same address *Since:* features/15a-sites-and-memberships
- **sites.4** - a person can sign in only while they hold an active membership and their email is confirmed, and their role is the membership's *Since:* features/15a-sites-and-memberships · *Changed:* features/15b-signup
- **sites.5** - a new upload is stored under `sites/<site id>/` *Since:* features/15a-sites-and-memberships
- **sites.6** - a site's public pages are served at its main address - its earliest-verified own domain where `SITES_URL` is https, else `<address>.<sites domain>` - and show only that site's content *Since:* features/15a-sites-and-memberships · *Changed:* features/17-seo-basics
- **sites.7** - a verified domain in `site_domains` serves its site; an unverified domain, an unknown address or a suspended site answers 404 *Since:* features/16a-sites-by-host
- **sites.8** - sign-in, signup and the admin answer on the platform host only - an admin path on a site host redirects there, a public path on the platform host answers 404, and `/` there redirects to `/admin` *Since:* features/16a-sites-by-host
- **sites.9** - View site and the admin's site card show the site's address, and signup shows the sites domain after the address field *Since:* features/16a-sites-by-host
- **sites.10** - `npm run suspend-site -- --address <address>` takes the site's public pages off at once, on every host it is served at, and `unsuspend-site` brings them back; an unknown address changes nothing and exits 1 *Since:* features/16b-suspend-and-the-server
- **sites.11** - a suspended site's members still sign in and edit, and every admin screen says the site is suspended and that visitors see Not Found *Since:* features/16b-suspend-and-the-server
- **sites.12** - the platform's apex and `www`, and `cms.surenmaharjan.fyi`, answer a 301 to the same path on the platform host *Since:* features/16b-suspend-and-the-server
- **sites.13** - a client-sent `Forwarded` header does not change which host or site a request is served as *Since:* features/16b-suspend-and-the-server
- **sites.14** - a GET or HEAD on any host of a site other than its main address answers a 301 to the same path and query on the main address *Since:* features/17-seo-basics
- **sites.15** - the 301 to the main address may be cached for at most one day *Since:* features/17-seo-basics
