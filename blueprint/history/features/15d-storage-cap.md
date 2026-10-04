# Feature: Storage cap per site

**From build plan:** item 15d
**Type:** Feature
**Verified:** 2026-10-04, b44fc28879a7, 9 of 9 proven (after the F-248/F-249/F-250 repairs: verify 507/507 and storage-limit.spec 5/5 re-run; screen-reader pass on the meter left to needs-you.md)
**Reviewed:** 2026-10-04, b44fc28879a7, current, every lens (reviewer agent), re-reviewed the F-248/F-249 repairs; F-250's one-line repair closed by build, revert-tested - 0 blocking

## Goal

Every site's media storage is capped from the first signup (D150): an upload
that would take a site past its limit is refused with a plain message, and the
Media screen shows how much of the limit is used. It protects money before
signup opens - R2 is billed by the byte - and a limit refuses the action, never
the published site.

## In scope

- One configured limit, `STORAGE_LIMIT_MB`: 500 by default (D150's starting
  point), any whole number of MB to raise or lower it, `none` to remove it
  (plan *Switches*: a self-hosted copy can raise or remove its limits). It
  applies to every site until item 21 adds the paid plan's.
- **Usage is computed, never counted** (plan *Data model*): the sum of
  `byte_size` over the site's `media` rows, read when it is needed. No counter,
  no migration.
- The upload action refuses a file that would take usage past the limit,
  before its bytes reach R2 and before any row is written.
- The Media screen shows "Storage", the space used out of the limit, and a
  meter; a line saying the storage is full once it is; only the space used
  when there is no limit.
- Deleting an image frees its space - it already deletes the row, and usage is
  the sum of the rows.

## Out of scope

- **The paid plan's larger limit, and the plan link** - item 21. Until then
  every site gets `STORAGE_LIMIT_MB` whatever `sites.plan` says, and the
  refusal says "Paid plans with more storage are coming soon" (D150); item 21
  turns that into a link when billing is on and drops it when billing is off.
- **The usage meter on Home** - Home (`prototypes/home.html`) is not built; the
  item that builds it reuses this item's `Meter`.
- **Image sizes** - item 17b. Usage must then count every variant's bytes
  (plan *Data model*: "every variant included"); 17b's spec changes the sum.
- **Watching sites at their limit** (plan *Growth*) - `monitor`.
- **An operator command showing a site's usage**, and cleaning R2 objects with
  no row - not planned; mention if wanted.
- **AI use** - item 18.

## Build steps

