/**
 * Builds the run's adapter from the AI settings (18b2 Step 6): one adapter per
 * configured provider, in `AI_PROVIDERS` order, behind the fallback chain.
 * `ai:try` uses it now, and 18b3's screens will.
 */
import type { AiSettings, ProviderSettings } from "#app/lib/ai-env.server.ts";
import { createAnthropicAdapter } from "./anthropic.server.ts";
import { createFakeAdapter } from "./fake-provider.ts";
import { createFallbackChain } from "./fallback-chain.ts";
import { createOpenAIAdapter } from "./openai.server.ts";
import { createOpenRouterAdapter } from "./openrouter.server.ts";
import type { AiAdapter } from "./run-generation.ts";

export function createProviderAdapter(provider: ProviderSettings): AiAdapter {
  if (provider.name === "fake") return createFakeAdapter({ delayMs: 1000 });
  if (provider.name === "openrouter") return createOpenRouterAdapter(provider);
  if (provider.name === "anthropic") return createAnthropicAdapter(provider);
  return createOpenAIAdapter(provider);
}

export function createAiAdapter(settings: AiSettings): AiAdapter {
  return createFallbackChain(
    settings.providers.map((provider) => ({
      name: provider.name,
      adapter: createProviderAdapter(provider),
    })),
  );
}

/**
 * The adapter the app's runner uses (18b3 Step 2): the fake, else OpenRouter
 * alone, else none - never the fallback chain, whose direct providers have had
 * no live run yet. Wiring the chain in later changes only this function.
 */
export function pickRunAdapter(settings: AiSettings | null): AiAdapter | null {
  const provider = settings?.providers.find(
    (candidate) => candidate.name === "fake" || candidate.name === "openrouter",
  );
  return provider ? createProviderAdapter(provider) : null;
}
