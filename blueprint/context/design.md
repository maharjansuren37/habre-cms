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
| `--color-text-muted` on `--color-surface` | 6.3 | 7.3 |
| `--color-text-muted` on `--color-surface-sunken` (worst case) | 5.5 | 8.1 |
| `--color-text-muted` on `--color-bg` (public site: dates, footer, empty state - item 4b) | 5.9 | 7.8 |
| `--color-accent` (links) on `--color-bg` | 6.0 | 8.4 |
| `--color-accent` on `--color-accent-subtle` (active nav) | 5.5 | 6.9 |
| `--color-on-accent` on `--color-accent` (primary button) | 6.4 | 8.4 |
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
  the sole signal - the word is always there.
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
  `grid-template-rows: auto 1fr`, so the header never stretches. The site's own
  title and logo replace "Habre CMS" in item 7.
- **Nav (item 3):** the sidebar's first section - one entry, "Posts". Pages,
  Media, Settings and Users each add their own entry when they ship, rather
  than appearing now as dead links; `/admin` itself redirects to `/admin/posts`.
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
- **Editor:** the sidebar is dropped - top bar with back link, status badge and
  save state on the left, Save draft and Publish on the right. Title is a large
  borderless field; "Web address" (never "slug") shown beneath with Change. Blocks
  get a hover background and a drag handle in the left margin; a round + button
  opens a menu of the four block types, each with a one-line description. Image
  blocks show the alt text field directly below the image.
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
- **Public site:** header with logo, site title and the navigation menu; article
  with date and author above the title; images full column width with 12px radius
  and muted caption; footer on `--color-bg`.
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
