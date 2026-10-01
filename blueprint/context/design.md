# Design

> Written by `prototype` on 2026-09-15. **Survives the mockups:** `ship` deletes
> `prototypes/` once the look is built; this file stays, and `review`, `spec` and
> `architect` read it. Change a decision here in the same change that changes the
> code.

## Direction

**Calm and neutral, one accent: the content is the loudest thing on screen.**
Quiet blue-greys, a single blue for actions and links, generous whitespace,
system fonts. A non-technical editor should never wonder what to press next.
The admin and the public site share one token set; the public site differs only
in reading size and a narrow column.

Mockups (throwaway): `prototypes/login.html`, `posts-list.html`,
`posts-empty.html`, `editor.html`, `public-post.html`. Tokens:
`prototypes/theme.css`. Shared component styles: `prototypes/mockup.css`.

## Where the tokens land

- **`app/app.css`** (already imported by `app/root.tsx`, already sets
  `color-scheme: light dark`) receives the contents of `theme.css` as custom
  properties on `:root`. This is the first build step of the first UI item
  (item 1, Admin login).
- **Components are CSS Modules** beside their feature (D12), using only the
  tokens. `mockup.css` is a reference for them, not a file to copy wholesale.
- Nothing else: no Tailwind, no CSS-in-JS, no web font.

## Why the tokens are what they are

- **Light and dark from one declaration.** Every color is
  `light-dark(light, dark)`, driven by `color-scheme`. The app follows the
  system setting; there is **no theme toggle in v1** (one fewer setting). If a
  toggle is added later, it sets `color-scheme: light|dark` on `:root` and no
  token changes.
- **Neutral hue bias: faint cool blue-grey** (hue ~215), so greys sit with the
  blue accent instead of against it.
- **Dark mode separates surfaces by color and border, not shadow** - shadows
  barely show on dark backgrounds. The dark accent is a light blue with near-
  black text on it, not the light-mode blue, which fails contrast on dark.
- **Type:** system font stack (no download, familiar to every editor). Admin body
  16px; public reading body 19px at line-height 1.7 in a 42rem (~70 character)
  column. Title size `--text-3xl` is a `clamp()` from 28px on phones to 38px.
  The editor's canvas uses the reading size and column, so what an editor writes
  looks like what visitors read.
- **Spacing:** 4px base, 8 steps. **Control height 40px** - comfortably above the
  WCAG 2.2 target minimum of 24px.
- **Breakpoint:** one, `48rem` - sidebar becomes a top bar, table drops the author
  and date columns. Written as a literal because custom properties do not work
  inside media queries.

### Measured contrast (WCAG 2.2) - do not lighten these without re-measuring

| Pair | Light | Dark |
|---|---|---|
| `--color-text` on `--color-bg` | 15.6 | 15.2 |
| `--color-text` on `--color-surface` (card and dialog titles, filenames - item 5b) | 16.75 | 14.07 |
| `--color-text-muted` on `--color-surface` | 6.3 | 7.3 |
| `--color-text-muted` on `--color-surface-sunken` (worst case) | 5.5 | 8.1 |
| `--color-text-muted` on `--color-bg` (public site: dates, footer, empty state - item 4b) | 5.9 | 7.8 |
| `--color-accent` (links) on `--color-bg` | 6.0 | 8.4 |
| `--color-accent` on `--color-accent-subtle` (active nav) | 5.5 | 6.9 |
| `--color-on-accent` on `--color-accent` (primary button) | 6.4 | 8.4 |
| `--color-accent` fill on `--color-surface` (call-to-action button on its panel - item 12b; non-text, needs 3:1) | 6.45 | 7.76 |
| `--color-border-control` on `--color-surface` (input/button edge) | 3.3 | 3.7 |
| `--color-border-control` on `--color-bg` | 3.1 | 4.0 |
| `--color-success` on `--color-success-subtle` (Published badge) | 5.3 | 8.4 |
| `--color-warning` on `--color-warning-subtle` (Draft badge) | 5.6 | 8.7 |
| `--color-danger` on `--color-danger-subtle` | 5.0 | 7.3 |
| `--color-danger` on `--color-surface` (field error text) | 6.0 | 7.8 |

