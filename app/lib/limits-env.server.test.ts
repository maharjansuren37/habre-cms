import assert from "node:assert/strict";
import { test } from "node:test";
import { limitsEnvSchema } from "./limits-env.server.ts";

const MB = 1024 * 1024;
// Not parseEnv: database-env.server.ts parses process.env when imported.
const parse = (source: NodeJS.ProcessEnv) => limitsEnvSchema.parse(source);

test("an unset STORAGE_LIMIT_MB gives 500 MB in bytes", () => {
  assert.equal(parse({}).STORAGE_LIMIT_MB, 500 * MB);
});

test("a blank STORAGE_LIMIT_MB counts as unset", () => {
  assert.equal(parse({ STORAGE_LIMIT_MB: "" }).STORAGE_LIMIT_MB, 500 * MB);
});

test("a whole number of MB is converted to bytes", () => {
  assert.equal(parse({ STORAGE_LIMIT_MB: "500" }).STORAGE_LIMIT_MB, 500 * MB);
  assert.equal(parse({ STORAGE_LIMIT_MB: "2048" }).STORAGE_LIMIT_MB, 2048 * MB);
  assert.equal(parse({ STORAGE_LIMIT_MB: "1" }).STORAGE_LIMIT_MB, MB);
});

test("none removes the limit", () => {
  assert.equal(parse({ STORAGE_LIMIT_MB: "none" }).STORAGE_LIMIT_MB, null);
});

test("0, -1, 1.5 and abc are refused naming STORAGE_LIMIT_MB", () => {
  for (const value of ["0", "-1", "1.5", "abc"]) {
    assert.throws(() => parse({ STORAGE_LIMIT_MB: value }), /STORAGE_LIMIT_MB/, value);
  }
});

test("the refusal message never contains the value", () => {
  assert.throws(
    () => parse({ STORAGE_LIMIT_MB: "secretvalue" }),
    (error: Error) =>
      /STORAGE_LIMIT_MB/.test(error.message) && !error.message.includes("secretvalue"),
  );
});
