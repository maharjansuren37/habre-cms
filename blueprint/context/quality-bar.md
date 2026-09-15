# Quality Bar

> Written by `architect` (2026-09-15), before any technology was chosen. Read by
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

## Scale

- One site per installation.
- Up to ~10 admin users; a handful editing at the same time.
- A few thousand entries and a few thousand media files.
- A few thousand public page views a day.

## Security posture

- Login-protected admin; three roles enforced on the server.
- Personal data: admin users' names and emails only. Visitors have no accounts
  and nothing about them is stored.
- Passwords stored with a slow password hash; never logged.
- Secrets (`JWT_SECRET`, database password, R2 keys) in environment variables
  only - never in the repository.
- Session cookie httpOnly, Secure, SameSite=Lax; login rate-limited; failed
  logins, role changes, deactivations and password resets logged.
- Uploads restricted to JPEG, PNG, WebP, GIF - no SVG.
- Editor content stored structured and escaped on render - no raw HTML.
- HTTPS only (Caddy). PostgreSQL reachable from localhost only.

## Availability

- Single server: down until noticed, **but an uptime check alerts the owner**.
- **Data loss tolerance:** at most 24 hours of content - nightly database backup
  stored off the VPS. Images live in R2.
- **Recovery:** a fresh server (e.g. headless Ubuntu) rebuilt from the
  repository, the latest backup and the secrets **in under 1 hour**. The same
  procedure covers a migration and a disk loss.

## Accessibility

Owned by `blueprint/context/design.md`, which `prototype` writes.