`--color-text-muted` is the one most likely to be "softened" - at light `#566170`
it is 5.5:1 at worst; the next obvious lighter grey drops below 4.5:1.
`--color-border` (1.3:1) is **decorative only** - dividers and card edges - and
must never be the only edge of an input or button; those use
`--color-border-control`.

## States

Server-rendered with forms that work without JavaScript (D10), so states are
mostly the page itself, not spinners.

- **Pending (loading):** the submitting button gets `aria-busy="true"` and
  `disabled`, drops to 60% opacity, and its label changes to the verb in
  progress ("Saving…", "Publishing…", "Logging in…"). No full-page spinner, no
  skeletons. Page loads are server-rendered and fast enough not to need one
  (quality bar: < 500 ms).
- **Empty:** a dashed-border panel in the content area with a muted outline icon,
  a heading that names the next action ("Write your first post"), one sentence on
  what the thing is and when it becomes public, and the single primary button.
  See `posts-empty.html`.
- **Error - form or action failed:** a `message-error` banner at the top of the
  form or canvas, `role="alert"`: bold sentence saying what happened, plain
  sentence saying what to do, optional button for the fix (e.g. "Reload"). Never
  blames the user, never shows codes. See `login.html` and the stale-save
  conflict in `editor.html`.
- **Error - one field:** red `--color-danger` border via `aria-invalid="true"`,
  message below the field in `field-error`, linked with `aria-describedby`.
  Login does **not** mark a field - it does not reveal which of email or password
  was wrong.
- **Success:** a `message-success` banner, `role="status"`, on the page the
  action returns to, with a link to the result ("View it on the site"). See
  `posts-list.html`.
- **Not found (public):** plain 404 page in the public theme - to be decided
  in item 4; not mocked.

## Component conventions

- **Buttons:** 40px tall, 8px radius, 14px medium weight. **Primary** (accent
  fill) - at most one per view: New post, Publish, Log in. **Default** (surface
  with control border) - secondary actions like Save draft, Reload. **Quiet**
  (no border, muted text) - inline actions like Change. Destructive actions use
  the default button with danger text and must be confirmed.
- **Inputs:** 40px tall, control border, 8px radius, visible label above
  (`field-label`), hint below in muted text. Placeholder is never the label.
- **Status badges:** pill with a leading dot; **Draft = warning amber, Published
  = success green.** The only two content statuses; the dot means color is not
  the sole signal - the word is always there. **The users list (item 8) adds a
  second, unrelated pair for account status:** Active reuses the same success
  green; Deactivated is muted (`--color-text-muted` on `--color-surface-sunken`,
  5.5:1 light / 8.1:1 dark) rather than a warning color, since a deactivated
  account is an administered state, not a problem to fix.
- **Messages:** bordered banner with icon, bold first sentence, body text, and an
  optional action button on the right.
- **Admin shell:** 15rem left sidebar - site name and logo with "View site",
  nav (Posts, Pages, Media, Settings, Users - items the role cannot use are
  hidden), current user and role with Log out at the bottom. Active nav item uses
  accent-subtle background with accent text. Content max 64rem.
- **Admin shell before navigation exists** (item 1): the sidebar shows "Habre
  CMS" with "View site ↗", then name, role and a quiet Log out button at the
  bottom - no nav list until the first admin section ships. Below `48rem` it
  becomes one top row (site left, user and Log out right) with
  `grid-template-rows: auto 1fr`, so the header never stretches. **The site's
  own title and logo replace "Habre CMS" as of item 7a** - the same
  `site_settings` row the public header/footer read (`design.md`'s *Settings
  screen* and *Public site* entries below).
