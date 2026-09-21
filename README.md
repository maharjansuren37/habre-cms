# Habre CMS

A website management system, like WordPress but built to be genuinely easy for
non-technical editors: they write, manage and publish one website's content in a
block editor, and the CMS serves the public site itself - no developer needed to
put something online. It is for small organisations with a handful of admins,
editors and authors.

**Status: in progress, live.** Admin login, writing posts with inline formatting
(bold, italic, links), and managing them (list, filter, search, delete) all
work, and are deployed to production at `https://cms.surenmaharjan.fyi`.
Publishing to a public site, images, pages, site settings and users/roles are
next - see `blueprint/build-plan.md`.

## Running it

Needs Node 26 and Docker.

    npm install
    cp .env.example .env        # then fill in the values - see below
    docker compose up -d        # development PostgreSQL 16
    npm run db:migrate
    npm run create-admin -- --email you@example.org --name "Your Name"
    npm run dev                 # http://127.0.0.1:3000 - log in at /admin/login

In `.env`, the web app needs `DATABASE_URL`, `APP_URL` (`http://127.0.0.1:3000`
locally; the public `https://` address in production) and `JWT_SECRET` (at least
32 characters - `.env.example` has the command that generates one). The server
refuses to start without them. `db:migrate` and `create-admin` need only
`DATABASE_URL`.

There is no sign-up page: the first admin is created with `create-admin`, which
asks for the password twice without showing it. Run the same command on the
server after deploying.

## Building it

    npm run build               # output in build/
    npm start                   # serves the production build
    npm run verify              # typecheck, lint, unit tests, build
    npx playwright install chromium && npm run test:e2e   # browser tests; need the dev database and .env

`npm run verify` is what CI runs on every push and pull request. It does **not**
include the browser tests, which need a database - run those yourself before a
release.

## Deploying it

**Deployed** to a single Oracle Cloud VPS (`ocwebserver`) - production only, no
staging. The app is **built locally or in CI, never on the server**, then copied
over with `rsync` and released atomically:

    npm ci && npm run verify && npm run build && npm ci --omit=dev
    # rsync app/ build/ db/ scripts/ server.js package.json package-lock.json
    # and production node_modules to /srv/habre-cms/releases/<commit-sha>
    # then, on the server, as the habre_cms user, from that release directory:
    node --env-file=/etc/habre-cms/production.env db/migrate.ts   # if there are pending migrations
    sudo ln -sfn /srv/habre-cms/releases/<commit-sha> /srv/habre-cms/current
    sudo systemctl restart habre-cms

Rollback is repointing `current` back to the previous release and restarting -
seconds, no rebuild - **except a release that ran a migration**, which cannot be
undone this way (reversing code does not reverse a schema).

`deploy/` holds what makes this reproducible:

- `setup-server.sh` - installs Node and PostgreSQL, creates the service user,
  database and secrets, installs the service, the Caddy site file and the nightly
  backup. Safe to run again.
- `habre-cms.service` - systemd unit; the app listens on localhost and Caddy
  terminates HTTPS.
- `backup-db.sh` with `habre-cms-backup.{service,timer}` - nightly `pg_dump` to a
  private object-storage bucket, checked before upload.

`dev-notes/status.md` records the release currently live and what is still
missing.

## How this project is built

This project uses a spec-driven workflow: plan first, spec before code, one
small reviewed step at a time, review gates before anything merges.

**New here? Read `AGENTS.md` first.** The name says agents, but it is the
orientation for anyone joining - which file holds what, who writes each one, and
how to pick up work that was interrupted. Then run `progress`, which reports
where things stand and what is next without reading the code.

- `blueprint/` - the workflow's state: plans, the current spec, findings, history
- `dev-notes/` - why it is shaped this way, and where it stands
- `AGENTS.md` - how work is done here. Every AI tool reads it; so should you
