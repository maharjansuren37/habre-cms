# Project Overview

> **Generated file.** Written by the `context` skill from
> `blueprint/project-plan.md` and `blueprint/build-plan.md`. Edit those and
> regenerate - never edit this file by hand. It orients; the files it names are
> the record. Decision numbers are entries in `dev-notes/decisions.md` -
> read the entry before changing anything it covers.

Generated 2026-10-01, `rescope/platform` after `e71ad2c`.

## What this is

**Habre is becoming an AI-powered platform to create, manage and publish a
website** (D148): describe what you want, get a site, edit it, publish it.
**Simple by default, powerful when needed.** The CMS serves each public site
itself.

- **Level 1 - Personal** (individuals, small businesses, no technical
  knowledge): **platform v1 serves only this level.** Level 2 (teams) and Level
  3 (developers: API, content models) come later.
- Items 1-12 built a single-site CMS; it is live and is the base of Level 1.
- Sold as a hosted service; **free and open source to self-host**.
- **Principles** (`blueprint/context/principles.md`): simple by default; **AI
  suggests, the user applies**.

## Scope

**Built (items 1-12, live):** login; posts and pages in an Editor.js block
editor; draft / publish; images and a media library; one theme; title, logo,
navigation, home page (D107); author / editor / admin roles; light and dark
mode; sections, columns and ready-made sections (D114-D143).

**Platform v1 (items 13-21, queued):** stack upgrade; TipTap 3 replaces
Editor.js (content discarded); signup with email verification, one isolated
site per signup; sites on their own subdomain; SEO basics; AI drafts a site
from a description; contact form; Level 1-only admin; Stripe billing for one
paid plan. Storage and AI limits apply from the first signup; invite-only beta,
billing off (D150, D164).

**Deferred - do not build unasked.** Plan section 11: Level 2 and 3 features,
free-form canvas, custom CSS/HTML, multiple themes.

## Stack

Pinned versions: plan section 5 and `AGENTS.md`. **Minimal dependencies is a
constraint** - each new runtime dependency is a recorded decision.

- TypeScript 7.0.2 strict, `erasableSyntaxOnly`; Node.js 26 (D15).
- **React Router 8.3.1 framework mode**, React 19.3.0, Vite 8.3.0, on
  `node:http` - **no Express** (D10, D17, D23). The installed docs in
  `node_modules/react-router/docs/` decide.
- PostgreSQL 16, `postgres` driver, **raw SQL, no ORM** (D11).
- Plain CSS, tokens, CSS Modules, **no Tailwind** (D12); look in `design.md`.
- `jose` JWT + scrypt, **no auth library** (D6); Zod at every trust boundary.
- Editor.js today (D13); R2 via `aws4fetch`; Biome; `node:test`; Playwright.
- **v1 adds, pinned when installed:** TipTap 3 (item 14), `@anthropic-ai/sdk`
  and `openai` (D155), `nodemailer` (D156), `stripe` (D160).

## Architecture

Full detail: plan section 6 (re-decided for v1: D151-D164). Items 1-12 are
built as one site; items 13-21 build the rest.

- **One application, deployed once** (D4). One in-process background job: the
  AI run, recorded in `ai_runs`, two at a time (D154). No queue, cache or cron.
- **Layout (D16):** routes in `app/routes.ts`, modules in
  `app/features/<feature>/`, shared code in `app/lib/`, `*.server.ts` for
  server-only. v1 adds `sites`, `signup`, `onboarding`, `ai`, `email`, `forms`,
  `seo`, `billing`. Conventions: `coding-standards.md`.
- **Tenancy (D151, D152):** shared tables with `site_id`; **PostgreSQL
  row-level security** as a second guard that returns nothing when no site is
  set; an owner role for migrations, an app role under row-level security.
  Users are global, roles live on `site_members`, one site per user in v1
  (D159). Today's install becomes site 1 (D162).
- **Hosts (D153, replacing D22 at item 16):** the app at `app.<platform
  domain>`; sites at `<name>.<sites domain>`, a separate registrable domain;
  own domains via `site_domains`; one wildcard certificate. Today:
  `surenmaharjan.fyi` public, `cms.surenmaharjan.fyi` admin (D22).
- **Data model:** `sites`, `site_domains`, `users`, `site_members`,
  `email_tokens`, `invites`, `entries`, `media`, `site_settings`,
  `contact_submissions`, `ai_runs`, `stripe_events`, `schema_migrations`.
- **Blocks:** text is structured, **never raw HTML**, escaped on render
  (D28-D30); images store a media id (D60). From item 14, TipTap JSON is
  checked by our own Zod schema and rendered by our own renderer.
- **Data rules:** version check on save; R2 object before media row; members
  deactivated, never deleted; no state on disk (D9); a limit refuses the
  action, never the published site (D150); AI use is a monthly credit
  allowance (D164); **AI output is untrusted, writes drafts only, and is
  offered only while a site has nothing published.**

### Auth boundary

- Authorization, validation and rendering on the server.
- JWT (7 days), httpOnly, Secure, SameSite=Lax, host-only on the admin host.
- **Every admin request loads the user and membership**; the role comes from
  the database, never the token (D6); `requireRole` refuses with 404 (D69).
- CSRF: origin check. Site hosts accept one POST, `/_contact`.
- The emailed link verifies and signs in; nothing works before it (D161).
- Authors own posts and media; editors all content; admins also settings,
  members and plan. Uploads: 10 MB, JPEG/PNG/WebP/GIF, no SVG.

### Integrations

- **AI:** Anthropic, then OpenAI, then OpenRouter, only when one is
  unavailable - **never on a refusal** (D155).
- **Email:** SMTP via Resend (D156). **Payments:** Stripe's hosted pages;
  webhooks set the plan (D160).
- Spam: honeypot and rate limit (D157). Operator work: server commands (D158).

## Constraints

- **Server:** `ocwebserver` (2 vCPU, **954 MB RAM**), this app only; **never
  build on the server** (D14); no Docker there.
- **Environments (D21):** `development`, `ci`, `production` - no staging;
  `AGENTS.md` *Environments*.
- **Production holds on `8d82ce4` until v1 is done** (D163): one deploy,
  migrations rehearsed on a restored backup, rollback by restoring it.
- **Self-hostable (D148):** Node.js, PostgreSQL and S3-compatible storage only;
  signup, AI, email and billing each switch off.
- **Standards:** OWASP Top 10:2025, WCAG 2.2 AA, numbers in
  `blueprint/context/quality-bar.md`.

## Current state

- **Plan:** 12 of 21 items done (`blueprint/history/features/`); 13-21 queued;
  nothing in flight. Item 15 splits into 15a-15d.
- **Next:** `prototype` for the v1 screens, then `spec` item 13.
- **Live:** items 1-12 (`dev-notes/status.md`). CI: `verify` + `e2e` (D144).