- **Nav (item 3):** the sidebar's first section - one entry, "Posts". Pages,
  Media, Settings and Users each add their own entry when they ship, rather
  than appearing now as dead links; `/admin` itself redirects to `/admin/posts`.
  **"Media" added in item 5a**, second in the list (ship order, not the
  eventual Posts/Pages/Media/Settings/Users order named above).
- **Lists:** a table in a bordered card; title is the link, slug underneath in
  muted text; status, author, last changed, then a right-aligned "Delete" link
  in `--color-danger` (6.0:1 light / 7.8:1 dark on the row background - the
  word carries the meaning, not the color alone). Filter tabs (All / Drafts /
  Published) with counts above, search on the right, both plain GET so they
  work with JavaScript off. A search or filter with zero matches shows one
  muted line under the table - the empty state below is only for a genuinely
  empty list, and its "New post" button would be wrong advice otherwise. Past
  20 posts, Previous/Next links carry the active tab and search forward.
- **Delete confirmation (item 3, not in the mockups):** its own page inside
  the admin shell - a short question, not a focused task, so it keeps the
  sidebar rather than dropping it the way the editor does. The post's title,
  one sentence saying it cannot be undone, a quiet "Cancel" and a default
  button reading "Delete post" recolored to `--color-danger` text and border
  (the same measured 6.0:1 / 7.8:1). A successful delete redirects to the list
  with `?deleted=<title>`, read once and shown as the same success banner the
  mockup's own publish example uses - item 4's publish/unpublish should reuse
  this pattern rather than invent a second one.
- **Media library (item 5a, not in the mockups):** no mockup covered this
  screen - `prototype`'s pages predate it and are already consumed and
  deleted, so it is built from the conventions above rather than a fresh
  design pass. Upload control (file input, an "Alt text" field required
  before the primary "Upload" button will do anything useful, both native
  form controls so the upload works with JavaScript off) sits in its own
  bordered card above a **thumbnail grid** - list's own table shape does not
  fit a screen whose whole point is the image. Each card is bordered like a
  list row, `auto-fill, minmax(12rem, 1fr)` so it reflows rather than
  scrolling sideways: thumbnail (`object-fit: cover`, sunken-surface
  background so a transparent PNG still shows its edges), filename, then two
  muted lines - dimensions and size, then uploader and date, matching the
  list's own "last changed" wording pattern, then a "Delete" link (shown only
  when the viewer may use it), same `--color-danger` text as *Lists*' own -
  each one given a visually-hidden filename suffix (`post-list.tsx`'s
  pattern), since a grid of identical "Delete" links has nothing else to
  tell them apart by (F-73). Empty state is one muted sentence, matching the
  existing empty-list convention. Screenshots: `blueprint/reference/5a-media-library/`.
- **Editor:** the sidebar is dropped - top bar with back link, status badge and
  save state on the left, Save draft and Publish on the right. Title is a large
  borderless field; "Web address" (never "slug") shown beneath with Change. Blocks
  get a hover background and a drag handle in the left margin; a round + button
  opens a menu of the four block types, each with a one-line description. **Image
  blocks show the media's own alt text as a read-only line beneath the image, not
  an editable field** - this line originally said "field", written before item 5a
  decided alt text is one value per file, captured once at upload (D55); there is
  nowhere in the post editor to edit it, by design, not by omission.
