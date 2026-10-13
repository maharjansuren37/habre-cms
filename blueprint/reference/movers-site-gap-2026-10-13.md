# A local-business site on Habre - gap analysis (2026-10-13)

**R&D, parked (owner, 2026-10-13).** Not in the build plan; nothing here is
decided. Measured against the Bulmaya movers mockup
(`~/para/02-areas/design/ui-taste/directions/bulmaya/movers-site-v2`, outside
this repository), compared with what `main` at `9c2e89f` renders. Pick it up with
`ideate --rescope` if it becomes work.

## What the CMS has

Sections (`align`, `background: none | band`), columns, the section templates
`blank`, `hero`, `image-text`, `cta`; headings, paragraphs, lists, quotes,
images, buttons, spaces, lines; brand colour, style presets, logo, a navigation
menu, one language per site; a contact form with fixed fields (name, email,
message; `buttonLabel`, `thanks`).

## What the mockup needs

| Mockup part | Today | Missing |
|---|---|---|
| Hero with the photo running to the edge, an overlaid "Move with confidence" card, a postcode quick quote | `hero` template: image and text side by side | Section layout options (image to the edge, overlay card); an inline form |
| Top bar with phone number, header "Get a free quote" button, language switch | Logo and navigation | Header settings: top bar text, phone, call-to-action button |
| Dark trust strip with icons | `band` background, no icons | A dark / accent section style; an icon block or icon + text list |
| Service cards, numbered "How it works" steps, crew grid | Columns of plain blocks | Card and steps blocks, or card styling on columns |
| FAQ | - | FAQ block (`<details>`, no script) |
| Four-step quote form: postcodes, move type, size, date, extras, phone | Contact form, fixed fields | Form fields (text, phone, date, choice, checkbox) and steps; replies still land in Messages |
| English / Nepali switch | One language per site | A second language per site: two versions of every entry. The largest change here |
| Fonts (Manrope + DM Sans) | Preset typography | Font pairs as part of the presets |
| Header that hides on scroll, phone tab bar | - | Theme behaviour, optional |
| Footer columns | Basic footer | Footer settings |

The mockup's font switcher (A/B/C) is a prototype tool, not part of the site.

## Suggested order, by how much of the look each step delivers

1. **Section styles and new blocks** - dark / accent sections, edge-to-edge
   image layout, icon, card, steps, FAQ. Most of the visual match. Overlaps
   plan section 11's "section styling" (Level 2 builder follow-ups).
2. **Header and footer settings** - top bar, phone, call-to-action button,
   footer columns.
3. **Font pairs in presets.**
4. **Form fields** on the contact form, then multi-step forms - the quote form.
5. **A second language per site** - data model, editor, URLs, `hreflang`. Its
   own item, probably Pro.

Steps 1-3 could also become a "Local business" ready-made page that `/start`'s
AI produces. All of it stays inside D28-D30 (no raw HTML): new nodes and
settings, not custom HTML or CSS, which stays deferred.

## Open question

Is this one customer's site, or the bar for every small-business site? The
bar means `ideate --rescope` for items 22+ in the order above; one site means
steps 1-2 plus a simple quote form, with the language switch waiting.
