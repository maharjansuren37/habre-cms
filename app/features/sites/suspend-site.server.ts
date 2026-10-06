import { sql } from "#app/lib/db.server.ts";

// Platform table, outside row-level security, so no `inSite`. Used by the
// `suspend-site` and `unsuspend-site` commands (D158). The host lookup refuses
// a suspended site on every request, so a change takes effect at once.

export type SuspendResult = {
  outcome: "changed" | "unchanged" | "unknown";
  /** Set when the site is suspended after the call. */
  suspendedAt?: Date;
};

export async function setSiteSuspended(
  address: string,
  suspended: boolean,
): Promise<SuspendResult> {
  const subdomain = address.trim().toLowerCase();

  // Only a row not yet in the target state is updated, so a repeat keeps the
  // original `suspended_at`.
  const [changed] = suspended
    ? await sql<{ suspendedAt: Date }[]>`
        update sites set suspended_at = now()
        where subdomain = ${subdomain} and suspended_at is null
        returning suspended_at as "suspendedAt"
      `
    : await sql<{ suspendedAt: Date }[]>`
        update sites set suspended_at = null
        where subdomain = ${subdomain} and suspended_at is not null
        returning suspended_at as "suspendedAt"
      `;
  if (changed)
    return suspended
      ? { outcome: "changed", suspendedAt: changed.suspendedAt }
      : { outcome: "changed" };

  const [existing] = await sql<{ suspendedAt: Date | null }[]>`
    select suspended_at as "suspendedAt" from sites where subdomain = ${subdomain}
  `;
  if (!existing) return { outcome: "unknown" };
  return existing.suspendedAt
    ? { outcome: "unchanged", suspendedAt: existing.suspendedAt }
    : { outcome: "unchanged" };
}