- **Sections (item 10, page editor only, not in the mockups):** a page's body is
  a stack of bordered cards (`--color-border`, `--radius-md`, `--space-4` inside,
  `--space-5` between - decorative, like every other card border here), each
  holding its own editor. The card's bar shows a muted "Section 2 of 4" heading
  (`--color-text-muted`, `--text-sm`) on the left and **quiet** "Move up", "Move
  down" and "Remove" buttons on the right; each button's accessible name adds the
  position after the visible words ("Move up (section 2 of 4)"), so the visible
  label stays inside the name. Below the last card, a default "Add section"
  button. States: the first card's Move up and the last card's Move down are
  disabled; **the only section has no Remove at all**; at 30 sections "Add
  section" is disabled with "A page can have up to 30 sections." beside it.
  **Remove asks first, inline:** the actions are replaced by "Remove this
  section?", a default "Remove" and a quiet "Keep", with focus on Keep - never a
  dialog. Focus otherwise follows the change (the same direction's button after a
  move, the heading of the section that takes its place after a remove (the one before, when the last was removed), the new section's editor after
  an add) and each change is announced in a polite live region ("Section moved to
  position 2 of 4."). Editor.js's 300px of padding under the last block is
  removed inside a section. **On the public site a section adds no chrome of its
  own**: a `<section>` with the page's usual spacing, `--space-7` between
  sections, nothing drawn. Screenshots: `blueprint/reference/10-sections/`
  (light, dark, and the remove confirmation in each). Screen-reader behaviour is
  unverified (`needs-you.md`).
- **Columns (item 11, page editor and public page, not in the mockups):** each
  section card's bar gains a native radio group - legend "Columns" (its
  accessible name adds the position, "Columns (section 2 of 4)", like the Move
  buttons) and three options, "1 column", "2 columns", "3 columns", in
  `--text-sm` with `accent-color: var(--color-accent)`. It sits between the
  "Section 2 of 4" heading and the quiet buttons; the bar already wraps, so on a
  narrow card the buttons drop to a second line. **Below the bar the section's
  editors sit in equal columns (`--space-4` apart) from `48rem` up and stacked
  below it** - the app's one breakpoint. Each column has its own editor, named
  "Section 2, column 1 content" (a one-column section keeps "Section 2
  content"). **Changing the count happens at once, with no prompt:** growing adds
  empty columns on the right; shrinking merges the removed columns' blocks onto
  the end of the last kept one, in column order, so nothing is lost - which is
  why, unlike Remove, it does not ask. Focus stays on the chosen radio, and a
  polite announcement follows ("Section 2 now has 2 columns. Column 3 merged
  into column 2."). If a column cannot be read (for example a
  checklist, which cannot be stored) the count does **not** change and an error banner (the
  standard `Message`) above the columns says why. **On the public page** a
  multi-column section is a grid of equal columns from `48rem` up (`--space-5`
  gap) and a single stack below it, in column order, so the reading order is the
  same either way. An empty column keeps its cell when side by side, so the next
  column does not slide over, and is hidden when stacked. The page body keeps
  its reading width (`--measure`, 42rem), so three columns are narrow - wide
  enough for a short paragraph or an image, not for long text. No new colours.
  Screenshots: `blueprint/reference/11-columns/` (editor and public, light and
  dark). Screen-reader behaviour is unverified (`needs-you.md`).
- **Hero (item 12a, page editor and public page, not in the mockups):** the
  first ready-made section kind - fixed slots instead of free columns. **In the
  editor** the add row below the last card holds two default buttons, "Add blank
  section" and "Add hero section" (both disabled at 30 sections, with the same
  "A page can have up to 30 sections." hint). A hero card has the usual bar -
  muted "Section 2 of 4" heading, quiet Move up / Move down / Remove with the
  inline confirm, same focus and announcements - but **no Columns radios**: a
  small bordered "Hero" tag (`--color-border`, `--color-text-muted`,
  `--text-sm`) sits where they would be. Below the bar is a plain form, not
  Editor.js: Heading ("Heading (required)", marked `aria-required`, never the
  native `required`, so the app's own message shows), Text (3-row textarea),
  Button label, Button link (plain text with a URL keyboard, never `type=url`, which refuses `/about`), each with a visible label and a muted
  `--text-sm` hint beneath, tied to the field with `aria-describedby`. The fields
  carry no `name`: the save reads them through `contentRef`, like every section.
  A new hero starts empty with focus in Heading and a polite "Hero section added.
  Now N sections." A refused save shows the server's message ("Section 2 (hero):
  the heading is required.") in the page form's usual error banner and keeps
  what was typed. Kinds are not convertible: remove and add the other.
  **On the public page** a hero is a `<section data-kind="hero">`, centred text,
  an `<h2>` at `--text-2xl` with no top margin, one paragraph of text when set,
  and the button as a link in the **primary button's pair** (`--color-on-accent`
  on `--color-accent`, already measured above: 6.4 light / 8.4 dark), `--text-md`,
  `--control-height` tall, `--radius-md`, hover `--color-accent-hover`. Spacing
  between sections is unchanged (`--space-7`); no new colours, so no new contrast
  figures. It reads in the page's 42rem column at every width. Screenshots:
  `blueprint/reference/12a-hero/` (editor and public, light and dark).
  Screen-reader behaviour is unverified (`needs-you.md`).
