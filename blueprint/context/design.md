# Design

> Written by `prototype` on 2026-10-02, **a deliberate redesign for platform v1**
> that replaces the 2026-09-15 record. **Survives the mockups:** `ship` deletes
> `prototypes/` once the look is built; this file stays, and `review`, `spec`
> and `architect` read it. Change a decision here in the same change that
> changes the code.
>
> **The app has this look** since item 13b ported it to every existing screen
> (tokens in `app/app.css`, Inter self-hosted under `app/fonts/`, public pages
> in the `data-surface="site"` scope). Every screen is measured against this
> file.

## Product type and direction

**Mixed** (`ux-checklist.md` section 1): Habre's own signed-in product -
signup, onboarding, admin, editor - is a **web app** with a sidebar; each
customer's public site is a **content website** with a top nav and a footer.
Separate layouts and separate token scopes, never one nav for both.

**Habre: a red panda (habre) - warm, friendly and roomy.** One rust brand
colour from the fur, cream and chestnut-black neutrals from the face and legs,
Inter, rounder corners and 44px controls. Light and dark follow the device.
Built for people with no technical knowledge, who come in for a few minutes at
a time and must never wonder what to press next.

**Customer sites are theirs, not Habre's.** Neutral ink until the owner picks a
brand colour; one of three style presets; light only unless the owner turns
dark mode on (Pro). The only Habre mark is a "Made with Habre" footer link,
which the paid plan removes.

Mockups (throwaway): `start.html` (onboarding step
1), `start-brand.html` (step 3, Make it yours), `home.html` (admin Home),
`editor.html` and `editor.html#heading` (two states), `site-home.html` (a
published site), `components.html` (every component, both scopes). Tokens:
`prototypes/theme.css`; components: `prototypes/components.css`. Checks:
`prototypes/checks/contrast.mjs` (`shoot.mjs` removed with item 13b; the
browser suite's 390px tests and `e2e/contrast.spec.ts` check the real app).
`signup.html` was removed with item 15b: the built `/signup` is now the
signup layout.

## Where the tokens land

- **`app/app.css`** receives `theme.css` as custom properties - plain CSS,
  no Tailwind (D12). Components stay CSS Modules beside their feature, using
  only role tokens; `prototypes/components.css` is their reference, not a file
  to copy wholesale.
- **A re-theme build item** renames the app's current tokens to the kit's
  names first: `--color-accent` -> `--color-primary`, `--color-focus` ->
  `--color-focus-ring`, `--color-border-control` -> `--color-border-strong`,
  `--font-sans` -> `--font-family-sans`.
- **Fonts are self-hosted** woff2 files with their SIL Open Font License
  files: Inter for Habre's screens in `app/fonts/` (item 13b), the presets'
  pairs still in `prototypes/fonts/` until item 18a; a customer site loads
  only its preset's pair. No third-party font request.
- **A site's brand colour and preset** reach its public pages through a
  per-site stylesheet or a nonce, because the Content-Security-Policy is
  `style-src 'self'` - `architect` decides (D167).

## Token changes from the kit, and why

Values only; no kit token was renamed or removed. `theme.css` marks each one
`Habre:`.

| Token | Kit | Habre | Why |
|---|---|---|---|
| `--color-primary` | blue-600 | **rust-700 `#b4441c`** light, **rust-400 `#f08c5a`** dark | The red panda's fur. Rust-500 is decorative only - it fails as text on light. |
| Neutrals (`--color-bg`, text, borders) | slate | **stone**: bg `#fbf8f4` light / `#18110d` dark | Warm greys that sit with rust; cool slate fought it. |
| `--color-danger` | red-700 | **crimson-700** / crimson-400 | A different hue from the brand: Delete must not look like Save. |
| `--color-warning` | amber-700 | **ochre-700** / ochre-400 | Amber sits next to rust. |
| `--font-family-sans` | names Inter, loads nothing | **Inter, self-hosted** (variable, latin, 47 KB) | Named and not loaded meant system fonts on most machines. |
| `--radius-sm/md/lg` | 4 / 8 / 12px | **6 / 10 / 16px** | Friendlier, without going soft. |
| `--size-control-sm/md/lg` | 32 / 40 / 48px | **36 / 44 / 52px** | Roomy, and every default control meets the 44px touch target. |
| `--shadow-*` | slate-tinted | **stone-950-tinted** | Warm shadows on a warm background. |

**Added tokens** (names the kit does not have):

- `--font-family-heading` - so a preset can pair two fonts. Same as the body
  on Habre's screens.
- `--color-selection`, `--color-on-selection` - the editor's chrome over the
  canvas (selected block, drop gap, section chip): Habre's rust, set inside
  the site scope at the canvas's own scheme, so it stays visible on a light
  canvas inside dark Habre.
- `--font-family-ui`, `--radius-ui` (in `components.css`, on `:root`) - carry
  Habre's font and corners into the canvas, whose preset changes the site's.

**Customer-site scope, `[data-surface="site"]`:** the same role names with
`--neutral-*` greys and ink buttons, so every component renders unchanged
inside it. **It sets every role** rather than inheriting Habre's, because a
Simple site is light even when Habre is dark. `[data-dark="auto"]` (Pro) adds
the dark values. `[data-brand]` and `[data-style]` layer on top.

### Measured contrast (WCAG 2.2) - do not change a colour without re-measuring

From `node prototypes/checks/contrast.mjs`, 2026-10-02, after the last change.
**Fails: none.** Columns: Habre's screens, a neutral site, a branded site (the
`#2f6b5a` example), each with the device in light and dark. A light-only site
under a dark device measures the same as light, which is the point.
**Also proved on the real app** since item 13b by `e2e/contrast.spec.ts`
(Habre light and dark, the site scope light and with the device dark), which
fails on any pair below its bar - the selection pairs join it with item 14a.

