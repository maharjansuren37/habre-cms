/**
 * The OpenAI adapter (18b2 Step 3): one chat completion at OpenAI's own
 * address with a strict JSON-schema response format. OpenAI reports no cost,
 * so it is worked out from the tokens and the configured price. The
 * description is personal data: it is sent, never logged.
 */
import OpenAI, { APIError } from "openai";
import type { ProviderSettings } from "#app/lib/ai-env.server.ts";
import { readCompletion, sortChatError, userMessage } from "./chat-completion.ts";
import { openAIClientOptions } from "./client-options.ts";
import { INSTRUCTIONS } from "./instructions.ts";
import { providerJsonSchema } from "./provider-schema.ts";
import type { AiAdapter, GenerateInput } from "./run-generation.ts";

const MAX_TOKENS = 8000;

export function createOpenAIAdapter(
  settings: Extract<ProviderSettings, { name: "anthropic" | "openai" }>,
): AiAdapter {
  const client = new OpenAI(openAIClientOptions(settings.apiKey));

  return {
    async generate(input: GenerateInput, signal: AbortSignal) {
      try {
        const response = await client.chat.completions.create(
          {
            model: settings.model,
            // OpenAI deprecated max_tokens; its reasoning models refuse it.
            max_completion_tokens: MAX_TOKENS,
            messages: [
              { role: "system", content: INSTRUCTIONS },
              { role: "user", content: userMessage(input) },
            ],
            response_format: {
              type: "json_schema",
              json_schema: { name: "site_proposal", strict: true, schema: providerJsonSchema() },
            },
          },
          { signal, maxRetries: 2 },
        );
        return readCompletion(response, { provider: "openai", price: settings.price });
      } catch (error) {
        const sorted = sortChatError(error, "OpenAI");
        if (error instanceof APIError && typeof error.status === "number") {
          if (sorted.code === "broken")
            console.error(`OpenAI refused the request: ${error.status}.`);
        }
        throw sorted;
      }
    },
  };
}
