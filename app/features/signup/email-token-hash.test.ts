import assert from "node:assert/strict";
import { test } from "node:test";
import { hashEmailToken } from "./email-token-hash.ts";

test("the hash is SHA-256 hex and never the token", () => {
  const hash = hashEmailToken("abc");
  assert.equal(hash, "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assert.notEqual(hash, "abc");
});
