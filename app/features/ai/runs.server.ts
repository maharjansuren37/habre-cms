import { inSite, sql } from "#app/lib/db.server.ts";
import { proposalSchema } from "./proposal.ts";
import type { RunKind, RunStore } from "./run-generation.ts";

// The database store for the run's lifecycle (18b1 Step 6, D154). Every query
// runs inside `inSite` AND names `site_id` (D151's two guards).

export const runStore: RunStore = {
  async creditsUsedSince(siteId, since) {
    return inSite(siteId, async (tx) => {
      const [row] = await tx<{ used: string }[]>`
        select coalesce(sum(credits), 0) as used
        from ai_runs
        where site_id = ${siteId} and created_at >= ${since}
      `;
      // A bigint sum arrives as a string.
      return Number(row?.used ?? 0);
    });
  },

  async hasRunningRun(siteId) {
    return inSite(siteId, async (tx) => {
      // The 5-minute run limit plus a minute: a run whose finish write was lost
      // blocks its site for at most that long. The startup sweep still fails the row.
      const rows = await tx`
        select 1 from ai_runs
        where site_id = ${siteId} and status = 'running'
          and created_at > now() - interval '6 minutes'
        limit 1
      `;
      return rows.length > 0;
    });
  },

  async insertRunning({ siteId, userId, kind, description }) {
    return inSite(siteId, async (tx) => {
      const [row] = await tx<{ id: string }[]>`
        insert into ai_runs (site_id, user_id, kind, description, status)
        values (${siteId}, ${userId}, ${kind}, ${description}, 'running')
        returning id
      `;
      if (!row) throw new Error("ai_runs insert returned no row");
      return row.id;
    });
  },

  async finish(siteId, runId, outcome) {
    const { usage } = outcome;
    await inSite(siteId, async (tx) => {
      await tx`
        update ai_runs set
          status = ${outcome.status},
          error = ${outcome.error},
          result = ${outcome.result === null ? null : tx.json(outcome.result)},
          provider = ${outcome.provider},
          model = ${outcome.model},
          input_tokens = ${usage?.input ?? null},
          cached_input_tokens = ${usage?.cacheRead ?? null},
          cache_write_tokens = ${usage?.cacheWrite ?? null},
          output_tokens = ${usage?.output ?? null},
          cost_usd = ${outcome.costUsd},
          credits = ${outcome.credits},
          finished_at = now()
        where id = ${runId} and site_id = ${siteId} and status = 'running'
      `;
    });
  },
};

export type StoredRun = {
  id: string;
  kind: RunKind;
  status: string;
  error: string | null;
  provider: string | null;
  model: string | null;
  inputTokens: number | null;
  cachedInputTokens: number | null;
  cacheWriteTokens: number | null;
  outputTokens: number | null;
  description: string;
  credits: number;
  createdAt: Date;
  finishedAt: Date | null;
  result: unknown;
};

/** One run of a site. */
export async function findRun(siteId: string, runId: string): Promise<StoredRun | null> {
  return inSite(siteId, async (tx) => {
    const [row] = await tx<StoredRun[]>`
      select id, kind, description, status, error, provider, model,
        input_tokens as "inputTokens", cached_input_tokens as "cachedInputTokens",
        cache_write_tokens as "cacheWriteTokens", output_tokens as "outputTokens",
        credits, created_at as "createdAt", finished_at as "finishedAt", result
      from ai_runs
      where id = ${runId} and site_id = ${siteId}
    `;
    return row ?? null;
  });
}

/** The site's running run, within the six-minute window `hasRunningRun` uses. */
export async function findRunningRun(siteId: string): Promise<{ id: string } | null> {
  return inSite(siteId, async (tx) => {
    const [row] = await tx<{ id: string }[]>`
      select id from ai_runs
      where site_id = ${siteId} and status = 'running'
        and created_at > now() - interval '6 minutes'
      order by created_at desc
      limit 1
    `;
    return row ?? null;
  });
}

/** Whether the site has used an AI draft: onboarding closes once it has (18b4a). */
export async function hasAppliedRun(siteId: string): Promise<boolean> {
  return inSite(siteId, async (tx) => {
    const rows = await tx`
      select 1 from ai_runs where site_id = ${siteId} and status = 'applied' limit 1
    `;
    return rows.length > 0;
  });
}

/**
 * How many pages the site's used draft had, for Home's ready panel (18b4a); 0
 * when there is no applied run or its stored result no longer parses.
 */
export async function appliedRunPageCount(siteId: string): Promise<number> {
  return inSite(siteId, async (tx) => {
    const [row] = await tx<{ result: unknown }[]>`
      select result from ai_runs
      where site_id = ${siteId} and status = 'applied'
      order by created_at desc
      limit 1
    `;
    const parsed = proposalSchema.safeParse(row?.result);
    return parsed.success ? parsed.data.pages.length : 0;
  });
}

/**
 * The site's newest finished draft, used or not, for Home's panel (18b4a); null
 * when there is none or the newest is a succeeded run whose stored result no
 * longer parses (the review reads that as failed, F-365). The result is not returned.
 */
export async function findLatestFinishedRun(
  siteId: string,
): Promise<{ id: string; status: "succeeded" | "applied" } | null> {
  return inSite(siteId, async (tx) => {
    const [row] = await tx<{ id: string; status: "succeeded" | "applied"; result: unknown }[]>`
      select id, status, result from ai_runs
      where site_id = ${siteId} and status in ('succeeded', 'applied')
      order by created_at desc
      limit 1
    `;
    if (!row) return null;
    if (row.status === "succeeded" && !proposalSchema.safeParse(row.result).success) return null;
    return { id: row.id, status: row.status };
  });
}

/**
 * Marks every run a restart interrupted as failed, across all sites, through the
 * security definer function (no site is set at startup). Never throws: a database
 * problem at startup is logged, like /healthz reports it, and does not stop the app.
 */
export async function failInterruptedRuns(): Promise<void> {
  try {
    const [row] = await sql<{ count: number }[]>`select fail_interrupted_ai_runs() as count`;
    console.info(JSON.stringify({ event: "ai_runs_interrupted", count: Number(row?.count ?? 0) }));
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "ai_runs_sweep_failed",
        error: error instanceof Error ? error.message : "unknown",
      }),
    );
  }
}
