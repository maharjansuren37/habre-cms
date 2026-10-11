# Feature: The contact form block (19b)

**From build plan:** item 19b
**Type:** Feature
**Verified:** not yet
**Reviewed:** 2026-10-12, b499c6ba2dd1, current, every lens (by autopilot, self-review) - 0 blocking

## Goal

An owner can add a contact form to any page or post from the palette, and a
visitor can fill it in and send it. 19a built the receiving route; this is the
node, its editor view and settings, and the public form with its thanks and
error states. After 19b a message is stored but nobody sees it - 19c is
Messages and the email.

## In scope

- A `contactForm` block in the v4 document: schema, types, rendered or not,
  at most one per document.
- Editor: palette tile, canvas view, settings (button text, thanks message),
  announcements, insert / move / duplicate / delete like any block.
- Public render: a `form` posting to `/_contact` with labelled Name, Email and
  Message, the signed token, the hidden honeypot, and the line for each answer
  code; works with no JavaScript.
- The three public loaders (page, home, post) hand the form its entry id and a
  fresh token only when the document holds a contact block.
- 19a's redirect gains `#contact` so the visitor lands on the form's answer.
- The admin preview shows the form inert.

## Out of scope

- `/admin/messages`, mark read, delete, the notification email, "Send messages
  to" (19c).
- Field-level error text from the server: the answer is one code (19a's
  contract). Browser constraint validation is what puts an error beside a
  field and keeps the input.
- Custom fields, several forms on one page, a captcha (D157), translating the
  labels (site language is not applied to blocks today).
- The plan line's "added to the page's CSP form-action": `form-action 'self'`
  already allows the post (19a's note), so nothing changes; Step 6 asserts it.

## Design reference

`blueprint/context/design.md`: *Components in use*, *Palette*, journey 8
(error beside the field, input kept) and 10. No mockup exists for the form;
it uses the existing field, label and button styles of the public site
(`data-surface="site"`), the Filled button style, and a banner line like the
admin's. **Design record gaps this item fills (Step 5 writes them into
`design.md`):** the palette has nine tiles not eight; the contact form's
states (default, sent, invalid, again, busy, inert in preview).

## Build steps

- [x] **Step 1 - The node in the document** - `contactForm` in
  `document-nodes.ts` (`attrs: { buttonLabel: string; thanks: string }`),
  `document.ts` schema (button text 1-40, default "Send message"; thanks 1-200,
  default "Thanks - your message has been sent.", both `isStorableText`),
  `KNOWN_NODES`, `textNodes`, `isRenderedBlock` (always true), a refusal when a
  document holds more than one, exhaustiveness in `render.tsx`, and any other
  `switch` the compiler flags. *Done when:* `document.test.ts` covers a valid
  node, defaults filled, an over-long label, a control character, and two
  contact forms refused with the one named message; `npm run typecheck` clean.
- [x] **Step 2 - The public form** - `render.tsx` draws it: `section`-free
  `form id="contact" method="post" action="/_contact"`, `label` + `input`
  (name: `required`, `maxlength=100`, `autocomplete=name`; email:
  `type=email`, `required`, `maxlength=254`, `autocomplete=email`) and
  `textarea` (`required`, `maxlength=5000`), hidden `entry` and `started`, the
  honeypot `url` in an off-screen `aria-hidden` wrapper (`tabindex=-1`,
  `autocomplete=off`), and a submit `button`. `renderDocument` takes an
  options object `{ contact?: { entryId, started, answer } }`; with none the
  form renders inert (disabled fields, no `action`) - the preview's case. The
  answer line: `sent` shows the block's thanks text, `invalid`, `again`
  and `busy` show fixed sentences, in a `role="status"` element above the
  form. *Done when:* a render unit test (like the existing `render` ones) shows
  each element and attribute above, each answer's line, and the inert
  variant; a form with no `contact` option has no `action`.
- [x] **Step 3 - The loaders and the redirect** - `page.tsx`, `home.tsx`,
  `post.tsx` loaders return `contact: { entryId, started: issueContactToken(now),
  answer }` only when `blocksOf(document)` has a contact block (answer from
  `?contact=`, any value outside the four codes ignored); the entry id
  stays off the wire otherwise (F-108). `contact-submit.ts`'s `answer()` appends
  `#contact`; 19a's e2e location assertions are updated to match. The preview
  routes pass no `contact`. *Done when:* `e2e/contact.spec.ts` gains: a page
  with a contact block carries a `started` token and its entry id in the
  HTML; a page without one has neither; `?contact=bogus` shows no line.
