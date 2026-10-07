import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import type { AiSettings, ProviderSettings } from "#app/lib/ai-env.server.ts";
import { pickRunAdapter } from "./providers.server.ts";
import { validProposal } from "./test-proposal.ts";

const price = { input: 1, output: 1, cacheRead: 1, cacheWrite: 1 };
const fake: ProviderSettings = { name: "fake" };
const openrouter: ProviderSettings = { name: "openrouter", apiKey: "k-or", model: "m-or" };
const anthropic: ProviderSettings = { name: "anthropic", apiKey: "k-an", model: "m-an", price };
const openai: ProviderSettings = { name: "openai", apiKey: "k-oa", model: "m-oa", price };

const settings = (...providers: ProviderSettings[]): AiSettings => ({
  providers,
  creditsPerMonth: 1000,
});

const input = { runId: "r1", kind: "blog", description: "A blog about bread." } as const;

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

// Answers every HTTP call as OpenRouter would, and records the hosts called.
function stubFetch(): string[] {
  const hosts: string[] = [];
  globalThis.fetch = async (request) => {
    const url = new URL(request instanceof Request ? request.url : String(request));
    hosts.push(url.host);
    return Response.json({
      model: "served-model",
      choices: [{ finish_reason: "stop", message: { content: JSON.stringify(validProposal()) } }],
      usage: { prompt_tokens: 10, completion_tokens: 5, cost: 0.01 },
    });
  };
  return hosts;
}

test("fake gives the fake adapter", async () => {
  const adapter = pickRunAdapter(settings(fake));
  assert.ok(adapter);
  const result = await adapter.generate(input, new AbortController().signal);
  assert.equal(result.provider, "fake");
});

test("openrouter gives an adapter that answers as openrouter", async () => {
  const hosts = stubFetch();
  const adapter = pickRunAdapter(settings(openrouter));
  assert.ok(adapter);
  const result = await adapter.generate(input, new AbortController().signal);
  assert.equal(result.provider, "openrouter");
  assert.deepEqual(hosts, ["openrouter.ai"]);
});

test("openrouter with fallbacks listed still gives openrouter alone, never the chain", async () => {
  const hosts = stubFetch();
  const adapter = pickRunAdapter(settings(openrouter, anthropic, openai));
  assert.ok(adapter);
  const result = await adapter.generate(input, new AbortController().signal);
  assert.equal(result.provider, "openrouter");
  assert.deepEqual(hosts, ["openrouter.ai"]);
});

test("a list without openrouter gives null", () => {
  assert.equal(pickRunAdapter(settings(anthropic)), null);
  assert.equal(pickRunAdapter(settings(anthropic, openai)), null);
});

test("AI off gives null", () => {
  assert.equal(pickRunAdapter(null), null);
});
