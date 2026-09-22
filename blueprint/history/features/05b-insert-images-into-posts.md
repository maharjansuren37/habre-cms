# Feature: Insert images into posts

**From build plan:** item 5b
**Type:** Feature
**Status:** shipped 2026-09-22

## Goal

Let a writer place an already-uploaded image from the media library into a post,
as a real block the public site can render - the "insert" half of item 5, sitting
between item 5a (upload and library, shipped) and item 5c (public rendering,
plan's own line: "resolve a media id to its URL at render time").

**This item ends up doing a slice of 5c's job too, and that is not optional.**
`render.tsx`'s block switch is written to fail at compile time, not silently at
render time, the moment a fourth block type exists (`render.tsx:31`'s own
comment says so). The instant `image` is added to `blockSchema`, `tsc -b`
refuses to build until `render.tsx` handles it for real - and production is
live, so a throwing stub would 500 the public site the first time a writer
publishes a post with an image in it. So this item includes a real, working
`<img>` on `/posts/:slug`, not a placeholder. What is left for 5c afterward is
narrower: captions (design.md's "muted caption" line has no data model to back
it - see Decisions), responsive sizing, and whatever else review or use turns up
- not resolving a media id at all, which this item already builds.

## In scope

- An `image` block type: `{ id, type: "image", data: { mediaId } }` - the media
  id is the **only** thing stored, per item 5a's own locked contract.
- A custom Editor.js tool (not the `@editorjs/image` package - see Decisions)
  added to the + toolbox: a placeholder with a "Choose image" button, which
  opens a picker dialog listing the media library; selecting an image sets the
  block and shows a live preview with its alt text underneath.
- A small JSON endpoint, `/admin/media/picker`, the picker dialog fetches from -
  paginated, reusing `listMedia`.
- Resolving a block's `mediaId` to a real image everywhere it is read: the post
  editor (reopening a saved post shows its images immediately) and the public
  post page (a real `<img>`, sized from the stored width/height, `loading="lazy"`).
- Graceful handling of a `mediaId` that no longer resolves (the file was
  deleted from the library after being placed) - see Decisions.
- Correcting `design.md`'s "Image blocks show the alt text field directly below
  the image" line, written before item 5a decided alt text is fixed at upload
  (D55) - the field described there does not exist; what is built is a
  read-only display of the media's own alt text.

## Out of scope

- **Uploading a new image without leaving the post editor.** This item only
  picks from what `/admin/media` already has. See Decisions for the reasoning,
  and weigh it against "ease of use is the product" at the review gate below -
  this is the one scope cut most worth pushing back on.
- **Editing alt text from the post editor**, or a per-placement caption
  override. Alt text is one value per file (D55); there is no caption column
  on `media` (item 5a's `Data and contracts`), so there is nothing to edit here.
- **Captions on the public page.** `design.md`'s "Public site" line already
  says images show a "muted caption" - there is no data for one. 5c has to
  resolve that gap; this item does not invent a caption field to fill it.
- **Resizing, `srcset`, or any responsive image handling** beyond a plain
  `loading="lazy"` attribute. `quality-bar.md` names this the known first
  bottleneck and explicitly scopes it out of v1.
- **Search or filter inside the picker.** Browse only, paginated the same
  page size as `/admin/media` (24). Revisit if the library gets big enough
  that scrolling pages is slow at quality-bar's "a few thousand" scale.
- **Preventing a media file from being deleted while a post still references
  it.** `/admin/media/:id/delete` (item 5a) has no way to know a block points
  at the row it is about to remove - a JSON blob is not a foreign key. Degrading
  gracefully (see Decisions) is this item's answer; blocking the delete is not.
- **Item 6 (Pages).** Pages will reuse `renderBlocks`/`toEditorJs` and their now
  -locked `mediaById` contract, but wiring a pages loader to build that lookup
  is item 6's own work.

## Design reference

No mockup covers the picker dialog or the image block's built state -
`prototype`'s pages predate the media library entirely and are already
consumed and deleted, the same situation item 5a was in. Built from the
conventions `design.md` already locked: `Button` variants, the bordered-card
and grid shapes from *Media library*, the native `<dialog>` element for the
picker (no custom focus-trap/overlay code to get subtly wrong - the platform
already does this). The existing "Editor" bullet's claim about an editable
alt-text field is corrected by this item, not built to - see Decisions and
step 5.

## Build steps

- [x] **Step 1 - Data contract: the `image` block, and a real (not stub)
      public render** - `app/features/blocks/blocks.ts`: add `imageBlock`
      (`data: { mediaId: z.uuid() }`) to `blockSchema`'s discriminated union;
      extend `EDITOR_JS_TYPES` with `image: "image"`; `fromEditorJs` validates
      and passes the id through; `toEditorJs` and a new `ImageMediaSummary`
      type both take an optional `mediaById: Record<string, ImageMediaSummary>`
      (default `{}`) and, for an image block, either fill in the resolved
      `{ url, altText, width, height }` or mark `{ missing: true }` when the id
      is not in the map; a new pure `collectImageMediaIds(blocks)` extracts the
      unique ids a set of blocks references. `app/features/blocks/render.tsx`:
      `renderBlocks` takes the same optional `mediaById`; the `image` case
      renders a real `<img>` (`width`/`height` from the stored dimensions,
      `loading="lazy"`, `--radius-lg` per `design.md`) when the id resolves, and
      renders nothing when it does not (plan's own stance: "R2 down means
      images missing, text still served") - `app/features/public-site/post.module.css`
      gets the image rule. *Done when:* `npm run verify` passes with the new
      block type (this is what proves the exhaustive switch is satisfied, not
      a stub); unit tests in `blocks.test.ts` cover `fromEditorJs` accepting a
      well-formed image block and refusing a non-uuid `mediaId`, `toEditorJs`
      resolving a known id from `mediaById` and marking an unknown one
      `missing`, and `collectImageMediaIds` deduping ids across several blocks.

- [x] **Step 2 - The picker endpoint** - `app/features/media/media-picker.ts`,
      a GET-only resource route added to the guarded admin layout in
      `app/routes.ts` (`admin/media/picker` - no `requireUser` of its own, the
      layout already applies it, matching `post-list.tsx`'s convention, not
      `post-delete.tsx`'s redundant one, F-58). Reuses `listMedia` and
      `buildMediaUrl`; **clamps an out-of-range `page` to the last real page
      before querying**, rather than returning an empty result for a page past
      the end - the same shape of bug F-56 and F-75 already found twice, closed
      here before review has to find it a third time. Returns
      `{ media: [{ id, url, filename, altText, width, height }], page, totalPages }`.
      *Done when:* signed in, fetching `/admin/media/picker` returns real JSON
      for the uploaded fixtures; requesting a page past the end returns the
      last real page's data, not an empty list; signed out, the layout's own
      guard redirects to login exactly as every other admin route already
      does.

- [x] **Step 3 - The image tool and its picker dialog** -
      `app/features/blocks/image-tool.client.ts` (vanilla DOM, `.client.ts`
      per the project's own boundary rule - this is the first hand-written
      Editor.js Tool, not an npm package, so there is no JSX here to justify
      `.tsx`), `image-tool.module.css`. A `Tool` class: `render()` shows a
      bordered placeholder with a "Choose image" button (`toolbox: { title:
      "Image", icon: <svg> }`, no inline toolbar - the block holds no text);
      the button opens a `<dialog>` (`showModal()`, closes on Escape, backdrop
      click, or its own Close button - all free from the native element)
      listing thumbnails fetched from step 2's endpoint, Previous/Next between
      pages, a muted "Loading…" line while a page fetches, and an empty state
      pointing at `/admin/media` (opens in a new tab, so the post is never
      left mid-edit) when the library has nothing yet. Each thumbnail is a
      `<button>` whose visible filename is its own accessible name - unlike
      the bare "Delete" links F-73 had to fix, there is nothing identical to
      tell these apart, so no visually-hidden suffix is needed. Selecting one
      closes the dialog, sets the block's `mediaId`, and shows the preview -
      the image, its filename, and its alt text as plain read-only text
      beneath it (not an input - see Decisions) - with a quiet "Change image"
      button that reopens the same dialog. `save()` returns `{ mediaId }` only,
      whatever else the instance is holding for display. Wired into
      `app/features/blocks/editor.client.tsx`'s `tools` config. *Done when:*
      from a new post, clicking + then Image, then choosing an uploaded fixture
      in the dialog, shows that image with its alt text in the block; the
      dialog's Escape key, backdrop click, and Close button each close it
      without selecting anything; saving the draft and reading the row back
      from the database shows `blocks` containing exactly
      `{ id, type: "image", data: { mediaId } }` for that block - no url, no
      alt text, no filename.

- [x] **Step 4 - Hydration: existing images resolve without a round trip** -
      `app/features/media/media.server.ts`: `findMediaByIds(ids)`, a single
      `where id = any(...)` query, unscoped by actor (matches `listMedia` -
      every role sees every file, D54). `app/features/content/post-edit.tsx`'s
      loader: `collectImageMediaIds(entry.blocks)` -> `findMediaByIds` ->
      `buildMediaUrl` -> a `mediaById` passed down through `PostForm` and
      `BlockEditor` into `toEditorJs`. `app/features/public-site/post.tsx`'s
      loader: the same three calls, feeding `renderBlocks`. *Done when:*
      reopening a post saved in step 3 shows its image immediately, with no
      picker round trip and no flash of "loading" (this is what step 3
      deliberately left unproven); publishing that post shows a real `<img>`
      on `/posts/:slug` in the browser, not a missing-image icon; deleting
      that file from `/admin/media` and reopening the post shows the block as
      "no longer available" rather than crashing the editor, and the public
      page silently drops that block rather than 500ing; the public page's own
      server-render time (excluding image transfer, `quality-bar.md`'s own
      carve-out) stays in the existing single-digit-millisecond range - one
      indexed query added, not one per image.

- [x] **Step 5 - Correct the design record, document what was built** -
      `design.md`: the "Editor" bullet's "Image blocks show the alt text field
      directly below the image" is reworded to describe what is actually
      there (a read-only line, not a field), with the reason (D55, decided
      after this line was written); a new bullet documents the image block and
      picker dialog - the placeholder, the grid, the empty state, the
      Escape/backdrop-close, contrast numbers for anything new (the picker's
      own surface and border, the "Change image" quiet button). Screenshots
      under `blueprint/reference/5b-image-block/`, light and dark: the
      placeholder, the open picker, and a placed image. *Done when:*
      `design.md` no longer describes a field that does not exist; the new
      bullet's contrast numbers are measured, not asserted; screenshots exist
      for both themes.

- [x] **Step 6 - Repair F-76** - picking an image left keyboard focus on
      `<body>` instead of the new "Change image" button. `app/features/blocks/image-tool.client.ts`:
      the thumbnail's click handler now closes the dialog *before* calling
      `onSelect`, not after - closing it first, rather than only moving the
      explicit `.focus()` call earlier, because everything outside an open
      modal `<dialog>` is inert (unfocusable) per the platform's own rules, so
      the button `onSelect`'s `renderContent()` just inserted cannot receive
      focus while the dialog is still open, whichever line the `.focus()`
      call sits on. *Done when:* `document.activeElement` is the "Change
      image" button immediately after picking, not `<body>`; the three
      dismissal paths (Escape, backdrop, Close) still restore focus to
      "Choose image"/"Change image" exactly as before.

- [x] **Step 7 - Repair F-77** - `e2e`'s `logIn` had drifted to five
      byte-identical copies. Extracted to `e2e/helpers/auth.ts`, imported by
      `image-block.spec.ts`, `inline-formatting.spec.ts`, `manage-posts.spec.ts`
      and `write-post.spec.ts`; `auth.spec.ts` kept its own version, since it
      exercises login's failure paths and needs to control navigation and the
      success wait independently. Along the way, a full `npx playwright test`
      run (not previously run for this item - only `e2e/image-block.spec.ts`
      had been) surfaced `write-post.spec.ts`'s block-menu test asserting an
      exact list that predates this item's own `image` tool - fixed in the
      same step, since it is this item's own regression. It also surfaced
      F-78, an unrelated pre-existing flaky assertion in `manage-posts.spec.ts`
      - filed, not fixed here. *Done when:* no file defines its own copy of
      `logIn` except `auth.spec.ts`; `npm run verify` passes; a full
      `npx playwright test` run passes end to end.

## Files and areas

- `app/features/blocks/blocks.ts`, `blocks.test.ts` - image block schema,
  `ImageMediaSummary`, `collectImageMediaIds`
- `app/features/blocks/render.tsx` - `image` case, `mediaById` param
- `app/features/blocks/image-tool.client.ts`, `image-tool.module.css` - new
- `app/features/blocks/editor.client.tsx` - register the tool
- `app/features/media/media-picker.ts` - new resource route
- `app/features/media/media.server.ts` - `findMediaByIds`
- `app/routes.ts` - add `admin/media/picker`
- `app/features/content/post-edit.tsx`, `post-form.tsx` - `mediaById` wiring
- `app/features/public-site/post.tsx`, `post.module.css` - `mediaById` wiring,
  image styling
- `blueprint/context/design.md` - correction plus new entry

## Data and contracts

- **Image block, locked:** `{ id, type: "image", data: { mediaId: uuid } }`.
  Nothing else is ever stored on the block - no url, no alt text, no
  dimensions, no caption. Matches item 5a's own `Data and contracts`.
- **`renderBlocks(blocks, mediaById?)` and `toEditorJs(blocks, mediaById?)`**,
  both taking `Record<string, ImageMediaSummary>` (`{ url, altText, width,
  height }`), default `{}` - **load-bearing for item 6**, whose pages loader
  will need to build the same lookup the way `post.tsx` and `post-edit.tsx` do
  here.
- **A `mediaId` with no entry in `mediaById`** renders nothing on the public
  site and a "no longer available" placeholder in the editor - not refused at
  save time, not prevented at delete time (see Decisions). Any later item
  touching either renderer inherits this contract rather than re-deciding it.
- **`/admin/media/picker`** - `GET`, admin-guarded via the layout, returns
  `{ media: [{ id, url, filename, altText, width, height }], page, totalPages }`.
  No write capability; uploading stays at `/admin/media`.

## Testing

- Unit (`node --test`): `fromEditorJs`/`toEditorJs` for the image type
  (accept, refuse a bad `mediaId`, resolve/mark-missing via `mediaById`);
  `collectImageMediaIds` dedup; the picker's page-clamping logic if it is
  written as a pure function separate from the loader (matches the project's
  own split of query logic from the code that opens a connection, D24).
- `findMediaByIds`, the picker route, and the tool's actual round trip all
  need a database and a browser - proven by hand and worth an
  `e2e/image-block.spec.ts`: insert an image from the picker, save, reopen and
  confirm it shows without a network wait, publish and confirm the public page
  renders it, delete the file and confirm both sides degrade instead of
  crashing.
- Screenshots per step 5, both themes.

## Decisions

- **A custom Editor.js tool, not the `@editorjs/image` package.** (D58) The
  official tool's `uploader` callbacks return `{ file: { url } }` - it stores
  a URL, which item 5a's own contract already ruled out ("a media id is the
  only thing a block will ever store"), and it has no "pick from an existing
  library" mode of its own. Beats bending the package to a shape it was not
  built for; matches this project's existing precedent of a small in-repo
  piece for an exact fit (D29's inline-run scanner, not a library). Cost:
  this project's first hand-written Editor.js Tool UI - more code than a
  dependency line, but code this app fully controls.
- **Insert only from the existing library - no upload-in-editor.** (D59) The
  upload path (validation, R2 write, alt text capture) already exists and
  works at `/admin/media`; rebuilding it inside a Tool class roughly doubles
  this item's surface for a convenience nobody has asked for yet. Beats
  matching the official tool's usual upload-first UX. Cost: placing a
  brand-new image needs two screens, not one - flagged for the user to weigh
  against "ease of use is the product" at the review gate; easy to add later
  if it turns out to matter.
- **Existing image blocks resolve server-side, in the loader that already has
  the entry - not fetched per-block by the tool on mount.** (D60) Beats every
  image block self-fetching its own preview (closer to the official tool's
  usual shape), which would mean one request per image in a post and a
  visible loading state on every open. Cost: `renderBlocks` and `toEditorJs`
  both take a `mediaById` lookup now, and every future caller has to supply it.
- **A `mediaId` that no longer resolves degrades silently rather than being
  prevented.** (D61) There is no foreign key from a block's `mediaId` to
  `media.id` - it is JSON, not a column - so nothing stops a delete on an
  in-use file. Solving that (block the delete, or cascade-clean references)
  is real scope this item does not need to carry to be useful, and matches
  the plan's own stance elsewhere ("R2 down means images missing, text still
  served"). Cost: a writer can end up with a quietly broken block until they
  notice it themselves in the editor.
- **The picker endpoint clamps an out-of-range page rather than returning an
  empty result.** (D62) F-56 and F-75 are the same bug in two different
  lists already; closing it here before building the third instance beats
  waiting for review to find it again. Cost: none.
- **An image block with no `mediaId` ever chosen is dropped by the tool's own
  `validate()`, not sent to the server and refused there.** (D63) Without it,
  an abandoned "+ Image" placeholder would submit as `{ mediaId: undefined }`,
  which `blocksSchema` could only refuse with a raw Zod sentence naming no way
  to fix it - the same shape of rough edge F-51 already found for an empty
  list block. Settled while building step 3, not anticipated by the spec.
  Cost: none; matches how Editor.js already drops an empty paragraph.
- **Code that closes a native `<dialog>` and moves focus elsewhere must close
  it first.** (D64) Settled repairing F-76: the first fix attempted (moving
  the `.focus()` call earlier, while the dialog was still open) did not work
  - everything outside an open modal `<dialog>` is inert per the platform's
  own rules, so nothing outside it can take focus while it is still open,
  regardless of which line the `.focus()` call sits on. Cost: none - a rule
  for any future native `<dialog>` in this app.

## Notes

- No SVG uploads - unchanged from item 5a, nothing new here.
- No per-placement caption or alt override - alt text is always the media
  row's own value (D55). `design.md`'s "muted caption" line under public
  images has no data behind it; that gap is 5c's to resolve, not this item's
  to paper over with a field that does not exist yet.
- No resizing or `srcset` - `quality-bar.md`'s own named first bottleneck,
  explicitly out of v1. A large upload renders at its native pixel size.
- `needs-you.md`'s open screen-reader/keyboard line already covers "the +
  toolbox, the block settings menu" - the image tool and its picker dialog
  fall inside that existing scope; no new line needed, but the manual pass
  should specifically drive the dialog's Escape/backdrop/tab behavior once it
  happens.

## Findings

### 05b/F-76 [P2] closed - Picking an image discards the native dialog's own focus-restoration, dropping keyboard focus to `<body>`

**File:** app/features/blocks/image-tool.client.ts:126-137 (`openPicker`), interacting with :75-81 (`renderContent`) and :233-236 (the thumbnail's click handler)
**Found:** 2026-09-22 by review (scope: current, item 5b; lens: accessibility)
**Why it matters:** `current-work.md`'s own Decisions choose the native `<dialog>` specifically so this item does not have to write "custom focus-trap/overlay code to get subtly wrong - the platform already does this" - and one of the platform's guarantees is restoring keyboard focus to whichever element had it before `showModal()` was called, once the dialog closes. Measured directly in Chromium (a real post, a real pick, `document.activeElement` read after each path): dismissing the dialog **without** picking - Escape, a backdrop click, or the Close button - correctly returns focus to the "Choose image" button every time, because that button is never removed from the DOM. **Picking a thumbnail does not**: the thumbnail's click handler calls `onSelect(media)` before `dialog.close()`, and `onSelect` (`openPicker`'s callback) sets `this.data` and calls `this.renderContent()`, which `replaceChildren()`s the wrapper - removing the very "Choose image" button the browser was about to restore focus to - *before* `dialog.close()` runs. With the previously-focused element gone from the document, the browser has nothing to restore focus to and falls back to `document.body`. Confirmed empirically: `document.activeElement` after a successful pick is `<body>`, with no visible focus indicator anywhere on the page - worse than cancelling, and it happens on exactly the interaction this feature exists for. WCAG 2.2 AA - this project's own recorded accessibility bar (`design.md`) - names "everything reachable and operable by keyboard, focus visible and never trapped"; a keyboard or screen-reader user who completes the pick loses their place in the page entirely.
**Suggested fix:** Keep a reference to the "Change image" button `renderPreview()` creates, and call `.focus()` on it after `this.wrapper.replaceChildren(...)` inside `onSelect`'s callback - or have `renderContent()` return the element it just inserted so the caller can focus it. Two or three lines; the dismissal paths already prove the expected behavior once there is something in the DOM to receive it.
**Resolution:** Repaired and re-verified 2026-09-22 by review, in the same pass that found it (at the user's request). The suggested fix above - moving the explicit `.focus()` call earlier - was tried first and **did not work**: `document.activeElement` was still not the target button immediately after calling `.focus()` on it. Root cause was one level deeper than the original write-up: everything outside an open modal `<dialog>` is **inert** (unfocusable) per the platform's own rules, so no element outside the dialog can receive focus while it is still open, regardless of which line the `.focus()` call sits on. The actual fix is in the thumbnail's click handler (`image-tool.client.ts:241-247`): `dialog.close()` now runs *before* `onSelect(media)`, not after - the dialog (and the inertness it imposes) is gone by the time `onSelect`'s `renderContent()` + `.focus()` run, so the new "Change image" button is focusable again. Confirmed empirically in Chromium, same method that found the defect: `document.activeElement` after a pick is now the "Change image" button; the three dismissal paths (Escape, backdrop, Close) were re-checked and still correctly restore focus exactly as before - no regression. A permanent regression test was added (`e2e/image-block.spec.ts`, "picking an image leaves keyboard focus on the new Change image button, not lost to `<body>`") and **shown to fail** against the pre-fix ordering (`toBeFocused()` reported `inactive`) before being restored to green. `npm run verify` -> exit 0, 183 tests; `e2e/image-block.spec.ts` -> 7/7 passed. Closed directly: the same pass that found this finding also repaired and independently re-verified it against the running app, which is what the ledger's closing rule asks for.

### 05b/F-77 [P3] closed - `e2e`'s `logIn` helper is now duplicated byte-for-byte across five spec files

**File:** e2e/image-block.spec.ts:37-43 (identical to inline-formatting.spec.ts:27-33, manage-posts.spec.ts:28-34, write-post.spec.ts:29-35; auth.spec.ts:27 carries the same idea with a different signature)
**Found:** 2026-09-22 by review (scope: current, item 5b; lens: quality/tests)
**Why it matters:** This item's own `logIn` is a character-for-character copy of the same seven-line function already living in three other spec files (confirmed by direct comparison - all four bodies are identical). `fundamentals.md`: "Copy it the second time. Extract on the third, when the shape is known." The shape has been known since the second copy; this item adds a fifth identical one rather than questioning it. Pre-existing drift, not introduced by this item - but five is the point past which leaving it alone is hardest to defend, and a sixth spec file is a matter of time.
**Suggested fix:** Extract to `e2e/helpers/auth.ts` (`export async function logIn(page: Page, user: TestUser)`), imported by all four/five files. Its own small change, not this item's to carry - `ai-interaction.md`: "Refactoring is its own item, never a passenger on someone else's diff."
**Resolution:** Repaired and re-verified 2026-09-22 by review, at the user's request. Extracted to `e2e/helpers/auth.ts` (`export async function logIn(page: Page, user: TestUser)`), imported by `image-block.spec.ts`, `inline-formatting.spec.ts`, `manage-posts.spec.ts` and `write-post.spec.ts` - their own local copies deleted; unused `Page`/`TestUser` imports dropped where the extraction left them unused (`manage-posts.spec.ts`). `auth.spec.ts`'s own version deliberately kept separate: it exercises login itself (wrong-password, redirect-preserving cases), so it needs independent control over navigation and the success wait that the shared helper always performs. Evidence: `npm run verify` -> exit 0 (typecheck, lint, 183 unit tests, build); every affected spec file re-run - `image-block.spec.ts` 7/7, `inline-formatting.spec.ts`, `manage-posts.spec.ts`, `write-post.spec.ts`, `auth.spec.ts` all green; a full `npx playwright test` run afterward - 63/63 passed. Closed directly: repaired and independently re-verified against the running app in the same pass.

**While repairing this, a full e2e run surfaced two things unrelated to this finding, recorded separately rather than folded in:**
- `write-post.spec.ts`'s "the block menu lists only the types this version can store" asserted an exact `["Text","Heading","List"]` menu - stale since item 5b's own `image` block added a fourth entry. Fixed in the same pass (added `"Image"` to the expected array) since it is this item's own regression, not a passenger.
- The same run intermittently failed `manage-posts.spec.ts`'s "the list is scoped by role, and the tabs' counts match" ("All3" vs "All4"). Reproduced the mechanism: that test asserts an editor sees an exact system-wide post count, unscoped by author, which is only stable when no other spec file's `createDraftFor` calls are in flight at the same moment - a race under Playwright's `workers: 2`, confirmed by running it alone (passes every time) versus alongside the rest of the suite (failed once, passed on a second full run). Not caused by this branch and not fixed here - left open in the live ledger as F-78.
