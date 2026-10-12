# Project Overview

> **Generated file.** Written by the `context` skill from
> `blueprint/project-plan.md` and `blueprint/build-plan.md`. Edit those and
> regenerate - never edit this file by hand. It orients; the files it names are
> the record. Decision numbers are entries in `dev-notes/decisions.md` -
> read the entry before changing anything it covers.

Generated 2026-10-12, `main` after `59325a4` (19b, the contact form block, shipped).

## What this is

**Habre is becoming an AI-powered platform to create, manage and publish a
website** (D148): describe what you want, get a site, edit it, publish it.
**Simple by default, powerful when needed.** The CMS serves each public site
itself.

- **Levels** are how someone uses Habre, switched per site and never paid for
  (D166, D175): **Simple** (Level 1, individuals and small businesses, the
  default), **Pro** (Level 2's tools), **Developer** (Level 3, later). One
  editor, one stored format; the level only reveals controls. v1 has Simple
  and a first part of Pro.
- **Tiers** are what a site pays for: limits and services, never a level
  (D175). Free $0, Launch $19, Growth $59, Scale $179, Enterprise custom -
  **provisional**, revised by measured use. v1 sells Free and Launch.
- **Free and open source to self-host**; the hosted service is what is sold.
- **Principles** (`blueprint/context/principles.md`): simple by default; **AI
  suggests, the user applies**.

## Scope

**Built (items 1-12, live):** login; posts and pages in an Editor.js block
editor; draft / publish; images and a media library; one theme; title, logo,
navigation, home page (D107); author / editor / admin roles; light and dark
mode; sections, columns and ready-made sections (D114-D143).

**Built for v1, not deployed** (13-18b5; archives in `blueprint/history/`,
deploy steps in `blueprint/production-pending.md`): React Router 8 (13); the
new look (13b); TipTap v4 documents, sections, templates (14a1-14c2, `0009`
deletes old content); sites and row-level security (15a); invite signup (15b,
`0012` deletes every account); password reset (15c); storage cap (15d); Your
account (15e1-15e2); sites by host, suspend, Caddy (16a-16b); SEO (17);
optimised images (17b); brand colour, presets, logo colours (18a1-18a2); the AI
run engine and credits (18b1); direct fallbacks, live runs owed (18b2, D392);
`/start` steps 1-2, the wait, test-only `fake` provider (18b3); the review, Use
this draft, Home with the AI meter (18b4a); Preview and Publish
website (18b4b); Make it yours as step 3 (18b5); receiving a contact message (19a); the contact form block (19b).

**Platform v1 (queued):** Messages and the email (19c); Simple and Pro; Stripe billing for Launch. Limits apply from the first signup;
invite-only beta, billing off (D150).

**Deferred - do not build unasked.** Plan section 11: Level 2 and 3
features, Elementor-style layout, free-form canvas, custom CSS/HTML, more
themes.

## Stack

Pinned versions: plan section 5 and `AGENTS.md`. **Minimal dependencies is a
constraint** - each new runtime dependency is a recorded decision.

- TypeScript 7.0.2 strict, `erasableSyntaxOnly`; Node.js 26 (D15).
- **React Router 8.4.0 framework mode**, React 19.3.0, Vite 8.3.0, on
  `node:http` - **no Express** (D10, D17, D23). The installed docs in
  `node_modules/react-router/docs/` decide.
- PostgreSQL 16, `postgres` driver, **raw SQL, no ORM** (D11).
- Plain CSS, tokens in `app/app.css`, CSS Modules, **no Tailwind** (D12); look
  in `design.md`; public pages in the `data-surface="site"` scope (D183).
- `jose` JWT + scrypt, **no auth library** (D6); Zod at every trust boundary.
- TipTap 3.31.4, pinned exactly (D197); R2 via `aws4fetch`; Biome;
  `node:test`; Playwright.
- `nodemailer` 10.0.14 over SMTP (D156); Mailpit catches email in development
  and CI (D254).
- `sharp` 0.35.5, pinned exactly - the first native dependency (D174).
- `openai` 7.30.0 (OpenRouter and OpenAI direct, D372) and
  `@anthropic-ai/sdk` 0.131.0, both pinned exactly. **v1 adds, pinned when
  installed:** `stripe` (D160).
- **Semantic HTML on every page** - `coding-standards.md`.

## Architecture

Full detail: plan section 6. One application, deployed once (D4). One
in-process background job: the AI run, in `ai_runs`, two at a time (D154).

- **Layout (D16):** routes in `app/routes.ts`, modules in
  `app/features/<feature>/`, shared code in `app/lib/`, `*.server.ts` for
  server-only. Conventions: `coding-standards.md`.
- **Tenancy (D151, D152):** shared tables with `site_id`; **row-level
  security** returns nothing when no site is set; an owner role for
  migrations, an app role under it. Users global, roles on `site_members`,
  one site per user in v1 (D159). Today's install becomes site 1 (D162).
- **Hosts (D153, D173):** the app at `app.<platform domain>`; sites at
  `<name>.<sites domain>` or an own domain; **one main address per site**, the
  others redirect, with a canonical link (17). Production runs D22 until the v1 deploy.
- **Data model:** `sites`, `site_domains`, `users`, `site_members`,
  `email_tokens`, `invites`, `entries`, `media`, `site_settings`,
  `contact_submissions`, `ai_runs`, `stripe_events`, `schema_migrations`.
- **Content (D169, D170):** an entry is **one TipTap JSON document**
  (`blocks_format` v4), sections and columns as nodes; our own Zod schema and escaping
  renderer, **never raw HTML** (D28-D30). Ready-made sections are templates of
  ordinary blocks. One main heading per page; a post's title is its `h1`.
- **Per site (D167, D171, D172):** level, dark mode (Pro only), brand colour,
  style preset, language - in `site_settings`. Brand colour reaches pages as a
  nonce'd inline `<style>`.
- **Images (D174):** resized on the server with `sharp` into WebP sizes; pages
  pick the size they show. A logo's colours are counted at upload (D359).
- **Data rules:** version check on save; R2 objects before the media row;
  admins deactivate members, never delete them - only deleting your own
  account does (15e2); no state on disk (D9); a limit refuses
  the action, never the published site (D150); AI use is a monthly credit
  allowance, failed runs charged their reported cost (D164, D391); **AI
  output is untrusted, writes drafts only**.

### Auth boundary

- Authorization, validation and rendering on the server.
- JWT (7 days), httpOnly, Secure, SameSite=Lax, host-only on the admin host.
- **Every admin request loads the user and membership**; the role comes from
  the database, never the token (D6); `requireRole` refuses with 404 (D69).
- CSRF: origin check. Site hosts accept one POST, `/_contact`.
- The emailed link opens a confirm page; pressing Confirm verifies and signs
  in (D161, D251). Login refuses an unconfirmed account.
- Password reset (D271-D283): the same reply for every address, a one-hour
  single-use link, and completing it bumps `token_version`. Off without email.

### Integrations

- **AI:** `AI_PROVIDERS` order, **OpenRouter first**, any model, credits
  from its reported cost; Anthropic and OpenAI direct as priced fallbacks;
  moves on only when unavailable - **never on a refusal** (D155, D372,
  D393); each non-last attempt gets 150 s (D398). **The app's runner uses
  OpenRouter alone** until the direct providers' live runs are done (D405).
- **Email:** SMTP via Resend (D156). **Payments:** Stripe's hosted pages;
  webhooks set the plan (D149, D160).

## Constraints

- **Server:** `ocwebserver` (2 vCPU, 954 MB RAM), **upgradeable as usage
  grows**; **never build on the server** (D14); no Docker there.
- **Environments (D21):** `development`, `ci`, `production` - no staging;
  `AGENTS.md` *Environments*.
- **Production holds on `8d82ce4` until v1 is done** (D163): one deploy.
- **Self-hostable (D148):** Node.js, PostgreSQL and S3-compatible storage only;
  signup, AI, email and billing each switch off.
- **Standards:** OWASP Top 10:2025, WCAG 2.2 AA, semantic HTML; numbers in
  `blueprint/context/quality-bar.md`.

## Current state

- **Plan:** items 1-18, 19a and 19b done; 19c, 20-21 queued. Last shipped: 19b.
- **In flight:** nothing. **Next:** `spec` item 19c, Messages and the email.
- **Live:** items 1-12 (`dev-notes/status.md`). CI: `verify` + `e2e` (D144).
