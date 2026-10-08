# Feature: Make it yours as step 3

**From build plan:** item 18b5
**Type:** Feature
**Verified:** not yet
**Reviewed:** not yet

## Goal

Onboarding gets its optional third step (D167). After Build my site starts
the run, the person lands on **Make it yours** - a logo, a brand colour (the
logo's, the AI's or their own) and a style, with a live preview - while the
AI works. **Finish** saves what they chose, **Skip for now** saves nothing,
and both go on to the run's page. Journey 1 then reads as `design.md` has it.

## In scope

- **Step 3 at `/start/:runId/brand`**, under the onboarding layout (so its
  gate, admins only, applies), for this site's run in any state but
  `applied` (the gate already sends a site with an applied run to `/admin`).
  "Step 3 of 3", `h1` Make it yours, lede "Optional. You can change all of
  this later in Settings.", the mock's two columns with a sticky preview from
  1024px, one column below.
- **The same Logo, Brand colour and Style controls and preview as Settings**,
  extracted from `settings.tsx` into one shared component, not copied.
- **A "Let the AI choose" swatch** in step 3's colour row: checked when the
  site has no colour; it shows the AI's colour (named, like a logo swatch)
  when the run has already succeeded with one, otherwise a dashed ring and
  "Let the AI choose" with no colour in the preview. Choosing it saves `''`,
  which Use this draft then fills.
- **Finish** (primary, busy "Saving…") posts the logo, colour and style;
  they are written in one transaction, then `/start/:runId`. **Skip for now**
  is a link to `/start/:runId` and writes nothing.
- **Build my site** redirects to step 3 instead of the run's page. The steps
  read **of 3** (D408): step 1 "Step 1 of 3", step 2 "Step 2 of 3".
