# Feature: Your logo

**From build plan:** item 18a2
**Type:** Feature
**Verified:** 2026-10-07, 2cd655113ca9, 12 of 12 proven (Steps 1-7, the 390px repair, F-317, F-318, F-319-F-325, F-321/F-322 - `npm run verify` 696 unit tests passed; logo, manage-settings, contrast, media-optimise, storage-limit specs 45 passed with real R2, none skipped; `0019` check refused 4 colours, `#FFF`, `{''}`, a comma element and a 2-D array as the owner, accepted 3 valid); Firefox and Safari SVG conversion not verified - needs-you
**Reviewed:** 2026-10-07, 2cd655113ca9, current (through caf4ef2; this pass the repair commit), every lens (via reviewer) - 0 blocking; F-326 (P2), F-327, F-328 (P3) open

## Goal

A site owner uploads a logo straight from Settings - JPEG, PNG, WebP, GIF or
**SVG, turned into a PNG in the browser** so no SVG ever reaches the server
(D7, D167) - and Settings then offers up to three brand colours taken from the
logo, beside the swatches 18a1 built. This finishes 18a; 18b reuses the upload
and the swatches in onboarding's "Make it yours".

## In scope

- **`media.colours`** - up to three `#rrggbb` colours, counted from an image's
  pixels with `sharp` when it is uploaded, stored on its row.
- Our own palette rule (`app/features/brand/logo-colours.ts`, pure) and a
  colour word for each swatch's name ("Green").
- The upload pipeline moved out of Media's action into one shared server
  function, so Media and Settings store an image the same way (storage cap,
  sizes, R2 before the row).
- `POST /admin/settings/logo` - admin only, takes one image, answers JSON
  with the new media item.
- Settings' Logo field gains **Upload logo** (the mock's file input) beside
  Choose logo; an SVG is drawn into a canvas from a `blob:` URL in an `<img>`
  and sent as a PNG, 1200px on its longer side, transparency kept.
- The admin's `img-src` gains `blob:`; the public policy is unchanged.
- Brand colour: the logo's colours appended as swatches after the saved one,
  each named with its colour word and "from your logo"; the live preview
  follows them as it does every swatch.
- The media picker's answer and the Settings loader carry the logo's colours.

## Out of scope

- Onboarding's "Make it yours", preselecting the logo's main colour, and the
  AI-suggested colour - **18b**.
- SVG on the Media screen or in the image block: only the logo takes an SVG
  (plan section 3). Media's upload stays JPEG, PNG, WebP and GIF.
- Colours for images uploaded before this item: `optimise-media` does not
  backfill them. Production loses every media row at the v1 deploy anyway
  (`0012`); in development such a logo just offers no swatches.
- Colours from an animated GIF (stored as uploaded, never decoded).
- AI-generated logos - plan section 11 (D167).
- A dark-surface logo variant - item 20 (D168).

## Design reference

