# Feature: Image, button, line and space

**From build plan:** item 14a2
**Type:** Feature
**Verified:** not yet
**Reviewed:** not yet

## Goal

Add the four remaining v1 blocks to the v4 document - Image, Button, Line and
Space - with the palette that adds them from the keyboard and the settings
panel that edits them. After this, a page can hold everything Level 1's
templates (14c) and the AI draft (18b) will need except the contact form
(item 19), and the first image on a published page loads at once (D174).

## In scope

- The v4 contract widened by four block types (below), each one block toward
  the 200 cap, validated by `parseDocument` and drawn by `renderDocument`.
- The public renderer: Image as `img` with the media's alt text, Button as a
  link (`a`), Line as `hr`, Space as spacing only. The first image on a page
  or post loads at once with `fetchpriority="high"`; the rest lazily.
- TipTap nodes for the four blocks on the canvas, drawn as the site draws
  them; an image with no media, or whose media was deleted, shows a
  placeholder in the editor only.
- **The palette** (design.md *Palette*): a "Blocks" panel of tiles - Text,
  Heading, List, Image, Button, Quote, Line, Space. Click a tile, or focus it
  and press Enter or Space, to add that block after the selected one. Below
  1024px it sits behind an **Add** button in the editor's top bar.
- **The settings panel** (design.md *Settings panel*): 17rem on the right, a
  bottom sheet below 1024px, only for a selected Image, Button or section.
  Image: Choose image / Replace image. Button: Button text, Goes to, Style.
  Section: Columns - **moved here from the section chip**, which gains a
  "Section settings" button.
- The media picker dialog shared by the logo and the image block.
- F-79's requirement: a published image's alt text is announced once.
- F-154's follow-up: the editor's "cannot read this content" lock is set only
  while the editor is loading its stored document, not by a later insert.

## Out of scope

- The selected block's ring and toolbar, Move up / Move down, Delete, the Text
  style menu and Main heading - **14a3**. Until then an Image, Button, Line or
  Space is removed by selecting it (click) and pressing Backspace or Delete.
- Dragging tiles and blocks, the drop gap, the palette collapsing to a rail of
  icons, Duplicate - **14b**. The "Sections" half of the palette (Blank
  section, Hero, Image and text, Call to action) - **14c**. Contact form tile
  - **item 19**.
- `srcset`, resized variants and the cache header - **17b** (D174). This item
  serves the uploaded file at its stored width and height.
- Section `align` / `background` controls - templates set them (14c); Simple's
  Section settings show Columns only (plan section 6).
- An image caption field and Space sizes - not in v1 (Decisions).
- Moving Remove section off the chip - it stays where 14a1 put it; 14a3's
  toolbar work decides the chip's final shape.

## Design reference

- `prototypes/editor.html`, state 1 (`#` default): the palette (`aside.palette`
  "Add to the page", `.palette__grid`, `.tile`), the button's settings panel
  (`aside.settings`, Button text / Goes to / Style), the section chip's gear
  "Section settings", a Line (`hr.rule`) and a Space (`.spacer`) in the canvas.
- `prototypes/components.css`: *Blocks* (`.rule`, `.spacer`, `.photo` - the
  image stand-in), *Editor* (`.palette`, `.tile`, `.canvas .spacer`'s hatching,
  `.settings`, the 1024px bottom sheet and hidden palette).
- `blueprint/context/design.md` *Editor decisions*: Palette, Settings panel,
  Section controls, Phone; *Conventions*: "a deleted image shows 'This image
  is no longer available.' with a way to replace it".
- **Not in the record, decided here** (added to `design.md` in step 8):
  - The image block's empty state in the canvas: the `.photo` stand-in reading
    "No image chosen" with the settings panel's **Choose image**; the deleted
    state reads "This image is no longer available." with **Replace image**.
  - The settings panel's heading names the block ("Image", "Button",
    "Section 2"); **Close settings** hides it until another block with
    settings is selected; Escape inside it closes it and returns focus to the
    writing area.
  - Goes to's choices: each page by title (a draft marked "(not published)"),
    "A web address…" and "An email address…", the last two showing one field.
  - The phone's **Add** button opens the palette as the kit's native
    `<dialog>`; choosing a tile adds the block and closes it.

