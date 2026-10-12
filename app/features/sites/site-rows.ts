import type { Plan } from "#app/features/plans/plan-limits.ts";
import type { PublicSite } from "./site-context.ts";

// The `sites` columns the lookups select, mapped to what callers read. Pure, so
// the shape is unit-tested without a database. `sites.plan` is constrained to
// 'free' | 'paid' by migration 0010.
export type PublicSiteRow = {
  id: string;
  subdomain: string;
  ownDomain: string | null;
  plan: Plan;
};
export type MemberSiteRow = { subdomain: string; suspended: boolean; plan: Plan };
export type MemberSite = { subdomain: string; suspended: boolean; plan: Plan };

export const toPublicSite = (row: PublicSiteRow): PublicSite => ({
  id: row.id,
  subdomain: row.subdomain,
  ownDomain: row.ownDomain,
  plan: row.plan,
});

export const toMemberSite = (row: MemberSiteRow): MemberSite => ({
  subdomain: row.subdomain,
  suspended: row.suspended,
  plan: row.plan,
});