| Pair (min) | App L | App D | Site L | Site D (Pro dark on) | Brand L | Brand D (Pro dark on) |
|---|---|---|---|---|---|---|
| text on bg (4.5) | 17.63 | 16.33 | 17.93 | 18.16 | 17.93 | 18.16 |
| text-muted on surface-hover (4.5) - worst muted | 6.67 | 6.00 | 7.17 | 6.00 | 7.17 | 6.00 |
| primary on bg (4.5) | 5.24 | 7.65 | 17.93 | 18.16 | 6.23 | 6.72 |
| primary on surface (4.5) | 5.55 | 6.99 | 17.18 | 16.44 | 5.97 | 6.09 |
| on-primary on primary (4.5) | 5.55 | 7.65 | 17.93 | 18.16 | 6.23 | 6.72 |
| primary on primary-subtle (4.5) | 5.08 | 6.63 | 16.44 | 13.88 | 5.67 | 5.02 |
| border-strong on surface (3) - the lowest | 3.82 | 4.47 | **3.31** | 4.54 | **3.31** | 4.54 |
| focus-ring on bg (3) | 5.24 | 7.65 | 17.93 | 18.16 | 6.23 | 6.72 |
| danger on danger-subtle (4.5) | 5.72 | 5.81 | 5.72 | 5.81 | 5.72 | 5.81 |
| success on success-subtle (4.5) | 4.79 | 8.55 | 4.79 | 8.55 | 4.79 | 8.55 |
| warning on warning-subtle (4.5) | 4.76 | 9.52 | 4.76 | 9.52 | 4.76 | 9.52 |
| selection on bg (3) | 5.24 | 7.65 | 5.55 | 8.11 | 5.55 | 8.11 |
| on-selection on selection (4.5) | 5.55 | 7.65 | 5.55 | 7.65 | 5.55 | 7.65 |
| bg on text-muted (4.5) - pressed toolbar button | 7.21 | 7.40 | 7.81 | 7.85 | 7.81 | 7.85 |

The script measures 29 pairs; the rest are higher than the rows shown.
Disabled controls are exempt (1.4.3) and are the only thing below these.

## Customer sites: brand colour, presets, dark mode (D167, 2026-10-02 review)