- `prototypes/start-brand.html` - the logo drop (thumbnail, file name, "Saved
  as a PNG for the web.", Replace, Remove), the hint "PNG, JPEG, WebP, GIF or
  SVG, up to 10 MB.", and the logo swatches ("Green, from your logo").
- `prototypes/components.css` - `.logo-drop`, `.swatch-radio`.
- design.md *Screens*, Settings row, and *Customer sites*.

**What the record does not cover** (added to design.md in Step 7):

- **Settings keeps both ways to set a logo:** Upload logo (a file input) and
  Choose logo (the library picker). With a logo set, they read Replace logo
  and Change logo, beside Remove logo.
- **Upload states:** the Upload button is `aria-busy` and disabled while
  sending; a refusal shows the server's message under the field (the Media
  screen's wording); "Saved as a PNG for the web." shows only after an SVG.
- **A chosen colour never moves by itself:** when the logo changes or goes,
  a selected logo colour that is no longer offered stays selected as Other
  colour with the same hex, so the preview never changes unasked.
- **Swatch names:** the visible text is the hex, as for the saved colour; the
  accessible name adds the colour word and "from your logo".

## Build steps

- [x] **Step 1 - `media.colours` migration** - `0019_media_colours.sql`:
  `colours text[] not null default '{}'`, checked to at most three values,
  each `#rrggbb` lowercase. Additive, no backfill. Run with `migrate`.
  *Done when:* `npm run db:migrate` applies it to the development database,
  a second run applies nothing, and an insert with a fourth colour or `#FFF`
  is refused by the check (shown with `psql` as the owner).

- [x] **Step 2 - the palette, counted at upload** - `logo-colours.ts`:
  `paletteFromPixels(rgba, width, height)` -> up to three `#rrggbb`, and
  `colourWord(hex)` -> a plain word (red, orange, yellow, green, teal, blue,
  purple, pink, brown, grey, black). Rule (recorded in Decisions, tuned here):
  skip pixels under 50% alpha and near-white ones (OKLCH L > 0.95); group the
  rest by OKLab distance; keep groups of at least 5% of counted pixels; each
  colour is its group's average; at most three, most-used first (ties: higher
  chroma). `optimiseImage` reads a 64px raw copy on the resized path and
  returns the colours; `insertMedia` stores them. *Done when:* `npm test`
  passes `logo-colours.test.ts` - the mock's logo colours (`#2f6b5a`,
  `#c9a25e` on white) give `["#2f6b5a", "#c9a25e"]` within one step per
  channel; a transparent-only or white-only image gives `[]`; a 2% speck is
  left out; four strong colours give three; each word in the table's grid -
  and `optimise-image.server.test.ts` shows a fixture PNG's resized result
  carrying its colours.

- [x] **Step 3 - one upload function, colours on the way out** - move the
  body of Media's action into `storeUpload(actor, file, altText)` in
  `app/features/media/` (`.server.ts`), returning the new item or a refusal
  with its status; Media's action calls it and keeps its redirects and
  messages. The picker's JSON and `PickedMedia` gain `colours`; the Settings
  loader gains `logoColours` from the same join that gives `logoUrl`.
  *Done when:* `npm run verify` passes, and locally (real R2)
  `e2e/media-optimise.spec.ts`, `e2e/storage-limit.spec.ts` and
  `e2e/manage-settings.spec.ts` pass unchanged; the picker's response for a
  new upload lists its colours (asserted in `e2e/logo.spec.ts`, new).

