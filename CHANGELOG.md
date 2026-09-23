# Changelog

What changed in each production release of Habre CMS, for the person running
it. Internal refactors, dependency bumps and test changes are not listed here -
see the git log for those.

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
