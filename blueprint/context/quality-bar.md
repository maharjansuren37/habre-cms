# Quality Bar

> Written by `architect` (2026-09-15), before any technology was chosen;
> **updated for platform v1 on 2026-10-01**. Read by
> `stack`, `spec`, `verify`, `review` and `preflight`. Every line is something a
> person or a command can check. Re-run `architect` Step 4 when an answer
> changes.

## Performance

- **Public pages:** under 500 ms at p95, measured server-side, excluding image
  downloads.
- **Admin saves** (entry, settings, user): under 1 s at p95, measured
  server-side.
- **Uploads:** capped at 10 MB per image. Image size on public pages: not
  measured, no target in v1 (no resizing) - the known first bottleneck.
- **AI site generation:** from submit to the review screen in **under 2 minutes
  at p95, as the user experiences it**, with progress shown throughout.
- **AI cost per run:** measured in credits on every run (D164). Not measured
  yet, no target: item 18 measures it against the plan's price (D150), and the
  owner sets the target.

## Scale

- **Invite-only beta: up to 100 sites,** usually one member each, at most ~10;
  a handful editing one site at the same time.
- **Per site:** a few thousand entries and a few thousand media files at most.
- **Across all sites:** tens of thousands of public page views a day.

## Security posture

- Login-protected admin; three roles per site, enforced on the server.
- **Strangers' content in one database:** no request can read or write another
  site's rows. This is enforced by the app and by PostgreSQL row-level
  security, and proved by tests that use two sites (D151).
- **Personal data:**
  - members' names and emails;
  - visitors' contact-form submissions (name, email, message), kept until the
    site deletes them;
  - descriptions typed at onboarding, sent to the AI provider that runs -
    Anthropic, or on fallback OpenAI, or OpenRouter and an upstream that does
    not store or train on data.
  - Visitors have no accounts. Payment card data never reaches the server.
- Passwords stored with a slow password hash; never logged. Email tokens stored
  hashed, single-use and short-lived.
- Secrets in environment variables only - never in the repository:
  - `JWT_SECRET`, both database roles' passwords, R2 keys;
  - three AI keys, SMTP credentials, Stripe keys;
  - the Cloudflare DNS token, in Caddy's own environment.
- **AI output** is validated as untrusted input and is never published without
  a person.
- **Abuse:** the operator can suspend a site with one command.
- Session cookie httpOnly, Secure, SameSite=Lax; login rate-limited; failed
  logins, role changes, deactivations and password resets logged.
- Uploads restricted to JPEG, PNG, WebP, GIF - no SVG.
- Editor content stored structured and escaped on render - no raw HTML.
- HTTPS only (Caddy). PostgreSQL reachable from localhost only.

## Availability

- Single server: down until noticed, **but an uptime check alerts the owner** -
  every site at once. Kept for the beta; reconsider before billing goes live
  (item 21).
- **Data loss tolerance:** at most 24 hours of content - nightly database backup
  stored off the VPS. Images live in R2.
- **Recovery:** a fresh server (e.g. headless Ubuntu) rebuilt from the
  repository, the latest backup and the secrets **in under 1 hour**. The same
  procedure covers a migration and a disk loss.

## Accessibility

Owned by `blueprint/context/design.md`, which `prototype` writes.