- [x] **Step 4 - Upload logo in Settings** - `app/features/settings/logo-upload.ts`
  (`POST /admin/settings/logo`, listed in `routes.ts`): `requireRole(["admin"])`,
  calls `storeUpload` with the alt text "<site title> logo", answers
  `{ media }` or `{ problem }` with the status. Settings' Logo field gains
  the file input (accept JPEG, PNG, WebP, GIF), which posts with `fetch`,
  shows the busy state and the refusal (a failed request: "The logo could
  not be uploaded. Try again."), and on success sets the logo as a pick does; Save settings still saves it. *Done when:* in
  `e2e/logo.spec.ts` (local, real R2; `test.skip(skipWithoutStorage)` in CI),
  an admin uploads a PNG fixture, sees it as the logo, saves, and the public
  header shows it, and it is in Media with storage used raised; an editor's
  `POST /admin/settings/logo` gets 404; a text file named `.png` shows "This
  file is not a JPEG, PNG, WebP or GIF image." and adds no media row; a site
  at its storage limit is refused with limits.1's message.

- [x] **Step 5 - SVG turned into a PNG** - a `.client.ts` helper: an SVG file
  is loaded through a `blob:` URL into an `<img>` (scripts never run, outside
  fonts and images never load), drawn to a canvas 1200px on its longer side
  (an SVG with only a `viewBox` uses its ratio), `toBlob("image/png")`, and
  sent under the same name. A file that fails to load shows "This SVG could
  not be read. Try a PNG instead." Admin `img-src` gains `blob:`; the hint and
  `accept` add SVG; "Saved as a PNG for the web." after an SVG. *Done when:*
  `npm test`'s `content-security-policy` test shows `blob:` in the admin's
  `img-src` and not the public's; `e2e/logo.spec.ts` (local) uploads an SVG
  fixture and the request Playwright sees carries `image/png` and no SVG
  bytes, the stored row is `image/webp` 1200px wide; an SVG fixture with a
  `<script>` and an `onload` sets no flag on `window` and still converts; a
  malformed SVG shows the message and sends nothing; and a raw SVG posted
  straight to `/admin/settings/logo` and to `/admin/media` is refused with no
  row added (CI-safe: refused before R2).

- [x] **Step 6 - colours from your logo** - a pure `brandSwatches(saved,
  logoColours, choice)` in `app/features/settings/` lists No colour, the
  saved colour, the logo's colours (a logo colour equal to the saved one
  shown once, as the logo's), then Other colour; Settings renders it, each
  dot coloured through `setSwatchColour`. Changing or removing the logo
  applies the "never moves by itself" rule. *Done when:* `npm test` passes
  `brand-swatches.test.ts` (dedup, order, the move-to-Other rule, no logo
  gives 18a1's row); `e2e/logo.spec.ts` (local) uploads the two-colour
  fixture, finds radios named "Green from your logo, #2f6b5a" and the gold
  one, none checked; choosing green updates the preview's button colour
  before saving, and saving puts green's derived primary on the public page;
  removing the logo leaves Other colour checked with `#2f6b5a`; and
  `e2e/contrast.spec.ts` and the 390px Settings check stay green.

- [x] **Step 7 - the record** - design.md: the four points under *What the
  record does not cover*; `needs-you.md` already widened by this spec.
  *Done when:* design.md's Settings row and *Customer sites* say them, and
  `npm run verify` passes.

- [x] **Repair (verify) - the logo's three buttons overflow at 390px** -
  with a logo set, Change / Replace / Remove logo did not wrap, so Settings
  scrolled sideways at 390px; 18a1's 390px check has no logo, so it stayed
  green. `.logoActions` wraps. *Done when:* `e2e/logo.spec.ts` "with a logo
  set, Settings does not scroll sideways at 390px" fails without the wrap
  (logoPreview, logoActions, a button and the hint past the edge) and
  passes with it.

- [x] **Repair F-317 - the halo rule drops a real second colour close in
  tone** - a group is a halo when its average lies within 12/255 of the
  open segment between a larger kept colour and white, or between two
  larger kept colours - widened to any other colour by F-323 (a size bound was tried first and rejected - see
  Decisions). *Done when:* `logo-colours.test.ts` shows 55/45 splits
  of `#2f6b5a`+`#4a9c80` and `#ff6b00`+`#ffb000` keep both colours, failing
  with the old rule; the halo and optimise-image tests still pass.

- [x] **Repair F-323 - a thin-stroke logo's edge can come first** - each
  group passing 5% is tested against every other passing group, not only
  larger kept ones. *Done when:* a unit test where the edge group is the
  largest (green 2000, edge `#99b6ae` 3000, white the rest) gives
  `["#2f6b5a"]`, failing on the current rule.
- [x] **Repair F-318 - `media.colours`' check** - also refuses `{''}`, an
  element holding a comma, and a multi-dimensional array. *Done when:* psql
  as the owner shows each refused and three valid colours accepted.
- [x] **Repair F-319, F-320, F-324, F-325 - wording and one assertion** -
  comments say most-used first and "segment"; `capitalise` moved off
  `setSwatchColour`'s comment; the raw-SVG-to-Media test asserts 400; the
  Decisions record the tint and grey trade-off; the F-317 step names the
  rule that shipped. *Done when:* the F-320 assertion fails against a 302.
- [x] **Repair F-321, F-322 - the logo field's state and focus** - Choose
  and Remove clear the PNG line and any refusal and are unavailable while
  uploading; the upload control keeps focus through a refusal. *Done when:*
  `e2e/logo.spec.ts` shows each, failing before the change.

## Files and areas

- `db/migrations/0019_media_colours.sql` (new)
- `app/features/brand/logo-colours.ts`, `.test.ts` (new)
- `app/features/media/optimise-image.server.ts`, its test and fixtures,
  `media.server.ts` (`insertMedia`), `media-list.tsx` (action thinned),
  `store-upload.server.ts` (new), `media-picker.ts`,
  `media-picker-dialog.client.ts` (type)
- `app/features/settings/settings.tsx`, `settings.server.ts`,
  `settings.module.css`, `logo-upload.ts` (new), `svg-to-png.client.ts`
  (new), `brand-swatches.ts`, `.test.ts` (new)
- `app/lib/content-security-policy.ts`, its test; `app/routes.ts`
- `e2e/logo.spec.ts` (new) and fixtures (two-colour PNG, SVGs: plain,
  viewBox-only, scripted, malformed)
- `blueprint/context/design.md`

## Data and contracts

- **`media.colours`** - `text[] not null default '{}'`, 0-3 values, each
  `#rrggbb` lowercase, most-used first. **Load-bearing:** 18b preselects
  `colours[0]` at onboarding.
- **`storeUpload(actor, file, altText)`** -> `{ ok: true, media }` or
  `{ ok: false, problem, status }`. **Load-bearing:** 18b's logo upload
  calls it.
- **`POST /admin/settings/logo`** - multipart `file`; 200 `{ media:
  PickedMedia }`, or 400 / 413 `{ problem }`; 404 for a non-admin.
- **`PickedMedia`** gains `colours: string[]`; **`SiteSettings`** gains
  `logoColours: string[]` (`[]` with no logo).
- The settings form still posts `logoMediaId` and `brandColor` as in 18a1;
  nothing new is posted.

## Testing

- **Unit** (`npm test`, inside `verify`, runs in CI): `logo-colours`,
  `optimise-image.server` (sharp runs in CI already), `brand-swatches`,
  `content-security-policy`.
- **Browser** (`npm run test:e2e`): `e2e/logo.spec.ts` on a site of its own
  (`createSite` / `createSiteAdmin`, F-103). **Everything that uploads needs
  real R2 and is skipped in CI** (`test.skip(skipWithoutStorage)`); it runs
  only on the laptop with the real `.env` (needs-you, "Run the full browser
  suite locally"). The raw-SVG refusals and the editor's 404 are refused
  before R2 and run in CI too.
- Chromium only. Firefox and Safari's SVG-to-canvas behaviour is a manual
  check (needs-you).

## Decisions

- **The logo's colours are counted on the server with `sharp` when the image
  is uploaded, and stored on its media row** - supersedes D167's "taken from
  the logo's pixels in the browser". Beats: the browser canvas, which a logo
  picked from the library taints (R2 is another origin; CORS is an owner
  setting), so library logos would get no colours; and reading the image
  back from R2 on each pick. Costs a 64px decode per upload and a column.
- **The admin's `img-src` allows `blob:`** so an SVG can be drawn from the
  user's own file - beats a `data:` URL (same risk, larger) and putting the
  SVG into the page's DOM (it would run). Only same-origin blobs qualify.
- **The logo uploads through its own admin-only route answering JSON, on
  one shared upload function** - beats posting to `/admin/media` and reading
  its redirect.
- **A logo uploaded from Settings gets the alt text "<site title> logo"** -
  the header shows it with `alt=""` beside the name, so this is only the
  library's label; beats asking for alt text in Settings.
- **Settings never selects a logo colour by itself** - AI and the logo
  suggest, the user applies (principles); 18b's onboarding may preselect.
- **An SVG becomes a PNG 1200px on its longer side** - D167's "about 1200px
  wide", without a tall logo growing past 1200px. Re-confirmed by the owner
  (2026-10-07) over storing SVG, which would need all three of a server-side
  allowlist sanitiser, the cookieless media domain, and `sandbox` CSP headers
  on `.svg` responses (needs the custom R2 domain; `r2.dev` cannot set them).
- **Biome skips `e2e/fixtures`** (Step 5) - Biome 2.5 lints `.svg` and
  fails on the deliberately malformed and scripted fixtures; they are test
  inputs, not source.
- **An SVG's size comes from its root tag's text** (`svg-size.ts`): plain
  or px `width` and `height`, else the `viewBox`, else what the browser
  measured - read as a string, never put into the page; a viewBox-only SVG
  otherwise reports Chromium's 300x150 default.
- **A logo colour is near the drawn one, not exact** (Step 6): a group's
  average takes in anti-aliased edge pixels within 0.08, so the mock's
  green is stored as `#2d6a58`; the browser test matches the swatch name's
  hex within 3 per channel rather than `#2f6b5a` exactly. The colour word
  for the mock's gold is "Yellow".
- **The palette rule** (Step 2, final values): skip pixels under alpha 128
  and with OKLab L > 0.95; a pixel joins the nearest group whose running
  OKLab centre is within 0.08, else starts one; keep groups of at least 5%
  of counted pixels; drop a halo - a group within 12 (of 255) of the open sRGB
  segment (strictly between its ends) between another kept colour and
  white, or between two other kept colours (any size, F-323): the anti-aliased edge where a shape meets its background, which
  otherwise comes back as a washed-out copy. Replaced at F-317 a rule of
  "within 0.16 OKLab of a larger kept group", which also dropped a real
  second tone of one hue (`#4a9c80` beside `#2f6b5a` at 45%) and caught the
  test fixture's green-white edge only because it sat near the gold. The
  cost (F-324): a deliberate tint of a kept colour, a grey beside black, or
  a mix of two kept colours is dropped as a halo at any share - no size
  bound separates them from real edges, which on a text wordmark reach 0.71
  of the main colour's pixels; each colour is its group's sRGB average; at most
  three. Colour words: L < 0.25 black, chroma < 0.04 grey, else by hue -
  red 355-40, orange 40-80, yellow 80-125, green 125-176, teal 176-225,
  blue 225-285, purple 285-325, pink 325-355; a light red (L > 0.78) is
  pink, a dark orange or yellow (L < 0.6) brown.
- **A logo's colours are ordered most-used first**, ties by higher chroma -
  owner, 2026-10-07, over the spec's "highest chroma first": 18b preselects
  `colours[0]`, and the colour covering most of a logo is its brand colour
  more often than a small saturated accent. The mock's green (more pixels,
  less chroma) comes before its gold.

## Production needs

- Migration `0019_media_colours.sql` (additive, default; no data change).
- The admin's Content-Security-Policy gains `img-src blob:`; Caddy sets no
  CSP of its own, so nothing on the server changes.
- No new environment variables, accounts or dependencies.

## Behaviour changes

- Adds to `brand`: Settings uploads a logo - JPEG, PNG, WebP, GIF or SVG, up to 10 MB - and it counts toward the site's storage - Step 4
- Adds to `brand`: an SVG logo is turned into a PNG in the browser, and no SVG reaches the server - Step 5
- Adds to `media`: an SVG sent to the server is refused, from Media and from Settings, and no media row is added - Step 5
- Adds to `brand`: Settings offers up to three colours from the logo as brand colour swatches, named for their colour - Step 6
- Adds to `brand`: choosing, changing or removing a logo never changes the selected brand colour - Step 6

## Notes

- **The SVG never touches the server or the DOM.** `<img>` sandboxes it; the
  server's byte check (`detectImage`) already refuses SVG and stays the
  backstop. Never `innerHTML`, `<object>` or an inline `<svg>` of the file.
- **Canvas taint:** a `blob:` SVG does not taint the canvas in current
  Chromium; older Safari tainted every SVG. If `toBlob` throws, show the
  Step 5 message rather than failing silently.
- **Upload pipeline:** the move in Step 3 is behaviour-preserving - Media's
  messages, redirects and log line stay byte for byte; the existing specs
  are the proof.
- **CSRF:** the new route is a POST on the admin host, under the existing
  origin check; nothing new to add.
- `site_settings` and `media` queries stay inside `inSite` and name
  `site_id`.
- Inline `style` attributes stay blocked; swatch dots use the CSSOM
  (18a1's `setSwatchColour`).
- `settings.tsx` is already 31K: the logo field and its upload go in their
  own component file in the feature folder.
- `sharp`'s memory on the 954 MB server is F-309's open question; the extra
  64px read adds little but runs inside the same one-at-a-time queue.

## Findings

### 18a2-your-logo/F-317 [P2] closed - The halo rule drops a real second colour close in tone, even at 45% of the logo
File: app/features/brand/logo-colours.ts:70-74

**Found:** 2026-10-07 by review (scope: current; every lens; via reviewer)
**Why it matters:** "Drop a group within 0.16 of a larger kept group" has no size limit: a 55/45 split of `#2f6b5a`+`#4a9c80`, or `#ff6b00`+`#ffb000`, returns only the first colour. A real halo is a thin edge; two-tone logos lose their second colour before 18b reads `colours[0]`.
**Suggested fix:** Count a group as a halo only when it is also small beside the larger one (e.g. `group.n < big.n * 0.25`); unit test two same-hue tones at 55/45.
**Resolution:** 2026-10-07, build. A halo is now a group within 12/255 of the sRGB line between a larger kept colour and white, or between two larger kept colours (`logo-colours.ts`, `isBlend`); the OKLab-distance rule is gone. Test `logo-colours.test.ts` "two close tones of one hue, 55/45, both come back (F-317)", from this finding's reproduction: red against the old rule (`#4a9c80` missing), green after. A size bound on the old rule was tried first and failed `optimise-image.server.test.ts` - the fixture's green-white edge (`#82a69c`) was only ever dropped by sitting near the gold. Each branch of the new rule proven: removing the white-blend branch fails the optimise-image colours test; removing the two-colour branch fails the new "blended edge ... dark background" test. `npm run verify` 695/695; `e2e/logo.spec.ts` 13 passed. Closed by build (P2, test seen failing first). Re-examined by review (via reviewer), 2026-10-07: the test is the finding's reproduction and fails on HEAD's rule (checked with `git show HEAD:`); stays closed. The rule's own trade-offs are F-323 and F-324.

### 18a2-your-logo/F-318 [P3] closed - `media.colours`' check lets through values it claims to refuse
File: db/migrations/0019_media_colours.sql:18-22

**Found:** 2026-10-07 by review (scope: current; every lens; via reviewer)
**Why it matters:** The regex runs on the joined string, so `{''}`, one element holding `#aaaaaa,#bbbbbb`, and multi-dimensional arrays pass. The app never writes them; the check is the backstop the contract describes.
**Suggested fix:** Add `array_ndims(colours) <= 1` and `(cardinality(colours) = 0 or length(array_to_string(colours, ',')) = 8 * cardinality(colours) - 1)` - while 0019 is unapplied in production.
**Resolution:** 2026-10-07, build. 0019's check adds `coalesce(array_ndims(colours), 1) = 1` and `length(array_to_string(colours, ',')) = greatest(8 * cardinality(colours) - 1, 0)`; the development database's constraint was dropped and re-added by hand (the runner does not re-run an applied file; production has not run 0019). Red, psql as the owner against the old check: `array['']` and `array['#aaaaaa,#bbbbbb']` inserted. Green: both, and `{{"#aaaaaa"},{"#bbbbbb"}}`, refused by `media_colours_check`; three valid colours and `{}` accepted; a fourth colour, `#FFF`, `#FFFFFF` and a null still refused. Closed by build (P3, seen failing first). Re-examined by review (via reviewer), 2026-10-07, at caf4ef2: stays closed.

### 18a2-your-logo/F-319 [P3] closed - Type comments still say "strongest first" after the most-used-first decision
File: app/features/media/media.server.ts:19; app/features/media/media-picker-dialog.client.ts:22; app/features/settings/settings.server.ts:11

**Found:** 2026-10-07 by review (scope: current; every lens; via reviewer)
**Why it matters:** 18b relies on what `colours[0]` means; three comments contradict the recorded decision and `logo-colours.ts`. Also `capitalise` sits between `setSwatchColour`'s doc comment and its function (`settings.tsx:250-251`).
**Suggested fix:** Say "most-used first"; move `capitalise` above the doc comment.
**Resolution:** 2026-10-07, build. "Most-used first" in the three type comments (no "strongest" left in `app/`); `capitalise` moved above `setSwatchColour`'s doc comment. Comments only - no test; left for review. Re-examined by review (via reviewer), 2026-10-07, at caf4ef2: confirmed; closed.

### 18a2-your-logo/F-320 [P3] closed - The "raw SVG to Media" status assertion cannot fail
File: e2e/logo.spec.ts:283-285

**Found:** 2026-10-07 by review (scope: current; every lens; via reviewer)
**Why it matters:** A refusal is 400 and an acceptance 302 (`maxRedirects: 0`); `media.ok() && status === 200` is false either way, so the check passes vacuously. Only `countSiteMedia` tests it.
**Suggested fix:** `expect(media.status()).toBe(400)`.
**Resolution:** 2026-10-07, build. `expect(media.status()).toBe(400)`. Seen failing: asserting 302 gave `Received: 400`; restored, passes. Closed by build (P3, seen failing first). Re-examined by review (via reviewer), 2026-10-07, at caf4ef2: stays closed.

### 18a2-your-logo/F-321 [P3] closed - The logo field keeps stale messages, and a late upload overrides a newer pick
File: app/features/settings/logo-field.tsx:45,70-71,90,98,127

**Found:** 2026-10-07 by review (scope: current; every lens; via reviewer)
**Why it matters:** "Saved as a PNG for the web." and a refusal stay after Remove logo or a library pick (design.md: the PNG line shows only after an SVG). Choose and Remove stay active while uploading, so a slow upload replaces the logo picked since.
**Suggested fix:** Clear `wasSvg` and `problem` in a wrapper for Choose and Remove; disable them while sending, or ignore a result that arrives after the logo changed.
**Resolution:** 2026-10-07, build. Choose and Remove go through `change`, which clears the PNG line and any refusal; while sending they are `aria-disabled` and ignore clicks. Tests "Remove logo clears the PNG line and a refusal" and "Change and Remove do nothing while an upload is in flight" (POST stubbed, CI-safe): red before (the line stayed; no aria-disabled), green after. A library pick goes through the same wrapper but is not browser-tested. Closed by build (P3, seen failing first). Re-examined by review (via reviewer), 2026-10-07, at caf4ef2: stays closed.

### 18a2-your-logo/F-322 [P3] closed - Keyboard focus is likely lost after an upload and never returned after a refusal
File: app/features/settings/logo-field.tsx:110

**Found:** 2026-10-07 by review (scope: current; every lens; via reviewer)
**Why it matters:** Disabling the focused file input drops focus (probably to `body`); success moves it to the first button, but a refusal or SVG failure returns it nowhere (WCAG 2.2 AA 2.4.3). Not confirmed in a browser.
**Suggested fix:** Refocus the input after a refusal, or use `aria-disabled` and ignore `change` while sending instead of `disabled`.
**Resolution:** 2026-10-07, build. The file input uses `aria-disabled` and ignores `change` while sending, never `disabled`, so focus stays; the busy style matches `[aria-disabled="true"]`. Test "keyboard focus stays on the file input after a refusal" (stubbed 400): red before, green after. Screen-reader announcement remains the open needs-you pass. Closed by build (P3, seen failing first). Re-examined by review (via reviewer), 2026-10-07, at caf4ef2: stays closed. Chromium: Space, Enter and a label click are all blocked while sending; Firefox and Safari unverified.

### 18a2-your-logo/F-323 [P2] closed - A thin-stroke logo's blended edge can come back as `colours[0]`
File: app/features/brand/logo-colours.ts:93-104

**Found:** 2026-10-07 by review (scope: current, the F-317 repair; every lens; via reviewer)
**Why it matters:** A group is checked for being a halo only against larger kept groups, so when strokes are about 1px at the 64px sample the edge group is the largest and nothing rules it out. Real sharp resizes: green strokes on white give `["#dee8e5","#467c6d"]`; gold on `#1a1a1a` gives `["#312c23","#171819","#b59356"]`. 18b preselects `colours[0]`. The old rule had the same order dependence.
**Suggested fix:** Test each group passing 5% against every other passing group, not only larger kept ones, then sort (reviewer's variant passes all 21 unit tests; the cases above give `["#467c6d"]` and `["#171819","#b59356"]`). Unit test an edge group that is the largest (green 2000, edge `#99b6ae` 3000, white the rest).
**Resolution:** 2026-10-07, build. Every candidate passing 5% is tested against every other candidate, not only larger kept ones (`logo-colours.ts`). Test "an edge group that is the largest is still dropped as a halo (F-323)" (green 2000, edge `#99b6ae` 3000): red on the old rule (`#99b6ae` in the result), green after; logo-colours and optimise-image tests 33/33. Closed by build (P2, seen failing first). Re-examined by review (via reviewer), 2026-10-07, at caf4ef2: stays closed. The wider washed-out-colour symptom has a different cause, F-326.

### 18a2-your-logo/F-324 [P3] closed - A deliberate tint, a grey beside black, or a mix of two kept colours is dropped at any share, unrecorded
File: app/features/brand/logo-colours.ts:98-102; blueprint/context/current-work.md (Decisions, "The palette rule")

**Found:** 2026-10-07 by review (scope: current, the F-317 repair; every lens; via reviewer)
**Why it matters:** Anything on the segment from a kept colour to white, or between two kept colours, counts as a halo at any size: charcoal 60 / light grey 40 gives `["#222222"]`; green 60 / 40% tint 40 gives `["#2f6b5a"]`; a purple between red and blue is dropped. No size bound separates these from real edges (wordmark edge groups reach 0.71 of the main colour), so this is a trade-off, not a bug - but it is not written down.
**Suggested fix:** Record the cost in Decisions: "a deliberate tint of a kept colour, a grey beside black, or a mix of two kept colours, is dropped as a halo at any share"; and say "segment" (strictly between the ends) rather than "line" there and in `logo-colours.ts:8-12`.
**Resolution:** 2026-10-07, build. The cost is recorded in the spec's Decisions ("The palette rule") and in `logo-colours.ts`'s header, which now says "segment (strictly between its ends)". Documentation only; left for review. Re-examined by review (via reviewer), 2026-10-07, at caf4ef2: confirmed; closed.

### 18a2-your-logo/F-325 [P3] closed - The ticked "Repair F-317" step describes the rejected fix
File: blueprint/context/current-work.md:164-168

**Found:** 2026-10-07 by review (scope: current, the F-317 repair; every lens; via reviewer)
**Why it matters:** It says a halo must be "small beside the larger kept group" - the size bound that was tried and abandoned - not the segment test that shipped. A fresh session would read the wrong rule.
**Suggested fix:** Reword the step to the segment test: within 12/255 of the open segment to white, or between two larger kept colours.
**Resolution:** 2026-10-07, build. The ticked F-317 step now names the segment rule that shipped and points at Decisions for the rejected size bound. Documentation only; left for review. Re-examined by review (via reviewer), 2026-10-07, at caf4ef2: confirmed; closed.

F-326 (P2) stays in `blueprint/context/findings.md`; F-327 and F-328 (P3) moved to `blueprint/findings/backlog.md`. Entries in `blueprint/findings/`.

## Prototypes kept

- `prototypes/start-brand.html` - kept for 18b (onboarding's "Make it yours": the logo drop and its swatches).
- `prototypes/site-home.html` - kept for 18b (the AI draft's published site) and 20 (dark mode on the public site).
- `prototypes/start.html`, `home.html` - kept for 18b (onboarding, Home after the AI draft).
- `prototypes/editor.html`, `components.html`, `components.css`, `theme.css`, `checks/` - kept: items 18b-20 still build screens from them (`design.md` *Screens*).
