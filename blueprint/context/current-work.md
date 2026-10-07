# Feature: Brand colour and style

**From build plan:** item 18a1 (item 18 -> 18a your brand -> 18a1; split proposed with this spec)
**Type:** Feature
**Verified:** not yet
**Reviewed:** 2026-10-07, 9f7da7d1c732, current (re-review of F-312), every lens - 0 open blocking; F-312 fixed, re-review found it closed, awaiting a person (autopilot)

## Goal

A site owner picks a brand colour and one of three style presets in Settings,
sees them in a live preview, and the public site and the editor's canvas then
use them - with every colour pair still meeting WCAG 2.2 AA, whatever colour
was picked (D167, D171). This is the part of "Make it yours" that needs no
logo and no AI; 18a2 adds the logo's part and 18b reuses all of it in
onboarding.

## In scope

- `site_settings.brand_color` (`''` = neutral ink, or `#rrggbb`) and
  `style_preset` (`classic` | `modern` | `friendly`, default `modern`).
- Our own shade derivation (design.md *Customer sites*): `--color-primary`,
  `-hover`, `--color-on-primary`, `--color-primary-subtle`,
  `--color-focus-ring` from one hex, by moving OKLCH lightness until primary
  is >= 4.5:1 on bg, on surface and on subtle, and on-primary >= 4.5:1 on
  primary and on hover. **Light only** - public sites are light in v1 (D168).
- The three presets' font pairs self-hosted from `app/fonts/`, and the
  `[data-style]` rules (fonts and radii) inside the site scope.
- Public pages: a nonce'd `<style>` in `<head>` holding only the derived
  custom properties, `data-style` on `<html>`, the public `style-src` becoming
  `'self' 'nonce-…'` (admin unchanged); the public 404 too.
- The wordmark: with no logo, the header's site name is in the preset's
  heading font and the brand colour (`.wordmark`).
- Settings: a **Brand** section - Brand colour (swatches as radio buttons: No
  colour, the saved colour, and Other colour) and Style (three preset cards
  drawn in the site scope), a half-size live preview, saved with the rest of
  the form.
- The editor's canvas drawn in the site's brand colour and preset; the chrome
  stays rust.

## Out of scope

- Uploading an SVG logo (turned into a PNG in the browser) and colours
  suggested from the logo's pixels - **18a2**. The swatch row is built so 18a2
  only adds swatches to it.
- The AI-suggested colour, onboarding's "Make it yours" step - **18b**.
- Dark shades and the site's dark mode - **item 20** (D168, D172). The
  derivation is written so a dark variant is a second call, not a rewrite.
- Preset names stay provisional (design.md *Open*).
- A colour per element, custom CSS, more themes - plan section 11.

## Design reference

- `prototypes/start-brand.html` - the swatches, the preset cards and the
  preview; Settings reuses these controls (design.md *Screens*, Settings row).
- `prototypes/theme.css` - `[data-style]` rules and the `#2f6b5a` example
  (`[data-brand="example"]`), the values the derivation must reproduce.
- `prototypes/components.css` - `.swatch-radio`, `.choice-card--preset`,
  `.preset-sample`, `.brand-preview`, `.site-brand`, `.wordmark`.
- design.md *Customer sites: brand colour, presets, dark mode* and *Measured
  contrast* (the "Brand L" column).

**What the record does not cover** (added to design.md in Step 5):

- A **No colour** swatch - the neutral ink look is a stored state (`''`), so
  Settings needs a way back to it. First in the row, drawn as the ink colour,
  named "No colour (black and white)".
- **Swatch colours and the preview's colours are set through CSSOM**
  (`element.style.setProperty`), never a `style` attribute: the mock's
  `style="--swatch: …"` is blocked by `style-src 'self'`. Server-rendered
  swatches show their colour once the page hydrates; the visible name says it
  regardless.
- The Brand section sits after Logo and before Site description.

## Build steps

- [x] **Step 1 - The migration** - `db/migrations/0018_brand.sql`: on
  `site_settings`, `brand_color text not null default ''` with a check
  (`brand_color = '' or brand_color ~ '^#[0-9a-f]{6}$'`) and
  `style_preset text not null default 'modern'` with a check
  (`in ('classic','modern','friendly')`); additive, reverse in its header
  comment. Built with `migrate`. *Done when:* `npm run db:migrate` applies it
  to the development database; site 1's row reads `''` / `modern`; an update
  to `'#FFF'`, `'red'` or `'ornate'` is refused by its check (shown with
  `psql` as the owner); `npm run verify` passes.

