# Project Overview

> **Generated file.** Written by the `context` skill from
> `blueprint/project-plan.md` and `blueprint/build-plan.md`. Edit those and
> regenerate - never edit this file by hand. It orients; the files it names are
> the record. Decision numbers are entries in `dev-notes/decisions.md` -
> read the entry before changing anything it covers.

Generated 2026-10-07, `main` after `fc9cd68`.

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

**Built for v1, not yet deployed** (deploy steps in
`blueprint/production-pending.md`): React Router 8.4.0 (13); the new look
(13b, `design.md`, D181-D190) - stone and rust admin in light and dark, Inter
self-hosted, public sites neutral and light only (D168); the new editor
(14a1-14c2) - TipTap on one v4 document per entry, sections of 1-3 columns,
blocks, palette, drag and drop, templates; Editor.js and old content removed
(`0009`); sites and memberships (15a) - `site_id` and
row-level security, owner and app database roles, today's install as site 1
(`0010`-`0011`); signup (15b) - invite codes, an emailed confirm link, the site's
address; `0012` deletes every
account (D261); password reset by email (15c); a storage cap per site
(15d, `STORAGE_LIMIT_MB`, D284-D289); Your account (15e1) - name, password,
and an email confirmed from a link to the new address (D290-D296);
delete your account (15e2, `0014`, D297-D308); sites by host (16a, `0015`,
D309-D318) - `PLATFORM_URL` and `SITES_URL`, the site by its subdomain or a
verified `site_domains` row, the admin on the platform host; suspend and
the server (16b, D319-D326) - `suspend-site`, the Caddy file for both domains;
SEO basics (17, `0016`, D327-D337).

**Platform v1 (queued):** optimised images (17b);
your brand and an AI draft from a description (18a-18b); contact form; Simple
and Pro; Stripe billing for Launch. Limits apply from the first signup;
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
- **v1 adds, pinned when installed:** `@anthropic-ai/sdk`
  and `openai` (D155), `sharp` (D174), `stripe` (D160).
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
  pick the size they show.
- **Data rules:** version check on save; R2 objects before the media row;
  admins deactivate members, never delete them - only deleting your own
  account does (15e2); no state on disk (D9); a limit refuses
  the action, never the published site (D150); AI use is a monthly credit
  allowance (D164); **AI output is untrusted, writes drafts only**.

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

- **AI:** Anthropic, then OpenAI, then OpenRouter, only when one is
  unavailable - **never on a refusal** (D155).
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

- **Plan:** items 1-17 done; nothing in flight; 17b-21 queued. 18 splits
  when spec'd. Last shipped: 17
  (`blueprint/history/features/17-seo-basics.md`).
- **Next:** `spec` item 17b, optimised images.
- **Live:** items 1-12 (`dev-notes/status.md`). CI: `verify` + `e2e` (D144).
