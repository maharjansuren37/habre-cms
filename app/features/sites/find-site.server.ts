import { sql } from "#app/lib/db.server.ts";
import type { PublicSite } from "./site-context.ts";
import {
  type MemberSite,
  type MemberSiteRow,
  type PublicSiteRow,
  toMemberSite,
  toPublicSite,
} from "./site-rows.ts";

// The main address's own domain (item 17, D173): the earliest verified, ties by
// name - a scalar subquery on `site_domains_site_id_idx`, so still one query.
const ownDomainSql = sql`(
  select od.domain from site_domains od
  where od.site_id = s.id and od.verified_at is not null
  order by od.verified_at, od.domain limit 1
)`;

// Platform tables, outside row-level security, so no `inSite`. Each is one
// query on a unique index: it runs on every site-host request. A suspended
// site is not served (the caller answers 404).

export async function findSiteBySubdomain(label: string): Promise<PublicSite | null> {
  const [row] = await sql<PublicSiteRow[]>`
    select s.id, s.subdomain, s.plan, ${ownDomainSql} as "ownDomain"
    from sites s where s.subdomain = ${label} and s.suspended_at is null
  `;
  return row ? toPublicSite(row) : null;
}

/** An own domain serves its site only once verified. */
export async function findSiteByDomain(host: string): Promise<PublicSite | null> {
  const [row] = await sql<PublicSiteRow[]>`
    select s.id, s.subdomain, s.plan, ${ownDomainSql} as "ownDomain"
    from site_domains d join sites s on s.id = d.site_id
    where d.domain = ${host} and d.verified_at is not null and s.suspended_at is null
  `;
  return row ? toPublicSite(row) : null;
}

/** The address a member's site is served at, whether it is suspended (the
 *  shell's notice) and its plan; a platform table, one query by primary key. */
export async function findMemberSite(siteId: string): Promise<MemberSite> {
  const [row] = await sql<MemberSiteRow[]>`
    select subdomain, plan, suspended_at is not null as suspended from sites where id = ${siteId}
  `;
  if (!row) throw new Error("the member's site does not exist");
  return toMemberSite(row);
}