- **Brand colour.** Our own function derives `--color-primary`, `-hover`,
  `--color-on-primary`, `--color-primary-subtle` and `--color-focus-ring` from
  one hex - for light, and for dark when it is on - by moving the colour's
  OKLCH lightness until each pair meets AA: primary at least 4.5:1 on bg and
  surface, on-primary at least 4.5:1 on primary and on hover, **and primary at
  least 4.5:1 on subtle**. A sketch that checked only the first two let gold
  `#c9a25e` through at 4.39 on subtle, so the subtle check is required.
  The example `#2f6b5a` passes unchanged: light 6.23, dark `#66a28f` 6.72.
- **Presets** (names provisional), each a font pair and a corner shape and
  nothing else, so a preset never changes contrast:

  | Preset | Headings | Text | Radius sm/md/lg | |
  |---|---|---|---|---|
  | Classic | Source Serif 4 | Source Sans 3 | 2 / 3 / 4px | square |
  | **Modern** (default) | Inter | Inter | 4 / 8 / 12px | the kit's |
  | Friendly | Nunito | Nunito | 10 / 22 / 24px | pill buttons and inputs |

- **No logo gives a wordmark** (`.site-brand.wordmark`): the site's name in
  the preset's heading font and the brand colour.
- **Light only in Simple; Pro can turn dark mode on** (owner, 2026-10-02):
  a site looks the way its owner saw it in the editor, and a dark logo never
  disappears on a dark page.
- **Light only, built (D168, item 13b).** Public pages, the public 404 and
  the error page sit in the site scope (`data-surface="site"` on `<html>`,
  chosen by path with the same rule as the Content-Security-Policy), which
  sets `color-scheme: light`. Items 1-12 followed the device; Pro's dark mode
  (item 20) turns it back on per site.

## Navigation map

**Habre - signed out:** Sign up (the front door: email, password, site
address), Sign in, Forgot password. One centred form; from 1024px a panel
beside it says what you get.

