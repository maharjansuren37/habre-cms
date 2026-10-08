# Fix: v1 journey polish (tidy batch)

**Type:** Fix
**Verified:** 2026-10-08, 8e2c4d7a2e9d, 6 of 6 proven (Step 4 by screenshot; F-356's wrap no longer reproduces at 390px)
**Reviewed:** 2026-10-08, 8e2c4d7a2e9d, current, every lens (via reviewer) - 0 blocking

## Goal

Repair twelve P3 backlog findings raised against items 18b3-18b5 - onboarding,
the wait, Make it yours, Home and the preview - the screens every v1 user walks
through first. A tidy batch offered by `spec` (backlog at 141 unresolved P3s);
the owner chose this group on 2026-10-08.

## In scope

| Finding | What changes |
|---|---|
| F-358 | A second run for a site that already has one gets its own refusal, not "Habre is busy building other sites" |
| F-360 | The wait page's `<title>` follows its state |
| F-391 | Step 3 ends on Finish: Skip for now moves before it, like steps 1-2 and the mock |
| F-386 | The AI's swatch shows "Suggested by AI" visibly once the colour is known |
| F-356 | Wrapped action links on onboarding centre their text |
| F-357 | Onboarding borders use `var(--border-width)` |
| F-377 | Home's Publish website refusal for a non-admin is logged like every other role refusal |
| F-380 | `/admin?published=1` shows the published banner only when something is published |
| F-379 | The preview bar's English text is marked `lang="en"` |
| F-381 | The public/preview menu no longer keys its items by `href` |
| F-390 | `onboarding/body-size.ts` gets its unit test |
| F-361 | No code: already fixed by 18b4a; the resolution is recorded |

## Out of scope

- **F-389 [P2]** - the wait's action and Publish website reading a body of any
  size. Same two files, but a P2 with its own security fix; not in this batch
  unless the owner adds it.
- Every other backlog P3 - later tidy batches.
- Onboarding's `letter-spacing: -0.02em` (F-357 names it): `app/app.css` has no
  tracking token to use, so it stays a literal. Adding a token is a design
  change, not a tidy.

## Build steps

- [x] **Step 1 - A site that already has a run gets its own refusal (F-358)** -
  in `app/features/ai/run-generation.ts`, `StartResult`'s failure reason gains
  `"site_busy"`. `start()` checks `sitesInFlight.has(siteId)` **before** the
  slot count, and returns `site_busy` there and from the `store.hasRunningRun`
  check; `busy` is left meaning only "both process slots are taken".
  `RefusalReason` in `onboarding/start-refusals.ts` gains `site_busy`, worded
  "A draft for your site is already being built. Wait for it to finish, then
  try again." Tests: `run-generation.test.ts`'s "second run for a site" test
  expects `site_busy` (rename it), a new test covers the `hasRunningRun` path,
  a site with a run in flight while both slots are full gets `site_busy`, and
  `start-refusals.test.ts` asserts the new sentence. *Done when:* `npm test`
  passes with those tests, each seen failing before the change; the existing
  "third run is refused as busy" test still expects `busy`.

- [x] **Step 2 - The wait's title follows its state (F-360)** - `meta` in
  `onboarding/start-wait.tsx` reads `loaderData.state`: running "Building your
  site - Habre", succeeded "Your draft is ready - Habre", failed "Couldn't
  build your site - Habre"; with no `loaderData` (an error) it keeps the
  running title. Check `MetaArgs`' field name in the installed React Router 8
  docs (`node_modules/react-router/docs/`), not from memory. *Done when:*
  `e2e/onboarding.spec.ts`'s running (:419), succeeded (:457) and failed
  timeout (:546) tests each assert `toHaveTitle` with their state's title, and
  `npm run test:e2e -- e2e/onboarding.spec.ts` passes.

- [x] **Step 3 - Make it yours ends on Finish, and the AI's swatch says so
  visibly (F-391, F-386)** - in `onboarding/start-brand.tsx`, the Skip for now
  `Link` moves before the Finish `Button`. In `settings/brand-fields.tsx`, the
  `ai` swatch with a known colour shows the hex and, under it, a visible
  "Suggested by AI" (the colour word stays visually hidden); the accessible
  name becomes "<Colour>, <hex>, suggested by AI" or as near as the markup
  gives. Update `design.md`'s First run row (line ~239) to say the label is
  visible. *Done when:* in `e2e/onboarding.spec.ts`, the F-384 wide-screen
  test (:1030) also asserts Skip for now sits left of Finish; the test at
  :949 asserts the visible text "Suggested by AI" next to the radio (its name
  regex made case-insensitive if needed); the 390px test (:1115) still
  passes; the whole onboarding spec passes.

- [x] **Step 4 - Onboarding's action links (F-356, F-357)** - in
  `onboarding/onboarding.module.css`, `.primaryLink`, `.secondaryLink` and
  `.back` get `justify-content: center; text-align: center`; the
  `inset 0 0 0 1px` (:152) and `1px solid` (:375) use `var(--border-width)`.
  The visually-hidden `1px` sizes (:140-141) stay. *Done when:* `grep -n
  "1px solid\|0 0 0 1px" app/features/onboarding/onboarding.module.css`
  prints nothing; `verify` screenshots the failed state at 390px in light and
  dark and "Change the description" reads centred on its own line; `npm run
  lint` passes.

- [x] **Step 5 - Home and the preview (F-377, F-380, F-379, F-381)** - in
  `admin-shell/home.tsx`: the action calls `logSecurityEvent({ event:
  "request_refused", reason: "role", path, role, ip })` before its 404, the
  same fields `requireRole` logs; the loader's `justPublished` becomes
  `flag && published`. In `preview/preview-layout.tsx`, the `aside` gets
  `lang="en"`. In `public-site/layout.tsx:100`, the menu `li` is keyed by
  index with the project's `biome-ignore lint/suspicious/noArrayIndexKey`
  comment (the list is rebuilt per render, never reordered in place).
  *Done when:* a new `e2e/home.spec.ts` test opens `/admin?published=1` as an
  admin with nothing published and sees no "Your website is published."
  banner; `e2e/preview.spec.ts` asserts the bar has `lang="en"`; the existing
  editor-POST test (`home.spec.ts:343`) still gets 404, and `verify` shows
  the `request_refused` line with `reason: "role"` in the server's output
  for that POST; the touched e2e specs pass.

- [x] **Step 6 - body-size's test, and F-361's record (F-390, F-361)** - add
  `onboarding/body-size.test.ts` in the shape of
  `content/entry-body-size.test.ts`: 1 byte and exactly 32 KB are allowed; 32
  KB + 1, "0", "abc", "-5" and a missing header are refused. Export
  `MAX_ABOUT_BODY_BYTES` for the test. Record F-361's resolution: the review
  keys pages by `page.key` (`start-wait.tsx:154`), which `proposal.ts:106-115`
  refuses to repeat, and the menu by index - fixed by 18b4a. *Done when:*
  `npm test` runs the new file and passes (one assertion seen failing by
  breaking the limit by a byte); F-361's entry has its Resolution.

## Files and areas

- `app/features/ai/run-generation.ts`, `run-generation.test.ts` - Step 1
- `app/features/onboarding/start-refusals.ts`, `start-refusals.test.ts` - Step 1
- `app/features/onboarding/start-wait.tsx` - Step 2
- `app/features/onboarding/start-brand.tsx`, `app/features/settings/brand-fields.tsx`
  (and its CSS module if the label needs a rule) - Step 3
- `app/features/onboarding/onboarding.module.css` - Step 4
- `app/features/admin-shell/home.tsx`, `app/features/preview/preview-layout.tsx`,
  `app/features/public-site/layout.tsx` - Step 5
- `app/features/onboarding/body-size.ts`, new `body-size.test.ts` - Step 6
- `e2e/onboarding.spec.ts`, `e2e/home.spec.ts`, `e2e/preview.spec.ts`
- `blueprint/context/design.md` (First run row), `blueprint/findings/F-*.md`,
  `blueprint/findings/backlog.md` (statuses)

## Data and contracts

None stored. One internal type widens: `StartResult`'s and `RefusalReason`'s
failure reasons gain `"site_busy"`. Both callers (`start-about`, the wait's
retry) go through `refusalMessage`, whose `switch` the compiler checks for
exhaustiveness.

## Testing

- Unit (`npm test`, inside `npm run verify`, runs in CI's `verify` job):
  Steps 1 and 6.
- Browser (`npm run test:e2e`, local and CI's `e2e` job; none of these touch
  R2, so CI runs them): Steps 2, 3, 5. Onboarding tests use the test-only
  `fake` provider.
- `verify`: Step 4's screenshots, Step 5's log line.

## Decisions

- **A site's own run in flight is refused as `site_busy`, with its own
  sentence** - beat sending the person to the running run's page, which needs
  the run's id, and the in-memory `sitesInFlight` check has none.
- **The AI's colour is labelled visibly** - beat recording the screen-reader-only
  label as intended in `design.md`: the swatch saves `''`, not the hex, and
  only the label tells the person it will follow the AI.

## Production needs

None.

## Behaviour changes

- Changes `ai.6` from "a site runs one generation at a time; a second while its first is running is refused as busy" to "a site runs one generation at a time; a second while its first is running is refused as already running for that site, not as busy" - Step 1
- Adds to `onboarding`: a run refused because the site already has one says "A draft for your site is already being built. Wait for it to finish, then try again." - Step 1
- Adds to `onboarding`: the run's page title names its state - "Building your site", "Your draft is ready" or "Couldn't build your site" - Step 2
- Adds to `onboarding`: Make it yours' actions end on Finish, with Skip for now before it - Step 3
- Changes `onboarding.21` from "Make it yours offers Let the AI choose, checked when the site has no colour, named with the AI's colour once the run has suggested one" to "Make it yours offers Let the AI choose, checked when the site has no colour, showing the AI's colour and a visible Suggested by AI once the run has suggested one" - Step 3
- Adds to `home`: `/admin?published=1` shows "Your website is published." only when something is published - Step 5
- Adds to `home`: a non-admin's Publish website POST is Not Found and logged as `request_refused` with reason `role` - Step 5
- Adds to `preview`: the preview bar is marked as English whatever the site's language - Step 5

## Notes

- Mark each finding `fixed` in `blueprint/findings/backlog.md` with evidence in
  its entry's Resolution as its step lands; `review` closes them.
- Step 1 touches the shared runner: the slot accounting must not change - only
  which reason a refusal carries. The order swap (site check first) means a
  site with a run in flight hears `site_busy` even when the slots are also full,
  which is the more useful answer.
- Step 3's swatch change reaches Make it yours only: `BrandFields` shows the
  `ai` swatch only when given `aiColour`, which only `start-brand.tsx` passes.
  Settings is unchanged.
- Keep wording in the project's voice: plain sentences, no "please", no
  exclamation marks (`design.md`).
- `blueprint/context/project-overview.md` still says 18b5 is next; it was not
  regenerated after 18b5 shipped. Not this fix's job - run `context`.

## Findings

### v1-journey-polish/F-356 [P3] closed - On the failed state at 390px, "Change the description" wraps with its text off-centre
File: app/features/onboarding/onboarding.module.css (`.actions`, `.primaryLink`, `.secondaryLink`)

**Found:** 2026-10-07 by review (scope: current; lens: all; via reviewer)
**Why it matters:** Seen in verify's 390px screenshots (light and dark). Not a WCAG failure (no horizontal scroll, >=44px); a visual defect.
**Suggested fix:** `flex-wrap: wrap` on `.actions`; `justify-content: center; text-align: center` on the links (and `.back`).
**Resolution:** Fixed on fix/v1-journey-polish (Step 4): `.primaryLink, .secondaryLink` and `.back` get `justify-content: center; text-align: center`. Screenshots of the failed state at 390px, light and dark, show "Change the description" centred; the wrap itself no longer reproduces at 390px (before and after screenshots identical), so no red run was seen. Left fixed for review. Review 2026-10-08 (current, every lens, via reviewer): the centring rule is correct for wrapped text in an inline-flex link; closed.

### v1-journey-polish/F-357 [P3] closed - Onboarding CSS uses literals where tokens exist
File: app/features/onboarding/onboarding.module.css

**Found:** 2026-10-07 by review (scope: current; lens: all; via reviewer)
**Why it matters:** `1px solid` borders and `inset 0 0 0 1px` instead of `var(--border-width)`; also letter-spacing and size literals. Drift from design.md's tokens survives a re-theme.
**Suggested fix:** Use `--border-width` for borders; keep layout rems only where they match the prototype.
**Resolution:** Fixed on fix/v1-journey-polish (Step 4): the selected card's `inset 0 0 0 1px` and the action links' `1px solid` use `var(--border-width)`; `grep -n "1px solid\|0 0 0 1px" app/features/onboarding/onboarding.module.css` prints nothing. The `letter-spacing` literal stays (out of scope: no tracking token). Left fixed for review. Review 2026-10-08 (current, every lens, via reviewer): both literals use `var(--border-width)` (`app.css:190`); closed.

### v1-journey-polish/F-358 [P3] closed - A site-level busy refusal says "Habre is busy building other sites"
File: app/features/onboarding/start-run.ts:44; app/features/ai/run-generation.ts:220,236

**Found:** 2026-10-07 by review (scope: current; lens: all; via reviewer)
**Why it matters:** The runner returns `busy` both for the two-slot process limit and for "this site already has a run" (two tabs, Try again during a newer run); the banner then blames other sites.
**Suggested fix:** Send a site-level busy to the running run's page, or give it its own wording.
**Resolution:** Fixed on fix/v1-journey-polish (Step 1): the runner returns `site_busy` for a site with a run in flight (checked before the slot count) and from `hasRunningRun`; `refusalMessage` words it "A draft for your site is already being built. Wait for it to finish, then try again." Tests in `run-generation.test.ts` (second run for a site, stale running row, slots full) and `start-refusals.test.ts` failed before the change (`busy` where `site_busy` expected; `undefined` sentence) and pass after (`node --test` 28/28; `npm test` 949/949). Closed by build.

### v1-journey-polish/F-360 [P3] closed - The wait page's title is always "Building your site"
File: app/features/onboarding/start-wait.tsx:15-17

**Found:** 2026-10-07 by review (scope: current; lens: all; via reviewer)
**Why it matters:** Failed and succeeded states keep the running title (WCAG 2.2 AA 2.4.2 Page Titled).
**Suggested fix:** Build `meta` from the loader's state.
**Resolution:** Fixed on fix/v1-journey-polish (Step 2): `meta` in `start-wait.tsx` reads `loaderData.state` - "Building your site", "Your draft is ready" or "Couldn't build your site", " - Habre". `e2e/onboarding.spec.ts` asserts `toHaveTitle` in the running, succeeded and failed-timeout tests; succeeded and failed failed before the change (received "Building your site - Habre"), and `npm run test:e2e -- e2e/onboarding.spec.ts` passed after (59 passed). Closed by build.

### v1-journey-polish/F-361 [P3] closed - AI-written page titles are used as React keys
File: app/features/onboarding/start-wait.tsx:83

**Found:** 2026-10-07 by review (scope: current; lens: all; via reviewer)
**Why it matters:** Duplicate titles in untrusted output collide as keys.
**Suggested fix:** Key by index or by the page's own key.
**Resolution:** No code change: already fixed by item 18b4a. The review keys each page by `page.key` (`start-wait.tsx:160`), which the proposal schema refuses to repeat (`proposal.ts` `superRefine`, "Repeated page key."), and the menu by index (`start-wait.tsx:168`, `:186`). Recorded on fix/v1-journey-polish (Step 6). Left fixed for review. Review 2026-10-08 (current, every lens, via reviewer): pages keyed by `page.key`, repeats refused by `proposal.ts`, sections and menu by index; no other keys on AI text; closed.

### v1-journey-polish/F-379 [P3] closed - The preview bar's English text carries the site's language
File: app/features/preview/preview-layout.tsx:68

**Found:** 2026-10-08 by review (scope: current 7fd0e55..774cc02; lens: all; via reviewer)
**Why it matters:** <html lang> is the site's language, so a screen reader reads 'Preview - nobody else can see this...' and 'Back to Home' with, e.g., German pronunciation. WCAG 2.2 SC 3.1.2 Language of Parts (AA).
**Suggested fix:** lang="en" on the aside.
**Resolution:** Fixed on fix/v1-journey-polish (Step 5): the preview bar `aside` has `lang="en"`. `e2e/preview.spec.ts` asserts it; failed before (received null), passed after (39 passed). Closed by build.

### v1-journey-polish/F-380 [P3] closed - /admin?published=1 shows "Your website is published." whatever the state
File: app/features/admin-shell/home.tsx:83, :140

**Found:** 2026-10-08 by review (scope: current 7fd0e55..774cc02; lens: all; via reviewer)
**Why it matters:** A reload, bookmark or typed URL shows the success banner even when nothing is published. Nothing is echoed, so cosmetic only.
**Suggested fix:** justPublished: flag && published in the loader.
**Resolution:** Fixed on fix/v1-journey-polish (Step 5): `justPublished` in `home.tsx` is `flag && published` (from `hasPublishedEntries`). New `e2e/home.spec.ts` test "/admin?published=1 shows no published banner when nothing is published" failed before the change (banner count 1) and passed after (`npm run test:e2e -- e2e/home.spec.ts e2e/preview.spec.ts e2e/site-navigation.spec.ts`, 39 passed). Closed by build.

### v1-journey-polish/F-381 [P3] closed - Duplicate React keys in the preview's menu
File: app/features/public-site/layout.tsx:100

**Found:** 2026-10-08 by review (scope: current 7fd0e55..774cc02; lens: all; via reviewer)
**Why it matters:** In the preview a URL item / and the home page's item both become /admin/preview, so key={link.href} repeats; on the live site they differ.
**Suggested fix:** Key by index, or label + href.
**Resolution:** Fixed on fix/v1-journey-polish (Step 5): the public/preview menu `li` in `public-site/layout.tsx` is keyed by index with a `noArrayIndexKey` ignore. `e2e/site-navigation.spec.ts` passes; no test can observe duplicate-key behaviour. Left fixed for review. Review 2026-10-08 (current, every lens, via reviewer): duplicate keys gone; `navLinks` is rebuilt per render and each `li` holds only a plain `<a>`, so the index-key reason holds; closed.

### v1-journey-polish/F-386 [P3] closed - Once the AI's colour is known, the swatch shows only the hex - "suggested by AI" is screen-reader only
File: app/features/settings/brand-fields.tsx:183-189

**Found:** 2026-10-08 by review (scope: current; lens: all)
**Why it matters:** This swatch saves `''` (defer to the AI), not the hex, but nothing visible distinguishes it from a saved or Other colour. Matches the logo-swatch pattern and passes WCAG 2.5.3.
**Suggested fix:** Show "Suggested by AI" visibly under the hex, or record in `design.md` that it is intended.
**Resolution:** Fixed on fix/v1-journey-polish (Step 3): the `ai` swatch in `brand-fields.tsx` shows its hex with a visible "Suggested by AI" under it; the colour word stays visually hidden; design.md First run row updated. `e2e/onboarding.spec.ts` asserts the visible text; it failed before the change (element not found) and passed after (73 passed with brand.spec.ts). Closed by build.

### v1-journey-polish/F-390 [P3] closed - `body-size.ts` has no unit test, unlike every sibling body-size helper
File: app/features/onboarding/body-size.ts:8

**Found:** 2026-10-08 by review (scope: current, second pass; lens: all)
**Why it matters:** Siblings (`settings-input`, `entry-body-size`, `login-input`, ...) test the limit, a missing header and a non-number; the e2e test covers only the oversize case.
**Suggested fix:** Add `body-size.test.ts`: at the limit, one over, missing, "abc".
**Resolution:** Fixed on fix/v1-journey-polish (Step 6): new `onboarding/body-size.test.ts` (1 byte and exactly 32 KB allowed; 32 KB + 1, "0", "abc", "-5" and a missing header refused); `MAX_ABOUT_BODY_BYTES` exported. With `<=` mutated to `<` the 32 KB assertion failed (actual false, expected true); restored, `npm test` 951/951. Closed by build.

### v1-journey-polish/F-391 [P3] closed - Step 3 puts Finish before Skip for now, where steps 1-2 and the mock end on the primary
File: app/features/onboarding/start-brand.tsx:101-108

**Found:** 2026-10-08 by review (scope: current, second pass; lens: all)
**Why it matters:** Step 2 is Back then Build my site; the mock is Skip then Finish. Not listed in `design.md`'s differences from the mock.
**Suggested fix:** Put the `Link` before the `Button`, or record the difference in `design.md`.
**Resolution:** Fixed on fix/v1-journey-polish (Step 3): Skip for now moved before Finish in `start-brand.tsx`. The F-384 wide-screen test in `e2e/onboarding.spec.ts` asserts `skip.x < finish.x`; it failed before the change (received 420.8, expected < 296.8) and passed after (`npm run test:e2e -- e2e/onboarding.spec.ts e2e/brand.spec.ts`, 73 passed). Closed by build.
