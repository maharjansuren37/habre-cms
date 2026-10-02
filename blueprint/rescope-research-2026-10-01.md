# Platform rescope - handoff (2026-10-01)

## Goal

Turn Habre into an AI-powered website platform (D148), Level 1 first (items
13-21), on the existing stack - and settle the platform's UI/UX before building.

## Done (branch `rescope/platform`, not pushed, not merged)

- `b7ecbf8` rescope docs (D148-D150); `e71ad2c` workflow pack upgrade - evidence
  then: `npm run verify` exit 0, 296/296 unit tests.
- `4b86667` `architect` for v1, docs only (no code changed since `e71ad2c`):
  - plan section 6 rewritten; section 8 deploy notes;
  - `quality-bar.md`, `needs-you.md` and stale plan lines updated;
  - decisions D151-D164 added;
  - overview regenerated, 6,577 bytes.
- Key decisions:
  - **Tenancy:** shared tables + `site_id` + row-level security, two DB roles
    (D151/152); users global, roles on `site_members` (D159); today's install
    becomes site 1 (D162).
  - **Hosts:** `app.<platform>`, sites on a separate domain, wildcard
    certificate (D153).
  - **AI:** an in-process run, two at a time (D154); Anthropic -> OpenAI ->
    OpenRouter, never on a refusal (D155); a monthly credit allowance,
    1 credit = US$0.001 (D164).
  - **Email:** Resend over SMTP; its free tier caps at 100 a day (D156).
  - **Stripe:** official SDK and hosted pages (D160).
  - **Signup:** the email link verifies and signs in (D161).
  - **Production holds on `8d82ce4` until v1 is done** (D163).

## In progress

Nothing half-written.

## Next

1. **Run `prototype` as a deliberate extension.**
   - **Keep Habre's tokens** (`app/app.css`, `--color-accent`); use
     `blueprint/design-kit/` only for components and `ux-checklist.md`.
   - **Mock, phone-first:**
     - signup, verify and choose an address;
     - onboarding: two questions, then progress for up to 2 minutes, then
       review and apply the drafts;
     - the Level 1 admin shell and Home: nav Home, Pages, Blog, Media,
       Settings, plus a slot for Messages and an AI usage meter shown as a
       percentage;
     - the TipTap editor: drag handle plus Move up / down, undo / redo,
       block menu;
     - limit reached: "Paid plans coming soon".
   - **Open design questions:** a per-site accent from a pre-measured palette;
     whether "Blog" renames Posts.
2. `spec 13` (stack upgrade).
3. **Owner, in parallel:** buy the platform domain and a sites domain on
   Cloudflare. Accounts as items need them: Resend (15b), Anthropic, OpenAI
   and OpenRouter (18), Stripe (21). See `needs-you.md`.

## Gotchas

- **`prototype` defaults to watch:**
  - its Step 3 copies the kit's tokens (`--color-primary`), which would drift
    into a redesign - keep Habre's;
  - its Step 6 commits on `main` - commit on this branch instead.
- **No deploys:** production stays on `8d82ce4` (D163). An urgent fix branches
  off `8d82ce4`, never `main`.
- **Big items:** 15 splits into 15a-15d (plan section 6, *Build order*); 14,
  18 and 21 are also large.
- **The README's** first line still says "one website's content" - a job for
  `docs`.
- **Starter bugs, unfixed** in `../ai-project-starter`: its gitignore's `bin/`
  hides `.agents/bin/`, and the kit fails a linter covering `blueprint/`.
- **Never commit, push or deploy without a separate yes** (`AGENTS.md`).

## Kept for Level 2

- Media search, "where used", and replacing a file while keeping its id.
- The builder: drag only for a vertical stack, keep up / down (WCAG 2.5.7), no
  autosave.
- FAQ via `<details>`.

## Verify with

`git log --oneline -4`; `npm run verify`; `grep -n '^- \[ \]' blueprint/build-plan.md`.
