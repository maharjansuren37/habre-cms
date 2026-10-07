// Runs one AI generation for a site and prints the run (18b1 Step 6). The only
// way to start a run until 18b3.
//
//   npm run ai:try -- --address <site> --kind <kind> --description "<text>" [--fake]
//
// Runs as the site's first active admin, waits for the run, prints its status,
// duration, tokens, credits and page titles (never the description). Exit 1 if
// the run is refused or fails. `--fake` uses a provider with no network and works
// with AI off.
import { parseArgs } from "node:util";
import { z } from "zod";
import { createFakeAdapter } from "#app/features/ai/fake-provider.ts";
import { createAiAdapter } from "#app/features/ai/providers.server.ts";
import { type AiAdapter, createRunner, type RunKind } from "#app/features/ai/run-generation.ts";
import { findRun, runStore } from "#app/features/ai/runs.server.ts";
import { aiEnvFields, toAiSettings } from "#app/lib/ai-env.server.ts";
import { sql } from "#app/lib/db.server.ts";

const USAGE =
  'Usage: npm run ai:try -- --address <site> --kind <website|blog|business|portfolio> --description "<text>" [--fake]';
const KINDS = ["website", "blog", "business", "portfolio"] as const;
const isKind = (value: string): value is RunKind => (KINDS as readonly string[]).includes(value);

async function aiTry(): Promise<number> {
  const { values } = parseArgs({
    options: {
      address: { type: "string" },
      kind: { type: "string" },
      description: { type: "string" },
      fake: { type: "boolean", default: false },
    },
    strict: true,
  });
  const address = (values.address ?? "").trim().toLowerCase();
  const kind = values.kind ?? "";
  const description = (values.description ?? "").trim();
  if (address === "" || description === "" || !isKind(kind)) {
    console.error(USAGE);
    return 1;
  }

  // Only the AI variables: the script does not need the web app's whole environment.
  const fields = z.object(aiEnvFields).parse(process.env);
  const allowance = fields.AI_CREDITS_PER_MONTH;

  let adapter: AiAdapter;
  if (values.fake) {
    adapter = createFakeAdapter();
  } else {
    const settings = toAiSettings(fields, (variable) => {
      throw new Error(`${variable} is required`);
    });
    if (!settings) {
      const first = fields.AI_PROVIDERS[0] ?? "openrouter";
      console.error(`AI is off: set ${first.toUpperCase()}_API_KEY, or pass --fake.`);
      return 1;
    }
    adapter = createAiAdapter(settings);
  }

  const [site] = await sql<{ id: string }[]>`select id from sites where subdomain = ${address}`;
  if (!site) {
    console.error(`No site has the address ${address}.`);
    return 1;
  }
  const [admin] = await sql<{ userId: string }[]>`
    select user_id as "userId" from site_members
    where site_id = ${site.id} and role = 'admin' and deactivated_at is null
    order by created_at limit 1
  `;
  if (!admin) {
    console.error(`${address} has no active admin.`);
    return 1;
  }

  const runner = createRunner({ store: runStore, adapter, allowance });
  const started = Date.now();
  const result = await runner.start(site.id, admin.userId, { kind, description });
  if (!result.ok) {
    console.error(
      result.reason === "allowance"
        ? "Refused: the site has no AI credits left this month (allowance reached)."
        : "Refused: busy, a run is already in progress.",
    );
    return 1;
  }
  await result.done;
  const durationMs = Date.now() - started;

  const run = await findRun(site.id, result.runId);
  if (!run) {
    console.error(`Run ${result.runId} was not found after it finished.`);
    return 1;
  }
  console.log(`run:       ${run.id}`);
  console.log(`status:    ${run.status}${run.error ? ` (${run.error})` : ""}`);
  console.log(`duration:  ${durationMs} ms`);
  console.log(`provider:  ${run.provider ?? "-"} / ${run.model ?? "-"}`);
  console.log(
    `tokens:    in ${run.inputTokens ?? "-"}, cached ${run.cachedInputTokens ?? "-"}, ` +
      `cache write ${run.cacheWriteTokens ?? "-"}, out ${run.outputTokens ?? "-"}`,
  );
  console.log(`credits:   ${run.credits}`);
  const titles = pageTitles(run.result);
  if (titles.length > 0) console.log(`pages:     ${titles.join(" | ")}`);
  return run.status === "succeeded" ? 0 : 1;
}

function pageTitles(result: unknown): string[] {
  const parsed = z.object({ pages: z.array(z.object({ title: z.string() })) }).safeParse(result);
  return parsed.success ? parsed.data.pages.map((page) => page.title) : [];
}

try {
  process.exitCode = await aiTry();
} catch (error) {
  console.error("The AI run failed:", error);
  process.exitCode = 1;
} finally {
  await sql.end();
}