- **Call to action (item 12b, page editor and public page, not in the mockups):**
  the second ready-made section kind, built like the hero. **In the editor** the
  add row now holds three default buttons - "Add blank section", "Add hero
  section", "Add call to action" - all disabled at 30 sections with the same hint,
  wrapping on a narrow screen. A call-to-action card has the usual bar with a
  small bordered "Call to action" tag in place of Columns, and the hero's form,
  except that **the button is required**: "Button label (required)" and "Button
  link (required)" are `aria-required`, never the native `required`. A new one
  starts empty with focus in Heading and a polite "Call to action section added.
  Now N sections." A refused save names it ("Section 2 (call to action): the
  button needs a label and a link.") and keeps what was typed. Kinds are not
  convertible. **On the public page** it is a `<section data-kind="cta">`: a panel
  on `--color-surface` with a 1px `--color-border` (decorative, 1.29:1 light /
  1.3:1 dark, like every card border), `--radius-md`, `--space-6` padding,
  centred text, the `<h2>` at `--text-xl`, one paragraph when text is set, and
  always the button, in the hero button's rule (`--color-on-accent` on
  `--color-accent`). The only new colour pair is that button fill on the panel
  (6.45 light / 7.76 dark, table above). It differs from a hero by being a
  contained panel, so the two are never mistaken on a page. Screenshots:
  `blueprint/reference/12b-cta/` (editor and public, light and dark).
  Screen-reader behaviour is unverified (`needs-you.md`).