- [x] **Step 4 - The editor** - a TipTap node (atom, block, draggable like
  `button`), its canvas view (the three fields drawn disabled with the button
  text), `PALETTE_KINDS` + `newBlock`, the tile and icon in `palette.client.tsx`
  (disabled with the same kind of note as a full document when one exists),
  the settings panel (Button text, Thanks message), toolbar name and
  announcements ("Contact form added." etc.), and `block-moves` /
  `block-drops` if they list kinds. *Done when:* `palette-insert.test.ts` covers
  the new kind; `e2e/document-editor.spec.ts` (or the nearest spec) shows: the
  tile adds it by click and by Enter, it moves, duplicates (refused, with the
  note, because only one is allowed) and deletes with Undo, and its two settings
  save and reload.
- [x] **Step 5 - The journey, and the record** - `e2e/contact-form.spec.ts`:
  an admin adds the block to a page and publishes; a visitor on the site host
  waits past 3 s, fills it in, sends; lands on `/<slug>?contact=sent#contact`
  with the thanks line, and the row is in the table under the right site and
  entry; the same with JavaScript disabled; sending an empty form is stopped
  by the browser beside the field with nothing sent; a form sent in under 3 s
  shows the `again` line. `design.md` updated (palette nine tiles, the form's
  states); `needs-you.md`'s two screen-reader lines widened. *Done when:*
  `npm run test:e2e -- contact` passes with the output shown; the page's CSP
  header still has `form-action 'self'` (existing assertion, shown).
- [x] **Step 6 - Check the whole** - `npm run verify` and the full
  `npm run test:e2e` locally. *Done when:* both green, output shown.

## Files and areas

- `app/features/blocks/`: `document-nodes.ts`, `document.ts`, `render.tsx`,
  `palette-insert.ts`, `palette.client.tsx`, `settings-panel.client.tsx`,
  `document-editor.client.tsx`, `block-toolbar.client.tsx`, a `contact-form`
  CSS in `content.module.css`, tests beside
- `app/features/public-site/page.tsx`, `home.tsx`, `post.tsx`, `page-body.tsx`
- `app/features/contact/contact-submit.ts`
- `e2e/contact.spec.ts`, `e2e/contact-form.spec.ts` (new),
  `e2e/document-editor.spec.ts`
- `blueprint/context/design.md`, `needs-you.md`

## Data and contracts

No migration, no table change. **Load-bearing for 19c:** the node's name
`contactForm` and its two attrs; the form field names stay 19a's (`name`,
`email`, `message`, `entry`, `started`, `url`); the anchor `#contact`.

## Testing

- Unit (`npm test`, in `verify`, no database): schema, render, palette insert.
- Browser (`npm run test:e2e`, needs the development database; CI's `e2e` job
  has it): the editor and the journey. None uploads to R2, so CI runs it all.
  One test waits 3 s for the minimum fill time.

## Decisions

- **One contact form per document, fixed anchor `#contact`.** Beats: several
  forms, which need unique ids, tokens and answers per form. Costs: a page
  cannot hold two.
- **Browser constraint validation is the "error beside the field".** Beats: a
  JavaScript form layer, or a second server answer with field errors, both
  more than 19a's one-code contract. Costs: the server's `invalid` (rare once
  the browser has checked) shows only a line and loses what was typed.
- **Fixed English labels.** Beats: a translation table before the site
  language reaches blocks. Costs: a non-English site shows English labels;
  recorded for when language reaches the renderer.
- **Token issued per page view, only for pages with the block.** Beats:
  issuing on every page. Costs: none shared-cached today (no cache headers on
  public pages); a cached page would get `again` after 24 h - the visitor
  retries.
- **Preview renders the form inert.** The platform host has no `/_contact`
  (404), so a live form there would only fail.

## Production needs

None. No migration, no variable. Ships with the v1 deploy.

## Behaviour changes

- Adds to `forms`: a page or post holding a contact form shows a form with labelled Name, Email and Message fields and a send button, which posts to `/_contact` - Step 2
- Adds to `forms`: after a send the visitor returns to the form with the block's thanks line (`sent`) or the fixed line for `invalid`, `again` or `busy`; an unknown answer shows nothing - Step 3
- Adds to `forms`: a contact form works with JavaScript off - Step 5
- Adds to `forms`: the admin's preview shows the form inert - Step 2
- Adds to `forms`: a page or post without a contact form is served without an entry id or token - Step 3
- Adds to `forms`: a document can hold one contact form at most - Step 1
- Adds to `editor`: the palette's Contact form tile adds the block like any other (click, Enter, drag), with button text and thanks message in the settings panel - Step 4

## Notes

- Coding standards: semantic HTML - `form`, `label` for every field, `button`
  type submit, no ARIA repeating native meaning; `role="status"` is a live
  region, where none exists natively. `#app/...` imports with extensions.
- The honeypot is out of the tab order and hidden from screen readers (19a's
  Decision); both are asserted in Step 2.
- The renderer is shared with the browser bundle and must not import Zod or
  `.server.ts` code: the token is issued in the loaders and passed in.
- Quality bar - personal data: the form adds no logging; the page HTML carries
  an HMAC token and an entry id, no visitor data.
- `AGENTS.md` and the stack need no change.
