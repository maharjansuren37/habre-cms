/**
 * The OpenRouter adapter (18b1 Step 7, D155 as amended): one chat completion
 * through the `openai` SDK with a strict JSON-schema response format. The
 * description is personal data: it is sent, never logged.
 */
import OpenAI, { APIError } from "openai";
import type { ProviderSettings } from "#app/lib/ai-env.server.ts";
import { readCompletion, sortChatError, userMessage } from "./chat-completion.ts";
import { openRouterClientOptions } from "./client-options.ts";
import { INSTRUCTIONS } from "./instructions.ts";
import { providerJsonSchema } from "./provider-schema.ts";
import type { AiAdapter, GenerateInput } from "./run-generation.ts";

const MAX_TOKENS = 8000;

export function createOpenRouterAdapter(
  settings: Extract<ProviderSettings, { name: "openrouter" }>,
): AiAdapter {
  const client = new OpenAI(openRouterClientOptions(settings.apiKey));

  return {
    async generate(input: GenerateInput, signal: AbortSignal) {
      // Held in variables so the SDK's types, which do not know OpenRouter's
      // `cache_control` or `provider`, do not reject them as excess properties.
      const systemPart = {
        type: "text" as const,
        text: INSTRUCTIONS,
        cache_control: { type: "ephemeral" },
      };
      const openRouterOnly = {
        provider: { require_parameters: true, data_collection: "deny" },
      };
      try {
        const response = await client.chat.completions.create(
          {
            model: settings.model,
            max_tokens: MAX_TOKENS,
            messages: [
              { role: "system", content: [systemPart] },
              { role: "user", content: userMessage(input) },
            ],
            response_format: {
              type: "json_schema",
              json_schema: { name: "site_proposal", strict: true, schema: providerJsonSchema() },
            },
            ...openRouterOnly,
          },
          { signal, maxRetries: 2 },
        );
        return readCompletion(response, { provider: "openrouter", cost: "reported" });
      } catch (error) {
        const sorted = sortChatError(error, "OpenRouter");
        if (error instanceof APIError && typeof error.status === "number") {
          if (error.status === 402) {
            console.error("OpenRouter is out of credits (402).");
          } else if (sorted.code === "broken") {
            console.error(`OpenRouter refused the request: ${error.status}.`);
          }
        }
        throw sorted;
      }
    },
  };
}