**Onboarding `/start`:** a full-screen flow, Habre's logo only, three real
URLs so Back works: 1 What do you want to create? (Website, Blog, Business,
Portfolio) - 2 Tell us about it - 3 Make it yours (optional: logo, brand
colour, style; Skip keeps the AI's colour and Modern). Step 1 offers "Start
blank instead".

**Admin shell** (sidebar from 769px; a top bar with Menu below that):
- Site card: name, address, View site
- **Home, Pages, Blog, Media, Messages, Settings** - and **Users** when the
  site is on Pro (D166)
- Account menu at the foot, under the person's name and plan: **Your
  account, Plan, Sign out**
- **Suspended notice** (item 16b): while the operator has suspended the
  site, the top of the main area, before the page's `h1`, on every shell
  screen: "This site is suspended." / "Visitors see Not Found instead of its
  pages." `Message`'s `notice` tone - the error banner's look and colours,
  **no role**: a standing fact, not an action's outcome, so it is read in
  order and never interrupts on each navigation. Its title is a `p`, so the
  outline is unchanged.

**Editor:** full screen, no sidebar; Back returns to Pages or Blog. Same
editor for pages and posts.

**A customer's site:** the owner's menu in the header (logo or wordmark on the
left, links on the right; a Menu button on a phone), footer with their line
and "Made with Habre".

## Screens

Checklist section 2, for this product. **Mocked** = in `prototypes/`.

| Screen | | |
|---|---|---|
| Sign up | applies | **built** (item 15b, `/signup`), with the address-taken error and suggestions |
| Check your email, then the emailed link signs you in (D161) | applies | **built** (item 15b), the signup layout: `/signup/sent` - "Check your email", Send it again, "We couldn't send the email" as the kit's `Message`; `/verify` - "Confirm your email" with one Confirm my email button (D251), and its expired-or-used and already-confirmed states (D269). Each a heading, one paragraph, a `Message` for an error, one primary button |
| Sign in | applies | item 15; the signup layout. Its error never says which half was wrong |
| Sign out | applies | account menu, every signed-in page |
| Forgot password -> email -> reset -> signed in | applies | **built** (item 15c), the signup layout, only when email is configured: `/forgot-password` - "Reset your password", Email, Send me a link, the same success `Message` for every address, Back to log in; `/reset-password` - "Choose a new password", one New password field with its hint, Save and log in, signing in and ending every other session; its expired-or-used state with "Ask for a new link". Login's "Forgot your password?" links to it |
| Session expired -> sign in -> back where you were | applies | existing behaviour, kept |
| Not allowed (403) | **not applicable** | a refusal is a 404 by design (D69) |
| Your account: name, email, password, delete account | applies | **built** (item 15e1: name, email, password; item 15e2 steps 3-4: delete built in full - leaving, the last admin taking the site) - item 15e1 (name, email, password) and 15e2 (delete): `/admin/account` in the shell for every role, linked from the shell's foot until item 21's Plan makes the account menu; the Users edit screen's shape - `h1` Your account, a `section` with an `h2` and one form per thing (Name, Email, Password), a `role="status"` banner after each save. Email and password ask for the current password. With email on, a new email waits for `/confirm-email` (the `/verify` shape, D251): "We sent a link to *address*" shows meanwhile. **Delete (15e2, spec 2026-10-05):** a Delete account `section` ending in a link to `/admin/account/delete`, Media's delete-confirmation shape - a heading, what goes (leaving: your content stays as "Deleted account"; the last active admin: the site's address, its counts and the other members' names, plus a typed-address field), the current password, a `.danger` **Delete my account** and Cancel. Afterwards `/login` with a `role="status"` "Your account is deleted." |
| Plan | applies | deferred to item 21 (Stripe's hosted pages, D160) |
| First run | applies | **mocked**: onboarding (`start.html`, `start-brand.html`) and Home straight after the AI draft (`home.html`) |
| The AI drafting your site (a wait of seconds to a minute) | applies | **deferred to item 18** - mock it in that item's spec: what is happening, no dead spinner, what to do if it fails |
| Home (state, next steps, this month's allowance) | applies | **mocked** (`home.html`) |
| Pages, Blog lists, with search, filter, pagination | applies | conventions carried over (below); the kit's table |
| Editor | applies | **mocked**, two states (`editor.html`) |
| Media | applies | carried over (below) |
| Messages (contact form submissions) | applies | deferred to item 19; the kit's list and empty state |
| Settings: name, address, logo, brand colour, style, home page, menu, SEO defaults, level, dark mode (Pro) | applies | deferred to items 16-20; the kit's form; brand colour and style reuse `start-brand.html`'s controls |
| Users | applies, Pro only | carried over from item 8 |
| Not found (404), on Habre and on a site | applies | the kit's `.error-page`, in each scope; not re-mocked |
| Something went wrong (500) | applies | the kit's `.error-page`; no stack trace |
| Loading, empty, error, success for every list and action | applies | conventions carried over (below) |
| Unique page titles | applies | `<screen> - <site> - Habre` in the admin; the page's own title on a site |
| A customer site's home page | applies | **mocked** (`site-home.html`) |
| Footer privacy, terms, contact (Habre's own pages) | applies | blocked on terms of service and a privacy policy (`needs-you.md`) |
| Social and search metadata | applies | item 17 |
| Readable measure | applies | `--size-measure` 68ch for running text |
| Safe areas, offline, platform back | **not applicable** for safe areas and offline - a server-rendered web app, not an installed one; back applies and works (real URLs, including onboarding's steps) |

## Journeys

`spec` turns each into done-whens for the item that builds it.

1. **The first two minutes:** Sign up -> emailed link -> What do you want to
   create? -> Tell us about it -> Make it yours (or Skip) -> the AI drafts ->
   Home, "Your website is ready" -> Preview -> Publish website. (items 15, 18)
2. **Edit and publish:** Home -> Edit the home page -> drag a block in ->
   change its text -> Publish -> View site shows it. (item 14)
3. **Move a block without dragging:** select it -> Move up / Move down -> the
   new position is announced; or focus a palette tile -> Enter -> the block is
   added after the selected one. (item 14, WCAG 2.5.7)
4. **Choose the main heading:** select a heading -> Text style -> Main heading
   -> the previous main heading becomes a Heading, and that is announced; a
   page with none shows its title. (item 14)
5. **Make it yours later:** Settings -> brand colour or style -> the preview
   changes -> Save -> the site changes. (item 18)
6. Signed out -> a protected page -> sign in -> that page.
7. Reset your own password -> what happens to your session -> where you end up.
8. Submit a form with an error (sign up, a contact form) -> the error beside
   the field, your input kept.
9. Delete something -> confirmation naming it -> back to the list with its
   filters.
10. A visitor sends the contact form -> it appears in Messages and by email.
    (item 19)
11. **Switch Pro -> Simple:** every page still renders; Pro-only settings lock;
    text stays editable. (D166, item 20)
12. Change another user's role (Pro) -> what they see on their next request.

## Editor decisions (D165-D167, 2026-10-02 review)

- **Palette** (owner, 2026-10-02): blocks **Text, Heading, List, Image,
  Button, Quote, Line, Space**, and **Contact form** from item 19; sections
  **Blank section, Hero, Image and text, Call to action**. Drag a tile into a
  column, or focus it and press Enter to add it after the selected block (a
  section tile adds its section after the selection's section, and dragging
  one drops it between sections). It collapses to a rail of icons whose names stay as accessible names.
- **Page structure:** sections of one to three columns; columns hold blocks
  top to bottom. A heading across three columns is a one-column section above
  them. **Columns stack when their container is narrower than 40rem** - a
  container query, so the canvas and the published site behave identically.
- **Dragging:** a gap opens where the block will land, labelled "Drop image
  here", a ghost follows the pointer, and a live region says where it will
  drop ("Image. Drop at the top of column 2, Portraits, in section 3.").
- **The selected block** gets a 2px rust ring and an inverted toolbar above
  it: drag handle, **Move up, Move down** (always there), the Text style menu
  and Bold, Italic, Link for text, then Duplicate and Delete. On a phone the
  toolbar wraps rather than running off the screen.
- **Text style menu:** Text, **Main heading**, Heading, Subheading, Small
  heading - each shown at its own size. Pro adds two smaller headings
  (H5-H6). **The person chooses the main heading** (owner, 2026-10-02): one
  per page, rendered as the page's `h1`. A hero's heading starts as the main
  heading; a page with none shows its title as the `h1` (D166, amended).
- **Settings panel** only for a block that has settings - button, image,
  contact form, a section (its columns) - never for text, which is edited
  where it sits. 17rem on the right; a bottom sheet below 1024px.
- **Section controls:** a rust chip on the section being edited - "Section 1
  of 5", Move section up/down, Section settings - at its foot below 40rem.
- **Built in item 14a2:**
  - **Image block:** with no file, the `.photo` stand-in reads "No image
    chosen" and the panel offers **Choose image**; a deleted file reads "This
    image is no longer available." and the panel offers **Replace image**. The
    panel shows the file's alt text read-only - it is set at upload (D55). A
    published image is a plain `img`, no caption (F-79).
  - **Settings panel:** its `h2` names what it edits ("Image", "Button",
    "Section 2"); **Close settings** or Escape hides it and returns focus to
    the writing area; it opens again when another block with settings is
    selected, or Section settings is pressed. **Columns live in Section
    settings**, not on the chip; the chip keeps its label and Remove section
    until 14a3. Opening it at 1024px and wider narrows the canvas by 17rem.
  - **Button settings:** Button text; Goes to - each page by title (a draft
    marked "(not published)"), "A web address…", "An email address…", the
    last two showing one field checked on Enter or leaving it, refused beside
    the field with the link dialog's words; Style - Filled or Outline.
  - **Phone:** the top bar's **Add** opens the palette in the kit's native
    `<dialog>`; choosing a tile adds the block, closes it and returns focus
    to the writing area. Below 1024px the settings panel is a bottom sheet
    that keeps the selected block in view above it.
  - **Tab order:** palette, title, writing area, section chip, settings
    panel.
- **Built in item 14a3** (decided there; the mockup is wrong where noted):
  - **Block toolbar:** `role="toolbar"` named for the block ("Heading",
    "Image"), above the block, outside the writing area, after it and before
    the chip in tab order. **One tab stop**: arrow keys, Home and End move
    within it, Escape returns to the writing area with the selection kept.
    Contents: text and heading - Move up, Move down | Text style, Bold,
    Italic, Link | Delete; **a list - Bulleted list, Numbered list in place
    of Text style** (lists are not text styles, and without them numbered
    lists would be reachable only by typing `1. `); **a quote has no style
    control**; image, button, line, space - Move up, Move down | Delete.
    Item 14b added the drag handle before Move up and Duplicate before
    Delete, in every kind's toolbar.
  - **Move up / Move down** cross columns and sections in reading order; at
    the first or last position they are `aria-disabled`, not `disabled`, so
    focus stays on the button. Delete is named for the block ("Delete
    heading").
  - **A column never empties:** its last block leaving leaves an empty
    paragraph, and a block arriving in that untouched column replaces it. In a
    section of two or three columns an untouched column shows "Empty column -
    add a block or change Columns in Section settings." in `--color-text-muted`
    (editor only; a one-column section keeps "Write your page…").
  - **Announcements**, in one polite `role="status"` outside the writing
    area: "Heading moved down: block 1 of 2 in column 2 of section 1." ("column
    N of" left out in a one-column section), "Section moved down: now section 2
    of 3.", "Heading deleted.", `"Welcome" is now a Heading.`
  - **Text style menu:** a menu button showing the current style; Enter,
    Space or Down opens it on the checked item, Enter chooses and returns to
    the writing area, Escape closes back to the button. **Main heading** is
    offered on pages only, for one block, never a range, with the hint `One
    per page. Now: "…"` (cut to 40 characters); choosing it makes the old
    one a Heading in the same step. A paste or a typed `# ` never makes a
    second; a post has none.
  - **Section chip:** label, Move section up, Move section down, Section
    settings, **Remove section** (the mockup has none, and nothing else
    removes a section). A one-section page shows no moves, as it shows no
    Remove section.
  - **Undo and Redo sit in the editor's top bar at every width.** The mockup
    hides them below 1024px, which leaves a phone with no undo at all.
  - **Tab order:** palette, title, writing area, block toolbar, section chip,
    settings panel.
- **Built in item 14b** (decided there; the mockup is wrong where noted):
  - **Dragging** uses Pointer Events - mouse, pen and touch alike - no HTML5
    drag and drop, no library. A **palette tile** (side panel, 1024px and
    wider) or **the selected block by its grip** drags to any place in any
    column; a drag starts after 6px of movement, and a shorter press is a
    click (a tile adds its block after the selected one, the grip announces
    itself). Touch drags by the grip only: a touch on a palette tile is a
    tap that adds its block. No dragging from the phone's Add dialog.
    Section tiles drag between sections (14c2); existing sections move from
    their chip.
  - **The grip** is a `button` named "Drag to move, or use Move up and Move
    down", first in the toolbar, **pointer-only and out of the arrow order**
    (`tabindex="-1"`), so the toolbar's one tab stop still lands on Move up.
    It sets `touch-action: none`, so a touch drag does not scroll the page.
  - **The gap** ("Drop image here", the kind in lower case) is a decoration
    inside the writing area - not stored, not focusable, `aria-hidden` - so
    it opens and pushes the blocks below it down. Where it lands is the
    midpoint rule: above a block's vertical middle is before it, below is
    after. **The block's own place is no target**: no gap, and a release
    there changes nothing. The ghost shows the kind's icon and name; the
    dragged tile is dashed, the dragged block dimmed; the toolbar and chip
    hide while dragging.
  - **Ending:** a release over a place drops (one undo step, the block
    selected); Escape, a release outside every section (a point under
    anything drawn over the writing area - the sticky top bar, the settings
    sheet below 1024px - is outside every section), `pointercancel` or
    a change to the document mid-drag cancels. Near the window's bottom, or
    the sticky top bar's lower edge (48px), the window scrolls each frame,
    faster nearer the edge.
  - **Announcements name positions, not columns** (the mockup names a
    column by its content; columns have no names): "Image: drop at block 1
    of 2 in column 2 of section 1.", "Heading: drop here to leave it in
    place.", "Image: release to cancel.", "Image added: ..." / "Heading
    moved: ...", "Drag cancelled.", "Heading duplicated: block 2 of 3 in
    section 1.", the palette's "You can have at most 200 blocks.", and for a
    press on the grip "Drag to move, or use Move up and Move down."
  - **Duplicate** puts a copy just after the block and selects it; a main
    heading's copy is a Heading. At 200 blocks it is `aria-disabled` and
    says the palette's sentence.
  - **The toolbar never covers the section chip:** it slides left to end
    before the chip, or, with no room there (a phone), stacks just above it.
- **Built in item 14c1** (decided there):
  - **The palette's Sections group:** an `h2` "Sections" below Blocks in the
    side panel, four wide tiles - Blank section, Hero, Image and text, Call to
    action - with the mockup's icons. A click, Enter or Space adds the section
    **directly after the section holding the selection**, the cursor in its
    first text block, announced "Hero added: now section 3 of 5." A tile is
    disabled when its template would not fit (30 sections, or 200 blocks
    counting the template's), with "Thirty sections is the most there can be."
    or "You can have at most 200 blocks." under the group's heading. Section
    tiles also drag (14c2, below).
  - **The templates, all empty - no starter text.** Hero: two columns,
    middle-aligned; heading (the Main heading on a page with none), text,
    space, button | image. Image and text: image | heading, text. Call to
    action: one column on the band; heading, text, button. Blank: one empty
    column. An image with no file chosen saves and shows only in the editor.
  - **The phone's Add dialog** is titled "Add to the page", with `h3`
    "Blocks" and "Sections".
  - **Empty-text hints:** an empty heading always shows its style's name in
    muted text; an empty paragraph beside other blocks shows "Text" until the
    cursor is in it, then "Write your page…" / "Write your post…". List and
    quote lines show no hint. An untouched column keeps the empty-column
    hint. Editor only, never saved.
  - **Tab order unchanged**, except the four section tiles follow the block
    tiles in the palette.
- **Built in item 14c2** (decided there; no mockup draws a section tile
  mid-drag):
  - **A section tile drags** (side panel, 1024px and wider) to a place
    between sections: before the first, between two, or after the last. A
    press without movement still adds it after the selection's section; a
    tile that does not fit starts no drag.
  - **Where it lands is the midpoint rule over whole sections**, anywhere
    over the writing area - above a section's vertical middle is before it,
    below is after. Outside the writing area (the title, the palette, the
    settings panel, Add a section) is no place. A dropped section never
    replaces an untouched one.
  - **The gap** is the block gap's look and size, between two sections,
    labelled with the template's name in lower case ("Drop hero here",
    "Drop call to action here"); the dashed line between sections is not
    drawn beside it. The ghost shows the tile's icon and name; the tile is
    dashed while it drags.
  - **Dropping** adds the template as one undo step with the cursor in its
    first text block - the same template and main-heading rule as a click.
  - **Announcements:** "Hero: drop as section 2 of 4.", "Hero: release to
    cancel.", "Hero added: now section 2 of 4.", "Drag cancelled.", and the
    palette's sentence should there be no room.
- **The canvas is the customer's site**, drawn in its scope with its brand
  colour and preset, light even inside dark Habre. Only the chrome is rust.
- **Phone:** the palette sits behind an Add button in the top bar.

## Components in use

**From the kit, unchanged apart from tokens:** buttons (primary, secondary,
ghost, icon, sm, lg), field, input, select, textarea, choice and switch,
alert, badge, card, table, list, menu, dialog, tabs, topbar, nav, sidebar,
mobile menu, site footer, empty state, error page, skeleton, spinner, toast,
tooltip, avatar, breadcrumbs, pagination, skip link, visually hidden. Nothing in
the kit's own rules was changed, **except the current nav entry** (item 13b,
F-143): it is also semibold with a 3px `--color-primary` bar on its start edge,
because the rust and the muted grey are ~1.03:1 apart in dark mode and colour
alone did not show which page was current (WCAG 1.4.1).

**Added** (the "Habre additions" block at the end of `components.css`):

- **Brand** - Habre's logo lockup (the mark is a placeholder until the red
  panda logo exists) and the ringed-tail band, decorative only.
- **Sign-up layout** (`.auth`), **address field with a fixed suffix**
  (`.input-group`), an available-address line (`.field__ok`).
- **Onboarding** - `.flow`, step bars, **radio buttons as large cards**
  (`.choice-card`; the real input stays inside, focus and checked drawn with
  `:has()`).
- **Admin Home** - site card, account button, page header, "ready" panel with
  a half-size site preview, suggestion links, usage meter.
  The usage meter is built (item 15d) as a native `<meter>` with a visible
  label, `app/lib/ui/meter.tsx`, drawn as the mock's `.meter` - not its
  `div role="img"`, because ARIA is for where no native element exists.
- **Sections and columns** - `.page-flow` (the container), `.sec`, `.cols`,
  `.col`; shared by the canvas and the site.
- **Blocks** - `.display`, `.lede`, `.quote`, `.rule`, `.spacer`, and a photo
  stand-in; `.site-brand` and `.wordmark`.
- **Editor** - bar, palette and tiles, canvas, section chip, block outline
  (`.blk`), drop gap, drag ghost, block toolbar, text style menu, Add a
  section, settings panel.
- **Make it yours** - two-column step with a sticky preview, logo drop,
  **colour swatches as radio buttons** (44px, ringed in `--color-text` when
  chosen, named for screen readers), **preset cards** that draw each preset in
  the site's scope, half-size live preview.
- **Mockup-only, never ported:** the light/dark toggle and the editor's state
  switch.

## Conventions carried over from 2026-09-15

These describe behaviour, not the look, and still hold. Full text in the old
record (`git show 1d58e42:blueprint/context/design.md`).

- **Pending:** the submitting button gets `aria-busy="true"` and `disabled`,
  and its label becomes the verb in progress ("Publishing…"). No full-page
  spinners or skeletons for server-rendered pages.
- **Empty:** a panel naming the next action, one sentence, the single primary
  button. A search with no matches is one muted line, not the empty state.
- **Errors:** a form or action failure is a banner, `role="alert"`, saying what
  happened and what to do; never blames, never shows codes. A field error sits
  below the field, `aria-invalid` and `aria-describedby`, input kept. Sign-in
  marks no field.
- **Success:** a banner, `role="status"`, on the page the action returns to.
- **Standing notice:** a fact about the site that holds across screens (item
  16b's suspension) - the error banner's look with no role, at the top of the
  main area.
- **At most one primary button per view.** Destructive actions confirm on
  their own page, naming the thing, then return to the list with a success
  banner (item 3's pattern).
- **Lists:** title links, filter tabs with counts, search, Previous/Next past
  20, all plain GET so they work without JavaScript.
- **Media and the image picker:** a thumbnail grid; alt text captured once at
  upload (D55); the picker is a native `<dialog>`; a deleted image shows "This
  image is no longer available." with a way to replace it.
- **Words:** plain language, no CMS jargon - "Web address" not "slug", "Last
  changed" not "Modified". **Sign up, Sign in, Sign out** - this replaces the
  old record's "Log in", so the three account words match now that there is a
  sign-up.

## Accessibility bar

- **Standard: WCAG 2.2 level AA** - the bar `quality-bar.md` defers to, and
  `review` enforces.
- **Checked in the mockups, 2026-10-02:**
  - Contrast in every scope and scheme - the table above; `contrast.mjs`
    reports no failures.
  - Focus: a 2px `--color-focus-ring` outline with offset; swatches and cards
    draw it from the hidden input with `:has(:focus-visible)`.
  - Targets: default controls 44px, swatches 44px, toolbar and chip buttons
    36px (above the 24px minimum, 2.5.8).
  - **Dragging has a single-pointer alternative** (2.5.7): Move up / Move down
    on every block and section, Enter on a palette tile; the drop position is
    announced.
  - Every input has a visible label; colour is never the only signal (swatches
    are named, badges carry words, links in text are underlined).
  - Layout at 390px and 1280px, light and dark, from Chromium screenshots
    (`shoot.mjs`): no horizontal scroll, no zero-size icon, fonts loaded.
- **Not checked - needs a person or the real app** (`needs-you.md`):
  keyboard-only walkthrough and focus order, screen-reader output (the drag
  announcements, the text style menu, the swatches), 200% zoom and reflow at
  320px, reduced motion, the colour picker.

## Open

- Preset names; the platform logo (placeholder "h" mark until then).
