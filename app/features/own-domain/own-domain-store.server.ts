import { randomBytes } from "node:crypto";
import type postgres from "postgres";
import {
  canReplaceClaim,
  type DomainRefusal,
  decideVerification,
  normalizeDomain,
  type VerificationOutcome,
} from "./own-domain.ts";
import type { DueDomain } from "./own-domain-checker.ts";
import type { DomainLookups } from "./own-domain-dns.server.ts";
import { CHECK_WINDOW_MS } from "./own-domain-schedule.ts";

// `site_domains` is a platform table, outside row-level security: every query
// here names `site_id` itself.
//
// The store takes its database client and DNS lookups as inputs and imports no
// server module, so a test can run its SQL as the app role (F-415).
// `own-domain.server.ts` binds it to the app's own `sql` and resolver.

// The rows read per tick; the checker itself takes at most 20 of the due ones.
const CANDIDATE_LIMIT = 200;

export type SiteDomain = {
  domain: string;
  verifiedAt: Date | null;
  token: string | null;
  createdAt: Date;
  lastCheckedAt: Date | null;
};

type Row = {
  domain: string;
  verified_at: Date | null;
  verification_token: string | null;
  created_at: Date;
  last_checked_at: Date | null;
};

type CandidateRow = {
  site_id: string;
  domain: string;
  subdomain: string;
  created_at: Date;
  last_checked_at: Date | null;
};

function toSiteDomain(row: Row): SiteDomain {
  return {
    domain: row.domain,
    verifiedAt: row.verified_at,
    token: row.verification_token,
    createdAt: row.created_at,
    lastCheckedAt: row.last_checked_at,
  };
}

export type AddResult =
  | { ok: true; domain: string; token: string }
  | { ok: false; reason: DomainRefusal | "free" | "has_domain" | "taken" };

export type CheckResult = { outcome: VerificationOutcome; newlyVerified: boolean };

const UNIQUE_VIOLATION = "23505";

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === UNIQUE_VIOLATION
  );
}

export function createOwnDomainStore(sql: postgres.Sql, defaults: { lookups: DomainLookups }) {
  /** The site's one domain (the earliest, should a race ever leave two), if any. */
  async function findSiteDomain(siteId: string): Promise<SiteDomain | null> {
    const [row] = await sql<Row[]>`
      select domain, verified_at, verification_token, created_at, last_checked_at
      from site_domains
      where site_id = ${siteId}
      order by created_at, domain
      limit 1`;
    return row ? toSiteDomain(row) : null;
  }

  /**
   * Claims a domain for a Launch site that has none. One transaction, holding
   * the site's row so two adds from one site cannot both pass the checks. Never
   * writes `verified_at`: the app role cannot, so a row is never born verified.
   */
  async function addDomain(input: {
    siteId: string;
    typed: string;
    hosts: { platformHost: string; sitesHost: string };
    now?: Date;
  }): Promise<AddResult> {
    const normalized = normalizeDomain(input.typed, input.hosts);
    if (!normalized.ok) return normalized;
    const { domain } = normalized;
    const now = input.now ?? new Date();
    const token = randomBytes(16).toString("hex");

    try {
      return (await sql.begin(async (tx): Promise<AddResult> => {
        const [site] = await tx<{ plan: "free" | "paid" }[]>`
          select plan from sites where id = ${input.siteId} for update`;
        if (site?.plan !== "paid") return { ok: false, reason: "free" };

        const [own] = await tx<{ domain: string }[]>`
          select domain from site_domains where site_id = ${input.siteId} limit 1`;
        if (own) return { ok: false, reason: "has_domain" };

        const [held] = await tx<{ verified_at: Date | null; created_at: Date }[]>`
          select verified_at, created_at from site_domains where domain = ${domain}`;
        if (held) {
          const replaceable = canReplaceClaim(
            { verifiedAt: held.verified_at, createdAt: held.created_at },
            now,
          );
          if (!replaceable) return { ok: false, reason: "taken" };
          await tx`delete from site_domains where domain = ${domain} and verified_at is null`;
        }

        await tx`
          insert into site_domains (domain, site_id, verification_token)
          values (${domain}, ${input.siteId}, ${token})`;
        return { ok: true, domain, token };
      })) as AddResult;
    } catch (error) {
      // Two claims for one name at once: the primary key lets one win.
      if (isUniqueViolation(error)) return { ok: false, reason: "taken" };
      throw error;
    }
  }

  /**
   * Looks up the site's domain's records and, when they hold, verifies it. Null
   * means the site has no domain. `siteHost` is the site's own subdomain host.
   * An already verified domain answers without any lookup.
   */
  async function checkDomain(input: {
    siteId: string;
    siteHost: string;
    lookups?: DomainLookups;
    now?: Date;
  }): Promise<CheckResult | null> {
    const current = await findSiteDomain(input.siteId);
    if (!current) return null;
    if (current.verifiedAt !== null) return { outcome: "verified", newlyVerified: false };
    // An unverified row always has its token; without one it cannot verify.
    if (current.token === null) return { outcome: "no-txt", newlyVerified: false };

    const lookups = input.lookups ?? defaults.lookups;
    const now = input.now ?? new Date();
    const [txt, domainAddresses, siteAddresses] = await Promise.all([
      lookups.txt(`_habre-verify.${current.domain}`),
      lookups.addresses(current.domain),
      lookups.addresses(input.siteHost),
    ]);
    const outcome = decideVerification({
      token: current.token,
      txt,
      domainAddresses,
      siteAddresses,
    });
    const verified = outcome === "verified";

    // `verified_at is null` makes this the one place a row becomes verified: a
    // returned row on a verified outcome is a verification this call made.
    const rows = await sql<{ domain: string }[]>`
      update site_domains
      set last_checked_at = ${now},
          verified_at = case when ${verified} then ${now}::timestamptz else null end,
          verification_token = case when ${verified} then null else verification_token end
      where domain = ${current.domain} and site_id = ${input.siteId} and verified_at is null
      returning domain`;
    return { outcome, newlyVerified: verified && rows.length > 0 };
  }

  /** Removes the site's domain, verified or not; says whether there was one. */
  async function removeDomain(siteId: string): Promise<boolean> {
    const rows = await sql<{ domain: string }[]>`
      delete from site_domains where site_id = ${siteId} returning domain`;
    return rows.length > 0;
  }

  /**
   * Unverified rows with a token, younger than the window, of sites that are
   * not suspended, longest-unchecked first. `sitesHostname` is the sites
   * domain's hostname (a DNS name carries no port).
   */
  async function dueCandidates(now: Date, sitesHostname: string): Promise<DueDomain[]> {
    const since = new Date(now.getTime() - CHECK_WINDOW_MS);
    // Platform tables, outside row-level security. A suspended site is left alone.
    const rows = await sql<CandidateRow[]>`
      select d.site_id, d.domain, s.subdomain, d.created_at, d.last_checked_at
      from site_domains d
      join sites s on s.id = d.site_id
      where d.verified_at is null
        and d.verification_token is not null
        and d.created_at > ${since}
        and s.suspended_at is null
      order by d.last_checked_at asc nulls first
      limit ${CANDIDATE_LIMIT}`;
    return rows.map((row) => ({
      siteId: row.site_id,
      domain: row.domain,
      siteHost: `${row.subdomain}.${sitesHostname}`,
      createdAt: row.created_at,
      lastCheckedAt: row.last_checked_at,
    }));
  }

  return { findSiteDomain, addDomain, checkDomain, removeDomain, dueCandidates };
}
