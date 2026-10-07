/**
 * The Anthropic adapter (18b2 Step 4): one message at Anthropic's own address
 * with a JSON-schema output format and a cached system prompt. Anthropic
 * reports no cost, so it is worked out from the tokens and the configured
 * price. No server-side `fallbacks` (spec Decisions). The description is
 * personal data: it is sent, never logged.
 */
import Anthropic, { APIError } from "@anthropic-ai/sdk";
import type { ProviderSettings } from "#app/lib/ai-env.server.ts";
import { readMessage, refusalCategory, sortAnthropicError } from "./anthropic-response.ts";
import { userMessage } from "./chat-completion.ts";
import { anthropicClientOptions } from "./client-options.ts";
import { INSTRUCTIONS } from "./instructions.ts";
import { providerJsonSchema } from "./provider-schema.ts";
import type { AiAdapter, GenerateInput } from "./run-generation.ts";

const MAX_TOKENS = 8000;

export function createAnthropicAdapter(
  settings: Extract<ProviderSettings, { name: "anthropic" | "openai" }>,
): AiAdapter {
  const client = new Anthropic(anthropicClientOptions(settings.apiKey));

  return {
    async generate(input: GenerateInput, signal: AbortSignal) {
      try {
        const response = await client.messages.create(
          {
            model: settings.model,
            max_tokens: MAX_TOKENS,
            system: [{ type: "text", text: INSTRUCTIONS, cache_control: { type: "ephemeral" } }],
            messages: [{ role: "user", content: userMessage(input) }],
            output_config: { format: { type: "json_schema", schema: providerJsonSchema() } },
          },
          { signal, maxRetries: 2 },
        );
        const category = refusalCategory(response);
        if (category !== null) console.error(`Anthropic refused: ${category}`);
        return readMessage(response, settings.price);
      } catch (error) {
        const sorted = sortAnthropicError(error);
        if (error instanceof APIError && typeof error.status === "number") {
          if (sorted.code === "broken")
            console.error(`Anthropic refused the request: ${error.status}.`);
        }
        throw sorted;
      }
    },
  };
}
