# Design

> Written by `prototype` on 2026-10-02, **a deliberate redesign for platform v1**
> that replaces the 2026-09-15 record. **Survives the mockups:** `ship` deletes
> `prototypes/` once the look is built; this file stays, and `review`, `spec`
> and `architect` read it. Change a decision here in the same change that
> changes the code.
>
> **The app has this look** since item 13b ported it to every existing screen
> (tokens in `app/app.css`, Inter self-hosted under `app/fonts/`, public pages
> in the `data-surface="site"` scope). Every screen is measured against this
> file.

## Product type and direction

**Mixed** (`ux-checklist.md` section 1): Habre's own signed-in product -
signup, onboarding, admin, editor - is a **web app** with a sidebar; each
customer's public site is a **content website** with a top nav and a footer.
Separate layouts and separate token scopes, never one nav for both.

**Habre: a red panda (habre) - warm, friendly and roomy.** One rust brand
colour from the fur, cream and chestnut-black neutrals from the face and legs,
Inter, rounder corners and 44px controls. Light and dark follow the device.
Built for people with no technical knowledge, who come in for a few minutes at
a time and must never wonder what to press next.

**Customer sites are theirs, not Habre's.** Neutral ink until the owner picks a
brand colour; one of three style presets; light only unless the owner turns
dark mode on (Pro). The only Habre mark is a "Made with Habre" footer link,
which the paid plan removes.

Mockups (throwaway): `prototypes/signup.html`, `start.html` (onboarding step
1), `start-brand.html` (step 3, Make it yours), `home.html` (admin Home),
`editor.html` and `editor.html#heading` (two states), `site-home.html` (a
published site), `components.html` (every component, both scopes). Tokens:
`prototypes/theme.css`; components: `prototypes/components.css`. Checks:
`prototypes/checks/contrast.mjs`, `shoot.mjs`.

## Where the tokens land

- **`app/app.css`** receives `theme.css` as custom properties - plain CSS,
  no Tailwind (D12). Components stay CSS Modules beside their feature, using
  only role tokens; `prototypes/components.css` is their reference, not a file
  to copy wholesale.
- **A re-theme build item** renames the app's current tokens to the kit's
  names first: `--color-accent` -> `--color-primary`, `--color-focus` ->
  `--color-focus-ring`, `--color-border-control` -> `--color-border-strong`,
  `--font-sans` -> `--font-family-sans`.
- **Fonts are self-hosted** woff2 files with their SIL Open Font License
  files (`prototypes/fonts/`): Inter for Habre's screens; a customer site loads
  only its preset's pair. No third-party font request.
- **A site's brand colour and preset** reach its public pages through a
  per-site stylesheet or a nonce, because the Content-Security-Policy is
  `style-src 'self'` - `architect` decides (D167).

## Token changes from the kit, and why

Values only; no kit token was renamed or removed. `theme.css` marks each one
`Habre:`.

| Token | Kit | Habre | Why |
|---|---|---|---|
| `--color-primary` | blue-600 | **rust-700 `#b4441c`** light, **rust-400 `#f08c5a`** dark | The red panda's fur. Rust-500 is decorative only - it fails as text on light. |
| Neutrals (`--color-bg`, text, borders) | slate | **stone**: bg `#fbf8f4` light / `#18110d` dark | Warm greys that sit with rust; cool slate fought it. |
| `--color-danger` | red-700 | **crimson-700** / crimson-400 | A different hue from the brand: Delete must not look like Save. |
| `--color-warning` | amber-700 | **ochre-700** / ochre-400 | Amber sits next to rust. |
| `--font-family-sans` | names Inter, loads nothing | **Inter, self-hosted** (variable, latin, 47 KB) | Named and not loaded meant system fonts on most machines. |
| `--radius-sm/md/lg` | 4 / 8 / 12px | **6 / 10 / 16px** | Friendlier, without going soft. |
| `--size-control-sm/md/lg` | 32 / 40 / 48px | **36 / 44 / 52px** | Roomy, and every default control meets the 44px touch target. |
| `--shadow-*` | slate-tinted | **stone-950-tinted** | Warm shadows on a warm background. |

**Added tokens** (names the kit does not have):

- `--font-family-heading` - so a preset can pair two fonts. Same as the body
  on Habre's screens.
