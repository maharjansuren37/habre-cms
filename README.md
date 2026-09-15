# Project Name

<!-- Replace everything down to "How this project is built" - that section is
     worth keeping, and points whoever joins next at their orientation. The
     `docs` skill will help, and `preflight` treats a README that is still
     boilerplate as a blocker before going live. -->

One or two sentences: what this is, and who it is for.

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
