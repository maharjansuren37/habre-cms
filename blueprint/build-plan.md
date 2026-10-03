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
- [x] 12. **Ready-made sections** - hero, call-to-action, image + text, insertable from the editor, rendered in the built-in theme
  - [x] 12a. **Hero and the typed-section foundation** - a section can be a ready-made kind with fixed slots instead of free columns: schema union, public render, an "Add section" menu (Blank / Hero) and a slot form in the page editor; hero = heading, text, optional button
  - [x] 12b. **Call to action** - the second kind: heading, text, one button, on the 12a foundation
  - [x] 12c. **Image + text** - the third kind: an image slot (media picker), heading, text, optional button, image side by side with the text

## Platform v1

Rescope D148: a stranger signs up, describes what they want, gets a site, edits it and publishes it (Level 1). Architecture: plan section 6 (D151-D164, D169-D174). Production holds on `8d82ce4` until 13-21 are all done, then v1 ships in one deploy (D163). Item 15 splits into 15a-15d when spec'd (plan section 6, *Build order*). Item 14 splits into 14a the format, TipTap and public render; 14b the palette and drag and drop; 14c ready-made sections as templates (D169, D170). 14a split again into 14a1-14a3 when spec'd. 14c split into 14c1-14c2 when spec'd. Item 18 splits into 18a your brand (logo, brand colour, three style presets, in Settings and on the public site); 18b the AI draft, with "Make it yours" as onboarding's third step (D167, D171). Details: plan section 6, *Build order*. The look is settled (`blueprint/context/design.md`, 2026-10-02).

- [x] 13. **Upgrade React Router** - 8.4.0, with `@remix-run/node-fetch-server` 0.14.2 (D23), `verify` and the browser suite green. Vite, Biome and other patch releases parked (owner, 2026-10-02)
- [x] 13b. **The new look** - `design.md`'s 2026-10-02 redesign on the existing screens: its tokens, Inter self-hosted, the rust admin; public sites in the neutral site scope and light only (D168); contrast re-measured, `verify` and the browser suite green
- [x] 14. **The new editor** - Mailchimp-style drag and drop for pages and posts (D165): drag blocks from a palette into any section or column, with Move up / Move down as the non-drag alternative (WCAG 2.5.7); ready-made sections (hero, call to action, image and text) carried over as templates (D170); TipTap edits the text, with text styles Main heading (chosen once per page; none means the title), Heading, Subheading and Small heading (H1-H4) and H5-H6 stored for Pro (D166); undo and redo; content stored as one document per page, sections and columns as nodes, so Level 2 adds layout settings without a migration (D169); existing content discarded, not converted
  - [x] 14a1. **The document, text editing and the public render** - `blocks_format` v4 and its Zod schema, TipTap on one document per page and post, sections of 1-3 columns, Text / Heading / Subheading / Small heading, lists and quote, bold, italic and links, undo and redo, the public renderer, existing content discarded and Editor.js removed
  - [x] 14a2. **Image, button, line and space** - the four remaining v1 blocks, the palette's keyboard path (focus a tile, Enter adds the block after the selected one), the settings panel (a block's settings and a section's columns); the first image on a page loads at once (D174)
  - [x] 14a3. **The block toolbar** - the selected block's ring and toolbar: Move up / Move down for blocks and sections with the new position announced, the Text style menu with Main heading, Bold, Italic, Link and Delete
  - [x] 14b. **The palette and drag and drop** - the drop gap, the ghost, the announcements, and Duplicate
  - [x] 14c. **Ready-made sections as templates** - Hero, Image and text, Call to action and Blank section insert ordinary blocks (D170)
    - [x] 14c1. **Ready-made sections, added from the palette** - the Sections tiles add Blank section, Hero, Image and text or Call to action after the section being edited, by click, Enter or the phone's Add; empty-text hints in the editor; the template shape 18b reuses
    - [x] 14c2. **Dragging a section tile** - a section drop slot between sections, its gap and ghost, and the announcements
- [ ] 15. **Sign up and sites** - public signup with email verification creates a site and makes the person its admin; each site's content, media, settings and members are its own; password reset by email; each site's media storage capped from the first signup (D150)
  - [ ] 15a. **Sites and memberships** - `site_id` on every site-owned table, row-level security, the owner and app database roles (D152), today's installation as site 1 (D162), the admin scoped by membership; no signup
  - [ ] 15b. **Signup** - the email module, signup with verification (D161), invites, and choosing an address
  - [ ] 15c. **Password reset by email**
  - [ ] 15d. **Storage cap per site** (D150)
- [ ] 16. **Sites on their own subdomains** - each site's public site served at `<name>.<sites domain>` (D153)
- [ ] 17. **SEO basics** - title and description per page and post, social image, `sitemap.xml` and `robots.txt` per site; one main address per site, the others redirecting to it, with a canonical link; nothing indexed until a site publishes; the site's language on every page (D173)
- [ ] 17b. **Optimised images** - each upload resized on the server into WebP sizes and a social-image JPEG, without camera details, the upload itself not kept; pages pick the size they show; objects cached for a year; media uploaded before it resized by a server command (D174)
- [ ] 18. **Start from a description, in your brand** - "What do you want to create?", "Tell us about it", then an optional "Make it yours": a logo (SVG turned into a PNG in the browser), a brand colour from the logo or suggested by AI, one of three style presets, a wordmark when there is no logo; the colour and preset also in Settings, with accessible shades on the public site (D167); AI builds pages, navigation, starter text and SEO basics as drafts in the built-in theme; the user reviews and publishes; AI use capped per site
- [ ] 19. **Contact form** - a contact form block, added from the palette; submissions stored per site and emailed to the owner; spam protection
- [ ] 20. **Simple and Pro** - switching is free on every plan (D175); a new site is Simple and its admin shows only Level 1 screens; switching to Pro adds Users, advanced settings, the H5-H6 text styles and dark mode for the public site (D168); switching back keeps every page rendering, locking Pro-only settings (D166)
- [ ] 21. **Billing** - one paid plan, Launch (provisionally $19 a month, D175), paid through Stripe, that raises the Free plan's limits (AI use, storage, already enforced by items 15 and 18), lets a site use its own domain and removes the "Made with Habre" footer link; billing can be switched off for self-hosted copies and stays off through the beta (D150)
