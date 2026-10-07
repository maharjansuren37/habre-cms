import assert from "node:assert/strict";
import { test } from "node:test";
import { aiEnvSchema } from "./ai-env.server.ts";

// Not parseEnv: database-env.server.ts parses process.env when imported.
const parse = (source: NodeJS.ProcessEnv) => aiEnvSchema.parse(source);

test("an unset OPENROUTER_API_KEY turns AI off", () => {
  assert.equal(parse({}).AI, null);
});

test("a blank OPENROUTER_API_KEY turns AI off", () => {
  assert.equal(parse({ OPENROUTER_API_KEY: "" }).AI, null);
});

test("with a key and nothing else, the defaults apply", () => {
  assert.deepEqual(parse({ OPENROUTER_API_KEY: "k" }).AI, {
    providers: ["openrouter"],
    openrouter: { apiKey: "k", model: "anthropic/claude-opus-5.5" },
    creditsPerMonth: 1000,
  });
});

test("blank optional variables count as unset", () => {
  const ai = parse({
    OPENROUTER_API_KEY: "k",
    AI_PROVIDERS: "",
    OPENROUTER_MODEL: "",
    AI_CREDITS_PER_MONTH: "",
  }).AI;
  assert.deepEqual(ai?.providers, ["openrouter"]);
  assert.equal(ai?.openrouter.model, "anthropic/claude-opus-5.5");
  assert.equal(ai?.creditsPerMonth, 1000);
});

test("OPENROUTER_MODEL overrides the default model", () => {
  assert.equal(
    parse({ OPENROUTER_API_KEY: "k", OPENROUTER_MODEL: "openai/gpt-x" }).AI?.openrouter.model,
    "openai/gpt-x",
  );
});

test("AI_PROVIDERS is trimmed around names", () => {
  assert.deepEqual(parse({ OPENROUTER_API_KEY: "k", AI_PROVIDERS: " openrouter " }).AI?.providers, [
    "openrouter",
  ]);
});

test("a whole number allowance is read as a number", () => {
  assert.equal(
    parse({ OPENROUTER_API_KEY: "k", AI_CREDITS_PER_MONTH: "250" }).AI?.creditsPerMonth,
    250,
  );
  assert.equal(
    parse({ OPENROUTER_API_KEY: "k", AI_CREDITS_PER_MONTH: "1" }).AI?.creditsPerMonth,
    1,
  );
});

test("none removes the allowance as null", () => {
  assert.equal(
    parse({ OPENROUTER_API_KEY: "k", AI_CREDITS_PER_MONTH: "none" }).AI?.creditsPerMonth,
    null,
  );
});

test("an unknown, repeated or empty-entry provider list is refused naming AI_PROVIDERS", () => {
  for (const value of [
    "anthropic",
    "openrouter,openrouter",
    "openrouter,anthropic",
    "openrouter,",
    ",",
  ]) {
    assert.throws(
      () => parse({ OPENROUTER_API_KEY: "k", AI_PROVIDERS: value }),
      /AI_PROVIDERS/,
      value,
    );
  }
});

test("a malformed allowance is refused naming AI_CREDITS_PER_MONTH", () => {
  for (const value of ["0", "-1", "1.5", "abc", "1e3"]) {
    assert.throws(
      () => parse({ OPENROUTER_API_KEY: "k", AI_CREDITS_PER_MONTH: value }),
      /AI_CREDITS_PER_MONTH/,
      value,
    );
  }
});

test("bad values are refused even when AI is off", () => {
  assert.throws(() => parse({ AI_PROVIDERS: "anthropic" }), /AI_PROVIDERS/);
  assert.throws(() => parse({ AI_CREDITS_PER_MONTH: "abc" }), /AI_CREDITS_PER_MONTH/);
});

test("refusal messages never contain the value", () => {
  for (const source of [{ AI_PROVIDERS: "secretvalue" }, { AI_CREDITS_PER_MONTH: "secretvalue" }]) {
    assert.throws(
      () => parse(source),
      (error: Error) => !error.message.includes("secretvalue"),
    );
  }
});
