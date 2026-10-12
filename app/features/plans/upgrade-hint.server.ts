import { findMemberSite } from "#app/features/sites/find-site.server.ts";
import { env } from "#app/lib/env.server.ts";
import { type UpgradeHint, upgradeHint } from "./upgrade-hint.ts";

/** The hint for a site's limit messages, read when a refusal is about to be shown. */
export async function upgradeHintFor(siteId: string): Promise<UpgradeHint> {
  const { plan } = await findMemberSite(siteId);
  return upgradeHint(plan, env.BILLING !== null);
}
