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

### F-07 [P3] fixed - Without X-Forwarded-For every login shares one rate-limit bucket

**File:** app/features/auth/client-ip.ts:10
**Found:** 2026-09-15 by review (scope: current; lens: security)
**Why it matters:** A request with no `X-Forwarded-For` is keyed as `unknown`. If production ever receives requests without it (a Caddy config that strips it, or the app reachable other than through Caddy), all visitors share one IP bucket and 20 failed logins from anyone lock everyone out for 15 minutes. Caddy's `reverse_proxy` sets the header by default, so this depends on deployment config not yet written - hence unverified.
**Suggested fix:** `host`: confirm the Caddy site file sets `X-Forwarded-For` and the app stays on 127.0.0.1; `preflight` checks it. Optionally log a warning once when a login arrives without the header in production.
**Resolution:** Partly repaired 2026-09-16 by build (spec step "Repair F-07"). The login action warns once per process, in production only, when a login arrives without `X-Forwarded-For`. Evidence: production build, two logins without the header -> exactly one warning line; a fresh process, a login with the header -> none; `npm run verify` exit 0. The finding's main check stays open for `host`/`preflight`: confirm the Caddy site file sets the header and the app listens only on 127.0.0.1. Status set to `fixed` so `preflight` re-checks and closes it.
Code part re-checked 2026-09-16 by independent review (reviewer agent): production build, 2 logins without the header (one 302, one 400) -> the warning exactly once, with no request data. Stays `fixed`: `preflight` closes it after `host` confirms the Caddy site file sets `X-Forwarded-For` and the app listens only on 127.0.0.1.

### F-13 [P3] unverified - One host with a routed IPv6 /48 still gets tens of thousands of rate-limit keys, so it can hold both password slots

**File:** app/features/auth/client-ip.ts:28 (`/64` key), app/features/auth/login-rate-limit.server.ts:25 (`createInFlightLimit(2)`); F-11's accepted residual
**Found:** 2026-09-16 by review (scope: current; lens: security)
**Why it matters:** F-11's accepted residual named only "an attacker with many IPv4 addresses (~600-1800 per 15 min)". Per-/64 keys give one machine with a routed /48 65,536 keys (~1.3 M counted attempts per 15 min) - a /48 is free from IPv6 tunnel brokers and standard at many hosts - far above the 600-1800 keys needed to keep both scrypt slots busy (a /56 gives 256 keys, 5,120 attempts: short of that but a large budget). So the slot-holding attack that makes real logins get 503 needs one machine, not a botnet, if the CMS hostname is reachable over IPv6; that reachability is the unverified part (`host` has not recorded it). The residual was accepted on an understated description. OWASP Top 10:2025 A06 Insecure Design.
**Suggested fix:** Correct F-11's residual wording to "many IPv4 addresses, or one IPv6 /48 if the CMS is served over IPv6" and have the user re-confirm. `host`: record whether the CMS hostname has an AAAA record; the cheapest mitigation is serving it over IPv4 only. Otherwise accept explicitly, or also count failures under a /48 key with a higher limit.
**Resolution:** Checked 2026-09-16 by build: `cms.surenmaharjan.fyi` is a CNAME to `surenmaharjan.fyi`, which has A `161.33.89.75` and no AAAA, so the hostname does not resolve over IPv6 today. Still unverified: DNS is not an access control - if the VPS has a public IPv6 address and Caddy listens on it, a client can connect to that address directly with the CMS hostname. `host` must check `ip -6 addr` on `ocwebserver` and Caddy's bind addresses, and note that an AAAA added to the root domain also applies to `cms` through the CNAME.
Evidence from the user, 2026-09-16, on `ocwebserver`: `ip -6 addr show scope global` is empty and there is no IPv6 default route; Caddy listens on `*:443` and `*:80` with no `bind`. With no public IPv6 address and no AAAA record, the CMS cannot be reached over IPv6, so the /48 attack is not possible on today's deployment. It becomes valid again if the VM gets IPv6; recorded for `host` in `project-plan.md` section 8 (put `bind 0.0.0.0` in `habre-cms.caddy`, or re-check this finding then). Status left `unverified`: marking it `invalid` is a `review` verdict or the user's call, not build's.
