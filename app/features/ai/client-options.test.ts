import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import {
  anthropicClientOptions,
  openAIClientOptions,
  openRouterClientOptions,
} from "./client-options.ts";

// Variables the SDKs read by themselves (F-347). Each would send the key
// elsewhere, add a credential, or log request bodies - the description.
const HOSTILE = {
  OPENAI_BASE_URL: "http://attacker.invalid/v1",
  OPENAI_LOG: "debug",
  ANTHROPIC_BASE_URL: "http://attacker.invalid",
  ANTHROPIC_AUTH_TOKEN: "stolen-token",
  ANTHROPIC_LOG: "debug",
};

let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = {};
  for (const [name, value] of Object.entries(HOSTILE)) {
    saved[name] = process.env[name];
    process.env[name] = value;
  }
});

afterEach(() => {
  for (const [name, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

test("the OpenRouter client keeps OpenRouter's address and never logs requests", () => {
  const client = new OpenAI(openRouterClientOptions("key"));
  assert.equal(client.baseURL, "https://openrouter.ai/api/v1");
  assert.equal(client.logLevel, "warn");
});

test("the OpenAI client ignores OPENAI_BASE_URL and OPENAI_LOG", () => {
  const client = new OpenAI(openAIClientOptions("key"));
  assert.equal(client.baseURL, "https://api.openai.com/v1");
  assert.equal(client.logLevel, "warn");
});

test("the Anthropic client ignores ANTHROPIC_BASE_URL, ANTHROPIC_AUTH_TOKEN and ANTHROPIC_LOG", () => {
  const client = new Anthropic(anthropicClientOptions("key"));
  assert.equal(client.baseURL, "https://api.anthropic.com");
  assert.equal(client.authToken, null);
  assert.equal(client.logLevel, "warn");
});
