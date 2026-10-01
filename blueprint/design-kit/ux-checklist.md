# UX checklist

What every app or website needs regardless of how it looks. `prototype` walks it
to recommend a direction and to list the screens and journeys this product must
have; `spec` and `verify` use the journeys; `review` checks what shipped against
the parts this project said apply. **Mark each line applies, not applicable
(and why), or deferred (to what)** in `design.md` - a silent skip reads as done.

## 1. What kind of product is it

Decide first; it sets the navigation and the screens below.

| Type | Navigation that fits | Typical first screen |
|---|---|---|
| **Web app** (signed-in tool, dashboard, admin) | Sidebar for 5+ sections, top bar with account menu; tabs within a section | The main list, or a first-run empty state |
| **Content website** (blog, docs, marketing, portfolio) | Top nav with 3-7 items, footer with legal and contact; breadcrumbs for deep pages | Home, then an article or landing page |
| **Store / booking** | Top nav with search and cart or basket; category navigation | Catalogue or search results |
| **Mobile app** | Bottom tab bar with 3-5 destinations; stack navigation inside each | The primary tab |
| **Mixed** (public site + signed-in area) | Both, on separate layouts - never one nav trying to serve both audiences | Public home; the app's main list after sign-in |
| **Tool** (one screen: a calculator, a converter) | None - one destination needs no navigation; the page title orients | The tool itself, in its empty state |

**Navigation rules for every type:** the current location is always shown
(`aria-current`); primary items are nouns the user would say, not internal
names; no more than 7 at one level; the same item never moves between pages;
every page is reachable in a few steps from the home or main screen; on a small
screen the menu collapses behind one clearly labelled control.

## 2. Screens every product needs

**All types**
- [ ] Not found (404) - says what happened and offers a way back
- [ ] Something went wrong (500 or offline) - no stack trace; a retry or a way out
- [ ] Loading, empty and error states for **every** list and every async action
- [ ] A success confirmation for every action that changes data
- [ ] Page titles unique per page (`<title>`, or the screen title on mobile)

**Anything with accounts**
- [ ] Sign in, with an error that does not say which half was wrong
- [ ] Sign out, reachable from every signed-in page
- [ ] Forgot password → email → reset → **signed in, or sent to sign in, and back where they started**
- [ ] Session expired → sign in → **back on the page they were on, not a 404 or a raw data URL**
- [ ] Not allowed (403) - distinct from not found when the user is signed in
- [ ] Account or settings: change password, email, name; delete account where required

**Web app**
- [ ] First run - what an empty workspace looks like and the one action that fills it
- [ ] Search, filter and pagination on any list that can grow past a screen
- [ ] Destructive actions confirm or offer undo, and name the thing being destroyed

**Content website**
- [ ] Footer: privacy, terms, contact; cookie notice only if something sets one that needs consent
- [ ] Social and search metadata (description, Open Graph image) per page
- [ ] Readable measure - body text at 60-75 characters a line (`--size-measure`)

**Mobile app**
- [ ] Safe areas respected; nothing under the notch or the home indicator
- [ ] Offline state for anything that fetches
- [ ] The platform's back behaviour works everywhere

## 3. Journeys to walk end to end

A screen can pass on its own while the path through it fails. **Each journey
below is one done-when: follow it from the first click to the final screen, and
check the final URL and what is shown - not only that each step rendered.**
Walk each one both as a full page load and through the app's own navigation or
form submit, since they take different code paths.

- [ ] Signed out → open a protected page → sign in → land on **that** page
- [ ] Change or reset **your own** password → what happens to your session → where you end up
- [ ] Change another user's role or access → what **they** see on their next request
- [ ] Submit a form with an error → the error shows beside the field **and your input is kept**
- [ ] Delete something → confirmation → where you land, and whether the list still has your filters
- [ ] Deep link shared by someone else → opens correctly when signed out, and after signing in

## 4. Accessibility floor (WCAG 2.2 AA)

- [ ] Text contrast 4.5:1, large text and control boundaries 3:1 - the kit's tokens meet this; **re-measure after changing any colour**
- [ ] Focus visible on every interactive element, in the order the page reads
- [ ] Everything works with a keyboard alone; no keyboard trap; dialogs return focus when closed
- [ ] Every input has a visible label; errors are announced (`aria-invalid`, `aria-describedby`)
- [ ] Targets at least 24×24 px, 44×44 on touch (`--size-target-min`) - the kit's controls grow to it under `pointer: coarse`
- [ ] Colour is never the only signal - links in text are underlined, states have a word or icon
- [ ] Motion respects `prefers-reduced-motion`
- [ ] Images have alt text, or empty alt when decorative
- [ ] A skip link on pages with navigation before the content

## 5. Responsive

- [ ] Checked at 390 px (phone), 768 px (tablet) and 1280 px (desktop) - the kit's breakpoints
- [ ] No horizontal scroll at 320 px except inside a table or code block
- [ ] Tables scroll inside their own container, or become lists on a phone