- `--color-selection`, `--color-on-selection` - the editor's chrome over the
  canvas (selected block, drop gap, section chip): Habre's rust, set inside
  the site scope at the canvas's own scheme, so it stays visible on a light
  canvas inside dark Habre.
- `--font-family-ui`, `--radius-ui` (in `components.css`, on `:root`) - carry
  Habre's font and corners into the canvas, whose preset changes the site's.

**Customer-site scope, `[data-surface="site"]`:** the same role names with
`--neutral-*` greys and ink buttons, so every component renders unchanged
inside it. **It sets every role** rather than inheriting Habre's, because a
Simple site is light even when Habre is dark. `[data-dark="auto"]` (Pro) adds
the dark values. `[data-brand]` and `[data-style]` layer on top.

### Measured contrast (WCAG 2.2) - do not change a colour without re-measuring

From `node prototypes/checks/contrast.mjs`, 2026-10-02, after the last change.
**Fails: none.** Columns: Habre's screens, a neutral site, a branded site (the
`#2f6b5a` example), each with the device in light and dark. A light-only site
under a dark device measures the same as light, which is the point.
**Also proved on the real app** since item 13b by `e2e/contrast.spec.ts`
(Habre light and dark, the site scope light and with the device dark), which
fails on any pair below its bar - the selection pairs join it with item 14a.

| Pair (min) | App L | App D | Site L | Site D (Pro dark on) | Brand L | Brand D (Pro dark on) |
|---|---|---|---|---|---|---|
| text on bg (4.5) | 17.63 | 16.33 | 17.93 | 18.16 | 17.93 | 18.16 |
| text-muted on surface-hover (4.5) - worst muted | 6.67 | 6.00 | 7.17 | 6.00 | 7.17 | 6.00 |
| primary on bg (4.5) | 5.24 | 7.65 | 17.93 | 18.16 | 6.23 | 6.72 |
| primary on surface (4.5) | 5.55 | 6.99 | 17.18 | 16.44 | 5.97 | 6.09 |
| on-primary on primary (4.5) | 5.55 | 7.65 | 17.93 | 18.16 | 6.23 | 6.72 |
| primary on primary-subtle (4.5) | 5.08 | 6.63 | 16.44 | 13.88 | 5.67 | 5.02 |
| border-strong on surface (3) - the lowest | 3.82 | 4.47 | **3.31** | 4.54 | **3.31** | 4.54 |
| focus-ring on bg (3) | 5.24 | 7.65 | 17.93 | 18.16 | 6.23 | 6.72 |
| danger on danger-subtle (4.5) | 5.72 | 5.81 | 5.72 | 5.81 | 5.72 | 5.81 |
| success on success-subtle (4.5) | 4.79 | 8.55 | 4.79 | 8.55 | 4.79 | 8.55 |
| warning on warning-subtle (4.5) | 4.76 | 9.52 | 4.76 | 9.52 | 4.76 | 9.52 |
| selection on bg (3) | 5.24 | 7.65 | 5.55 | 8.11 | 5.55 | 8.11 |
| on-selection on selection (4.5) | 5.55 | 7.65 | 5.55 | 7.65 | 5.55 | 7.65 |
| bg on text-muted (4.5) - pressed toolbar button | 7.21 | 7.40 | 7.81 | 7.85 | 7.81 | 7.85 |

The script measures 29 pairs; the rest are higher than the rows shown.
Disabled controls are exempt (1.4.3) and are the only thing below these.

## Customer sites: brand colour, presets, dark mode (D167, 2026-10-02 review)

- **Brand colour.** Our own function derives `--color-primary`, `-hover`,
  `--color-on-primary`, `--color-primary-subtle` and `--color-focus-ring` from
  one hex - for light, and for dark when it is on - by moving the colour's
  OKLCH lightness until each pair meets AA: primary at least 4.5:1 on bg and
  surface, on-primary at least 4.5:1 on primary and on hover, **and primary at
  least 4.5:1 on subtle**. A sketch that checked only the first two let gold
  `#c9a25e` through at 4.39 on subtle, so the subtle check is required.
  The example `#2f6b5a` passes unchanged: light 6.23, dark `#66a28f` 6.72.
- **Presets** (names provisional), each a font pair and a corner shape and
  nothing else, so a preset never changes contrast:

  | Preset | Headings | Text | Radius sm/md/lg | |
  |---|---|---|---|---|
  | Classic | Source Serif 4 | Source Sans 3 | 2 / 3 / 4px | square |
  | **Modern** (default) | Inter | Inter | 4 / 8 / 12px | the kit's |
  | Friendly | Nunito | Nunito | 10 / 22 / 24px | pill buttons and inputs |

