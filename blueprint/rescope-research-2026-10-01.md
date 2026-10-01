# Platform rescope - handoff (2026-10-01)

## Goal

Turn Habre into an AI-powered website platform for everyone through progressive
disclosure (Level 1 Personal, 2 Professional, 3 Developer), building Level 1
first, on the existing stack. Recorded as **D148**.

## Done (uncommitted, branch `rescope/platform`, off `main` at `c17d91f`)

- `ideate --rescope` approved by the owner and written:
  - `blueprint/project-plan.md` sections 1-4, 7, 9, 10, 11 and open questions
    (sections 5-6 untouched, left for `architect`).
  - `blueprint/build-plan.md`: items 1-12 unchanged; new `## Platform v1` with
    items 13-21 (upgrade, TipTap, signup + sites, subdomains, SEO basics,
    AI site from a description, contact form, simple by default, billing).
  - `blueprint/context/principles.md`: "Simple by default, powerful when
    needed"; "AI suggests, the user applies".
  - `dev-notes/decisions.md`: D148 added; D2, D8, D113 marked superseded.
    D149 (Stripe, plain processor) and D150 (limits from the first signup,
    invite-only beta with billing off, own domains in the paid plan).
  - Rescope review fixes: items 13-21 everywhere, a non-drag alternative in
    item 14, D148's full will-supersede list, six new `needs-you` lines,
    `AGENTS.md` *What this is*.
- Stack check (evidence): `npm outdated` - React Router 8.3.1 -> 8.4.0, Vite
  8.3.1, Biome 2.5.15, Editor.js 2.31.7, node-fetch-server 0.14.2, @types/node
  26.6.3; `npm audit --omit=dev` - 0 vulnerabilities. `npm view`: @tiptap/core,
  @tiptap/react, @tiptap/extension-drag-handle 3.31.4 MIT; @dnd-kit/core 6.3.1 MIT.
- `blueprint/context/project-overview.md` holds only an older CI-line change; it
  is stale against the new plan until `context` runs.

## In progress

Nothing half-written. Committed on `rescope/platform` with the owner's
approval (docs only, not pushed, not merged).

## Next

1. Owner: buy the platform domain (leaning `habre.ai`, name search first -
   `needs-you.md`).
2. Run `architect`: site isolation (D8's question reopened - database per site vs
   shared tables), subdomain serving and TLS (replaces D22), self-host switches
   (billing/AI/email/signup off), AI + email + payment provider dependencies,
   quality bar for public signup, AI caps and abuse. Also, from the rescope
   review (2026-10-01):
   - a platform operator - list, suspend, delete sites and accounts; signup
     abuse limits. No item covers it yet.
   - release model - partly settled by D150 (limits from the first signup,
     storage cap in item 15, invite-only beta with billing off, own domains in
     the paid plan). Still open: deploy 13-21 one by one to the live site, or
     hold (item 14 wipes content). Owner's call; ask.
   - own domains (D150): per-domain certificates; item 16 or 21.
   - AI-built sites start with an empty media library - text-only drafts,
     placeholders, or a stock-photo provider.
   - a separate domain for user sites (cookie isolation from the admin);
     owner is buying a platform domain now.
   - TLS: wildcard (Caddy DNS plugin) vs on-demand (global option in the main
     Caddyfile, which the repo does not own).
   - TipTap JSON validated by Zod and rendered by our own escaping renderer,
     never TipTap's HTML (keeps D28-D30).
   - item 15 will split (tenancy, signup + verification, password reset).
   - AI cost (Relume works this way: assembles designer-built components,
     a cheaper model for Free): AI picks section kinds and fills slots as
     short structured JSON, never layout or HTML; plan pages first, then
     write; regenerate one section, not the site; templates for page names,
     nav and SEO titles; low thinking; structured outputs; cache the fixed
     prompt; per-call max tokens; log usage per site (the cap and the cost
     report). Estimate ~3k in / 5k out per site: ~US$0.03 Haiku 4.5,
     ~US$0.06 Sonnet 5.5 (list prices, 2026-09-25).
3. Then `setup`, `context` (regenerate overview), `spec 13`.

## Gotchas

- Owner decisions still open (plan *Open questions*): platform name and domain
  (item 16), AI/email/payment providers, prices and plan limits (item 21), open
  source licence AGPL vs MIT. Self-hosting is free and open source.
- Existing content is disposable, but a destructive production migration (item
  14) still needs its own explicit yes at the time.
- Rejected, see D148: the pasted brief's stack (Next.js/NestJS/Redis/OpenSearch/
  AWS - a rewrite; OpenSearch alone exceeds the 954 MB server) and building all
  three levels at once.
- Never commit, push or deploy without a separate yes (`AGENTS.md`).

## Kept for Level 2 (from earlier research)

- Media: search by name/alt, "where used" and "unused" via one query over
  `entries.blocks`, replace file keeping the media id, edit alt text.
- Builder: Kind A drag (palette + reorder, vertical stack) only; keep up/down
  buttons for WCAG 2.5.7. No autosave (fights the `version` stale-save rule).
- FAQ section via native `<details>`. Skip pasted SVG and per-text styling.

## Verify with

`git log -1 --stat` (the rescope docs commit); `grep -n '^- \[ \]'
blueprint/build-plan.md` (items 13-21); `grep -n '^## D14[89]\|^## D150'
dev-notes/decisions.md`.
