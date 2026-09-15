# Findings

> **Generated file.** The findings ledger: review findings raised by the `review`
> skill against the work in progress, each with a durable ID, a severity (P0-P3),
> and a status. `build` marks a repaired finding `fixed`; only a later `review`
> pass moves it to `closed`. **A finding no code fixes** - raised by `preflight`
> or `host`, such as missing backups or a leaked secret - is marked `fixed` with
> evidence by whichever skill repairs it, and `preflight` re-checks and closes it.
> `ship` refuses to merge while any P0 or P1 finding
> is `open` or `fixed`, then archives resolved findings with the work item and
> resets this file.

_No findings recorded._