- [x] **Step 2 - The shade derivation** - `app/features/brand/brand-colours.ts`
  (pure, runs in both server and browser): `parseBrandColor` (exactly
  `#rrggbb`, lowercased; anything else is "no colour"), sRGB <-> OKLCH,
  WCAG contrast, and `deriveBrandShades(hex, surface)` returning the five
  roles as `#rrggbb`; the light surface's bg and surface values come from the
  site scope in `app/app.css`. Plus `brandCustomProperties(brand)` returning
  the declarations text (`--color-primary:#…;…`) built only from derived
  hex values, and `''` for no colour. *Done when:* `npm test` passes
  `brand-colours.test.ts`, showing: `#2f6b5a` comes back unchanged with
  primary on bg at 6.23:1 (design.md's figure, to 2 decimals); gold
  `#c9a25e` is adjusted and its primary on subtle is >= 4.5; for every hue in
  steps of 10 degrees at OKLCH lightness 0.05 to 0.95 in steps of 0.1 (and
  pure `#ffffff`, `#000000`, `#ffff00`), all five required pairs are >= 4.5:1;
  `#fff`, `red`, `#2f6b5a;}` and `#2F6B5A` parse as no colour, no colour and
  no colour and `#2f6b5a` respectively; the declarations text never contains
  any character outside `[a-z0-9#:;-]`.

- [x] **Step 3 - The preset fonts and the site-scope rules** - move the three
  woff2 files and their OFL licence files from `prototypes/fonts/` to
  `app/fonts/`; add their `@font-face` rules and the three `[data-style]`
  blocks (fonts and radii, from `prototypes/theme.css`) inside the site scope
  in `app/app.css`, Modern matching today's site scope; port `.site-brand` /
  `.wordmark`. *Done when:* `npm run verify` passes; `build/client/assets`
  holds the three woff2 files beside Inter's; `prototypes/fonts/` is gone and
  the mockups point at `app/fonts/` (or are noted as no longer rendering
  fonts, since they are throwaway); nothing visible changes yet - the
  existing browser suite is green.

- [x] **Step 4 - The brand on public pages** - `getSiteSettings` reads
  `brandColor` and `stylePreset`; one nonce per request, created before any
  loader runs and read by both `entry.server.tsx` (the header) and the public
  layout's loader (check the installed docs for how `handleRequest` receives
  the request's context under middleware); the public layout returns the
  nonce, the declarations text and the preset; root `Layout` renders
  `data-style` on `<html>` and `<style nonce>` with
  `[data-surface="site"]{…}` in `<head>` on public pages only;
  `contentSecurityPolicy` gives the public area `style-src 'self' 'nonce-…'`
  and the admin `'self'`; the header shows the wordmark when there is no
  logo. *Done when:* a new `e2e/brand.spec.ts`, on a **site of its own**
  (never site 1's row - F-103), with brand `#2f6b5a` and `classic`: the
  response's CSP nonce equals the `<style>`'s; a primary button's computed
  background is `rgb(47, 107, 90)`; the page `h1`'s computed font family
  starts with Source Serif 4; the header's name, with no logo, is coloured
  the primary; every font request is to the site's own origin; an admin
  response's `style-src` is still exactly `'self'`; a site with no colour
  and `modern` renders as before (the existing public specs green);
  `e2e/contrast.spec.ts` gains branded-site cases for `#c9a25e`, `#ffff00`
  and `#000000` and they pass; the public 404 carries the same style;
  `public-site.1`'s test updated and passing (brand and preset are the only
  new settings on public pages).

- [x] **Step 5 - Brand colour and Style in Settings** - `brandColorSchema`
  (`''` or a colour `parseBrandColor` accepts) and `stylePresetSchema` in
  `settings-input.ts`; an `updateBrand` sibling in `settings.server.ts`
  (F-40's split) inside `saveSiteSettings`'s transaction; the Brand section
  in `settings.tsx` - two `fieldset`s with `legend`s, swatches and preset
  cards as real radio inputs (`.swatch-radio`, `.choice-card--preset`), Other
  colour a native `input type="color"` that selects its own swatch; swatch
  colours set through CSSOM; design.md updated with the three gaps above.
  *Done when:* journey 5's save half in `e2e/brand.spec.ts` (own site):
  Settings -> Other colour -> `#2f6b5a` -> Classic -> Save -> the banner
  says saved -> the public home page's button is `rgb(47, 107, 90)` and its
  `h1` Source Serif; choosing No colour and Save returns the site to ink; a
  crafted POST with `brandColor=#2f6b5a;}` or `stylePreset=ornate` answers
  400 with the field's error and changes nothing; arrow keys move between
  swatches and between preset cards (native radio behaviour, checked by
  `getByRole("radio")`); at 390px Settings does not scroll sideways;
  Settings meets contrast in light and dark (`e2e/contrast.spec.ts`).

- [x] **Step 6 - The live preview** - the half-size preview from
  `start-brand.html` beside the fields (stacked on a phone): the site's name
  or logo, a menu, a heading, a paragraph, a primary button and a link, in
  the site scope, with `data-style` and the derived properties applied
  through CSSOM on every change, before Save; `role="img"` with a label, as
  the mock. *Done when:* in `e2e/brand.spec.ts`, choosing Other colour
  `#2f6b5a` changes the preview's button to `rgb(47, 107, 90)` and Friendly
  changes its heading to Nunito, **without** a request to the server, and
  reloading without Save shows the saved values again;
  `e2e/content-security-policy.spec.ts` sees no violation on Settings while
  doing so.

- [x] **Step 7 - The canvas in the site's brand** - the editor layout's
  loader returns the site's brand colour and preset; the canvas
  (`document-editor.client.tsx`, already `data-surface="site"`) gets
  `data-style` and the derived properties through CSSOM. *Done when:* in
  `e2e/brand.spec.ts`, editing a page on the branded `classic` site, a
  button block on the canvas is `rgb(47, 107, 90)` and a heading block is
  Source Serif 4, while the selected block's ring is still Habre's rust;
  `e2e/content-security-policy.spec.ts`'s editor walk sees no violation.

- [x] **Repair F-312 - A brand colour's links and outline buttons can fall to
  4.48:1 on a band section** - `deriveBrandShades` also requires primary
  >= 4.5:1 on the surface's `sunken` (`#f5f5f5`, `--color-surface-sunken`);
  `e2e/contrast.spec.ts` gains primary on surface-sunken; design.md's rule
  names it. *Done when:* `#69c369`'s primary is >= 4.5:1 on `#f5f5f5`
  (red before the repair, green after); the contrast spec passes.

## Files and areas

- `db/migrations/0018_brand.sql` (new)
- `app/features/brand/brand-colours.ts`, `brand-colours.test.ts` (new)
- `app/fonts/` (three woff2 + licences moved in), `app/app.css`
- `app/features/settings/settings.server.ts`, `settings-input.ts` (+ test),
  `settings.tsx`, `settings.module.css`
- `app/features/public-site/layout.tsx`, `layout.module.css`; `app/root.tsx`;
  `app/entry.server.tsx`; possibly `server/app.ts` (the per-request nonce)
- `app/lib/content-security-policy.ts` (+ test)
- `app/features/content/editor-layout.tsx`,
  `app/features/blocks/document-editor.client.tsx`
- `e2e/brand.spec.ts` (new), `e2e/contrast.spec.ts`,
  `e2e/content-security-policy.spec.ts`, the `public-site.1` test
- `blueprint/context/design.md`, `prototypes/` (font paths)

## Data and contracts

- **`site_settings.brand_color`** - `text not null default ''`; `''` or
  `#rrggbb` lowercase. **Load-bearing:** 18a2 writes a logo-suggested colour
  here, 18b an AI-suggested one, item 20 derives dark shades from it.
- **`site_settings.style_preset`** - `text not null default 'modern'`,
  `classic | modern | friendly`. **Load-bearing:** 18b sets it at onboarding.
- **`deriveBrandShades(hex, surface)`** -> `{ primary, primaryHover,
  onPrimary, primarySubtle, focusRing }`, each `#rrggbb`. **Load-bearing:**
  item 20 calls it with the dark surface.
- **`SiteSettings`** gains `brandColor: string` and
  `stylePreset: "classic" | "modern" | "friendly"`.
- The settings form posts `brandColor` (`''` or `#rrggbb`) and `stylePreset`.
- Only the inputs are stored; shades are derived on each render (D171).

## Testing

- **Unit** (`npm test`, inside `verify`, runs in CI): `brand-colours.test.ts`
  (the derivation grid, parsing, the declarations text), `settings-input`
  (the two schemas), `content-security-policy` (public vs admin `style-src`).
- **Browser** (`npm run test:e2e`, the CI `e2e` job - it has PostgreSQL and
  Mailpit, which is all these need): `e2e/brand.spec.ts` creates its own
  site with `createSite` / `createSiteAdmin` (`e2e/helpers/sites.ts`), because
  site 1's `site_settings` row is shared (F-103). No step needs R2: the
  wordmark path needs no logo. Any assertion that does upload a logo calls
  `test.skip(skipWithoutStorage)`.
- `e2e/contrast.spec.ts` gains the branded cases; the existing public,
  CSP and 390px specs must stay green.

## Decisions

- **No colour is a choice in Settings** (`''`, the first swatch), not only
  the state before one is picked - beats having no way back to ink once a
  colour is saved.
- **The nonce reaches the page through the public layout's loader data**,
  from one per-request value `entry.server.tsx` also puts in the header -
  beats reading React Router's internal nonce context (undocumented in
  8.4.0) and generating it twice. The value is already in the page's script
  tags; it changes per response.
- **The admin's `style-src` stays `'self'`**; the canvas and the Settings
  preview get their colours through CSSOM, which that policy allows - beats
  widening the admin policy to nonce'd styles.
- **Dark shades wait for item 20** - beats deriving and testing values no
  page can show yet.
- **18a splits into 18a1 (this) and 18a2 (the logo)** - beats one spec of
  ten-plus steps; the logo's colour suggestion has its own open question
  (Notes).

- **The shade rule (Step 2), fitted to the `#2f6b5a` example:** hover is
  primary's OKLCH lightness - 0.07; subtle is lightness 0.965 at 35% of
  primary's chroma, hue kept; on-primary is white, else `#0a0a0a`. A colour
  that fails any pair has its lightness lowered in 0.005 steps (chroma
  clamped into sRGB) until all five hold - beats a lookup table, and
  reproduces the mock's hover and subtle exactly.

## Production needs

- Migration `0018_brand.sql` (additive, defaults; no data change).
- No new environment variables, accounts or dependencies.
- The public pages' Content-Security-Policy changes (`style-src 'self'
  'nonce-…'`); Caddy sets no CSP of its own, so nothing on the server
  changes.

## Behaviour changes

- New capability `brand`: a site's brand colour and style are set in Settings, with No colour (black and white) and Modern the default - Step 5
- Adds to `brand`: whatever brand colour is saved, the public site's primary, its hover, the text on it and its subtle background meet WCAG 2.2 AA - Step 2
- Adds to `brand`: public pages use the site's brand colour and style preset's fonts and corners - Step 4
- Adds to `brand`: a site without a logo shows its name in the brand colour and the preset's heading font - Step 4
- Adds to `brand`: Settings previews a brand colour and style before they are saved - Step 6
- Adds to `brand`: the editor's canvas shows the site's brand colour and style, its selection chrome Habre's - Step 7
- Changes `appearance.2` from "text is set in Inter, served from the app's own origin; no font request goes to a third party" to "Habre's screens are set in Inter and a site in its style preset's fonts, all served from the app's own origin; no font request goes to a third party" - Step 4
- Changes `public-site.1` from "public pages carry no entry ids and no share image id or key, and no settings beyond the title, logo, menu, language, site description and main address" to "public pages carry no entry ids and no share image id or key, and no settings beyond the title, logo, menu, language, site description, main address, brand colour and style" - Step 4

## Notes

- **CSS injection is the risk here (D171).** The colour is parsed to exactly
  `#rrggbb` at the form, at the column's check and again before rendering;
  the style holds only declarations built from derived hex values. Never
  interpolate the stored string.
- **Inline `style` attributes are blocked** in both areas (`style-src` has no
  `'unsafe-inline'`); colours in the admin go through CSSOM, as the toolbar
  and panel already do (`content-security-policy.ts`'s comment).
- **Hydration:** browsers hide a `nonce` attribute's value from script, so
  the client may see `""` where the server rendered the nonce. Check the
  production build logs no hydration error on a public page; if React
  re-renders the `<style>`, its nonce slot survives a text update.
- **Contrast is the bar** (`quality-bar.md` defers to design.md's
  *Accessibility bar*): no colour a user picks may lower it - Step 2's grid
  and Step 4's contrast cases are that number, not "looks fine".
- The site scope's bg and surface values live in `app/app.css`; the
  derivation must use the same ones. A test reads them from one exported
  constant, not two copies (F-159's lesson).
- `site_settings` queries stay inside `inSite` and name `site_id`.
- Settings is admin-only already (`requireRole(["admin"])`).
- **For 18a2, recorded now:** colours "from the logo's pixels in the browser"
  (D167) need the logo's pixels in a canvas, but a logo picked from the
  library is an R2 image on another origin, which taints the canvas unless
  the bucket sends CORS headers (an owner's Cloudflare setting). 18a2's spec
  decides between that, reading pixels at upload time, or counting them on
  the server with `sharp`.
- After Step 5, widen `needs-you.md`'s admin screen-reader line with the
  Brand section (done by this spec).
