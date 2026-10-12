import { findMemberSite } from "#app/features/sites/find-site.server.ts";
import { env } from "#app/lib/env.server.ts";
import { allowanceForSites } from "./allowance.ts";
import { pickRunAdapter } from "./providers.server.ts";
import { createRunner } from "./run-generation.ts";
import { runStore } from "./runs.server.ts";

// The process's one runner (18b3 Step 2). A module singleton: one per process
// holds D154's two-run limit. `null` when AI is off or no adapter fits, so
// onboarding is then not offered.
const adapter = pickRunAdapter(env.AI);

if (
  env.AI?.providers.some((provider) => provider.name === "anthropic" || provider.name === "openai")
) {
  console.info(JSON.stringify({ event: "ai_fallbacks_unused", runs: "openrouter only" }));
}

export const runner =
  env.AI && adapter
    ? createRunner({
        store: runStore,
        adapter,
        // The site's plan sets its allowance (item 21a); the row is a platform table.
        allowanceFor: allowanceForSites(
          async (siteId) => (await findMemberSite(siteId)).plan,
          env.PLAN_LIMITS,
        ),
      })
    : null;
