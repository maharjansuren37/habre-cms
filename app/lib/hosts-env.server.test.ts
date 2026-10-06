import assert from "node:assert/strict";
import { test } from "node:test";
import { hostsEnvSchema } from "./hosts-env.server.ts";

const PLATFORM_URL = "https://app.habre.test";
// Not parseEnv: database-env.server.ts parses process.env when imported.
const parse = (SITES_URL: string) => hostsEnvSchema.parse({ PLATFORM_URL, SITES_URL });

test("a SITES_URL with a path, query or fragment is refused naming SITES_URL", () => {
  for (const value of ["https://habre.page/x", "https://habre.page?q=1", "https://habre.page#f"]) {
    assert.throws(() => parse(value), /SITES_URL/, value);
  }
});

test("a SITES_URL with credentials is refused", () => {
  assert.throws(() => parse("https://user:pw@habre.page"), /SITES_URL/);
});

test("a bare origin is accepted, with or without the trailing slash", () => {
  for (const value of ["https://habre.page", "https://habre.page/", "http://localhost:3100"]) {
    assert.equal(parse(value).SITES_URL, value);
  }
});

test("a scheme other than http or https is refused", () => {
  assert.throws(() => parse("ftp://habre.page"), /SITES_URL/);
});

test("the refusal message never contains the value", () => {
  assert.throws(
    () => parse("https://habre.page/secretvalue"),
    (error: Error) => /SITES_URL/.test(error.message) && !error.message.includes("secretvalue"),
  );
});

test("PLATFORM_URL must be an http(s) URL", () => {
  assert.throws(() => hostsEnvSchema.parse({ PLATFORM_URL: "nope", SITES_URL: "https://a.test" }));
});

test("a PLATFORM_URL with a path is refused naming PLATFORM_URL", () => {
  assert.throws(
    () =>
      hostsEnvSchema.parse({ PLATFORM_URL: "https://app.habre.ai/x", SITES_URL: "https://a.test" }),
    /PLATFORM_URL/,
  );
});

test("an origin whose host ends in a dot is refused, naming the variable", () => {
  assert.throws(() => parse("https://habre.page."), /SITES_URL/);
  assert.throws(
    () =>
      hostsEnvSchema.parse({ PLATFORM_URL: "https://app.habre.ai.", SITES_URL: "https://a.test" }),
    /PLATFORM_URL/,
  );
});
