# Changelog

What changed in each production release of Habre CMS, for the person running
it. Internal refactors, dependency bumps and test changes are not listed here -
see the git log for those.

## 2026-10-01 - release `8d82ce4`

- **New: ready-made sections.** Below the page's sections there are now three
  more buttons: "Add hero section" (a big heading, a line of text and an
  optional button), "Add call to action" (a boxed heading, text and a button that
  is always there) and "Add image and text" (a picture from your media library
  beside a heading, text and an optional button; stacked on a phone). They are
  forms, not free writing - fill in the fields and save.
- **Good to know:** a page that uses one of these sections can no longer be
  opened by the previous version of the site, so this release cannot simply be
  switched back once you have saved one.

## 2026-09-30 - release `135bd1d`

- **New: build a page from sections.** A page is now a list of sections, shown
  as cards in the editor. Add a section, move it up or down, or remove it (you
  are asked first). Posts are unchanged. Pages you already have open as one
  section and become sectioned the next time you save them.
- **New: columns.** Each section can have 1, 2 or 3 columns, chosen with the
  "Columns" buttons on its card. Side by side on a wide screen; stacked, in
  order, on a phone. Choosing fewer columns moves the extra text and images
  into the last column you keep - nothing is deleted.
- **Good to know:** a page saved with sections can no longer be opened by the
  previous version of the site, so this release cannot simply be switched back
  once you have saved one.

## 2026-09-29 - release `5bd0d29`

- **Fixed: page titles.** The title shown in the browser tab now names your
  site on every public page, including the error page.

## 2026-09-28 - release `bded549`

- **Action needed: choose a home page.** Your site's front page (`/`) no
  longer lists posts. It shows a page you choose in Settings -> Home page, and
  until you choose one it shows "This site is being set up". Publish a page
  first, then pick it.
- **Changed: posts moved to `/posts`.** The post list has its own permanent
  address, linked from the placeholder. Individual posts keep their
  addresses.
- The page you choose as the home page is only at `/`. Its own address
  redirects there.

## 2026-09-28 - release `8d6afba`

- Security hardening behind the scenes. Nothing changes in how the site or
  the admin works.

## 2026-09-28 - release `6bf3ddb`

- **Fixed: logging in** at `https://cms.surenmaharjan.fyi` now takes you to
  your posts, instead of a broken address on the public site.

## 2026-09-23 - release `4d9efdb`

- **New: images.** Upload an image into a reusable media library, with alt
  text, and insert it into a post or page.
- **New: pages.** Standalone content alongside posts - an About or Contact
  page - published and unpublished the same way as a post.
- **New: site settings.** Set your site's title and logo, and build a
  navigation menu of pages and web addresses, from Settings.
- **New: manage other users.** Add editors and authors, change anyone's role,
  reset a password, or deactivate an account, all from Users. Takes effect on
  that person's very next action, not their next login.

## 2026-09-21 - release `4165637`

- **Changed: the admin moved to its own address.** Log in and manage content
  at `https://cms.surenmaharjan.fyi` from now on. If you had the old combined
  address bookmarked for the admin, update it.
- **New: your site is public.** Published posts are now visible to everyone
  at `https://surenmaharjan.fyi`, not just inside the admin.
- **New: publish and unpublish.** Turn a draft into a visible post, or take a
  published one back to draft, with one click from the post editor.

## 2026-09-21 - release `0ad8300`

- **New: manage your posts.** `/admin/posts` lists every post you can see, with
  tabs for All / Drafts / Published (each with a count), a search box by title,
  and pages of 20. Delete a post from the list, with a confirmation screen first.
- **New: bold, italic and links** in the post editor's text, heading and list
  blocks, with a link field that checks the address you give it.
- **New: write and save posts as drafts**, in a block editor with text, heading
  and list blocks - come back later and carry on.

## 2026-09-16 - release `52c2670`

- **Fixed: logging in didn't work at all.** The previous release rejected every
  login behind the production server's proxy. No content or accounts were
  affected - this was caught before anyone but the admin had used it.

## 2026-09-16 - release `48e5052`

- **First release.** Admin login, with a one-week session. Nothing to write or
  publish yet.
