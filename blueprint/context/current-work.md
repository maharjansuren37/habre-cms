# Feature: The new look

**From build plan:** item 13b
**Type:** Feature
**Verified:** not yet
**Reviewed:** not yet

## Goal

Put `design.md`'s 2026-10-02 redesign on the screens that exist today: Habre's
tokens, Inter served from our own host, the rust admin, and public sites in the
neutral site scope, **light only** (D168). Done before item 14 so the new editor
is themed once, not twice.

## In scope

- `app/app.css` takes `prototypes/theme.css`'s primitives (rust, stone,
  crimson, ochre, green, blue, neutral) and roles for Habre's screens, light
  and dark, following the device as today.
- The token renames `design.md` lists, plus two this item needs (Decisions).
- Inter Variable (latin, woff2) and its OFL licence, self-hosted under
  `app/fonts/`, loaded through `app.css` so Vite fingerprints it into
  `/assets/` (cached immutable by `server.js`).
- The customer-site scope `[data-surface="site"]` on every public page,
  including the public 404 and error page: neutral ink, Modern's font and
  corners (Inter, 4 / 8 / 12px), `color-scheme: light`.
- Every existing screen restyled to `prototypes/components.css` using role
  tokens only: login, the admin shell, posts and pages lists, delete
  confirmations, the post and page editors (Editor.js chrome, sections
  editor, image tool), media, settings with the logo picker, users; the
  public home, post list, post and page (sections, hero, image and text,
  call to action).
- Contrast proved on the real app by a browser test, and `design.md` updated
  to say the shipped app now has this look.

## Out of scope

- **Words and structure stay as they are.** "Log in" becomes "Sign in" with
  sign-up (item 15). The new sidebar entries (Home, Blog, Messages), the
  site card, the account menu and admin Home: items 15-19. Page titles keep
  their current form.
- The 40rem container query for columns, and `--color-selection`: item 14a.
- The kit's Menu button for the admin shell on a phone: with the new shell.
- The editor canvas in the site scope, the palette, block toolbar and
  section chip: item 14 (Editor.js is replaced there).
- Brand colour (`[data-brand]`), the Classic and Friendly presets and their
  fonts (`[data-style]`), the wordmark: item 18a.
- Pro's dark mode for sites (`[data-dark="auto"]`): item 20.
- Sign-up, onboarding and the Habre logo lockup: items 15 and 18.
- Vite, Biome and other patch upgrades (parked at item 13).

## Design reference

- Tokens: `prototypes/theme.css`. Components: `prototypes/components.css`,
  all of them drawn in `prototypes/components.html` in both scopes.
- Screens to hold it against: `prototypes/home.html` (admin shell, sidebar,
  buttons, cards, light and dark), `prototypes/site-home.html` (a published
  site), `prototypes/editor.html` (the editor's bar only - its canvas is
  item 14).
- Rules: `blueprint/context/design.md` - *Token changes*, *Measured contrast*,
  *Components in use*, *Conventions carried over*, *Accessibility bar*.
- Screenshots for review: `prototypes/checks/shoot.mjs` pattern - Chromium at
  390px and 1280px, light and dark.

## Build steps

- [x] **Step 1 - Rename the tokens, no visual change** - in `app/app.css`
      and every `*.module.css`: `--color-accent*` -> `--color-primary*`
      (`-hover`, `-subtle`, `--color-on-accent` -> `--color-on-primary`),
      `--color-focus` -> `--color-focus-ring`, `--color-border-control` ->
      `--color-border-strong`, `--font-sans` -> `--font-family-sans`,
      `--control-height` -> `--size-control-md`, `--measure` ->
      `--size-measure`. Values unchanged. *Done when:* `grep -rnE
      -- "--(color-accent|color-on-accent|color-border-control|font-sans|control-height|measure)\b|--color-focus([^-]|$)"
      app` prints nothing; `npm run verify` passes; `npm run test:e2e` passes
      with the same count as before the step.
