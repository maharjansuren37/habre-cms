/**
 * The pure half of the Anthropic adapter (18b2 Step 4): reading a message and
 * sorting errors. No client, no key, so `node --test` can exercise it.
 * Everything read from the provider goes through Zod - no `as` casts.
 */
import { APIConnectionError, APIError, APIUserAbortError } from "@anthropic-ai/sdk";
import { z } from "zod";
import type { Price } from "#app/lib/ai-env.server.ts";
import { costFromUsage } from "./pricing.ts";
import { AiError, type GenerateResult, type Usage } from "./run-generation.ts";

const messageSchema = z.object({
  model: z.string().optional(),
  stop_reason: z.string().nullish(),
  stop_details: z.object({ category: z.string().nullish() }).nullish(),
  content: z.array(z.object({ type: z.string(), text: z.string().optional() })),
  usage: z.object({
    input_tokens: z.number(),
    cache_read_input_tokens: z.number().nullish(),
    cache_creation_input_tokens: z.number().nullish(),
    output_tokens: z.number(),
  }),
});

const count = (value: number | null | undefined) => value ?? 0;

/** The policy category of a refusal, never its text; `null` when the answer was not a refusal. */
export function refusalCategory(response: unknown): string | null {
  const parsed = messageSchema.safeParse(response);
  if (!parsed.success || parsed.data.stop_reason !== "refusal") return null;
  return parsed.data.stop_details?.category ?? "uncategorised";
}

/** Turns a message into the adapter's result, or throws the `AiError` it deserves. */
export function readMessage(response: unknown, price: Price): GenerateResult {
  const parsed = messageSchema.safeParse(response);
  if (!parsed.success) throw new AiError("invalid", "The response had an unexpected shape.");
  const { model, stop_reason: stopReason, content, usage: reported } = parsed.data;

  const cacheRead = count(reported.cache_read_input_tokens);
  const cacheWrite = count(reported.cache_creation_input_tokens);
  // Anthropic's input_tokens excludes the cache; ours counts every input token.
  const usage: Usage = {
    input: reported.input_tokens + cacheRead + cacheWrite,
    cacheRead,
    cacheWrite,
    output: reported.output_tokens,
  };
  let costUsd: number | undefined;
  try {
    costUsd = costFromUsage(usage, price);
  } catch {
    costUsd = undefined; // counts that do not add up give no cost: the run fails, not goes free
  }
  const carried = {
    ...(costUsd !== undefined ? { usage, costUsd } : {}),
    provider: "anthropic",
    ...(model ? { model } : {}),
  };

  if (stopReason === "refusal") {
    throw new AiError("refused", "The model refused the request.", carried);
  }
  if (stopReason === "max_tokens") {
    throw new AiError("invalid", "The answer was cut off at the token limit.", carried);
  }
  if (costUsd === undefined) {
    throw new AiError("invalid", "The response reported unusable token counts.", carried);
  }
  const text = content.find((block) => block.type === "text")?.text;
  if (text === undefined) throw new AiError("invalid", "The answer had no text.", carried);
  let output: unknown;
  try {
    output = JSON.parse(text);
  } catch {
    throw new AiError("invalid", "The answer was not valid JSON.", carried);
  }
  return { output, usage, costUsd, provider: "anthropic", model: model ?? "unknown" };
}

/**
 * Sorts a failure from the SDK. 429, 529, any 5xx, connection, timeout and
 * the run's own abort are `unavailable`; every other HTTP error and anything
 * unrecognised is `broken`.
 */
export function sortAnthropicError(error: unknown): AiError {
  if (error instanceof AiError) return error;
  if (error instanceof APIUserAbortError)
    return new AiError("unavailable", "The request was aborted.");
  if (error instanceof APIConnectionError) {
    return new AiError("unavailable", "Could not reach Anthropic.");
  }
  if (error instanceof APIError && typeof error.status === "number") {
    const { status } = error;
    if (status === 429 || status >= 500) {
      return new AiError("unavailable", `Anthropic answered ${status}.`);
    }
    return new AiError("broken", `Anthropic answered ${status}.`);
  }
  return new AiError("broken", "An unexpected error calling Anthropic.");
}
