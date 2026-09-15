# Needs you

> **Work only a person can do.** An agent adds a line here the moment it finds
> something it cannot do itself, rather than discovering it again three steps
> later. `prepare` reads this file; `progress` names the next item from it when
> the next action is yours; `preflight` treats anything still open and required
> as a blocker.
>
> **This is a record, not a guess.** The point of writing it down is that the
> answer stops being re-derived: a skill that stops for an account today and a
> skill that stops for the same account next week should be the same line, not
> two conversations.

## How to write a line

Four things, because a line missing any of them cannot be acted on:

- **What** - the specific thing, not the category. "A Postgres role for `appuser`",
  not "database access".
- **Why it is yours** - spend, credentials, a decision, physical hardware, or
  system software. If an agent could actually do it, it does not belong here.
- **What it blocks** - the item, the skill, or "nothing yet, needed by `deploy`".
  This is what separates *do it now* from *have it ready by then*.
- **Status** - `open`, `done`, or `dropped` with a reason.

**Blocking now and needed later are different, and both belong here.** An account
you will want at `deploy` is not urgent today, but finding out about it at deploy
time is how a release stalls. Say which it is rather than filing everything as
urgent - a list where everything is blocking gets read once.

## Closing a line

**The skill that would have needed it closes it, on its next run.** `host` opened
the line about an account, so `host` closes it once the account exists;
`scaffold` closes the toolchain it was waiting for; `verify` closes the manual
check once someone has done it. Whoever writes a line here is also the one that
finds out it is satisfied.

**Check before closing, the same as before opening.** "Installed" is proven by
running it, not by the plan saying so.

**`prepare` never closes anything** - it reports that a line looks satisfied and
names the skill that owns it. It reads this file and writes nothing, which is
what makes its report trustworthy.

**A file that only grows stops being read.** Nothing closed a line here for the
first two days this file existed, so every item stayed open forever - and
`preflight` treats an open required line as a blocker, which means a requirement
met months ago would have blocked a release permanently. Moving a line to Done is
not tidying; it is what keeps the open list true.

## Kinds

| kind | examples |
|---|---|
| **Spend** | hosting, a domain, a managed database, a paid tier, anything with a card |
| **Accounts and credentials** | a signup, an API key, an OAuth app, a token scope, an SSH key |
| **System software** | a language toolchain or SDK, a database server, Xcode, Android Studio - `scaffold` never installs these |
| **Hardware** | a real device, a simulator, a screen reader, a second machine |
| **Manual verification** | anything no test reaches: tab order, screen-reader output, "does this actually render" |
| **Decisions and approvals** | scope cuts, a destructive migration, a production deploy, a version number that can never be unpublished |
| **Access** | a repository setting, branch protection, a firewall or DNS rule, someone else's permission |

## Open

<!-- One line each. Newest last, so the file reads as it happened.

     - [ ] **Postgres role for `appuser`** - system software; needs a superuser.
           Blocks `scaffold` on `api`. Fix: `sudo -u postgres createuser -s appuser`
-->

_Nothing recorded yet._

## Done

<!-- Move lines here rather than deleting them. What was needed and when it was
     settled is worth keeping - it is the honest answer to "why did this take
     three days", and it stops the same question being asked again. -->