- **Use this draft writes the AI's colour whenever the site has none**, with
  or without a logo - step 3 is now where the person says whether they want
  it (supersedes D417's logo condition).
- `design.md` records step 3 as built.

## Out of scope

- **Back on step 3** - cut (Decisions): the run has already started, and
  step 2 sends a running site to the run's page (onboarding.8). The wait's
  Change the description is the way to a new description.
- **The AI swatch updating while step 3 is open** - no polling here; it shows
  the colour only if the run had succeeded when the page loaded. The review
  shows the colour that will be applied either way.
- **No colour in step 3** - Settings keeps it (Decisions).
- The AI suggesting a style - not planned; the default stays Modern.
- Removing a logo uploaded on step 3 and then skipped from the library: it
  stays in Media, as an upload in Settings without Save does today.

## Design reference

- `prototypes/start-brand.html` - the step's layout, fieldsets, swatches,
  preset cards and preview. Tokens are already ported (items 13b, 18a1).
- Differs from the mock, recorded in `design.md` by Step 5: no Back; Skip for
  now is a link (it goes somewhere, D169's rule for buttons); the colour row
  starts with Let the AI choose; the Logo field keeps Settings' Choose from
  the library.
- Settings' built Brand section (`app/features/settings/settings.tsx`) is the
  behaviour reference: brand-swatches rules, brand.9 and brand.10.

## Build steps

- [x] **Step 1 - One Brand section for Settings and step 3** - move the
  Logo field, the Brand colour row, Style and the preview out of
  `settings.tsx` into `app/features/settings/brand-fields.tsx` (its classes
  into `brand-fields.module.css`), taking the saved values, the site title
  and the form's submitted values as props and owning the colour choice and
  preview state. Settings renders it in the same place; no behaviour change.
  *Done when:* `e2e/brand.spec.ts`, `e2e/logo.spec.ts` and
  `e2e/manage-settings.spec.ts` pass unchanged (locally, with R2, so the
  logo tests run); `npm run verify` passes; Settings at 1280 and 390 matches
  a screenshot taken before the move.
- [x] **Step 2 - Use this draft writes the AI's colour whenever none is
  set** - `planApply` drops `hasLogo` (`ApplySite` loses it; `applyRun` and
  the wait's loader stop reading the logo). *Done when:* an `apply-plan`
  unit test shows a site with a logo and no colour gets the proposal's
  colour, and one with a colour keeps it (`npm test`, inside `verify`); a
  browser test in `e2e/onboarding.spec.ts`'s use-this-draft block sets a
  logo row by the owner URL, applies, and finds the proposal's colour saved
  and listed in the review first (no R2 needed - the media row is inserted,
  never uploaded).
- [x] **Step 3 - The Let the AI choose swatch** - `brandSwatches` gains an
  `ai` kind (value `''`, carrying the AI's colour or none) offered only when
  asked for, replacing No colour in that row; `choiceColour` and
  `choiceAfterLogoChange` handle it (a logo change keeps it chosen, brand.10).
  The shared component takes an `aiColour` prop (`undefined` = Settings, no
  AI swatch) and renders it: named "Let the AI choose" or "<colour word>,
  suggested by AI", a dashed ring when there is no colour yet. *Done when:*
  `brand-swatches` unit tests cover the row with and without the AI's colour,
  a logo change keeping it, and that Settings' row is unchanged (`npm test`).
- [ ] **Step 4 - Make it yours, saved or skipped** - the route
  `start/:runId/brand` (`start-brand.tsx`): the loader finds this site's run
  (Not Found otherwise, like the wait), reads the settings and, for a
  succeeded run whose result parses, the proposal's colour; the action
  validates with `brandColorSchema`, `stylePresetSchema` and
  `logoMediaIdSchema`, checks the logo is this site's media, writes all three
  with a new `saveBrandStep` in `settings.server.ts` (one `inSite`
  transaction, `logo-gone` on the foreign key, as Settings), then redirects to
  `/start/:runId`; a refusal is a `role="alert"` banner with the choices kept.
  Step 2's action redirects to step 3; steps 1 and 2 read "of 3".
  `onboarding.module.css` gains the wide two-column main. *Done when:*
  browser tests in `e2e/onboarding.spec.ts`: Build my site lands on
  `/start/<id>/brand` showing Step 3 of 3 and the heading; Finish with a
  colour from Other colour and Friendly saves both and opens the run's page;
  Skip for now saves nothing (the settings row unchanged); a succeeded run's
  step 3 shows its colour named "suggested by AI" and checked; a running
  run's shows Let the AI choose, and Finish with it leaves `brand_color` `''`;
  another site's run and a non-uuid are Not Found; a POST for a site with a
  published page changes nothing (the gate); an invalid colour posted by hand
  is refused with the banner. Uploading a logo on step 3 and Finish sets it
  as the logo, behind `test.skip(skipWithoutStorage)` (local only, like every
  R2 test). All run by `npm run test:e2e` locally and in CI's `e2e` job,
  except the logo test, which CI skips.
- [ ] **Step 5 - Journey 1 through step 3, the phone, and the record** - a
  browser test walks journey 1 with the fake provider: Confirm my email ->
  step 1 -> step 2 -> Make it yours -> choose Classic and Finish -> the
  review -> Use this draft -> Home -> Preview shows the Classic style ->
  Publish website -> View your site, checking each URL, once by full page
  loads and once through the app's own links; a second run ends Skip for now
  and the site gets Modern and the AI's colour. Step 3 has no horizontal
  scroll at 390px, its swatches and preset cards are radios reachable and
  checkable by keyboard alone, and its large buttons are 52px tall (F-366's
  check). `design.md` records step 3 as built, with the differences from the
  mock above. *Done when:* those tests pass in `npm run test:e2e` (locally and
  in CI's `e2e`); Finish answers in **under 1 s** (the quality bar's admin
  saves), measured in `verify` over three local samples and reported, not
  asserted in CI (F-376); screenshots at 1280 and 390, light and dark.

## Files and areas

- `app/features/settings/settings.tsx`, `settings.module.css` - Brand
  section moved out (Step 1)
- `app/features/settings/brand-fields.tsx`, `brand-fields.module.css` - new,
  the shared Brand section (Steps 1, 3)
- `app/features/settings/brand-swatches.ts` (+ test) - the `ai` kind (Step 3)
- `app/features/settings/settings.server.ts` - `saveBrandStep` (Step 4)
- `app/features/ai/apply-plan.ts` (+ test), `apply-run.server.ts` - colour
  rule (Step 2)
- `app/features/onboarding/start-brand.tsx` - new route (Step 4);
  `start-about.tsx` - redirect, "of 3"; `start.tsx` - "of 3";
  `start-wait.tsx` - loader drops `hasLogo`; `onboarding.module.css` - wide
  main
- `app/routes.ts` - `start/:runId/brand`
- `e2e/onboarding.spec.ts` - Steps 2, 4, 5
- `blueprint/context/design.md` - Step 5

## Data and contracts

- **No migration.** Step 3 writes `site_settings.logo_media_id`,
  `brand_color` and `style_preset`, existing columns.
- **`brand_color = ''` after step 3 means "the AI's colour, if it suggests
  one"** until Use this draft runs; afterwards it means No colour, as before.
- `POST /start/:runId/brand`: form fields `logoMediaId` (uuid or empty),
  `brandColor` (`''` or `#rrggbb`), `stylePreset`
  (`classic` | `modern` | `friendly`) - the names Settings' form already uses.
  303 to `/start/:runId`, or 400 with `{ problem, values }`.
- `ApplySite` loses `hasLogo` (load-bearing for the review and apply, which
  share it).
- `Swatch.kind` gains `"ai"`.

## Testing

- **Unit** (`npm test`, inside `verify`, runs in CI): `apply-plan.test.ts`,
  `brand-swatches.test.ts`.
- **Browser** (`npm run test:e2e`, needs the development database; runs
  locally and in CI's `e2e`): `e2e/onboarding.spec.ts` with the test-only
  `fake` provider and runs inserted as the owner, as 18b3-18b4b's tests do.
  The step 3 logo upload test needs R2 and runs **only locally**
  (`skipWithoutStorage`). Step 1's proof is the existing brand, logo and
  settings specs passing unchanged, run locally with R2.
- **Timing:** Finish under 1 s, measured in `verify`, not asserted in CI.

## Decisions

- **Step 3 is `/start/:runId/brand`, reached after the run starts** - beat
  `/start/brand` before the run (the AI would wait on a step the person may
  take minutes over) and a query string (a real path per step, Back works
  between them).
- **Step 3's colour row offers Let the AI choose instead of No colour;
  Use this draft writes the AI's colour whenever the site has none** -
  supersedes D417's "and there is no logo". Beat keeping the logo condition
  (a person who uploads a logo but keeps the AI's colour would silently get
  no colour) and a stored flag for "the AI's colour" (a migration for one
  case). Costs: a site that chose No colour in Settings, then comes back to
  onboarding, gets the AI's colour unless it picks another; No colour is in
  Settings afterwards.
- **No Back on step 3; Skip for now writes nothing** - beat the mock's Back
  (step 2 sends a running site to the run's page, so it would bounce) and a
  Skip that resets to Modern (it would undo a style saved in Settings after
  Start blank).
- **Settings and step 3 share one Brand component** - beat a copy of
  Settings' 200 lines, whose rules (brand-swatches, brand.10) would drift.

## Production needs

None - no environment variables, no migration, no new service.

## Behaviour changes

- Changes `onboarding.4` from "Build my site starts a run and opens its page, which shows the draft's review once it succeeds, without a reload" to "Build my site starts a run and opens Make it yours, whose Finish and Skip for now open the run's page, which shows the draft's review once it succeeds, without a reload" - Step 4
- Changes `onboarding.18` from "using a draft writes the site description only when it is empty, and the brand colour only when the site has no logo and no colour" to "using a draft writes the site description only when it is empty, and the brand colour only when the site has no colour" - Step 2
- Adds to `onboarding`: Make it yours' Finish saves the logo, brand colour and style chosen, and Skip for now saves none of them - Step 4
- Adds to `onboarding`: Make it yours offers Let the AI choose, checked when the site has no colour, named with the AI's colour once the run has suggested one - Step 4
- Adds to `onboarding`: another site's run's Make it yours is Not Found - Step 4
- Adds to `onboarding`: a new admin goes from Confirm my email through all three steps, the review, Use this draft and Preview to a published site in the style chosen on step 3 - Step 5

## Notes

- Colours reach swatches and the preview through the CSSOM
  (`setSwatchColour`, `applyBrandProperties`), never a `style` attribute: the
  admin's `style-src` has no `'unsafe-inline'`. The platform host's CSP covers
  `/start`.
- The proposal is untrusted (D-rules): only a result that parses with
  `proposalSchema` gives the AI swatch its colour; its value is already
  `#rrggbb`-checked there.
- The logo upload reuses `POST /admin/settings/logo` (admins only); an SVG is
  turned into a PNG in the browser (brand.8) - the Firefox and Safari check in
  `needs-you.md` covers step 3 too.
- Semantic HTML: the colour row and Style are `fieldset`/`legend` radio
  groups; Skip for now is an `a`; Finish a `button`; one `h1`.
- Match `start-about.tsx`'s pending pattern (`isPending`, verb in progress).
- `needs-you.md`'s admin screen-reader line is widened with step 3.
