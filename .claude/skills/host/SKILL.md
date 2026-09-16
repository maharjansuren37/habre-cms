---
name: host
description: "Provision what the project needs to run somewhere other than a laptop - hosting, database, domain, storage - per environment, with the cost stated before anything is created. Also owns the secret lifecycle: generating, storing, rotating, and revoking values, never printing or committing one. Proposes and stops; never creates a paid resource without explicit approval. Use when the user runs `host`, needs somewhere to deploy to, needs a real database or domain, or when scaffold reported something that needs a service."
---

# host - set up the places this runs

**Writes:** `blueprint/context/findings.md` · `blueprint/context/needs-you.md` · `dev-notes/decisions.md` · `dev-notes/status.md`

Where this sits:

    ship -> preflight -> host -> deploy -> monitor

> **Multi-part project:** `blueprint/project-plan.md` and
> `blueprint/context/quality-bar.md` (the bar the whole product is held to -
> `architect` writes it at the root, not per part) live at the **product
> root** - a part has no `project-plan.md` of its own, so an unqualified read
> finds nothing. `AGENTS.md` records `Product root:` - read it from there.
> Everything else here is this part's own.

`scaffold` installed everything that can live in the repository. This sets up
what cannot: the database that must actually exist, the place the app runs, the
domain people type.

**Two things make this skill different from the rest: it spends money, and it
handles secrets.** Both are treated accordingly.

**Every account, card and signup this needs goes into
`blueprint/context/needs-you.md` before anything is created**, not after the
approval gate. That file is what `prepare` reads, and it is the only way
someone finds out they need a provider account without first running the skill
that spends money.

## Before you start

**Read the Deployment and Architecture sections of `blueprint/project-plan.md`
first.** This skill spends money, and provisioning against a guess is the one
mistake here that cannot be undone with git. Two different stops:

- **The plan says it is not hosted** - "runs from source", "not published", a
  quality bar whose availability line says the concept does not apply. **Say so
  and stop. Do not ask.** The question has an answer and asking it again is how a
  deliberate decision gets re-litigated into a bill.
- **The plan is silent** - no third-party service, no database, no domain named,
  and nothing saying where it ships. **Stop and ask what this is for**, because
  silence is not the same as "no".

If `architect` has not run at all, say so - the services a project needs are a
consequence of its structure, and inventing them now means paying for the wrong
ones.

**If hosting already exists** - rows in the Environments table in `AGENTS.md`, or
resources the provider already lists - start from what is there, not from a blank
sheet. Report what is provisioned, change only what the plan now needs, and never
delete or resize an existing resource without separate, explicit approval. A
second run that provisions from scratch bills a second database next to the first.

## Step 1 - work out what is actually needed

From the Deployment and Architecture sections of `blueprint/project-plan.md`, and from anything
`scaffold` flagged as *needs a service*:

- **compute** - where the app runs
- **database** - and whether it needs backups from day one (it does, if it holds
  anything a person would miss)
- **storage** - files and uploads
- **domain and TLS**
- **anything an integration requires** - an email sender, a payment account

Only what a planned feature actually needs. A queue for a project with no
background work is cost and complexity bought for nothing.

### First: what kind of platform is this?

**Ask this before the list above, because it changes what "provisioning" even
means.** Do not sort by vendor - vendors change and the names date. Sort by
**what you have just made yourself responsible for**, which is the durable
question. Each step down this list hands you more:

| Shape | They own | **You own** | Deploy is | Rollback is |
|---|---|---|---|---|
| **Static host / CDN** <br>*(Pages, object storage + CDN)* | everything | the files | uploading files | re-uploading the previous ones |
| **Managed platform / PaaS** <br>*(the push-and-it-runs kind)* | machine, TLS, restarts, patching, scaling | config, secrets, the build's correctness | a push or a promote | promoting the previous release |
| **Container platform** <br>*(managed container runners)* | the host and scheduler | the image, and everything in it | a new image tag | the previous tag - **as long as you did not overwrite it** |
| **A server you manage** <br>*(VPS, bare metal, home box)* | the hardware, and nothing else | **all of it** - see below | your own mechanism | your own mechanism |
| **Serverless / functions** | everything around the code | the function, its cold start, and where state actually lives | per-function versions | an alias pointed at the previous version |

**Say which one this is, and say what it costs in responsibility rather than only
in money.** A static host is the cheapest and most reliable thing on this list and
is the right answer far more often than it is chosen. A server you manage is the
cheapest in money and the most expensive in attention, and the attention is
charged later, at times you do not pick.

**Two things are yours on every row**, including the managed ones, and both get
missed because the platform's dashboard looks like it is handling them: **what
happens to your data if the account goes away**, and **whether anything alerts a
human when it breaks.**

### On a server you manage

**The list above is the wrong list here.**
Compute already exists; what a managed platform was quietly providing does not.
Ask these instead, because each one is a thing that is simply absent until
someone sets it up:

- **What restarts it?** A process manager - a `systemd` unit is the plain answer
  on Linux. **Without this the app dies at the first crash or reboot and stays
  dead**, and it is the single most common way a self-hosted project is found
  offline days later.
- **What terminates TLS, and what renews the certificate?** A reverse proxy -
  some renew by default, others need a separate client and a timer. **A renewal
  that silently stops is an outage with a date on it**, so say which thing renews
  and how you would know it had failed.

  **The challenge type decides which firewall rule you need**: HTTP needs
  **port 80** reachable from the internet, TLS-ALPN needs **443**, and DNS
  needs neither but needs API credentials for the DNS provider - a closed port
  80 is a common reason issuance fails while everything else looks configured.
  **Where more than one challenge port is open, leave more than one type
  enabled**: restricting to one swaps a single point of failure for another,
  and it is checked by nobody until an unattended renewal months later finds
  its port closed.

  **After repeated failures an ACME client may fall back to the CA's staging
  environment and stay there.** Staging certificates are issued happily and
  trusted by nothing, so the symptom afterwards is a browser warning rather than
  an error in the log. **When issuance starts working, restart the client** and
  confirm the issuer on the certificate you are actually being served.
- **Which user does it run as?** Not root. A service account that owns the
  release directory and nothing else.
- **Where do secrets live?** A file on the box, readable only by that user -
  mode 600, outside the repository, referenced by path from the unit, **never
  inline in the unit file**, which is world-readable.
- **How many files?** **One per environment is the default**, and most
  projects should stop there. Splitting by service buys something real only
  when there is a boundary underneath it - a different owner, a different
  rotation schedule, or one process that should read a secret and another that
  should not. **Split when the boundary exists**, and say which boundary it is
  - never because it looks tidier: without one, splitting just adds files to
  keep in sync and **a new way to have exactly one of them missing**, which
  fails at start-up or, worse, at the first request that needed it.
- **What is actually installed on it?** A box you own is not a development
  machine and ships far less than one. Check for what the deploy itself needs
  before planning around it - a real Ubuntu VPS had **no `git`, no `rsync`, no
  `sqlite3` client and no `python3-venv`**, while the owner believed the existing
  site was deployed with rsync. Ask the box, not the person: everyone
  misremembers how a thing they set up months ago actually works, and the answer
  changes the deploy design rather than being a detail of it.

- **What else already runs on it?** A box that hosts one site usually hosts more
  soon. List the services, sites and scheduled jobs before adding anything, and
  budget memory against what is already used rather than against the machine's
  total.
