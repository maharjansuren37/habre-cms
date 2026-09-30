# Build Plan

> The other planning doc you own. Write it yourself or with the AI's help.

The items that make up this project, high level and in rough build order, one
line each, no detail. Rough is fine at first, but before the `context` skill runs
this should be a checkbox list the loop can track.

Run the `spec` skill with no argument to spec the **next unchecked** item, or
name a number or title to pick a specific one. Completed items get checked off
here, so this doubles as the progress tracker. A big item gets split into
sub-items (4a, 4b, ...) when it is spec'd.

## Format

Checkboxes. Each item is an outcome sized to one review cycle - not a loose task,
not a whole product area.

Good:

    - [ ] 1. **Submit a link** - paste a URL, save it with its title
    - [ ] 2. **Browse saved links** - list, filter, and open them
    - [ ] 3. **Tags** - add tags on save, filter the list by tag

Avoid:

    - Upload stuff
    - Database
    - Make it look nice
    - Auth, billing, dashboard, and deploy

Scaffolding the app and prototyping the look are pre-build steps, not items.
Start with the first real slice of functionality.

A common order that works: build the core UI against placeholder data first,
then wire up real data, then auth, then integrations. Add deployment readiness
when the thing is worth shipping.

## Continuing after the first release

This is a living roadmap, not a plan that freezes. Keep completed items checked
and append new unchecked ones as the project grows. Optional `## MVP` and
`## Later` headings keep a long plan readable without changing how the next
unchecked item is found.

Do not renumber completed items - archived specs refer back to those numbers.
Continue with the next unused number. If a new item materially changes the
product direction, users, data, stack, or deployment, update
blueprint/project-plan.md too, then regenerate the overview.

## Items

<!-- Real items go here, one per line, in the shape shown under Format above.
     `ideate` writes the first set from the plan.

     Nothing is listed below on purpose. Placeholder items used to ship here as
     live checkboxes, and every skill that reads this file treats an unchecked
     box as real work: `spec` with no argument specs the first one, `progress`
     counts it as remaining, `prepare` files a requirement for whatever service
     it mentions. A project that never deleted them had its workflow quietly
     pointed at a product that does not exist. An empty section stops the loop
     with "nothing is queued", which is true and obvious; two fake items send it
     confidently in the wrong direction. -->

## MVP

- [x] 1. **Admin login** - create the first admin account, log in and out, 1-week session
- [x] 2. **Write a post** - block editor (text, heading, list), save as draft
  - [x] 2a. **Write a post** - entries table, block model, Editor.js, save a draft at /admin/posts/new and /admin/posts/:id
  - [x] 2b. **Inline formatting** - bold, italic and links, stored as structured runs, never raw HTML
- [x] 3. **Manage posts** - list, edit and delete posts and drafts
- [x] 4. **Publish to the public site** - publish/unpublish; the site renders published posts with the built-in theme on `surenmaharjan.fyi`, with admin on `cms.surenmaharjan.fyi` (D22)
  - [x] 4a. **Publish and unpublish** - a draft/published toggle on the post editor, reusing the existing status column and the `?deleted=`-style redirect banner
  - [x] 4b. **Render the public site** - home page, one post, 404, in the built-in theme, still on the single existing hostname
  - [x] 4c. **Split the hostnames** (D22) - `PUBLIC_URL`/`ADMIN_URL`, host-based routing and redirects, the CSRF check, and the Caddy/DNS changes to serve `surenmaharjan.fyi` and `cms.surenmaharjan.fyi` from one app
- [x] 5. **Images** - upload to R2, insert into a post, media library to reuse them
  - [x] 5a. **Media storage and library** - `media` table, R2 client, upload with validation, `/admin/media` list and delete
  - [x] 5b. **Insert images into posts** - an image block in the editor, backed by the media library
  - [x] 5c. **Render images on the public site** - resolve a media id to its URL at render time
- [x] 6. **Pages** - create, edit and publish static pages, served at their own URLs
  - [x] 6a. **Manage pages** - admin list/create/edit/delete for pages, restricted to editors and admins, generalizing the entries table's existing `type` column and the post editor
  - [x] 6b. **Render pages on the public site** - `/:slug` resolves a published page and renders it in the built-in theme, the same as a post
- [x] 7. **Site settings and menu** - title, logo, navigation shown on the public site
  - [x] 7a. **Site title and logo** - a settings screen where an admin sets the site title and logo, replacing the placeholder in the admin shell and public site chrome
  - [x] 7b. **Navigation menu** - an ordered list of nav items (page or URL) editable in settings and rendered in the public header
- [x] 8. **Users and roles** - admin adds editors and authors; permissions enforced on the server

## After MVP

- [x] 9. **Choose the home page** - in settings, `/` is always a landing page: an admin picks one published page for it, with a welcome placeholder until one is chosen; posts are an add-on at `/posts`
- [x] 10. **Sections on pages** - a page is an ordered list of sections, each holding blocks (pages only; posts stay flat); `blocks_format` v3, v2 pages load as one section and convert on save, nothing migrates destructively
- [x] 11. **Columns** - a section can split into 2-3 columns that stack on small screens; editor and public render
- [ ] 12. **Ready-made sections** - hero, call-to-action, image + text, insertable from the editor, rendered in the built-in theme