- **Image and text (item 12c, page editor and public page, not in the mockups):**
  the third ready-made kind. **In the editor** the add row now holds four default
  buttons - "Add blank section", "Add hero section", "Add call to action", "Add
  image and text" - all disabled at 30 sections, wrapping on a narrow screen;
  four stay buttons, and a menu is revisited at a fifth kind (D135 closed). The
  card has the usual bar with a bordered "Image and text" tag in place of
  Columns, then an "Image (required)" fieldset above the hero's four fields: three
  states - **empty** ("Choose image" only), **chosen** (a thumbnail up to 12rem
  wide with `alt=""`, a muted "Alt text: ..." line and a quiet "Change image"
  button) and **missing** (the library row was deleted: "This image is no longer
  in the library. Choose another." linked to the button). The button opens the
  image block's picker dialog; focus returns to it when the dialog closes. A new
  one starts empty with focus on "Choose image" and a polite "Image and text
  section added. Now N sections." A save with no image, or a missing one, is
  refused as "Section N (image and text): choose an image." with typed text kept.
  The button pair is optional, as on a hero. **On the public page** it is a
  `<section data-kind="image-text">`: the picture on the left and the `<h2>` (at
  `--text-xl`), optional paragraph and optional button on the right, two equal
  columns with a `--space-6` gap from `48rem`, stacked picture-first below; the
  picture keeps its aspect ratio (`width`/`height` set), has `--radius-lg` like
  every image, the library's alt text and no caption. With no picture row the text
  takes the full width. No new colour pair: text on the page background and the
  hero button's rule, both already tabled. Screenshots:
  `blueprint/reference/12c-image-text/` (editor and public, light and dark; public
  at 375 px). Screen-reader behaviour is unverified (`needs-you.md`).
- **Image block and picker (item 5b, not in the mockups):** a bordered card
  (`--color-border` on `--color-surface`, 1.3:1 - decorative, matching every
  other card border in the app) holding either a centered "Choose image" button
  (default button style) or, once chosen, the image itself at up to full column
  width with 12px radius, a plain-text line of its alt text below
  (`--color-text-muted` on `--color-surface`, 6.3:1 light / 7.3:1 dark - already
  tabled above) and a quiet "Change image" button. A media id with no matching
  row (the file was deleted from the library after being placed) shows the same
  card with "This image is no longer available." in place of the image, and the
  same "Choose image" button to replace it - never a crash. "Choose image" opens
  a native `<dialog>` (`showModal()`, so Escape and the platform's own focus trap
  are free): a bordered header with the title and a quiet "Close" button, then a
  thumbnail grid reusing the media library's own card shape - each thumbnail a
  full `<button>` whose visible filename is its own accessible name, no
  visually-hidden suffix needed (unlike the list screens' identical "Delete"
  links, F-73 - nothing else in this grid needs telling apart by anything but
  the name). A click on the backdrop (the dialog element itself, outside its
  rendered box) closes it the same as Escape or Close, selecting nothing.
  Previous/Next between pages below the grid; an empty library shows one muted
  sentence and a link to `/admin/media` (opens in a new tab, so the post is
  never left mid-edit). All text in the block and the dialog is
  `--color-text`/`--color-text-muted` on `--color-surface` - the dialog title and
  every thumbnail's filename measure **16.75:1 light / 14.07:1 dark**
  (`--color-text` on `--color-surface`; not previously its own row in the table
  above despite being the same pairing the toolbar's own icons already use -
  added below). Every button (Choose image, Change image, Close, Previous, Next)
  reuses the existing default/quiet button styles and their already-measured
  `--color-border-control` edge (3.3:1 light / 3.7:1 dark) - nothing here
  introduces a new button variant. The backdrop is a flat `rgb(0 0 0 / 0.4)`
  scrim, decorative rather than a contrast-graded pairing. Screenshots:
  `blueprint/reference/5b-image-block/`.
- **Settings screen (item 7a, not in the mockups):** like the media library
  and image picker before it, this screen predates no mockup and is built
  from the existing conventions rather than a fresh design pass. A single
  bordered-card form (the same shape as every other admin form): "Site
  title" as a labelled text field, then a "Logo" field below it - either a
  centered "Choose logo" button (default style) or, once one is set, a small
  preview image next to "Change logo" and "Remove logo" (both quiet buttons).
  "Choose logo" and "Change logo" open the **identical dialog** the post
  editor's image block already uses (same card grid, same Previous/Next,
  same measured contrast) - a deliberately separate copy of it
  (`logo-picker.client.ts`), not a shared component, since this is its
  second use rather than its third (`fundamentals.md`). Save is the one
  primary button at the bottom, success and error shown with the existing
  `Message` banner. Keyboard and screen-reader use is **not yet verified**
  (`needs-you.md`).
