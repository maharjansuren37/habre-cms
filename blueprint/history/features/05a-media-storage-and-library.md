# Feature: Media storage and library

**From build plan:** item 5a
**Type:** Feature
**Status:** built, all six steps complete

## Goal

Let any signed-in writer upload an image to Cloudflare R2 and see it in a shared
`/admin/media` library - the storage and reuse half of item 5. This item does
**not** touch the block editor or the public site; it stops at "the file exists,
is listed, and can be deleted."

## In scope

- `media` table (the shape the plan already committed to in D-notes: `id`,
  `storage_key`, `filename`, `mime_type`, `byte_size`, `width`, `height`,
  `alt_text`, `uploaded_by`, `created_at`).
- R2 client (`aws4fetch`) - upload and delete one object.
- Upload validation: 10 MB cap, JPEG/PNG/WebP/GIF only, checked against the
  actual image bytes (`image-size`), not just the browser's declared MIME type.
- `/admin/media` - upload form plus a library of everything anyone has
  uploaded (shared, not siloed per author - see Decisions).
- `/admin/media/:id/delete` - confirm-then-delete, ownership-scoped the way
  the plan's permission table states it (authors delete only their own;
  editors and admins delete any).
- "Media" added to the admin shell nav.

## Out of scope

- Inserting an image into a post - item 5b, an Editor.js image block.
- Rendering an image on the public site - item 5c.
- Editing an uploaded file's alt text after upload, or replacing its image
  data - alt text is captured once, at upload (see Decisions); revisit if a
  real need for changing it later shows up.
- Resizing or generating thumbnails - `quality-bar.md` names this the known
  first bottleneck and explicitly scopes it out of v1.
- Anything about pages (item 6) or site settings (item 7).

## Design reference

