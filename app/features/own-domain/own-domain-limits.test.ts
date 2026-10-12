import assert from "node:assert/strict";
import { test } from "node:test";
import { createCheckLimit } from "./own-domain-limits.server.ts";

const ONE_HOUR = 60 * 60 * 1000;

test("the 10th check in an hour is allowed and the 11th is refused", () => {
  const limit = createCheckLimit();
  for (let n = 1; n <= 10; n++) assert.equal(limit.attempt("site-1"), true, `check ${n}`);
  assert.equal(limit.attempt("site-1"), false);
});

test("another site is not affected by a site that is refused", () => {
  const limit = createCheckLimit();
  for (let n = 0; n < 11; n++) limit.attempt("site-1");
  assert.equal(limit.attempt("site-2"), true);
});

test("a refused check does not extend its own block", () => {
  let now = 0;
  const limit = createCheckLimit({ now: () => now });
  for (let n = 0; n < 10; n++) limit.attempt("site-1");
  now = ONE_HOUR - 1;
  assert.equal(limit.attempt("site-1"), false);
  now = ONE_HOUR;
  assert.equal(limit.attempt("site-1"), true);
});

test("checks open again after an hour", () => {
  let now = 0;
  const limit = createCheckLimit({ now: () => now });
  for (let n = 0; n < 11; n++) limit.attempt("site-1");
  assert.equal(limit.attempt("site-1"), false);
  now = ONE_HOUR;
  assert.equal(limit.attempt("site-1"), true);
});