- **Inline formatting** (item 2b, not in the mockups): selecting text opens
  Editor.js's own inline toolbar with exactly **Bold, Italic, Link** (shortcuts
  Ctrl/Cmd+B, I, K) in text and list blocks; the link field opens beneath it.
  **Headings offer Italic and Link only**, because headings are already bold and
  Editor.js's Bold un-bolds them with markup no save can keep (F-43, confirmed in
  the app). Giving headings their own list makes Editor.js 2.31.6 add its
  "Convert to" menu there, offering only Text - chosen by the owner over hiding
  it with CSS, which could leave an invisible item in the keyboard order. The + menu shares the same popover. Both are re-coloured onto the tokens in
  `post-form.module.css` - surface background, `--color-text` icons,
  `--color-surface-hover` hover, accent for active, 2px inset focus ring on the
  link field **and on each toolbar button** (inset because the popover clips
  outside). Editor.js's own focus affordance is a background swap at 1.11 / 1.09
  against the toolbar - imperceptible, and identical to hover, so keyboard focus
  could not be seen or told apart from the pointer (F-48); keyboard focus there
  is a class, not DOM focus, so the ring hangs off `.ce-popover-item--focused`.
  Measured light / dark: icon 16.75 / 14.07, hovered icon 15.07 / 12.86, link
  field text 16.75 / 14.07, **focus ring on the toolbar surface 6.45 / 7.76**.
  Editor.js's tooltip is left as shipped (dark in both schemes): title 10.66,
  shortcut line 4.73. **Text selection inside the editor** is `--color-accent`
  with `--color-on-accent` (6.45 / 8.40), overriding Editor.js's own
  `.codex-editor ::selection` light blue, which hid selected text in dark mode;
  the rest of the app keeps the browser default. The toolbar's
  background differs from the page by only 1.07:1, and its border is decorative
  at 1.29 / 1.30 against that background - **the icons are what identify it**, at
  16.75 / 14.07 (F-53: the border was credited with a job it cannot do). Keyboard and screen-reader use is **not yet verified** (`needs-you.md`).
  Screenshots: `blueprint/reference/2b-inline-toolbar/`.
- **Public site:** header with logo, site title and the navigation menu, all
  live as of item 7b; article
  with date and author above the title **on a post** - a page (item 6b) has no
  byline, since it is static reference content rather than a dated article;
  images full column width with 12px radius and muted caption; footer on
  `--color-bg`.
- **Navigation menu** (item 7b): plain text links in the header, next to the
  site title, `--color-text` with an underline on hover - the same pairing
  `home.module.css`'s own post list already uses, not a new one invented for
  this row. An empty menu renders no `<nav>` at all. Computed from the
  tokens against the header's `--color-bg` background: text **15.62:1 light /
  15.15:1 dark**, the `:focus-visible` ring (`--color-focus`, 2px, 2px offset,
  the project's standard focus treatment) **6.01:1 light / 8.35:1 dark** -
  both comfortably over the 4.5:1 text and 3:1 non-text bars. Hover adds only
  an underline, so its contrast is the same as the default state's. Keyboard
  and screen-reader use is **not yet verified** (`needs-you.md`).
- **Words:** plain language, no CMS jargon. "Web address" not "slug", "Log in"
  not "Sign in", "Last changed" not "Modified".

## Accessibility bar

- **Standard: WCAG 2.2 level AA.** This is the accessibility standard
  `quality-bar.md` defers to this file, and `review` enforces it.
- **Checked in the mockups (2026-09-15):**
  - Text contrast >= 4.5:1 and non-text UI contrast >= 3:1 in both schemes - the
    table above, computed from the hex values with the WCAG relative-luminance
    formula. Disabled buttons are exempt (1.4.3) and are the only thing below.
  - Focus is always visible: 2px accent outline with 2px offset on
    `:focus-visible`. The editor title removes its outline only because the
    whole canvas is the editing context - **re-check this when building item 2.**
  - Targets >= 24px (2.5.8): controls 40px; the drag handle is 24px.
  - Every input has a real `<label>` (visually hidden only for the title, search
    and alt text, where the context is unambiguous); errors use `role="alert"`,
    success uses `role="status"`.
  - Status is never color alone: badges carry the word.
  - Layout holds at 390px wide (phone) and 1280px, both schemes - viewed as
    Chromium screenshots.
- **Not checked yet - needs a person or the real app:** keyboard-only walkthrough
  and focus order, screen-reader output (especially Editor.js blocks and the block
  menu), 200% zoom and reflow at 320px, and reduced-motion (only a 120ms hover
  transition exists so far).
