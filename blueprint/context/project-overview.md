# Project Overview

> **Generated file.** Written by `distill` from
> `blueprint/project-plan.md` and `blueprint/build-plan.md`. Edit those and
> regenerate - never edit this file by hand. It orients; the files it names are
> the record. Decision numbers are entries in `dev-notes/decisions.md` -
> read the entry before changing anything it covers.

Generated 2026-10-14, `main` after `9c2e89f` plus the v2 rescope.

## What this is

**Habre is an AI-powered platform to create, manage and publish a website**
(D148): describe what you want, get a site, edit it, publish it. **Simple by
default, powerful when needed.** The CMS serves each public site itself, and
from item 55 can also feed a site someone builds elsewhere (D511).

- **Levels** - how someone uses Habre, per site, never paid for (D166, D175):
  **Simple** (default), **Pro**, **Developer**. One editor, one stored
  format; the level only reveals controls.
- **Tiers** - what a site pays for, never a level (D175): Free, Launch $19,
  Growth, Scale, Enterprise - **provisional**. Launch is sold today.
- **Free and open source to self-host** (AGPL-3.0-only, D505); hosting is sold.
- **Principles** (`blueprint/context/principles.md`): simple by default; **AI
  suggests, the user applies**.

## Scope

**Built and live (items 1-21c, v1, deployed 2026-10-13):** block editor
(TipTap, sections, columns, ready-made sections), sites and row-level
security, signup, password reset, your account, sites by host and own
domains, SEO, optimised images, brand colour and presets, AI start from a
description with credits, contact form and Messages, Simple and Pro, plans
and Stripe billing. Archives in `blueprint/history/`.

**Platform v2 (items 22-57, D506) - the full product in
`prototypes/Build CMS for Website.zip`, Habre's branding, generic for any
business, revealed by level.** Done when a person can build any website they
like - proven by rebuilding movers-site-v2 and three Figma Make sites (D509).

- **v2a, build any site (22-34):** section width and styles, new blocks,
  styling per element, custom fonts, free-form sections (pixel plus guided
  grid, Pro, D507), motion (D510), header and footer, form builder,
  localization, custom CSS and a sandboxed code block (Developer, D508), a
  "Local business" starter, the proof.
- **v2b, admin shell and workspace (35-42):** the prototype's shell and
  dashboard, revisions, collections, builder library, media v2, AI assistant,
  content health.
- **v2c, Grow (43-50):** leads, calendar and quotes, automation,
  integrations, SEO centre, programmatic pages, analytics, A/B.
- **v2d, platform (51-57):** teams and several sites, roles and approvals,
  audit, co-editing, content API, headless platform, marketplace.

**Out of scope:** plan section 11 - e-commerce, comments, WordPress import,
SSO/SAML/SCIM, data residency, more themes, hosting exported code as-is.

## Stack

Pinned versions: plan section 5 and `AGENTS.md`. **Minimal dependencies is a
constraint** - each new runtime dependency is a recorded decision.

- TypeScript 7.0.2 strict, `erasableSyntaxOnly`; Node.js 26 (D15).
- **React Router 8.4.0 framework mode**, React 19.3.0, Vite 8.3.0, on
  `node:http` - **no Express** (D10, D17, D23).
- PostgreSQL 16, `postgres` driver, **raw SQL, no ORM** (D11).
- Plain CSS, tokens in `app/app.css`, CSS Modules, **no Tailwind** (D12); look
  in `design.md`; public pages in the `data-surface="site"` scope (D183).
- `jose` JWT + scrypt, **no auth library** (D6); Zod at every trust boundary.
- TipTap 3.31.4 pinned (D197); R2 via `aws4fetch`; `sharp` 0.35.5 (D174);
  `nodemailer` over SMTP (D156); `openai` and `@anthropic-ai/sdk` (D372);
  `stripe` (D160); Biome; `node:test`; Playwright.

## Architecture

Full detail: plan section 6. One application, deployed once (D4). One
in-process background job: the AI run, two at a time (D154). **v2's
architecture is not designed yet** - its open questions are in plan
section 10 for `architect`.

- **Layout (D16):** routes in `app/routes.ts`, modules in
  `app/features/<feature>/`, shared code in `app/lib/`, `*.server.ts` for
  server-only. Conventions: `coding-standards.md`.
- **Tenancy (D151, D152):** shared tables with `site_id`; **row-level
  security** returns nothing when no site is set; an owner role for
  migrations, an app role under it. Users global, roles on `site_members`,
  one site per user until item 51 (D159).
- **Hosts (D153, D173):** the app at `app.<platform domain>`; sites at
  `<name>.<sites domain>` or an own domain; one main address per site.
  **Interim (D495):** platform `app.surenmaharjan.fyi`, sites on
  `habre.page`, `SEARCH_INDEXING=off` (D497).
- **Data model:** `sites`, `site_domains`, `users`, `site_members`,
  `email_tokens`, `invites`, `entries`, `media`, `site_settings`,
  `contact_submissions`, `ai_runs`, `stripe_events`, `schema_migrations`.
- **Content (D169, D170):** an entry is **one TipTap JSON document**
  (`blocks_format` v4); our own Zod schema and escaping renderer, **never
  raw HTML** (D28-D30) - except v2's Developer code block and site CSS, only
  ever on the site's origin (D508).
- **Per site (D167, D171, D172):** level, dark mode, brand colour, style
  preset, language - in `site_settings`.
- **Data rules:** version check on save; R2 objects before the media row; no
  state on disk (D9); a limit refuses the action, never the published site
  (D150); AI use is a monthly credit allowance (D164); **AI output writes
  drafts only**.

### Auth boundary

- Authorization, validation and rendering on the server. JWT (7 days),
  httpOnly, Secure, SameSite=Lax, host-only on the admin host.
- **Every admin request loads the user and membership**; the role comes from
  the database, never the token (D6); `requireRole` refuses with 404 (D69).
- CSRF: origin check. Site hosts accept one POST, `/_contact`.
- Email confirm and password reset: plan section 6, D161, D251, D271-D283.

### Integrations

- **AI:** OpenRouter first, Anthropic and OpenAI direct as priced fallbacks;
  never falls back on a refusal (D155, D372, D393, D398). The runner uses
  OpenRouter alone for now (D405).
- **Email:** SMTP via Resend (D156). **Payments:** Stripe's hosted pages;
  webhooks set the plan (D149, D160).

## Constraints

- **Server:** `ocwebserver` (2 vCPU, 954 MB RAM), upgradeable and costed as
  usage grows; **never build on the server** (D14); no Docker there.
- **Environments (D21):** `development`, `ci`, `production` (real data) - no
  staging; `AGENTS.md` *Environments*.
- **Deploys (D512):** from v2, every shipped item is deployed, each with its
  own yes. Production holds real data: migrations additive, half-built
  modules hidden behind a level or switch.
- **Self-hostable (D148):** Node.js, PostgreSQL and S3-compatible storage
  only; signup, AI, email and billing each switch off.
- **Standards:** OWASP Top 10:2025, WCAG 2.2 AA, semantic HTML; numbers in
  `blueprint/context/quality-bar.md`.

## Current state

- **Plan:** items 1-21c done and live (`d340758`, `dev-notes/status.md`);
  v2 items 22-57 unchecked.
- **In flight:** nothing. **Next:** `architect` for v2, then `prototype`
  (admin shell, public-side looks), then `spec 22` (section width).
- **Owner's:** `blueprint/context/needs-you.md` (F-428, F-441, the three
  Figma Make reference sites).
