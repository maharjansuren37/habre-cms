# Feature: Optimised images

**From build plan:** item 17b
**Type:** Feature
**Verified:** not yet
**Reviewed:** not yet

## Goal

Each upload is turned on the server into WebP sizes and a social-image JPEG,
upright, in sRGB and without camera details (location included), and the
upload itself is not kept. Public pages give the browser `srcset` and `sizes`
so a phone stops downloading a 10 MB photo shown 400 px wide. Every object is
cached for a year, and a server command brings media uploaded before this
item up to the same shape (D174).

## In scope

- `sharp`, pinned exactly; one module that turns an upload into its objects.
- Sizes 480, 960, 1600, 2400 px wide, **never wider than the original**: every
  size narrower than the original, plus one at the original's own width when
  it is under 2400 (a 1200 px upload gives 480, 960, 1200). Plus `social.jpg`,
  1200 px wide (or the original's width if narrower), transparency flattened
  onto white.
- Rotated by the camera's orientation, converted to sRGB, all metadata dropped
  (EXIF including GPS, XMP, IPTC, ICC).
- **Animated GIFs stored as uploaded** (no sizes, no social JPEG - the GIF is
  its own share image). A still GIF is resized like any other image.
- One resize at a time in the process; a pixel cap so a small file that
  decodes to a huge image is refused, not decoded.
- `Cache-Control: public, max-age=31536000, immutable` on **every** object
  written to R2 - each upload already gets a new key.
- Storage counts every stored object (D174, D150): `byte_size` becomes the sum
  of what is stored, not the upload's size, and the limit is checked against
  that sum.
- Deleting an image (Media, and account/site deletion) removes every object.
- Public pages: `srcset` plus `sizes` from the section's column count; the
  site logo, Media's grid, the picker, the delete screen, the editor and the
  share-image field each use one fixed size; `og:image` is the social JPEG.
- `optimise-media` (D158): resizes every media row uploaded before this item,
  safe to re-run.
- The resize time and peak memory, measured - the quality bar asks this item
  for the number.

## Out of scope

- AVIF - waits for a bigger server, made later by the same command (D174).
- A media custom domain - `needs-you.md`, owner's risk acceptance.
- Cropping, focal points, editing alt text, or re-uploading in place.
- Shrinking an animated GIF.
- Brand-colour extraction from the logo's pixels - item 18a, which may reuse
  `sharp`.
- Admin-side `srcset` (grid, picker, editor) - fixed sizes are enough there.

## Build steps

- [x] **Step 1 - `sharp` and the resize** - install `sharp` 0.35.5 pinned
  exactly (`npm install --save-exact`; setup-server.sh already refuses a
  non-`x86_64` server, matching the dev machine). New
  `app/features/media/optimise-image.server.ts`: `optimiseImage(bytes)`
  returns either `{ kind: "resized", sizes: [{ width, height, bytes }], social: { width, height, bytes } }`
  or `{ kind: "as-uploaded" }` for an animated GIF, or
  `{ kind: "unreadable" }` / `{ kind: "too-large" }`. Rules as *In scope*;
  WebP quality 80, JPEG quality 80 (mozjpeg off); `limitInputPixels` 40
  megapixels, one exported constant (`MAX_INPUT_PIXELS`) the refusal message
  also reads; `sharp.cache(false)`; calls are serialised through one promise
  chain in the module (one at a time). The pure part - which widths to make
  from an original width - is `variant-widths.ts` with its own tests. Tests
  build their inputs with `sharp` itself (no binary fixtures beyond the four
  1x1 files): a 3000x2000 JPEG with orientation 6 and GPS EXIF comes back
  upright - 2000 wide, 3000 tall - as sizes 480, 960, 1600 and 2000 (the
  widths follow the *oriented* width), with no EXIF, XMP or ICC in
  `sharp(out).metadata()`; a 700 px PNG
  gives 480 and 700; a PNG with transparency gives a social JPEG whose corner
  pixel is white; a 2-frame GIF gives `as-uploaded`; a 1-frame GIF is resized;
  random bytes give `unreadable`; an 8000x6000 image gives `too-large`.
  *Done when:* `npm test` runs these and passes, and each was seen failing
  first; and a measurement on the dev machine - a 10 MB, ~24 MP camera JPEG
  through `optimiseImage` ten times - gives the median and slowest time and
  the process's peak RSS, written into this spec's Notes.

- [x] **Step 2 - the stored shape** (run with `migrate`) - migration
  `0017_media_variants.sql`: `media.variant_widths integer[]`, **nullable**:
  `null` = uploaded before 17b, not yet optimised; `'{}'` = stored as uploaded
  (animated GIF); otherwise the WebP widths, ascending. Widen `byte_size`'s
  check from 10 MB to 50 MB (five objects; the 10 MB cap on the upload itself
  stays in the app). Reversible: the down drops the column and restores the
  10 MB check (refused if a row exceeds it - say so in the migration's
  comment). New pure `app/features/media/media-objects.ts`:
  - key layout for a resized upload: `sites/<siteId>/<uuid>/<width>.webp` and
    `sites/<siteId>/<uuid>/social.jpg`; `storage_key` is **the widest WebP**,
    so every existing reader of `storage_key` keeps a working URL;
  - `mediaObjectKeys(row)` - every key a row owns (one for `null` and `'{}'`,
    all sizes plus social otherwise);
  - `mediaSources(publicUrl, row)` - `{ src, srcset, thumbnail, social }`:
    `src` the widest size up to 1600, `thumbnail` the 480 (or narrowest),
    `srcset` every size with its `w` descriptor, `social` the JPEG; for `null`
    and `'{}'` all four are the one object and `srcset` is null.
  `Media`, `MediaSummaryRow` and `insertMedia` carry `variantWidths`; until
  Step 3 the upload still stores the original and inserts `null`, so the app
  keeps working.
  *Done when:* `npm run db:migrate` applies 0017 to the development database,
  and its down, applied by hand, then the up again, both run clean; unit tests pin the keys and sources for a
  resized row, a `'{}'` row and a `null` row; `npm run verify` passes and the
  existing browser tests that seed media rows still pass (they insert with no
  `variant_widths`, i.e. `null`).

- [ ] **Step 3 - upload, cache header and delete** - `uploadObject` takes the
  cache header and sends it on every write. Media's upload action: the existing
  checks, then `optimiseImage`; `unreadable` -> 400 "This image could not be
  read. Try saving it again as a JPEG or PNG."; `too-large` -> 400 "This image
  is larger than 40 megapixels. Resize it and try again."; then the storage
  check against the sum of the objects (a site already at or past its limit is
  refused before resizing, so a full site costs no CPU); then every object to
  R2, then the row (D7's order) with `mime_type` `image/webp` (or the GIF's
  own), the oriented `width`/`height` of the widest size, `variant_widths` and
  the summed `byte_size`. A failed R2 write after some objects landed leaves
  them unreferenced - harmless, as today. One `console.info` line per upload:
  site id, resize ms, bytes in, bytes stored. `media-delete.tsx` and account
  deletion remove `mediaObjectKeys` for each row (account deletion's query
  returns `variant_widths` too). *Done when:* `e2e/media-optimise.spec.ts`
  (local only, `test.skip(skipWithoutStorage)` like the other R2 specs) uploads
  a JPEG carrying GPS EXIF and a 2-frame GIF through Media and finds, for
  the GIF, one object with its own bytes and `variant_widths` `'{}'`; for the
  JPEG: the row's `variant_widths`
  and summed `byte_size`; every object answering 200 from `R2_PUBLIC_URL` with
  `cache-control` containing `max-age=31536000` and `immutable`; a fetched size
  with no EXIF (checked with `sharp` in the test); no object at the upload's
  own extension; after deleting the image in Media, every key answers 404. The
  existing storage-limit browser tests (CI) still pass. Unit tests cover the
  two new refusals' messages.

- [ ] **Step 4 - pages pick the size** - `DocumentMedia` gains `srcset`
  (`string | null`); `resolveDocumentMedia` fills `url` and `srcset` from
  `mediaSources`. The renderer gives each image `srcset` and `sizes` from its
  section's column count - one function, `imageSizes(columns)` in
  `app/features/blocks/image-sizes.ts`, derived from the reading column
  (`--size-measure` at the article's `--text-lg`, its `--space-5` gutters),
  the `--space-6` column gap and the 40rem stacking point. Fixed sizes: the
  public logo, Media's grid, the picker, the delete screen and the
  share-image field use `thumbnail`; the editor's image node uses `src`;
  `og:image` uses `social`. A row still `null` renders as today (no `srcset`).
  *Done when:* unit tests pin `imageSizes(1|2|3)`; a browser test in CI
  (`e2e/document-render.spec.ts` or a new spec), seeding rows with
  `variant_widths` through a widened `insertTestMediaRow` (objects need not
  exist - `currentSrc` is the chosen candidate even when it 404s), checks at a
  390 px phone viewport (device scale factor 3) and a 1280 px desktop (scale
  1), in a one-column and a three-column section, that every image's
  `currentSrc` width is no more than one size above its displayed width
  times the scale factor (the quality bar's rule); a published page's
  `og:image` ends in `/social.jpg`; the page's `img` elements keep their role
  and alt-text name (public-site.6).

- [ ] **Step 5 - `optimise-media`** - `scripts/optimise-media.ts`, `npm run
  optimise-media`, as the app role (`DATABASE_URL`) like the other operator
  commands. For each site (from `sites`), inside `inSite`, each row with
  `variant_widths is null`: read the object through R2's S3 API (new
  `getObject` in `r2.server.ts`), `optimiseImage`, write every object, then
  `update media ... where id = $1 and variant_widths is null` - if that touched
  no row (deleted or done meanwhile), delete the objects just written;
  otherwise delete the old object. An `as-uploaded` GIF is re-written under its
  same key with the cache header and set to `'{}'`. A row that fails (missing
  object, `unreadable`) is logged by id and skipped; the command ends with
  counts (optimised, kept as uploaded, failed) and exit code 1 if any failed.
  *Done when:* run locally against real R2 with two seeded legacy rows - one
  JPEG, one animated GIF, each with an object uploaded without the cache
  header - and one row whose object is missing: the JPEG's row has sizes and
  its old object answers 404; the GIF answers with the cache header and is
  `'{}'`; the missing one is reported and the exit code is 1; a second run
  reports 0 optimised and touches nothing. AGENTS.md *Commands* lists it.

## Files and areas

- `package.json`, `package-lock.json` - `sharp` 0.35.5, the `optimise-media`
  script.
- `app/features/media/` - new `optimise-image.server.ts`,
  `variant-widths.ts`, `media-objects.ts` (+ tests); `r2.server.ts`
  (cache header, `getObject`), `media.server.ts`, `media-list.tsx`,
  `media-delete.tsx`, `media-picker.ts`, `storage-key.ts` (the per-upload
  directory).
- `app/features/account/account.server.ts`, `account-delete.tsx` - every key.
- `app/features/blocks/render.tsx`, `document-nodes.ts`, new `image-sizes.ts`;
  `app/features/public-site/document-media.server.ts`,
  `public-seo.server.ts`; `app/features/settings/settings.server.ts` (logo);
  `app/features/content/post-edit.tsx`, `page-edit.tsx` (share image).
- `db/migrations/0017_media_variants.sql`.
- `scripts/optimise-media.ts`.
- `e2e/helpers/media.ts` (`variantWidths` option), new
  `e2e/media-optimise.spec.ts`, a rendering spec for `srcset`.
- `AGENTS.md` *Commands* and stack line (`sharp` 0.35.5).

## Data and contracts

**Load-bearing** - item 18a (logo pixels) and any later image work read these:

- `media.variant_widths integer[]` - `null` not yet optimised, `'{}'` stored
  as uploaded, else ascending WebP widths from {480, 960, 1600, 2400} plus at
  most one original width under 2400.
- Object keys: `sites/<siteId>/<uuid>/<width>.webp`,
  `sites/<siteId>/<uuid>/social.jpg`; `storage_key` = the widest WebP (or the
  single object for `null` / `'{}'`).
- `byte_size` = sum of every object the row owns; check widened to 50 MB.
- `width` / `height` = the widest stored size, after orientation.
- `mime_type` = `image/webp` for a resized upload.
- `DocumentMedia = { url, srcset: string | null, altText, width, height }`.
- `mediaSources(publicUrl, row) -> { src, srcset, thumbnail, social }` is the
  only place keys become URLs besides `buildMediaUrl`, which it uses.

## Testing

- **Unit (`npm test`, inside `verify`, so CI):** resize rules, widths, keys and
  sources, `imageSizes`, upload refusal messages. `sharp`'s prebuilt binary
  installs on CI's `ubuntu-24.04` through `npm ci`; no database or R2 needed.
- **Browser, CI (`npm run test:e2e`):** `srcset` selection at two widths and
  `og:image`, from seeded rows with no objects.
- **Browser, local only (`skipWithoutStorage`):** the real upload, headers,
  stripped EXIF and delete - covered by `needs-you.md`'s "full suite with real
  R2 before every deploy".
- **Local manual (Step 5's done-when):** `optimise-media` against real R2.
- **Measurement (Step 1):** resize time and peak memory.

## Decisions

- **Variant widths are the set below the original plus the original's own
  width when under 2400** - beat "only the fixed four" (a 1200 px upload would
  top out at 960, blurrier than what was uploaded) and "always all four"
  (upscaling).
- **`variant_widths` null = legacy, `'{}'` = as uploaded** - beat a separate
  `optimised` flag: one column says both whether and what.
- **`storage_key` points at the widest WebP** - beat a prefix-only key: every
  existing reader (`entries.server.ts`'s share-image subquery, settings' logo,
  account deletion) keeps a valid URL without changing.
- **`byte_size` is the sum stored, check widened to 50 MB** - D174 says storage
  counts every size; keeping 10 MB would refuse a legal row.
- **The storage limit is checked after resizing, against what is stored**,
  with a cheap refusal first for a site already full - beat checking the
  upload's size (would refuse uploads that fit once resized).
- **40-megapixel input cap** - beat sharp's 268 MP default: a 954 MB server
  decoding one 268 MP image would need over 1 GB; 40 MP covers today's phone
  and most camera photos. A reasonable default, not a product limit (owner,
  2026-10-07: the server is upgraded once traffic comes) - one named constant
  in `optimise-image.server.ts`, raised with the server.
- **WebP and JPEG at quality 80; transparent social images on white** - beat
  higher settings (size) and a black flatten (sharp's default).
- **Fixed sizes in the admin; `srcset` on public pages only** - the admin is
  a few people on desktop; public pages are what the quality bar measures.
- **`optimise-media` skips a row that fails and exits 1** - beat stopping at
  the first failure: one missing object should not block every other site.

## Production needs

- **Migration `0017_media_variants`** - additive, reversible.
- **`sharp` 0.35.5's native binary in `node_modules`** - installed on the dev
  machine (`x86_64`, glibc) and copied; the server is `x86_64` Ubuntu 24.04
  (glibc), which `setup-server.sh` checks. No new environment variable.
- **Run `npm run optimise-media` once after the deploy.** At the v1 deploy
  `0012` has already deleted every media row, so it should report 0; it
  matters for a self-hosted copy with older media.

## Behaviour changes

- Changes `public-site.6` from "an image renders as an `img` named once by its
  alt text; the first on a page loads at once with high priority, the rest
  lazily" to "an image renders as an `img` named once by its alt text, with a
  `srcset` of its sizes and `sizes` from its section's column count; the first
  on a page loads at once with high priority, the rest lazily" - Step 4
- Adds to `public-site`: a page never downloads an image more than one size
  above its displayed width, at a 390 px phone and a 1280 px desktop - Step 4
- Adds to `seo`: a page's share image is the image's JPEG, at most 1200 px
  wide - or an animated GIF, as uploaded - Step 4
- New capability `media`: an uploaded image other than an animated GIF is
  stored as WebP at 480, 960, 1600 and 2400 px wide, never wider than the
  original, plus a social JPEG, and the uploaded file itself is not kept -
  Step 3
- Adds to `media`: a stored image carries no camera details, location
  included - Step 3
- Adds to `media`: an animated GIF is stored as uploaded - Step 3
- Adds to `media`: every stored image object is served with a one-year
  immutable cache header - Step 3
- Adds to `media`: deleting an image removes every stored size - Step 3
- Adds to `media`: an image that cannot be read, or is over 40 megapixels, is
  refused with a message and no media row is added - Step 3
- Changes `limits.1` from "an upload that would take a site's media past its
  storage limit (`STORAGE_LIMIT_MB`, 500 MB unless set) is refused with a
  message naming the limit, and no media row is added" to "an upload whose
  stored sizes would take a site's media past its storage limit
  (`STORAGE_LIMIT_MB`, 500 MB unless set) is refused with a message naming the
  limit, and no media row is added" - Step 3
- Adds to `media`: `npm run optimise-media` gives every image uploaded before
  item 17b its sizes, and a second run changes nothing - Step 5

## Notes

- `sharp` is the first native runtime dependency (D174's costs). Pin exactly;
  record it in AGENTS.md's versions line and plan section 5.
- `erasableSyntaxOnly`: unions and `as const`, no enums.
- `*.server.ts` for anything importing `sharp` or R2 - `variant-widths.ts`,
  `media-objects.ts` and `image-sizes.ts` stay pure so `node --test` and the
  renderer can use them.
- Fundamentals: R2 objects before the row; row before the objects on delete.
- The `sizes` strings use `rem` and `vw` only (a `ch` in `sizes` resolves
  against the browser's default font, not the article's) - compute the
  reading column's rem width from the tokens once and say so in a comment.
- No `design.md` change: no new screen, state or message shape; the two new
  refusals use Media's existing error banner.
- **Step 1 measurement** (2026-10-07, dev machine, x86_64, Node 26.8.1,
  sharp 0.35.5): a **synthetic** 6000x4000 (24 MP), 9.79 MB JPEG with
  orientation 6 (gradient plus noise at quality 90 - no real camera photo was
  at hand), through `optimiseImage` ten times in a row (four WebP sizes and the
  social JPEG each): **median ~2,950 ms, slowest 3,019 ms**; **peak RSS
  552 MB** (`process.resourceUsage().maxRSS`), an upper bound - the same
  process also generated the input. On the 2 vCPU server expect slower; one at
  a time keeps the peak to one image. The quality bar's "Time
  to resize an upload: measured by item 17b" line is `architect`'s to update
  with it - `ship` should name that, not edit the bar itself.
