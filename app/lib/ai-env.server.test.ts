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
    providers: [{ name: "openrouter", apiKey: "k", model: "anthropic/claude-opus-5.5" }],
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
  assert.deepEqual(ai?.providers, [
    { name: "openrouter", apiKey: "k", model: "anthropic/claude-opus-5.5" },
  ]);
  assert.equal(ai?.creditsPerMonth, 1000);
});

test("OPENROUTER_MODEL overrides the default model", () => {
  assert.equal(
    parse({ OPENROUTER_API_KEY: "k", OPENROUTER_MODEL: "openai/gpt-x" }).AI?.providers[0]?.model,
    "openai/gpt-x",
  );
});

test("AI_PROVIDERS is trimmed around names", () => {
  const names = parse({ OPENROUTER_API_KEY: "k", AI_PROVIDERS: " openrouter " }).AI?.providers;
  assert.deepEqual(
    names?.map((provider) => provider.name),
    ["openrouter"],
  );
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
    "gemini",
    "openrouter,openrouter",
    "openrouter,gemini",
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
  assert.throws(() => parse({ AI_PROVIDERS: "gemini" }), /AI_PROVIDERS/);
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

const PRICE = "input=3,output=15,cache_read=0.3,cache_write=3.75";
const PRICE_PARSED = { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 };

test("AI_PROVIDERS=anthropic with only a key is refused naming ANTHROPIC_MODEL", () => {
  assert.throws(
    () => parse({ AI_PROVIDERS: "anthropic", ANTHROPIC_API_KEY: "k", ANTHROPIC_PRICE: PRICE }),
    /ANTHROPIC_MODEL/,
  );
  assert.throws(
    () => parse({ AI_PROVIDERS: "anthropic", ANTHROPIC_API_KEY: "k" }),
    /ANTHROPIC_MODEL/,
  );
});

test("a listed direct provider with no price is refused naming its price variable", () => {
  assert.throws(
    () => parse({ AI_PROVIDERS: "anthropic", ANTHROPIC_API_KEY: "k", ANTHROPIC_MODEL: "m" }),
    /ANTHROPIC_PRICE/,
  );
});

test("openrouter,openai with no OPENAI_API_KEY is refused naming it", () => {
  assert.throws(
    () =>
      parse({
        OPENROUTER_API_KEY: "k",
        AI_PROVIDERS: "openrouter,openai",
        OPENAI_MODEL: "m",
        OPENAI_PRICE: PRICE,
      }),
    /OPENAI_API_KEY/,
  );
});

test("a malformed price is refused naming ANTHROPIC_PRICE and never its value", () => {
  for (const value of [
    "input=1,output=2,cache_read=3",
    "input=1,output=2,cache_read=3,cache_write=4,input=5",
    "input=1,output=2,cache_read=3,cache_write=4,extra=5",
    "input=1,output=2,cache_read=3,cache_write=-4",
    "input=1,output=2,cache_read=3,cache_write=secretvalue",
    "input=1,output=2,cache_read=3,cache_write=",
  ]) {
    assert.throws(
      () => parse({ ANTHROPIC_PRICE: value }),
      (error: Error) =>
        /ANTHROPIC_PRICE/.test(error.message) &&
        !error.message.includes(value) &&
        !error.message.includes("secretvalue"),
      value,
    );
  }
  assert.throws(
    () => parse({ OPENAI_PRICE: "input=1" }),
    (error: Error) => /OPENAI_PRICE/.test(error.message) && !error.message.includes("input=1"),
  );
});

test("anthropic,openrouter with no Anthropic key is AI off", () => {
  assert.equal(parse({ AI_PROVIDERS: "anthropic,openrouter", OPENROUTER_API_KEY: "k" }).AI, null);
});

test("openrouter,anthropic with no Anthropic key is refused naming ANTHROPIC_API_KEY", () => {
  assert.throws(
    () => parse({ AI_PROVIDERS: "openrouter,anthropic", OPENROUTER_API_KEY: "k" }),
    /ANTHROPIC_API_KEY/,
  );
});

test("a full three-provider configuration parses in the order given", () => {
  const ai = parse({
    AI_PROVIDERS: "anthropic,openrouter,openai",
    ANTHROPIC_API_KEY: "a",
    ANTHROPIC_MODEL: "claude-x",
    ANTHROPIC_PRICE: PRICE,
    OPENROUTER_API_KEY: "r",
    OPENAI_API_KEY: "o",
    OPENAI_MODEL: "gpt-x",
    OPENAI_PRICE: "input=1,output=2,cache_read=0,cache_write=0",
  }).AI;
  assert.deepEqual(ai?.providers, [
    { name: "anthropic", apiKey: "a", model: "claude-x", price: PRICE_PARSED },
    { name: "openrouter", apiKey: "r", model: "anthropic/claude-opus-5.5" },
    {
      name: "openai",
      apiKey: "o",
      model: "gpt-x",
      price: { input: 1, output: 2, cacheRead: 0, cacheWrite: 0 },
    },
  ]);
});