- **No logo gives a wordmark** (`.site-brand.wordmark`): the site's name in
  the preset's heading font and the brand colour.
- **Light only in Simple; Pro can turn dark mode on** (owner, 2026-10-02):
  a site looks the way its owner saw it in the editor, and a dark logo never
  disappears on a dark page.
- **Light only, built (D168, item 13b).** Public pages, the public 404 and
  the error page sit in the site scope (`data-surface="site"` on `<html>`,
  chosen by path with the same rule as the Content-Security-Policy), which
  sets `color-scheme: light`. Items 1-12 followed the device; Pro's dark mode
  (item 20) turns it back on per site.

## Navigation map

**Habre - signed out:** Sign up (the front door: email, password, site
address), Sign in, Forgot password. One centred form; from 1024px a panel
beside it says what you get.

**Onboarding `/start`:** a full-screen flow, Habre's logo only, three real
URLs so Back works: 1 What do you want to create? (Website, Blog, Business,
Portfolio) - 2 Tell us about it - 3 Make it yours (optional: logo, brand
colour, style; Skip keeps the AI's colour and Modern). Step 1 offers "Start
blank instead".

**Admin shell** (sidebar from 769px; a top bar with Menu below that):
- Site card: name, address, View site
- **Home, Pages, Blog, Media, Messages, Settings** - and **Users** when the
  site is on Pro (D166)
- Account menu at the foot, under the person's name and plan: **Your
  account, Plan, Sign out**

**Editor:** full screen, no sidebar; Back returns to Pages or Blog. Same
editor for pages and posts.

**A customer's site:** the owner's menu in the header (logo or wordmark on the
left, links on the right; a Menu button on a phone), footer with their line
and "Made with Habre".

## Screens

Checklist section 2, for this product. **Mocked** = in `prototypes/`.

| Screen | | |
|---|---|---|
| Sign up | applies | **mocked** (`signup.html`), with the address-taken error and suggestions |
| Check your email, then the emailed link signs you in (D161) | applies | item 15; the signup layout |
| Sign in | applies | item 15; the signup layout. Its error never says which half was wrong |
| Sign out | applies | account menu, every signed-in page |
| Forgot password -> email -> reset -> signed in | applies | item 15; the signup layout |
| Session expired -> sign in -> back where you were | applies | existing behaviour, kept |
| Not allowed (403) | **not applicable** | a refusal is a 404 by design (D69) |
| Your account: name, email, password, delete account | applies | deferred to item 15 - public signup makes delete-account a requirement |
| Plan | applies | deferred to item 21 (Stripe's hosted pages, D160) |
| First run | applies | **mocked**: onboarding (`start.html`, `start-brand.html`) and Home straight after the AI draft (`home.html`) |
| The AI drafting your site (a wait of seconds to a minute) | applies | **deferred to item 18** - mock it in that item's spec: what is happening, no dead spinner, what to do if it fails |
| Home (state, next steps, this month's allowance) | applies | **mocked** (`home.html`) |
| Pages, Blog lists, with search, filter, pagination | applies | conventions carried over (below); the kit's table |
| Editor | applies | **mocked**, two states (`editor.html`) |
| Media | applies | carried over (below) |
| Messages (contact form submissions) | applies | deferred to item 19; the kit's list and empty state |
| Settings: name, address, logo, brand colour, style, home page, menu, SEO defaults, level, dark mode (Pro) | applies | deferred to items 16-20; the kit's form; brand colour and style reuse `start-brand.html`'s controls |
| Users | applies, Pro only | carried over from item 8 |
| Not found (404), on Habre and on a site | applies | the kit's `.error-page`, in each scope; not re-mocked |
| Something went wrong (500) | applies | the kit's `.error-page`; no stack trace |
| Loading, empty, error, success for every list and action | applies | conventions carried over (below) |
| Unique page titles | applies | `<screen> - <site> - Habre` in the admin; the page's own title on a site |
| A customer site's home page | applies | **mocked** (`site-home.html`) |
| Footer privacy, terms, contact (Habre's own pages) | applies | blocked on terms of service and a privacy policy (`needs-you.md`) |
| Social and search metadata | applies | item 17 |
| Readable measure | applies | `--size-measure` 68ch for running text |
| Safe areas, offline, platform back | **not applicable** for safe areas and offline - a server-rendered web app, not an installed one; back applies and works (real URLs, including onboarding's steps) |

## Journeys

`spec` turns each into done-whens for the item that builds it.

1. **The first two minutes:** Sign up -> emailed link -> What do you want to
   create? -> Tell us about it -> Make it yours (or Skip) -> the AI drafts ->
   Home, "Your website is ready" -> Preview -> Publish website. (items 15, 18)
2. **Edit and publish:** Home -> Edit the home page -> drag a block in ->
   change its text -> Publish -> View site shows it. (item 14)
3. **Move a block without dragging:** select it -> Move up / Move down -> the
   new position is announced; or focus a palette tile -> Enter -> the block is
   added after the selected one. (item 14, WCAG 2.5.7)
4. **Choose the main heading:** select a heading -> Text style -> Main heading
   -> the previous main heading becomes a Heading, and that is announced; a
   page with none shows its title. (item 14)
5. **Make it yours later:** Settings -> brand colour or style -> the preview
   changes -> Save -> the site changes. (item 18)
6. Signed out -> a protected page -> sign in -> that page.
7. Reset your own password -> what happens to your session -> where you end up.
8. Submit a form with an error (sign up, a contact form) -> the error beside
   the field, your input kept.
9. Delete something -> confirmation naming it -> back to the list with its
   filters.
10. A visitor sends the contact form -> it appears in Messages and by email.
    (item 19)
11. **Switch Pro -> Simple:** every page still renders; Pro-only settings lock;
    text stays editable. (D166, item 20)
12. Change another user's role (Pro) -> what they see on their next request.

## Editor decisions (D165-D167, 2026-10-02 review)

- **Palette** (owner, 2026-10-02): blocks **Text, Heading, List, Image,
  Button, Quote, Line, Space**, and **Contact form** from item 19; sections
  **Blank section, Hero, Image and text, Call to action**. Drag a tile into a
  column, or focus it and press Enter to add it after the selected block. It
  collapses to a rail of icons whose names stay as accessible names.
- **Page structure:** sections of one to three columns; columns hold blocks
  top to bottom. A heading across three columns is a one-column section above
  them. **Columns stack when their container is narrower than 40rem** - a
  container query, so the canvas and the published site behave identically.
- **Dragging:** a gap opens where the block will land, labelled "Drop image
  here", a ghost follows the pointer, and a live region says where it will
  drop ("Image. Drop at the top of column 2, Portraits, in section 3.").
- **The selected block** gets a 2px rust ring and an inverted toolbar above
  it: drag handle, **Move up, Move down** (always there), the Text style menu
  and Bold, Italic, Link for text, then Duplicate and Delete. On a phone the
  toolbar wraps rather than running off the screen.
- **Text style menu:** Text, **Main heading**, Heading, Subheading, Small
  heading - each shown at its own size. Pro adds two smaller headings
  (H5-H6). **The person chooses the main heading** (owner, 2026-10-02): one
  per page, rendered as the page's `h1`. A hero's heading starts as the main
  heading; a page with none shows its title as the `h1` (D166, amended).
- **Settings panel** only for a block that has settings - button, image,
  contact form, a section (its columns) - never for text, which is edited
  where it sits. 17rem on the right; a bottom sheet below 1024px.
- **Section controls:** a rust chip on the section being edited - "Section 1
  of 5", Move section up/down, Section settings - at its foot below 40rem.
- **The canvas is the customer's site**, drawn in its scope with its brand
  colour and preset, light even inside dark Habre. Only the chrome is rust.
- **Phone:** the palette sits behind an Add button in the top bar.

## Components in use

**From the kit, unchanged apart from tokens:** buttons (primary, secondary,
ghost, icon, sm, lg), field, input, select, textarea, choice and switch,
alert, badge, card, table, list, menu, dialog, tabs, topbar, nav, sidebar,
mobile menu, site footer, empty state, error page, skeleton, spinner, toast,
tooltip, avatar, breadcrumbs, pagination, skip link, visually hidden. Nothing in
the kit's own rules was changed, **except the current nav entry** (item 13b,
F-143): it is also semibold with a 3px `--color-primary` bar on its start edge,
because the rust and the muted grey are ~1.03:1 apart in dark mode and colour
alone did not show which page was current (WCAG 1.4.1).

**Added** (the "Habre additions" block at the end of `components.css`):

- **Brand** - Habre's logo lockup (the mark is a placeholder until the red
  panda logo exists) and the ringed-tail band, decorative only.
- **Sign-up layout** (`.auth`), **address field with a fixed suffix**
  (`.input-group`), an available-address line (`.field__ok`).
- **Onboarding** - `.flow`, step bars, **radio buttons as large cards**
  (`.choice-card`; the real input stays inside, focus and checked drawn with
  `:has()`).
- **Admin Home** - site card, account button, page header, "ready" panel with
  a half-size site preview, suggestion links, usage meter.
- **Sections and columns** - `.page-flow` (the container), `.sec`, `.cols`,
  `.col`; shared by the canvas and the site.
- **Blocks** - `.display`, `.lede`, `.quote`, `.rule`, `.spacer`, and a photo
  stand-in; `.site-brand` and `.wordmark`.
- **Editor** - bar, palette and tiles, canvas, section chip, block outline
  (`.blk`), drop gap, drag ghost, block toolbar, text style menu, Add a
  section, settings panel.
- **Make it yours** - two-column step with a sticky preview, logo drop,
  **colour swatches as radio buttons** (44px, ringed in `--color-text` when
  chosen, named for screen readers), **preset cards** that draw each preset in
  the site's scope, half-size live preview.
- **Mockup-only, never ported:** the light/dark toggle and the editor's state
  switch.

## Conventions carried over from 2026-09-15

These describe behaviour, not the look, and still hold. Full text in the old
record (`git show 1d58e42:blueprint/context/design.md`).

- **Pending:** the submitting button gets `aria-busy="true"` and `disabled`,
  and its label becomes the verb in progress ("Publishing…"). No full-page
  spinners or skeletons for server-rendered pages.
- **Empty:** a panel naming the next action, one sentence, the single primary
  button. A search with no matches is one muted line, not the empty state.
- **Errors:** a form or action failure is a banner, `role="alert"`, saying what
  happened and what to do; never blames, never shows codes. A field error sits
  below the field, `aria-invalid` and `aria-describedby`, input kept. Sign-in
  marks no field.
- **Success:** a banner, `role="status"`, on the page the action returns to.
- **At most one primary button per view.** Destructive actions confirm on
  their own page, naming the thing, then return to the list with a success
  banner (item 3's pattern).
- **Lists:** title links, filter tabs with counts, search, Previous/Next past
  20, all plain GET so they work without JavaScript.
- **Media and the image picker:** a thumbnail grid; alt text captured once at
  upload (D55); the picker is a native `<dialog>`; a deleted image shows "This
  image is no longer available." with a way to replace it.
- **Words:** plain language, no CMS jargon - "Web address" not "slug", "Last
  changed" not "Modified". **Sign up, Sign in, Sign out** - this replaces the
  old record's "Log in", so the three account words match now that there is a
  sign-up.

## Accessibility bar

- **Standard: WCAG 2.2 level AA** - the bar `quality-bar.md` defers to, and
  `review` enforces.
- **Checked in the mockups, 2026-10-02:**
  - Contrast in every scope and scheme - the table above; `contrast.mjs`
    reports no failures.
  - Focus: a 2px `--color-focus-ring` outline with offset; swatches and cards
    draw it from the hidden input with `:has(:focus-visible)`.
  - Targets: default controls 44px, swatches 44px, toolbar and chip buttons
    36px (above the 24px minimum, 2.5.8).
  - **Dragging has a single-pointer alternative** (2.5.7): Move up / Move down
    on every block and section, Enter on a palette tile; the drop position is
    announced.
  - Every input has a visible label; colour is never the only signal (swatches
    are named, badges carry words, links in text are underlined).
  - Layout at 390px and 1280px, light and dark, from Chromium screenshots
    (`shoot.mjs`): no horizontal scroll, no zero-size icon, fonts loaded.
- **Not checked - needs a person or the real app** (`needs-you.md`):
  keyboard-only walkthrough and focus order, screen-reader output (the drag
  announcements, the text style menu, the swatches), 200% zoom and reflow at
  320px, reduced motion, the colour picker.

## Open

- Preset names; the platform logo (placeholder "h" mark until then).
