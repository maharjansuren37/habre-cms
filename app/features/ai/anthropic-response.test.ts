import assert from "node:assert/strict";
import { test } from "node:test";
import Anthropic from "@anthropic-ai/sdk";
import type { Price } from "#app/lib/ai-env.server.ts";
import { readMessage, refusalCategory, sortAnthropicError } from "./anthropic-response.ts";
import { AiError } from "./run-generation.ts";
import { validProposal } from "./test-proposal.ts";

const price: Price = { input: 4, output: 20, cacheRead: 0.4, cacheWrite: 5 };

const message = (overrides: Record<string, unknown> = {}) => ({
  id: "msg_1",
  type: "message",
  role: "assistant",
  model: "claude-served-1",
  content: [{ type: "text", text: JSON.stringify(validProposal()) }],
  stop_reason: "end_turn",
  stop_details: null,
  usage: {
    input_tokens: 1000,
    cache_read_input_tokens: 500,
    cache_creation_input_tokens: 200,
    output_tokens: 300,
  },
  ...overrides,
});

function failure(fn: () => unknown): AiError {
  try {
    fn();
  } catch (error) {
    assert.ok(error instanceof AiError, "expected an AiError");
    return error;
  }
  throw new assert.AssertionError({ message: "expected a throw" });
}

test("a success sums the input tokens, prices them and records the served model", () => {
  const result = readMessage(message(), price);
  assert.deepEqual(result.usage, { input: 1700, cacheRead: 500, cacheWrite: 200, output: 300 });
  // 1000 uncached * 4 + 500 * 0.4 + 200 * 5 + 300 * 20 = 4000 + 200 + 1000 + 6000
  assert.equal(result.costUsd, 11200 / 1_000_000);
  assert.equal(result.provider, "anthropic");
  assert.equal(result.model, "claude-served-1");
  assert.deepEqual(result.output, validProposal());
});

test("null cache counts read as zero", () => {
  const result = readMessage(
    message({
      usage: {
        input_tokens: 10,
        cache_read_input_tokens: null,
        cache_creation_input_tokens: null,
        output_tokens: 5,
      },
    }),
    price,
  );
  assert.deepEqual(result.usage, { input: 10, cacheRead: 0, cacheWrite: 0, output: 5 });
});

test("a refusal is refused, carries usage and cost, and its category is readable alone", () => {
  const response = message({
    stop_reason: "refusal",
    stop_details: { type: "refusal", category: "cyber", explanation: "secret words" },
    content: [],
  });
  const error = failure(() => readMessage(response, price));
  assert.equal(error.code, "refused");
  assert.equal(error.provider, "anthropic");
  assert.equal(error.model, "claude-served-1");
  assert.equal(error.costUsd, 11200 / 1_000_000);
  assert.equal(error.usage?.input, 1700);
  assert.equal(refusalCategory(response), "cyber");
  assert.equal(refusalCategory(message()), null);
  assert.doesNotMatch(error.message, /secret words/);
});

test("a max_tokens stop is invalid and carries its cost", () => {
  const error = failure(() => readMessage(message({ stop_reason: "max_tokens" }), price));
  assert.equal(error.code, "invalid");
  assert.equal(error.costUsd, 11200 / 1_000_000);
});

test("a response with no text block is invalid and carries its cost", () => {
  const error = failure(() =>
    readMessage(message({ content: [{ type: "thinking", thinking: "x", signature: "s" }] }), price),
  );
  assert.equal(error.code, "invalid");
  assert.equal(error.costUsd, 11200 / 1_000_000);
});

test("the first text block is the one parsed, after a thinking block", () => {
  const result = readMessage(
    message({
      content: [
        { type: "thinking", thinking: "x", signature: "s" },
        { type: "text", text: '{"a":1}' },
      ],
    }),
    price,
  );
  assert.deepEqual(result.output, { a: 1 });
});

test("unparseable text is invalid and carries its cost", () => {
  const error = failure(() =>
    readMessage(message({ content: [{ type: "text", text: "not json" }] }), price),
  );
  assert.equal(error.code, "invalid");
  assert.equal(error.costUsd, 11200 / 1_000_000);
});

test("a negative token count is invalid with no cost", () => {
  const error = failure(() =>
    readMessage(
      message({
        usage: {
          input_tokens: -5,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
          output_tokens: 1,
        },
      }),
      price,
    ),
  );
  assert.equal(error.code, "invalid");
  assert.equal(error.costUsd, null);
});

test("a response of the wrong shape is invalid", () => {
  assert.equal(failure(() => readMessage({ nope: 1 }, price)).code, "invalid");
});

const http = (status: number) =>
  Anthropic.APIError.generate(status, { message: "x" }, "x", new Headers());

test("429, 529, 500 and 503 are unavailable and name Anthropic", () => {
  for (const status of [429, 529, 500, 503]) {
    const sorted = sortAnthropicError(http(status));
    assert.equal(sorted.code, "unavailable", String(status));
    assert.match(sorted.message, /Anthropic/);
  }
});

test("400, 401, 403 and 404 are broken", () => {
  for (const status of [400, 401, 403, 404]) {
    assert.equal(sortAnthropicError(http(status)).code, "broken", String(status));
  }
});

test("connection, timeout and abort errors are unavailable", () => {
  assert.equal(sortAnthropicError(new Anthropic.APIConnectionError({})).code, "unavailable");
  assert.equal(sortAnthropicError(new Anthropic.APIConnectionTimeoutError()).code, "unavailable");
  assert.equal(sortAnthropicError(new Anthropic.APIUserAbortError()).code, "unavailable");
});

test("an AiError passes through and an unknown error is broken", () => {
  const own = new AiError("refused", "x");
  assert.equal(sortAnthropicError(own), own);
  const unknown = sortAnthropicError(new TypeError("boom"));
  assert.equal(unknown.code, "broken");
  assert.match(unknown.message, /Anthropic/);
});