- **Removing anything is its own approval, shown before it happens.** An app, a
  package, a user: say exactly what goes, and **simulate the package change first**
  (`apt-get -s`, or the platform's dry run) - `autoremove` takes dependencies
  nobody named, and a real run removed sixty packages that way unchecked. Back up
  any data the removal deletes, and say where the backup is.

- **What patches the operating system?** Unattended upgrades, or a person with a
  calendar. A box nobody updates is the part of self-hosting that has no managed
  equivalent.
- **What is the firewall - and is there more than one?** On every cloud there
  are **two**: the one on the box (`iptables`, `ufw`) and the provider's own
  (security list, security group, network ACL). **The provider's is invisible from
  inside the machine**, so a correct host firewall proves nothing. Open both, and
  **verify from outside before configuring anything that depends on it.**

  The check that tells them apart, run from elsewhere: **a refused connection
  means the packet arrived** and nothing was listening - the path is open. **A
  timeout means it never arrived** - something upstream is dropping it. Those look
  identical in a browser and mean completely different things.

  **Opening some ports and not others is the worst state**, because the failure
  then presents as something else entirely. Port 443 open and 80 closed does not
  look like a firewall problem - it looks like a broken TLS configuration.
- **Is SSH key-only?**
- **Backups, and where they go.** On a managed database this is a checkbox; here
  it is entirely yours, it is the thing most likely to be skipped, and a backup
  that has never been restored is not a backup.

  **Copying the database file is not a backup of a database that is running.**
  `cp` on a live SQLite file can land mid-transaction, with a write-ahead log
  that does not match what it copied; the result opens without complaint and is
  wrong. Use the engine's own mechanism - `sqlite3`'s backup API or `VACUUM
  INTO`, `pg_dump`, `mysqldump` - which take a consistent snapshot while the
  application keeps writing. **Then check the snapshot** and delete it if the
  check fails, because a corrupt file sitting in a backup directory is worse than
  an empty one: it looks like protection.

  **Restoring means starting the application against the copy**, not opening it
  in a database client. The client proves the file parses. Only the app proves
  the schema matches the code that has to read it - and that is the thing you
  will need at the moment you need it.

  **And a backup on the same disk is not off the box.** Say where the copy goes
  and what pulls it there; if nothing does, that is a risk to record, not a
  backup to tick.

**Say plainly what self-hosting costs and what it buys.** It is cheaper and you
control it; the price is that every item above is now your job, and the ones that
fail silently - renewal, backups, patching - fail at the worst time.

## Step 2 - decide the environments

**Ask, rather than assuming one.** The common shapes:

- **Production only** - legitimate for a personal project. A real choice, made
  deliberately, not the default that happens when nobody asks.
- **Production and staging** - somewhere to try a release before people see it.
- **Plus preview environments** - one per branch or pull request.

Each environment gets **its own configuration and its own secrets**. A staging
database that points at production data is not staging, and this is where that
mistake is prevented.

**Write them into the Environments table in `AGENTS.md`** - one row each, with
what it is for, where its configuration comes from, where its secrets live, and
**whether it holds data anyone would miss.** `development` is already there from
`scaffold`; this step adds the rest beside it.

That table is not a note to yourself. `deploy` names its target from it,
`migrate` reads the real-data column before it will touch a schema, `monitor`
uses the names so staging noise is not mistaken for production, and `preflight`
compares the rows to check the configurations are genuinely separate. **A row
that is wrong is how a destructive migration gets an easy yes.**

## Step 3 - state the cost before creating anything

**This is the step that must not be skipped.** For each resource, say:

- what it costs now, on the tier being proposed
- **what the free tier's real limits are** - rows, bandwidth, hours, sleep-after-
  inactivity - rather than calling it free and stopping there
- **what it will cost once a limit is crossed**, and roughly when that happens
- what is billed per use rather than per month, since that is the shape that
  surprises people

Then give the total, monthly. If the answer is "nothing today, about this much
once there are real users", say exactly that.

**Never provision a paid resource without explicit approval.** Approval for one
resource is not approval for the next.

## Step 4 - provision, one thing at a time

For each resource, in dependency order:

1. Say what you are about to create and where.
2. Create it.
3. Confirm it exists and is reachable.
4. Record it - what it is, which environment, how to reach it, where its
   settings live.

**Prefer portable choices.** A managed Postgres that speaks standard Postgres can
be moved; a proprietary data store cannot. Where a lock-in risk is real and the
plan mentions moving later, say so before creating it, and record the decision in
`dev-notes/decisions.md`.

## Step 5 - the secret lifecycle

This skill owns secrets from creation to revocation:

- **Generate** with real entropy. Never a placeholder, never reused between
  environments.
- **Store** in the environment or the host's secret store - **never in the
  repository**, never in a config file that gets committed.
- **Record the name, never the value**, in `.env.example` and in the environment
  list.
- **Rotate** when someone leaves, when a value may have leaked, or on a schedule
  the project sets.
- **Revoke** the old value after rotating, and confirm the new one works first.

**A value is never printed, never committed, never pasted into a finding or a
commit message.** If one has leaked, it is a P0 in `blueprint/context/findings.md`, and the
remedy is **rotation** - removing the commit does not help, because it has
already been copied.

**When this skill repairs a finding** - that rotation, or a `preflight` blocker
such as missing backups - **set it to `fixed`** with the evidence in its
**Resolution** line: the new value works and the old one is revoked, a restore
from the backup ran. **Never `closed`**: `preflight` re-checks it and closes it,
because a repair is examined by something other than what made it. Left `open`,
it blocks every later `ship` in this part.

## Step 6 - report

- every resource created, per environment, with its cost
- the total monthly cost, and what would change it
- every secret **by name**, where it lives, and when it should next rotate
- what still needs doing by hand - a DNS record, a verification email
- what `deploy` now needs in order to run

Record all of it in `dev-notes/status.md` so it survives a cleared context, and
add a `dev-notes/decisions.md` entry for the host choice and why.

## Rules

- **State the cost before creating anything**, and never provision a paid
  resource without an explicit yes.
- **Never print, commit, or log a secret value.**
- **One environment's configuration never leaks into another's.**
- **Do not provision a build toolchain on a production host.** Production runs
  the artifact; it does not make it. A compiler and the dev dependencies on a
  machine serving traffic is attack surface bought for nothing, and it is what
  makes building on the target look possible in the first place.
- **Never delete or resize an existing resource** without separate, explicit
  approval - that is someone's data.
- **Stop a process by the PID you started, never by a pattern.** `pkill -f` on a
  machine that runs the real thing matches the real thing: a restore drill's
  cleanup killed the live server, and because `SIGTERM` reads as a clean exit,
  `Restart=on-failure` left it down. The same holds for a scratch database, a
  test port or a temporary unit - name what you created, and clean up only that.
- **A drill against production is a production change.** Restores, rollbacks and
  failover tests get the same care as a deploy: say what you will run, what it
  touches, and how you will put it back.
- **Record everything.** An unrecorded resource is one nobody will find until it
  bills them.

## Formatting

Match `blueprint/context/ai-interaction.md` when it exists; otherwise keep output short, scannable, and direct.