- [x] **Step 2 - Habre's tokens and Inter** - `app.css` gets theme.css's
      primitives and Habre's roles as `light-dark()` pairs (Decisions),
      `--font-family-heading`, radii 6 / 10 / 16px, controls 36 / 44 / 52px,
      warm shadows, motion tokens with the reduced-motion override,
      `--size-measure: 68ch`. `app/fonts/inter-latin-wght-normal.woff2` and
      `inter-LICENSE.txt` from `prototypes/fonts/`, one `@font-face`
      (`font-display: swap`). New `e2e/theme.spec.ts`. *Done when:*
      `e2e/theme.spec.ts` shows, on `/admin/login`: body background
      `rgb(251, 248, 244)` in light and `rgb(24, 17, 13)` in dark
      (`colorScheme` emulation); `document.fonts.check('16px "Inter
      Variable"')` true after `document.fonts.ready`; the font response's URL
      is on the app's own origin under `/assets/`; no request leaves the
      origin for a font. `npm run verify` and `npm run test:e2e` pass.
- [x] **Step 3 - Public sites in the site scope, light only** -
      `[data-surface="site"]` in `app.css` sets every role from the neutral
      greys, `color-scheme: light`, and Modern's font and radii. The root
      `Layout` puts `data-surface="site"` on `<html>` for every path that is
      not admin (the split `areaForPath` already makes), so the body, the
      public 404 and the error page are inside it. *Done when:*
      `e2e/theme.spec.ts`, with the device in **dark**: the public home and a
      missing public URL (404) have `<html data-surface="site">`, computed
      `color-scheme` `light`, body background `rgb(255, 255, 255)`; an admin
      page under the same emulation keeps `rgb(24, 17, 13)`.
- [x] **Step 4 - Contrast proved on the real app** - `e2e/contrast.spec.ts`
      resolves each role on a probe element (computed `color`, so
      `light-dark()` is resolved by the browser) and asserts the pairs of
      `prototypes/checks/contrast.mjs` at their minimums (4.5 or 3), less the
      two selection pairs - `--color-selection` is editor chrome and arrives
      with item 14, which adds its pairs to this spec: Habre's scope in light and
      dark, the site scope in light, and the site scope with the device dark.
      *Done when:* the spec passes and prints the measured table; changing
      `--stone-600` to a lighter grey makes it fail (seen once, reverted).
