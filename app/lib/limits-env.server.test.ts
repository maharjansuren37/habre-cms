import assert from "node:assert/strict";
import { test } from "node:test";
import {
  launchStorageBytes,
  limitsEnvSchema,
  requireLaunchStorageAtLeastFree,
} from "./limits-env.server.ts";

const MB = 1024 * 1024;
// Not parseEnv: database-env.server.ts parses process.env when imported.
const parse = (source: NodeJS.ProcessEnv) => limitsEnvSchema.parse(source);
// The Launch limit as the app uses it: parsed, then resolved against Free's.
const launch = (source: NodeJS.ProcessEnv) => launchStorageBytes(parse(source));

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

test("an unset LAUNCH_STORAGE_LIMIT_MB gives 10240 MB in bytes", () => {
  assert.equal(launch({}), 10240 * MB);
  assert.equal(launch({ LAUNCH_STORAGE_LIMIT_MB: "" }), 10240 * MB);
});

test("a set LAUNCH_STORAGE_LIMIT_MB is converted to bytes, none removes it", () => {
  assert.equal(launch({ LAUNCH_STORAGE_LIMIT_MB: "2048" }), 2048 * MB);
  assert.equal(launch({ LAUNCH_STORAGE_LIMIT_MB: "none" }), null);
});

test("0, -1, 1.5 and abc are refused naming LAUNCH_STORAGE_LIMIT_MB", () => {
  for (const value of ["0", "-1", "1.5", "abc"]) {
    assert.throws(
      () => parse({ LAUNCH_STORAGE_LIMIT_MB: value }),
      /LAUNCH_STORAGE_LIMIT_MB/,
      value,
    );
  }
});

test("an unset Launch value never lowers below a larger Free value", () => {
  assert.equal(launch({ STORAGE_LIMIT_MB: "20000" }), 20000 * MB);
  assert.equal(launch({ STORAGE_LIMIT_MB: "none" }), null);
});

test("a Launch value below Free's is refused naming both variables", () => {
  assert.throws(
    () => parse({ STORAGE_LIMIT_MB: "600", LAUNCH_STORAGE_LIMIT_MB: "500" }),
    (error: Error) =>
      /LAUNCH_STORAGE_LIMIT_MB/.test(error.message) && /\bSTORAGE_LIMIT_MB/.test(error.message),
  );
  assert.throws(
    () => parse({ STORAGE_LIMIT_MB: "none", LAUNCH_STORAGE_LIMIT_MB: "500" }),
    /LAUNCH_STORAGE_LIMIT_MB/,
  );
});

test("a Launch value equal to Free's, or none, is accepted", () => {
  assert.equal(launch({ STORAGE_LIMIT_MB: "600", LAUNCH_STORAGE_LIMIT_MB: "600" }), 600 * MB);
  assert.equal(launch({ STORAGE_LIMIT_MB: "none", LAUNCH_STORAGE_LIMIT_MB: "none" }), null);
});

test("requireLaunchStorageAtLeastFree reports the issue on LAUNCH_STORAGE_LIMIT_MB", () => {
  const issues: { path?: unknown; message?: string }[] = [];
  const context = { addIssue: (issue: object) => issues.push(issue) } as never;
  requireLaunchStorageAtLeastFree({ STORAGE_LIMIT_MB: 10, LAUNCH_STORAGE_LIMIT_MB: 5 }, context);
  assert.deepEqual(issues[0]?.path, ["LAUNCH_STORAGE_LIMIT_MB"]);
});
