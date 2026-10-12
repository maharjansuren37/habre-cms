import { isIP } from "node:net";
import { domainToASCII } from "node:url";

export type DomainRefusal = "empty" | "invalid" | "ip" | "reserved";
export type NormalizedDomain = { ok: true; domain: string } | { ok: false; reason: DomainRefusal };

// The same rule as db/migrations/0015_site_domains.sql's check: lowercase
// letters, digits and hyphens, at least two labels of 1-63 characters.
const DOMAIN_PATTERN =
  /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
const NOT_A_NAME = /[\s/?#@:_]/;

function endsInNumber(name: string): boolean {
  return /^\d+$/.test(name.slice(name.lastIndexOf(".") + 1));
}

function hostname(host: string): string {
  return host.trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
}

/**
 * What a site's admin typed, as the one lowercase ASCII hostname the database
 * stores, or why it cannot be one. `hosts` are `URL.host` values and may carry
 * a port. A name equal to or under either host is `reserved`.
 */
export function normalizeDomain(
  input: string,
  hosts: { platformHost: string; sitesHost: string },
): NormalizedDomain {
  let value = input.trim().toLowerCase();
  if (value === "") return { ok: false, reason: "empty" };
  if (value.endsWith(".")) value = value.slice(0, -1);
  // A scheme, path, query, fragment, userinfo, port or IPv6 literal, a space
  // or an underscore: not a bare hostname. `://` is covered by `:` and `/`.
  if (value === "" || NOT_A_NAME.test(value)) return { ok: false, reason: "invalid" };

  // `domainToASCII` answers "" for a name ending in a number, so that rule
  // runs on what was typed as well as on the converted form.
  if (endsInNumber(value)) return { ok: false, reason: "ip" };
  const ascii = domainToASCII(value);
  if (ascii === "" || ascii.length > 253) return { ok: false, reason: "invalid" };
  if (isIP(ascii) !== 0 || endsInNumber(ascii)) return { ok: false, reason: "ip" };
  if (!DOMAIN_PATTERN.test(ascii)) return { ok: false, reason: "invalid" };

  for (const reserved of [hostname(hosts.platformHost), hostname(hosts.sitesHost)]) {
    if (ascii === reserved || ascii.endsWith(`.${reserved}`)) {
      return { ok: false, reason: "reserved" };
    }
  }
  return { ok: true, domain: ascii };
}

export type VerificationRecords = {
  /** The TXT record that proves the domain is theirs. */
  txt: { name: string; value: string };
  /** The record that makes the domain reach the site: a CNAME to the site's subdomain host. */
  reach: { name: string; target: string };
};

/** What the page tells a person to add at their DNS provider (fixed, shown to people). */
export function verificationRecords(
  domain: string,
  token: string,
  siteHost: string,
): VerificationRecords {
  return {
    txt: { name: `_habre-verify.${domain}`, value: `habre-verify=${token}` },
    reach: { name: domain, target: siteHost },
  };
}

/** A DNS answer: its strings, or "error" when our resolver failed (not "no records"). */
export type Lookup = readonly string[] | "error";
export type VerificationOutcome =
  | "verified"
  | "no-txt"
  | "wrong-txt"
  | "not-pointing"
  | "lookup-failed";

function unquote(value: string): string {
  return value
    .trim()
    .replace(/^"+|"+$/g, "")
    .trim();
}

function address(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * The verification decision. Precedence, first match wins:
 * 1. the TXT lookup failed -> lookup-failed
 * 2. no TXT records -> no-txt
 * 3. TXT records, none exactly `habre-verify=<token>` -> wrong-txt
 * 4. the domain's lookup failed, the site's lookup failed, or the site has no
 *    addresses -> lookup-failed (our side is broken; never blame the person)
 * 5. the domain has no addresses, or any address that is not one of the
 *    site's -> not-pointing (a subset test: a domain that also points
 *    elsewhere is not ours to serve, F-414)
 * 6. otherwise -> verified
 */
export function decideVerification(input: {
  token: string;
  txt: Lookup;
  domainAddresses: Lookup;
  siteAddresses: Lookup;
}): VerificationOutcome {
  const { txt, domainAddresses, siteAddresses } = input;
  if (txt === "error") return "lookup-failed";
  if (txt.length === 0) return "no-txt";
  const wanted = `habre-verify=${input.token}`;
  if (!txt.some((value) => unquote(value) === wanted)) return "wrong-txt";

  if (domainAddresses === "error" || siteAddresses === "error" || siteAddresses.length === 0) {
    return "lookup-failed";
  }
  const site = new Set(siteAddresses.map(address));
  if (domainAddresses.length === 0 || !domainAddresses.every((value) => site.has(address(value)))) {
    return "not-pointing";
  }
  return "verified";
}

/** How long an unverified claim keeps a domain before someone else may take it. */
export const CLAIM_TTL_MS = 24 * 60 * 60 * 1000;

/** A verified claim is never replaced; an unverified one only after 24 hours. */
export function canReplaceClaim(
  claim: { verifiedAt: Date | null; createdAt: Date },
  now: Date,
): boolean {
  if (claim.verifiedAt !== null) return false;
  return now.getTime() - claim.createdAt.getTime() >= CLAIM_TTL_MS;
}