No mockup covers this screen - `prototype`'s mockups never included a media
library, and they are already consumed and deleted. Build it from the
conventions `design.md` already locked for other admin screens: bordered-card
list (`post-list.module.css`'s pattern), the same `Button` variants, the same
`Message` success/error banners, the same empty-state and delete-confirmation
shape as posts. The one new call this item makes - thumbnails in a grid rather
than a text table, since these rows are images - gets recorded in `design.md`
once built (see step 5), the way `design.md` already asks a discovered gap to
be written back rather than left implicit.

## Build steps

- [x] **Step 1 - `media` table** - `db/migrations/0004_media.sql`: `id` uuid
      pk, `storage_key` text unique not null, `filename` text not null
      (1-255 chars), `mime_type` text not null (check: one of
      `image/jpeg`, `image/png`, `image/webp`, `image/gif`), `byte_size`
      integer not null (check: `> 0 and <= 10485760`), `width`/`height`
      integer not null (check: `> 0`), `alt_text` text not null (1-250
      chars), `uploaded_by` uuid not null references `users(id)` on delete
      restrict (authorship survives deactivation, matching `entries`),
      `created_at` timestamptz not null default now(). Index on
      `uploaded_by` (matches `entries_author_id_idx`'s reason - ownership
      checks need it). *Done when:* `npm run db:migrate` applies cleanly
      against the development database; `\d media` in `psql` shows every
      column and constraint above.

- [x] **Step 2 - R2 client and environment** - install `aws4fetch` 1.0.20 and
      `image-size` 2.0.4, pinned exactly (D20). Add `R2_ACCOUNT_ID`,
      `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` (required
      strings) and `R2_PUBLIC_URL` (`z.url()`) to `envSchema` in
      `app/lib/env.server.ts`. `app/features/media/r2.server.ts`:
      `uploadObject(key, body, contentType)` and `deleteObject(key)`, signed
      with `aws4fetch`'s `AwsClient` against
      `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${key}`.
      *Done when:* the app refuses to start with a clear message if any R2
      variable is missing, matching the existing `JWT_SECRET` pattern; a
      manual check uploads a small test object to the real development R2
      bucket, confirms it is retrievable, then deletes it and confirms it is
      gone. **This step needs `R2_PUBLIC_URL` filled in `.env` first** - see
      Notes.

- [x] **Step 3 - upload validation (pure logic)** -
      `app/features/media/media-input.ts`: `isUploadSizeAllowed(headers)`
      (10 MB `Content-Length` cap, mirrors `isPostBodySizeAllowed`);
      `detectImage(buffer)` using `image-size` on the actual bytes, returning
      the real `{ type, width, height }` or a refusal when the bytes are not
      a decodable image or the detected type is not one of the four allowed
      (catches a renamed non-image, not just a lying `Content-Type` header);
      `altTextSchema` / `filenameSchema` (Zod, capped lengths, reusing
      `isStorableText` from `inline-runs.ts` to refuse U+0000 and lone
      surrogates the same way `entry-input.ts` does for a title).
      `app/features/media/storage-key.ts`: `generateStorageKey(type)` ->
      `${randomUUID()}.${extension}`, extension taken from the *detected*
      type, never the client's filename. *Done when:* unit tests show
      `detectImage` accepting a real small JPEG/PNG/WebP/GIF fixture with
      correct dimensions, and refusing a non-image buffer and a text file
      renamed `.jpg`; `generateStorageKey` produces a unique key whose
      extension matches the detected type.

- [x] **Step 4 - upload action and media queries** -
      `app/features/media/media.server.ts`: `insertMedia(...)`,
      `listMedia(query)` (paginated, `MEDIA_PAGE_SIZE`, newest first, every
      role sees every file - Decisions), `deleteMedia(id, actor)`
      (ownership-scoped, mirrors `ownedBy`'s shape but keyed on
      `uploaded_by`). `/admin/media` (`media-list.tsx`): loader lists media
      and resolves each row's URL via a pure `buildMediaUrl(publicUrl,
      storageKey)` helper; action runs the upload end to end - size check,
      parse `request.formData()`, validate file and alt text, `detectImage`,
      `generateStorageKey`, `r2.uploadObject` (object first), `insertMedia`
      (row second, per the plan's data rule - a failure between the two
      leaves a harmless orphaned object, not cleaned up), redirect with a
      success banner. *Done when:* uploading a valid JPEG under 10 MB
      succeeds and appears in the grid with a working thumbnail; a file over
      10 MB is refused with an on-page message and the form stays usable, not
      a thrown 500 (the mistake F-39 flagged for posts); a renamed non-image
      and an empty alt-text field are each refused by name, not a generic
      error.

- [x] **Step 5 - library screen and nav entry** - build `/admin/media`'s UI:
      upload control (file input, alt text field, primary "Upload" button,
      same placement convention as "New post") above a thumbnail grid
      (image, filename, dimensions, uploader, uploaded date, a "Delete" link
      shown only when the viewer may use it). Empty state matches the
      existing pattern. Add "Media" to the admin shell nav
      (`admin-shell/layout.tsx`) right after "Posts" - D35's rule is ship
      order, not the eventual Posts/Pages/Media/Settings/Users order
      `design.md` already names. Record the thumbnail-grid convention in
      `design.md`, since no mockup covered it. *Done when:* screenshots in
      both light and dark show the grid, upload control and nav entry
      matching the established component conventions (contrast, focus,
      spacing); works with the file input's native submit (no JS required
      for the upload itself, per D10).

- [x] **Step 6 - delete, with confirmation** -
      `/admin/media/:id/delete` (`media-delete.tsx`), same shape as
      `post-delete.tsx`: GET shows the thumbnail, filename, "this cannot be
      undone", Cancel and a destructive-styled "Delete image" button; POST
      calls `deleteMedia`, and on success removes the R2 object (row first,
      per the plan's data rule), then redirects to `/admin/media?deleted=
      <filename>` with a success banner (a small `banner.ts` local to
      `media/`, not a reuse of content's - different route, different verb
      set). A request for an id the actor cannot delete gets the same
      not-found response as one that does not exist, matching
      `findEntryForUser`'s rule. *Done when:* an author cannot delete
      another author's upload (404, not a 403 that confirms it exists); a
      successful delete removes both the database row and, checked directly
      against R2, the object itself.

- [x] **Repair F-74** - a delete that fails writing to R2 shows a generic
      error page even though the row - the thing that decides whether the
      image still exists - was already removed. Wrap `deleteObject` in its
      own `try`/`catch` in `media-delete.tsx`'s action; on failure, log it
      and still return the success banner, since the row is the source of
      truth. *Done when:* a delete whose R2 call fails still redirects to
      `/admin/media?deleted=<filename>` with the success banner, and the
      failure is logged rather than silently dropped.

- [x] **Repair F-73** - the media grid's "Delete" link has no per-item
      accessible name. Add a `.visually-hidden` filename suffix, matching
      `post-list.tsx`'s pattern exactly; add a sentence to `design.md`'s
      *Media library* entry documenting it, matching how *Lists* documents
      its own delete link. *Done when:* each card's delete link has a
      distinct accessible name (e.g. "Delete 1x1.jpg"), checked in the
      rendered DOM, not just the source.

- [x] **Repair F-75** - a media page number past the last page renders a
      false "No images uploaded yet." with a dead-end "Previous" link, the
      same bug F-56 found for posts. In the loader, when the requested page
      is past `totalPages` and there is at least one image, redirect to the
      last real page. *Done when:* requesting a page past the end redirects
      to the last real page instead of showing a false empty state.

## Files and areas

- `db/migrations/0004_media.sql` - new
- `app/lib/env.server.ts` - add the five `R2_*` variables
- `package.json` / `package-lock.json` - add `aws4fetch`, `image-size`
- `app/features/media/` - new: `r2.server.ts`, `media-input.ts`,
  `storage-key.ts`, `media.server.ts`, `media-list.tsx`,
  `media-list.module.css`, `media-delete.tsx`, `banner.ts`
- `app/routes.ts` - add `admin/media` and `admin/media/:id/delete`
- `app/features/admin-shell/layout.tsx` - Media nav entry
- `blueprint/context/design.md` - record the thumbnail-grid convention once built

## Data and contracts

- **`media` table**, locked for 5b and 5c to build against:
  `id, storage_key, filename, mime_type, byte_size, width, height, alt_text,
  uploaded_by, created_at`. No caption column - `design.md`'s public-site line
  mentions a "muted caption" under images, which this table does not carry;
  5c has to resolve that gap against the data model rather than assume one.
- **A media id is the only thing a block will ever store** - the URL is
  always resolved from `storage_key` via `R2_PUBLIC_URL` at read time, through
  the one `buildMediaUrl` helper both 5b's editor preview and 5c's public
  renderer will call, never stored or duplicated.
- **Alt text lives on the media row**, one value, reused wherever the image
  is placed (see Decisions) - 5b does not add a second, per-use alt field.

## Testing

- Unit (`node --test`): `detectImage` against real small image fixtures
  (accept) and a non-image / disguised file (refuse); `isUploadSizeAllowed`
  boundary; `generateStorageKey`'s extension mapping; `altTextSchema` /
  `filenameSchema` refusing U+0000 and a lone surrogate.
- `deleteMedia`'s ownership branching needs a database, so it is proven by
  manual/browser verification instead, the same gap F-25 notes for a
  database-dependent case that unit tests cannot reach.
- Browser (manual, and worth an `e2e/media.spec.ts` matching the project's
  existing per-feature specs): upload a real fixture image against the
  actual development R2 bucket, see it listed, delete it, confirm both the
  row and the R2 object are gone; a second account proves an author cannot
  delete another author's upload.

## Decisions

- **The library lists every uploaded file to every role; only deletion is
  ownership-scoped for authors.** The plan's permission table says "Media:
  author - upload; delete own" and says nothing about listing - but the
  product scope is "media library **to reuse them**", which requires seeing
  what other people uploaded, not just your own. Beats the alternative (silo
  per author) because it is what "reuse" in the plan's own wording requires.
- **Alt text is required at upload, not editable afterward, and stored once
  on the media row** rather than per block-use. This item is the only place
  in v1 that touches alt text, so requiring it here is the cheapest way to
  guarantee every image placed by 5b already has one, rather than shipping
  images with no alt text and adding an enforcement step later. Beats making
  it optional-then-nagged, which is exactly the kind of debt this project's
  own findings ledger already has several open accessibility items for.
- **Storage keys are generated (`randomUUID + detected extension`), never
  derived from the client's filename.** The original filename is kept only in
  the `filename` column, for display - not used as or folded into the R2
  object key. Beats keeping the client's name in the key, which would need
  its own sanitizing and can still collide.
- **The image's real bytes decide its type**, via `image-size`, not the
  browser's `Content-Type` header. Beats trusting the header alone, which a
  crafted upload can lie about - the same reasoning the project already
  applies to blocks: validated at the boundary, not assumed from the client.

## Notes

- **`R2_PUBLIC_URL` is still empty in the local `.env`**
  (`blueprint/context/needs-you.md`, open, "blocks item 5"). Steps 1, 3 and 4's
  logic do not need it, but `env.server.ts` validates its whole schema at
  once - the moment step 2 adds `R2_PUBLIC_URL` to that schema, the app will
  not start at all (dev, test, or otherwise) until a real value is there. Get
  a public URL for the R2 images bucket (the bucket's own `r2.dev` address is
  enough to start; a custom domain can follow later) before running `build`
  past step 2.
- Upload/delete ordering (object-then-row on upload, row-then-object on
  delete) and "an orphaned object is harmless, not cleaned up" both come
  straight from the plan's Data rules - do not add cleanup logic for the
  failure window, that would be solving a problem the plan already decided
  is not worth solving.
- No SVG, ever - it can carry script (plan's Integrations section).
- This item adds the project's first multipart file upload. `request
  .formData()` gives real `File` objects under the Fetch API this app already
  runs on - no new body-parsing dependency needed.

## Findings

### 05a/F-73 [P2] closed - The media grid's "Delete" link has no per-item accessible name, unlike content's own already-solved version of the same problem

**File:** app/features/media/media-list.tsx:176-180
**Found:** 2026-09-22 by review (scope: current; lens: accessibility)
**Why it matters:** Every card in the grid renders `<Link>Delete</Link>` with no distinguishing text. A screen-reader user tabbing through the page, or opening a links list (a common way to scan a page quickly), hears "Delete, Delete, Delete..." with nothing to tell them which image each one removes - WCAG 2.2 2.4.4 Link Purpose (In Context), included in the AA bar this project holds itself to (`design.md`). **This exact problem was already solved two features over**: `app/features/content/post-list.tsx:164-165` renders `Delete<span className="visually-hidden"> {post.title}</span>`, using the `.visually-hidden` utility class already defined in `app/app.css:120`. Media's own delete link does not reuse it. `design.md`'s new *Media library* entry (this item) also never mentions the delete link at all, unlike the *Lists* entry right above it, which documents its own delete link's contrast numbers (6.0:1 / 7.8:1) - the record is silent on the one interactive control this finding is about.
**Suggested fix:** `Delete<span className="visually-hidden"> {item.filename}</span>`, matching `post-list.tsx` exactly. Add a sentence to `design.md`'s *Media library* entry once fixed, the way *Lists* documents its own delete link.
**Resolution:** Repaired 2026-09-22 by build, exactly as suggested: `media-list.tsx`'s delete link now reads `Delete<span className="visually-hidden"> {item.filename}</span>`; `design.md`'s *Media library* entry now documents the delete link's colour and the visually-hidden suffix, matching how *Lists* documents its own. **Proven in the rendered DOM, not the source:** two images uploaded, Playwright's `getByRole("link", { name: /^Delete/ })` driven against the live page returned two links with accessible names `"Delete 1x1.webp"` and `"Delete 1x1.gif"` - distinct, not both bare "Delete". `npx tsc -b`, `npm run lint`, `npm test` (174/174) all clean. Status `fixed` for `review` to close.
**Closed 2026-09-22 by review**, second pass: re-read `media-list.tsx` fresh - the fix is exactly as recorded, `design.md`'s entry matches the code, and nothing else in the file changed. Status `closed`.

### 05a/F-74 [P2] closed - A delete that fails writing to R2 shows the user a generic error page, even though the row - the thing that decides whether the image still exists - was already removed

**File:** app/features/media/media-delete.tsx:37-44 (`action`)
**Found:** 2026-09-22 by review (scope: current; lens: quality)
**Why it matters:** The action calls `deleteMedia` (commits the row delete) and then `deleteObject` (removes the R2 object), with no `try`/`catch` between them. If R2 is unreachable or errors at that moment - a scenario the plan's own system-design section names as real ("R2 down means images missing, text still served") - `deleteObject` throws, the error propagates to the root `ErrorBoundary`, and the person sees "Oops! An unexpected error occurred." **But the row is already gone** - `listMedia` and `findMediaForUser` both read from the table, so the application already treats the image as deleted. The person is told the action failed when the part that matters (the file no longer being in the library) actually succeeded, and a retry hits `deleteMedia` again, finds no row, and answers a confusing 404 instead of the success banner they expected the first time. This is not the same as the accepted upload-orphan case (plan: "a failure between leaves an unreferenced object - harmless") - that failure is invisible to the uploader, who correctly sees their save fail. This one shows failure for an action that succeeded. `fundamentals.md`, Errors: "Fail loudly at the boundary, not silently in the middle" - here the boundary is not the deletion (real success) but the R2 mop-up, which is failing loudly on behalf of the wrong step. OWASP Top 10:2025 A10, Mishandling of Exceptional Conditions.
**Suggested fix:** Wrap `deleteObject` in its own `try`/`catch`; on failure, log it (`console.error`, matching `server.js`'s own pattern for what escapes the framework) and still return `mediaBannerRedirect("deleted", deleted.filename)` - the row is the source of truth, and a stray R2 object left behind is exactly as harmless as the one the plan already accepts on the upload side.
**Resolution:** Repaired 2026-09-22 by build, exactly as suggested: `deleteObject` wrapped in `try`/`catch` in `media-delete.tsx`'s action, failure logged via `console.error` (matching `server.js`'s pattern), success banner still returned. **Proven with a genuine R2 failure, not a mock:** uploaded a real image with correct credentials, restarted the server with a deliberately wrong `R2_SECRET_ACCESS_KEY`, then deleted that image - R2 answered a real `403 SignatureDoesNotMatch`, the server log shows `Failed to delete R2 object for media <id>: Error: R2 delete failed...`, and the request still got `302 /admin/media?deleted=1x1.png` with the row confirmed gone from the database. `npx tsc -b`, `npm run lint`, `npm test` (174/174) all clean. Status `fixed` for `review` to close.
**Closed 2026-09-22 by review**, second pass: re-read `media-delete.tsx` fresh - the `try`/`catch` is exactly as recorded, still deletes the row first and returns the success banner regardless of the R2 outcome, and the rest of the action is unchanged. Status `closed`.

### 05a/F-75 [P3] closed - A media page number past the last page renders a nonsensical pagination state, the same bug F-56 already found for posts

**File:** app/features/media/media-list.tsx:185-193, app/features/media/media.server.ts:70-86 (`listMedia`)
**Found:** 2026-09-22 by review (scope: current; lens: quality)
**Why it matters:** `listMedia(page)` computes `total`/`totalPages` from an unfiltered `count(*)`, independent of the requested `page`, and returns an empty `media` array once `page` is past the real last page. The component then shows "No images uploaded yet." even though images exist - untrue, the same false-empty-state shape F-56 recorded for `/admin/posts`. Worse here: the pagination nav's own guard is `totalPages > 1`, which is still true (the real count did not change), so `Page 10 of 3 (50 images)` can render with a "Previous" link that goes to another equally out-of-range page - there is no way back to page 1 without editing the URL by hand. Reachable exactly the way F-56 describes: bookmark a later page, then delete media (this item's own step 6) until fewer than `MEDIA_PAGE_SIZE` remain.
**Suggested fix:** Same as F-56's - in the loader, when `page > totalPages && total > 0`, redirect to the last real page.
**Resolution:** Repaired 2026-09-22 by build, exactly as suggested: the loader now redirects to `mediaListHref(list.totalPages)` when `page > list.totalPages && list.total > 0`. **Proven against the running app:** with one image uploaded (`totalPages = 1`), requesting `?page=9` answered `302` to `/admin/media` rather than a false empty state; with zero images, the same `?page=9` correctly answered `200` with the real empty state (no infinite-redirect risk from the `total > 0` guard). `npx tsc -b`, `npm run lint`, `npm test` (174/174) all clean. Status `fixed` for `review` to close.
**Closed 2026-09-22 by review**, second pass: re-read the loader fresh - the guard is exactly as recorded, ordered before the banner read, and the `total > 0` clause is present so a genuinely empty library still renders rather than redirecting forever. Status `closed`.