## Build steps

- [x] **Step 1 - The contract widens** - `document.ts` / `document-nodes.ts`
  accept `image`, `button`, `horizontalRule` and `space` (Data and contracts),
  each counted as one block; refusals in plain words; unknown attrs dropped.
  `document-nodes.ts` gains `isRenderedBlock(block, mediaById)` (what the
  renderer and the empty-section rule share) as a pure function. *Done when:*
  `document.test.ts` has a passing test for each: every new node accepted with
  its attrs; an image without a uuid `mediaId`, a button label over 80
  characters, a button `href` failing `isSafeHref`, a `style` outside
  filled/outline each refused with its sentence; an empty label and empty
  `href` accepted; `style` absent stored as `filled`; extra attrs on all four
  dropped; 200 blocks mixing all kinds accepted and 201 refused;
  `isRenderedBlock` false for a space, an image whose media is missing, a
  button missing its label or its `href`, and true for a line - and
  `npm run verify` is green.

- [x] **Step 2 - The public render** - `renderDocument(document, type,
  mediaById)` draws the four blocks (Notes, *Rendering*); a section renders
  nothing when no block in it `isRenderedBlock`. A new
  `resolveDocumentMedia(document)` in `app/features/public-site/` collects the
  document's media ids and makes **one** `findMediaByIds` query; the post,
  page and chosen home page loaders use it and send only `{ url, altText,
  width, height }` per id (no media ids beyond the document's own, F-108).
  The first `img` in document order gets `fetchpriority="high"` and no
  `loading`; every later one `loading="lazy"`. `e2e/helpers/media.ts` gains
  `insertTestMediaRow()` - a media row with no R2 object - so these tests run
  in CI. *Done when:* `document-render.spec.ts` finds on a seeded published
  page, by role: an `img` named by its alt text with its width and height, a
  `link` named by the button's label with its `href`, a `separator`; the first
  image has `fetchpriority="high"` and no `loading`, the second
  `loading="lazy"`; an image whose media row was deleted, a button with no
  label and a section holding only spaces add no element; the alt text appears
  exactly once in the page's `ariaSnapshot()` and no `figcaption` exists
  (F-79); the post route and the home page render an image the
  same way; `content-security-policy.spec.ts` sees a published image load
  under the public CSP with no violation (R2 needed - skipped in CI, as
  today's R2 tests); a published page holding 30 images answers in **under
  500 ms**, measured from the browser test on the dev machine
  (`quality-bar.md`); the whole suite passes.

- [x] **Step 3 - The four blocks in the editor** - TipTap `image`, `button`,
  `horizontalRule` and `space` nodes: atoms, selectable by click, drawn in the
  canvas with the site's own classes (a button as the site's button, not a
  link that navigates; the space with the canvas's hatching); the image node
  reads its media from a map the edit loaders fill with the same
  `resolveDocumentMedia`, and shows "No image chosen" or "This image is no
  longer available." when it has none. `enableContentCheck`'s
  `onContentError` locks Save only while `!editor.isInitialized` (F-154's
  follow-up). No way to add them yet. *Done when:* `document-editor.spec.ts`
  opens a seeded page holding all four plus a deleted image: each is visible
  in the canvas, the deleted one reads "This image is no longer available.";
  clicking the line then Backspace removes it and Ctrl+Z restores it; Save
  then reload keeps every attr; the stored row holds no attr outside the
  contract; a seeded unknown node is still refused at Save (F-154 test
  passes unchanged).

- [ ] **Step 4 - The palette and its keyboard path** - `aside` "Add to the
  page" before the canvas, heading "Blocks", eight tiles as `button`s (icon
  plus visible name). Activating a tile inserts its block (Text = paragraph,
  Heading = level 2, List = bulleted, Quote, Image with no media, Button with
  empty label and `href`, Line, Space) **after the selected block, or the block
  holding the cursor** - the column's direct child, so after the whole list
  or quote, never inside it - in the same column, as one transaction; a text
  block gets the cursor, an atom becomes the selected block; focus moves to
  the writing area. At 200 blocks every tile is disabled with the reason
  shown once under the heading. Below 1024px the palette is hidden and the
  top bar's **Add** button opens it in a `<dialog>`. *Done when:* the editor
  spec, keyboard only: place the cursor in the second paragraph of column 2,
  Tab to the Line tile, Enter - the stored document has the `horizontalRule`
  directly after that paragraph in column 2; Enter on Text leaves the cursor
  in a new paragraph where typing lands; each of the eight tiles adds its
  node; one Ctrl+Z removes an added block; at 390px the palette is not
  visible, Add opens the dialog, a tile adds its block and the dialog closes
  with focus in the writing area; a seeded document of 200 blocks shows every
  tile disabled.

- [ ] **Step 5 - One media picker** - `settings/logo-picker.client.ts` (+
  CSS) moves to `app/features/media/media-picker-dialog.client.ts`, titled by
  its caller ("Choose a logo" / "Choose an image") and handing back
  `PickedMedia`; `settings.tsx` imports it. Nothing else changes. *Done
  when:* `manage-settings.spec.ts`'s logo picker tests pass unchanged and
  `grep -rn "logo-picker" app` finds nothing.

- [ ] **Step 6 - The settings panel, and Columns move into it** - an `aside`
  labelled by its heading, after the writing area in tab order, shown while
  an Image or Button is the selected block or after the chip's **Section
  settings** is pressed; Close settings and Escape hide it (Design
  reference). Section: Columns 1 / 2 / 3 with 14a1's behaviour (D119),
  removed from the chip. Image: **Choose image** / **Replace image** opens
  step 5's picker titled "Choose an image" - and the alt text shown read-only with "Alt text is set when the image is
  uploaded" (D55). Every change is one transaction. *Done when:* the editor
  spec: selecting an image opens the panel headed "Image"; Choose image,
  pick a seeded media row - the canvas shows it and Save stores its id;
  Replace image swaps it and one Ctrl+Z restores the first; a deleted
  image's panel offers Replace image and the swap clears its message; the chip's Section
  settings opens "Section 2" whose Columns 3 -> 2 keeps every block (14a1's
  test moved here); Escape closes the panel with focus in the writing area;
  at 390px the panel is a bottom sheet that leaves the selected block
  visible; the writing area is still the only `textbox` (D169: no control inside it).

- [ ] **Step 7 - The button's settings** - Button text (a text input, max 80),
  Goes to (a select: every page by title, a draft marked "(not published)",
  then "A web address…" and "An email address…"), the address field for the
  last two, Style (Filled / Outline, a `fieldset` of radios). A page is
  stored as `href` `/<slug>`, an email as `mailto:<address>`; an address that
  fails `isSafeHref` shows the link dialog's message beside its field and is
  not applied. The four edit loaders send the pages list (`id`, `title`,
  `slug`, `status` - no body). *Done when:* the editor spec: add a Button,
  type "Book now", choose a page, Save - the published page has a link named
  "Book now" to `/<slug>`; switch to "A web address…" with
  `javascript:alert(1)` - refused beside the field, the stored `href`
  unchanged; an email stores `mailto:`; Outline renders the outline style on
  the canvas and the site; reopening the panel shows the stored choice
  selected; journey 2's part this item has (design.md *Edit and publish*):
  Pages -> open a page -> add a Button from the palette -> Publish -> the
  public page shows it, as a full page load and through the app's links.
  An empty button reads "Button text" on the canvas, muted.

- [ ] **Step 8 - The record** - `design.md` *Editor decisions* gains the
  "decided here" states from Design reference; `needs-you.md`'s two
  screen-reader lines name the palette and Add dialog, the settings panel,
  the media picker in the editor, and published images and buttons. *Done
  when:* both files carry those lines and `npm run verify` and the whole
  browser suite pass (`npm run test:e2e` locally with R2; CI's `e2e` with
  `E2E_SKIP_R2=1`).

## Files and areas

- `app/features/blocks/document.ts`, `document-nodes.ts` (+ `document.test.ts`)
  - the four nodes, `isRenderedBlock`.
- `app/features/blocks/render.tsx`, `content.module.css` - the four blocks;
  button, line and space styles shared with the canvas.
- `app/features/blocks/document-editor.client.tsx` (+ `.module.css`) - nodes,
  palette, Add dialog, settings panel, chip's Section settings. **It is 25 KB
  already:** the palette and the settings panel go in their own
  `palette.client.tsx` and `settings-panel.client.tsx` beside it.
- `app/features/public-site/` - new `document-media.server.ts`
  (`resolveDocumentMedia`); `post.tsx`, `page.tsx`, `home.tsx`,
  `page-body.tsx`.
- `app/features/content/` - `post-edit.tsx`, `page-edit.tsx`, `post-new.tsx`,
  `page-new.tsx` loaders (media map, pages list), `entry-form.tsx`;
  `entries.server.ts` - a `listLinkablePages()` query.
- `app/features/media/` - `media-picker-dialog.client.ts` (moved from
  `settings/logo-picker.client.ts` + its CSS); `settings/settings.tsx` import.
- `e2e/` - `helpers/media.ts`, `helpers/documents.ts` (builders for the four
  nodes), `document-render.spec.ts`, `document-editor.spec.ts`,
  `content-security-policy.spec.ts`.
- `blueprint/context/design.md`, `blueprint/context/needs-you.md` (step 7).

## Data and contracts

**Load-bearing: the v4 block union widens** (no migration - `entries.blocks`
is JSON and `blocks_format` stays `v4`; a release before 14a2 cannot open a
document holding these, which nothing deployed ever will, D163):

    image          { type: "image", attrs: { mediaId: uuid } }
    button         { type: "button", attrs: { label: string(0..80),
                     href: "" | isSafeHref <= 2,048,
                     style: "filled" | "outline" } }        style defaults "filled"
    horizontalRule { type: "horizontalRule" }               the Line block
    space          { type: "space" }                        one fixed height

- Each is one block toward `MAX_DOCUMENT_BLOCKS` (200); none holds text nodes.
- `label` passes `isStorableText`; refusals: "An image needs a file from
  Media.", "A button's text can be at most 80 characters.", the existing
  `badLink` / `longLink` sentences for `href`, "A button's style must be
  Filled or Outline."
- **Not stored on the block:** an image's URL, alt text and size - resolved
  from `media` at render time (plan section 6, D55). A deleted media row
  leaves the block in place.
- **Rendered or not** (`isRenderedBlock`): a space never (it is spacing); an
  image only when its media exists; a button only with a label and an `href`;
  a line always; text blocks as 14a1. **A section renders nothing when no
  block in it is rendered**, so a section of spaces is dropped.
- **Loader shape:** `mediaById: Record<uuid, { url, altText, width, height }>`
  holding only the document's own ids. Edit loaders also send `pages: { id,
  title, slug, status }[]`.
- **Picker:** `GET /admin/media/picker` unchanged; the dialog module's
  callback type becomes `PickedMedia { id, url, filename, altText, width,
  height }` (the endpoint already returns these).

## Testing

- **Unit** (`npm test`, inside `verify`, CI): `document.test.ts` - every new
  rule and refusal, `isRenderedBlock`.
- **Browser** (`npm run test:e2e` locally and in CI's `e2e` job; needs the
  development database): `document-render.spec.ts` (step 2),
  `document-editor.spec.ts` (steps 3-7). Images are seeded as media rows with
  no R2 object (`insertTestMediaRow`), so they run in CI: an `img` keeps its
  role and name when its file 404s. **Only** the CSP image-load test needs
  real R2 and is skipped under `E2E_SKIP_R2=1` - one more for the owner's
  local run before deploy (`needs-you.md`).
- Role-based locators (`img`, `link`, `separator`, `button`, `dialog`,
  `complementary`) - coding-standards.md.
- **Journeys:** 2 (*Edit and publish*) as far as this item reaches, step 6;
  3 (*Move a block without dragging*), its palette half - focus a tile, Enter,
  the block lands after the selected one - step 4. The Move up / Move down
  half and the announcement are 14a3's.
- **Quality bar:** a 30-image page under 500 ms (step 2). Saves are unchanged
  in size per block; 14a1's caps test stays the save measurement.

## Decisions

- **No image caption in v1** - an image renders as a plain `img` with its
  media's alt text, no `figure` / `figcaption`. Beats items 1-12's
  alt-text-as-caption (read twice by a screen reader, F-79 - closed by this)
  and a caption attr (a second text field per image, D55 rejected it; Level 2
  can add one with a default, no migration).
- **Space has one height, no attrs.** Beats sizes: the settings panel exists
  only for blocks that have settings (design.md), and a Simple user stacks
  two spaces for more room. Level 2 adds a size with a default.
- **A button's page target is stored as `href` `/<slug>`**, like a link in
  text. Beats storing a page id (as the menu does): one link shape for every
  block keeps the renderer and the allowlist single. Cost: changing a page's
  web address breaks buttons pointing at it, the same as text links today -
  item 17's redirects are where that would be fixed.
- **Button `style` is filled or outline, filled by default** - the mockup's
  Style control. Recorded in the contract now so templates (14c) and the AI
  draft (18b) can set it.
- **The palette inserts after the selected block, in its column**; an editor
  never focused has its selection in the first block, so a tile adds after
  it. Beats "at the end of the page" (lands out of sight on a long page).
- **Columns move from the section chip to Section settings** (design.md
  *Section controls*); the chip keeps the label and Remove section until
  14a3.
- **The media picker becomes one module in `app/features/media/`**, used by
  the logo and the image block. Beats a second copy (the duplication F-104
  removed once).

## Production needs

None. No migration (the stored format stays `v4`; nothing deployed has a v4
row, D163), no environment variable, account or service. The admin CSP's
`img-src` already allows the R2 origin.

## Behaviour changes

Read against `blueprint/capabilities/editor.md` and `public-site.md`.

- Adds to `editor`: a page or post can hold an image chosen from Media, a button, a line and a space - Step 3
- Adds to `editor`: focusing a palette tile and pressing Enter adds that block after the selected block, in its column - Step 4
- Adds to `editor`: an image, a button or a section's settings are edited in a settings panel beside the canvas; text has none - Step 6
- Adds to `editor`: a button links to a page, a web address or an email address, and an address outside the allowlist is refused beside its field - Step 7
- Adds to `editor`: an image whose file was deleted shows "This image is no longer available." with Replace image - Step 6
- Adds to `public-site`: an image renders as an `img` named once by its alt text; the first on a page loads at once with high priority, the rest lazily - Step 2
- Adds to `public-site`: a button renders as a link; a button without text or a destination, and an image whose file was deleted, render nothing - Step 2
- Changes `public-site.5` from "an empty section, paragraph or heading renders no element" to "an empty paragraph or heading renders no element, and neither does a section in which nothing renders (only empty text, spaces, empty buttons or deleted images)" - Step 2

## Notes

- **Rendering:** Image `<img src alt width height>` (CSS `max-width: 100%;
  height: auto`), never `figure`. Button `<a href class>` styled as the site's
  button in its `filled` / `outline` variant from the site scope's tokens -
  `on-primary` on `primary` and `primary` on `bg` are already measured
  (design.md), so no new contrast pair. Line `<hr>`. Space an empty `div`
  with the `.spacer` height and nothing announced. Never
  `dangerouslySetInnerHTML`.
- **TipTap 3.31.4** is newer than memory: read the installed types for atom
  nodes, `NodeSelection`, `ReactNodeViewRenderer` / `NodeViewWrapper`, and
  `isInitialized` before using them. StarterKit's own `horizontalRule` stays
  disabled; ours is one node in our schema with no input rule (`---` typed in
  text stays text).
- Nothing interactive inside the `textbox` (D169): the image placeholder's and
  button's controls live in the settings panel; canvas buttons are drawn as
  `span`s, as the mockup does.
- `*.client.tsx` for TipTap and the dialog; `resolveDocumentMedia` is
  `.server.ts`; `isRenderedBlock` is in `document-nodes.ts` so the browser
  bundle never pulls Zod (its header explains why).
- **React Router 8.4.0**: loader shapes per the installed docs; refusals stay
  `data(..., { status })`.
- **Findings touched:** F-79 closes by construction (step 2's test). F-165
  (the Text style select's hidden label) and F-163 (unreadable document opens
  editable) are 14a3's toolbar and a backlog fix respectively - not passengers
  here.
- Steps 5 and 8 are mechanical (`implementer`); 1-4, 6 and 7 are design
  work for the main session, with `implementer` suited to step 1's tests.
- Branch: `feature/14a2-blocks`.
