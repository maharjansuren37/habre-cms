import assert from "node:assert/strict";
import { test } from "node:test";
import { createContactTokens } from "./contact-token-core.server.ts";

const SECRET = "s".repeat(32);
const { issueContactToken, checkContactToken } = createContactTokens(SECRET);
const T0 = 1_700_000_000_000;
const HOUR = 60 * 60 * 1000;

test("a token checked after 3 seconds is ok", () => {
  assert.equal(checkContactToken(issueContactToken(T0), T0 + 3000), "ok");
  assert.equal(checkContactToken(issueContactToken(T0), T0 + 24 * HOUR), "ok");
});

test("a token under 3 seconds old is too fast", () => {
  assert.equal(checkContactToken(issueContactToken(T0), T0 + 2999), "too_fast");
});

test("a token over 24 hours old is stale", () => {
  assert.equal(checkContactToken(issueContactToken(T0), T0 + 24 * HOUR + 1), "stale");
});

test("a forged HMAC is invalid", () => {
  const [issued] = issueContactToken(T0).split(".");
  assert.equal(checkContactToken(`${issued}.${"A".repeat(43)}`, T0 + 5000), "invalid");
  assert.equal(checkContactToken(`${issued}.x`, T0 + 5000), "invalid");
});

test("a token signed with another secret is invalid", () => {
  const other = createContactTokens("o".repeat(32));
  assert.equal(checkContactToken(other.issueContactToken(T0), T0 + 5000), "invalid");
});

test("a tampered time is invalid", () => {
  const [issued, mac] = issueContactToken(T0).split(".");
  assert.equal(checkContactToken(`${Number(issued) - 10 * HOUR}.${mac}`, T0 + 5000), "invalid");
});

test("a future-dated token is invalid", () => {
  assert.equal(checkContactToken(issueContactToken(T0 + HOUR), T0), "invalid");
});

test("missing or malformed tokens are invalid", () => {
  for (const token of [null, undefined, "", "abc", ".", "1.", ".abc", "x.y", "1.2.3"]) {
    assert.equal(checkContactToken(token, T0), "invalid", String(token));
  }
});
