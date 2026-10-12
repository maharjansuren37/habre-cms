import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import { searchEnvFields } from "./search-env.server.ts";

// Not parseEnv: database-env.server.ts parses process.env when imported.
const parse = (source: NodeJS.ProcessEnv) => z.object(searchEnvFields).parse(source);

test("SEARCH_INDEXING parses on and off", () => {
  assert.equal(parse({ SEARCH_INDEXING: "on" }).SEARCH_INDEXING, "on");
  assert.equal(parse({ SEARCH_INDEXING: "off" }).SEARCH_INDEXING, "off");
});

test("SEARCH_INDEXING defaults to on when blank or unset", () => {
  assert.equal(parse({ SEARCH_INDEXING: "" }).SEARCH_INDEXING, "on");
  assert.equal(parse({}).SEARCH_INDEXING, "on");
});

test("an unknown SEARCH_INDEXING value is refused, naming the variable", () => {
  assert.throws(() => parse({ SEARCH_INDEXING: "no" }), /SEARCH_INDEXING/);
});
