# Changelog

What changed in each production release of Habre CMS, for the person running
it. Internal refactors, dependency bumps and test changes are not listed here -
see the git log for those.

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
