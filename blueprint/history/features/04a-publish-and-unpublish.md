# Feature: Publish and unpublish

**From build plan:** item 4a
**Type:** Feature
**Status:** built, verified, F-57 and F-65 repaired and closed; shipped

## Goal

Let an editor or author flip a post between draft and published from the
editor screen, so item 4b has real published rows to render and the "Nothing
is public until you press Publish" promise on the posts list (`post-list.tsx`'s
empty state) becomes true.

## In scope

- A **Publish** button (draft -> published) and an **Unpublish** button
  (published -> draft) on the post editor (`post-form.tsx`), replacing the
  placeholder comment "Publish arrives with item 4."
- The status badge in the editor top bar reflects the post's real status
  (currently hardcoded to `Draft`), colored the same way the list already
  colors it (`post-list.module.css`'s `draft`/`published` classes).
- The transition is saved atomically with whatever is in the editor at the
  moment the button is pressed - the same content-save path as today's Save,
  extended with a status change - not two separate requests.
- `published_at` follows the rule the schema comment already states
  (`db/migrations/0002_entries.sql`): set the first time a post is published,
  left untouched by every later publish or unpublish.
- Ownership and the stale-version check apply exactly as they do to today's
  save: an author can only publish or unpublish their own posts; a save
  against a version someone else already moved on is refused, not overwritten.
- A success banner on the posts list after either action, in the same
  `?deleted=<title>`-style pattern the delete flow already uses.
- Browser-test coverage for both transitions and the ownership boundary.

## Out of scope

- **Rendering published content anywhere public** - item 4b. Nothing in this
  item makes a published post visible outside the admin; `/`  still shows the
  placeholder home page.
- **The hostname split** (`PUBLIC_URL`/`ADMIN_URL`, Caddy, DNS) - item 4c.
- A "View it on the site" link in the success banner - there is nothing to
  link to until 4b ships; see Decisions.
- Publishing or unpublishing from the posts list itself (a row action) -
  design.md places both buttons on the editor screen only.
- Scheduled publishing, revision history - both deliberately deferred
  (`project-plan.md` section 11).
- Pages - this item touches `type = 'post'` rows only, matching every existing
  query in `entries.server.ts`.

## Build steps

- [x] **Step 1 - Extend the save path to carry a status transition** -
  In `entries.server.ts`, rename `updateDraft` to `saveEntry` (closes F-40:
  the function already saves published entries per the data rules, "Saving a
  published entry updates the live page," and the old name claimed otherwise)
  and give it an optional fourth argument, `transition?: "publish" |
  "unpublish"`. When present, the same `update` statement that saves
  title/blocks/version also sets `status = 'published', published_at =
  coalesce(published_at, now())` (publish) or `status = 'draft'` (unpublish) -
  one atomic statement, still scoped by `ownedBy(actor)` and the existing
  `version`/`blocks_format` guards. Update `post-edit.tsx`'s one call site to
  the new name with no transition, so behavior is unchanged.
  *Done when:* `npm run verify` passes with no behavior change - saving a
  draft from `/admin/posts/:id` still works exactly as before.

- [x] **Step 2 - Wire Publish and Unpublish into the editor** -
  `post-form.tsx` takes a `status: "draft" | "published"` prop, shows the
  matching colored badge, and renders a second submit button next to Save:
  `Publish` (variant `primary`) when draft, `Unpublish` (variant `default`)
  when published. Each button is `<button type="submit" name="intent"
  value="publish">` / `"unpublish"`; the existing Save button becomes
  `name="intent" value="save"` and its label reads "Save draft" while draft,
  "Save" while published. `post-edit.tsx`'s action parses `intent` with
  `z.enum(["save", "publish", "unpublish"])` (an unrecognized value is refused
  the same 400 way an invalid form already is), calls `saveEntry` with the
  matching transition, and on a successful publish or unpublish redirects to
  `/admin/posts?published=<title>` or `?unpublished=<title>` instead of
  staying on the page (a plain save keeps today's stay-and-show-state
  behavior).
  *Done when:* opening a saved draft and clicking Publish redirects to the
  posts list with the post now showing the Published badge; opening a
  published post and clicking Unpublish redirects with the post back to
  Draft; publishing, unpublishing, then publishing again leaves the same
  `published_at` as the first publish (checked directly against the
  database).

- [x] **Step 3 - Show the outcome, and prove the boundary** -
  `post-list.tsx`'s loader reads `published`/`unpublished` alongside the
  existing `deleted` param and renders the matching success banner (`"<title>"
  was published.` / `"<title>" was unpublished.`), one banner at a time.
  Extend `e2e/manage-posts.spec.ts` (or a new `e2e/publish.spec.ts`) with:
  publish then unpublish a post and see each banner and badge; an author
  cannot publish or unpublish another author's post (same not-found behavior
  as the existing edit/delete ownership checks); a stale-version publish is
  refused rather than overwriting a concurrent edit.
  *Done when:* `npm run test:e2e` passes, including the three new cases.

## Files and areas

- `app/features/content/entries.server.ts` - `saveEntry` (renamed
  `updateDraft`), the transition fragment
- `app/features/content/post-edit.tsx` - action reads `intent`, redirects on
  publish/unpublish
- `app/features/content/post-form.tsx`, `post-form.module.css` - status prop,
  badge coloring, second button
- `app/features/content/post-list.tsx` - `published`/`unpublished` query
  params, success banners
- `e2e/manage-posts.spec.ts` or `e2e/publish.spec.ts`

## Data and contracts

- No schema change - `status` and `published_at` already exist
  (`0002_entries.sql`) with exactly this policy written into the migration's
  own comment.
- `intent` is a closed, server-validated enum; never trusted as free text.
- Nothing new is load-bearing for a later item beyond what the migration
  already committed to.

## Testing

- No unit test: `entries.server.ts` is DB-backed, per this project's existing
  pattern (its sibling functions have no `.test.ts`, only e2e coverage).
- `npm run test:e2e` extended per Step 3. `npm run verify` for everything else.
- Reminder (not new to this item): F-17 means these browser tests still do not
  run in CI, only locally.

## Decisions

- **Publish/unpublish saves content and changes status in one request, one
  atomic UPDATE** - not a separate save-then-publish pair. Beats two requests,
  which could race against each other or against a concurrent edit in a way
  the existing single-version check would not catch.
- **Once published, neither Save nor Unpublish is styled `primary`** -
  design.md's rule is "at most one primary per view," not "always exactly
  one." Beats forcing one of them to look like the important action, when
  neither is.
- **The success banner does not link to the public post yet** - the public
  route does not exist until item 4b. Beats linking to a URL that 404s today;
  4b adds "View it on the site" once the target is real.
- **`published_at` is never cleared or reset by unpublish** - already decided
  at the schema level (`0002_entries.sql`'s comment); this item is the first
  code to honor it, not the thing deciding it.
- **Publish/Unpublish only appear once a post has been saved once** (`slug !==
  ""`) - not in the original spec. `post-new.tsx`'s action always creates as a
  draft with no way to carry a transition through `createDraft`, so a Publish
  button on a brand-new, never-saved post would have looked live but silently
  done nothing. Beats teaching `createDraft` a transition too, for a first-save
  publish nobody asked for.

## Notes

- Reuse `ownedBy(actor)` and the existing `blocks_format`/`version` guards
  exactly as `saveEntry` already applies them - no new authorization logic.
- This is an admin save; it inherits the existing < 1 s p95 bar
  (`quality-bar.md`) rather than needing a new measurement - one `update`
  statement with two more assigned columns is not a new hot path.
- No security-log entry: publish/unpublish is a content-status change, not an
  access or permission event (compare `fundamentals.md`'s "log the
  security-relevant events").
- A post can already be saved as a draft with zero blocks; this item adds no
  new minimum-content rule for publishing, so an empty post can be published.
  Worth a look before `ship`, but not something this item should invent
  unasked.

## Findings

Two findings this item's own review raised were repaired and closed within it:

### 04a/F-57 [P3] closed - The list's success-banner text is attacker-controlled and unbounded

**File:** app/features/content/post-list.tsx (`readBanner`)
**Found:** 2026-09-21 by review (independent `reviewer` agent; scope: current; lens: security)
**Why it matters:** `deletedTitle` is read straight from `?deleted=` with no length bound and no proof a delete actually happened. Script injection is closed - `Message` renders it as a plain text child, confirmed against the running build with `?deleted=<script>alert(1)</script>` (the DOM shows the escaped text, `grep -c '<script>alert(1)</script>'` over the full response including the hydration payload is 0) - but a crafted link (`/admin/posts?deleted=Your%20site%20was%20suspended.%20Call%20…`) renders a genuine green success banner with a check icon, saying whatever the sender chose, to a logged-in admin on a real admin page. A 5,000-character value also rendered fine (20 KB response), so there is no cap either. Reach is low - needs an authenticated victim to click a link - hence P3, not higher. OWASP Top 10:2025 A06 Insecure Design.
**Suggested fix:** Cap the param (`.slice(0, 200)`, matching the title's own cap) at minimum. More robust: carry the message through a single-use flash cookie instead of a URL param, so it cannot be supplied by a link at all.

**Note added 2026-09-21 by review (item 4a, scope: current; lens: security):** item 4a generalized the read into `readBanner`, which now accepts `?published=` and `?unpublished=` the same unbounded way, on the same route - the finding's shape is unchanged but its surface is now three params, not one. The suggested fix (cap the param, or a flash cookie) should cover all three when this is picked up; still `open`, still P3, reach unchanged.

**Resolution:** Repaired 2026-09-21 by build (item 4a). Took the minimum suggested fix, applied to all three params at once (extracted alongside F-65, below, since both touch the same code): `readBanner` (now in the new `app/features/content/banner.ts`) truncates the title to 200 characters - the entry title's own cap - before it ever reaches `Message`. The flash-cookie alternative was not built; capping closes the "unbounded" half of the finding, not the "no proof this happened" half, which stays a known, accepted low-reach property of URL-param banners. Evidence: `banner.test.ts` asserts a 5,000-character `?published=` value comes back at exactly 200 characters, **shown to fail** (5000 !== 200) with the `.slice()` removed, then restored. `npm run verify` -> 152/152 unit tests, clean build; `npm run test:e2e` -> 44/44. Status `fixed`.

**Closed 2026-09-21 by review (item 4a, scope: current; lens: security).** Re-read `banner.ts` and its test in full: the cap is unconditional (applies before the `Banner` is ever handed to `post-list.tsx`), covers all three verbs from one code path rather than three, and the truncation test was independently confirmed to fail without the `.slice()`. No new issue introduced by the extraction. The "no proof this happened" half remains a known, accepted property of URL-param banners - not reopened, since the finding was never about that half.

### 04a/F-65 [P3] closed - The banner-redirect one-liner is now duplicated a third time

**File:** app/features/content/post-delete.tsx:43, app/features/content/post-edit.tsx:81,84
**Found:** 2026-09-21 by review (scope: current; lens: quality)
**Why it matters:** `redirect(\`/admin/posts?<verb>=${encodeURIComponent(<title>)}\`)` now appears three times across two files - once in `post-delete.tsx` (item 3) and twice in `post-edit.tsx` (item 4a, publish and unpublish). All three exist for the same reason and would need to change together: `F-57` already proposes moving this whole mechanism to a flash cookie, and today that means finding and editing three call sites by hand rather than one. `fundamentals.md`: "copy the second time, extract on the third" - this is the third.
**Suggested fix:** A small helper, e.g. `bannerRedirect(verb: "deleted" | "published" | "unpublished", title: string)` in `entries.server.ts` or a shared module, returning the `redirect(...)`. Worth doing together with F-57's fix rather than separately, since both touch the same three call sites.

**Resolution:** Repaired 2026-09-21 by build (item 4a), together with F-57 as suggested. New module `app/features/content/banner.ts` holds both halves of the mechanism: `bannerRedirect(verb, title)` (this finding) and `readBanner(params)` with its cap (F-57) - one file, one `BannerVerb` type, since the two were always going to change together. `post-delete.tsx` and `post-edit.tsx` now call `bannerRedirect` instead of building the string inline; `post-list.tsx` imports `readBanner` instead of defining its own copy. Evidence: `grep -rn "admin/posts?.*encodeURIComponent"` over `app/features/content/*.tsx` now returns nothing - the pattern exists in exactly one place, `banner.ts`. `banner.test.ts` covers `bannerRedirect`'s exact output round-tripping through `readBanner`. `npm run verify` -> 152/152; `npm run test:e2e` -> 44/44 (delete, publish and unpublish all still redirect and show their banners correctly). Status `fixed`.

**Closed 2026-09-21 by review (item 4a, scope: current; lens: quality).** Re-ran the grep myself and re-read all three call sites (`post-delete.tsx:43`, `post-edit.tsx`'s two `bannerRedirect` calls, `post-list.tsx`'s `readBanner` import) - one definition, three consistent uses, no drift between them. Nothing new introduced by the extraction.

F-40 was repaired here too (the `saveEntry` rename, Step 1) and marked
`fixed` in the ledger; only a later `review` pass moves it to `closed`,
so it stays in the live ledger rather than being archived.
