import { insertPageDraftsIn, listPageSlugsIn } from "#app/features/content/entries.server.ts";
import { applyDraftSettingsIn } from "#app/features/settings/settings.server.ts";
import { inSite } from "#app/lib/db.server.ts";
import { planApply } from "./apply-plan.ts";
import { proposalSchema } from "./proposal.ts";

export type ApplyResult =
  | { ok: true; pageIds: string[] }
  | { ok: false; reason: "not_succeeded" | "invalid" };

/** Thrown inside the transaction so the claim on the run is rolled back too. */
class InvalidDraft extends Error {}

/**
 * "Use this draft" (18b4a): the one writer of `applied`. One transaction claims
 * the run (only from `succeeded`, so the row lock makes a second or concurrent
 * apply find nothing), re-parses the stored proposal, then writes the pages and
 * settings. Pages are drafts; nothing is published.
 */
export async function applyRun(
  siteId: string,
  runId: string,
  userId: string,
): Promise<ApplyResult> {
  try {
    const pageIds = await inSite(siteId, async (tx) => {
      const [claimed] = await tx<{ result: unknown }[]>`
        update ai_runs set status = 'applied'
        where id = ${runId} and site_id = ${siteId} and status = 'succeeded'
        returning result
      `;
      if (!claimed) return null;
      const proposal = proposalSchema.safeParse(claimed.result);
      if (!proposal.success) throw new InvalidDraft();

      const takenPageSlugs = await listPageSlugsIn(tx, siteId);
      const [settings] = await tx<
        { logoMediaId: string | null; brandColor: string; siteDescription: string }[]
      >`
        select logo_media_id as "logoMediaId", brand_color as "brandColor",
          site_description as "siteDescription"
        from site_settings where site_id = ${siteId}
      `;
      if (!settings) throw new Error("site_settings row missing");
      const plan = planApply(proposal.data, {
        takenPageSlugs,
        hasLogo: settings.logoMediaId !== null,
        brandColor: settings.brandColor,
        siteDescription: settings.siteDescription,
      });

      const ids = await insertPageDraftsIn(tx, siteId, userId, plan.pages);
      const idByKey = new Map(plan.pages.map((page, at) => [page.key, ids[at] as string]));
      await applyDraftSettingsIn(tx, siteId, {
        navigation: plan.navigation.map((item) => ({
          label: item.label,
          pageId: idByKey.get(item.key) as string,
        })),
        homePageId: idByKey.get(plan.homeKey) as string,
        siteDescription: plan.siteDescription,
        brandColor: plan.brandColor,
      });
      return ids;
    });
    if (pageIds === null) return { ok: false, reason: "not_succeeded" };
    console.info(JSON.stringify({ event: "ai_run_applied", siteId, runId, pages: pageIds.length }));
    return { ok: true, pageIds };
  } catch (error) {
    if (error instanceof InvalidDraft) return { ok: false, reason: "invalid" };
    throw error;
  }
}