- [x] **Step 1 - the limit and its arithmetic** - `app/lib/limits-env.server.ts`
  exports `limitsEnvFields` with `STORAGE_LIMIT_MB` (blank or unset = 500; a
  whole number from 1 = that many MB; `none` = no limit; anything else stops
  startup with a message naming the variable, never its value), parsed to
  bytes or `null`; `env.server.ts` spreads it, like `emailEnvFields`.
  `app/features/media/storage-limit.ts` holds the pure parts: `fitsStorage(used,
  fileBytes, limit)` (always true when `limit` is `null`; true when
  `used + fileBytes <= limit`), `formatStorage(bytes)` ("less than 1 MB" for
  1 byte to under 1 MB, whole MB rounded down from 1 MB, GB to one decimal with
  a trailing `.0` dropped from 1024 MB) and `storageSummary(used, limit)` (the
  Media screen's text, meter value and max, and whether it is full). `.env.example`
  documents the variable. *Done when:* `npm test` passes new tests in
  `limits-env.server.test.ts` (unset, blank, `500`, `2048`, `none` accepted;
  `0`, `-1`, `1.5`, `abc` refused naming `STORAGE_LIMIT_MB`) and
  `storage-limit.test.ts` (exactly at the limit fits, one byte over does not,
  `null` always fits; `formatStorage` for 0, 1, 1048575, 1048576, 524288000,
  1073741824, 1610612736 bytes; `storageSummary` below, at and above the limit
  and with `null`), and `npm run verify` is green.

- [x] **Step 2 - refuse an upload past the limit** - `storageUsed(siteId)` in
  `media.server.ts` (`coalesce(sum(byte_size), 0)` inside `inSite`, `where
  site_id`). The Media action, once the file and its real size are known and
  before `uploadObject`, refuses with status 413 and the error banner: "This
  image would take your site past its 500 MB of storage. Delete images you no
  longer use, then try again. Paid plans with more storage are coming soon."
  (the number from `formatStorage`). `playwright.config.ts` gives every test
  server `STORAGE_LIMIT_MB=500` so a local `.env` cannot change what the
  tests assume. New helper `fillTestStorage(siteId, uploadedBy, rows)` in
  `e2e/helpers/media.ts` inserts rows of 10 MB (10,485,760 bytes, the
  per-file cap) with no R2 object. *Done when:* `e2e/storage-limit.spec.ts`,
  on a fresh site (`createSite`, `createSiteAdmin`) filled with 50 such rows
  (exactly 500 MB): uploading `1x1.jpg` from Media shows that message as an
  alert and the site still has 50 media rows; it runs in CI, whose R2 values are fake, so a refusal that
  reached R2 would answer 500 there instead. With 49 rows, the same upload
  succeeds (`test.skip(skipWithoutStorage)` - real R2, local only).

- [x] **Step 3 - show usage on Media** - `app/lib/ui/meter.tsx` and
  `meter.module.css`: a native `<meter>` with a visible `<label>`, drawn as the
  mock's `.meter` (`prototypes/components.css:410`). The Media loader adds
  `storageSummary(await storageUsed(siteId), limit)`; the screen shows, under
  the heading and above the upload form, "Storage" (the meter's label), "38 MB
  of 500 MB used", and the meter; when full, the line "Your site has used all
  of its 500 MB of storage. Delete images you no longer use to upload more.";
  with no limit, "38 MB used" and no meter. `design.md` *Components in use*
  records the usage meter as a native `<meter>`. *Done when:* in
  `e2e/storage-limit.spec.ts`, a fresh site with 3 seeded rows shows "30 MB of
  500 MB used" and `getByRole("meter", { name: "Storage" })` with value
  31457280 and max 524288000; filled to 50 rows it shows "500 MB of 500 MB
  used" and the full line; after one row is deleted and the page reloaded it
  shows "490 MB of 500 MB used" and no full line. `verify` starts the app with
  `STORAGE_LIMIT_MB=none`, sees "used" with no meter, and uploads to a site
  filled past 500 MB (real R2, locally); and with
  `STORAGE_LIMIT_MB=nope` sees startup refuse naming the variable.

- [x] **Repair F-248 - Media cards show an image's size about 1024 times too
  large** - move `formatByteSize` out of `media-list.tsx` into
  `app/features/media/file-size.ts` as `formatFileSize`, dividing by
  1,048,576 for MB. *Done when:* `file-size.test.ts` shows 287 bytes as
  "287 B", 2048 as "2 KB", 10485760 as "10.0 MB" (red first on the old
  arithmetic), and `npm run verify` is green.

- [x] **Repair F-249 - a limit that is not a whole tenth of a GB reads as equal
  to the usage** - the limit rounds up (`formatStorageLimit`), usage still
  rounds down; `storageSummary`'s `limitText` and the refusal message use it.
  *Done when:* `storageSummary(1990 MB, 2000 MB)` gives "1.9 GB" used and
  "2 GB" limit (red first), the existing `formatStorage` tests still pass, and
  `npm run verify` is green.

- [x] **Repair F-250 - a full site can show usage below its limit** - when
  full, usage rounds up like the limit. *Done when:* `storageSummary(2000 MB,
  2000 MB)` gives "2 GB" used (red first), the other `storageSummary` tests
  still pass, and `npm run verify` is green.

## Files and areas

- `app/lib/limits-env.server.ts` (+ `.test.ts`) - new; `app/lib/env.server.ts`
- `app/features/media/storage-limit.ts` (+ `.test.ts`) - new
- `app/features/media/media.server.ts` - `storageUsed`
- `app/features/media/media-list.tsx` (+ `.module.css`) - the check, the usage
- `app/lib/ui/meter.tsx`, `meter.module.css` - new
- `.env.example`, `playwright.config.ts`
- `e2e/helpers/media.ts`, `e2e/storage-limit.spec.ts` - new spec
- `blueprint/context/design.md` - *Components in use*

## Data and contracts

- **No schema change.** Usage reads `media.byte_size`, already `not null` and
  capped at 10 MB per row; the `(site_id, id)` unique index from `0010` serves
  `where site_id`.
- `STORAGE_LIMIT_MB` -> `env.STORAGE_LIMIT_BYTES: number | null` -
  **load-bearing**: item 21 adds the paid plan's limit beside it, and the item
  that builds Home reads the same summary.
- `storageSummary(used, limit)` -> `{ usedText, limitText | null, value, max |
  null, isFull }` - **load-bearing** for Home's meter.

## Testing

- **Unit** (`npm test`, inside `verify`, runs in CI's `verify` job, no
  database): the env parsing and the pure arithmetic and wording, Step 1.
- **Browser** (`npm run test:e2e`, needs the development database; CI's `e2e`
  job has one): the refusal and the screen, Steps 2-3. The refusal and display
  tests seed rows with no R2 object, so they run in CI; the one upload that
  fits needs real R2 and runs locally only (`needs-you.md`, *Run the full
  browser suite locally*).
- Each test uses its own fresh site and deletes it after (`deleteSite`; seeded
  rows first, as `insertTestMediaRow`'s note says), so parallel workers and
  site 1's own uploads never meet (F-103's shape).

## Decisions

- **One configured limit, `STORAGE_LIMIT_MB`, default 500, `none` to remove,
  for every site until item 21.** Beat: a per-site column in `sites` (a
  migration for a value nothing can set before billing); a constant in code (a
  self-hosted copy could not raise or remove it, D148).
- **MB means 1,048,576 bytes**, the same unit as the 10 MB upload cap. Beat:
  decimal MB, which would make the two caps disagree.
- **Usage rounds down, the limit rounds up** - whole MB, and GB to one
  decimal - so usage never reads as the whole limit before the site is full,
  and never as equal to a limit it has not reached (F-249: a 2000 MB limit
  reads "2 GB", 1990 MB used "1.9 GB"). The app reads the limit as
  `env.STORAGE_LIMIT_BYTES`, renamed from `STORAGE_LIMIT_MB` by a transform in
  `env.server.ts`. A full site rounds its usage up too, so it never reads as
  below the limit under the full line (F-250). Beat: rounding both down, which
  showed "1.9 GB of 1.9 GB" with room left; rounding to nearest, which shows
  "2 GB of 2 GB" with room left.
- **Checked after the file's real size is known, before R2, with no lock.**
  Two uploads at once can pass the limit by one file each - the plan's accepted
  race. Beat: a row lock or a reservation, which costs code for a 10 MB error
  at most.
- **Refused with status 413**, like the per-file cap: the request is larger
  than the site has room for. Beat: 403 (not a permission) and 507 (WebDAV's).
- **The usage meter is a native `<meter>`**, not the mock's
  `div role="img"` - coding-standards' semantic HTML rule ("ARIA only where no
  native element exists") beats the mock's markup; the look is the mock's.

## Production needs

- `STORAGE_LIMIT_MB` - optional; unset gives 500 MB. Set it in
  `/etc/habre-cms/production.env` only if the owner picks another Free number
  (`needs-you.md`, *Free plan limits*).
- No migration.

## Behaviour changes

- New capability `limits`: an upload that would take a site's media past its storage limit (`STORAGE_LIMIT_MB`, 500 MB unless set) is refused with a message naming the limit, and no media row is added - Step 2
- Adds to `limits`: the Media screen shows the site's storage used out of its limit with a meter, and says when it is full - Step 3
- Adds to `limits`: deleting an image lowers the storage the Media screen shows as used - Step 3
- Adds to `limits`: with `STORAGE_LIMIT_MB=none` no upload is refused for storage and Media shows only the space used - Step 3
- Adds to `limits`: an invalid `STORAGE_LIMIT_MB` stops the app at startup with a message naming the variable - Step 1

## Notes

- **Two guards (D151):** `storageUsed` runs inside `inSite(siteId, ...)` and
  names `site_id` in its own `where`; the action passes the member's `siteId`
  from `userContext`.
- **Quality bar:** uploads keep the 10 MB per-file cap; the sum runs over at
  most a few thousand rows per site through an existing index, so no new
  number applies. Nothing here touches authentication or personal data.
- **Existing over-limit sites** (the limit lowered later, or the race) keep
  every image and their published pages; only new uploads are refused (D150).
- **The banner and the full line follow design.md's conventions:** an action
  failure is the error `Message` (`role="alert"`); the full line is plain muted
  text, not a second alert, because nothing failed yet.
- **Words:** "Storage", "used", "MB" - no "quota", no "bytes".
- The media picker in the editor links to Media to upload, so this action is
  the only upload path; nothing else writes `media`.
- `needs-you.md`'s screen-reader pass is widened to Media's storage meter.

## Findings

### 15d-storage-cap/F-248 [P2] closed - Media cards show an image's size about 1024 times too large
File: app/features/media/media-list.tsx:134-137 (`formatByteSize`)

**Found:** 2026-10-04 by review (independent `reviewer` agent; scope: current, item 15d, main b34bcab + working tree; lens: all). Pre-existing since item 5a (`d4950b6`), not introduced by 15d.
**Why it matters:** `formatByteSize` divides by 1024 once and labels the result MB, so a 10 MB image reads "10240.0 MB" - under 15d's "30 MB of 500 MB used" on the same screen. Reproduced: `(10485760/1024).toFixed(1)` -> `10240.0`; visible in the 15d screenshots. No test asserts the text.
**Suggested fix:** Divide by `1024 * 1024` in the MB branch (or reuse `formatStorage`, deciding whether small files keep KB), plus a unit test once the function moves to a `.ts` file.
**Resolution:** Moved to `app/features/media/file-size.ts` as `formatFileSize`, MB divides by 1,048,576. Test `file-size.test.ts` ("a 10 MB file is shown as 10.0 MB"): red on the old arithmetic (`actual: '10240.0 MB'`), red again with the repair reverted, green restored. `npm run verify` 506/506. Closed by build, 2026-10-04.

### 15d-storage-cap/F-249 [P3] closed - A limit that is not a whole tenth of a GB can read as equal to the usage while the site is not full
File: app/features/media/storage-limit.ts:20-26 (`formatStorage`)

**Found:** 2026-10-04 by review (independent `reviewer` agent; scope: current, item 15d; lens: all)
**Why it matters:** `formatStorage` rounds the limit down as well as the usage, so `STORAGE_LIMIT_MB=2000` shows the limit as "1.9 GB" and 1990 MB used as "1.9 GB of 1.9 GB used" with no full line; the refusal also names "1.9 GB". Only with a non-default limit. Reproduced with the same arithmetic in `node -e`.
**Suggested fix:** Round the limit up (or show it exactly, e.g. MB below 10 GB), with a unit test for `storageSummary(1990 * MB, 2000 * MB)`.
**Resolution:** Added `formatStorageLimit` (rounds up) beside `formatStorage` (rounds down), one `formatAmount` underneath; `storageSummary`'s `limitText` and the refusal use it. Tests in `storage-limit.test.ts` (`formatStorageLimit(2000 MB)` is "2 GB"; `storageSummary(1990 MB, 2000 MB)` is "1.9 GB" of "2 GB", not full): red before (`actual: '1.9 GB'`), red with the repair reverted, green restored. `e2e/storage-limit.spec.ts` 5/5. Closed by build, 2026-10-04.

### 15d-storage-cap/F-250 [P3] closed - A full site can show usage below its limit, under the "used all of its storage" line
File: app/features/media/storage-limit.ts:42 (`storageSummary`)

**Found:** 2026-10-04 by review (independent `reviewer` agent; re-review of the F-248/F-249 repairs, item 15d)
**Why it matters:** F-249's repair rounds the limit up but usage still down, so `storageSummary(2000 MB, 2000 MB)` gives "1.9 GB of 2 GB used" above "Your site has used all of its 2 GB of storage." Only with a non-default limit that is not a whole tenth of a GB.
**Suggested fix:** When full, round usage up too: `usedText: isFull ? formatStorageLimit(used) : formatStorage(used)`, with a test that `storageSummary(2000 MB, 2000 MB).usedText` is "2 GB".
**Resolution:** `storageSummary` rounds usage up when full. Test "a full site shows usage no lower than its limit (F-250)" in `storage-limit.test.ts`: red before (usage "1.9 GB"), red with the repair reverted, green restored. `npm run verify` 507/507; `e2e/storage-limit.spec.ts` 5/5. Closed by build, 2026-10-04.
