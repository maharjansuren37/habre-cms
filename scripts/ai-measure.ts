// Measures each configured AI provider on its own, not through the fallback
// chain (18b2 Step 7). Needs no database or site.
//
//   npm run ai:measure -- [--repeat <n>] [--out <dir>]
//
// Runs four fixed sample descriptions per provider, one after another, and
// writes each attempt's record and proposal as JSON under --out (default
// ai-measurements/<UTC timestamp>/). Prints a line per attempt and a summary
// per provider and model, never a description. Exit 1 only on a configuration
// error: a failed attempt is a result.
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { z } from "zod";
import { creditsFromCostUsd } from "#app/features/ai/credits.ts";
import { expandProposal } from "#app/features/ai/expand-proposal.ts";
import { MEASURE_SAMPLES } from "#app/features/ai/measure-samples.ts";
import {
  type AttemptRecord,
  classifyAttemptFailure,
  formatAttemptLine,
  formatSummary,
  summarise,
} from "#app/features/ai/measure-summary.ts";
import { type Proposal, proposalSchema } from "#app/features/ai/proposal.ts";
import { createProviderAdapter } from "#app/features/ai/providers.server.ts";
import { RUN_TIMEOUT_MS, type RunErrorCode } from "#app/features/ai/run-generation.ts";
import { parseDocument } from "#app/features/blocks/document.ts";
import { aiEnvFields, toAiSettings } from "#app/lib/ai-env.server.ts";

const USAGE = "Usage: npm run ai:measure -- [--repeat <n>] [--out <dir>]";

function defaultOutDir(now: Date): string {
  const stamp = `${now.toISOString().slice(0, 19).replaceAll(":", "-")}Z`;
  return join("ai-measurements", stamp);
}

function expandsCleanly(proposal: Proposal): boolean {
  try {
    const slugs = Object.fromEntries(proposal.pages.map((page) => [page.key, page.key]));
    const documents = expandProposal(proposal, slugs);
    return Object.values(documents).every((document) => parseDocument(document, "page").ok);
  } catch {
    return false;
  }
}

async function aiMeasure(): Promise<number> {
  const { values } = parseArgs({
    options: { repeat: { type: "string", default: "1" }, out: { type: "string" } },
    strict: true,
  });
  if (!/^[1-9][0-9]*$/.test(values.repeat)) {
    console.error(USAGE);
    return 1;
  }
  const repeat = Number(values.repeat);
  const outDir = values.out ?? defaultOutDir(new Date());

  // Only the AI variables: no database or site is needed.
  const fields = z.object(aiEnvFields).parse(process.env);
  const settings = toAiSettings(fields, (variable) => {
    throw new Error(`${variable} is required`);
  });
  if (!settings) {
    const first = fields.AI_PROVIDERS[0] ?? "openrouter";
    console.error(`AI is off: set ${first.toUpperCase()}_API_KEY.`);
    return 1;
  }

  await mkdir(outDir, { recursive: true });
  const records: AttemptRecord[] = [];
  for (const provider of settings.providers) {
    const adapter = createProviderAdapter(provider);
    for (const sample of MEASURE_SAMPLES) {
      for (let attempt = 1; attempt <= repeat; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), RUN_TIMEOUT_MS);
        const started = Date.now();
        let proposal: Proposal | null = null;
        let error: RunErrorCode | null = null;
        let servedModel: string | null = null;
        let usage: AttemptRecord["usage"] = null;
        let costUsd: number | null = null;
        try {
          const result = await adapter.generate(
            { runId: randomUUID(), ...sample },
            controller.signal,
          );
          servedModel = result.model;
          usage = result.usage;
          costUsd = result.costUsd;
          const parsed = proposalSchema.safeParse(result.output);
          if (parsed.success) proposal = parsed.data;
          else error = "invalid";
        } catch (caught) {
          const failure = classifyAttemptFailure(caught, controller.signal.aborted);
          error = failure.error;
          servedModel = failure.servedModel;
          usage = failure.usage;
          costUsd = failure.costUsd;
        } finally {
          clearTimeout(timer);
        }
        const record: AttemptRecord = {
          provider: provider.name,
          configuredModel: provider.model,
          servedModel,
          kind: sample.kind,
          attempt,
          status: error === null ? "succeeded" : "failed",
          error,
          durationMs: Date.now() - started,
          usage,
          costUsd,
          credits: costUsd === null ? 0 : creditsFromCostUsd(costUsd),
          pages: proposal?.pages.length ?? 0,
          sections: proposal?.pages.reduce((sum, page) => sum + page.sections.length, 0) ?? 0,
          expandsCleanly: proposal !== null && expandsCleanly(proposal),
        };
        records.push(record);
        await writeFile(
          join(outDir, `${provider.name}-${sample.kind}-${attempt}.json`),
          `${JSON.stringify({ record, proposal }, null, 2)}\n`,
        );
        console.log(formatAttemptLine(record));
      }
    }
  }
  console.log(`\n${formatSummary(summarise(records))}`);
  console.log(`\nFiles: ${outDir}`);
  return 0;
}

try {
  process.exitCode = await aiMeasure();
} catch (error) {
  console.error("ai:measure failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