- [x] **Step 5 - Shared controls, login and the admin shell** -
      `app/lib/ui/button`, `field`, `message` modules to the kit's button
      (primary, secondary, ghost, danger; 44px), field and alert; the admin
      shell to the kit's sidebar, the current page's entry marked in rust,
      keeping its current narrow-screen behaviour (the kit's Menu button
      comes with the new shell, items 15-19); the login screen to the
      sign-up layout's centred form (`.auth`). Markup changes only where a
      kit class needs a wrapper; landmarks, labels and words unchanged.
      *Done when:* screenshots of `/admin/login` and `/admin/posts` at 390px
      and 1280px, light and dark, are shown at review; at 390px
      `document.documentElement.scrollWidth <= clientWidth` on both (in
      `e2e/theme.spec.ts`); keyboard focus on a nav link and a button shows
      the 2px focus ring (existing outline assertions still pass); journey 6
      (signed out -> protected page -> sign in -> that page) still passes in
      `auth.spec.ts` ("logging in from a protected page returns to that
      page"); the full browser suite passes.
- [x] **Step 6 - Admin lists, media, users and delete screens** -
      `entry-list`, `entry-delete`, `media-list`, `media-delete`,
      `user-list` modules to the kit's table, tabs, badge, pagination, empty
      state, card grid (media) and confirmation layout. *Done when:*
      screenshots of the posts list, media grid, users list and a delete
      confirmation at 390px and 1280px, light and dark, are shown at review;
      no horizontal scroll at 390px on each (in `e2e/theme.spec.ts`); journey 9
      (delete -> confirmation naming it -> back to the list with its filters)
      still passes in `manage-pages.spec.ts` ("deleting or canceling from a
      filtered, searched list returns to it"); the full browser suite passes.
- [x] **Step 7 - Admin forms** - `settings`, `logo-picker`, `user-form`
      modules: the kit's fields, select, choice and dialog. *Done when:*
      screenshots of the settings form with the logo picker open and the
      edit-user screen, at 390px and 1280px, light and dark, are shown at
      review; no horizontal scroll at 390px on settings (in
      `e2e/theme.spec.ts`); the full browser suite passes.
- [x] **Step 8 - The editors** - `entry-form`, `sections-editor`,
      `image-tool` modules: the editor bar from `editor.html`, the kit's
      fields, and Editor.js's own chrome (toolbox, inline toolbar, popovers)
      in role tokens. *Done when:* screenshots of the post editor and a page
      editor with two sections, at 390px and 1280px, light and dark, are
      shown at review; no horizontal scroll at 390px on the post editor (in
      `e2e/theme.spec.ts`); `inline-formatting.spec.ts`'s focus-outline
      assertions and the full browser suite pass.
- [ ] **Step 9 - The public pages** - `public-site/layout`, `post-list`,
      `post`, `page-body` modules to `components.css`'s site header, footer,
      sections and columns at today's breakpoints (the 40rem container query
      comes with 14a's renderer, which replaces this one), `.display`,
      `.lede`, `.quote`, `.rule`, `.spacer`, buttons as links, and
      `--size-measure` for running text. Elements unchanged (a button block
      stays an `a`). *Done when:* screenshots of the home page, a post and a
      page with a hero, image and text and a call to action, at 390px and
      1280px with the device light and dark (both must look the same), are
      shown at review; no horizontal scroll at 390px; the full browser suite
      passes.
- [ ] **Step 10 - The record** - `design.md`: the header note says the
      shipped app has this look (drop the "measured against the old record"
      rule), *Open*'s D168 line moves into *Customer sites* as done, the
      measured table notes it is now also proved by `e2e/contrast.spec.ts`.
      *Done when:* `npm run verify` passes, and `npm run test:e2e` locally
      with real R2 reports every test passed (155 before this item, plus the
      new specs), and `npm run test:e2e` with `E2E_SKIP_R2=1` passes as CI
      runs it.

## Files and areas

- `app/app.css` - tokens, `@font-face`, the site scope (steps 1-3).
- `app/fonts/` - new: Inter woff2 and its licence (step 2).
- `app/root.tsx` - `data-surface` on `<html>` for public paths (step 3);
  imports the area rule from wherever `areaForPath` lives, not a copy.
- `app/lib/ui/*.module.css`, `app/features/*/**.module.css` - every module
  (steps 1, 5-9). TSX only where a kit class needs a wrapper element.
- `e2e/theme.spec.ts`, `e2e/contrast.spec.ts` - new (steps 2-9).
- `blueprint/context/design.md` (step 10).

## Data and contracts

None stored. Load-bearing for items 14-20: **the role token names**
(`--color-primary`, `-hover`, `-subtle`, `--color-on-primary`,
`--color-focus-ring`, `--color-border-strong`, `--font-family-sans`,
`--font-family-heading`, `--size-control-*`, `--size-measure`) and **the
scope attribute `data-surface="site"` on `<html>` for public pages**, which
item 14's canvas, 18a's `data-brand` / `data-style` and 20's `data-dark`
layer onto.

## Testing

- `npm run verify` (CI `verify` job) - typecheck, lint, unit, build. No new
  unit tests: this item is CSS and one attribute.
- `npm run test:e2e` - the new `theme.spec.ts` and `contrast.spec.ts` need the
  development database (as every browser test does) and **no R2**, so they
  run in CI's `e2e` job too. The full suite with real R2 runs locally only
  (`needs-you.md`).
- Screenshots for each visual step, taken with Playwright against the
  production build, shown at the step's review.

## Decisions

- **Roles stay `light-dark()` pairs switched by `color-scheme`**, rather than
  theme.css's duplicated `@media` and `[data-theme]` blocks. One line per
  role; the site scope is light by setting `color-scheme: light`, and item 20
  turns dark on by setting `light dark`. The `data-theme` toggle was
  mockup-only (design.md). Beat: porting theme.css's three blocks verbatim.
- **The app keeps its own spacing and type scales** (`--space-1..8`,
  `--text-*`). The kit numbers spacing differently (its `--space-5` is
  1.25rem, ours 1.5rem), so adopting its names would silently change every
  gap. Renamed only what design.md lists plus `--control-height` ->
  `--size-control-md` and `--measure` -> `--size-measure`, whose values the
  redesign changes. Beat: adopting the kit's whole token set.
- **The site scope sits on `<html>`, chosen by path** with the same rule the
  Content-Security-Policy uses, so the body background, scrollbars and the
  public error pages are light too. Beat: a wrapper `div` in the public
  layout, which leaves the body dark and misses the root error boundary.
- **Fonts are imported through CSS from `app/fonts/`**, so they are hashed
  and cached immutable like every other asset. Beat: `public/fonts/`,
  cached for an hour under a fixed name.
- **Contrast is proved by a browser test on the real app**, since
  `prototypes/` is deleted when this item ships. Beat: keeping the
  prototype script.

- **Kept `--font-mono` and `--duration-fast`** (theme.css: `--font-family-mono`,
  `--motion-duration-fast`), since modules already use them; the kit's
  `--motion-*` tokens sit beside them and the reduced-motion override zeroes
  both. Added roles `--color-info`, `--color-info-subtle`, `--color-overlay`.
  One `--shadow-*` value for both schemes, as theme.css has. (Step 2)

## Production needs

None. No variables, no migrations; the font is a build asset. Production holds
on `8d82ce4` until v1 (D163).

## Behaviour changes

Written against `blueprint/capabilities/` (`entry-lists`, `public-site`,
`settings`); this item changes none of their claims.

- Adds to `public-site`: public pages, the public 404 and the error page are
  light whatever the device's setting (D168; items 1-12 followed the device,
  never recorded as a claim) - Step 3
- New capability `appearance`: Habre's admin and login follow the device's
  light or dark setting, in the warm stone and rust colours - Step 2
- Adds to `appearance`: text is set in Inter, served from the app's own
  origin; no font request goes to a third party - Step 2
- Adds to `appearance`: every colour pair in the admin and on the public site
  meets WCAG 2.2 AA contrast, proved by `e2e/contrast.spec.ts` - Step 4
- Adds to `appearance`: at 390px no admin or public screen scrolls
  sideways - Steps 5-9

## Notes

- Role tokens only inside modules; no hex values outside `app.css`.
  `components.css` is the reference, not a file to copy (design.md).
- **Do not change a colour without re-running `contrast.spec.ts`**.
- CSP stays as it is: `font-src 'self'`, public `style-src 'self'` - this item
  adds no inline style.
- Semantic HTML (coding-standards) is unchanged: restyling never swaps an
  element for a `div`. Existing `toHaveCSS` assertions (outline 2px, centred
  hero) must keep passing.
- Disabled controls are exempt from contrast (1.4.3) and are the only thing
  below the bar.
- The public error page (500) is in the site scope by the same `Layout`
  rule as the 404; it is not provoked in a test, since nothing reaches it on
  purpose. Step 3's 404 check covers the rule.
- F-29 (the editor's writing area has no accessible name) stays deferred to
  14a; this item does not touch it.
- `prototypes/` is deleted by `ship` once this look is built (design.md);
  everything this item needs from it is copied in by then.
