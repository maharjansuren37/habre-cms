import { data } from "react-router";
import { z } from "zod";
import { findRun } from "#app/features/ai/runs.server.ts";

/** This site's run for a `:runId` param; Not Found for a non-uuid, a missing run or another site's. */
export async function findThisRun(siteId: string, runId: string | undefined) {
  const id = z.uuid().safeParse(runId);
  const run = id.success ? await findRun(siteId, id.data) : null;
  if (!run) throw data("Not Found", { status: 404 });
  return run;
}
