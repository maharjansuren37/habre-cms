import assert from "node:assert/strict";
import { test } from "node:test";
import { parseMessagesPage } from "./messages-query.ts";

const at = (query: string) => new URL(`https://example.org/admin/messages${query}`);

test("the page defaults to 1 when the query string has none", () => {
  assert.equal(parseMessagesPage(at("")), 1);
});

test("a non-integer page falls back to 1", () => {
  assert.equal(parseMessagesPage(at("?page=abc")), 1);
  assert.equal(parseMessagesPage(at("?page=2.5")), 1);
});

test("zero and negative pages become 1", () => {
  assert.equal(parseMessagesPage(at("?page=0")), 1);
  assert.equal(parseMessagesPage(at("?page=-3")), 1);
});

test("a page above the cap is held at the cap", () => {
  assert.equal(parseMessagesPage(at("?page=5000")), 1000);
});

test("a page within range is returned as it is", () => {
  assert.equal(parseMessagesPage(at("?page=7")), 7);
});
